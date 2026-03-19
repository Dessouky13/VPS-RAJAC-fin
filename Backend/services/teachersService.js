'use strict';
const crypto  = require('crypto');
const db      = require('./db');
const financeService = require('./financeService');

class TeachersService {
  generateId() {
    return `T${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  }

  async getAllTeachers() {
    const { rows } = await db.query('SELECT * FROM teachers ORDER BY name');
    return rows.map(r => ({
      id:               r.id,
      name:             r.name,
      subject:          r.subject,
      numberOfClasses:  r.number_of_classes,
      totalAmount:      parseFloat(r.total_amount),
      totalPaid:        parseFloat(r.total_paid),
      remainingBalance: parseFloat(r.remaining_balance),
      createdAt:        r.created_at,
    }));
  }

  async addTeacher({ name, subject, numberOfClasses, totalAmount }) {
    const id = this.generateId();
    const { rows } = await db.query(
      `INSERT INTO teachers (id, name, subject, number_of_classes, total_amount, total_paid, remaining_balance)
       VALUES ($1,$2,$3,$4,$5,0,$5) RETURNING *`,
      [id, name, subject, parseInt(numberOfClasses) || 0, parseFloat(totalAmount) || 0]
    );
    const t = rows[0];
    return { success: true, teacher: { id: t.id, name: t.name, subject: t.subject,
      numberOfClasses: t.number_of_classes, totalAmount: parseFloat(t.total_amount),
      totalPaid: parseFloat(t.total_paid), remainingBalance: parseFloat(t.remaining_balance) } };
  }

  async payTeacher({ teacherName, amount, method }) {
    const { rows } = await db.query(
      'SELECT * FROM teachers WHERE name = $1', [teacherName]
    );
    if (!rows.length) throw new Error('Teacher not found');
    const t              = rows[0];
    const paymentAmount  = parseFloat(amount) || 0;
    const newTotalPaid   = parseFloat(t.total_paid) + paymentAmount;
    const newRemaining   = parseFloat(t.total_amount) - newTotalPaid;

    await db.query(
      'UPDATE teachers SET total_paid = $1, remaining_balance = $2 WHERE id = $3',
      [newTotalPaid, newRemaining, t.id]
    );

    // Record as expense in ledger
    await financeService.recordTransaction(
      'out', paymentAmount, 'Teacher Salary', teacherName,
      method || 'Cash', `Payment to ${teacherName} for ${t.subject}`, 'Finance Team'
    );

    return { success: true, teacher: { ...t, totalPaid: newTotalPaid, remainingBalance: newRemaining } };
  }

  async updateTeacher(teacherId, updates) {
    const { rows } = await db.query('SELECT * FROM teachers WHERE id = $1', [teacherId]);
    if (!rows.length) throw new Error('Teacher not found');
    const t = rows[0];

    const name        = updates.name             !== undefined ? updates.name             : t.name;
    const subject     = updates.subject          !== undefined ? updates.subject          : t.subject;
    const classes     = updates.numberOfClasses  !== undefined ? updates.numberOfClasses  : t.number_of_classes;
    const totalAmount = updates.totalAmount      !== undefined ? parseFloat(updates.totalAmount) : parseFloat(t.total_amount);
    const remaining   = totalAmount - parseFloat(t.total_paid);

    const { rows: updated } = await db.query(
      `UPDATE teachers SET name=$1, subject=$2, number_of_classes=$3, total_amount=$4, remaining_balance=$5
       WHERE id=$6 RETURNING *`,
      [name, subject, parseInt(classes) || 0, totalAmount, remaining, teacherId]
    );
    const u = updated[0];
    return { success: true, teacher: { id: u.id, name: u.name, subject: u.subject,
      numberOfClasses: u.number_of_classes, totalAmount: parseFloat(u.total_amount),
      totalPaid: parseFloat(u.total_paid), remainingBalance: parseFloat(u.remaining_balance) } };
  }

  async deleteTeacher(teacherId) {
    const { rows } = await db.query(
      'DELETE FROM teachers WHERE id = $1 RETURNING id', [teacherId]
    );
    if (!rows.length) throw new Error('Teacher not found');
    return { success: true };
  }
}

module.exports = new TeachersService();
