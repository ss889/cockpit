'use client';

import { useState, useCallback, useEffect } from 'react';

interface JDInputProps {
  onAnalyze: (jd: string) => Promise<void>;
  isLoading: boolean;
  onSavedRoleClick: (jd: string) => void;
}

const JDInput: React.FC<JDInputProps> = ({ onAnalyze, isLoading, onSavedRoleClick }) => {
  const [jd, setJd] = useState('');
  const [savedRoles, setSavedRoles] = useState<Array<{ id: string; title: string; jd: string; savedAt: string }>>([]);
  const [delayMinutes, setDelayMinutes] = useState('15');

  // Load saved roles on mount
  useEffect(() => {
    const saved = localStorage.getItem('saved_roles');
    if (saved) {
      setSavedRoles(JSON.parse(saved));
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    await onAnalyze(jd);
  }, [jd, onAnalyze]);

  const [enqueueing, setEnqueueing] = useState(false);
  const [queuedJob, setQueuedJob] = useState<string | null>(null);
  const [queuedResult, setQueuedResult] = useState<any>(null);

  const handleEnqueue = useCallback(async () => {
    setEnqueueing(true);
    try {
      const res = await fetch('/api/jobs/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jd }) });
      const j = await res.json();
      const id = j.job?.id || null;
      setQueuedJob(id);
      setQueuedResult(null);
      if (id) {
        // poll for result
        const poll = setInterval(async () => {
          const r = await fetch(`/api/jobs/result?id=${encodeURIComponent(id)}`);
          if (r.ok) {
            const body = await r.json();
            setQueuedResult(body.result);
            clearInterval(poll);
          }
        }, 3000);
      }
    } catch (e) {
      console.error('Enqueue failed', e);
    } finally {
      setEnqueueing(false);
    }
  }, [jd]);

  const handleSchedule = useCallback(async () => {
    setEnqueueing(true);
    try {
      const minutes = Math.max(1, Number(delayMinutes) || 0);
      const res = await fetch('/api/jobs/defer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analyze',
          payload: { jd },
          delayMinutes: minutes,
          maxRetries: 2,
        }),
      });
      const j = await res.json();
      const id = j.job?.id || null;
      setQueuedJob(id);
      setQueuedResult(null);
      if (id) {
        const poll = setInterval(async () => {
          const r = await fetch(`/api/jobs/result?id=${encodeURIComponent(id)}`);
          if (r.ok) {
            const body = await r.json();
            setQueuedResult(body.result);
            clearInterval(poll);
          }
        }, 3000);
      }
    } catch (e) {
      console.error('Schedule failed', e);
    } finally {
      setEnqueueing(false);
    }
  }, [jd, delayMinutes]);

  const handleSaveRole = useCallback((title: string) => {
    const newRole = {
      id: crypto.randomUUID(),
      title,
      jd,
      savedAt: new Date().toISOString(),
    };
    const updated = [...savedRoles, newRole];
    setSavedRoles(updated);
    localStorage.setItem('saved_roles', JSON.stringify(updated));
  }, [jd, savedRoles]);

  const handleDeleteRole = useCallback((id: string) => {
    const updated = savedRoles.filter(role => role.id !== id);
    setSavedRoles(updated);
    localStorage.setItem('saved_roles', JSON.stringify(updated));
  }, [savedRoles]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">
          Career Intelligence Cockpit
        </h1>
        <p className="text-sm text-zinc-400">
          Analyze any job description against your profile
        </p>
      </div>

      {/* Input Area */}
      <div className="flex-1 flex flex-col gap-4 py-6">
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wide">
            Job Description
          </label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste a job description here..."
            className="w-full h-48 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !jd.trim()}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Role'}
          </button>
          <button
            onClick={handleEnqueue}
            disabled={enqueueing || !jd.trim()}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {enqueueing ? 'Enqueuing...' : 'Enqueue Analyze'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <label htmlFor="delayMinutes" className="uppercase tracking-wide font-semibold text-zinc-300">
            Delay (min)
          </label>
          <input
            id="delayMinutes"
            type="number"
            min={1}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(e.target.value)}
            className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-100"
          />
          <button
            onClick={handleSchedule}
            disabled={enqueueing || !jd.trim()}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {enqueueing ? 'Scheduling...' : 'Schedule Analyze'}
          </button>
        </div>
        {queuedJob && (
          <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
            <div>Queued job: <strong>{queuedJob}</strong></div>
            {queuedResult ? (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontWeight: 600 }}>Result preview</div>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{queuedResult.text ? queuedResult.text.slice(0, 800) : JSON.stringify(queuedResult).slice(0, 800)}</div>
              </div>
            ) : (
              <div style={{ marginTop: 6 }} className="text-xs text-zinc-400">Waiting for worker to finish...</div>
            )}
          </div>
        )}
      </div>

      {/* Saved Roles */}
      <div className="pt-6 border-t border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-300 mb-3 uppercase tracking-wide">
          Saved Roles
        </h2>
        {savedRoles.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No saved roles yet</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between gap-2 p-2 bg-zinc-800 rounded border border-zinc-700 hover:border-zinc-600 transition-colors"
              >
                <button
                  onClick={() => {
                    setJd(role.jd);
                    onSavedRoleClick(role.jd);
                  }}
                  className="flex-1 text-left text-xs text-zinc-300 hover:text-indigo-400 truncate"
                >
                  {role.title}
                </button>
                <button
                  onClick={() => handleDeleteRole(role.id)}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JDInput;
