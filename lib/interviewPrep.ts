import type { InterviewPrepPacket } from "@/types/workspace";

export function renderInterviewPrepMarkdown(jobTitle: string, company: string, prep: InterviewPrepPacket): string {
  const title = `${jobTitle || "Saved job"}${company ? ` at ${company}` : ""}`;

  return [
    `# Interview Prep: ${title}`,
    "",
    `Generated: ${new Date(prep.generatedAt).toLocaleString()}`,
    "",
    "## Role Read",
    prep.roleSummary,
    "",
    "## Tell Me About Yourself",
    prep.tellMeAboutYourself,
    "",
    "## Why This Role",
    prep.whyThisRole,
    "",
    renderList("Likely Screen Questions", prep.likelyScreenQuestions),
    renderList("Technical Questions", prep.technicalQuestions),
    renderList("Behavioral Questions", prep.behavioralQuestions),
    renderList("Talking Points", prep.talkingPoints),
    renderList("Gap Brief", prep.gapBrief),
    "## Story Bank",
    ...prep.stories.flatMap((story, index) => [
      "",
      `### Story ${index + 1}: ${story.prompt}`,
      "",
      `Outline: ${story.answerOutline}`,
      "",
      `Evidence: ${story.resumeEvidence}`,
    ]),
    "",
  ].join("\n");
}

function renderList(title: string, items: string[]): string {
  return [`## ${title}`, ...items.map((item) => `- ${item}`), ""].join("\n");
}
