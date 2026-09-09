#!/usr/bin/env node
// Automated job scanner — hits Greenhouse, Ashby, and Lever public APIs.
// Run by GitHub Actions every 2 hours. No dependencies beyond Node.js 18+.

import { readFileSync, writeFileSync, existsSync } from 'fs';

const TITLE_POSITIVE = [
  'HR Coordinator', 'People Coordinator', 'People Operations',
  'Talent Coordinator', 'HR Assistant', 'HR Generalist',
  'Human Resources Coordinator', 'People Ops', 'HR Administrator',
  'Recruiting Coordinator', 'Onboarding Coordinator', 'Personalreferent',
  'Customer Success Associate', 'Customer Success Coordinator',
  'Account Coordinator', 'Client Success', 'Customer Onboarding',
  'Client Coordinator', 'Customer Experience Associate',
  'Event Coordinator', 'Event Manager', 'Event Producer',
  'Production Coordinator', 'Brand Activation', 'Activation Coordinator',
  'Experiential', 'Sponsorship Activation',
  'Office Manager', 'Office Coordinator', 'Operations Coordinator',
  'Project Coordinator', 'Studio Manager', 'Studio Coordinator',
  'Resources Manager', 'Traffic Manager', 'Logistics Coordinator',
];

const TITLE_NEGATIVE = [
  'Intern', '.NET', 'Sales Operations', 'Revenue Operations',
  'iOS', 'Android', 'PHP', 'Ruby', 'Blockchain', 'Web3', 'Crypto',
  'COBOL', 'Mainframe', 'SAP ', 'Salesforce Admin',
];

const SEEN_PATH = 'seen-jobs.json';
const COMPANIES_PATH = 'companies.json';
const NEW_JOBS_PATH = 'new-jobs.json';

function passesFilter(title) {
  const t = title.toLowerCase();
  if (TITLE_NEGATIVE.some(n => t.includes(n.toLowerCase()))) return false;
  return TITLE_POSITIVE.some(p => t.toLowerCase().includes(p.toLowerCase()));
}

function loadSeen() {
  if (!existsSync(SEEN_PATH)) return new Set();
  return new Set(JSON.parse(readFileSync(SEEN_PATH, 'utf8')));
}

function saveSeen(seen) {
  writeFileSync(SEEN_PATH, JSON.stringify([...seen], null, 2) + '\n');
}

async function fetchGreenhouse(company) {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs`,
      { headers: { 'User-Agent': 'career-scanner/1.0' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map(j => ({
      title: j.title,
      url: j.absolute_url,
      company: company.name,
      location: j.location?.name || '',
    }));
  } catch {
    return [];
  }
}

async function fetchAshby(company) {
  try {
    const res = await fetch('https://jobs.ashbyhq.com/api/non-user-graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'User-Agent': 'career-scanner/1.0' },
      body: JSON.stringify({
        operationName: 'ApiJobBoardWithTeams',
        variables: { organizationHostedJobsPageName: company.slug },
        query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
          jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
            teams {
              jobs {
                id
                title
                locationName
                isRemote
                externalLink
              }
            }
          }
        }`,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = [];
    for (const team of data?.data?.jobBoard?.teams || []) {
      for (const job of team.jobs || []) {
        jobs.push({
          title: job.title,
          url: job.externalLink || `https://jobs.ashbyhq.com/${company.slug}/${job.id}`,
          company: company.name,
          location: job.locationName || (job.isRemote ? 'Remote' : ''),
        });
      }
    }
    return jobs;
  } catch {
    return [];
  }
}

async function fetchLever(company) {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${company.slug}?mode=json&limit=250`,
      { headers: { 'User-Agent': 'career-scanner/1.0' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map(j => ({
      title: j.text,
      url: j.hostedUrl,
      company: company.name,
      location: j.categories?.location || '',
    }));
  } catch {
    return [];
  }
}

async function main() {
  const companies = JSON.parse(readFileSync(COMPANIES_PATH, 'utf8'));
  const seen = loadSeen();
  const newJobs = [];

  console.log(`Scanning ${companies.length} companies...`);

  for (const company of companies) {
    let jobs = [];
    if (company.type === 'greenhouse') jobs = await fetchGreenhouse(company);
    else if (company.type === 'ashby')      jobs = await fetchAshby(company);
    else if (company.type === 'lever')      jobs = await fetchLever(company);

    for (const job of jobs) {
      if (!passesFilter(job.title)) continue;
      const key = `${job.url}`;
      if (seen.has(key)) continue;
      newJobs.push(job);
      seen.add(key);
    }

    process.stdout.write('.');
  }

  console.log();
  saveSeen(seen);
  writeFileSync(NEW_JOBS_PATH, JSON.stringify(newJobs, null, 2) + '\n');

  if (newJobs.length === 0) {
    console.log('No new jobs found.');
    return;
  }

  console.log(`\nFound ${newJobs.length} new job(s):`);
  for (const job of newJobs) {
    console.log(`  [${job.company}] ${job.title}${job.location ? ' — ' + job.location : ''}`);
    console.log(`    ${job.url}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
