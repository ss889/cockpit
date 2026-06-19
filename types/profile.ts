export interface ResumeProfile {
  header: {
    name: string;
    phone: string;
    email: string;
    linkedin: string;
    github: string;
  };
  education: {
    school: string;
    location: string;
    degree: string;
    dates: string;
  }[];
  skills: {
    category: string;
    items: string[];
  }[];
  projects: {
    id: string;
    title: string;
    tags: string;
    status: string;
    bullets: string[];
  }[];
  experience: {
    id: string;
    title: string;
    company: string;
    location: string;
    dates: string;
    bullets: string[];
  }[];
}

export interface QAIssue {
  type: string;
  location: string;
  detail: string;
}

export interface TailorResponse {
  profile: ResumeProfile;
  latex: string;
  keywords: string[];
  qa: {
    before: QAIssue[];
    after: QAIssue[];
    autoFixed: boolean;
  };
}
