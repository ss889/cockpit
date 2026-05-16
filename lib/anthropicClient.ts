import Anthropic from '@anthropic-ai/sdk';

/**
 * Creates an Anthropic client with explicit configuration to prevent environment injection issues.
 */
export function createAnthropicClient() {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  // Explicitly set the base URL to ensure we are hitting the real Anthropic API
  // and not a potentially broken internal proxy or mock.
  return new Anthropic({
    apiKey: apiKey,
    baseURL: 'https://api.anthropic.com',
  });
}
