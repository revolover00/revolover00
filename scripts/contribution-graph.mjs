/**
 * Build SVG path geometry for a contribution series.
 * Empty and single-day responses are valid edge cases: both retain a finite x range.
 *
 * @param {{ date: string, contributionCount: number }[]} days
 * @param {{ padL: number, padT: number, plotW: number, plotH: number }} bounds
 */
export function buildContributionGeometry(days, { padL, padT, plotW, plotH }) {
  const validDays = Array.isArray(days)
    ? days.filter(
        (day) =>
          day &&
          typeof day.date === "string" &&
          Number.isFinite(day.contributionCount) &&
          day.contributionCount >= 0,
      )
    : [];
  const graphDays = validDays.length > 0 ? validDays : [{ date: "", contributionCount: 0 }];
  const max = Math.max(1, ...graphDays.map((day) => day.contributionCount));
  const denominator = Math.max(1, graphDays.length - 1);
  const x = (index) => padL + (index / denominator) * plotW;
  const y = (value) => padT + plotH - (value / max) * plotH;
  const line = graphDays
    .map((day, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(day.contributionCount).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(graphDays.length - 1).toFixed(1)} ${padT + plotH} L${padL} ${padT + plotH} Z`;

  return { days: graphDays, max, x, y, line, area };
}
