const express = require('express');
const mongoose = require('mongoose');
const { Comparison, CRITERIA } = require('../models/Comparison');
const { getResponse, LlmError } = require('../llm');

const router = express.Router();

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

// Returns an error message for a bad option, or null if it's fine.
function checkOption(option, name) {
  if (!option || typeof option !== 'object') return `${name} is required.`;
  if (!isNonEmptyString(option.label)) return `${name}.label is required.`;
  if (!isNonEmptyString(option.model)) return `${name}.model is required.`;
  if (option.systemPrompt !== undefined && typeof option.systemPrompt !== 'string') {
    return `${name}.systemPrompt must be a string.`;
  }
  return null;
}

// Returns an error message for bad scores, or null if they're fine.
function checkScores(scores, name) {
  if (!scores || typeof scores !== 'object') return `${name} is required.`;
  for (const criterion of CRITERIA) {
    const score = scores[criterion];
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return `${name}.${criterion} must be a whole number from 1 to 5.`;
    }
  }
  return null;
}

// Keep only the fields we store, so extra fields in the request are ignored.
const pickOption = ({ label, model, systemPrompt }) => ({
  label: label.trim(),
  model: model.trim(),
  systemPrompt: systemPrompt?.trim() || undefined,
});
const pickScores = (scores) => Object.fromEntries(CRITERIA.map((c) => [c, scores[c]]));

// Runs the prompt against both options and saves the result.
router.post('/', async (req, res) => {
  const { prompt, optionA, optionB } = req.body ?? {};

  if (!isNonEmptyString(prompt)) {
    return res.status(400).json({ error: 'prompt is required.' });
  }
  const optionError = checkOption(optionA, 'optionA') || checkOption(optionB, 'optionB');
  if (optionError) return res.status(400).json({ error: optionError });

  const a = pickOption(optionA);
  const b = pickOption(optionB);

  // Ask for both responses at the same time. If either fails, nothing is saved.
  let responses;
  try {
    responses = await Promise.all([
      getResponse({ model: a.model, systemPrompt: a.systemPrompt, prompt }),
      getResponse({ model: b.model, systemPrompt: b.systemPrompt, prompt }),
    ]);
  } catch (err) {
    if (err instanceof LlmError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const comparison = await Comparison.create({
    prompt,
    optionA: { ...a, response: responses[0] },
    optionB: { ...b, response: responses[1] },
  });
  res.status(201).json(comparison);
});

// Saves (or replaces) the rating for one comparison.
router.patch('/:id/rating', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid comparison id.' });
  }

  const { scoresA, scoresB, winner, notes } = req.body ?? {};
  const error =
    checkScores(scoresA, 'scoresA') ||
    checkScores(scoresB, 'scoresB') ||
    (!['A', 'B', 'tie'].includes(winner) ? 'winner must be "A", "B" or "tie".' : null) ||
    (notes !== undefined && typeof notes !== 'string' ? 'notes must be a string.' : null);
  if (error) return res.status(400).json({ error });

  const comparison = await Comparison.findByIdAndUpdate(
    req.params.id,
    { rating: { scoresA: pickScores(scoresA), scoresB: pickScores(scoresB), winner, notes } },
    { returnDocument: 'after', runValidators: true }, // return the updated doc
  );
  if (!comparison) return res.status(404).json({ error: 'Comparison not found.' });
  res.json(comparison);
});

// All comparisons, newest first.
router.get('/', async (req, res) => {
  const comparisons = await Comparison.find().sort({ createdAt: -1 });
  res.json(comparisons);
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid comparison id.' });
  }
  const comparison = await Comparison.findById(req.params.id);
  if (!comparison) return res.status(404).json({ error: 'Comparison not found.' });
  res.json(comparison);
});

module.exports = router;
