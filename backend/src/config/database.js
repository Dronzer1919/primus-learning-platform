const mongoose = require('mongoose');

// Connection options. useNewUrlParser/useUnifiedTopology were removed here:
// both are no-ops in Mongoose 8 and only produce deprecation warnings.
const OPTIONS = {
  // Fail a query in 10s if no server can be selected, instead of the 30s
  // default — a stuck request should surface as an error, not tie up a socket.
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10
};

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  // Retry with backoff rather than exiting on the first failure. On a fresh
  // deploy the API container regularly starts before Mongo is accepting
  // connections; exiting immediately turned that race into a crash loop.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, OPTIONS);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      const isLast = attempt === MAX_ATTEMPTS;
      console.error(
        `MongoDB connection attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message}`
      );
      if (isLast) {
        console.error('FATAL: could not connect to MongoDB. Exiting.');
        process.exit(1);
      }
      await wait(BASE_DELAY_MS * attempt); // 2s, 4s, 6s, 8s
    }
  }
};

// Once the initial connection succeeds, Mongoose reconnects on its own. These
// listeners exist so a blip is visible in the logs rather than silent — the
// previous code had no visibility into a dropped connection at all.
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected — Mongoose will attempt to reconnect.');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected.');
});

module.exports = connectDB;
