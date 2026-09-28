const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();
const REQUEST_TYPES = new Set(['access', 'delete', 'correct', 'export', 'opt-out']);

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

router.post('/requests', async (req, res, next) => {
  try {
    const email = clean(req.body.email, 254).toLowerCase();
    const requestType = clean(req.body.requestType, 32);
    const visitorId = clean(req.header('X-Visitor-Id'), 80);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ code: 400, message: 'A valid email is required.' });
    if (!REQUEST_TYPES.has(requestType)) return res.status(400).json({ code: 400, message: 'Select a valid request type.' });
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(visitorId)) return res.status(400).json({ code: 400, message: 'A valid visitor ID is required.' });
    if (req.body.website) return res.status(201).json({ data: { reference: 'PRIV-RECEIVED' } });

    const id = uuidv4();
    const reference = `PRIV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${id.slice(0, 8).toUpperCase()}`;
    const request = {
      id,
      reference,
      visitorId,
      email,
      requestType,
      details: clean(req.body.details, 1500),
      status: 'verification_required',
      policyVersion: '2026-09-09',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.upsert('privacyRequests', id, request);
    await db.recordVisitorEvent({ visitorId, eventType: 'privacy.request_submitted', entityType: 'privacy_request', entityId: reference, data: { requestType } });
    return res.status(201).json({
      data: {
        reference,
        status: request.status,
        message: 'Request received. We will verify your identity before acting on it.',
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
