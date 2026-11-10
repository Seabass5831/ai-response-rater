const mongoose = require('mongoose');

// The rubric criteria. The rating route and (later) the React form both use
// this list, so adding a criterion only means changing it here and in the
// client's rubric.js.
const CRITERIA = ['accuracy', 'clarity', 'completeness', 'tone'];

// One 1-5 score per criterion, e.g. { accuracy: 4, clarity: 5, ... }
const scoresSchema = new mongoose.Schema(
  Object.fromEntries(CRITERIA.map((name) => [name, { type: Number, min: 1, max: 5 }])),
  { _id: false },
);

// One side of the comparison: what was asked for and what came back.
const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // what results are grouped by
    model: { type: String, required: true },
    systemPrompt: String,
    response: String,
  },
  { _id: false },
);

const comparisonSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    optionA: { type: optionSchema, required: true },
    optionB: { type: optionSchema, required: true },
    // Empty until the comparison is rated.
    rating: {
      scoresA: scoresSchema,
      scoresB: scoresSchema,
      winner: { type: String, enum: ['A', 'B', 'tie'] },
      notes: String,
    },
  },
  { timestamps: true }, // adds createdAt and updatedAt
);

const Comparison = mongoose.model('Comparison', comparisonSchema);

module.exports = { Comparison, CRITERIA };
