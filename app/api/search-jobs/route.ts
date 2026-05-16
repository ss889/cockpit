import { NextRequest, NextResponse } from 'next/server';

interface JobResult {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  posted?: string;
}

/**
 * Searches multiple free job APIs and constructs direct search URLs.
 * No additional API keys required.
 */
async function searchJobs(query: string, location?: string): Promise<JobResult[]> {
  const results: JobResult[] = [];
  const encodedQuery = encodeURIComponent(query);
  const encodedLocation = encodeURIComponent(location || 'United States');

  // 1. Try Remotive API (free, no key needed) for remote jobs
  try {
    const remotiveResp = await fetch(
      `https://remotive.com/api/remote-jobs?search=${encodedQuery}&limit=5`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (remotiveResp.ok) {
      const data = await remotiveResp.json();
      for (const job of (data.jobs || []).slice(0, 5)) {
        results.push({
          title: job.title,
          company: job.company_name,
          location: job.candidate_required_location || 'Remote',
          url: job.url,
          source: 'Remotive',
          posted: job.publication_date,
        });
      }
    }
  } catch (e) {
    console.warn('Remotive API failed:', e);
  }

  // 2. Try Arbeitnow API (free, no key needed)
  try {
    const arbeitnowResp = await fetch(
      `https://www.arbeitnow.com/api/job-board-api?search=${encodedQuery}&page=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (arbeitnowResp.ok) {
      const data = await arbeitnowResp.json();
      for (const job of (data.data || []).slice(0, 5)) {
        results.push({
          title: job.title,
          company: job.company_name,
          location: job.location || 'Remote',
          url: job.url,
          source: 'Arbeitnow',
          posted: job.created_at,
        });
      }
    }
  } catch (e) {
    console.warn('Arbeitnow API failed:', e);
  }

  // 3. Always include direct job board search links
  const searchLinks: JobResult[] = [
    {
      title: `Search "${query}" on LinkedIn`,
      company: 'LinkedIn Jobs',
      location: location || 'United States',
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodedQuery}&location=${encodedLocation}`,
      source: 'LinkedIn',
    },
    {
      title: `Search "${query}" on Indeed`,
      company: 'Indeed',
      location: location || 'United States',
      url: `https://www.indeed.com/jobs?q=${encodedQuery}&l=${encodedLocation}`,
      source: 'Indeed',
    },
    {
      title: `Search "${query}" on Glassdoor`,
      company: 'Glassdoor',
      location: location || 'United States',
      url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodedQuery}`,
      source: 'Glassdoor',
    },
    {
      title: `Search "${query}" on Wellfound (AngelList)`,
      company: 'Wellfound',
      location: location || 'United States',
      url: `https://wellfound.com/jobs?query=${encodedQuery}`,
      source: 'Wellfound',
    },
  ];

  return [...results, ...searchLinks];
}

export async function POST(request: NextRequest) {
  try {
    const { query, location } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const jobs = await searchJobs(query, location);

    return NextResponse.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error('Job search error:', error);
    return NextResponse.json(
      { error: 'Failed to search jobs' },
      { status: 500 }
    );
  }
}
