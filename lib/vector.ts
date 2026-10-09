import { getEmbedding, embeddingsAvailable } from "./embeddings";
import { saveJobDescription, listCorpus } from "./database";

type VectorDoc = {
  id: string;
  text: string;
  meta?: { embedding?: number[] } | null;
  createdAt?: string;
};

function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s);
}

export async function embedAndSave(text: string, meta?: Record<string, unknown>) {
  if (!embeddingsAvailable()) return saveJobDescription(text, meta);
  const emb = await getEmbedding(text);
  const combinedMeta = { ...(meta || {}), embedding: emb };
  return saveJobDescription(text, combinedMeta);
}

export async function searchByEmbedding(query: string, limit = 5) {
  if (!embeddingsAvailable()) return [];
  const qEmb = await getEmbedding(query);
  const docs = listCorpus() as VectorDoc[];
  const scored = docs
    .map((d) => {
      const emb = d.meta?.embedding;
      if (!emb || !Array.isArray(emb)) return null;
      const score = dot(qEmb, emb) / (norm(qEmb) * norm(emb) || 1);
      return { doc: d, score };
    })
    .filter((entry): entry is { doc: VectorDoc; score: number } => entry !== null);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => ({ ...s.doc, score: s.score }));
}
