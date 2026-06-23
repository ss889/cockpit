import type { QAIssue, ResumeProfile } from "@/types/profile";

const BAD_PHRASES = [
  "leveraged",
  "spearheaded",
  "architected",
  "robust",
  "seamless",
  "cutting-edge",
  "utilize",
  "utilized",
  "synergy",
  "best-in-class",
  "end-to-end",
  "scalable solution",
  "innovative solution",
  "dynamic",
  "fast-paced",
  "results-driven",
  "detail-oriented",
  "highly motivated",
  "proven ability",
  "responsible for",
  "played a key role",
  "with a focus on",
  "to help",
  "helped to",
  "demonstrated ability",
  "passionate about",
];

const DASH_PATTERN = /[\u2014\u2013]|\s-\s/;
const MAX_BULLET_WORDS = 32;
const XYZ_METHOD_PATTERN = /\b(by|using|through|with|via)\b/i;
const XYZ_MEASURE_PATTERN = /\b(\d+[%+]?|\d+x|users?|records?|rows?|files?|tables?|views?|dashboards?|reports?|tests?|pipelines?|workflows?|datasets?|responses?|requests?|hours?|minutes?|seconds?|weekly|monthly|daily)\b/i;

export function runQA(profile: ResumeProfile, jdKeywords: string[]): QAIssue[] {
  const issues: QAIssue[] = [];
  const allBullets = collectBullets(profile);

  for (const { location, text } of allBullets) {
    if (DASH_PATTERN.test(text)) {
      issues.push({ type: "dash_punctuation", location, detail: text });
    }
  }

  for (const { location, text } of allBullets) {
    const lower = text.toLowerCase();
    for (const phrase of BAD_PHRASES) {
      if (lower.includes(phrase)) {
        issues.push({
          type: "formulaic_phrase",
          location,
          detail: `"${phrase}" in: ${text}`,
        });
      }
    }
  }

  addRepeatedVerbIssues(issues, allBullets);
  addLongBulletIssues(issues, allBullets);
  addExperienceXyzIssues(issues, profile);
  addBulletBalanceIssues(issues, profile);
  addKeywordCoverageIssues(issues, allBullets, jdKeywords);

  return issues;
}

function addExperienceXyzIssues(issues: QAIssue[], profile: ResumeProfile): void {
  for (const experience of profile.experience) {
    experience.bullets.forEach((bullet, index) => {
      const hasMethod = XYZ_METHOD_PATTERN.test(bullet);
      const hasMeasure = XYZ_MEASURE_PATTERN.test(bullet);

      if (!hasMethod || !hasMeasure) {
        issues.push({
          type: "weak_xyz_formula",
          location: `experience:${experience.id}:${index}`,
          detail: `Experience bullet should show what changed, how it was measured or scoped, and how it was done: ${bullet}`,
        });
      }
    });
  }
}

function addLongBulletIssues(
  issues: QAIssue[],
  bullets: { location: string; text: string }[]
): void {
  for (const { location, text } of bullets) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_BULLET_WORDS) {
      issues.push({
        type: "long_bullet",
        location,
        detail: `${wordCount} words: ${text}`,
      });
    }
  }
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

function addRepeatedVerbIssues(
  issues: QAIssue[],
  bullets: { location: string; text: string }[]
): void {
  const verbCounts = new Map<string, number>();

  for (const { text } of bullets) {
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
}

function addBulletBalanceIssues(issues: QAIssue[], profile: ResumeProfile): void {
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
}

function addKeywordCoverageIssues(
  issues: QAIssue[],
  bullets: { location: string; text: string }[],
  jdKeywords: string[]
): void {
  const fullText = bullets.map((bullet) => bullet.text).join(" ").toLowerCase();
  const meaningfulKeywords = jdKeywords.filter((keyword) => keyword.trim().length > 2);
  const missing = meaningfulKeywords.filter((keyword) => !fullText.includes(keyword.toLowerCase()));

  if (meaningfulKeywords.length > 0 && missing.length > meaningfulKeywords.length / 2) {
    issues.push({
      type: "low_keyword_coverage",
      location: "global",
      detail: `Missing: ${missing.join(", ")}`,
    });
  }
}
