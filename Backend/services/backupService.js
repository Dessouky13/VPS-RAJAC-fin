'use strict';
const crypto = require('crypto');
const db     = require('./db');

const BACKUP_TABLES = ['students', 'payments_log', 'transactions', 'bank_deposits', 'teachers', 'config'];
const MAX_BACKUPS   = 5;

class BackupService {
  generateId() {
    const ts = Date.now().toString(36).toUpperCase();
    return `BKP${ts}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  async createBackup(label = 'Manual backup', createdBy = 'System') {
    const backupId = this.generateId();

    await db.transaction(async (client) => {
      // Insert index entry
      await client.query(
        `INSERT INTO backup_index (backup_id, label, created_by) VALUES ($1,$2,$3)`,
        [backupId, label, createdBy]
      );

      // Snapshot each table
      for (const tableName of BACKUP_TABLES) {
        const { rows } = await client.query(`SELECT * FROM ${tableName}`);
        if (rows.length === 0) continue;
        const values = rows.map((_, i) => `($1, $2, $${i + 3})`).join(',');
        // Insert in batches of 100
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          for (const row of batch) {
            await client.query(
              `INSERT INTO backup_data (backup_id, table_name, row_data) VALUES ($1,$2,$3)`,
              [backupId, tableName, JSON.stringify(row)]
            );
          }
        }
      }
    });

    // Enforce max 5 backups — delete oldest beyond limit
    const { rows: all } = await db.query(
      'SELECT backup_id FROM backup_index ORDER BY created_at ASC'
    );
    if (all.length > MAX_BACKUPS) {
      const toDelete = all.slice(0, all.length - MAX_BACKUPS);
      for (const b of toDelete) {
        await db.query('DELETE FROM backup_index WHERE backup_id = $1', [b.backup_id]);
      }
    }

    const { rows: info } = await db.query(
      'SELECT * FROM backup_index WHERE backup_id = $1', [backupId]
    );
    return { backupId, createdAt: info[0].created_at, label, tablesSnapshot: BACKUP_TABLES };
  }

  async listBackups() {
    const { rows } = await db.query(
      'SELECT backup_id, created_at, label, created_by FROM backup_index ORDER BY created_at DESC'
    );
    return rows;
  }

  async restoreFromBackup(backupId = null) {
    // Default to most recent
    if (!backupId) {
      const { rows } = await db.query(
        'SELECT backup_id FROM backup_index ORDER BY created_at DESC LIMIT 1'
      );
      if (!rows.length) return { success: false, message: 'No backups available' };
      backupId = rows[0].backup_id;
    }

    const { rows: check } = await db.query(
      'SELECT * FROM backup_index WHERE backup_id = $1', [backupId]
    );
    if (!check.length) throw new Error(`Backup ${backupId} not found`);

    const { rows: backupRows } = await db.query(
      'SELECT table_name, row_data FROM backup_data WHERE backup_id = $1',
      [backupId]
    );

    // Group by table
    const byTable = {};
    for (const r of backupRows) {
      byTable[r.table_name] = byTable[r.table_name] || [];
      byTable[r.table_name].push(r.row_data);
    }

    await db.transaction(async (client) => {
      // Restore in dependency order to satisfy FK constraints
      const order = ['config', 'students', 'payments_log', 'transactions', 'bank_deposits', 'teachers'];
      for (const tableName of order) {
        if (!byTable[tableName]) continue;

        // Temporarily disable FK checks for this restore
        const rows = byTable[tableName];
        if (!rows.length) continue;

        // Clear the table (preserve users table — never restore user accounts from backup)
        await client.query(`DELETE FROM ${tableName}`);

        for (const row of rows) {
          const keys   = Object.keys(row);
          const cols   = keys.map(k => `"${k}"`).join(',');
          const vals   = keys.map((_, i) => `$${i + 1}`).join(',');
          await client.query(
            `INSERT INTO ${tableName} (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`,
            keys.map(k => row[k])
          );
        }
      }
    });

    return { success: true, backupId, restoredFrom: check[0].created_at, label: check[0].label };
  }
}

module.exports = new BackupService();
