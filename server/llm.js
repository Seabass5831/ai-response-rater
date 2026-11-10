// The only file that talks to the AI provider. Everything else calls
// getResponse(), which makes it easy to switch providers and to replace the
// AI with a fake in tests.
const Anthropic = require('@anthropic-ai/sdk');

// Thrown for any AI failure, with a message that's safe to show the user.
class LlmError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

let client;

// Created on first use, so the app can load (e.g. in tests) without a key.
// The SDK reads ANTHROPIC_API_KEY from the environment.
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LlmError('ANTHROPIC_API_KEY is not set. Add it to server/.env.', 500);
  }
  if (!client) client = new Anthropic();
  return client;
}

async function getResponse({ model, systemPrompt, prompt }) {
  let response;
  try {
    response = await getClient().messages.create({
      model,
      max_tokens: 16000,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    throw toLlmError(err, model);
  }

  if (response.stop_reason === 'refusal') {
    throw new LlmError(`${model} declined to answer this prompt.`, 422);
  }

  // The reply is a list of content blocks; keep just the text.
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// Turn SDK errors into short messages (most specific first).
function toLlmError(err, model) {
  if (err instanceof LlmError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new LlmError('The AI API key is missing or invalid. Check ANTHROPIC_API_KEY in .env.');
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new LlmError(`Model "${model}" was not found. Check the model name.`, 400);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new LlmError(`The AI rejected the request: ${err.message}`, 400);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new LlmError('The AI is rate limiting requests. Wait a moment and try again.', 429);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new LlmError('Could not reach the AI service. Check your internet connection.');
  }
  if (err instanceof Anthropic.APIError) {
    return new LlmError(`The AI request failed (status ${err.status ?? 'unknown'}).`);
  }
  return new LlmError('Something went wrong calling the AI.');
}

module.exports = { getResponse, LlmError };
