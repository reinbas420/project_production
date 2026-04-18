const mysql = require('mysql2/promise');
const config = require('./index');

let pool;

const connectMySQL = async () => {
  try {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ MySQL Connected');
    connection.release();
    
    return pool;
  } catch (error) {
    console.error('❌ MySQL connection error:', error.message);
    process.exit(1);
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('MySQL pool not initialized. Call connectMySQL first.');
  }
  return pool;
};

module.exports = { connectMySQL, getPool };
