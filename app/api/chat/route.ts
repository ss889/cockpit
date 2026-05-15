import '@/lib/patchAnthropicModel';
import type * as Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/anthropicClient';
import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt } from '@/lib/promptStore';

interface ParsedJD {
  role: string;
  required_skills: string[];
  required_experience: string;
  salary_range?: string;
  company?: string;
}

interface SkillGaps {
  role: string;
  required_skills: string[];
  missing_skills: string[];
  development_areas: string[];
}

// Tool definitions for Claude
const tools: Anthropic.Tool[] = [
  {
    name: 'parse_job_description',
    description: 'Parses a job description and extracts key requirements like required skills, experience level, and role details',
    input_schema: {
      type: 'object' as const,
      properties: {
        job_description: {
          type: 'string',
          description: 'The full job description text to parse',
        },
      },
      required: ['job_description'],
    },
  },
  {
    name: 'analyze_skill_gaps',
    description: 'Analyzes skill gaps between a job description and typical AI engineer profile',
    input_schema: {
      type: 'object' as const,
      properties: {
        job_description: {
          type: 'string',
          description: 'The job description to analyze',
        },
        current_skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of current skills (default AI engineer skills if not provided)',
        },
      },
      required: ['job_description'],
    },
  },
];

// Mock implementation of parse_job_description
function parseJobDescription(jobDescription: string): ParsedJD {
  // Simple parsing logic - in production, this would be more sophisticated
  const roleMatch = jobDescription.match(/(?:Role|Position|Job Title|Title)[:\s]+([^\n]+)/i);
  const role = roleMatch ? roleMatch[1].trim() : 'AI Engineer';

  // Extract skills mentioned in the JD
  const skills: string[] = [];
  jobDescription.match(/(?:Python|TypeScript|JavaScript|React|Next\.js|Node\.js|Docker|Kubernetes|AWS|GCP|Azure|PostgreSQL|MongoDB|LangChain|Claude|OpenAI|GPT|Vector DB|MCP|RAG|Anthropic)/gi)?.forEach((skill) => {
    if (!skills.includes(skill)) {
      skills.push(skill);
    }
  });

  // Default skills if none found
  if (skills.length === 0) {
    skills.push('System Design', 'Problem Solving', 'Communication');
  }

  return {
    role,
    required_skills: skills,
    required_experience: '3-5 years',
    salary_range: 'Competitive',
    company: 'TBD',
  };
}

// Mock implementation of analyze_skill_gaps
function analyzeSkillGaps(jobDescription: string): SkillGaps {
  const parsed = parseJobDescription(jobDescription);

  // Default AI engineer skills
  const defaultAIEngineerSkills = [
    'Python',
    'TypeScript',
    'React',
    'Next.js',
    'API Design',
    'System Architecture',
    'LangChain',
    'Claude API',
  ];

  const requiredSkills = parsed.required_skills;
  const missingSkills = requiredSkills.filter(
    (skill) => !defaultAIEngineerSkills.some((s) => s.toLowerCase() === skill.toLowerCase())
  );

  return {
    role: parsed.role,
    required_skills: requiredSkills,
    missing_skills: missingSkills.length > 0 ? missingSkills : ['Advanced DevOps'],
    development_areas: [
      'Deepen expertise in: ' + requiredSkills.slice(0, 2).join(', '),
      'Build production experience with: ' + requiredSkills.slice(2, 4).join(', '),
      'Explore: Cloud deployment and scaling',
    ],
  };
}

export async function POST(request: NextRequest) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const { messages, userMessage, jobDescription } = await request.json();

    const client = createAnthropicClient();

    // Build the system prompt from the editable prompt store
    const systemPromptBase = getSystemPrompt();
    const systemPrompt = systemPromptBase + (jobDescription ? `\n\nUser job description provided:\n${jobDescription}` : '');

    // Convert messages to Anthropic format
    const conversationMessages = [
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: userMessage,
      },
    ];

    const model = (process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229').trim();

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools,
      messages: conversationMessages,
    });

    // Process the response
    let assistantContent = '';
    const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        assistantContent = block.text;
      } else if (block.type === 'tool_use') {
        // Execute the tool
        let toolResult = '';

        if (block.name === 'parse_job_description') {
          const input = block.input as { job_description: string };
          const parsed = parseJobDescription(input.job_description);
          toolResult = JSON.stringify(parsed, null, 2);
        } else if (block.name === 'analyze_skill_gaps') {
          const input = block.input as { job_description: string; current_skills?: string[] };
          const gaps = analyzeSkillGaps(input.job_description);
          toolResult = JSON.stringify(gaps, null, 2);
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolResult,
        });
      }
    }

    // If tools were used, get final response from Claude
    let finalResponse = assistantContent;

    if (toolResults.length > 0) {
      // Add tool results text to the conversation and request a final response.
      const toolResultsText = toolResults.map((r) => `Tool ${r.tool_use_id}:\n${r.content}`).join('\n\n');

      const messagesWithTools = [
        ...conversationMessages,
        {
          role: 'assistant' as const,
          content: assistantContent || '',
        },
        {
          role: 'user' as const,
          content: `Here are the tool results:\n\n${toolResultsText}\n\nPlease produce a final assistant reply that incorporates these results.`,
        },
      ];

      const finalMessage = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messagesWithTools,
      });

      // Extract text from final response
      for (const block of finalMessage.content) {
        if (block.type === 'text') {
          finalResponse = block.text;
          break;
        }
      }
    }

    return NextResponse.json({
      content: finalResponse,
      toolResults,
    });
  } catch (error) {
    console.error('Chat error:', error);
    const errorMessage = (error as any)?.message || String(error);
    return NextResponse.json(
      { error: `API Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
