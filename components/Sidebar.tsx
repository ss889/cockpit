'use client';

import { useCallback, useEffect, useState } from 'react';

interface SidebarProps {
  activePanel: 'analyze' | 'search' | 'tracker';
  onPanelChange: (panel: 'analyze' | 'search' | 'tracker') => void;
}

export default function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  const panels = [
    { id: 'analyze', label: 'Analyze', icon: '📋' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'tracker', label: 'Tracker', icon: '💾' },
  ] as const;

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1>Career Cockpit</h1>
        <p>AI Operator</p>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {panels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => onPanelChange(panel.id)}
            className={`sidebar-nav-button ${activePanel === panel.id ? 'active' : ''}`}
          >
            <span className="sidebar-nav-icon">{panel.icon}</span>
            <span>{panel.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <a
          href="https://github.com/ss889"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-github-link"
          title="GitHub"
        >
          <span style={{ fontSize: '1.2rem' }}>🔗</span>
        </a>

        {/* Prompt editor collapsible */}
        <div style={{ marginTop: '1rem' }}>
          <PromptEditor />
          <div style={{ marginTop: '0.75rem' }}>
            <QueueMonitor />
          </div>
        </div>
      </div>
    </aside>
  );
}

function PromptEditor() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');

  useEffect(() => {
    if (!open) return;
    fetch('/api/prompt')
      .then((r) => r.json())
      .then((d) => setPrompt(d.prompt || ''))
      .catch(() => setPrompt(''));
  }, [open]);

  const save = async () => {
    setStatus('saving');
    try {
      await fetch('/api/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  };

  const reset = async () => {
    setStatus('saving');
    try {
      await fetch('/api/prompt', { method: 'DELETE' });
      const res = await fetch('/api/prompt');
      const d = await res.json();
      setPrompt(d.prompt || '');
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="prompt-editor">
      <button onClick={() => setOpen((v) => !v)} className="prompt-header"><span>System Prompt</span> {open ? '▾' : '▸'}</button>
      {open && (
        <div style={{ marginTop: '0.5rem' }}>
          <textarea
            rows={8}
            style={{ width: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={save} className="btn">Save</button>
            <button onClick={reset} className="btn">Reset</button>
            {status === 'saved' && <span style={{ color: 'green' }}>Saved ✓</span>}
            {status === 'saving' && <span>Saving...</span>}
            {status === 'error' && <span style={{ color: 'red' }}>Error</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function QueueMonitor() {
  const [open, setOpen] = useState(false);
  type QueueStats = { total: number; pending: number; deferred: number; running: number; failed: number; };
  type QueueItem = { id: string; type: string; status: string; retries?: number; nextRun?: string | null; };
  type QueuePayload = { stats: QueueStats; jobs: QueueItem[] };

  type ResultPreview = { error?: string; text?: string; [key: string]: unknown };
  const [data, setData] = useState<QueuePayload | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs/queue');
      const j = await res.json();
      setData(j);
      // also fetch results for quick preview
      try {
        const rres = await fetch('/api/jobs/results');
        if (rres.ok) {
          const body = await rres.json();
          const map: Record<string, ResultPreview> = {};
          for (const item of body.results || []) map[item.id] = item.result as ResultPreview;
          setResults(map);
        }
      } catch {
        // ignore
      }
    } catch {
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchQueue();
    const id = setInterval(fetchQueue, 5000);
    return () => clearInterval(id);
  }, [fetchQueue, open]);

  const requeue = async (id: string) => {
    await fetch('/api/jobs/requeue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchQueue();
  };

  const cancel = async (id: string) => {
    await fetch('/api/jobs/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchQueue();
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Delete job and result? This cannot be undone.')) return;
    try {
      await fetch('/api/jobs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    } catch {
      // ignore
    }
    fetchQueue();
  };

  const [results, setResults] = useState<Record<string, ResultPreview>>({});
  const viewResult = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/result?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        setResults((s) => ({ ...s, [id]: { error: 'not found' } }));
        return;
      }
      const j = await res.json();
      setResults((s) => ({ ...s, [id]: j.result }));
    } catch (e) {
      setResults((s) => ({ ...s, [id]: { error: String(e) } }));
    }
  };

  return (
    <div className="queue-monitor">
      <button onClick={() => setOpen((v) => !v)} className="prompt-header"><span>Queue</span> {open ? '▾' : '▸'}</button>
      {open && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          {loading && <div>Loading...</div>}
          {!data && !loading && <div>No data</div>}
          {data && (
            <div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Stats:</strong> total {data.stats.total} • pending {data.stats.pending} • deferred {data.stats.deferred} • running {data.stats.running} • failed {data.stats.failed}
              </div>
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {data.jobs.map((j: QueueItem) => (
                  <div key={j.id} style={{ padding: '0.25rem 0', borderBottom: '1px solid #eee' }}>
                    <div><strong>{j.type}</strong> — {j.status} {j.retries ? `(${j.retries})` : ''}</div>
                    <div style={{ fontSize: '0.75rem' }}>{j.id}</div>
                    {j.status === 'pending' && j.nextRun && new Date(j.nextRun).getTime() > Date.now() && (
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>
                        Scheduled for {new Date(j.nextRun).toLocaleString()}
                      </div>
                    )}
                    <div style={{ marginTop: '0.25rem' }}>
                      <button onClick={() => requeue(j.id)} className="btn" style={{ marginRight: 6 }}>Requeue</button>
                      <button onClick={() => cancel(j.id)} className="btn" style={{ marginRight: 6 }}>Cancel</button>
                      <button onClick={() => viewResult(j.id)} className="btn">View</button>
                      <button onClick={() => deleteJob(j.id)} className="btn" style={{ marginLeft: 6 }}>Delete</button>
                    </div>
                    {results[j.id] && (() => {
                      const result = results[j.id];
                      return (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', background: '#fafafa', padding: 8 }}>
                          {result.error && <div style={{ color: 'red' }}>{result.error}</div>}
                          {typeof result.text === 'string' && (
                            <div>
                              {result.text.slice(0, 600)}{result.text.length > 600 ? '…' : ''}
                            </div>
                          )}
                          {typeof result.text !== 'string' && !result.error && (
                            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
