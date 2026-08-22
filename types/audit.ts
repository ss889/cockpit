export type AuditKeywordCategory = "required" | "nice_to_have" | "soft_skills";

export type AuditKeywordGroups = {
  required: string[];
  nice_to_have: string[];
  soft_skills: string[];
};

export type KeywordStatus = "present" | "weak" | "missing";

export type HonestyFlag = "safe" | "verify_first" | "do_not_add";

export type KeywordResult = {
  keyword: string;
  category: AuditKeywordCategory;
  status: KeywordStatus;
  reason: string;
  honestyFlag: HonestyFlag;
};

export type FormatResult = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type AuditGap = {
  keyword: string;
  category: AuditKeywordCategory;
  status: Exclude<KeywordStatus, "present">;
  whyItMatters: string;
  honestyFlag: HonestyFlag;
};

export type AuditSuggestion = {
  rank: number;
  keyword: string;
  change: string;
  location: string;
  estimatedImpact: number;
  honestyFlag: HonestyFlag;
};

export type AuditReport = {
  generatedAt: string;
  score: number;
  keywordResults: KeywordResult[];
  formatResults: FormatResult[];
  gaps: AuditGap[];
  suggestions: AuditSuggestion[];
};
