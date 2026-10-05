import { describe, expect, it } from "vitest";
import { categorizeDeadline, groupDeadlines } from "@/lib/deadlines";
import type { JobDescriptionEntry } from "@/types/workspace";

const job = (id: string, deadline?: string): JobDescriptionEntry => ({
  id,
  title: `Job ${id}`,
  company: "Example Co",
  text: "Job description",
  createdAt: "2026-09-28T12:00:00.000Z",
  deadline,
});

describe("deadline dashboard helpers", () => {
  const now = new Date("2026-09-28T15:00:00.000Z");

  it("categorizes date-only deadlines by the user's calendar day", () => {
    expect(categorizeDeadline(job("today", "2026-09-28"), now, "America/New_York").bucket).toBe("today");
    expect(categorizeDeadline(job("soon", "2026-10-01"), now, "America/New_York").bucket).toBe("within_3_days");
    expect(categorizeDeadline(job("late", "2026-09-27"), now, "America/New_York").bucket).toBe("overdue");
  });

  it("keeps unknown deadlines explicit", () => {
    expect(categorizeDeadline(job("unknown"), now, "UTC")).toMatchObject({
      bucket: "no_deadline",
      daysUntil: null,
      dateLabel: null,
    });
  });

  it("groups jobs into all dashboard buckets", () => {
    const grouped = groupDeadlines([
      job("overdue", "2026-09-27"),
      job("today", "2026-09-28"),
      job("three", "2026-10-01"),
      job("seven", "2026-10-05"),
      job("later", "2026-10-20"),
      job("unknown"),
    ], now, "UTC");

    expect(Object.values(grouped).map((items) => items.length)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});