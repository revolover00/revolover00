#!/usr/bin/env node
/**
 * Regenerates assets/stats.svg and assets/contrib.svg from the GitHub GraphQL API.
 * Usage:  GITHUB_TOKEN=xxx node scripts/gen-stats.mjs [login]
 * Local:  GITHUB_TOKEN=$(gh auth token) node scripts/gen-stats.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const LOGIN = process.argv[2] || process.env.GH_LOGIN || 'revolover00';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error('GITHUB_TOKEN is required'); process.exit(1); }

const RED = '#C1121F', CREAM = '#E8E1D5', MUTED = '#8C8378', BG = '#0A0807', LINE = '#231A18';
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const query = `
query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes { stargazerCount }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-readme' },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
if (!res.ok) { console.error('API error', res.status, await res.text()); process.exit(1); }
const payload = await res.json();
if (payload.errors) console.error(JSON.stringify(payload.errors));
const user = payload.data?.user;
if (!user) { console.error('user not found'); process.exit(1); }

const days = user.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays);
const total = user.contributionsCollection.contributionCalendar.totalContributions;
const stars = user.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
const repos = user.repositories.totalCount;
const followers = user.followers.totalCount;

// current streak
let streak = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount > 0) streak++;
  else if (i === days.length - 1) continue; // today may be 0
  else break;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmt = (n) => n.toLocaleString('en-US');

/* ------------------------------------------------------------ stats card */
const cells = [
  ['CONTRIBUTIONS', fmt(total)],
  ['DAY STREAK', fmt(streak)],
  ['REPOSITORIES', fmt(repos)],
  ['STARS', fmt(stars)],
  ['FOLLOWERS', fmt(followers)],
];

const SW = 920, SH = 168, cw = SW / cells.length;
const statsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}" role="img" aria-label="GitHub statistics">
  <title>GitHub statistics</title>
  <rect x="0.5" y="0.5" width="${SW - 1}" height="${SH - 1}" fill="${BG}" stroke="${LINE}"/>
  ${cells.map((c, i) => `
  <g>
    <text x="${cw * i + cw / 2}" y="46" text-anchor="middle" font-family="${MONO}" font-size="9.5" letter-spacing="3" fill="${RED}">${c[0]}</text>
    <text x="${cw * i + cw / 2}" y="108" text-anchor="middle" font-family="${SERIF}" font-size="46" fill="${CREAM}">${c[1]}</text>
    ${i ? `<line x1="${cw * i}" y1="34" x2="${cw * i}" y2="134" stroke="${LINE}"/>` : ''}
  </g>`).join('')}
  <rect x="0" y="${SH - 3}" width="${SW}" height="3" fill="${RED}"/>
</svg>`;

/* ------------------------------------------------------- contribution graph */
const GW = 920, GH = 260;
const padL = 40, padR = 24, padT = 54, padB = 40;
const plotW = GW - padL - padR, plotH = GH - padT - padB;
const max = Math.max(1, ...days.map(d => d.contributionCount));
const x = i => padL + (i / (days.length - 1)) * plotW;
const y = v => padT + plotH - (v / max) * plotH;

const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.contributionCount).toFixed(1)}`).join(' ');
const area = `${line} L${x(days.length - 1).toFixed(1)} ${padT + plotH} L${padL} ${padT + plotH} Z`;

const months = [];
let lastMonth = -1;
days.forEach((d, i) => {
  const m = new Date(d.date + 'T00:00:00Z').getUTCMonth();
  if (m !== lastMonth) { months.push({ i, label: new Date(d.date + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase() }); lastMonth = m; }
});

const contribSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GW}" height="${GH}" viewBox="0 0 ${GW} ${GH}" role="img" aria-label="Contribution activity">
  <title>Contribution activity — ${fmt(total)} in the last year</title>
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${RED}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${RED}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${GW - 1}" height="${GH - 1}" fill="${BG}" stroke="${LINE}"/>
  <text x="${padL}" y="32" font-family="${MONO}" font-size="10" letter-spacing="4" fill="${RED}">CONTRIBUTION ACTIVITY</text>
  <text x="${GW - padR}" y="32" text-anchor="end" font-family="${MONO}" font-size="10" letter-spacing="3" fill="${MUTED}">${fmt(total)} IN THE LAST YEAR</text>
  ${[0.25, 0.5, 0.75, 1].map(f => `<line x1="${padL}" y1="${(padT + plotH - f * plotH).toFixed(1)}" x2="${GW - padR}" y2="${(padT + plotH - f * plotH).toFixed(1)}" stroke="${CREAM}" stroke-opacity="0.07"/>`).join('')}
  <line x1="${padL}" y1="${padT + plotH}" x2="${GW - padR}" y2="${padT + plotH}" stroke="${CREAM}" stroke-opacity="0.2"/>
  <path d="${area}" fill="url(#fade)"/>
  <path d="${line}" fill="none" stroke="${RED}" stroke-width="1.4" stroke-linejoin="round"/>
  ${months.map(m => `<text x="${x(m.i).toFixed(1)}" y="${GH - 14}" font-family="${MONO}" font-size="9" letter-spacing="1.5" fill="${MUTED}">${m.label}</text>`).join('\n  ')}
  <rect x="0" y="${GH - 3}" width="${GW}" height="3" fill="${RED}"/>
</svg>`;

const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'assets');
fs.writeFileSync(path.join(out, 'stats.svg'), statsSvg);
fs.writeFileSync(path.join(out, 'contrib.svg'), contribSvg);
console.log(`stats.svg + contrib.svg written — ${fmt(total)} contributions, ${stars} stars, ${repos} repos, ${followers} followers, streak ${streak}d`);
