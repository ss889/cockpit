const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function main() {
  const payload = {
    type: 'analyze',
    payload: { jd: 'smoke test job description' },
    delayMinutes: 2,
  };

  const enqueueResponse = await fetch(`${baseUrl}/api/jobs/defer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const enqueueBody = await enqueueResponse.json().catch(() => ({}));
  if (!enqueueResponse.ok) {
    throw new Error(`enqueue failed: ${enqueueResponse.status} ${JSON.stringify(enqueueBody)}`);
  }

  const job = enqueueBody.job;
  if (!job?.id) {
    throw new Error(`enqueue response missing job id: ${JSON.stringify(enqueueBody)}`);
  }
  if (job.status !== 'pending') {
    throw new Error(`expected pending job, got ${job.status}`);
  }
  if (!job.nextRun || Number.isNaN(Date.parse(job.nextRun))) {
    throw new Error(`expected a valid nextRun, got ${job.nextRun}`);
  }

  const queueResponse = await fetch(`${baseUrl}/api/jobs/queue`);
  const queueBody = await queueResponse.json().catch(() => ({}));
  if (!queueResponse.ok) {
    throw new Error(`queue fetch failed: ${queueResponse.status} ${JSON.stringify(queueBody)}`);
  }

  const queuedJob = Array.isArray(queueBody.jobs)
    ? queueBody.jobs.find((item) => item.id === job.id)
    : null;

  if (!queuedJob) {
    throw new Error(`queued job ${job.id} not found in /api/jobs/queue response`);
  }
  if (queuedJob.status !== 'pending') {
    throw new Error(`expected queued job to remain pending, got ${queuedJob.status}`);
  }
  if (new Date(queuedJob.nextRun).getTime() <= Date.now()) {
    throw new Error(`expected deferred nextRun in the future, got ${queuedJob.nextRun}`);
  }

  console.log(JSON.stringify({ ok: true, jobId: job.id, nextRun: queuedJob.nextRun }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});