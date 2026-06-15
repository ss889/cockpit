import fs from 'fs';
import path from 'path';
import { getDataDir } from './dataDir';

const DATA_DIR = getDataDir();
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');
const LOCK_FILE = QUEUE_FILE + '.lock';

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(QUEUE_FILE)) fs.writeFileSync(QUEUE_FILE, JSON.stringify([]));
}

function read() {
  ensure();
  try {
    acquireLock();
    try {
      return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8') || '[]');
    } finally {
      releaseLock();
    }
  } catch (e) {
    return [];
  }
}

function write(jobs: any[]) {
  ensure();
  // atomic write: write to tmp file then rename
  const tmp = QUEUE_FILE + '.' + process.pid + '.tmp';
  acquireLock();
  try {
    fs.writeFileSync(tmp, JSON.stringify(jobs, null, 2));
    fs.renameSync(tmp, QUEUE_FILE);
  } finally {
    releaseLock();
  }
}

function sleepSync(ms: number) {
  const sab = new SharedArrayBuffer(4);
  const ia = new Int32Array(sab);
  Atomics.wait(ia, 0, 0, ms);
}

function acquireLock(timeout = 5000) {
  const start = Date.now();
  while (true) {
    try {
      fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
      return;
    } catch (e: any) {
      if (e && e.code === 'EEXIST') {
        if (Date.now() - start > timeout) throw new Error('Timeout acquiring queue lock');
        sleepSync(50);
        continue;
      }
      throw e;
    }
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (e) {
    // ignore
  }
}

export function enqueue(type: string, payload: any = {}, opts: any = {}) {
  const jobs = read();
  // dedupe by signature: avoid enqueuing identical pending job
  const nextRun = opts.nextRun ? new Date(opts.nextRun).toISOString() : new Date().toISOString();
  const signature = JSON.stringify({ type, payload, nextRun: new Date(nextRun).getTime() > Date.now() ? nextRun : null });
  const exists = jobs.find((j: any) => j.signature === signature && (j.status === 'pending' || j.status === 'running'));
  if (exists) return exists;
  const job = {
    id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9),
    type,
    payload,
    signature,
    status: 'pending',
    retries: 0,
    maxRetries: opts.maxRetries ?? 3,
    createdAt: new Date().toISOString(),
    nextRun,
    lastError: null,
  };
  jobs.push(job);
  write(jobs);
  return job;
}

export function scheduleJob(type: string, payload: any = {}, opts: any = {}) {
  const delayMinutes = Number(opts.delayMinutes ?? 0);
  const nextRun = opts.nextRun
    ? new Date(opts.nextRun)
    : new Date(Date.now() + Math.max(0, delayMinutes) * 60_000);
  return enqueue(type, payload, { ...opts, nextRun });
}

export function fetchDue(limit = 1) {
  const jobs = read();
  const now = Date.now();
  const due = jobs.filter((j: any) => j.status === 'pending' && new Date(j.nextRun).getTime() <= now).slice(0, limit);
  // mark as in-progress
  const ids = new Set(due.map((d: any) => d.id));
  for (const j of jobs) if (ids.has(j.id)) j.status = 'running';
  write(jobs);
  return due;
}

export function markDone(id: string) {
  const jobs = read();
  for (const j of jobs) if (j.id === id) { j.status = 'done'; j.finishedAt = new Date().toISOString(); }
  write(jobs);
}

export function markFailed(id: string, err: any) {
  const jobs = read();
  for (const j of jobs) {
    if (j.id === id) {
      j.retries = (j.retries || 0) + 1;
      j.lastError = String(err);
      if (j.retries > (j.maxRetries || 3)) {
        j.status = 'failed';
        j.finishedAt = new Date().toISOString();
      } else {
        const backoffMs = Math.min(60_000, 1000 * Math.pow(2, j.retries));
        j.nextRun = new Date(Date.now() + backoffMs).toISOString();
        j.status = 'pending';
      }
    }
  }
  write(jobs);
}

export function listQueue() {
  return read();
}

export function requeueJob(id: string) {
  const jobs = read();
  for (const j of jobs) {
    if (j.id === id) {
      j.status = 'pending';
      j.retries = 0;
      j.nextRun = new Date().toISOString();
      j.lastError = null;
    }
  }
  write(jobs);
}

export function cancelJob(id: string) {
  const jobs = read();
  for (const j of jobs) {
    if (j.id === id) {
      j.status = 'cancelled';
      j.finishedAt = new Date().toISOString();
    }
  }
  write(jobs);
}

export function deleteJobEntry(id: string) {
  const jobs = read();
  const filtered = jobs.filter((j: any) => j.id !== id);
  write(filtered);
}
