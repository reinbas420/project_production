const mongoose = require('mongoose');
const config = require('./index');

const connectMongoDB = async () => {
  try {
    const uri = config.nodeEnv === 'test' ? config.mongodb.testUri : config.mongodb.uri;
    
    // No options needed - useNewUrlParser and useUnifiedTopology are deprecated in v4+
    await mongoose.connect(uri);
    
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

module.exports = connectMongoDB;
