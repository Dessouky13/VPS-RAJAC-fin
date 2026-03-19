'use strict';
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const cron     = require('node-cron');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const db             = require('./services/db');
const studentService = require('./services/studentService');
const financeService = require('./services/financeService');
const paymentDueService = require('./services/paymentDueService');
const teachersService   = require('./services/teachersService');
const authService       = require('./services/authService');
const backupService     = require('./services/backupService');

const { requireAuth, requireAdmin, requireHR, rateLimit, auditLog } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Trust proxy (Nginx on VPS) ────────────────────────────────────────────────
app.set('trust proxy', 1);

// ── Security & logging ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled — pure API server
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'https://rajac-fin.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Global auth guard ─────────────────────────────────────────────────────────
const PUBLIC_PATHS = ['/health', '/auth/login', '/auth/refresh'];
app.use('/api', (req, res, next) => {
  if (PUBLIC_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'))) return next();
  requireAuth(req, res, next);
});

// ── Admin-only prefixes ───────────────────────────────────────────────────────
const ADMIN_PREFIXES = ['/finance/', '/bank/', '/payments/', '/teachers/', '/analytics', '/admin/'];
app.use('/api', (req, res, next) => {
  if (ADMIN_PREFIXES.some(p => req.path.startsWith(p))) return requireAdmin(req, res, next);
  next();
});

// ── Student write routes require HR ──────────────────────────────────────────
app.use('/api/students', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) return requireHR(req, res, next);
  next();
});

// ── File upload setup ─────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) return cb(null, true);
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: 'RAJAC Finance API', version: '2.0.0' }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', rateLimit(10, 60000), async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, error: 'username and password are required' });
    const result = await authService.login(username, password);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// S-4: Token refresh — issues a new 8-hour token for a still-valid token
app.post('/api/auth/refresh', rateLimit(30, 60000), async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ success: false, error: 'Token required' });
    const token    = header.split(' ')[1];
    const newToken = await authService.refreshToken(token);
    res.json({ success: true, token: newToken });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token invalid or expired' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get('/api/auth/users', requireAuth, requireAdmin, async (req, res) => {
  res.json({ success: true, users: await authService.listUsers() });
});

app.post('/api/auth/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await authService.addUser(req.body);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/auth/users/:username', requireAuth, requireAdmin, async (req, res) => {
  try {
    await authService.deleteUser(req.params.username);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.username, currentPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── Students ──────────────────────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  try {
    const students = await studentService.getAllStudents(req.query.grade || null);
    res.json({ success: true, total: students.length, students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/students/search/:identifier', async (req, res) => {
  try {
    const student = await studentService.getStudentInfo(req.params.identifier);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/students', rateLimit(30, 60000), auditLog('ADD_STUDENT'), async (req, res) => {
  try {
    const { name, year, totalFees } = req.body;
    if (!name || !year || !totalFees)
      return res.status(400).json({ success: false, error: 'name, year, and totalFees are required' });
    const result = await studentService.addSingleStudent(req.body);
    res.json({ success: true, message: 'Student added', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/students/upload', upload.single('file'), auditLog('UPLOAD_STUDENTS'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const result = await studentService.processUploadedFile(req.file.path);
    res.json({ success: true, message: 'Students file processed', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/students/import-json', async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students))
      return res.status(400).json({ success: false, error: 'students must be an array' });
    const result = await studentService.importStudentsArray(students);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/students/:studentId', requireAuth, requireHR, rateLimit(30, 60000), auditLog('UPDATE_STUDENT'), async (req, res) => {
  try {
    const result = await studentService.updateStudent(req.params.studentId, req.body);
    res.json({ success: true, message: 'Student updated', data: result });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, error: err.message });
  }
});

app.put('/api/students/:studentId/total-fees', requireAuth, rateLimit(20, 60000), auditLog('UPDATE_STUDENT_FEES'), async (req, res) => {
  try {
    const { totalFees, updatedBy } = req.body;
    if (totalFees === undefined) return res.status(400).json({ success: false, error: 'totalFees is required' });
    const result = await studentService.updateStudentTotalFees(req.params.studentId, parseFloat(totalFees), updatedBy);
    res.json({ success: true, message: 'Student fees updated', data: result });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, error: err.message });
  }
});

app.delete('/api/students/:studentId', requireAuth, requireHR, auditLog('DELETE_STUDENT'), async (req, res) => {
  try {
    const result = await studentService.deleteStudent(req.params.studentId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, error: err.message });
  }
});

app.post('/api/students/upload-update', requireAuth, requireHR, upload.single('file'), auditLog('BULK_UPDATE_STUDENTS'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  try {
    const results = await studentService.bulkUpdateFromFile(req.file.path);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Payments ──────────────────────────────────────────────────────────────────
app.post('/api/payments/process', async (req, res) => {
  try {
    const { studentId, amountPaid, paymentMethod, discountPercent, processedBy } = req.body;
    if (!studentId || !amountPaid || !paymentMethod)
      return res.status(400).json({ success: false, error: 'studentId, amountPaid, paymentMethod required' });
    const result = await studentService.recordPayment(
      studentId, parseFloat(amountPaid), paymentMethod,
      discountPercent != null ? parseFloat(discountPercent) : null,
      processedBy || 'Finance Team'
    );
    res.json({ success: true, message: 'Payment processed', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payments/apply-discount', async (req, res) => {
  try {
    const { studentId, discountPercent } = req.body;
    if (!studentId || discountPercent === undefined)
      return res.status(400).json({ success: false, error: 'studentId and discountPercent required' });
    const result = await studentService.applyDiscount(studentId, parseFloat(discountPercent));
    res.json({ success: true, message: 'Discount applied', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/payments/overdue', async (req, res) => {
  try {
    const result = await paymentDueService.checkOverduePayments();
    res.json({ success: true, message: 'Overdue check complete', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/payments/send-reminders', async (req, res) => {
  try {
    const result = await paymentDueService.sendPaymentReminders(req.body.daysBeforeDue || 7);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Finance ───────────────────────────────────────────────────────────────────
app.post('/api/finance/transaction', async (req, res) => {
  try {
    const { type, amount, subject, payerReceiverName, paymentMethod, notes, processedBy, date } = req.body;
    if (!type || !amount || !subject || !payerReceiverName || !paymentMethod)
      return res.status(400).json({ success: false, error: 'type, amount, subject, payerReceiverName, paymentMethod required' });
    if (!['in','out','income','expense'].includes(type.toLowerCase()))
      return res.status(400).json({ success: false, error: 'type must be: in, out, income, or expense' });
    const result = await financeService.recordTransaction(
      type, parseFloat(amount), subject, payerReceiverName,
      paymentMethod, notes || '', processedBy || 'Finance Team', date || null
    );
    res.json({ success: true, message: 'Transaction recorded', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/finance/transactions', async (req, res) => {
  try {
    const transactions = await financeService.getTransactions(
      req.query.startDate, req.query.endDate, req.query.type
    );
    res.json({ success: true, total: transactions.length, transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Bank ──────────────────────────────────────────────────────────────────────
app.post('/api/bank/deposit', async (req, res) => {
  try {
    const { amount, bankName, depositedBy, notes } = req.body;
    if (!amount || !bankName)
      return res.status(400).json({ success: false, error: 'amount and bankName required' });
    const result = await financeService.recordBankDeposit(
      parseFloat(amount), bankName, depositedBy || 'Finance Team', notes || ''
    );
    res.json({ success: true, message: 'Bank deposit recorded', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bank/deposits', async (req, res) => {
  try {
    const deposits = await financeService.getBankDeposits(req.query.startDate, req.query.endDate);
    res.json({ success: true, total: deposits.length, deposits });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
app.get('/api/analytics', async (req, res) => {
  try {
    const summary         = await financeService.getFinancialSummary();
    const overdueStudents = await paymentDueService.getOverdueStudents();
    res.json({ success: true, analytics: { ...summary, overduePayments: { totalOverdue: overdueStudents.length, students: overdueStudents } } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/analytics/chat', async (req, res) => {
  try {
    const summary         = await financeService.getFinancialSummary();
    const overdueStudents = await paymentDueService.getOverdueStudents();
    res.json({ success: true, data: {
      timestamp:    new Date().toISOString(),
      cashAvailable: summary.cash.totalCashInHand,
      bankAvailable: summary.bank.totalInBank,
      students:      { total: summary.students.totalStudents, active: summary.students.activeStudents, outstanding: summary.students.totalOutstanding },
      kpis:          { totalIncome: summary.financial.totalIncome, totalExpenses: summary.financial.totalExpenses, netProfit: summary.financial.netProfit, collectionRate: summary.students.collectionRate },
      monthly:       (summary.monthly || []).slice(-12),
      recent:        (summary.recent  || []).slice(0, 10),
      overdueCount:  overdueStudents.length,
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Teachers ──────────────────────────────────────────────────────────────────
app.get('/api/teachers', async (req, res) => {
  try {
    res.json({ success: true, teachers: await teachersService.getAllTeachers() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/teachers', async (req, res) => {
  try {
    res.json(await teachersService.addTeacher(req.body));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/teachers/payment', async (req, res) => {
  try {
    res.json(await teachersService.payTeacher(req.body));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/teachers/:id', async (req, res) => {
  try {
    res.json(await teachersService.updateTeacher(req.params.id, req.body));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/teachers/:id', async (req, res) => {
  try {
    res.json(await teachersService.deleteTeacher(req.params.id));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Config ────────────────────────────────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT setting, value FROM config ORDER BY setting');
    const config   = {};
    rows.forEach(r => { config[r.setting] = r.value; });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/config/:setting', async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).json({ success: false, error: 'value is required' });
    await db.query(
      `INSERT INTO config (setting, value) VALUES ($1,$2)
       ON CONFLICT (setting) DO UPDATE SET value = EXCLUDED.value`,
      [req.params.setting, value]
    );
    res.json({ success: true, setting: req.params.setting, value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/config/installments', async (req, res) => {
  try {
    const installments = await paymentDueService.getUpcomingDueDates();
    res.json({ success: true, installments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/config/installments', async (req, res) => {
  try {
    const { installments } = req.body;
    if (!Array.isArray(installments))
      return res.status(400).json({ success: false, error: 'installments array required' });
    const result = await paymentDueService.updateInstallmentDates(installments);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────
app.get('/api/admin/master-sheet', async (req, res) => {
  try {
    const buffer = await studentService.exportMasterSheet();
    res.setHeader('Content-Disposition', 'attachment; filename="master_students.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/backup', auditLog('CREATE_BACKUP'), async (req, res) => {
  try {
    const result = await backupService.createBackup(req.body.label || 'Manual backup', req.user?.username || 'admin');
    res.json({ success: true, message: 'Backup created', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/backups', async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({ success: true, backups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/undo', auditLog('RESTORE_BACKUP'), async (req, res) => {
  try {
    const result = await backupService.restoreFromBackup(req.body.backupId || null);
    res.json({ success: true, message: 'Backup restored', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/installments', async (req, res) => {
  try {
    const { installments } = req.body;
    if (!Array.isArray(installments))
      return res.status(400).json({ success: false, error: 'installments array required' });
    const result = await paymentDueService.updateInstallmentDates(installments);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/delete-all', auditLog('DELETE_ALL'), async (req, res) => {
  try {
    await db.query("DELETE FROM payments_log");
    await db.query("DELETE FROM students");
    await db.query("DELETE FROM transactions");
    await db.query("DELETE FROM bank_deposits");
    res.json({ success: true, message: 'All data cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/new-academic-year', requireAuth, requireAdmin, auditLog('NEW_ACADEMIC_YEAR'), async (req, res) => {
  try {
    const { academicYear, keepStudents = true } = req.body;
    if (!academicYear)
      return res.status(400).json({ success: false, error: 'academicYear is required (e.g. "2025-2026")' });

    // 1 — Archive current data
    const tablesToArchive = ['students', 'payments_log', 'transactions', 'bank_deposits'];
    for (const tbl of tablesToArchive) {
      const { rows } = await db.query(`SELECT * FROM ${tbl}`);
      if (!rows.length) continue;
      await db.query(
        `INSERT INTO academic_year_archives (academic_year, table_name, data)
         VALUES ($1, $2, $3)`,
        [academicYear, tbl, JSON.stringify(rows)]
      );
    }

    // 2 — Reset students
    if (keepStudents) {
      await db.query(`
        UPDATE students SET
          total_paid = 0,
          remaining_balance = net_amount,
          status = 'Active',
          last_payment_date = NULL
        WHERE status != 'Deleted'
      `);
    } else {
      await db.query("DELETE FROM students");
    }

    // 3 — Clear transactional tables
    await db.query("DELETE FROM payments_log");
    await db.query("DELETE FROM transactions");
    await db.query("DELETE FROM bank_deposits");

    // 4 — Update config
    await db.query(
      `INSERT INTO config (setting, value) VALUES ('Current_Academic_Year', $1)
       ON CONFLICT (setting) DO UPDATE SET value = EXCLUDED.value`,
      [academicYear]
    );

    res.json({ success: true, message: `Academic year reset to ${academicYear}`, archived: tablesToArchive });
  } catch (err) {
    console.error('Year reset error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/init', async (req, res) => {
  try {
    await db.initSchema();
    await authService.ensureDefaultUsers();
    res.json({ success: true, message: 'Database initialized' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

// ── Scheduled tasks ───────────────────────────────────────────────────────────
cron.schedule('0 9 * * *', async () => {
  try { await paymentDueService.checkOverduePayments(); }
  catch (err) { console.error('Cron overdue check failed:', err.message); }
});

cron.schedule('0 10 * * *', async () => {
  try {
    const { rows } = await db.query("SELECT value FROM config WHERE setting = 'Notification_Days_Before_Due'");
    await paymentDueService.sendPaymentReminders(parseInt(rows[0]?.value || '7'));
  } catch (err) { console.error('Cron reminders failed:', err.message); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 RAJAC Finance System API v2.0`);
  console.log(`📍 Port ${PORT}  |  DB: PostgreSQL`);
  console.log(`\n✅ Server ready\n`);

  try {
    await db.initSchema();
    await authService.ensureDefaultUsers();
    console.log('✅ Database schema verified\n');
  } catch (err) {
    console.error('⚠️  DB init warning:', err.message);
  }
});
