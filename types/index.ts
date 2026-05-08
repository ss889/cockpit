export interface ParseJobDescriptionOutput {
  job_title: string;
  company: string;
  role_type: "FDE" | "AI Engineer" | "AI Product Engineer" | "Other";
  top_responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  seniority: "Junior" | "Mid" | "Senior" | "Not specified";
}

export interface AnalyzeSkillGapOutput {
  matching_skills: string[];
  gap_skills: string[];
  gap_summary: string;
  fit_score: number;
  fit_label: "Strong Fit" | "Developing Fit" | "Early Stage";
}

export interface SuggestedProject {
  title: string;
  description: string;
  skills_addressed: string[];
  difficulty: "Weekend" | "1 Week" | "1 Month";
  why_it_matters: string;
}

export interface SuggestProjectsOutput {
  projects: SuggestedProject[];
}

export interface AnalysisResult {
  parsed: ParseJobDescriptionOutput | null;
  gap: AnalyzeSkillGapOutput | null;
  projects: SuggestProjectsOutput | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SavedRole {
  id: string;
  title: string;
  jd: string;
  savedAt: string;
}

export interface APIAnalyzeRequest {
  jd: string;
  history?: Message[];
  question?: string;
}

export interface APIAnalyzeResponse {
  content?: any;
  error?: string;
}
