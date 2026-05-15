import path from 'path';
import fs from 'fs';
let Database: any = null;

const DB_PATH = path.join(process.cwd(), "data", "corpus.db");

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function available() {
  return !!Database;
}

let db: any = null;

export function initDB() {
  if (!Database) {
    try {
      // avoid static analysis by bundlers - require at runtime
      // eslint-disable-next-line @typescript-eslint/no-var-requires, no-eval
      const rq: any = eval('require');
      Database = rq('better-sqlite3');
    } catch (e) {
      Database = null;
      return null;
    }
  }
  if (db) return db;
  ensureDir();
  db = new Database(DB_PATH);
  // enable WAL for concurrency
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      meta TEXT,
      createdAt TEXT
    );
  `);
  // create FTS5 virtual table if supported
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(text, content='docs', content_rowid='rowid');`);
    // trigger to keep fts in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS docs_ai_after_insert AFTER INSERT ON docs BEGIN
        INSERT INTO docs_fts(rowid, text) VALUES (new.rowid, new.text);
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS docs_ai_after_delete AFTER DELETE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, text) VALUES('delete', old.rowid, old.text);
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS docs_ai_after_update AFTER UPDATE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, text) VALUES('delete', old.rowid, old.text);
        INSERT INTO docs_fts(rowid, text) VALUES (new.rowid, new.text);
      END;
    `);
  } catch (e) {
    // fts may not be available; ignore
  }
  return db;
}

export function saveDoc(id: string, text: string, meta?: Record<string, any>) {
  const d = initDB();
  if (!d) throw new Error("SQLite not available");
  const stmt = d.prepare("INSERT OR REPLACE INTO docs (id, text, meta, createdAt) VALUES (?, ?, ?, ?)");
  stmt.run(id, text, meta ? JSON.stringify(meta) : null, new Date().toISOString());
  return { id, text, meta };
}

export function searchFts(query: string, limit = 5) {
  const d = initDB();
  if (!d) return [];
  try {
    const rows = d.prepare(`SELECT docs.id, docs.text, docs.meta, docs.createdAt, bm25(docs_fts) AS score FROM docs_fts JOIN docs ON docs_fts.rowid = docs.rowid WHERE docs_fts MATCH ? ORDER BY score LIMIT ?`).all(query, limit);
    return rows.map((r: any) => ({ id: r.id, text: r.text, meta: r.meta ? JSON.parse(r.meta) : null, createdAt: r.createdAt, score: r.score }));
  } catch (e) {
    // fallback simple LIKE search
    const rows = d.prepare("SELECT id, text, meta, createdAt FROM docs WHERE text LIKE ? LIMIT ?").all(`%${query}%`, limit);
    return rows.map((r: any) => ({ id: r.id, text: r.text, meta: r.meta ? JSON.parse(r.meta) : null, createdAt: r.createdAt }));
  }
}

export function listDocs() {
  const d = initDB();
  if (!d) return [];
  return d.prepare("SELECT id, text, meta, createdAt FROM docs ORDER BY createdAt DESC LIMIT 1000").all().map((r: any) => ({ id: r.id, text: r.text, meta: r.meta ? JSON.parse(r.meta) : null, createdAt: r.createdAt }));
}
