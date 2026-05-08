'use client';

import { useState } from 'react';

interface JobResult {
  title: string;
  company: string;
  location: string;
  description: string;
  link: string;
}

interface SearchPanelProps {
  onSaveJob: (job: JobResult) => void;
}

export default function SearchPanel({ onSaveJob }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JobResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResults(data.jobs || []);
      }
    } catch (err) {
      setError('Search failed. Try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <h2>Job Search</h2>
        <p>Find real listings across the web</p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. AI engineer jobs NYC"
            className="search-input"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="search-button"
          >
            {isLoading ? (
              <>
                <span className="animate-spin inline-block">⟳</span>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <span>🔍</span>
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="search-results">
        {results.length === 0 && !isLoading && !error && (
          <div className="empty-state">
            Search for a role to see listings
          </div>
        )}

        {results.map((job, idx) => (
          <div key={idx} className="job-card">
            <div className="job-card-header">
              <div>
                <h3 className="job-title">{job.title}</h3>
                <p className="job-company">{job.company}</p>
                <p className="job-location">{job.location}</p>
              </div>
            </div>
            <p className="job-description">{job.description}</p>
            <div className="job-card-actions">
              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="job-link"
              >
                View Job →
              </a>
              <button
                onClick={() => onSaveJob(job)}
                className="job-save-button"
              >
                + Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
