const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { detectContactChannels, notifyContactDetailsShared, notifyFirstRobotChat } = require('../services/larkNotifications');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// AI Keyword matching configuration
const keywordRules = [
  {
    keywords: ['custom', 'customize', 'oem', 'odm', 'branding', 'wrap', 'logo', 'cabinet'],
    response: 'Custom Vending Development 🛠️\n\nShare your product dimensions, package weight, capacity target, exterior branding and rollout quantity. We can recommend a base platform and custom engineering scope.'
  },
  {
    keywords: ['moq', 'minimum order', 'prototype', 'sample machine', 'quantity', 'trial order'],
    response: 'Prototype & Production 📦\n\nTell us the base model, custom functions, prototype quantity, production quantity and destination. MOQ and lead time depend on the approved configuration.'
  },
  {
    keywords: ['payment', 'card', 'cashless', 'qr', 'wallet', 'coin', 'badge', 'age verification'],
    response: 'Payments & Access 💳\n\nMachines can support bank cards, mobile wallets, QR, cash, employee badges, memberships and identity verification. Availability depends on the target market and payment provider.'
  },
  {
    keywords: ['price', 'cost', 'how much', 'cheap', 'discount', 'promotion', 'pricing', 'quote'],
    response: 'Custom Machine Quotation 💰\n\nShare the model, product type, dispensing method, cooling, payment, branding, software requirements, quantity and destination. Pricing follows the approved configuration.'
  },
  {
    keywords: ['cooling', 'refrigeration', 'frozen', 'temperature', 'heat', 'compressor'],
    response: 'Temperature Configuration ❄️\n\nTell us the required storage range and ambient operating conditions. We can configure ambient, refrigerated, frozen or hot-food systems with remote temperature alerts.'
  },
  {
    keywords: ['software', 'api', 'erp', 'telemetry', 'dashboard', 'inventory', 'remote', 'integration'],
    response: 'Software & Integration 📊\n\nWe can configure machine telemetry, inventory and sales reporting, remote content, alerts, custom UI and API or ERP integration.'
  },
  {
    keywords: ['shipping', 'delivery', 'installation', 'logistics', 'transport', 'how long', 'freight', 'tracking'],
    response: 'Delivery & Installation 🚚\n\nWe plan export packaging, freight, access requirements, installation, commissioning and operator training around the approved machine configuration and destination.'
  }
];

// Default fallback replies
const defaultReplies = [
  'Thank you for contacting Vendora Systems. Ask about base models, customization, payments, software, MOQ or pricing.',
  'Hello! Share your product, vending scenario, custom functions, target market and expected quantity.',
  'Welcome to Vendora Systems. How can we support your custom vending project?'
];

// Get AI response based on keywords
//根据用户消息关键词生成客服回复
function getAIResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

  for (const rule of keywordRules) {
    for (const keyword of rule.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return { reply: rule.response, matchedKeyword: keyword };
      }
    }
  }

  // Random default reply
  const randomReply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  return { reply: randomReply, matchedKeyword: null };
}

// POST /api/support/chat - Send message and get AI reply
//接收客服消息并返回关键词匹配结果
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ code: 400, message: 'Message cannot be empty' });
    }

    const userMessage = message.trim();
    const result = getAIResponse(userMessage);
    const timestamp = new Date().toISOString();
    const messageId = uuidv4();
    const isFirstChat = !db.list('supportMessages').some((item) => item.account === req.user.account);
    await db.upsert('supportMessages', messageId, {
      id: messageId, account: req.user.account, userMessage, aiReply: result.reply,
      matchedKeyword: result.matchedKeyword, createdAt: timestamp,
    });
    await db.recordVisitorEvent({
      visitorId: req.get('x-visitor-id'), account: req.user.account,
      eventType: 'support.chat_message', entityType: 'support_message', entityId: messageId
    });
    const contactChannels = detectContactChannels(userMessage);
    if (contactChannels.length) {
      void notifyContactDetailsShared({
        user: req.user,
        message: userMessage,
        channels: contactChannels,
        timestamp,
      });
    } else if (isFirstChat) {
      void notifyFirstRobotChat({
        user: req.user,
        message: userMessage,
        matchedKeyword: result.matchedKeyword,
        timestamp,
      });
    }

    res.json({
      code: 200,
      data: {
        userMessage,
        aiReply: result.reply,
        matchedKeyword: result.matchedKeyword,
        timestamp
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// GET /api/support/faq - Get frequently asked questions
//返回客服模块常见问题列表
router.get('/faq', (req, res) => {
  const faqFile = path.join(__dirname, '..', 'data', 'faqs.json');
  const faqs = JSON.parse(fs.readFileSync(faqFile, 'utf8'));
  res.json({
    code: 200,
    data: faqs.filter((faq) => faq.published !== false)
  });
});

module.exports = router;
