'use strict';
const crypto = require('crypto');
const moment = require('moment');
const db     = require('./db');

function generateTransactionId() {
  return `TXN${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function generateDepositId() {
  return `DEP${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

// Export so other services can use them
module.exports.generateDepositId = generateDepositId;

class FinanceService {
  async recordTransaction(type, amount, subject, payerReceiverName, paymentMethod, notes = '', processedBy = 'System', customDate = null) {
    const transactionId = generateTransactionId();
    const date          = customDate ? new Date(customDate) : new Date();

    await db.query(
      `INSERT INTO transactions
         (transaction_id, date, type, amount, subject, payer_receiver_name, payment_method, notes, processed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [transactionId, date, type, amount, subject, payerReceiverName, paymentMethod, notes, processedBy]
    );
    return { transactionId, date, type, amount, subject, payerReceiverName, paymentMethod, notes, processedBy };
  }

  async recordBankDeposit(amount, bankName, depositedBy = 'System', notes = '') {
    const depositId = generateDepositId();
    const date      = new Date();

    await db.query(
      `INSERT INTO bank_deposits (deposit_id, date, amount, bank_name, deposited_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [depositId, date, amount, bankName, depositedBy, notes]
    );
    return { depositId, date, amount, bankName, depositedBy, notes };
  }

  async getTransactions(startDate = null, endDate = null, type = null) {
    let sql  = 'SELECT * FROM transactions WHERE TRUE';
    const args = [];
    let i = 1;
    if (type)                  { sql += ` AND type = $${i++}`;                     args.push(type); }
    if (startDate && endDate)  { sql += ` AND date BETWEEN $${i++} AND $${i++}`;   args.push(startDate, endDate); }
    sql += ' ORDER BY date DESC';
    const { rows } = await db.query(sql, args);
    return rows;
  }

  async getBankDeposits(startDate = null, endDate = null) {
    let sql  = 'SELECT * FROM bank_deposits WHERE TRUE';
    const args = [];
    if (startDate && endDate) {
      sql += ' AND date BETWEEN $1 AND $2';
      args.push(startDate, endDate);
    }
    sql += ' ORDER BY date DESC';
    const { rows } = await db.query(sql, args);
    return rows;
  }

  // S-3: Promise.allSettled — a single failing query won't crash the whole summary
  async getFinancialSummary() {
    const [stuResult, txResult, depResult, payResult] = await Promise.allSettled([
      db.query(`SELECT total_fees, net_amount, total_paid, remaining_balance, status FROM students WHERE status != 'Deleted'`),
      db.query('SELECT type, amount, payment_method, date FROM transactions ORDER BY date'),
      db.query('SELECT amount, date FROM bank_deposits ORDER BY date'),
      db.query('SELECT amount_paid, payment_method, payment_date FROM payments_log ORDER BY payment_date'),
    ]);

    const students     = stuResult.status  === 'fulfilled' ? stuResult.value.rows  : [];
    const transactions = txResult.status   === 'fulfilled' ? txResult.value.rows   : [];
    const deposits     = depResult.status  === 'fulfilled' ? depResult.value.rows  : [];
    const payments     = payResult.status  === 'fulfilled' ? payResult.value.rows  : [];

    const isCash = (m) => String(m || '').toLowerCase() === 'cash';

    let totalCashInHand = 0, totalInBank = 0;
    let totalStudentPayments = 0, totalIncome = 0, totalExpenses = 0;
    const paymentsByMonth = {}, transactionsByMonth = {}, depositsByMonth = {};
    const recent = [];

    for (const p of payments) {
      const amt = parseFloat(p.amount_paid) || 0;
      totalStudentPayments += amt;
      if (isCash(p.payment_method)) totalCashInHand += amt;
      const m = moment(p.payment_date).format('YYYY-MM');
      paymentsByMonth[m] = (paymentsByMonth[m] || 0) + amt;
      recent.push({ kind: 'payment', date: p.payment_date, amount: amt, method: p.payment_method });
    }

    for (const t of transactions) {
      const type = (t.type || '').toLowerCase();
      const amt  = parseFloat(t.amount) || 0;
      const cash = isCash(t.payment_method);
      if (type === 'in' || type === 'income') {
        totalIncome += amt;
        if (cash) totalCashInHand += amt; else totalInBank += amt;
      } else if (type === 'out' || type === 'expense') {
        totalExpenses += amt;
        if (cash) totalCashInHand -= amt; else totalInBank -= amt;
      }
      const m = moment(t.date).format('YYYY-MM');
      transactionsByMonth[m] = transactionsByMonth[m] || { income: 0, expenses: 0 };
      if (type === 'in'  || type === 'income')  transactionsByMonth[m].income   += amt;
      if (type === 'out' || type === 'expense') transactionsByMonth[m].expenses += amt;
      recent.push({ kind: 'transaction', date: t.date, type, amount: amt, method: t.payment_method });
    }

    for (const d of deposits) {
      const amt = parseFloat(d.amount) || 0;
      totalInBank += amt;
      totalCashInHand -= amt;
      const m = moment(d.date).format('YYYY-MM');
      depositsByMonth[m] = (depositsByMonth[m] || 0) + amt;
      recent.push({ kind: 'deposit', date: d.date, amount: amt });
    }

    let totalStudents = 0, activeStudents = 0;
    let totalFeesExpected = 0, totalFeesCollected = 0, totalOutstanding = 0;
    for (const s of students) {
      totalStudents++;
      if ((s.status || '').toLowerCase() === 'active') activeStudents++;
      totalFeesExpected  += parseFloat(s.net_amount)        || 0;
      totalFeesCollected += parseFloat(s.total_paid)        || 0;
      totalOutstanding   += parseFloat(s.remaining_balance) || 0;
    }

    const months  = Array.from(new Set([
      ...Object.keys(paymentsByMonth),
      ...Object.keys(transactionsByMonth),
      ...Object.keys(depositsByMonth),
    ])).sort();

    const monthly = months.map(m => {
      const incomeFromTx  = transactionsByMonth[m]?.income   || 0;
      const expensesFromTx = transactionsByMonth[m]?.expenses || 0;
      const feesCollected  = paymentsByMonth[m] || 0;
      const depositsAmt    = depositsByMonth[m] || 0;
      const totalMonthlyIncome = feesCollected + incomeFromTx;
      return {
        month: m,
        totalIncome:  Math.round(totalMonthlyIncome * 100) / 100,
        studentFees:  Math.round(feesCollected      * 100) / 100,
        otherIncome:  Math.round(incomeFromTx       * 100) / 100,
        expenses:     Math.round(expensesFromTx     * 100) / 100,
        deposits:     Math.round(depositsAmt        * 100) / 100,
        netProfit:    Math.round((totalMonthlyIncome - expensesFromTx) * 100) / 100,
      };
    });

    recent.sort((a, b) => new Date(b.date) - new Date(a.date));

    const overallTotalIncome = totalStudentPayments + totalIncome;
    const overallNetProfit   = overallTotalIncome - totalExpenses;

    return {
      cash:      { totalCashInHand: Math.max(0, Math.round(totalCashInHand * 100) / 100) },
      bank:      { totalInBank:     Math.round(totalInBank               * 100) / 100  },
      liquidity: { totalLiquidAssets: Math.round((Math.max(0, totalCashInHand) + totalInBank) * 100) / 100 },
      students: {
        totalStudents, activeStudents,
        totalFeesExpected:  Math.round(totalFeesExpected  * 100) / 100,
        totalFeesCollected: Math.round(totalFeesCollected * 100) / 100,
        totalOutstanding:   Math.round(totalOutstanding   * 100) / 100,
        collectionRate: totalFeesExpected > 0
          ? ((totalFeesCollected / totalFeesExpected) * 100).toFixed(2) + '%' : '0%',
      },
      financial: {
        totalIncome:       Math.round(overallTotalIncome  * 100) / 100,
        studentFeesIncome: Math.round(totalStudentPayments* 100) / 100,
        otherIncome:       Math.round(totalIncome         * 100) / 100,
        totalExpenses:     Math.round(totalExpenses       * 100) / 100,
        netProfit:         Math.round(overallNetProfit    * 100) / 100,
        profitMargin: overallTotalIncome > 0
          ? ((overallNetProfit / overallTotalIncome) * 100).toFixed(2) + '%' : '0%',
      },
      monthly,
      recent: recent.slice(0, 20),
    };
  }
}

module.exports = new FinanceService();
module.exports.generateDepositId  = generateDepositId;
module.exports.generateTransactionId = generateTransactionId;
