'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Check } from 'lucide-react';
import Link from 'next/link';

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

const emptyProfile: Profile = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  school: '',
  degree: '',
  graduationDate: '',
  gpa: '',
  workExperience: '',
  skills: '',
  summary: '',
  coverLetterTemplate: '',
  sponsorship: 'No',
  authorized: 'Yes',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof Profile) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setProfile((prev) => ({ ...prev, [field]: e.target.value }));
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} />
          Back to Chat
        </Link>
        <h1>Your Profile</h1>
        <p>Fill this out once. Use it to quick-copy into any job application.</p>
      </header>

      <div className="profile-form">
        {/* Personal Info */}
        <section className="form-section">
          <h2>Personal Information</h2>
          <div className="form-grid">
            <div className="form-field">
              <label>Full Name</label>
              <input type="text" value={profile.fullName} onChange={update('fullName')} placeholder="John Doe" />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input type="email" value={profile.email} onChange={update('email')} placeholder="john@example.com" />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input type="tel" value={profile.phone} onChange={update('phone')} placeholder="+1 (555) 123-4567" />
            </div>
            <div className="form-field">
              <label>Location</label>
              <input type="text" value={profile.location} onChange={update('location')} placeholder="New York, NY" />
            </div>
          </div>
        </section>

        {/* Links */}
        <section className="form-section">
          <h2>Links</h2>
          <div className="form-grid">
            <div className="form-field">
              <label>LinkedIn URL</label>
              <input type="url" value={profile.linkedinUrl} onChange={update('linkedinUrl')} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="form-field">
              <label>GitHub URL</label>
              <input type="url" value={profile.githubUrl} onChange={update('githubUrl')} placeholder="https://github.com/..." />
            </div>
            <div className="form-field full-width">
              <label>Portfolio URL</label>
              <input type="url" value={profile.portfolioUrl} onChange={update('portfolioUrl')} placeholder="https://yoursite.com" />
            </div>
          </div>
        </section>

        {/* Education */}
        <section className="form-section">
          <h2>Education</h2>
          <div className="form-grid">
            <div className="form-field">
              <label>School</label>
              <input type="text" value={profile.school} onChange={update('school')} placeholder="New Jersey Institute of Technology" />
            </div>
            <div className="form-field">
              <label>Degree</label>
              <input type="text" value={profile.degree} onChange={update('degree')} placeholder="B.S. Computer Science" />
            </div>
            <div className="form-field">
              <label>Graduation Date</label>
              <input type="text" value={profile.graduationDate} onChange={update('graduationDate')} placeholder="May 2026" />
            </div>
            <div className="form-field">
              <label>GPA</label>
              <input type="text" value={profile.gpa} onChange={update('gpa')} placeholder="3.5" />
            </div>
          </div>
        </section>

        {/* Work & Skills */}
        <section className="form-section">
          <h2>Experience & Skills</h2>
          <div className="form-field full-width">
            <label>Work Experience</label>
            <textarea 
              value={profile.workExperience} 
              onChange={update('workExperience')} 
              placeholder="Company — Role — Dates&#10;• Key achievement 1&#10;• Key achievement 2"
              rows={5}
            />
          </div>
          <div className="form-field full-width">
            <label>Skills</label>
            <textarea 
              value={profile.skills} 
              onChange={update('skills')} 
              placeholder="Python, TypeScript, React, Next.js, Claude API, LangChain, Docker..."
              rows={3}
            />
          </div>
          <div className="form-field full-width">
            <label>Professional Summary</label>
            <textarea 
              value={profile.summary} 
              onChange={update('summary')} 
              placeholder="A brief 2-3 sentence summary of who you are and what you bring..."
              rows={3}
            />
          </div>
        </section>

        {/* Work Authorization */}
        <section className="form-section">
          <h2>Work Authorization</h2>
          <div className="form-grid">
            <div className="form-field">
              <label>Authorized to work in the US?</label>
              <select value={profile.authorized} onChange={update('authorized')}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="form-field">
              <label>Require sponsorship?</label>
              <select value={profile.sponsorship} onChange={update('sponsorship')}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>
        </section>

        {/* Cover Letter */}
        <section className="form-section">
          <h2>Cover Letter Template</h2>
          <div className="form-field full-width">
            <label>Default Cover Letter</label>
            <textarea
              value={profile.coverLetterTemplate}
              onChange={update('coverLetterTemplate')}
              placeholder="Dear Hiring Manager,&#10;&#10;I am writing to express my interest in the [ROLE] position at [COMPANY]...&#10;&#10;Use [ROLE] and [COMPANY] as placeholders — they'll be auto-replaced when you copy."
              rows={8}
            />
          </div>
        </section>

        <button className="save-button" onClick={handleSave} disabled={saving}>
          {saved ? <><Check size={18} /> Saved!</> : saving ? 'Saving...' : <><Save size={18} /> Save Profile</>}
        </button>
      </div>
    </div>
  );
}
