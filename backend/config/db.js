/**
 * Database Connection Module
 *
 * Expects MONGODB_URI to be loaded by the centralized env loader
 * (imported at the top of server.js before this module runs).
 *
 * Optimized with connection pooling and tuned timeouts for production throughput.
 */
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
    console.log("✅ MongoDB Atlas connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
