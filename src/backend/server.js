const app = require('./src/app');
const config = require('./src/config');
const connectMongoDB = require('./src/config/mongodb');
// Temporarily disabled for prototype - uncomment when MySQL is set up
// const { connectMySQL } = require('./src/config/mysql');
// const { startPenaltyCronJob } = require('./src/utils/cronJobs');

// ── Platform Services Layer — Aryan ────────────────────
const { startBackgroundJobs } = require('./src/jobs/backgroundJobs');
const { validateEnvSecrets } = require('./src/middleware/security');
const { closeAllQueues } = require('./src/services/queueService');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Connect to databases
const startServer = async () => {
  try {
    // ── Platform Services: Validate env secrets ───────
    validateEnvSecrets();

    // Connect to MongoDB
    await connectMongoDB();
    
    // Connect to MySQL - TEMPORARILY DISABLED FOR PROTOTYPE
    // Uncomment when you have MySQL set up
    // await connectMySQL();
    console.log('⚠️  MySQL connection disabled - running in prototype mode');
    
    // Start the server
    const port = config.port;
    const server = app.listen(port, () => {
      console.log(`\n🚀 Server running on port ${port}`);
      console.log(`📚 Hyper Local Cloud Library API`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`⏰ Server started at: ${new Date().toISOString()}\n`);
    });
    
    // ── Platform Services: Background Jobs ─────────────
    await startBackgroundJobs();
    console.log('🔔 Push notifications service ready');
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('💥 UNHANDLED REJECTION! Shutting down...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });
    
    // Handle SIGTERM
    process.on('SIGTERM', async () => {
      console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
      await closeAllQueues();
      server.close(() => {
        console.log('✅ Process terminated!');
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the application
startServer();
