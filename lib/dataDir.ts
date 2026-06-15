import os from 'os';
import path from 'path';

export function getDataDir() {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'ai-career-cockpit-data');
  }

  return path.join(process.cwd(), 'data');
}
