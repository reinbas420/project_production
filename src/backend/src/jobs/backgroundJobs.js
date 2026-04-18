const cron = require('node-cron');
const queueService = require('../services/queueService');
const notificationService = require('../services/notificationService');
const Issue = require('../models/Issue');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Background Jobs — Workers & Cron Triggers
 * =====================================================
 *
 * Two modes:
 *   1. Bull Queue workers  — Redis available (production)
 *   2. node-cron fallback  — No Redis (development / prototype)
 *
 * Jobs:
 *   • Daily penalty check          — 02:00 AM IST
 *   • Due-date reminder dispatch   — 09:00 AM IST
 *   • Notification triggers         — real-time via queue or cron every 5 min
 */

// ── Bull Queue Workers ─────────────────────────────────

const registerBullWorkers = () => {
  if (!queueService.isBullAvailable()) return;

  // 1. Penalty processing worker
  queueService.getPenaltyQueue().process('process-overdue', async (job) => {
    console.log('⏰ [Bull] Processing overdue penalties...');
    const overdueIssues = await _getOverdueIssues();

    for (const issue of overdueIssues) {
      const daysOverdue = _daysBetween(issue.dueDate, new Date());
      const fineAmount = daysOverdue * 10; // ₹10/day — matches config

      // Mark issue as OVERDUE
      if (issue.status !== 'OVERDUE') {
        issue.status = 'OVERDUE';
        await issue.save();
      }

      // Send penalty push notification
      const bookTitle = issue.copyId?.bookId?.title || 'a book';
      await notificationService.sendPenaltyAlert(
        issue.userId,
        bookTitle,
        fineAmount,
        daysOverdue
      );
    }

    return { processed: overdueIssues.length };
  });

  // 2. Notification dispatch worker
  queueService.getNotificationQueue().process('send-notification', async (job) => {
    const { userId, title, body, data } = job.data;
    return notificationService.sendToUser(userId, title, body, data);
  });

  // 3. Delivery status worker
  queueService.getDeliveryQueue().process('check-delivery', async (job) => {
    const { issueId, userId, bookTitle, status } = job.data;
    return notificationService.sendDeliveryUpdate(userId, bookTitle, status);
  });

  // 4. Reservation availability worker
  queueService.getReservationQueue().process('check-reservation', async (job) => {
    const { userId, bookTitle } = job.data;
    return notificationService.sendReservationAvailable(userId, bookTitle);
  });

  console.log('✅ Bull queue workers registered');
};

// ── Node-Cron Scheduled Jobs (Fallback) ────────────────

const startCronJobs = () => {
  // ① Daily penalty check — 02:00 AM IST
  cron.schedule(
    '0 2 * * *',
    async () => {
      console.log('⏰ [Cron] Running daily penalty check...');
      try {
        if (queueService.isBullAvailable()) {
          await queueService.addPenaltyJob({ triggeredBy: 'cron' });
          console.log('   ↳ Penalty job enqueued to Bull');
        } else {
          await _processOverduePenaltiesFallback();
        }
      } catch (error) {
        console.error('❌ Penalty cron error:', error.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  // ② Due-date reminder — 09:00 AM IST (1 day before due)
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('⏰ [Cron] Sending due-date reminders...');
      try {
        await _sendDueReminders();
      } catch (error) {
        console.error('❌ Due-reminder cron error:', error.message);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  // ③ Notification digest (every 5 min for dev, every 30 min prod)
  const digestInterval = process.env.NODE_ENV === 'production' ? '*/30 * * * *' : '*/5 * * * *';
  cron.schedule(digestInterval, async () => {
    // Lightweight health-check log
    const pending = await _countPendingNotifications();
    if (pending > 0) {
      console.log(`📨 [Cron] ${pending} pending notification(s) in queue`);
    }
  });

  console.log('✅ Cron jobs scheduled:');
  console.log('   • Daily penalty check  — 02:00 AM IST');
  console.log('   • Due-date reminders   — 09:00 AM IST');
  console.log('   • Notification digest  — every 5 min (dev)');
};

// ── Internal Helpers ───────────────────────────────────

async function _getOverdueIssues() {
  return Issue.find({
    status: { $in: ['ISSUED', 'OVERDUE'] },
    dueDate: { $lt: new Date() }
  }).populate({
    path: 'copyId',
    populate: { path: 'bookId', select: 'title' }
  });
}

async function _processOverduePenaltiesFallback() {
  const overdueIssues = await _getOverdueIssues();

  for (const issue of overdueIssues) {
    const daysOverdue = _daysBetween(issue.dueDate, new Date());
    const fineAmount = daysOverdue * 10;

    if (issue.status !== 'OVERDUE') {
      issue.status = 'OVERDUE';
      await issue.save();
    }

    const bookTitle = issue.copyId?.bookId?.title || 'a book';
    await notificationService.sendPenaltyAlert(
      issue.userId,
      bookTitle,
      fineAmount,
      daysOverdue
    );
  }

  console.log(`   ✅ Processed ${overdueIssues.length} overdue issue(s)`);
}

async function _sendDueReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfDay = new Date(tomorrow.setHours(0, 0, 0, 0));
  const endOfDay = new Date(tomorrow.setHours(23, 59, 59, 999));

  const dueTomorrow = await Issue.find({
    status: 'ISSUED',
    dueDate: { $gte: startOfDay, $lte: endOfDay }
  });

  for (const issue of dueTomorrow) {
    if (queueService.isBullAvailable()) {
      await queueService.addNotificationJob({
        userId: issue.userId.toString(),
        title: '📚 Book Due Tomorrow!',
        body: `You have a book due on ${issue.dueDate.toLocaleDateString()}. Return it on time!`,
        data: { type: 'DUE_REMINDER', dueDate: issue.dueDate.toString() }
      });
    } else {
      await notificationService.sendDueReminder(
        issue.userId,
        'a book',
        issue.dueDate
      );
    }
  }

  console.log(`   ✅ Sent ${dueTomorrow.length} due-date reminder(s)`);
}

async function _countPendingNotifications() {
  if (queueService.isBullAvailable()) {
    const q = queueService.getNotificationQueue();
    const counts = await q.getJobCounts();
    return counts.waiting + counts.active + counts.delayed;
  }
  return 0;
}

function _daysBetween(date1, date2) {
  const ms = Math.abs(new Date(date2) - new Date(date1));
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ── Public API ─────────────────────────────────────────

module.exports = {
  registerBullWorkers,
  startCronJobs,

  /** Start everything — call once from server.js */
  startBackgroundJobs: async () => {
    // Initialize Bull queues (checks Redis availability first)
    await queueService.initQueues();
    registerBullWorkers();
    startCronJobs();
  }
};
