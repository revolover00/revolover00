import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContributionGeometry } from './contribution-graph.mjs';

const bounds = { padL: 40, padT: 66, plotW: 856, plotH: 154 };

test('empty contribution data produces a finite placeholder path', () => {
  const graph = buildContributionGeometry([], bounds);
  assert.equal(graph.days.length, 1);
  assert.equal(graph.days[0].contributionCount, 0);
  assert.match(graph.line, /^M40\.0 220\.0$/);
  assert.doesNotMatch(`${graph.line} ${graph.area}`, /NaN|Infinity/);
});

test('a single contribution day does not divide by zero', () => {
  const graph = buildContributionGeometry([{ date: '2026-11-20', contributionCount: 4 }], bounds);
  assert.equal(graph.days.length, 1);
  assert.match(graph.line, /^M40\.0 /);
  assert.doesNotMatch(`${graph.line} ${graph.area}`, /NaN|Infinity/);
});

test('multiple days span the available plot width', () => {
  const graph = buildContributionGeometry(
    [
      { date: '2026-11-18', contributionCount: 0 },
      { date: '2026-11-19', contributionCount: 2 },
      { date: '2026-11-20', contributionCount: 4 },
    ],
    bounds,
  );
  assert.equal(graph.x(0), 40);
  assert.equal(graph.x(2), 896);
  assert.match(graph.line, /L896\.0 66\.0$/);
});
