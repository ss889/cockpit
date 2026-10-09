import { describe, it, expect } from 'vitest';
import { tools } from '@/lib/tools';

type ToolSchema = {
  required?: string[];
  properties?: Record<string, { enum?: string[]; minItems?: number; maxItems?: number; }>; 
};

describe('Tool Definitions', () => {
  describe('parse_job_description tool', () => {
    it('has correct required fields', () => {
      const tool = tools.find((t) => t.name === 'parse_job_description');
      expect(tool).toBeDefined();

      const required = ((tool?.input_schema as ToolSchema)?.required ?? []);
      expect(required).toContain('job_title');
      expect(required).toContain('company');
      expect(required).toContain('role_type');
      expect(required).toContain('top_responsibilities');
      expect(required).toContain('required_skills');
      expect(required).toContain('seniority');
    });
  });

  describe('analyze_skill_gap tool', () => {
    it('has correct required fields', () => {
      const tool = tools.find((t) => t.name === 'analyze_skill_gap');
      expect(tool).toBeDefined();

      const required = ((tool?.input_schema as ToolSchema)?.required ?? []);
      expect(required).toContain('matching_skills');
      expect(required).toContain('gap_skills');
      expect(required).toContain('gap_summary');
      expect(required).toContain('fit_score');
      expect(required).toContain('fit_label');
    });
  });

  describe('suggest_projects tool', () => {
    it('enforces exactly 2 projects', () => {
      const tool = tools.find((t) => t.name === 'suggest_projects');
      expect(tool).toBeDefined();

      const properties = (tool?.input_schema as ToolSchema).properties ?? {};
      const projects = properties.projects ?? {};
      expect(projects.minItems).toBe(2);
      expect(projects.maxItems).toBe(2);
    });

    it('fit_label enum has valid values', () => {
      const tool = tools.find((t) => t.name === 'analyze_skill_gap');
      expect(tool).toBeDefined();

      const properties = (tool?.input_schema as ToolSchema).properties ?? {};
      const fitLabelEnum = properties.fit_label?.enum ?? [];
      expect(fitLabelEnum).toEqual(['Strong Fit', 'Developing Fit', 'Early Stage']);
      expect(fitLabelEnum.length).toBe(3);
    });
  });
});
