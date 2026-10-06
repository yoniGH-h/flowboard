// Deterministic synthetic trend generator for Phase 1 dashboards/reports.
// Produces a plausible upward completion trend ending at the current actual value,
// without relying on historical snapshots that are not stored by the API.

export function buildCompletionTrend(currentCompleted, weeks = 8) {
  const points = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekIndex = weeks - 1 - i;
    const progressRatio = (weeks - i) / weeks;
    const wobble = Math.sin(weekIndex * 1.3) * 3;
    const completed = Math.max(0, Math.min(100, Math.round(currentCompleted * progressRatio + wobble)));
    const planned = Math.max(0, Math.min(100, Math.round((100 / weeks) * (weekIndex + 1))));
    points.push({ label: `W-${i}`, planned, completed });
  }
  points[points.length - 1] = { ...points[points.length - 1], completed: currentCompleted };
  return points;
}

// Small illustrative sparkline ending at `current`, for the mini trend strip on KPI cards.
// Same rationale as buildCompletionTrend: no per-day history is stored yet.
export function buildSparkline(current, points = 6, seed = 1) {
  const values = [];
  for (let i = 0; i < points; i += 1) {
    const wobble = Math.sin((i + seed) * 1.7) * Math.max(1, current * 0.18);
    const ramp = current * (0.6 + 0.4 * (i / (points - 1)));
    values.push(Math.max(0, Math.round(ramp + wobble)));
  }
  values[values.length - 1] = current;
  return values;
}
