'use strict';
const XLSX    = require('xlsx');
const crypto  = require('crypto');
const moment  = require('moment');
const db      = require('./db');
const fs      = require('fs');

class StudentService {
  // ── ID generation (S-6) ──────────────────────────────────────────────────
  generateStudentId() {
    const year = new Date().getFullYear().toString().slice(-2);
    return `STU${year}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  generatePaymentId() {
    return `PAY${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  }

  formatPhoneNumber(phone) {
    const cleaned = String(phone || '').replace(/\D/g, '');
    if (cleaned.startsWith('20'))  return cleaned;
    if (cleaned.startsWith('0'))   return '20' + cleaned.slice(1);
    if (cleaned.length === 10)     return '20' + cleaned;
    return cleaned;
  }

  // ── Single student add ────────────────────────────────────────────────────
  async addSingleStudent({ name, year, numberOfSubjects, totalFees, phoneNumber, discountPercent, enrollmentDate }) {
    const totalFeesNum     = Number(totalFees)     || 0;
    const discountPct      = Number(discountPercent) || 0;
    const discountAmount   = Math.round(totalFeesNum * discountPct / 100);
    const netAmount        = totalFeesNum - discountAmount;
    const studentId        = this.generateStudentId();
    const phone            = this.formatPhoneNumber(phoneNumber || '');
    const enrolDate        = enrollmentDate ? moment(enrollmentDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');

    const { rows } = await db.query(
      `INSERT INTO students
         (student_id, name, year, number_of_subjects, total_fees,
          discount_percent, discount_amount, net_amount,
          total_paid, remaining_balance, phone_number, enrollment_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$8,$9,$10,'Active')
       RETURNING *`,
      [studentId, String(name).trim(), String(year).trim(),
       Number(numberOfSubjects) || 0, totalFeesNum,
       discountPct, discountAmount, netAmount,
       phone, enrolDate]
    );
    return rows[0];
  }

  // ── Excel bulk upload ─────────────────────────────────────────────────────
  async processUploadedFile(filePath) {
    try {
      const workbook  = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows      = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const inserted = [];
      for (const row of rows) {
        const name = row.Name || row['Student Name'] || row['Full Name'] || row.name || '';
        if (!name) continue;

        const totalFees = parseFloat(
          row['Total_Fees'] || row['Total Fees'] || row.Fees || row.Amount || row.Tuition || 0
        );
        const student = {
          name,
          year:             row.Year  || row.Grade  || row.Class  || '',
          numberOfSubjects: parseInt(row['Number_of_Subjects'] || row['Number of Subjects'] || row.Subjects || 0),
          totalFees,
          phoneNumber:      row['Phone_Number'] || row['Phone Number'] || row.Phone || row.Mobile || '',
          discountPercent:  0,
          enrollmentDate:   null,
        };
        const result = await this.addSingleStudent(student);
        inserted.push(result);
      }

      return { studentsProcessed: inserted.length, students: inserted };
    } finally {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }

  // ── Get student by ID or name ─────────────────────────────────────────────
  async getStudentInfo(identifier) {
    const { rows } = await db.query(
      `SELECT * FROM students
       WHERE student_id = $1
          OR LOWER(name) LIKE LOWER($2)
       LIMIT 1`,
      [identifier, `%${identifier}%`]
    );
    return rows[0] ? this._mapStudent(rows[0]) : null;
  }

  // ── Get all students ──────────────────────────────────────────────────────
  async getAllStudents(grade = null) {
    let sql    = `SELECT * FROM students WHERE status != 'Deleted' ORDER BY name`;
    const args = [];
    if (grade && grade !== 'All') {
      sql  = `SELECT * FROM students WHERE status != 'Deleted' AND year = $1 ORDER BY name`;
      args.push(grade);
    }
    const { rows } = await db.query(sql, args);
    return rows.map(this._mapStudent);
  }

  // ── Record payment ────────────────────────────────────────────────────────
  async recordPayment(studentId, amountPaid, paymentMethod, discountPercent = null, processedBy = 'System') {
    return db.transaction(async (client) => {
      const { rows: sRows } = await client.query(
        'SELECT * FROM students WHERE student_id = $1 FOR UPDATE', [studentId]
      );
      if (!sRows.length) throw new Error('Student not found');
      const s = sRows[0];

      // Apply discount if changed
      let discountPct    = parseFloat(s.discount_percent) || 0;
      let discountAmount = parseFloat(s.discount_amount)  || 0;
      let netAmount      = parseFloat(s.net_amount)       || 0;

      if (discountPercent !== null && discountPercent !== discountPct) {
        discountPct    = discountPercent;
        discountAmount = Math.round(parseFloat(s.total_fees) * discountPct / 100);
        netAmount      = parseFloat(s.total_fees) - discountAmount;
      }

      const newTotalPaid        = parseFloat(s.total_paid) + amountPaid;
      const newRemainingBalance = netAmount - newTotalPaid;
      const paymentDate         = new Date();

      // Installment number
      const { rows: cfgRows } = await client.query(
        "SELECT value FROM config WHERE setting = 'Number_of_Installments'"
      );
      const numInstallments  = parseInt(cfgRows[0]?.value || '3');
      const installmentAmt   = netAmount / numInstallments;
      const installmentNumber = Math.min(numInstallments, Math.ceil(newTotalPaid / (installmentAmt || 1)));

      // Write payment log
      const paymentId = this.generatePaymentId();
      await client.query(
        `INSERT INTO payments_log
           (payment_id, student_id, student_name, payment_date, amount_paid,
            payment_method, discount_applied, net_amount, remaining_balance,
            installment_number, processed_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [paymentId, studentId, s.name, paymentDate, amountPaid,
         paymentMethod, discountAmount, netAmount, newRemainingBalance,
         installmentNumber, processedBy]
      );

      // Update student
      const newStatus = newRemainingBalance <= 0 ? 'Paid' : 'Active';
      await client.query(
        `UPDATE students SET
           discount_percent   = $1, discount_amount = $2, net_amount = $3,
           total_paid         = $4, remaining_balance = $5,
           status             = $6, last_payment_date = $7
         WHERE student_id = $8`,
        [discountPct, discountAmount, netAmount, newTotalPaid,
         newRemainingBalance, newStatus, paymentDate, studentId]
      );

      // Auto bank deposit for non-cash
      if (String(paymentMethod).toLowerCase() !== 'cash') {
        const { generateDepositId } = require('./financeService');
        await client.query(
          `INSERT INTO bank_deposits (deposit_id, date, amount, bank_name, deposited_by, notes)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [generateDepositId(), paymentDate, amountPaid, paymentMethod, processedBy,
           `Auto: student payment ${studentId}`]
        );
      }

      return {
        studentId, studentName: s.name, amountPaid, paymentMethod,
        totalPaid: newTotalPaid, remainingBalance: newRemainingBalance,
        installmentNumber, paymentDate
      };
    });
  }

  // ── Apply discount only ───────────────────────────────────────────────────
  async applyDiscount(studentId, discountPercent) {
    const { rows } = await db.query(
      'SELECT * FROM students WHERE student_id = $1', [studentId]
    );
    if (!rows.length) throw new Error('Student not found');
    const s = rows[0];

    const totalFees      = parseFloat(s.total_fees);
    const discountAmount = Math.round(totalFees * discountPercent / 100);
    const netAmount      = totalFees - discountAmount;
    const remaining      = netAmount - parseFloat(s.total_paid);

    await db.query(
      `UPDATE students SET
         discount_percent = $1, discount_amount = $2, net_amount = $3, remaining_balance = $4
       WHERE student_id = $5`,
      [discountPercent, discountAmount, netAmount, Math.max(0, remaining), studentId]
    );
    return this.getStudentInfo(studentId);
  }

  // ── Update student fields ────────────────────────────────────────────────
  async updateStudent(studentId, updates) {
    const { rows } = await db.query(
      'SELECT * FROM students WHERE student_id = $1', [studentId]
    );
    if (!rows.length) throw new Error(`Student ${studentId} not found`);
    const s = rows[0];

    const name     = updates.name           !== undefined ? String(updates.name).trim()               : s.name;
    const year     = updates.year           !== undefined ? String(updates.year).trim()               : s.year;
    const phone    = updates.phoneNumber    !== undefined ? this.formatPhoneNumber(updates.phoneNumber) : s.phone_number;
    const subjects = updates.numberOfSubjects !== undefined ? Number(updates.numberOfSubjects)         : s.number_of_subjects;

    const totalFees      = updates.totalFees       !== undefined ? Number(updates.totalFees)       : parseFloat(s.total_fees);
    const discountPct    = updates.discountPercent !== undefined ? Number(updates.discountPercent) : parseFloat(s.discount_percent);
    const discountAmount = Math.round(totalFees * discountPct / 100);
    const netAmount      = totalFees - discountAmount;
    const totalPaid      = parseFloat(s.total_paid);
    const remaining      = Math.max(0, netAmount - totalPaid);
    const status         = remaining <= 0 ? 'Paid' : (s.status === 'Paid' && remaining > 0 ? 'Active' : s.status);

    const { rows: updated } = await db.query(
      `UPDATE students SET
         name = $1, year = $2, phone_number = $3, number_of_subjects = $4,
         total_fees = $5, discount_percent = $6, discount_amount = $7,
         net_amount = $8, remaining_balance = $9, status = $10
       WHERE student_id = $11
       RETURNING *`,
      [name, year, phone, subjects, totalFees, discountPct,
       discountAmount, netAmount, remaining, status, studentId]
    );
    return this._mapStudent(updated[0]);
  }

  // ── Update total fees ─────────────────────────────────────────────────────
  async updateStudentTotalFees(studentId, newTotalFees) {
    if (isNaN(newTotalFees) || newTotalFees < 0 || newTotalFees > 1000000)
      throw new Error('Invalid totalFees value');
    return this.updateStudent(studentId, { totalFees: newTotalFees });
  }

  // ── Soft delete ───────────────────────────────────────────────────────────
  async deleteStudent(studentId) {
    const { rows } = await db.query(
      `UPDATE students SET status = 'Deleted'
       WHERE student_id = $1 RETURNING student_id`,
      [studentId]
    );
    if (!rows.length) throw new Error(`Student ${studentId} not found`);
    return { studentId };
  }

  // ── Bulk update from Excel ────────────────────────────────────────────────
  async bulkUpdateFromFile(filePath) {
    const workbook  = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows      = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const results = { updated: 0, skipped: 0, errors: [], studentsUpdated: 0 };

    for (const row of rows) {
      const studentId = row['Student_ID'] || row['StudentID'] || row['student_id'] || '';
      if (!studentId) { results.skipped++; continue; }

      const updates = {};
      if (row.Name               || row.name)               updates.name             = row.Name || row.name;
      if (row.Year               || row.Grade)               updates.year             = row.Year || row.Grade;
      if (row['Phone_Number']    || row.Phone)               updates.phoneNumber      = row['Phone_Number'] || row.Phone;
      if (row['Total_Fees']      || row.Fees)                updates.totalFees        = parseFloat(row['Total_Fees'] || row.Fees);
      if (row['Discount_Percent']|| row.Discount)            updates.discountPercent  = parseFloat(row['Discount_Percent'] || row.Discount);
      if (row['Number_of_Subjects']||row.Subjects)           updates.numberOfSubjects = parseInt(row['Number_of_Subjects'] || row.Subjects);

      if (!Object.keys(updates).length) { results.skipped++; continue; }

      try {
        await this.updateStudent(studentId, updates);
        results.updated++;
      } catch (err) {
        results.errors.push({ studentId, error: err.message });
        results.skipped++;
      }
    }
    results.studentsUpdated = results.updated;
    return results;
  }

  // ── Import students array (JSON) ──────────────────────────────────────────
  async importStudentsArray(studentsArray) {
    let imported = 0;
    for (const s of studentsArray) {
      try {
        await this.addSingleStudent({
          name:             s.name || s.Name || '',
          year:             s.year || s.Year || '',
          numberOfSubjects: s.numberOfSubjects || 0,
          totalFees:        s.totalFees || 0,
          phoneNumber:      s.phoneNumber || '',
          discountPercent:  s.discountPercent || 0,
          enrollmentDate:   s.enrollmentDate  || null,
        });
        imported++;
      } catch (err) {
        console.error('[importStudentsArray] skipping row:', err.message);
      }
    }
    return { imported };
  }

  // ── Export as XLSX buffer ─────────────────────────────────────────────────
  async exportMasterSheet() {
    const { rows } = await db.query(
      `SELECT student_id,name,year,number_of_subjects,total_fees,discount_percent,
              discount_amount,net_amount,total_paid,remaining_balance,
              phone_number,enrollment_date,status,last_payment_date
       FROM students WHERE status != 'Deleted' ORDER BY name`
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Students');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ── Internal map ─────────────────────────────────────────────────────────
  _mapStudent(row) {
    if (!row) return null;
    return {
      studentId:        row.student_id,
      name:             row.name,
      year:             row.year,
      numberOfSubjects: row.number_of_subjects,
      totalFees:        parseFloat(row.total_fees),
      discountPercent:  parseFloat(row.discount_percent),
      discountAmount:   parseFloat(row.discount_amount),
      netAmount:        parseFloat(row.net_amount),
      totalPaid:        parseFloat(row.total_paid),
      remainingBalance: parseFloat(row.remaining_balance),
      phoneNumber:      row.phone_number,
      enrollmentDate:   row.enrollment_date,
      status:           row.status,
      lastPaymentDate:  row.last_payment_date,
    };
  }
}

module.exports = new StudentService();
