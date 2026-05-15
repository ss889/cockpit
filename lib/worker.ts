import { fetchDue, markDone, markFailed } from './queue';
import { listCorpus } from './database';
import { getEmbedding, embeddingsAvailable } from './embeddings';
import * as sqliteHelper from './sqlite';
import { runAnalyze } from './analyze';
import { saveJobResult } from './jobs';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function doBackfillJob() {
  if (!embeddingsAvailable()) {
    console.log('Embeddings not configured; aborting backfill.');
    return;
  }
  const docs = listCorpus();
  console.log(`Found ${docs.length} docs in corpus.`);
  for (const doc of docs) {
    if (doc.meta && doc.meta.embedding) continue;
    try {
      console.log('Embedding doc', doc.id);
      const emb = await getEmbedding(doc.text.slice(0, 2000));
      if (sqliteHelper.available()) {
        sqliteHelper.saveDoc(doc.id, doc.text, { ...(doc.meta || {}), embedding: emb });
      } else {
        // fallback uses saveJobDescription which will write JSON
        const { saveJobDescription } = await import('./database');
        saveJobDescription(doc.text, { ...(doc.meta || {}), embedding: emb });
      }
      await sleep(500);
    } catch (e) {
      console.error('Error embedding', doc.id, e);
      await sleep(1000);
    }
  }
  console.log('Backfill complete');
}

async function processJob(job: any) {
  try {
    if (job.type === 'backfill') {
      await doBackfillJob();
    } else if (job.type === 'analyze') {
      console.log('Processing analyze job', job.id);
      const jd = job.payload?.jd;
      if (!jd) throw new Error('Missing job description');
      const result = await runAnalyze(jd);
      console.log('Analyze result for', job.id, { summary: result.text });
      try {
        saveJobResult(job.id, result);
      } catch (e) {
        console.warn('Failed to save job result', job.id, e);
      }
    } else {
      console.log('Unknown job type', job.type);
    }
    markDone(job.id);
  } catch (e) {
    console.error('Job failed', job.id, e);
    markFailed(job.id, e);
  }
}

async function loop() {
  while (true) {
    const jobs = fetchDue(1);
    if (!jobs || jobs.length === 0) {
      await sleep(2000);
      continue;
    }
    for (const job of jobs) {
      await processJob(job);
    }
  }
}

if (require.main === module) {
  const arg = process.argv[2] || 'loop';
  if (arg === 'once') {
    (async () => { const jobs = fetchDue(10); for (const j of jobs) await processJob(j); process.exit(0); })();
  } else {
    loop();
  }
}
