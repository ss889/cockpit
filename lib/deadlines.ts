import type { JobDescriptionEntry } from "@/types/workspace";

export type DeadlineBucket = "overdue" | "today" | "within_3_days" | "within_7_days" | "later" | "no_deadline";

export type DeadlineItem = {
  job: JobDescriptionEntry;
  bucket: DeadlineBucket;
  daysUntil: number | null;
  dateLabel: string | null;
};

export const DEADLINE_BUCKETS: { id: DeadlineBucket; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "within_3_days", label: "Within 3 days" },
  { id: "within_7_days", label: "Within 7 days" },
  { id: "later", label: "Later" },
  { id: "no_deadline", label: "No deadline" },
];

export function categorizeDeadline(
  job: JobDescriptionEntry,
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): DeadlineItem {
  if (!job.deadline) return { job, bucket: "no_deadline", daysUntil: null, dateLabel: null };
  const deadlineDay = calendarDay(job.deadline, timeZone);
  if (!deadlineDay) return { job, bucket: "no_deadline", daysUntil: null, dateLabel: null };

  const today = calendarDay(now.toISOString(), timeZone);
  const daysUntil = differenceInDays(today, deadlineDay);
  const bucket = daysUntil < 0
    ? "overdue"
    : daysUntil === 0
      ? "today"
      : daysUntil <= 3
        ? "within_3_days"
        : daysUntil <= 7
          ? "within_7_days"
          : "later";

  return {
    job,
    bucket,
    daysUntil,
    dateLabel: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone }).format(parseDeadline(job.deadline)),
  };
}

export function groupDeadlines(
  jobs: JobDescriptionEntry[],
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): Record<DeadlineBucket, DeadlineItem[]> {
  const grouped: Record<DeadlineBucket, DeadlineItem[]> = {
    overdue: [],
    today: [],
    within_3_days: [],
    within_7_days: [],
    later: [],
    no_deadline: [],
  };
  for (const job of jobs) {
    const item = categorizeDeadline(job, now, timeZone);
    grouped[item.bucket].push(item);
  }
  return grouped;
}

function calendarDay(value: string, timeZone: string): string | null {
  const parsed = parseDeadline(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDeadline(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

function differenceInDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}