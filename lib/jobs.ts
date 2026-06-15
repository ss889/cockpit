import fs from 'fs';
import path from 'path';
import { getDataDir } from './dataDir';

const DATA_DIR = getDataDir();
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, JSON.stringify({}));
}

function read() {
  try {
    ensure();
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8') || '{}');
  } catch (e) {
    return {};
  }
}

function write(obj: any) {
  ensure();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(obj, null, 2));
}

export function startJob(name: string) {
  const jobs = read();
  jobs[name] = { inProgress: true, startedAt: new Date().toISOString(), finishedAt: null }; 
  write(jobs);
}

export function finishJob(name: string) {
  const jobs = read();
  jobs[name] = { ...(jobs[name] || {}), inProgress: false, finishedAt: new Date().toISOString() };
  write(jobs);
}

export function getJob(name: string) {
  const jobs = read();
  return jobs[name] || { inProgress: false, startedAt: null, finishedAt: null };
}

export function listJobs() {
  return read();
}

export function saveJobResult(id: string, result: any) {
  const jobs = read();
  jobs[id] = { ...(jobs[id] || {}), result, updatedAt: new Date().toISOString() };
  write(jobs);
}

export function getJobResult(id: string) {
  const jobs = read();
  return jobs[id]?.result ?? null;
}

export function listResults() {
  const jobs = read();
  const out: Record<string, any> = {};
  for (const k of Object.keys(jobs)) {
    if (jobs[k] && jobs[k].result) out[k] = jobs[k].result;
  }
  return out;
}

export function deleteJobResult(id: string) {
  const jobs = read();
  if (jobs[id]) {
    delete jobs[id];
    write(jobs);
    return true;
  }
  return false;
}
