'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/types';
import type { QAIssue, ResumeProfile } from '@/types/profile';
import { renderResumeLatex } from '@/lib/renderLatex';
import { Plus, Moon, Sun, User, ClipboardList, X, FileText } from 'lucide-react';
import Link from 'next/link';
import QuickCopyPanel from '@/components/QuickCopyPanel';

// Convert URLs and markdown links in message text to clickable HTML
function renderMessageContent(text: string): string {
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Convert markdown-style links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, 
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>');
  
  // Convert remaining raw URLs to clickable links
  html = html.replace(
    /(?<!")(https?:\/\/[^\s<]+)/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
  );
  
  // Convert newlines to <br> for proper formatting
  html = html.replace(/\n/g, '<br>');
  
  // Convert **bold** to <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  return html;
}

export default function CockpitChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jd, setJd] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [quickCopyOpen, setQuickCopyOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [baseResumeLatex, setBaseResumeLatex] = useState('');
  const [tailorJd, setTailorJd] = useState('');
  const [tailorStatus, setTailorStatus] = useState<'idle' | 'ingesting' | 'tailoring' | 'ready' | 'error'>('idle');
  const [tailorMessage, setTailorMessage] = useState('');
  const [tailoredLatex, setTailoredLatex] = useState('');
  const [tailorKeywords, setTailorKeywords] = useState<string[]>([]);
  const [qaReport, setQaReport] = useState<{ before: QAIssue[]; after: QAIssue[]; autoFixed: boolean } | null>(null);
  const [currentDraftProfile, setCurrentDraftProfile] = useState<ResumeProfile | null>(null);
  const [refineMessages, setRefineMessages] = useState<Message[]>([]);
  const [refineInput, setRefineInput] = useState('');
  const [refineIssues, setRefineIssues] = useState<QAIssue[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [baseResumeProfile, setBaseResumeProfile] = useState<ResumeProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem('jobops_base_resume_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) throw new Error('Failed to parse PDF');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setAttachedFile({ name: file.name, content: data.text });
      } else if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setAttachedFile({ name: file.name, content: text });
        };
        reader.readAsText(file);
      } else {
        alert('Currently only text files and PDFs are supported.');
      }
    } catch (err) {
      alert('Error uploading file: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() && !attachedFile) return;

    // Build the visible message (what the user sees in chat)
    const visibleContent = attachedFile 
      ? `📎 ${attachedFile.name}${input.trim() ? '\n' + input : ''}`
      : input;

    // Build the full content sent to the AI (includes file text)
    const fullContent = attachedFile
      ? `[Attached file: ${attachedFile.name}]\n\n${attachedFile.content}${input.trim() ? '\n\n' + input : ''}`
      : input;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: visibleContent,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      let endpoint = '/api/chat';
      let requestBody:
        | { messages: Message[]; userMessage: string }
        | { jd: string; history: Message[]; question: string } = {
        messages: messages,
        userMessage: fullContent,
      };

      // Use the specialized analyze endpoint if they specifically ask to analyze or if we have a JD context
      if (fullContent.toLowerCase().includes('analyze') || (jd && fullContent.length > 50)) {
        endpoint = '/api/analyze';
        requestBody = {
          jd: jd || fullContent,
          history: messages,
          question: fullContent,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to get response';
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          // ignore parse error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text || (typeof data.content === 'string' ? data.content : 'No response generated'),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Store job descriptions for analysis
      if (fullContent.toLowerCase().includes('analyze') && fullContent.length > 50) {
        setJd(fullContent);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'An error occurred'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngestResume = async () => {
    if (!baseResumeLatex.trim()) return;
    setTailorStatus('ingesting');
    setTailorMessage('');

    try {
      const response = await fetch('/api/profile/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: baseResumeLatex }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to ingest resume');

      setTailorStatus('idle');
      setBaseResumeProfile(data.profile);
      window.localStorage.setItem('jobops_base_resume_profile', JSON.stringify(data.profile));
      setTailorMessage(
        `Base profile saved: ${data.counts.projects} projects, ${data.counts.projectBullets} project bullets, ${data.counts.experience} experience entries, ${data.counts.experienceBullets} experience bullets.`
      );
    } catch (error) {
      setTailorStatus('error');
      setTailorMessage(error instanceof Error ? error.message : 'Failed to ingest resume');
    }
  };

  const handleTailorResume = async () => {
    if (!tailorJd.trim()) return;
    setTailorStatus('tailoring');
    setTailorMessage('');
    setTailoredLatex('');
    setQaReport(null);
    setTailorKeywords([]);

    try {
      const response = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: tailorJd, profile: baseResumeProfile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to tailor resume');

      setTailoredLatex(data.latex);
      setTailorKeywords(data.keywords || []);
      setQaReport(data.qa);
      setCurrentDraftProfile(data.profile);
      setRefineMessages([]);
      setRefineIssues(data.qa?.after || []);
      setTailorStatus('ready');
      setTailorMessage(
        `Tailored resume ready. QA issues before revision: ${data.qa.before.length}. QA issues after revision: ${data.qa.after.length}.`
      );

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Tailored resume ready.\n\nKeywords detected: ${(data.keywords || []).slice(0, 10).join(', ') || 'None'}\n\nQA after auto-fix: ${data.qa.after.length} issue(s). Use the Tailor Resume panel to download the .tex file.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setTailorStatus('error');
      setTailorMessage(error instanceof Error ? error.message : 'Failed to tailor resume');
    }
  };

  const downloadTailoredLatex = () => {
    const latestLatex = currentDraftProfile ? renderResumeLatex(currentDraftProfile) : tailoredLatex;
    if (!latestLatex) return;
    const blob = new Blob([latestLatex], { type: 'application/x-tex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tailored-resume.tex';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleRefineResume = async () => {
    if (!refineInput.trim() || !currentDraftProfile) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: refineInput,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...refineMessages, userMessage];
    setRefineMessages(nextHistory);
    setRefineInput('');
    setIsRefining(true);

    try {
      const response = await fetch('/api/tailor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftProfile: currentDraftProfile,
          jd: tailorJd,
          keywords: tailorKeywords,
          history: refineMessages,
          message: userMessage.content,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to refine resume');

      setCurrentDraftProfile(data.updatedProfile);
      setTailoredLatex(renderResumeLatex(data.updatedProfile));
      setRefineIssues(data.newIssues || []);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.explanation || 'I made a targeted edit.',
        timestamp: new Date().toISOString(),
      };
      setRefineMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Could not refine the draft'}`,
        timestamp: new Date().toISOString(),
      };
      setRefineMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="cockpit-chat">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-branding">
          <h1>JobOps AI</h1>
          <p>Agentic intelligence for career navigation and analysis</p>
        </div>
        <div className="header-actions">
          <Link href="/profile" className="header-link" title="Edit Profile">
            <User size={20} />
          </Link>
          <button onClick={() => setQuickCopyOpen(true)} className="header-link" title="Quick Apply Info">
            <ClipboardList size={20} />
          </button>
          <button onClick={() => setTailorOpen((open) => !open)} className="header-link" title="Tailor Resume">
            <FileText size={20} />
          </button>
          <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="chat-container">
        {tailorOpen && (
          <section className="tailor-panel" aria-label="Tailor resume">
            <div className="tailor-panel-header">
              <div>
                <h2>Tailor Resume</h2>
                <p>Set your base LaTeX resume once, then generate a job-specific .tex draft.</p>
              </div>
              <button className="tailor-close" onClick={() => setTailorOpen(false)} title="Close Tailor Resume">
                <X size={16} />
              </button>
            </div>

            <div className="tailor-grid">
              <label className="tailor-field">
                <span>Base resume .tex</span>
                <textarea
                  value={baseResumeLatex}
                  onChange={(event) => setBaseResumeLatex(event.target.value)}
                  placeholder="Paste your current LaTeX resume source here..."
                  rows={7}
                />
              </label>
              <label className="tailor-field">
                <span>Target job description</span>
                <textarea
                  value={tailorJd}
                  onChange={(event) => setTailorJd(event.target.value)}
                  placeholder="Paste the job description you want to tailor toward..."
                  rows={7}
                />
              </label>
            </div>

            <div className="tailor-actions">
              <button onClick={handleIngestResume} disabled={tailorStatus === 'ingesting' || !baseResumeLatex.trim()}>
                {tailorStatus === 'ingesting' ? 'Saving...' : 'Set as Base Profile'}
              </button>
              <button onClick={handleTailorResume} disabled={tailorStatus === 'tailoring' || !tailorJd.trim()}>
                {tailorStatus === 'tailoring' ? 'Tailoring...' : 'Tailor Resume'}
              </button>
              <button onClick={downloadTailoredLatex} disabled={!tailoredLatex}>
                Download .tex
              </button>
            </div>

            {tailorMessage && (
              <div className={`tailor-status ${tailorStatus === 'error' ? 'error' : ''}`}>
                {tailorMessage}
              </div>
            )}

            {(qaReport || tailorKeywords.length > 0) && (
              <div className="tailor-results">
                {tailorKeywords.length > 0 && (
                  <p><strong>Keywords:</strong> {tailorKeywords.join(', ')}</p>
                )}
                {qaReport && (
                  <p>
                    <strong>QA:</strong> {qaReport.before.length} issue(s) before revision, {qaReport.after.length} after revision.
                    {qaReport.after.length > 0 ? ` Remaining: ${qaReport.after.map((issue) => issue.type).join(', ')}` : ' Clean after deterministic checks.'}
                  </p>
                )}
              </div>
            )}

            {currentDraftProfile && (
              <div className="resume-preview">
                <h3>Current Draft</h3>
                {currentDraftProfile.projects.length > 0 && (
                  <div>
                    <h4>Projects</h4>
                    {currentDraftProfile.projects.map((project) => (
                      <div key={project.id} className="resume-preview-entry">
                        <strong>{project.title}</strong>
                        <ul>
                          {project.bullets.map((bullet, index) => {
                            const location = `project:${project.id}:${index}`;
                            const issues = refineIssues.filter((issue) => issue.location === location || issue.location === 'global');
                            return (
                              <li key={location}>
                                {bullet}
                                {issues.length > 0 && (
                                  <span className="resume-preview-warning">
                                    QA: {issues.map((issue) => issue.type).join(', ')}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                {currentDraftProfile.experience.length > 0 && (
                  <div>
                    <h4>Experience</h4>
                    {currentDraftProfile.experience.map((experience) => (
                      <div key={experience.id} className="resume-preview-entry">
                        <strong>{experience.title} - {experience.company}</strong>
                        <ul>
                          {experience.bullets.map((bullet, index) => {
                            const location = `experience:${experience.id}:${index}`;
                            const issues = refineIssues.filter((issue) => issue.location === location || issue.location === 'global');
                            return (
                              <li key={location}>
                                {bullet}
                                {issues.length > 0 && (
                                  <span className="resume-preview-warning">
                                    QA: {issues.map((issue) => issue.type).join(', ')}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentDraftProfile && (
              <div className="refine-panel">
                <h3>Refine</h3>
                <div className="refine-thread">
                  {refineMessages.length === 0 ? (
                    <p className="refine-empty">Ask for a targeted change, like “make the second JobOps bullet punchier.”</p>
                  ) : (
                    refineMessages.map((message) => (
                      <div key={message.id} className={`refine-message ${message.role}`}>
                        {message.content}
                      </div>
                    ))
                  )}
                </div>
                <div className="refine-input-row">
                  <input
                    value={refineInput}
                    onChange={(event) => setRefineInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleRefineResume()}
                    placeholder="e.g. make the second project bullet punchier"
                    disabled={isRefining}
                  />
                  <button onClick={handleRefineResume} disabled={isRefining || !refineInput.trim()}>
                    {isRefining ? 'Editing...' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Welcome State */}
        {messages.length === 0 ? (
          <div className="welcome-state">
            <h2>What can I help you with?</h2>
            <p>Ask career questions, tailor your resume, analyze job descriptions, search for roles, or track your applications.</p>
            <div className="example-prompts">
              <button
                onClick={() => setTailorOpen(true)}
                className="example-prompt"
              >
                Tailor my resume
              </button>
              <button
                onClick={() => setInput('Analyze this job description: [paste job description]')}
                className="example-prompt"
              >
                📋 Analyze a job description
              </button>
              <button
                onClick={() => setInput('Search for AI engineer roles in SF')}
                className="example-prompt"
              >
                🔍 Search for jobs
              </button>
              <button
                onClick={() => setInput('Show me my tracked jobs')}
                className="example-prompt"
              >
                💾 View saved jobs
              </button>
              <button
                onClick={() => setInput('What skills should I focus on for ML engineering?')}
                className="example-prompt"
              >
                🎯 Career advice
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content" dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.content) }} />
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <span className="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        {attachedFile && (
          <div className="file-badge">
            <span className="file-badge-name">📎 {attachedFile.name}</span>
            <button 
              className="file-badge-remove" 
              onClick={() => setAttachedFile(null)}
              title="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="input-wrapper">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            accept=".txt,.md,.json,.csv,.pdf"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="attach-button"
            title="Attach a text file"
            disabled={isLoading}
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Tell me what you want to analyze, search, or track..."
            className="chat-input"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || (!input.trim() && !attachedFile)}
            className="send-button"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        <p className="input-hint">Paste job descriptions, ask about roles, or discuss your career path</p>
      </div>

      <QuickCopyPanel
        isOpen={quickCopyOpen}
        onClose={() => setQuickCopyOpen(false)}
      />
    </div>
  );
}
