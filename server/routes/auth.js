const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();
function readUsers() {
  return db.list('users').map((user) => ({
    ...user,
    account: user.account || user.account,
    role: user.role === 'salesperson' ? 'seller' : user.role,
  }));
}

// POST /api/auth/login
//处理用户登录并返回用户信息与JWT令牌
router.post('/login', async (req, res) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      return res.status(400).json({ code: 400, message: 'Account and password are required' });
    }

    const users = readUsers();
    //根据用户名查找登录用户
    const loginName = String(account).trim().toLowerCase();
    const user = users.find(u => String(u.account).toLowerCase() === loginName);

    if (!user) {
      await db.recordVisitorEvent({ visitorId: req.get('x-visitor-id'), eventType: 'auth.login_failed', data: { account: loginName } });
      return res.status(401).json({ code: 401, message: 'Invalid account or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await db.recordVisitorEvent({ visitorId: req.get('x-visitor-id'), account: user.account, eventType: 'auth.login_failed' });
      return res.status(401).json({ code: 401, message: 'Invalid account or password' });
    }

    const visitorId = req.get('x-visitor-id');
    const linkedUser = visitorId ? await db.bindVisitorToUser(visitorId, user) : user;

    const token = generateToken(linkedUser);
    const { password: _, ...safeUser } = linkedUser;
    await db.recordVisitorEvent({ account: user.account, visitorId, eventType: 'auth.login_succeeded' });
    const behavior = visitorId ? await db.getBehaviorContext(user.account, visitorId) : null;

    res.json({
      code: 200,
      message: 'Login successful',
      data: {
        user: safeUser,
        token,
        behavior,
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// POST /api/auth/register
//处理新用户注册并生成登录令牌
router.post('/register', async (req, res) => {
  try {
    const { account, password, name, quoteReference, acceptedTerms, policyVersion } = req.body;

    if (!account || !password) {
      return res.status(400).json({ code: 400, message: 'Account and password are required' });
    }

    if (typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ code: 400, message: 'Password must be at least 12 characters' });
    }
    if (acceptedTerms !== true || policyVersion !== '2026-09-09') return res.status(400).json({ code: 400, message: 'Terms acceptance is required' });

    const users = readUsers();
    const accountValue = String(account).trim();
    const normalizedAccount = accountValue.includes('@') ? accountValue.toLowerCase() : accountValue;
    const visitorId = req.get('x-visitor-id');
    if (!visitorId) {
      return res.status(400).json({ code: 400, message: 'A valid visitor ID is required' });
    }
    if (visitorId) db.assertVisitorCanBind(visitorId, normalizedAccount);
    
    //检查注册用户名是否已经存在
    if (users.some(u => String(u.account).toLowerCase() === normalizedAccount.toLowerCase())) {
      return res.status(409).json({ code: 409, message: 'An account already uses this email or account' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      account: normalizedAccount,
      visitorId,
      password: hashedPassword,
      role: 'user',
      name: name || normalizedAccount,
      legalAcceptedAt: new Date().toISOString(),
      legalPolicyVersion: policyVersion,
    };

    await db.bindVisitorToUser(visitorId, newUser);

    if (quoteReference && normalizedAccount.includes('@')) {
      const quotes = db.list('quotes');
      const quote = quotes.find((item) => item.reference === quoteReference && item.customer?.email?.toLowerCase() === normalizedAccount);
      if (quote) {
        quote.account = newUser.account;
        quote.accountLinkedAt = new Date().toISOString();
        await db.upsert('quotes', quote.id, quote);
      }
    }

    const token = generateToken(newUser);
    const { password: _, ...safeUser } = newUser;
    await db.recordVisitorEvent({ account: newUser.account, visitorId, eventType: 'auth.registered' });
    const behavior = visitorId ? await db.getBehaviorContext(newUser.account, visitorId) : null;

    res.status(201).json({
      code: 201,
      message: 'Registration successful',
      data: {
        user: safeUser,
        token,
        behavior,
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// GET /api/auth/me
//返回当前已登录用户信息
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    code: 200,
    data: req.user
  });
});

module.exports = router;
