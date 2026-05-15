import { getEmbedding, embeddingsAvailable } from "./embeddings";
import { saveJobDescription, listCorpus } from "./database";

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

export async function embedAndSave(text: string, meta?: Record<string, any>) {
  if (!embeddingsAvailable()) return saveJobDescription(text, meta);
  const emb = await getEmbedding(text);
  const combinedMeta = { ...(meta || {}), embedding: emb };
  return saveJobDescription(text, combinedMeta);
}

export async function searchByEmbedding(query: string, limit = 5) {
  if (!embeddingsAvailable()) return [];
  const qEmb = await getEmbedding(query);
  const docs = listCorpus();
  const scored = docs
    .map((d: any) => {
      const emb = d.meta?.embedding;
      if (!emb || !Array.isArray(emb)) return null;
      const score = dot(qEmb, emb) / (norm(qEmb) * norm(emb) || 1);
      return { doc: d, score };
    })
    .filter(Boolean) as { doc: any; score: number }[];
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => ({ ...s.doc, score: s.score }));
}
