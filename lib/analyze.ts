import Anthropic from '@anthropic-ai/sdk';
import './patchAnthropicModel';
import { createAnthropicClient } from './anthropicClient';
import { tools, parseToolResults } from './tools';
import { getSystemPrompt } from './promptStore';
import { saveJobDescription, searchSimilar } from './database';

export async function runAnalyze(jd: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('API key not configured');

  const client = createAnthropicClient();

  let ragMatches = [];
  try {
    const vector = await import('./vector');
    const emb = await import('./embeddings');
    if (emb.embeddingsAvailable()) {
      ragMatches = await vector.searchByEmbedding(jd, 3);
    } else {
      ragMatches = searchSimilar(jd, 3);
    }
  } catch (e) {
    ragMatches = searchSimilar(jd, 3);
  }

  const ragText = ragMatches.length
    ? 'Relevant corpus excerpts:\n\n' + ragMatches.map((m: any) => `- (${m.createdAt}) ${m.text.slice(0, 800)}`).join('\n\n---\n\n')
    : '';

  const systemPromptWithRag = getSystemPrompt() + (ragText ? '\n\n' + ragText : '');

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: systemPromptWithRag,
    tools: tools,
    messages: [
      {
        role: 'user',
        content: `Analyze this job description. Call all three tools in sequence:\n\n${jd}`,
      },
    ],
  });

  const parsedResults = parseToolResults(response.content);
  const textBlocks = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text.trim())
    .filter(Boolean);

  const fallbackSummary = [
    parsedResults.parsed
      ? `Role Overview: ${parsedResults.parsed.job_title} at ${parsedResults.parsed.company}`
      : null,
    parsedResults.gap
      ? `Fit Score: ${parsedResults.gap.fit_score}/100 (${parsedResults.gap.fit_label})`
      : null,
    parsedResults.projects
      ? `Suggested Projects: ${parsedResults.projects.projects.map((p) => p.title).join('; ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const preamble = textBlocks.join('\n\n');
  const textResponse = [preamble, fallbackSummary].filter(Boolean).join('\n\n\n---\n\n\n') || 'Analysis complete.';

  // Generate software/tooling suggestions for any suggested projects.
  let softwareSuggestions: string | null = null;
  try {
    if (parsedResults.projects && Array.isArray(parsedResults.projects.projects) && parsedResults.projects.projects.length) {
      const projectsForPrompt = parsedResults.projects.projects.map((p: any) => ({ title: p.title, description: p.description || p.summary || '' }));
      const projectsJson = JSON.stringify(projectsForPrompt, null, 2);

      const swResp = await client.messages.create({
        model,
        max_tokens: 800,
        system: 'You are an assistant that lists the software, frameworks, libraries, and tools needed to build small projects. Return only JSON describing the required software for each project.',
        messages: [
          {
            role: 'user',
            content: `Given these projects extracted from a job description:\n\n${projectsJson}\n\nFor each project, produce a JSON object with project titles as keys and arrays of software/tool objects as values. Each software/tool object should include: name, category (IDE/language/framework/tool/database/cli/etc.), and an optional recommended_version or reason. Return only valid JSON.`,
          },
        ],
      });

      const swTextBlocks = swResp.content
        .filter((b: any): b is Anthropic.TextBlock => b.type === 'text')
        .map((b: any) => b.text.trim())
        .filter(Boolean);

      softwareSuggestions = swTextBlocks.join('\n\n') || null;
    }
  } catch (e) {
    console.warn('Software suggestion generation failed:', e);
  }

  try {
    saveJobDescription(jd, { analysis: parsedResults });
  } catch (e) {
    console.warn('Failed to save JD to corpus:', e);
  }

  return {
    content: response.content,
    text: textResponse,
    analysis: parsedResults,
    ragMatches,
    softwareSuggestions,
  };
}
