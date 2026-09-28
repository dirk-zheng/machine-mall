const { v4: uuidv4 } = require('uuid');
const db = require('../database');

function readStore() {
  return {
    conversations: db.list('supportConversations'),
    messages: db.list('supportConversationMessages'),
  };
}

let mutationQueue = Promise.resolve();

function runExclusive(work) {
  const pending = mutationQueue.then(work, work);
  mutationQueue = pending.catch(() => undefined);
  return pending;
}

async function persist(conversation, messages = []) {
  await db.upsertBatch([
    { name: 'supportConversations', key: conversation.id, value: conversation },
    ...messages.map((message) => ({
      name: 'supportConversationMessages', key: message.id,
      value: message, extraValue: conversation.id,
    })),
  ]);
}

function listMessages(store, conversationId) {
  return store.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-200);
}

function appendMessageToStore(store, conversation, input) {
  const now = new Date().toISOString();
  const message = {
    id: uuidv4(), conversationId: conversation.id, senderType: input.senderType,
    visitorId: input.visitorId || null, account: input.account || null, senderName: input.senderName,
    content: String(input.content || '').trim(), internalNote: Boolean(input.internalNote),
    createdAt: now, readAt: null,
  };
  store.messages.push(message);
  conversation.lastMessage = message.content.slice(0, 120);
  conversation.lastMessageAt = now;
  conversation.updatedAt = now;
  return message;
}

async function createConversation(customer) {
  const store = readStore();
  const customerKey = customer.visitorId || customer.account;
  const legacyKeys = new Set([customer.visitorId ? `guest_${customer.visitorId}` : null].filter(Boolean));
  let conversation = store.conversations
    .filter((item) => (
      item.customerVisitorId === customerKey
      || legacyKeys.has(item.customerVisitorId)
      || (item.legacyCustomer && item.customerAccount === customer.account)
    ) && item.status !== 'closed')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  if (conversation) {
    if (conversation.customerVisitorId !== customerKey) {
      conversation.customerVisitorId = customerKey;
      delete conversation.legacyCustomer;
      conversation.updatedAt = new Date().toISOString();
      await persist(conversation);
    }
    return { conversation: { ...conversation }, messages: listMessages(store, conversation.id), created: false };
  }

  const now = new Date().toISOString();
  conversation = {
    id: uuidv4(), customerVisitorId: customerKey, customerName: customer.name || customer.account,
    customerAccount: customer.role === 'guest' ? null : customer.account,
    status: 'waiting_human', assignedAccount: null,
    assignedName: null, claimedByAccount: null, priority: 'high', botEnabled: false,
    lastMessage: '', lastMessageAt: now, createdAt: now, updatedAt: now, resolvedAt: null,
  };
  store.conversations.push(conversation);
  const greeting = appendMessageToStore(store, conversation, {
    senderType: 'bot', senderName: 'Kora · AI Assistant',
    content: 'Hello, we’re working hard to find a human support agent for you…',
  });
  await persist(conversation, [greeting]);
  return { conversation: { ...conversation }, messages: listMessages(store, conversation.id), created: true };
}

function updateConversation(conversationId, updater) {
  return runExclusive(async () => {
    const store = readStore();
    const conversation = store.conversations.find((item) => item.id === conversationId);
    if (!conversation) throw new Error('Conversation not found');
    const createdMessages = [];
    const appendMessage = (message) => {
      const created = appendMessageToStore(store, conversation, message);
      createdMessages.push(created);
      return created;
    };
    const result = updater({ store, conversation, appendMessage });
    conversation.updatedAt = new Date().toISOString();
    await persist(conversation, createdMessages);
    return { conversation: { ...conversation }, result };
  });
}

function getConversation(conversationId) {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');
  return { conversation: { ...conversation }, messages: listMessages(store, conversationId) };
}

function getCustomerConversation(customer) { return runExclusive(() => createConversation(customer)); }
function listConversations() {
  return readStore().conversations.map((item) => ({ ...item })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

module.exports = { getCustomerConversation, getConversation, listConversations, updateConversation };
