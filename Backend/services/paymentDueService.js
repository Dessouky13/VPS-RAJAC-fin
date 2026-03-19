'use strict';
const moment = require('moment');
const db     = require('./db');

class PaymentDueService {
  async _getConfig() {
    const { rows } = await db.query('SELECT setting, value FROM config');
    const cfg = {};
    rows.forEach(r => { cfg[r.setting] = r.value; });
    return cfg;
  }

  async checkOverduePayments() {
    const config              = await this._getConfig();
    const numberOfInstallments = parseInt(config.Number_of_Installments || '3');

    const installmentDates = [];
    for (let i = 1; i <= numberOfInstallments; i++) {
      const key  = `Installment_${i}_Date`;
      const date = config[key];
      if (date) installmentDates.push({ number: i, date: moment(date), dateString: date });
    }
    if (!installmentDates.length) return { overdueStudents: [], totalOverdue: 0 };

    const { rows: students } = await db.query(
      `SELECT * FROM students WHERE status NOT IN ('Paid','Inactive','Deleted')`
    );

    const today          = moment();
    const overdueStudents = [];

    for (const s of students) {
      const netAmount      = parseFloat(s.net_amount)       || 0;
      const totalPaid      = parseFloat(s.total_paid)       || 0;
      const remaining      = parseFloat(s.remaining_balance)|| 0;
      if (remaining <= 0) continue;

      const installmentAmt = netAmount / numberOfInstallments;

      for (const inst of installmentDates) {
        if (today.isAfter(inst.date)) {
          const expected = installmentAmt * inst.number;
          if (totalPaid < expected) {
            overdueStudents.push({
              studentId:         s.student_id,
              name:              s.name,
              year:              s.year,
              phoneNumber:       s.phone_number,
              netAmount, totalPaid, remainingBalance: remaining,
              installmentNumber: inst.number,
              dueDate:           inst.dateString,
              daysOverdue:       today.diff(inst.date, 'days'),
              amountDue:         Math.min(expected - totalPaid, remaining),
            });
            break;
          }
        }
      }
    }

    return { overdueStudents, totalOverdue: overdueStudents.length, checkedAt: moment().format('YYYY-MM-DD HH:mm:ss') };
  }

  async getOverdueStudents() {
    const result = await this.checkOverduePayments();
    return result.overdueStudents || [];
  }

  async getUpcomingDueDates() {
    const config              = await this._getConfig();
    const numberOfInstallments = parseInt(config.Number_of_Installments || '3');
    const dates = [];
    for (let i = 1; i <= numberOfInstallments; i++) {
      const key  = `Installment_${i}_Date`;
      const val  = config[key];
      if (val) {
        const d = moment(val);
        dates.push({ number: i, date: d.format('YYYY-MM-DD'), daysUntil: d.diff(moment(), 'days'), isPast: d.isBefore(moment()) });
      }
    }
    return dates;
  }

  async updateInstallmentDates(installments) {
    for (const inst of installments) {
      await db.query(
        `INSERT INTO config (setting, value) VALUES ($1, $2)
         ON CONFLICT (setting) DO UPDATE SET value = EXCLUDED.value`,
        [`Installment_${inst.number}_Date`, inst.date]
      );
    }
    await db.query(
      `INSERT INTO config (setting, value) VALUES ('Number_of_Installments', $1)
       ON CONFLICT (setting) DO UPDATE SET value = EXCLUDED.value`,
      [String(installments.length)]
    );
    return { success: true, installments };
  }

  async sendPaymentReminders(daysBeforeDue = 7) {
    // WhatsApp reminders are a future feature — stub returns count only
    const config     = await this._getConfig();
    const enabled    = config.WhatsApp_Notifications_Enabled === 'true';
    if (!enabled) return { remindersSent: 0, message: 'Notifications disabled' };

    const upcoming   = await this.getUpcomingDueDates();
    const today      = moment();
    const soonDates  = upcoming.filter(d => {
      const days = moment(d.date).diff(today, 'days');
      return days >= 0 && days <= daysBeforeDue;
    });
    if (!soonDates.length) return { remindersSent: 0 };

    // TODO: Integrate Twilio or other WhatsApp provider here
    return { remindersSent: 0, message: 'WhatsApp integration pending' };
  }
}

module.exports = new PaymentDueService();
