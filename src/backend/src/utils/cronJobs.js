const cron = require('node-cron');
const penaltyService = require('../services/penaltyService');

/**
 * Cron job to process overdue penalties
 * Runs daily at 2:00 AM
 */
const startPenaltyCronJob = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Running daily penalty processing...');
    
    try {
      const result = await penaltyService.processOverduePenalties();
      console.log(`✅ Processed ${result.processed} overdue penalties`);
    } catch (error) {
      console.error('❌ Error processing penalties:', error.message);
    }
  }, {
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });
  
  console.log('✅ Penalty cron job scheduled (daily at 2:00 AM)');
};

module.exports = { startPenaltyCronJob };
