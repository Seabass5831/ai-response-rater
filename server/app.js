// Builds and exports the Express app. It does NOT connect to the database
// or start listening -- index.js does that. Keeping them separate lets the
// tests import the app without starting a real server.
const express = require('express');
const cors = require('cors');
const comparisonsRouter = require('./routes/comparisons');

const app = express();

// Let the React app (served from a different origin) call this API.
app.use(cors());

// Parse JSON request bodies into req.body.
app.use(express.json());

// Quick check that the server is up.
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/comparisons', comparisonsRouter);

// Bad JSON in a request body -> 400. Anything else unexpected -> 500.
// (Express 5 sends errors thrown in async routes here automatically.)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

module.exports = app;
