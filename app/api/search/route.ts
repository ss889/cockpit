import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface JobResult {
  title: string;
  company: string;
  location: string;
  description: string;
  link: string;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return Response.json(
        { error: 'Invalid query' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      tools: [
        {
          type: 'web_search',
          name: 'web_search',
        } as any,
      ],
      system: `You are a job search assistant. Search for real job listings matching the user's query.
After searching, return ONLY a JSON array with no extra text, no markdown, no backticks.
Each item in the array must have exactly these fields (all strings):
- title: job title
- company: company name  
- location: city, state, or "Remote"
- description: one sentence about the role
- link: direct URL to the job listing

Return valid JSON only. No explanations.`,
      messages: [
        {
          role: 'user',
          content: `Search for job listings matching this query: ${query}`,
        },
      ],
    });

    // Extract text from response
    let jobsText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        jobsText = block.text;
        break;
      }
    }

    // Parse JSON
    let jobs: JobResult[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = jobsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jobs = JSON.parse(jsonMatch[0]);
      } else {
        jobs = JSON.parse(jobsText);
      }
    } catch (parseErr) {
      console.error('Parse error:', parseErr, 'Text:', jobsText);
      return Response.json(
        { error: 'Failed to parse search results', jobs: [] },
        { status: 200 }
      );
    }

    return Response.json({ jobs });
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      { error: error instanceof Error ? `API Error: ${error.message}` : 'Search failed', jobs: [] },
      { status: 500 }
    );
  }
}
