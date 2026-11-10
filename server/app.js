// Builds and exports the Express app. It does NOT connect to the database
// or start listening -- index.js does that. Keeping them separate lets the
// tests import the app without starting a real server.
const express = require('express');
const cors = require('cors');

const app = express();

// Let the React app (served from a different origin) call this API.
app.use(cors());

// Parse JSON request bodies into req.body.
app.use(express.json());

// Quick check that the server is up.
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
