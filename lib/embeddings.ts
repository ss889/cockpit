const OPENAI_KEY = process.env.OPENAI_API_KEY;

export function embeddingsAvailable() {
  return !!OPENAI_KEY;
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_KEY) throw new Error('OpenAI API key not configured');
  // dynamic import to avoid bundler trying to resolve `openai` at build time
  const mod = await import('openai');
  const OpenAI = (mod && (mod as any).default) || mod;
  const client = new OpenAI({ apiKey: OPENAI_KEY });
  const resp = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
  // @ts-ignore
  return resp.data[0].embedding;
}
