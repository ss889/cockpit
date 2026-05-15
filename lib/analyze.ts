import Anthropic from '@anthropic-ai/sdk';
import { tools, parseToolResults } from './tools';
import { getSystemPrompt } from './promptStore';
import { saveJobDescription, searchSimilar } from './database';

export async function runAnalyze(jd: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('API key not configured');

  const client = new Anthropic({ apiKey });

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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
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

  const textResponse = textBlocks.join('\n\n') || fallbackSummary || 'Analysis complete.';

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
  };
}
