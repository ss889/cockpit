// Monkey-patch the Anthropic SDK Messages create method to enforce a single
// configurable model at runtime. This ensures any code that constructs its
// own Anthropic client (including compiled bundles) will still use the
// `ANTHROPIC_MODEL` env var if set.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const anthropic = require('@anthropic-ai/sdk');

  const MessagesCtor = anthropic.Messages || (anthropic.default && anthropic.default.Messages);

  if (MessagesCtor && MessagesCtor.prototype && !MessagesCtor.prototype.__modelPatched) {
    const origCreate = MessagesCtor.prototype.create;
    MessagesCtor.prototype.create = function (params: any, options?: any) {
      const configuredModel = process.env.ANTHROPIC_MODEL;
      if (configuredModel) {
        params = { ...params, model: configuredModel };
      }
      // eslint-disable-next-line no-console
      console.info('[patchAnthropicModel] messages.create called; using model=', params?.model || '<none>');
      return origCreate.call(this, params, options);
    };
    MessagesCtor.prototype.__modelPatched = true;
    // eslint-disable-next-line no-console
    console.info('[patchAnthropicModel] Applied Anthropic SDK model patch; ANTHROPIC_MODEL=', process.env.ANTHROPIC_MODEL || '<none>');
  }
} catch (e) {
  // If the SDK isn't present or patching fails, fail silently — callers
  // will still use whatever model they pass. We don't want startup to crash.
  // eslint-disable-next-line no-console
  console.warn('Anthropic SDK patch failed:', (e as any)?.message || e);
}
