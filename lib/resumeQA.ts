import type { QAIssue, ResumeProfile } from "@/types/profile";

const BAD_PHRASES = [
  "leveraged",
  "spearheaded",
  "architected",
  "robust",
  "seamless",
  "cutting-edge",
  "utilize",
  "synergy",
  "best-in-class",
];

export function runQA(profile: ResumeProfile, jdKeywords: string[]): QAIssue[] {
  const issues: QAIssue[] = [];
  const allBullets = collectBullets(profile);

  for (const { location, text } of allBullets) {
    if (/[—–]/.test(text)) {
      issues.push({ type: "em_dash", location, detail: text });
    }
  }

  for (const { location, text } of allBullets) {
    const lower = text.toLowerCase();
    for (const phrase of BAD_PHRASES) {
      if (lower.includes(phrase)) {
        issues.push({
          type: "generic_phrase",
          location,
          detail: `"${phrase}" in: ${text}`,
        });
      }
    }
  }

  const verbCounts = new Map<string, number>();
  for (const { text } of allBullets) {
    const firstWord = text.trim().split(/\s+/)[0]?.replace(/[^a-z]/gi, "").toLowerCase();
    if (!firstWord) continue;
    verbCounts.set(firstWord, (verbCounts.get(firstWord) || 0) + 1);
  }

  for (const [verb, count] of verbCounts) {
    if (count > 2) {
      issues.push({
        type: "repeated_verb",
        location: "global",
        detail: `"${verb}" used ${count} times`,
      });
    }
  }

  const entries = [...profile.projects, ...profile.experience];
  const bulletCounts = entries.map((entry) => entry.bullets.length);
  const maxCount = bulletCounts.length ? Math.max(...bulletCounts) : 0;
  for (const entry of entries) {
    if (entry.bullets.length < 2 && maxCount >= 3) {
      issues.push({
        type: "bullet_imbalance",
        location: entry.id,
        detail: `Only ${entry.bullets.length} bullets while others have up to ${maxCount}`,
      });
    }
  }

  const fullText = allBullets.map((bullet) => bullet.text).join(" ").toLowerCase();
  const meaningfulKeywords = jdKeywords.filter((keyword) => keyword.trim().length > 2);
  const missing = meaningfulKeywords.filter((keyword) => !fullText.includes(keyword.toLowerCase()));
  if (meaningfulKeywords.length > 0 && missing.length > meaningfulKeywords.length / 2) {
    issues.push({
      type: "low_keyword_coverage",
      location: "global",
      detail: `Missing: ${missing.join(", ")}`,
    });
  }

  return issues;
}

export function collectBullets(profile: ResumeProfile): { location: string; text: string }[] {
  const bullets: { location: string; text: string }[] = [];

  profile.projects.forEach((project) => {
    project.bullets.forEach((bullet, index) => {
      bullets.push({ location: `project:${project.id}:${index}`, text: bullet });
    });
  });

  profile.experience.forEach((experience) => {
    experience.bullets.forEach((bullet, index) => {
      bullets.push({ location: `experience:${experience.id}:${index}`, text: bullet });
    });
  });

  return bullets;
}
