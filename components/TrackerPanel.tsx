'use client';

import { useState, useEffect } from 'react';

interface TrackedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  link: string;
  status: 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';
  savedAt: string;
}

export default function TrackerPanel() {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('tracked_jobs');
    if (saved) {
      setJobs(JSON.parse(saved));
    }
  }, []);

  const updateStatus = (id: string, status: TrackedJob['status']) => {
    const updated = jobs.map((job) =>
      job.id === id ? { ...job, status } : job
    );
    setJobs(updated);
    localStorage.setItem('tracked_jobs', JSON.stringify(updated));
  };

  const removeJob = (id: string) => {
    const updated = jobs.filter((job) => job.id !== id);
    setJobs(updated);
    localStorage.setItem('tracked_jobs', JSON.stringify(updated));
  };

  const statusOptions: TrackedJob['status'][] = [
    'Saved',
    'Applied',
    'Interview',
    'Offer',
    'Rejected',
  ];

  if (!mounted) return null;

  return (
    <div className="tracker-panel">
      <div className="tracker-panel-header">
        <h2>Saved Jobs</h2>
        <p>Track your applications</p>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          No saved jobs yet. Search for roles and save them here.
        </div>
      ) : (
        <div className="tracked-jobs-list">
          {jobs.map((job) => (
            <div key={job.id} className="tracked-job-card">
              <div className="tracked-job-info">
                <h3 className="tracked-job-title">{job.title}</h3>
                <p className="tracked-job-company">{job.company}</p>
                <p className="tracked-job-location">{job.location}</p>
              </div>

              <div className="tracked-job-controls">
                <select
                  value={job.status}
                  onChange={(e) =>
                    updateStatus(job.id, e.target.value as TrackedJob['status'])
                  }
                  className="status-dropdown"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <a
                  href={job.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tracked-job-link"
                >
                  View →
                </a>

                <button
                  onClick={() => removeJob(job.id)}
                  className="tracked-job-remove"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
