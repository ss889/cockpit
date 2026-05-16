'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, X, User } from 'lucide-react';

interface Profile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  school: string;
  degree: string;
  graduationDate: string;
  gpa: string;
  workExperience: string;
  skills: string;
  summary: string;
  coverLetterTemplate: string;
  sponsorship: string;
  authorized: string;
}

interface QuickCopyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle?: string;
  company?: string;
}

export default function QuickCopyPanel({ isOpen, onClose, jobTitle, company }: QuickCopyPanelProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/profile')
        .then((r) => r.json())
        .then((data) => setProfile(data.profile))
        .catch(console.error);
    }
  }, [isOpen]);

  const copyToClipboard = async (value: string, fieldName: string) => {
    // Replace placeholders in cover letter
    let text = value;
    if (jobTitle) text = text.replace(/\[ROLE\]/gi, jobTitle);
    if (company) text = text.replace(/\[COMPANY\]/gi, company);

    await navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (!isOpen) return null;

  const fields: { label: string; key: keyof Profile; multiline?: boolean }[] = [
    { label: 'Full Name', key: 'fullName' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Location', key: 'location' },
    { label: 'LinkedIn', key: 'linkedinUrl' },
    { label: 'GitHub', key: 'githubUrl' },
    { label: 'Portfolio', key: 'portfolioUrl' },
    { label: 'School', key: 'school' },
    { label: 'Degree', key: 'degree' },
    { label: 'Graduation', key: 'graduationDate' },
    { label: 'GPA', key: 'gpa' },
    { label: 'Authorized', key: 'authorized' },
    { label: 'Sponsorship', key: 'sponsorship' },
    { label: 'Skills', key: 'skills', multiline: true },
    { label: 'Summary', key: 'summary', multiline: true },
    { label: 'Experience', key: 'workExperience', multiline: true },
    { label: 'Cover Letter', key: 'coverLetterTemplate', multiline: true },
  ];

  return (
    <div className="quickcopy-overlay" onClick={onClose}>
      <div className="quickcopy-panel" onClick={(e) => e.stopPropagation()}>
        <div className="quickcopy-header">
          <div>
            <h3><User size={18} /> Quick Apply Info</h3>
            {(jobTitle || company) && (
              <p className="quickcopy-context">
                Applying for: {jobTitle}{company ? ` at ${company}` : ''}
              </p>
            )}
          </div>
          <button className="quickcopy-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {!profile ? (
          <div className="quickcopy-empty">
            <p>No profile saved yet.</p>
            <a href="/profile" className="quickcopy-setup-link">Set up your profile →</a>
          </div>
        ) : (
          <div className="quickcopy-fields">
            {fields.map(({ label, key, multiline }) => {
              const value = profile[key];
              if (!value) return null;

              return (
                <div key={key} className={`quickcopy-field ${multiline ? 'multiline' : ''}`}>
                  <div className="quickcopy-field-header">
                    <span className="quickcopy-label">{label}</span>
                    <button
                      className="quickcopy-copy-btn"
                      onClick={() => copyToClipboard(value, key)}
                    >
                      {copiedField === key ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </div>
                  <div className="quickcopy-value">
                    {multiline ? value.slice(0, 120) + (value.length > 120 ? '...' : '') : value}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
