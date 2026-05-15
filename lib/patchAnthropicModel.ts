// Monkey-patch the Anthropic SDK Messages create method to enforce a single
// configurable model at runtime. This ensures any code that constructs its
// own Anthropic client (including compiled bundles) will still use the
// `ANTHROPIC_MODEL` env var if set.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const anthropic = require('@anthropic-ai/sdk');
  const MessagesCtor = anthropic.Messages || (anthropic.default && anthropic.default.Messages);

  function applyPatchToMessagesCtor(Messages: any) {
    if (!Messages || !Messages.prototype || Messages.prototype.__modelPatched) return;
    const origCreate = Messages.prototype.create;
    Messages.prototype.create = function (params: any, options?: any) {
      const configuredModel = process.env.ANTHROPIC_MODEL;
      if (configuredModel) {
        params = { ...params, model: configuredModel };
      }
      // eslint-disable-next-line no-console
      console.info('[patchAnthropicModel] messages.create called; using model=', params?.model || '<none>');
      return origCreate.call(this, params, options);
    };
    Messages.prototype.__modelPatched = true;
  }

  applyPatchToMessagesCtor(MessagesCtor);

  // Also wrap the Anthropic client constructor so any future instances get patched
  const OriginalAnthropic = anthropic.default || anthropic;
  if (OriginalAnthropic && !OriginalAnthropic.__patchedForModel) {
    // Create a wrapper class that patches the `messages` instance on construction
    // while preserving the original prototype.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PatchedAnthropic: any = class extends OriginalAnthropic {
      constructor(...args: any[]) {
        super(...args);
        try {
          const msgs = (this as any).messages;
          if (msgs) {
            // If the instance has an own create property, override it; otherwise rely on prototype patch
            const configuredModel = process.env.ANTHROPIC_MODEL;
            if (configuredModel) {
              const existing = msgs.create;
              msgs.create = function (params: any, options?: any) {
                params = { ...params, model: configuredModel };
                // eslint-disable-next-line no-console
                console.info('[patchAnthropicModel] patched instance messages.create; using model=', params?.model || '<none>');
                return existing.call(this, params, options);
              };
            }
          }
        } catch (e) {
          // ignore
        }
      }
    };

    // copy static props
    Object.getOwnPropertyNames(OriginalAnthropic).forEach((key) => {
      try {
        (PatchedAnthropic as any)[key] = (OriginalAnthropic as any)[key];
      } catch (e) {
        // ignore
      }
    });

    // Mark and replace exports
    PatchedAnthropic.__patchedForModel = true;
    if (anthropic.default) anthropic.default = PatchedAnthropic;
    anthropic.Anthropic = PatchedAnthropic;

    // eslint-disable-next-line no-console
    console.info('[patchAnthropicModel] Applied Anthropic SDK model patch; ANTHROPIC_MODEL=', process.env.ANTHROPIC_MODEL || '<none>');
  }
} catch (e) {
  // If the SDK isn't present or patching fails, fail silently — callers
  // will still use whatever model they pass. We don't want startup to crash.
  // eslint-disable-next-line no-console
  console.warn('Anthropic SDK patch failed:', (e as any)?.message || e);
}
