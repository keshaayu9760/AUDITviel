const mongoose = require("mongoose");

/**
 * Connect to MongoDB Atlas with retry logic and optimized connection options
 * 
 * Connection options:
 * - serverSelectionTimeoutMS: Time to wait for server selection (30s)
 * - socketTimeoutMS: Time to wait for socket operations (45s)
 * - connectTimeoutMS: Time to wait for initial connection (30s)
 * - maxPoolSize: Maximum number of connections in pool (10)
 * - minPoolSize: Minimum number of connections in pool (2)
 * - retryWrites: Enable retryable writes
 * - retryReads: Enable retryable reads
 */
const connectDB = async (mongoURI, retries = 3, delay = 2000) => {
  const connectionOptions = {
    serverSelectionTimeoutMS: 30000, // 30 seconds
    socketTimeoutMS: 45000, // 45 seconds
    connectTimeoutMS: 30000, // 30 seconds
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    retryReads: true,
  };

  // Disable Mongoose buffering globally to prevent timeout issues
  mongoose.set('bufferCommands', false);

  // Validate MongoDB URI format
  if (!mongoURI || typeof mongoURI !== 'string') {
    console.error('[MongoDB] Invalid MONGO_URI: URI is missing or not a string');
    console.error('[MongoDB] Received:', typeof mongoURI, mongoURI);
    process.exit(1);
  }
  
  // Check if URI accidentally includes the variable name
  if (mongoURI.startsWith('MONGO_URI=')) {
    console.error('[MongoDB] ERROR: MONGO_URI environment variable contains "MONGO_URI=" prefix');
    console.error('[MongoDB] The value should be just the connection string, not "MONGO_URI=mongodb+srv://..."');
    console.error('[MongoDB] Please fix this in your Render environment variables');
    process.exit(1);
  }
  
  if (!mongoURI.startsWith('mongodb://') && !mongoURI.startsWith('mongodb+srv://')) {
    console.error('[MongoDB] Invalid MONGO_URI format: Must start with "mongodb://" or "mongodb+srv://"');
    console.error('[MongoDB] Received:', mongoURI.substring(0, 50) + '...');
    process.exit(1);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[MongoDB] Connection attempt ${attempt}/${retries}...`);
      const maskedURI = mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.log(`[MongoDB] URI: ${maskedURI}`);
      
      await mongoose.connect(mongoURI, connectionOptions);
      
      // Verify connection with ping
      await mongoose.connection.db.admin().ping();
      
      console.log("✓ MongoDB connected successfully");
      console.log(`[MongoDB] Database: ${mongoose.connection.db.databaseName}`);
      console.log(`[MongoDB] Ready state: ${mongoose.connection.readyState} (1=connected)`);
      
      // Set up connection event handlers
      mongoose.connection.on('error', (err) => {
        console.error('[MongoDB] Connection error:', err.message);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('[MongoDB] Disconnected');
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('[MongoDB] Reconnected');
      });
      
      return;
    } catch (err) {
      console.error(`[MongoDB] Connection attempt ${attempt} failed:`, err.message);
      
      if (attempt < retries) {
        console.log(`[MongoDB] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Exponential backoff
        delay *= 1.5;
      } else {
        console.error("[MongoDB] All connection attempts failed");
        console.error("[MongoDB] Error details:", {
          name: err.name,
          message: err.message,
          code: err.code,
          codeName: err.codeName
        });
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;

