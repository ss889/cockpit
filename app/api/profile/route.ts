import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROFILE_PATH = path.join(process.cwd(), 'data', 'profile.json');

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

function ensureDataDir() {
  const dir = path.dirname(PROFILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getProfile(): Profile | null {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('Failed to read profile:', e);
  }
  return null;
}

function saveProfile(profile: Profile) {
  ensureDataDir();
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
}

export async function GET() {
  const profile = getProfile();
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  try {
    const profile = await request.json();
    saveProfile(profile);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile save error:', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
