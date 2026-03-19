'use strict';
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB       || 'rajac',
  user:     process.env.POSTGRES_USER     || 'rajac',
  password: process.env.POSTGRES_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id           VARCHAR(30)  PRIMARY KEY,
      username     VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT        NOT NULL,
      role         VARCHAR(20)  NOT NULL CHECK (role IN ('admin','hr')),
      name         VARCHAR(255),
      created_at   TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS config (
      setting VARCHAR(100) PRIMARY KEY,
      value   TEXT         NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      student_id         VARCHAR(20)    PRIMARY KEY,
      name               VARCHAR(255)   NOT NULL,
      year               VARCHAR(50),
      number_of_subjects INTEGER        DEFAULT 0,
      total_fees         NUMERIC(12,2)  DEFAULT 0,
      discount_percent   NUMERIC(5,2)   DEFAULT 0,
      discount_amount    NUMERIC(12,2)  DEFAULT 0,
      net_amount         NUMERIC(12,2)  DEFAULT 0,
      total_paid         NUMERIC(12,2)  DEFAULT 0,
      remaining_balance  NUMERIC(12,2)  DEFAULT 0,
      phone_number       VARCHAR(30),
      enrollment_date    DATE,
      status             VARCHAR(20)    DEFAULT 'Active',
      last_payment_date  TIMESTAMPTZ,
      created_at         TIMESTAMPTZ    DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments_log (
      payment_id        VARCHAR(30)   PRIMARY KEY,
      student_id        VARCHAR(20)   REFERENCES students(student_id),
      student_name      VARCHAR(255),
      payment_date      TIMESTAMPTZ   DEFAULT NOW(),
      amount_paid       NUMERIC(12,2),
      payment_method    VARCHAR(50),
      discount_applied  NUMERIC(12,2) DEFAULT 0,
      net_amount        NUMERIC(12,2),
      remaining_balance NUMERIC(12,2),
      installment_number INTEGER,
      processed_by      VARCHAR(100),
      notes             TEXT          DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS transactions (
      transaction_id      VARCHAR(30)   PRIMARY KEY,
      date                TIMESTAMPTZ   DEFAULT NOW(),
      type                VARCHAR(20),
      amount              NUMERIC(12,2),
      subject             VARCHAR(255),
      payer_receiver_name VARCHAR(255),
      payment_method      VARCHAR(50),
      notes               TEXT          DEFAULT '',
      processed_by        VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS bank_deposits (
      deposit_id    VARCHAR(30)   PRIMARY KEY,
      date          TIMESTAMPTZ   DEFAULT NOW(),
      amount        NUMERIC(12,2),
      bank_name     VARCHAR(100),
      deposited_by  VARCHAR(100),
      notes         TEXT          DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id                VARCHAR(30)   PRIMARY KEY,
      name              VARCHAR(255),
      subject           VARCHAR(255),
      number_of_classes INTEGER       DEFAULT 0,
      total_amount      NUMERIC(12,2) DEFAULT 0,
      total_paid        NUMERIC(12,2) DEFAULT 0,
      remaining_balance NUMERIC(12,2) DEFAULT 0,
      created_at        TIMESTAMPTZ   DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS academic_year_archives (
      id           SERIAL        PRIMARY KEY,
      academic_year VARCHAR(20)  NOT NULL,
      table_name   VARCHAR(50)   NOT NULL,
      data         JSONB         NOT NULL,
      archived_at  TIMESTAMPTZ   DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS backup_index (
      backup_id    VARCHAR(30)  PRIMARY KEY,
      created_at   TIMESTAMPTZ  DEFAULT NOW(),
      label        VARCHAR(255),
      created_by   VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS backup_data (
      id          SERIAL       PRIMARY KEY,
      backup_id   VARCHAR(30)  REFERENCES backup_index(backup_id) ON DELETE CASCADE,
      table_name  VARCHAR(50),
      row_data    JSONB        NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_students_status      ON students(status);
    CREATE INDEX IF NOT EXISTS idx_students_year        ON students(year);
    CREATE INDEX IF NOT EXISTS idx_payments_student     ON payments_log(student_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_deposits_date        ON bank_deposits(date);
    CREATE INDEX IF NOT EXISTS idx_backup_data_backup   ON backup_data(backup_id);
  `);

  // Seed default config
  await query(`
    INSERT INTO config (setting, value) VALUES
      ('Number_of_Installments',        '3'),
      ('Installment_1_Date',            '2025-10-15'),
      ('Installment_2_Date',            '2025-12-15'),
      ('Installment_3_Date',            '2026-02-15'),
      ('Current_Academic_Year',         '2025-2026'),
      ('WhatsApp_Notifications_Enabled','false'),
      ('Notification_Days_Before_Due',  '7')
    ON CONFLICT (setting) DO NOTHING;
  `);

  // Migrate users.json → users table (runs once)
  await _migrateUsersFile();

  console.log('[DB] Schema ready.');
}

async function _migrateUsersFile() {
  const usersFile = path.join(__dirname, '..', 'users.json');
  if (!fs.existsSync(usersFile)) return;
  try {
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    for (const u of users) {
      await query(
        `INSERT INTO users (id, username, password_hash, role, name)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (username) DO NOTHING`,
        [u.id, u.username, u.password_hash, u.role, u.name || u.username]
      );
    }
    fs.renameSync(usersFile, usersFile + '.migrated');
    console.log('[DB] Migrated users.json → database.');
  } catch (err) {
    console.error('[DB] Warning: users.json migration failed:', err.message);
  }
}

module.exports = { pool, query, transaction, initSchema };
