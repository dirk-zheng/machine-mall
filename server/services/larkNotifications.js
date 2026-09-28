const crypto = require('crypto');

const LARK_WEBHOOK_URL = String(process.env.LARK_WEBHOOK_URL || '').trim();
const LARK_WEBHOOK_SECRET = String(process.env.LARK_WEBHOOK_SECRET || '').trim();
const LARK_NOTIFICATIONS_ENABLED = String(process.env.LARK_NOTIFICATIONS_ENABLED || 'true').toLowerCase() !== 'false';
const LARK_REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.LARK_REQUEST_TIMEOUT_MS || 8000));

let warnedAboutConfig = false;

function truncate(value, max = 1000) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatValue(value, max) {
  if (Array.isArray(value)) return value.length ? truncate(value.join(', '), max) : '-';
  return truncate(value, max);
}

function validateWebhookUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'open.larksuite.com'
      && url.pathname.startsWith('/open-apis/bot/v2/hook/');
  } catch {
    return false;
  }
}

function createSignature(timestamp, secret = LARK_WEBHOOK_SECRET) {
  if (!secret) return undefined;
  const stringToSign = `${timestamp}\n${secret}`;
  return crypto.createHmac('sha256', stringToSign).update('').digest('base64');
}

function plainText(content) {
  return { tag: 'plain_text', content: truncate(content, 2000) };
}

function field(label, value) {
  return { is_short: true, text: plainText(`${label}\n${formatValue(value, 500)}`) };
}

function sectionFields(fields) {
  const entries = Object.entries(fields).map(([label, value]) => field(label, value));
  const elements = [];
  for (let index = 0; index < entries.length; index += 10) {
    elements.push({ tag: 'div', fields: entries.slice(index, index + 10) });
  }
  return elements;
}

function detailSection(label, value) {
  if (value === null || value === undefined || value === '') return null;
  return { tag: 'div', text: plainText(`${label}\n${formatValue(value, 1800)}`) };
}

function buildCard({ title, template = 'orange', fields = {}, details = [] }) {
  return {
    config: { wide_screen_mode: true },
    header: { template, title: plainText(title) },
    elements: [
      ...sectionFields(fields),
      ...details.map(([label, value]) => detailSection(label, value)).filter(Boolean),
    ],
  };
}

async function sendLarkCard(card) {
  if (!LARK_NOTIFICATIONS_ENABLED) return { sent: false, reason: 'disabled' };
  if (!validateWebhookUrl(LARK_WEBHOOK_URL)) {
    if (!warnedAboutConfig) {
      console.warn('Lark notifications are disabled: configure a valid international LARK_WEBHOOK_URL.');
      warnedAboutConfig = true;
    }
    return { sent: false, reason: 'lark-not-configured' };
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = { msg_type: 'interactive', card };
  const sign = createSignature(timestamp);
  if (sign) Object.assign(payload, { timestamp, sign });

  try {
    const response = await fetch(LARK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(LARK_REQUEST_TIMEOUT_MS),
    });
    const result = await response.json().catch(() => ({}));
    const resultCode = result.code ?? result.StatusCode;
    if (!response.ok || (resultCode !== undefined && Number(resultCode) !== 0)) {
      throw new Error(result.msg || result.StatusMessage || `HTTP ${response.status}`);
    }
    return { sent: true };
  } catch (error) {
    console.error(`Lark notification failed: ${error.message}`);
    return { sent: false, reason: 'send-failed' };
  }
}

function notifyQuoteInquiry(quote) {
  const customer = quote.customer || {};
  const itemSummary = Array.isArray(quote.items)
    ? quote.items.map((item) => `${item.name || item.productId} × ${item.quantity}`).join('; ')
    : '';

  return sendLarkCard(buildCard({
    title: `New cosmetic ingredient inquiry · ${quote.reference}`,
    template: 'orange',
    fields: {
      Reference: quote.reference,
      Source: quote.source || 'Member ingredient RFQ list',
      Name: customer.name,
      Company: customer.company,
      Country: customer.country,
      Email: customer.email || customer.account || customer.account,
      'Phone / WhatsApp': customer.whatsapp,
      'Business type': quote.buyerProfile?.businessType,
      'Target markets': quote.buyerProfile?.salesChannels,
      'Estimated quantity (kg)': quote.estimatedQuantity,
      Market: quote.market,
      'Target delivery': quote.targetDelivery,
      Time: quote.createdAt,
    },
    details: [
      ['Ingredient category', quote.productCategory],
      ['Organization / application profile', quote.targetCustomerProfile],
      ['Technical requirements', quote.specifications],
      ['Materials', itemSummary],
      ['Notes', quote.notes],
    ],
  }));
}

function notifyFirstRobotChat({ user, message, matchedKeyword, timestamp, conversationId }) {
  return sendLarkCard(buildCard({
    title: 'New website support conversation',
    template: 'blue',
    fields: {
      Name: user?.name,
      Account: user?.account,
      'Conversation ID': conversationId,
      'Matched topic': matchedKeyword,
      Time: timestamp,
    },
    details: [['First customer message', message]],
  }));
}

function detectContactChannels(message) {
  const content = String(message || '');
  const channels = [];
  if (content.includes('@')) channels.push('@ / email address');
  if (/\be-?mail\b/i.test(content)) channels.push('Email');
  if (/\bwhats\s*app\b|wa\.me\//i.test(content)) channels.push('WhatsApp');
  if (/\btelegram\b|t\.me\//i.test(content)) channels.push('Telegram');
  return [...new Set(channels)];
}

function notifyContactDetailsShared({ user, conversation, message, channels, timestamp }) {
  return sendLarkCard(buildCard({
    title: 'Customer shared contact information',
    template: 'purple',
    fields: {
      Priority: 'High intent',
      Name: user?.name || conversation?.customerName,
      Account: user?.account || conversation?.customerAccount,
      'Visitor ID': conversation?.customerVisitorId,
      'Conversation ID': conversation?.id,
      'Detected channel': channels,
      'Conversation status': conversation?.status,
      Time: timestamp || new Date().toISOString(),
    },
    details: [['Customer message', message]],
  }));
}

function notifySupportHandoff({ user, conversation, reason, message, timestamp }) {
  return sendLarkCard(buildCard({
    title: 'Sales representative requested',
    template: 'red',
    fields: {
      Priority: 'High',
      Name: user?.name || conversation?.customerName,
      Account: user?.account || conversation?.customerAccount,
      'Visitor ID': conversation?.customerVisitorId,
      'Conversation ID': conversation?.id,
      Trigger: reason,
      Time: timestamp || new Date().toISOString(),
    },
    details: [['Latest customer message', message]],
  }));
}

module.exports = {
  notifyQuoteInquiry,
  notifyFirstRobotChat,
  notifyContactDetailsShared,
  notifySupportHandoff,
  detectContactChannels,
  _internals: { buildCard, createSignature, validateWebhookUrl },
};
