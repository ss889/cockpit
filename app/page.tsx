'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import type { WorkspaceRole, WorkspaceSession } from '@/types/workspace';

const SESSION_STORAGE_KEY = 'jobops_workspace_session';
const SESSION_COOKIE = 'jobops_workspace_session=active; path=/; max-age=2592000; SameSite=Lax';
const THEME_STORAGE_KEY = 'jobops_theme';

export default function LandingPage() {
  const router = useRouter();
  const [signInOpen, setSignInOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('owner');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SESSION_STORAGE_KEY)) {
        document.cookie = SESSION_COOKIE;
        router.replace('/workspace');
      }
    } catch {
      // Middleware handles cookie-backed sessions. LocalStorage is best-effort.
    }
  }, [router]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  const signIn = () => {
    if (!workspaceName.trim()) return;
    const session: WorkspaceSession = {
      name: workspaceName.trim(),
      role,
      signedInAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    document.cookie = SESSION_COOKIE;
    router.push('/workspace');
  };

  return (
    <main className="landing-page">
      <div className="landing-actions">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title="Toggle Theme"
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          type="button"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      <section className="landing-hero" aria-label="JobOps AI landing page">
        <div className="landing-copy">
          <h1>One place to go from job description to application-ready.</h1>
          <p>
            Save job descriptions, tailor your resume, and prep for interviews, all from one workspace that keeps everything connected.
          </p>
          <button type="button" onClick={() => setSignInOpen(true)}>
            Get Started
          </button>
        </div>
      </section>

      <section className="landing-features" aria-label="Core workflows">
        <article>
          <span>Save the job.</span>
          <p>Paste a job description and JobOps saves it with the title and company inferred automatically.</p>
        </article>
        <article>
          <span>Tailor your resume.</span>
          <p>Generate a LaTeX resume draft grounded in the saved job and your base profile, ready to compile in Overleaf.</p>
        </article>
        <article>
          <span>Prep for the interview.</span>
          <p>Get a prep packet with likely questions, talking points, and gap briefs built from your resume and the job description.</p>
        </article>
      </section>

      <footer className="landing-footer">
        <a href="https://github.com/ss889/cockpit" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>

      {signInOpen && (
        <div className="landing-modal" role="dialog" aria-modal="true" aria-label="Sign in">
          <div className="landing-modal-panel">
            <div>
              <h2>Sign in</h2>
              <p>Create a local workspace session on this browser.</p>
            </div>
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Workspace name"
              autoFocus
            />
            <select value={role} onChange={(event) => setRole(event.target.value as WorkspaceRole)}>
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <div className="landing-modal-actions">
              <button type="button" onClick={signIn} disabled={!workspaceName.trim()}>
                Sign in
              </button>
              <button type="button" onClick={() => setSignInOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
