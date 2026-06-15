import fs from "fs";
import path from "path";
import { getDataDir } from "./dataDir";
import * as sqliteHelper from "./sqlite";

const DATA_DIR = getDataDir();
const CORPUS_FILE = path.join(DATA_DIR, "corpus.json");

type CorpusEntry = {
  id: string;
  text: string;
  meta?: Record<string, any>;
  createdAt: string;
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CORPUS_FILE)) fs.writeFileSync(CORPUS_FILE, JSON.stringify([]));
}

function readAll(): CorpusEntry[] {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(CORPUS_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function writeAll(items: CorpusEntry[]) {
  ensureDataDir();
  fs.writeFileSync(CORPUS_FILE, JSON.stringify(items, null, 2));
}

export function saveJobDescription(text: string, meta?: Record<string, any>) {
  if (sqliteHelper.available()) {
    const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9);
    sqliteHelper.saveDoc(id, text, meta || {});
    return { id, text, meta: meta || {}, createdAt: new Date().toISOString() };
  }
  const items = readAll();
  const entry: CorpusEntry = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9),
    text,
    meta: meta || {},
    createdAt: new Date().toISOString(),
  };
  items.push(entry);
  writeAll(items);
  return entry;
}

function tokenize(s: string) {
  return (s || "").toLowerCase().replace(/[.\n\r,;:\/()"'`]/g, " ").split(/\s+/).filter(Boolean);
}

export function searchSimilar(query: string, limit = 3) {
  if (sqliteHelper.available()) {
    try {
      return sqliteHelper.searchFts(query, limit);
    } catch (e) {
      // fallthrough to file-based search
    }
  }
  const items = readAll();
  if (!query) return [];
  const qTokens = tokenize(query);
  const scores = items.map((it) => {
    const tokens = tokenize(it.text);
    let score = 0;
    for (const t of qTokens) {
      if (tokens.includes(t)) score += 1;
    }
    return { item: it, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores.filter((s) => s.score > 0).slice(0, limit).map((s) => s.item);
}

export function listCorpus() {
  if (sqliteHelper.available()) {
    try {
      return sqliteHelper.listDocs();
    } catch (e) {
      // fall through
    }
  }
  return readAll();
}
