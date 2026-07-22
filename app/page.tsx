'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/types';
import type { QAIssue, ResumeProfile } from '@/types/profile';
import type { JobDescriptionEntry, LocalWorkspace, MemoryEntry, WorkspaceRole, WorkspaceSession } from '@/types/workspace';
import { renderInterviewPrepMarkdown } from '@/lib/interviewPrep';
import { inferJobMetadata } from '@/lib/jobMetadata';
import { renderResumeLatex } from '@/lib/renderLatex';
import { Plus, Moon, Sun, User, ClipboardList, X, FileText, Brain, LogOut, Link as LinkIcon, MessageSquareText } from 'lucide-react';
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

function loadStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveStoredValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function CockpitChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jd, setJd] = useState('');
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [quickCopyOpen, setQuickCopyOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [session, setSession] = useState<WorkspaceSession | null>(() =>
    loadStoredValue<WorkspaceSession | null>('jobops_workspace_session', null)
  );
  const [loginName, setLoginName] = useState('');
  const [loginRole, setLoginRole] = useState<WorkspaceRole>('owner');
  const [memories, setMemories] = useState<MemoryEntry[]>(() =>
    loadStoredValue<MemoryEntry[]>('jobops_memory_palace', [])
  );
  const [memoryForm, setMemoryForm] = useState({
    wing: 'career',
    room: 'resume',
    drawer: 'projects',
    title: '',
    text: '',
  });
  const [memorySearch, setMemorySearch] = useState('');
  const [jobDescriptions, setJobDescriptions] = useState<JobDescriptionEntry[]>(() =>
    loadStoredValue<JobDescriptionEntry[]>('jobops_job_descriptions', [])
  );
  const [jobForm, setJobForm] = useState({ title: '', company: '', url: '', text: '' });
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingJobForm, setEditingJobForm] = useState({ title: '', company: '', url: '', text: '' });
  const [jobLibraryStatus, setJobLibraryStatus] = useState('');
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
  const initialWorkspaceRef = useRef<Partial<LocalWorkspace>>({
    session,
    memories,
    jobDescriptions,
    baseResumeProfile,
  });
  const canEditWorkspace = session?.role === 'owner' || session?.role === 'editor';
  const filteredMemories = memories.filter((memory) => {
    const query = memorySearch.trim().toLowerCase();
    if (!query) return true;
    return `${memory.wing} ${memory.room} ${memory.drawer} ${memory.title} ${memory.text}`.toLowerCase().includes(query);
  });

  const saveLocalWorkspace = (overrides: Partial<LocalWorkspace>) => {
    if (!workspaceHydrated) return;
    const workspace: Partial<LocalWorkspace> = {
      session,
      memories,
      jobDescriptions,
      baseResumeProfile,
      ...overrides,
    };

    fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspace),
    }).catch(() => {
      // Keep localStorage fallback available if the local server is not writable.
    });
  };

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
      } else if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.tex')) {
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

  const handleChatKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    handleSendMessage();
  };

  const handleRefineKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    handleRefineResume();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let active = true;

    async function hydrateWorkspace() {
      try {
        const response = await fetch('/api/workspace');
        const data = await response.json();
        if (!active || !response.ok || !data.workspace) return;

        const workspace = data.workspace as LocalWorkspace;
        if (!workspace.updatedAt) {
          await fetch('/api/workspace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initialWorkspaceRef.current),
          });
          return;
        }

        setSession(workspace.session ?? null);
        setMemories(workspace.memories ?? []);
        setJobDescriptions(workspace.jobDescriptions ?? []);
        setBaseResumeProfile(workspace.baseResumeProfile ?? null);
        saveStoredValue('jobops_workspace_session', workspace.session ?? null);
        saveStoredValue('jobops_memory_palace', workspace.memories ?? []);
        saveStoredValue('jobops_job_descriptions', workspace.jobDescriptions ?? []);
        if (workspace.baseResumeProfile) {
          saveStoredValue('jobops_base_resume_profile', workspace.baseResumeProfile);
        }
      } catch {
        // Browser localStorage remains the fallback for deployed or read-only environments.
      } finally {
        if (active) setWorkspaceHydrated(true);
      }
    }

    hydrateWorkspace();
    return () => {
      active = false;
    };
  }, []);

  const appendAssistantMessage = (content: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const signInWorkspace = () => {
    if (!loginName.trim()) return;
    const nextSession: WorkspaceSession = {
      name: loginName.trim(),
      role: loginRole,
      signedInAt: new Date().toISOString(),
    };
    setSession(nextSession);
    saveStoredValue('jobops_workspace_session', nextSession);
    saveLocalWorkspace({ session: nextSession });
    setLoginName('');
  };

  const signOutWorkspace = () => {
    setSession(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('jobops_workspace_session');
    }
    saveLocalWorkspace({ session: null });
  };

  const persistMemories = (nextMemories: MemoryEntry[]) => {
    setMemories(nextMemories);
    saveStoredValue('jobops_memory_palace', nextMemories);
    saveLocalWorkspace({ memories: nextMemories });
  };

  const updateJobDescriptions = (updater: (jobs: JobDescriptionEntry[]) => JobDescriptionEntry[]) => {
    setJobDescriptions((currentJobs) => {
      const nextJobs = updater(currentJobs);
      saveStoredValue('jobops_job_descriptions', nextJobs);
      saveLocalWorkspace({ jobDescriptions: nextJobs });
      return nextJobs;
    });
  };

  const addMemory = () => {
    if (!canEditWorkspace || !memoryForm.title.trim() || !memoryForm.text.trim()) return;
    const nextMemory: MemoryEntry = {
      id: newId('memory'),
      wing: memoryForm.wing.trim() || 'career',
      room: memoryForm.room.trim() || 'general',
      drawer: memoryForm.drawer.trim() || 'notes',
      title: memoryForm.title.trim(),
      text: memoryForm.text.trim(),
      createdAt: new Date().toISOString(),
    };
    persistMemories([nextMemory, ...memories]);
    setMemoryForm((form) => ({ ...form, title: '', text: '' }));
  };

  const deleteMemory = (id: string) => {
    if (!canEditWorkspace) return;
    persistMemories(memories.filter((memory) => memory.id !== id));
  };

  const addJobMemory = (job: JobDescriptionEntry) => {
    const nextMemory: MemoryEntry = {
      id: newId('memory'),
      wing: 'career',
      room: 'job-descriptions',
      drawer: job.company || 'unknown-company',
      title: job.title,
      text: job.text.slice(0, 5000),
      createdAt: new Date().toISOString(),
    };
    persistMemories([nextMemory, ...memories]);
  };

  const saveJobDescriptionEntry = (entry: JobDescriptionEntry) => {
    updateJobDescriptions((jobs) => [entry, ...jobs.filter((job) => job.id !== entry.id)]);
    addJobMemory(entry);
  };

  const saveJobDescriptionFromForm = () => {
    if (!canEditWorkspace || !jobForm.text.trim()) return;
    const inferred = inferJobMetadata(jobForm.text, jobForm.url, jobForm.title);
    const entry: JobDescriptionEntry = {
      id: newId('jd'),
      title: jobForm.title.trim() || inferred.title,
      company: jobForm.company.trim() || inferred.company,
      url: jobForm.url.trim() || undefined,
      text: jobForm.text.trim(),
      createdAt: new Date().toISOString(),
      status: 'saved',
    };
    saveJobDescriptionEntry(entry);
    setJobForm({ title: '', company: '', url: '', text: '' });
    setJobLibraryStatus('Job description saved.');
  };

  const importJobFromUrl = async () => {
    if (!canEditWorkspace || !jobForm.url.trim()) return;
    setJobLibraryStatus('Importing job link...');
    try {
      const response = await fetch('/api/job-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobForm.url.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to import job link');
      const inferred = inferJobMetadata(data.text || '', data.url || jobForm.url, data.title || '');

      setJobForm((form) => ({
        ...form,
        title: form.title || inferred.title,
        company: form.company || inferred.company,
        url: data.url || form.url,
        text: data.text || '',
      }));
      setJobLibraryStatus('Imported job text. Review it, then save.');
    } catch (error) {
      setJobLibraryStatus(error instanceof Error ? error.message : 'Failed to import job link');
    }
  };

  const deleteJobDescription = (id: string) => {
    if (!canEditWorkspace) return;
    updateJobDescriptions((jobs) => jobs.filter((job) => job.id !== id));
    if (editingJobId === id) {
      setEditingJobId(null);
      setEditingJobForm({ title: '', company: '', url: '', text: '' });
    }
  };

  const startEditingJobDescription = (job: JobDescriptionEntry) => {
    if (!canEditWorkspace) return;
    setEditingJobId(job.id);
    setEditingJobForm({
      title: job.title,
      company: job.company,
      url: job.url || '',
      text: job.text,
    });
  };

  const cancelEditingJobDescription = () => {
    setEditingJobId(null);
    setEditingJobForm({ title: '', company: '', url: '', text: '' });
  };

  const updateEditingJobText = (text: string) => {
    setEditingJobForm((form) => {
      const inferred = inferJobMetadata(text, form.url, form.title);
      return {
        ...form,
        text,
        title: form.title || inferred.title,
        company: form.company || inferred.company,
      };
    });
  };

  const saveEditingJobDescription = (job: JobDescriptionEntry) => {
    if (!canEditWorkspace || !editingJobForm.text.trim()) return;
    const inferred = inferJobMetadata(editingJobForm.text, editingJobForm.url, editingJobForm.title);
    const nextText = editingJobForm.text.trim();
    const textChanged = nextText !== job.text;
    updateJobDescriptions((jobs) =>
      jobs.map((item) =>
        item.id === job.id
          ? {
              ...item,
              title: editingJobForm.title.trim() || inferred.title,
              company: editingJobForm.company.trim() || inferred.company,
              url: editingJobForm.url.trim() || undefined,
              text: nextText,
              tailoredLatex: textChanged ? undefined : item.tailoredLatex,
              tailoredAt: textChanged ? undefined : item.tailoredAt,
              status: textChanged ? 'saved' : item.status,
              error: textChanged ? undefined : item.error,
              interviewPrep: textChanged ? undefined : item.interviewPrep,
              prepStatus: textChanged ? 'idle' : item.prepStatus,
              prepError: textChanged ? undefined : item.prepError,
            }
          : item
      )
    );
    setEditingJobId(null);
    setEditingJobForm({ title: '', company: '', url: '', text: '' });
    setJobLibraryStatus(textChanged ? 'Job description updated. Regenerate resume and prep when ready.' : 'Job description details updated.');
  };

  const updateJobDescriptionText = (text: string) => {
    setJobForm((form) => {
      const inferred = inferJobMetadata(text, form.url, form.title);
      return {
        ...form,
        text,
        title: form.title || inferred.title,
        company: form.company || inferred.company,
      };
    });
  };

  const downloadTextFile = (filename: string, text: string, mimeType = 'application/x-tex;charset=utf-8') => {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const safeFilename = (value: string, fallback: string) => {
    const slug = value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    return slug || fallback;
  };

  const selectRelevantMemories = (query: string): MemoryEntry[] => {
    const tokens = query.toLowerCase().split(/\W+/).filter((token) => token.length > 2);
    if (tokens.length === 0) return memories.slice(0, 5);
    return memories
      .map((memory) => {
        const haystack = `${memory.wing} ${memory.room} ${memory.drawer} ${memory.title} ${memory.text}`.toLowerCase();
        const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        return { memory, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ memory }) => memory);
  };

  const ingestResumeSource = async (source: string): Promise<ResumeProfile> => {
    const response = await fetch('/api/profile/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latex: source }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to ingest resume');

    setBaseResumeProfile(data.profile);
    saveStoredValue('jobops_base_resume_profile', data.profile);
    saveLocalWorkspace({ baseResumeProfile: data.profile });
    return data.profile;
  };

  const generateTailoredResume = async (profile: ResumeProfile, jdText: string) => {
    const response = await fetch('/api/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd: jdText, profile }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to tailor resume');

    setTailoredLatex(data.latex);
    setTailorKeywords(data.keywords || []);
    setQaReport(data.qa);
    setCurrentDraftProfile(data.profile);
    setRefineMessages([]);
    setRefineIssues(data.qa?.after || []);
    setTailorJd(jdText);
    setTailorOpen(true);
    setTailorStatus('ready');
    setTailorMessage(
      `Tailored resume ready. QA issues before revision: ${data.qa.before.length}. QA issues after revision: ${data.qa.after.length}.`
    );

    return data;
  };

  const tailorSavedJob = async (job: JobDescriptionEntry) => {
    if (!canEditWorkspace) return;
    const profile = currentDraftProfile || baseResumeProfile;
    if (!profile) {
      setJobLibraryStatus('Set or attach a base resume before tailoring saved jobs.');
      return;
    }

    updateJobDescriptions((jobs) =>
      jobs.map((item) =>
        item.id === job.id ? { ...item, status: 'tailoring', error: undefined } : item
      )
    );
    setTailorOpen(true);
    setTailorStatus('tailoring');
    setTailorMessage(`Tailoring resume for ${job.title}...`);

    try {
      const data = await generateTailoredResume(profile, job.text);
      const latestLatex = renderResumeLatex(data.profile);
      updateJobDescriptions((jobs) =>
        jobs.map((item) =>
          item.id === job.id
            ? {
                ...item,
                tailoredLatex: latestLatex,
                tailoredAt: new Date().toISOString(),
                status: 'ready',
                error: undefined,
              }
            : item
        )
      );
      setJobLibraryStatus(`Tailored resume ready for ${job.title}.`);
      appendAssistantMessage(`Tailored resume ready for ${job.title}. Open Workspace to download the saved .tex file.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to tailor saved job';
      updateJobDescriptions((jobs) =>
        jobs.map((item) =>
          item.id === job.id ? { ...item, status: 'error', error: message } : item
        )
      );
      setTailorStatus('error');
      setTailorMessage(message);
      setJobLibraryStatus(message);
    }
  };

  const tailorAllSavedJobs = async () => {
    if (!canEditWorkspace) return;
    const jobsToTailor = jobDescriptions.filter((job) => job.text.trim());
    for (const job of jobsToTailor) {
      await tailorSavedJob(job);
    }
  };

  const generateInterviewPrep = async (job: JobDescriptionEntry) => {
    if (!canEditWorkspace) return;
    const profile = currentDraftProfile || baseResumeProfile;
    if (!profile) {
      setJobLibraryStatus('Set or attach a base resume before generating interview prep.');
      return;
    }

    updateJobDescriptions((jobs) =>
      jobs.map((item) =>
        item.id === job.id ? { ...item, prepStatus: 'generating', prepError: undefined } : item
      )
    );
    setJobLibraryStatus(`Generating interview prep for ${job.title}...`);

    try {
      const response = await fetch('/api/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          profile,
          memories: selectRelevantMemories(job.text),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate interview prep');

      updateJobDescriptions((jobs) =>
        jobs.map((item) =>
          item.id === job.id
            ? {
                ...item,
                interviewPrep: data.prep,
                prepStatus: 'ready',
                prepError: undefined,
              }
            : item
        )
      );
      setJobLibraryStatus(`Interview prep ready for ${job.title}.`);
      appendAssistantMessage(`Interview prep ready for ${job.title}. Open Workspace to review or download the prep kit.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate interview prep';
      updateJobDescriptions((jobs) =>
        jobs.map((item) =>
          item.id === job.id ? { ...item, prepStatus: 'error', prepError: message } : item
        )
      );
      setJobLibraryStatus(message);
    }
  };

  const downloadInterviewPrep = (job: JobDescriptionEntry) => {
    if (!job.interviewPrep) return;
    const markdown = renderInterviewPrepMarkdown(job.title, job.company, job.interviewPrep);
    downloadTextFile(
      `${safeFilename(`${job.company}-${job.title}`, 'interview-prep')}-interview-prep.md`,
      markdown,
      'text/markdown;charset=utf-8'
    );
  };

  const renderSavedJobCard = (job: JobDescriptionEntry, compact = false) => (
    <article key={job.id} className={`workspace-card ${compact ? 'workspace-card-compact' : ''}`}>
      {editingJobId === job.id ? (
        <>
          <div className="workspace-card-header">
            <strong>Edit job description</strong>
            <button onClick={cancelEditingJobDescription} title="Cancel editing">
              <X size={14} />
            </button>
          </div>
          <div className="workspace-form workspace-edit-form">
            <input
              value={editingJobForm.title}
              onChange={(event) => setEditingJobForm((form) => ({ ...form, title: event.target.value }))}
              placeholder="Job title"
              disabled={!canEditWorkspace}
            />
            <input
              value={editingJobForm.company}
              onChange={(event) => setEditingJobForm((form) => ({ ...form, company: event.target.value }))}
              placeholder="Company"
              disabled={!canEditWorkspace}
            />
            <input
              value={editingJobForm.url}
              onChange={(event) => setEditingJobForm((form) => ({ ...form, url: event.target.value }))}
              placeholder="Job link"
              disabled={!canEditWorkspace}
            />
            <textarea
              value={editingJobForm.text}
              onChange={(event) => updateEditingJobText(event.target.value)}
              placeholder="Job description"
              rows={compact ? 6 : 8}
              disabled={!canEditWorkspace}
            />
          </div>
          <div className="workspace-card-actions">
            <button onClick={() => saveEditingJobDescription(job)} disabled={!canEditWorkspace || !editingJobForm.text.trim()}>
              Save Changes
            </button>
            <button onClick={cancelEditingJobDescription}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="workspace-card-header">
            <strong>{job.title}</strong>
            {canEditWorkspace && (
              <div className="workspace-card-tools">
                <button onClick={() => startEditingJobDescription(job)} title="Edit job description">
                  Edit
                </button>
                <button onClick={() => deleteJobDescription(job.id)} title="Delete job description">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <span>{job.company}{job.status ? ` - ${job.status}` : ''}</span>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              {job.url}
            </a>
          )}
          <p>{job.text.slice(0, compact ? 220 : 360)}{job.text.length > (compact ? 220 : 360) ? '...' : ''}</p>
          {job.error && <p className="workspace-error">{job.error}</p>}
          {job.prepError && <p className="workspace-error">{job.prepError}</p>}
          <div className="workspace-card-actions">
            <button onClick={() => tailorSavedJob(job)} disabled={!canEditWorkspace || job.status === 'tailoring' || (!baseResumeProfile && !currentDraftProfile)}>
              {job.status === 'tailoring' ? 'Tailoring...' : 'Tailor'}
            </button>
            <button
              onClick={() => job.tailoredLatex && downloadTextFile(`${safeFilename(job.title, 'tailored')}-resume.tex`, job.tailoredLatex)}
              disabled={!job.tailoredLatex}
            >
              Download .tex
            </button>
            <button onClick={() => generateInterviewPrep(job)} disabled={!canEditWorkspace || job.prepStatus === 'generating' || (!baseResumeProfile && !currentDraftProfile)}>
              <MessageSquareText size={15} />
              {job.prepStatus === 'generating' ? 'Prepping...' : 'Prep'}
            </button>
            <button onClick={() => downloadInterviewPrep(job)} disabled={!job.interviewPrep}>
              Download Prep
            </button>
          </div>
          {job.interviewPrep && !compact && (
            <div className="interview-prep-preview">
              <div className="interview-prep-header">
                <strong>Interview Prep</strong>
                <span>{new Date(job.interviewPrep.generatedAt).toLocaleDateString()}</span>
              </div>
              <p>{job.interviewPrep.roleSummary}</p>
              <div className="prep-section">
                <span>Talking points</span>
                <ul>
                  {job.interviewPrep.talkingPoints.slice(0, 4).map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="prep-section">
                <span>Likely questions</span>
                <ul>
                  {job.interviewPrep.likelyScreenQuestions.slice(0, 4).map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );

  const handleChatTailorRequest = async (jdText: string, resumeSource?: string) => {
    setTailorOpen(true);
    setTailorStatus(resumeSource ? 'ingesting' : 'tailoring');
    setTailorMessage(resumeSource ? 'Reading your resume...' : 'Tailoring your saved resume...');
    setTailoredLatex('');
    setQaReport(null);
    setTailorKeywords([]);

    const profile = resumeSource
      ? await ingestResumeSource(resumeSource)
      : currentDraftProfile || baseResumeProfile;

    if (!profile) {
      throw new Error('Attach your resume or set a base resume profile before tailoring.');
    }

    setTailorStatus('tailoring');
    setTailorMessage('Generating a tailored .tex draft...');
    const data = await generateTailoredResume(profile, jdText);

    appendAssistantMessage(
      `Tailored resume ready.\n\nKeywords detected: ${(data.keywords || []).slice(0, 10).join(', ') || 'None'}\n\nQA after auto-fix: ${data.qa.after.length} issue(s). Open the Tailor Resume panel to review, refine, or download the .tex file.`
    );
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !attachedFile) return;

    // Build the visible message (what the user sees in chat)
    const visibleContent = attachedFile
      ? `Attached file: ${attachedFile.name}${input.trim() ? '\n' + input : ''}`
      : input;

    // Build the full content sent to the AI (includes file text)
    const fullContent = attachedFile
      ? `[Attached file: ${attachedFile.name}]\n\nExtracted text:\n${attachedFile.content}${input.trim() ? '\n\nUser request:\n' + input : ''}`
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
    const lowerInput = input.toLowerCase();
    const hasTailorAction = lowerInput.includes('tailor') || /\b(customize|target|adapt|rewrite)\b/.test(lowerInput);
    const hasTailorSubject = /\b(resume|cv)\b/.test(lowerInput) || Boolean(attachedFile || baseResumeProfile || currentDraftProfile);
    const hasTailorIntent = hasTailorAction && hasTailorSubject;

    try {
      const resumeSource = attachedFile?.content;

      if (hasTailorIntent && (resumeSource || baseResumeProfile || currentDraftProfile)) {
        await handleChatTailorRequest(input, resumeSource);
        return;
      }

      if (hasTailorIntent) {
        setTailorOpen(true);
        setTailorStatus('error');
        setTailorMessage('Attach your resume or set a base resume profile before tailoring.');
        throw new Error('Attach your resume or set a base resume profile before tailoring.');
      }

      let endpoint = '/api/chat';
      let requestBody:
        | { messages: Message[]; userMessage: string; baseProfile?: ResumeProfile | null; memories?: MemoryEntry[] }
        | { jd: string; history: Message[]; question: string } = {
        messages: messages,
        userMessage: fullContent,
        baseProfile: currentDraftProfile || baseResumeProfile,
        memories: selectRelevantMemories(fullContent),
      };

      const lowerContent = fullContent.toLowerCase();
      const hasResumeIntent = /\b(resume|tailor|cv|cover letter)\b/.test(lowerContent);

      // Use the specialized analyze endpoint for job descriptions, but keep resume conversations in chat.
      if (!hasResumeIntent && (lowerContent.includes('analyze') || (jd && fullContent.length > 50))) {
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
      if (!hasResumeIntent && lowerContent.includes('analyze') && fullContent.length > 50) {
        setJd(fullContent);
      }
    } catch (error) {
      if (hasTailorIntent) {
        setTailorStatus('error');
        setTailorMessage(error instanceof Error ? error.message : 'An error occurred');
      }
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
      const profile = await ingestResumeSource(baseResumeLatex);
      setTailorStatus('idle');
      setTailorMessage(
        `Base profile saved: ${profile.projects.length} projects, ${profile.projects.reduce((sum, project) => sum + project.bullets.length, 0)} project bullets, ${profile.experience.length} experience entries, ${profile.experience.reduce((sum, experience) => sum + experience.bullets.length, 0)} experience bullets.`
      );
    } catch (error) {
      setTailorStatus('error');
      setTailorMessage(error instanceof Error ? error.message : 'Failed to ingest resume');
    }
  };

  const downloadTailoredLatex = () => {
    const latestLatex = currentDraftProfile ? renderResumeLatex(currentDraftProfile) : tailoredLatex;
    if (!latestLatex) return;
    downloadTextFile('tailored-resume.tex', latestLatex);
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

  const latestTailoredLatex = currentDraftProfile ? renderResumeLatex(currentDraftProfile) : tailoredLatex;

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
          <button onClick={() => setWorkspaceOpen((open) => !open)} className="header-link" title="Workspace Memory">
            <Brain size={20} />
          </button>
          <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className={`chat-container ${tailorOpen ? 'with-tailor-panel' : ''} ${messages.length === 0 ? 'home-mode' : ''}`}>
        {tailorOpen && (
          <section className="tailor-panel" aria-label="Tailor resume">
            <div className="tailor-panel-header">
              <div>
                <h2>Tailor Resume</h2>
                <p>Set your base LaTeX resume once. Add and tailor job descriptions from Workspace.</p>
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
            </div>

            <div className="tailor-actions">
              <button onClick={handleIngestResume} disabled={tailorStatus === 'ingesting' || !baseResumeLatex.trim()}>
                {tailorStatus === 'ingesting' ? 'Saving...' : 'Set as Base Profile'}
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

            {latestTailoredLatex && (
              <div className="latex-preview-panel">
                <div className="latex-preview-header">
                  <h3>Tailored LaTeX</h3>
                  <button onClick={downloadTailoredLatex} type="button">
                    Download .tex
                  </button>
                </div>
                <pre className="latex-preview" aria-label="Generated tailored resume LaTeX">
                  <code>{latestTailoredLatex}</code>
                </pre>
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
                    <p className="refine-empty">Ask for a targeted change, like &quot;make the second JobOps bullet punchier.&quot;</p>
                  ) : (
                    refineMessages.map((message) => (
                      <div key={message.id} className={`refine-message ${message.role}`}>
                        {message.content}
                      </div>
                    ))
                  )}
                </div>
                <div className="refine-input-row">
                  <textarea
                    value={refineInput}
                    onChange={(event) => setRefineInput(event.target.value)}
                    onKeyDown={handleRefineKeyDown}
                    placeholder="e.g. make the second project bullet punchier"
                    disabled={isRefining}
                    rows={Math.min(5, Math.max(2, refineInput.split('\n').length))}
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
          <div className="studio-home">
            <section className="studio-hero">
              <div>
                <span className="workspace-home-kicker">Local Career Workspace</span>
                <h2>Build the packet for the next application.</h2>
                <p>Save job descriptions, tailor LaTeX resumes, and generate interview prep from one grounded workspace.</p>
              </div>
              <div className="studio-actions">
                <button onClick={() => setTailorOpen(true)} className="studio-action-button">
                  <FileText size={16} />
                  Set Base Resume
                </button>
                <button onClick={() => setWorkspaceOpen(true)} className="studio-action-button">
                  <Brain size={16} />
                  Workspace
                </button>
              </div>
            </section>

            <section className="studio-status-strip" aria-label="Workspace status">
              <div>
                <span>Saved JDs</span>
                <strong>{jobDescriptions.length}</strong>
              </div>
              <div>
                <span>Resume Drafts</span>
                <strong>{jobDescriptions.filter((job) => job.tailoredLatex).length}</strong>
              </div>
              <div>
                <span>Interview Kits</span>
                <strong>{jobDescriptions.filter((job) => job.interviewPrep).length}</strong>
              </div>
              <div>
                <span>Memory Notes</span>
                <strong>{memories.length}</strong>
              </div>
            </section>

            <section className="studio-board">
              <div className="studio-panel studio-panel-compose">
                <div className="studio-panel-header">
                  <div>
                    <span>Compose</span>
                    <h3>Paste Job Description</h3>
                  </div>
                  <span>{canEditWorkspace ? 'Ready' : 'Sign in'}</span>
                </div>
                {!session && (
                  <div className="workspace-form home-login">
                    <input
                      value={loginName}
                      onChange={(event) => setLoginName(event.target.value)}
                      placeholder="Workspace name"
                    />
                    <select value={loginRole} onChange={(event) => setLoginRole(event.target.value as WorkspaceRole)}>
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={signInWorkspace} disabled={!loginName.trim()}>
                      Sign in
                    </button>
                  </div>
                )}
                <div className="workspace-form">
                  <textarea
                    value={jobForm.text}
                    onChange={(event) => updateJobDescriptionText(event.target.value)}
                    placeholder="Paste the job description here. Title and company will be inferred when possible."
                    rows={10}
                    disabled={!canEditWorkspace}
                  />
                  <div className="home-form-row">
                    <input
                      value={jobForm.url}
                      onChange={(event) => setJobForm((form) => ({ ...form, url: event.target.value }))}
                      placeholder="Job link (optional)"
                      disabled={!canEditWorkspace}
                    />
                    <button onClick={importJobFromUrl} disabled={!canEditWorkspace || !jobForm.url.trim()}>
                      <LinkIcon size={15} />
                      Import Link
                    </button>
                  </div>
                  <div className="home-form-row">
                    <input
                      value={jobForm.title}
                      onChange={(event) => setJobForm((form) => ({ ...form, title: event.target.value }))}
                      placeholder="Job title (auto)"
                      disabled={!canEditWorkspace}
                    />
                    <input
                      value={jobForm.company}
                      onChange={(event) => setJobForm((form) => ({ ...form, company: event.target.value }))}
                      placeholder="Company (auto)"
                      disabled={!canEditWorkspace}
                    />
                  </div>
                  <div className="studio-command-row">
                    <button onClick={saveJobDescriptionFromForm} disabled={!canEditWorkspace || !jobForm.text.trim()}>
                      Save JD
                    </button>
                    <button onClick={tailorAllSavedJobs} disabled={!canEditWorkspace || jobDescriptions.length === 0 || (!baseResumeProfile && !currentDraftProfile)}>
                      Tailor All Saved
                    </button>
                  </div>
                </div>
                {jobLibraryStatus && <p className="workspace-status">{jobLibraryStatus}</p>}
              </div>

              <aside className="studio-side">
                <div className="studio-panel">
                  <div className="studio-panel-header">
                    <div>
                      <span>Library</span>
                      <h3>Saved Jobs</h3>
                    </div>
                    <span>{jobDescriptions.length}</span>
                  </div>
                  <div className="workspace-list">
                    {jobDescriptions.length === 0 ? (
                      <p className="workspace-empty">No job descriptions saved yet.</p>
                    ) : (
                      jobDescriptions.slice(0, 3).map((job) => renderSavedJobCard(job, true))
                    )}
                  </div>
                </div>

                <div className="studio-panel studio-panel-quiet">
                  <div className="studio-panel-header">
                    <div>
                      <span>Assistant</span>
                      <h3>Ask Laterally</h3>
                    </div>
                  </div>
                  <div className="studio-link-list">
                    <button onClick={() => setInput('Help me prepare for interviews from my saved jobs.')}>
                      Interview prep from saved jobs
                    </button>
                    <button onClick={() => setInput('What skills should I focus on for AI engineering roles?')}>
                      Skill focus for AI roles
                    </button>
                    <button onClick={() => setWorkspaceOpen(true)}>
                      Open full workspace
                    </button>
                  </div>
                </div>
              </aside>
            </section>
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
            <span className="file-badge-name">Attached file: {attachedFile.name}</span>
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
            accept=".txt,.md,.json,.csv,.tex,.pdf"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="attach-button"
            title="Attach a text file"
            disabled={isLoading}
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="Tell me what you want to analyze, search, or track..."
            className="chat-input"
            disabled={isLoading}
            rows={Math.min(6, Math.max(1, input.split('\n').length))}
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

      {workspaceOpen && (
        <aside className="workspace-panel" aria-label="Workspace memory and job descriptions">
          <div className="workspace-header">
            <div>
              <h2>Workspace</h2>
              <p>Local-file career memory, saved JDs, and batch resume tailoring.</p>
            </div>
            <button className="tailor-close" onClick={() => setWorkspaceOpen(false)} title="Close Workspace">
              <X size={16} />
            </button>
          </div>

          <section className="workspace-section">
            <div className="workspace-section-title">
              <h3>Access</h3>
              {session && (
                <button className="workspace-icon-button" onClick={signOutWorkspace} title="Sign out">
                  <LogOut size={15} />
                </button>
              )}
            </div>
            {session ? (
              <div className="workspace-session">
                <strong>{session.name}</strong>
                <span>{session.role}</span>
              </div>
            ) : (
              <div className="workspace-form">
                <input
                  value={loginName}
                  onChange={(event) => setLoginName(event.target.value)}
                  placeholder="Workspace name"
                />
                <select value={loginRole} onChange={(event) => setLoginRole(event.target.value as WorkspaceRole)}>
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button onClick={signInWorkspace} disabled={!loginName.trim()}>
                  Sign in
                </button>
              </div>
            )}
            <p className="workspace-status">
              Saves locally to data/local-workspace.json when running this app on your machine.
            </p>
          </section>

          <section className="workspace-section">
            <div className="workspace-section-title">
              <h3>Memory Palace</h3>
              <span>{memories.length}</span>
            </div>
            <div className="workspace-form memory-grid">
              <input
                value={memoryForm.wing}
                onChange={(event) => setMemoryForm((form) => ({ ...form, wing: event.target.value }))}
                placeholder="Wing"
                disabled={!canEditWorkspace}
              />
              <input
                value={memoryForm.room}
                onChange={(event) => setMemoryForm((form) => ({ ...form, room: event.target.value }))}
                placeholder="Room"
                disabled={!canEditWorkspace}
              />
              <input
                value={memoryForm.drawer}
                onChange={(event) => setMemoryForm((form) => ({ ...form, drawer: event.target.value }))}
                placeholder="Drawer"
                disabled={!canEditWorkspace}
              />
            </div>
            <div className="workspace-form">
              <input
                value={memoryForm.title}
                onChange={(event) => setMemoryForm((form) => ({ ...form, title: event.target.value }))}
                placeholder="Memory title"
                disabled={!canEditWorkspace}
              />
              <textarea
                value={memoryForm.text}
                onChange={(event) => setMemoryForm((form) => ({ ...form, text: event.target.value }))}
                placeholder="Save a verbatim fact, preference, project detail, recruiter note, or reusable career context."
                rows={4}
                disabled={!canEditWorkspace}
              />
              <button onClick={addMemory} disabled={!canEditWorkspace || !memoryForm.title.trim() || !memoryForm.text.trim()}>
                Add Memory
              </button>
            </div>
            <input
              className="workspace-search"
              value={memorySearch}
              onChange={(event) => setMemorySearch(event.target.value)}
              placeholder="Search memory..."
            />
            <div className="workspace-list">
              {filteredMemories.length === 0 ? (
                <p className="workspace-empty">No memories saved yet.</p>
              ) : (
                filteredMemories.map((memory) => (
                  <article key={memory.id} className="workspace-card">
                    <div className="workspace-card-header">
                      <strong>{memory.title}</strong>
                      {canEditWorkspace && (
                        <button onClick={() => deleteMemory(memory.id)} title="Delete memory">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <span>{memory.wing} / {memory.room} / {memory.drawer}</span>
                    <p>{memory.text}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="workspace-section">
            <div className="workspace-section-title">
              <h3>Job Descriptions</h3>
              <span>{jobDescriptions.length}</span>
            </div>
            <div className="workspace-form">
              <textarea
                value={jobForm.text}
                onChange={(event) => updateJobDescriptionText(event.target.value)}
                placeholder="Paste the job description here. Title and company will be inferred when possible."
                rows={7}
                disabled={!canEditWorkspace}
              />
              <input
                value={jobForm.url}
                onChange={(event) => setJobForm((form) => ({ ...form, url: event.target.value }))}
                placeholder="Job link (optional)"
                disabled={!canEditWorkspace}
              />
              <button onClick={importJobFromUrl} disabled={!canEditWorkspace || !jobForm.url.trim()}>
                <LinkIcon size={15} />
                Import Link
              </button>
              <input
                value={jobForm.title}
                onChange={(event) => setJobForm((form) => ({ ...form, title: event.target.value }))}
                placeholder="Job title (auto)"
                disabled={!canEditWorkspace}
              />
              <input
                value={jobForm.company}
                onChange={(event) => setJobForm((form) => ({ ...form, company: event.target.value }))}
                placeholder="Company (auto)"
                disabled={!canEditWorkspace}
              />
              <button onClick={saveJobDescriptionFromForm} disabled={!canEditWorkspace || !jobForm.text.trim()}>
                Save JD
              </button>
            </div>
            {jobLibraryStatus && <p className="workspace-status">{jobLibraryStatus}</p>}
            <div className="workspace-bulk-actions">
              <button onClick={tailorAllSavedJobs} disabled={!canEditWorkspace || jobDescriptions.length === 0 || (!baseResumeProfile && !currentDraftProfile)}>
                Tailor All Saved JDs
              </button>
            </div>
            <div className="workspace-list">
              {jobDescriptions.length === 0 ? (
                <p className="workspace-empty">No job descriptions saved yet.</p>
              ) : (
                jobDescriptions.map((job) => renderSavedJobCard(job))
              )}
            </div>
          </section>
        </aside>
      )}

      <QuickCopyPanel
        isOpen={quickCopyOpen}
        onClose={() => setQuickCopyOpen(false)}
      />
    </div>
  );
}
