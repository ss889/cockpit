import { describe, it, expect } from 'vitest';
import { parseToolResults } from '@/lib/tools';
import Anthropic from '@anthropic-ai/sdk';

describe('parseToolResults', () => {
  it('correctly extracts parse_job_description result', () => {
    const content: Anthropic.ContentBlock[] = [
      {
        type: 'tool_use',
        id: '1',
        name: 'parse_job_description',
        input: {
          job_title: 'AI Engineer',
          company: 'TechCorp',
          role_type: 'AI Engineer',
          top_responsibilities: ['Build systems', 'Deploy models', 'Optimize pipelines'],
          required_skills: ['Python', 'TensorFlow'],
          preferred_skills: ['Docker'],
          seniority: 'Mid',
        },
      } as unknown as Anthropic.ToolUseBlock,
    ];

    const result = parseToolResults(content);
    expect(result.parsed).toBeDefined();
    expect(result.parsed?.job_title).toBe('AI Engineer');
    expect(result.parsed?.company).toBe('TechCorp');
    expect(result.parsed?.required_skills).toContain('Python');
    expect(result.parsed?.top_responsibilities.length).toBe(3);
  });

  it('correctly extracts analyze_skill_gap result', () => {
    const content: Anthropic.ContentBlock[] = [
      {
        type: 'tool_use',
        id: '2',
        name: 'analyze_skill_gap',
        input: {
          matching_skills: ['Python', 'React'],
          gap_skills: ['Kubernetes', 'gRPC'],
          gap_summary: 'Strong foundation but needs DevOps expertise.',
          fit_score: 72,
          fit_label: 'Developing Fit',
        },
      } as unknown as Anthropic.ToolUseBlock,
    ];

    const result = parseToolResults(content);
    expect(result.gap).toBeDefined();
    expect(result.gap?.fit_score).toBe(72);
    expect(result.gap?.fit_label).toBe('Developing Fit');
    expect(result.gap?.matching_skills).toContain('Python');
    expect(result.gap?.gap_skills.length).toBe(2);
  });

  it('returns null for missing tool', () => {
    const content: Anthropic.ContentBlock[] = [
      {
        type: 'text',
        text: 'Some response',
      },
    ];

    const result = parseToolResults(content);
    expect(result.parsed).toBeNull();
    expect(result.gap).toBeNull();
    expect(result.projects).toBeNull();
  });

  it('handles multiple tool_use blocks in one content array', () => {
    const content: Anthropic.ContentBlock[] = [
      {
        type: 'tool_use',
        id: '1',
        name: 'parse_job_description',
        input: {
          job_title: 'Engineer',
          company: 'Company',
          role_type: 'AI Engineer',
          top_responsibilities: ['a'],
          required_skills: ['Python'],
          preferred_skills: [],
          seniority: 'Mid',
        },
      } as unknown as Anthropic.ToolUseBlock,
      {
        type: 'tool_use',
        id: '2',
        name: 'analyze_skill_gap',
        input: {
          matching_skills: ['Python'],
          gap_skills: ['Rust'],
          gap_summary: 'Some summary',
          fit_score: 50,
          fit_label: 'Early Stage',
        },
      } as unknown as Anthropic.ToolUseBlock,
      {
        type: 'tool_use',
        id: '3',
        name: 'suggest_projects',
        input: {
          projects: [
            {
              title: 'Project 1',
              description: 'A project',
              skills_addressed: ['Rust'],
              difficulty: 'Weekend',
              why_it_matters: 'Relevant',
            },
            {
              title: 'Project 2',
              description: 'Another project',
              skills_addressed: ['Go'],
              difficulty: '1 Week',
              why_it_matters: 'Useful',
            },
          ],
        },
      } as unknown as Anthropic.ToolUseBlock,
    ];

    const result = parseToolResults(content);
    expect(result.parsed).toBeDefined();
    expect(result.gap).toBeDefined();
    expect(result.projects).toBeDefined();
    expect(result.projects?.projects.length).toBe(2);
  });
});
