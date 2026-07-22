import type { ResumeProfile } from "@/types/profile";
import type { InterviewPrepPacket } from "@/types/workspace";

export const evalResumeProfile: ResumeProfile = {
  header: {
    name: "Sadikul Saber",
    phone: "555-555-5555",
    email: "sadikul@example.com",
    linkedin: "linkedin.com/in/sadikul",
    github: "github.com/ss889",
  },
  education: [
    {
      school: "NJIT",
      location: "Newark, NJ",
      degree: "B.S. Computer Science",
      dates: "May 2026",
    },
  ],
  skills: [
    {
      category: "AI & ML",
      items: ["LLMs", "RAG", "Claude API", "Prompt Engineering"],
    },
    {
      category: "Engineering",
      items: ["TypeScript", "Python", "Next.js", "Docker", "pytest"],
    },
  ],
  projects: [
    {
      id: "jobops-ai",
      title: "JobOps AI",
      tags: "TypeScript, Next.js, Claude API, RAG, SQLite",
      status: "Ongoing",
      bullets: [
        "Built a career cockpit that saves job descriptions, generates tailored LaTeX resumes, and stores local interview prep packets.",
        "Improved resume tailoring quality across saved job workflows by adding deterministic QA checks for unsupported metrics and formulaic phrasing.",
      ],
    },
    {
      id: "funding-scraper",
      title: "AI Funding Data Scraper",
      tags: "Python, SQLite, Docker, pytest",
      status: "Ongoing",
      bullets: [
        "Processed 500 startup funding records with Python validation, SQLite storage, deduplication, and retry handling.",
        "Tested scraper behavior with mocked HTTP responses and scheduled runs through a containerized pipeline.",
      ],
    },
  ],
  experience: [
    {
      id: "research-assistant",
      title: "Research Assistant",
      company: "NJIT",
      location: "Newark, NJ",
      dates: "2025",
      bullets: [
        "Cleaned 500 rows of dataset exports using Python validation scripts.",
        "Shipped 3 TypeScript dashboard views with reusable chart components.",
      ],
    },
  ],
};

export const evalJobDescriptions = [
  {
    name: "labeled AI engineer internship",
    text: [
      "Job Title: AI Engineer Intern",
      "Company: The Muse",
      "Responsibilities",
      "Build and evaluate AI product features with Python, TypeScript, and model quality testing.",
    ].join("\n"),
    expectedTitle: "AI Engineer Intern",
    expectedCompany: "The Muse",
  },
  {
    name: "greenhouse page title fallback",
    text: [
      "Applied AI Engineer",
      "Remote",
      "You will develop RAG systems, evaluate model outputs, and collaborate with product engineers.",
    ].join("\n"),
    url: "https://boards.greenhouse.io/exampleai/jobs/123",
    pageTitle: "Applied AI Engineer - Example AI",
    expectedTitle: "Applied AI Engineer",
    expectedCompany: "Example AI",
  },
];

export const evalInterviewPrep: InterviewPrepPacket = {
  generatedAt: "2026-07-16T12:00:00.000Z",
  roleSummary: "This role values practical AI product development, evaluation habits, and clear collaboration with engineering teams.",
  likelyScreenQuestions: [
    "How have you used LLMs in a production-style project?",
    "What kind of AI engineering work are you looking for?",
  ],
  technicalQuestions: [
    "How would you evaluate whether a RAG answer is grounded?",
    "How would you structure a test suite for a resume tailoring workflow?",
  ],
  behavioralQuestions: [
    "Tell me about a time you improved output quality after feedback.",
    "Tell me about a time you worked through ambiguity.",
  ],
  talkingPoints: [
    "Connect JobOps AI to the role's product-oriented AI work.",
    "Use the funding scraper to show Python data pipeline judgment.",
  ],
  gapBrief: [
    "If asked about deep TensorFlow work, be honest that your strongest work is applied LLM systems.",
    "Bridge that gap by discussing evaluation, testing, and willingness to learn framework-specific workflows.",
  ],
  tellMeAboutYourself: "I am a CS student focused on applied AI tools, especially career workflows that combine TypeScript, Python, and Claude API.",
  whyThisRole: "This role fits my interest in practical AI products where model quality, user workflows, and engineering discipline all matter.",
  stories: [
    {
      prompt: "Quality improvement story",
      answerOutline: "Explain how deterministic QA checks improved tailored resume outputs in JobOps AI.",
      resumeEvidence: "JobOps AI added QA checks for unsupported metrics, dash punctuation, and formulaic phrasing.",
    },
  ],
};
