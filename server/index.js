// Entry point: loads settings from .env, connects to MongoDB, then starts
// the server. Run with `npm run dev` (restarts on file changes) or `npm start`.
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const { MONGODB_URI } = process.env;

async function start() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is missing. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start();
