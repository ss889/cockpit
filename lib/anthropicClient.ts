import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = new Anthropic({ apiKey });
  // Log client creation (debug only — safe to print model name but not API key)
  // eslint-disable-next-line no-console
  console.info('[anthropicClient] createAnthropicClient() created; ANTHROPIC_MODEL=', process.env.ANTHROPIC_MODEL || '<none>');

  // Wrap messages.create to enforce a single configurable model at runtime.
  const messagesAny = (client as any).messages;
  const originalCreate = messagesAny.create.bind(messagesAny);

  messagesAny.create = function (params: any, options?: any) {
    const configuredModel = process.env.ANTHROPIC_MODEL;
    if (configuredModel) {
      params = { ...params, model: configuredModel };
    }
    // eslint-disable-next-line no-console
    console.info('[anthropicClient] messages.create called; using model=', params?.model || '<none>');
    return originalCreate(params, options);
  };

  return client as unknown as InstanceType<typeof Anthropic>;
}
