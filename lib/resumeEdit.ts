import type { ResumeProfile } from "@/types/profile";

export interface ResumeEdit {
  location: string;
  bullet_index: number;
  new_text: string;
}

const DASH_PATTERN = /[\u2014\u2013]/g;

export function applyResumeEdits(profile: ResumeProfile, edits: ResumeEdit[]): ResumeProfile {
  const normalized = new Map<string, string>();

  for (const edit of edits) {
    normalized.set(`${edit.location}:${edit.bullet_index}`, sanitizeBullet(edit.new_text));
  }

  return {
    ...profile,
    projects: profile.projects.map((project) => ({
      ...project,
      bullets: project.bullets.map((bullet, index) =>
        normalized.get(`project:${project.id}:${index}`) ?? bullet
      ),
    })),
    experience: profile.experience.map((experience) => ({
      ...experience,
      bullets: experience.bullets.map((bullet, index) =>
        normalized.get(`experience:${experience.id}:${index}`) ?? bullet
      ),
    })),
  };
}

export function editedLocations(edits: ResumeEdit[]): string[] {
  return edits.map((edit) => `${edit.location}:${edit.bullet_index}`);
}

export function sanitizeBullet(value: string): string {
  return String(value || "")
    .replace(DASH_PATTERN, "-")
    .replace(/\s+/g, " ")
    .trim();
}
