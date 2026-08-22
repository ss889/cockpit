import type { FormatResult } from "@/types/audit";

const STANDARD_SECTIONS = ["Education", "Skills", "Experience", "Projects"];
const MONTH_DATE_PATTERN = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{4}\b/gi;
const YEAR_RANGE_PATTERN = /\b\d{4}\s*(?:--|-|to)\s*(?:Present|\d{4})\b/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/;

export function runFormatChecks(resumeText: string): FormatResult[] {
  return [
    checkStandardSections(resumeText),
    checkDateFormat(resumeText),
    checkContactInfo(resumeText),
  ];
}

function checkStandardSections(resumeText: string): FormatResult {
  const missing = STANDARD_SECTIONS.filter((section) => !new RegExp(`\\b${section}\\b`, "i").test(resumeText));

  return {
    id: "standard_sections",
    label: "Standard section headers",
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? "Education, Skills, Experience, and Projects are present."
        : `Missing or renamed section(s): ${missing.join(", ")}.`,
  };
}

function checkDateFormat(resumeText: string): FormatResult {
  const monthDates = resumeText.match(MONTH_DATE_PATTERN) || [];
  const yearRanges = resumeText.match(YEAR_RANGE_PATTERN) || [];
  const hasDates = monthDates.length + yearRanges.length > 0;
  const mixedFormats = monthDates.length > 0 && yearRanges.length > 0;

  return {
    id: "consistent_dates",
    label: "Consistent date formatting",
    passed: hasDates && !mixedFormats,
    detail: !hasDates
      ? "No recognizable dates found."
      : mixedFormats
        ? "Mixed month-year dates and year ranges found."
        : "Recognizable date format is used consistently.",
  };
}

function checkContactInfo(resumeText: string): FormatResult {
  const firstLines = resumeText.split(/\r?\n/).slice(0, 5).join(" ");
  const hasEmail = EMAIL_PATTERN.test(firstLines);
  const hasPhone = PHONE_PATTERN.test(firstLines);

  return {
    id: "contact_info",
    label: "Contact info near top",
    passed: hasEmail && hasPhone,
    detail:
      hasEmail && hasPhone
        ? "Email and phone are present in the first five lines."
        : `Missing ${!hasEmail && !hasPhone ? "email and phone" : !hasEmail ? "email" : "phone"} in the first five lines.`,
  };
}
