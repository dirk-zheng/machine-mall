const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let mysql;
let pool;
let ready = false;
let lastError = null;

const TABLES = {
  users: { table: 'users', key: 'visitor_id', data: 'user_data' },
  quotes: { table: 'quotes', key: 'quote_id', data: 'quote_data' },
  rfqAssortments: { table: 'rfq_assortments', key: 'visitor_id', data: 'assortment_data' },
  imRooms: { table: 'im_rooms', key: 'room_id', data: 'room_data' },
  imMessages: { table: 'im_messages', key: 'message_id', data: 'message_data', extra: 'room_id' },
  supportMessages: { table: 'support_messages', key: 'message_id', data: 'message_data' },
  supportConversations: { table: 'support_conversations', key: 'conversation_id', data: 'conversation_data' },
  supportConversationMessages: { table: 'support_conversation_messages', key: 'message_id', data: 'message_data', extra: 'conversation_id' },
  privacyRequests: { table: 'privacy_requests', key: 'request_id', data: 'request_data' },
};

function normalizeVisitorId(value) {
  const visitorId = String(value || '').trim();
  return /^[a-zA-Z0-9-]{16,80}$/.test(visitorId) ? visitorId : '';
}

const cache = Object.fromEntries(Object.keys(TABLES).map((name) => [name, new Map()]));

function config() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'curva_denim_b2b',
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    charset: 'utf8mb4',
  };
}

function parseJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assertStore(name) {
  if (!TABLES[name]) throw new Error(`Unknown database store: ${name}`);
}

function prepareUpsert(name, key, value, extraValue) {
  assertStore(name);
  const definition = TABLES[name];
  const recordKey = String(key);
  const columns = [`\`${definition.key}\``, `\`${definition.data}\``];
  const values = [recordKey, JSON.stringify(value)];
  const updateColumns = [definition.data];
  if (definition.extra) {
    const parentId = String(extraValue || value[definition.extra === 'room_id' ? 'roomId' : 'conversationId'] || '');
    if (!parentId) throw new Error(`${definition.extra} is required for ${name}`);
    columns.splice(1, 0, `\`${definition.extra}\``);
    values.splice(1, 0, parentId);
    updateColumns.unshift(definition.extra);
  }
  return {
    name,
    recordKey,
    value: clone(value),
    sql: `INSERT INTO \`${definition.table}\` (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${updateColumns.map((column) => `\`${column}\` = VALUES(\`${column}\`)`).join(', ')}`,
    values,
  };
}

async function initializeDatabase() {
  if (ready) return;
  if (!process.env.DB_USER) throw new Error('DB_USER is required for the user-data database.');
  mysql = require('mysql2/promise');
  pool = mysql.createPool(config());
  await pool.query('SELECT 1');
  for (const [name, definition] of Object.entries(TABLES)) {
    const [rows] = await pool.query(`SELECT \`${definition.key}\` AS record_key, \`${definition.data}\` AS record_data FROM \`${definition.table}\``);
    cache[name].clear();
    rows.forEach((row) => cache[name].set(String(row.record_key), parseJson(row.record_data)));
  }
  ready = true;
  lastError = null;
}

function list(name) {
  assertStore(name);
  return Array.from(cache[name].values(), clone);
}

function get(name, key) {
  assertStore(name);
  return clone(cache[name].get(String(key)));
}

async function upsert(name, key, value, extraValue) {
  const operation = prepareUpsert(name, key, value, extraValue);
  await pool.query(operation.sql, operation.values);
  cache[name].set(operation.recordKey, operation.value);
}

async function upsertBatch(operations) {
  const prepared = operations.map((operation) => prepareUpsert(
    operation.name, operation.key, operation.value, operation.extraValue
  ));
  if (!prepared.length) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const operation of prepared) {
      await connection.query(operation.sql, operation.values);
    }
    await connection.commit();
    prepared.forEach((operation) => cache[operation.name].set(operation.recordKey, operation.value));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function remove(name, key) {
  assertStore(name);
  const definition = TABLES[name];
  const recordKey = String(key);
  await pool.query(`DELETE FROM \`${definition.table}\` WHERE \`${definition.key}\` = ?`, [recordKey]);
  cache[name].delete(recordKey);
}

async function replaceAll(name, records, keyField = 'id') {
  assertStore(name);
  const definition = TABLES[name];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM \`${definition.table}\``);
    for (const record of records) {
      const key = String(record[keyField]);
      const columns = [`\`${definition.key}\``, `\`${definition.data}\``];
      const values = [key, JSON.stringify(record)];
      if (definition.extra) {
        columns.splice(1, 0, `\`${definition.extra}\``);
        values.splice(1, 0, String(record[definition.extra === 'room_id' ? 'roomId' : 'conversationId'] || ''));
      }
      await connection.query(`INSERT INTO \`${definition.table}\` (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
    }
    await connection.commit();
    cache[name] = new Map(records.map((record) => [String(record[keyField]), clone(record)]));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordVisitorEvent(input = {}) {
  if (!pool) return;
  const eventId = input.id || uuidv4();
  const visitorId = normalizeVisitorId(input.visitorId);
  const user = visitorId ? get('users', visitorId) : null;
  const account = String(input.account || user?.account || '').trim().toLowerCase() || null;
  if (!visitorId) return { recorded: false };
  await pool.query(
    `INSERT INTO visitor_events (visitor_id, event_id, account, event_type, page_path, entity_type, entity_id, event_data, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [visitorId, eventId, account, input.eventType, input.pagePath || null, input.entityType || null,
      input.entityId || null, JSON.stringify(input.data || {}), input.occurredAt ? new Date(input.occurredAt) : new Date()]
  );
  return { recorded: true, visitorId, eventId };
}

function assertVisitorCanBind(visitorId, account) {
  const normalizedVisitorId = normalizeVisitorId(visitorId);
  if (!normalizedVisitorId) throw new Error('A valid visitor ID is required');
  const normalizedAccount = String(account || '').trim().toLowerCase();
  const existing = get('users', normalizedVisitorId);
  if (existing && String(existing.account || '').toLowerCase() !== normalizedAccount) {
    throw new Error('This visitor ID is already associated with another account');
  }
  return existing;
}

async function bindVisitorToUser(visitorId, user) {
  const existing = assertVisitorCanBind(visitorId, user.account);
  const now = new Date().toISOString();
  const linkedUser = {
    ...user,
    visitorId: normalizeVisitorId(visitorId),
    account: user.account,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await upsert('users', linkedUser.visitorId, linkedUser);
  return linkedUser;
}

async function getBehaviorContext(account, currentVisitorId) {
  const normalizedAccount = String(account || '').trim().toLowerCase();
  const linkedUsers = list('users').filter(
    (item) => String(item.account || '').toLowerCase() === normalizedAccount
  );
  const visitorIds = [...new Set(linkedUsers.map((item) => item.visitorId).filter(Boolean))];
  if (!visitorIds.length) return { currentVisitorId: normalizeVisitorId(currentVisitorId), visitorIds: [], events: [] };
  const placeholders = visitorIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT visitor_id, event_id, account, event_type, page_path, entity_type, entity_id, event_data, occurred_at
     FROM visitor_events WHERE visitor_id IN (${placeholders}) ORDER BY occurred_at ASC LIMIT 1000`,
    visitorIds
  );
  return {
    currentVisitorId: normalizeVisitorId(currentVisitorId),
    visitorIds,
    events: rows.map((row) => ({
      visitorId: row.visitor_id,
      eventId: row.event_id,
      account: row.account,
      eventType: row.event_type,
      pagePath: row.page_path,
      entityType: row.entity_type,
      entityId: row.entity_id,
      data: parseJson(row.event_data) || {},
      occurredAt: row.occurred_at,
    })),
  };
}

function getDatabaseStatus() {
  return {
    connected: ready,
    engine: 'mysql',
    scope: 'user-data-only',
    error: lastError ? lastError.message : null,
  };
}

async function closeDatabase() {
  if (pool) await pool.end();
  pool = null;
  ready = false;
}

async function installSchema() {
  mysql = require('mysql2/promise');
  const options = config();
  const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
  let sql = fs.readFileSync(schemaPath, 'utf8');
  const connection = await mysql.createConnection({ ...options, database: undefined, multipleStatements: true });
  try {
    try {
      await connection.query(sql);
    } catch (error) {
      if (!['ER_DBACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) throw error;
      sql = sql.replace(/CREATE DATABASE[\s\S]*?;/i, '').replace(/USE `[^`]+`;/i, `USE \`${options.database}\`;`);
      await connection.query(sql);
    }
  } finally {
    await connection.end();
  }
}

module.exports = {
  initializeDatabase, installSchema, list, get, upsert, upsertBatch, remove, replaceAll,
  recordVisitorEvent, assertVisitorCanBind, bindVisitorToUser, getBehaviorContext,
  getDatabaseStatus, closeDatabase,
};
