const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

const STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "with",
  "this",
  "from",
  "have",
  "will",
  "your",
  "you",
  "for",
  "are",
  "our",
  "into",
  "their",
  "about",
  "work",
  "team",
  "role",
  "using",
  "build",
  "strong",
  "experience",
]);

export async function extractKeywordsOllama(jd: string): Promise<string[] | null> {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt:
          "Extract the 15 most important technical skills, tools, and role-specific terms from this job description. Return ONLY a JSON array of strings, nothing else, no markdown.\n\n" +
          jd,
        stream: false,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const parsed = JSON.parse(String(data.response || "[]"));
    return normalizeKeywords(Array.isArray(parsed) ? parsed : []);
  } catch {
    return null;
  }
}

export function extractKeywordsFallback(jd: string): string[] {
  const phrases = jd
    .match(/\b[A-Z][A-Za-z0-9+#.]{1,}(?:\s+[A-Z][A-Za-z0-9+#.]{1,}){0,2}\b/g)
    ?.map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 3) ?? [];

  const words = jd
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

  const freq = new Map<string, number>();
  for (const phrase of phrases) freq.set(phrase, (freq.get(phrase) || 0) + 2);
  for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);

  return normalizeKeywords(
    [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
  );
}

export async function extractKeywords(jd: string): Promise<string[]> {
  const ollamaResult = await extractKeywordsOllama(jd);
  return ollamaResult ?? extractKeywordsFallback(jd);
}

function normalizeKeywords(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const keyword = String(value || "").trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key) || STOP_WORDS.has(key)) continue;
    seen.add(key);
    out.push(keyword);
    if (out.length >= 15) break;
  }

  return out;
}
