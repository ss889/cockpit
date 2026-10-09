const OPENAI_KEY = process.env.OPENAI_API_KEY;

export function embeddingsAvailable() {
  return !!OPENAI_KEY;
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_KEY) throw new Error('OpenAI API key not configured');
  const mod = await import('openai');
  const OpenAICtor = (mod && typeof mod === 'object' && 'default' in mod ? (mod as { default: unknown }).default : mod) as unknown as new (args: { apiKey: string }) => {
    embeddings: {
      create: (args: { model: string; input: string }) => Promise<{ data: Array<{ embedding: number[] }> }>;
    };
  };
  const client = new OpenAICtor({ apiKey: OPENAI_KEY });
  const resp = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return resp.data[0].embedding;
}
