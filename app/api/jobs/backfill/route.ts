import { NextRequest, NextResponse } from 'next/server';
import { listCorpus } from '@/lib/database';
import { embeddingsAvailable, getEmbedding } from '@/lib/embeddings';
import * as sqliteHelper from '@/lib/sqlite';
import { startJob, finishJob } from '@/lib/jobs';
import { enqueue } from '@/lib/queue';

async function doBackfill() {
  startJob('backfill');
  if (!embeddingsAvailable()) {
    console.warn('Backfill aborted: embeddings not configured');
    finishJob('backfill');
    return;
  }
  const docs = listCorpus();
  for (const doc of docs) {
    try {
      if (doc.meta && doc.meta.embedding) continue;
      const emb = await getEmbedding(doc.text.slice(0, 2000));
      if (sqliteHelper.available()) {
        sqliteHelper.saveDoc(doc.id, doc.text, { ...(doc.meta || {}), embedding: emb });
      } else {
        // update JSON corpus fallback
        const { saveJobDescription } = await import('@/lib/database');
        await saveJobDescription(doc.text, { ...(doc.meta || {}), embedding: emb });
      }
    } catch (e) {
      console.warn('Failed embedding for', doc.id, e);
    }
  }
  finishJob('backfill');
}

export async function POST(req: NextRequest) {
  // enqueue backfill job and return 202
  const job = enqueue('backfill', {});
  return NextResponse.json({ status: 'queued', job }, { status: 202 });
}
