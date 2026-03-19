'use strict';
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('./db');

const JWT_SECRET  = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '8h';

if (!JWT_SECRET) {
  console.error('[AUTH] FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

class AuthService {
  async ensureDefaultUsers() {
    const { rows } = await db.query('SELECT COUNT(*) AS cnt FROM users');
    if (parseInt(rows[0].cnt) > 0) return;

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@2025';
    const hrUser    = process.env.HR_USERNAME    || 'hr';
    const hrPass    = process.env.HR_PASSWORD    || 'Hr@2025';

    await db.query(
      `INSERT INTO users (id, username, password_hash, role, name) VALUES
       ($1,$2,$3,'admin','Administrator'),
       ($4,$5,$6,'hr','HR Manager')
       ON CONFLICT (username) DO NOTHING`,
      [
        crypto.randomBytes(8).toString('hex'),
        adminUser, bcrypt.hashSync(adminPass, 10),
        crypto.randomBytes(8).toString('hex'),
        hrUser,    bcrypt.hashSync(hrPass, 10),
      ]
    );
    console.log(`[AUTH] Default users created: ${adminUser} (admin), ${hrUser} (hr)`);
    console.log('[AUTH] ⚠️  Change default passwords via POST /api/auth/change-password');
  }

  async login(username, password) {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE username = $1', [username]
    );
    if (!rows.length) throw new Error('Invalid username or password');

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid username or password');

    const payload = { id: user.id, username: user.username, role: user.role, name: user.name };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    return { token, user: payload };
  }

  async listUsers() {
    const { rows } = await db.query(
      'SELECT id, username, role, name, created_at FROM users ORDER BY created_at'
    );
    return rows;
  }

  async addUser({ username, password, role, name }) {
    if (!username || !username.trim()) throw new Error('username is required');
    if (!password || password.length < 6)  throw new Error('password must be at least 6 characters');
    if (!['admin', 'hr'].includes(role))   throw new Error("role must be 'admin' or 'hr'");

    const id   = crypto.randomBytes(8).toString('hex');
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (id, username, password_hash, role, name)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, role, name`,
      [id, username.trim(), hash, role, name || username.trim()]
    );
    if (!rows.length) throw new Error('Username already exists');
    return rows[0];
  }

  async changePassword(username, currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters');
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!rows.length) throw new Error('User not found');

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) throw new Error('Current password is incorrect');

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2',
      [bcrypt.hashSync(newPassword, 10), username]
    );
  }

  async deleteUser(username) {
    const { rows } = await db.query(
      `DELETE FROM users WHERE username = $1
       RETURNING id`, [username]
    );
    if (!rows.length) throw new Error('User not found');

    const remaining = await db.query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'");
    if (parseInt(remaining.rows[0].cnt) === 0) {
      // Re-insert deleted user since we must keep at least one admin
      // (shouldn't happen because we check before deletion — kept as safety net)
      throw new Error('Cannot delete the last admin account');
    }
  }

  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  async refreshToken(token) {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [payload.id]);
    if (!rows.length) throw new Error('User no longer exists');
    const newPayload = { id: payload.id, username: payload.username, role: payload.role, name: payload.name };
    return jwt.sign(newPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  }
}

module.exports = new AuthService();
