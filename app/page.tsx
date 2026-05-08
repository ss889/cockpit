'use client';

import { useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import JDInput from '@/components/JDInput';
import AnalysisPanel from '@/components/AnalysisPanel';
import ChatPanel from '@/components/ChatPanel';
import SearchPanel from '@/components/SearchPanel';
import TrackerPanel from '@/components/TrackerPanel';
import { parseToolResults } from '@/lib/tools';
import { AnalysisResult, Message } from '@/types';

interface JobResult {
  title: string;
  company: string;
  location: string;
  description: string;
  link: string;
}

interface TrackedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  link: string;
  status: string;
  savedAt: string;
}

export default function Home() {
  const [activePanel, setActivePanel] = useState<'analyze' | 'search' | 'tracker'>('analyze');

  // Analyze panel state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jd, setJd] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Tracker panel state
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);

  const handleAnalyze = useCallback(async (jobDescription: string) => {
    setJd(jobDescription);
    setAnalysis(null);
    setError(null);
    setChatHistory([]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: jobDescription }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze job description');
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }

      const result = parseToolResults(data.content);
      setAnalysis(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Analyze error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSaveRole = useCallback(
    (title: string) => {
      if (!jd) return;
      alert(`Role "${title}" saved successfully!`);
    },
    [jd]
  );

  const handleSendChatMessage = useCallback(
    async (question: string): Promise<string> => {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jd,
            history: chatHistory,
            question,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        return typeof data.content === 'string'
          ? data.content
          : data.content[0]?.text || 'No response';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        console.error('Chat error:', err);
        throw new Error(message);
      }
    },
    [jd, chatHistory]
  );

  const handleSaveJob = useCallback((job: JobResult) => {
    const newJob: TrackedJob = {
      id: crypto.randomUUID(),
      ...job,
      status: 'Saved',
      savedAt: new Date().toISOString(),
    };

    const saved = localStorage.getItem('tracked_jobs');
    const existing = saved ? JSON.parse(saved) : [];
    const updated = [...existing, newJob];
    localStorage.setItem('tracked_jobs', JSON.stringify(updated));
    setTrackedJobs(updated);

    alert(`${job.title} at ${job.company} saved to tracker!`);
  }, []);

  return (
    <div className="cockpit-layout">
      <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

      <main className="cockpit-main">
        {/* Analyze Panel */}
        {activePanel === 'analyze' && (
          <div className="panel analyze-panel">
            <div className="panel-content">
              <div className="panel-left">
                <JDInput
                  onAnalyze={handleAnalyze}
                  isLoading={isLoading}
                  onSavedRoleClick={handleAnalyze}
                />
              </div>
              <div className="panel-right">
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
                <AnalysisPanel
                  analysis={analysis}
                  isLoading={isLoading}
                  onSave={handleSaveRole}
                />
                {analysis && (
                  <ChatPanel
                    isEnabled={!!analysis && !isLoading}
                    jd={jd}
                    onSendMessage={handleSendChatMessage}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Panel */}
        {activePanel === 'search' && (
          <div className="panel search-panel-wrapper">
            <SearchPanel onSaveJob={handleSaveJob} />
          </div>
        )}

        {/* Tracker Panel */}
        {activePanel === 'tracker' && (
          <div className="panel tracker-panel-wrapper">
            <TrackerPanel />
          </div>
        )}
      </main>
    </div>
  );
}
