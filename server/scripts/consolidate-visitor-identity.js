require('dotenv').config();
const mysql = require('mysql2/promise');

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function constraintExists(connection, tableName, constraintName) {
  const [rows] = await connection.query(
    'SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1',
    [tableName, constraintName]
  );
  return rows.length > 0;
}

async function addParentForeignKey(connection, childTable, childColumn, parentTable, parentColumn, constraintName) {
  if (!await tableExists(connection, childTable) || !await tableExists(connection, parentTable)) return;
  const [[orphan]] = await connection.query(
    `SELECT COUNT(*) AS total FROM \`${childTable}\` child LEFT JOIN \`${parentTable}\` parent ON parent.\`${parentColumn}\` = child.\`${childColumn}\` WHERE parent.\`${parentColumn}\` IS NULL`
  );
  if (Number(orphan.total) > 0) {
    throw new Error(`Cannot add ${constraintName}: ${orphan.total} orphan record(s) exist in ${childTable}`);
  }
  if (!await constraintExists(connection, childTable, constraintName)) {
    await connection.query(
      `ALTER TABLE \`${childTable}\` ADD CONSTRAINT \`${constraintName}\` FOREIGN KEY (\`${childColumn}\`) REFERENCES \`${parentTable}\` (\`${parentColumn}\`) ON DELETE CASCADE`
    );
  }
}

async function migrateJsonRows(connection, tableName, keyColumn, dataColumn, transform) {
  if (!await tableExists(connection, tableName)) return;
  const [rows] = await connection.query(`SELECT \`${keyColumn}\` AS record_key, \`${dataColumn}\` AS record_data FROM \`${tableName}\``);
  for (const row of rows) {
    const data = typeof row.record_data === 'string' ? JSON.parse(row.record_data) : row.record_data;
    await connection.query(
      `UPDATE \`${tableName}\` SET \`${dataColumn}\` = ? WHERE \`${keyColumn}\` = ?`,
      [JSON.stringify(transform(data)), row.record_key]
    );
  }
}

function moveAccount(data, legacyKeys = []) {
  data.account ||= legacyKeys.map((key) => data[key]).find(Boolean) || null;
  legacyKeys.forEach((key) => delete data[key]);
  return data;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'curva_denim_b2b',
  });

  try {
    await migrateJsonRows(connection, 'users', 'visitor_id', 'user_data', (user) => moveAccount(user, ['userName', 'username']));
    await connection.query('ALTER TABLE users MODIFY visitor_id VARCHAR(80) NOT NULL');
    if (await indexExists(connection, 'users', 'idx_users_user_name')) await connection.query('ALTER TABLE users DROP INDEX idx_users_user_name');
    if (await columnExists(connection, 'users', 'user_name')) await connection.query('ALTER TABLE users DROP COLUMN user_name');
    if (await columnExists(connection, 'users', 'account')) {
      await connection.query(`ALTER TABLE users MODIFY account VARCHAR(255) GENERATED ALWAYS AS
        (LOWER(JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.account')))) STORED`);
    } else {
      await connection.query(`ALTER TABLE users ADD COLUMN account VARCHAR(255) GENERATED ALWAYS AS
        (LOWER(JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.account')))) STORED AFTER user_data`);
    }
    if (!await indexExists(connection, 'users', 'idx_users_account')) await connection.query('ALTER TABLE users ADD INDEX idx_users_account (account)');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS visitor_events (
        visitor_id VARCHAR(80) NOT NULL,
        event_id VARCHAR(64) NOT NULL,
        account VARCHAR(255) NULL,
        event_type VARCHAR(100) NOT NULL,
        page_path VARCHAR(500) NULL,
        entity_type VARCHAR(64) NULL,
        entity_id VARCHAR(128) NULL,
        event_data JSON NULL,
        occurred_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (visitor_id, event_id),
        KEY idx_visitor_events_account_time (account, occurred_at),
        KEY idx_visitor_events_visitor_time (visitor_id, occurred_at),
        KEY idx_visitor_events_type_time (event_type, occurred_at)
      ) ENGINE=InnoDB
    `);
    await connection.query('ALTER TABLE visitor_events MODIFY visitor_id VARCHAR(80) NOT NULL');
    const [eventSources] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'visitor_events\\_%' ESCAPE '\\\\'"
    );
    for (const source of eventSources.map((row) => row.TABLE_NAME)) {
      const sourceAccount = await columnExists(connection, source, 'account')
        ? 'source.account'
        : await columnExists(connection, source, 'user_name')
          ? 'source.user_name'
          : 'NULL';
      await connection.query(`
        INSERT IGNORE INTO visitor_events
          (visitor_id, event_id, account, event_type, page_path, entity_type, entity_id, event_data, occurred_at)
        SELECT source.visitor_id, source.event_id,
          COALESCE(${sourceAccount}, (SELECT linked.account FROM users linked WHERE linked.visitor_id = source.visitor_id LIMIT 1)),
          source.event_type, source.page_path, source.entity_type, source.entity_id, source.event_data, source.occurred_at
        FROM \`${source}\` source
      `);
    }
    if (await tableExists(connection, 'user_events')) {
      await connection.query(`
        INSERT IGNORE INTO visitor_events
          (visitor_id, event_id, account, event_type, page_path, entity_type, entity_id, event_data, occurred_at)
        SELECT event.visitor_id, event.event_id,
          (SELECT linked.account FROM users linked WHERE linked.visitor_id = event.visitor_id LIMIT 1),
          event.event_type, event.page_path, event.entity_type, event.entity_id, event.event_data, event.occurred_at
        FROM user_events event
      `);
    }

    if (await columnExists(connection, 'visitor_events', 'user_name')) {
      await connection.query('ALTER TABLE visitor_events CHANGE COLUMN user_name account VARCHAR(255) NULL');
    }
    if (await indexExists(connection, 'visitor_events', 'idx_visitor_events_name_time')) {
      await connection.query('ALTER TABLE visitor_events DROP INDEX idx_visitor_events_name_time');
    }
    if (!await indexExists(connection, 'visitor_events', 'idx_visitor_events_account_time')) {
      await connection.query('ALTER TABLE visitor_events ADD INDEX idx_visitor_events_account_time (account, occurred_at)');
    }

    await connection.query('DROP TABLE IF EXISTS user_profiles');

    if (await tableExists(connection, 'rfq_assortments')) {
      await connection.query('ALTER TABLE rfq_assortments MODIFY visitor_id VARCHAR(80) NOT NULL');
    }

    await migrateJsonRows(connection, 'quotes', 'quote_id', 'quote_data', (quote) => moveAccount(quote, ['userName', 'username']));
    if (await indexExists(connection, 'quotes', 'idx_quotes_user_name')) await connection.query('ALTER TABLE quotes DROP INDEX idx_quotes_user_name');
    if (await columnExists(connection, 'quotes', 'user_name')) await connection.query('ALTER TABLE quotes DROP COLUMN user_name');
    if (!await columnExists(connection, 'quotes', 'account')) {
      await connection.query(`ALTER TABLE quotes ADD COLUMN account VARCHAR(255) GENERATED ALWAYS AS
        (LOWER(JSON_UNQUOTE(JSON_EXTRACT(quote_data, '$.account')))) STORED AFTER reference`);
    }
    if (!await indexExists(connection, 'quotes', 'idx_quotes_account')) await connection.query('ALTER TABLE quotes ADD INDEX idx_quotes_account (account)');
    if (await columnExists(connection, 'quotes', 'visitor_id')) {
      await connection.query(`ALTER TABLE quotes MODIFY visitor_id VARCHAR(80) GENERATED ALWAYS AS
        (JSON_UNQUOTE(JSON_EXTRACT(quote_data, '$.visitorId'))) STORED`);
    }

    await migrateJsonRows(connection, 'support_messages', 'message_id', 'message_data', (message) => moveAccount(message, ['userName', 'username']));
    await migrateJsonRows(connection, 'support_conversations', 'conversation_id', 'conversation_data', (conversation) => {
      conversation.customerAccount ||= conversation.customerUserName || conversation.customerUsername || null;
      conversation.assignedAccount ||= conversation.assignedUserName || conversation.assignedTo || null;
      conversation.claimedByAccount ||= conversation.claimedByUserName || conversation.claimedBy || null;
      ['customerUserName', 'customerUsername', 'assignedUserName', 'assignedTo', 'claimedByUserName', 'claimedBy'].forEach((key) => delete conversation[key]);
      return conversation;
    });
    await migrateJsonRows(connection, 'support_conversation_messages', 'message_id', 'message_data', (message) => moveAccount(message, ['userName', 'username', 'senderUserName']));
    await migrateJsonRows(connection, 'im_messages', 'message_id', 'message_data', (message) => {
      message.senderAccount ||= message.senderUserName || null;
      delete message.senderUserName;
      return message;
    });

    await addParentForeignKey(connection, 'im_messages', 'room_id', 'im_rooms', 'room_id', 'fk_im_messages_room');
    await addParentForeignKey(
      connection, 'support_conversation_messages', 'conversation_id',
      'support_conversations', 'conversation_id', 'fk_support_messages_conversation'
    );

    await connection.query('DROP TABLE IF EXISTS user_events, user_consents, visitor_users');
    const [[count]] = await connection.query('SELECT COUNT(*) AS total FROM visitor_events');
    console.log(`Account identity schema consolidated; ${count.total} visitor event(s) retained.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Account identity consolidation failed: ${error.message}`);
  process.exitCode = 1;
});
