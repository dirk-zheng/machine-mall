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
    keywords: ['inci', 'solubility', 'use level', 'dosage', 'disperse', 'formulation', 'formula'],
    response: 'Formulation Support 🧪\n\nShare the ingredient, dosage form, target function, process and pH range. We can help identify the relevant grade, starting use level and handling guidance.'
  },
  {
    keywords: ['moq', 'minimum order', 'sample', 'quantity', 'pack size', 'trial order'],
    response: 'Ingredient Samples & Supply 📦\n\nTell us the material, evaluation quantity, annual volume and destination. Sample availability, commercial pack size, MOQ and lead time are confirmed by grade and lot.'
  },
  {
    keywords: ['document', 'report', 'customs', 'clearance', 'stability test', 'compatibility test', 'ingredient list', 'compliance'],
    response: 'Raw-Material Documents 📄\n\nAvailable files may include TDS, SDS, INCI, representative COA and supporting quality or regulatory statements. Requirements are confirmed by material and market.'
  },
  {
    keywords: ['price', 'cost', 'how much', 'cheap', 'discount', 'promotion', 'pricing', 'quote'],
    response: 'Ingredient Quotation 💰\n\nShare the material or INCI, grade, target market, estimated volume and destination. Pricing follows the confirmed specification, pack size and quantity.'
  },
  {
    keywords: ['shipping', 'delivery', 'logistics', 'transport', 'how long', 'freight', 'tracking'],
    response: 'Order & Delivery Support 🚢\n\nShipment planning, cartons, commercial documents and delivery coordination follow the confirmed order. Market compliance responsibilities are agreed before production.'
  },
  {
    keywords: ['quality', 'damage', 'contamination', 'off-spec', 'inspect', 'inspection', 'qc', 'assay', 'microbiology', 'coa', 'traceability'],
    response: 'Ingredient Quality Support 🛡️\n\nQualification can cover specification, identity or assay, microbiological limits, representative sample, COA, traceability and change notification.'
  },
  {
    keywords: ['payment', 'pay', 'method', 'wire', 'bank', 'credit', 'terms', 'TT', 'LC'],
    response: 'Order Terms 💳\n\nPayment terms are confirmed clearly in the quotation and proforma invoice for each order. We keep order, QC, loading and document requirements aligned before shipment.'
  }
];

// Default fallback replies
const defaultReplies = [
  'Thank you for contacting Aurelia Ingredients. Ask about INCI, use levels, samples, documentation, MOQ or pricing.',
  'Hello! Share your formulation brief, target market, required documents and expected volume.',
  'Welcome to Aurelia Ingredients. How can we support your raw-material evaluation?'
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
