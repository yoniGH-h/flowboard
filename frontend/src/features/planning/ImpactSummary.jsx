// תפקיד הקובץ: סיכום השפעה: לפני ואחרי.
// משתמשים בו: RecommendationsPanel.jsx, SimulatorPanel.jsx

import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { formatDate } from '../../lib/format';

// Before -> after of a what-if change: forecast, days late, open tasks, delay risk (and, in
// the full version, each risk factor), plus whose workload changes.

function forecastText(f) {
  if (f.status === 'done') return 'All done';
  if (f.status === 'stalled') return 'Stalled';
  return `${formatDate(f.forecastDate)}${f.confident ? '' : ' (rough)'}`;
}

const lateText = (f) => (f.daysLate == null ? '—' : f.daysLate > 0 ? `${f.daysLate} days late` : 'On time');

// Lower is better for both days late and risk. Returns a colour for the "after" value.
function deltaColor(before, after) {
  if (before == null || after == null || before === after) return 'text.primary';
  return after < before ? 'success.main' : 'error.main';
}

// השוואת סיכון, צפי ועומס לפני ואחרי שינוי.
// נקרא מ: RecommendationsPanel.jsx, SimulatorPanel.jsx
export function ImpactSummary({ before, after, loadChanges = [], compact = false }) {
  if (compact) {
    const late = (f) => (f.daysLate == null ? f.status : f.daysLate > 0 ? `+${f.daysLate}d` : 'on time');
    const lateChanged = late(before.forecast) !== late(after.forecast);
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          variant="outlined"
          color={lateChanged ? ((after.forecast.daysLate ?? 0) < (before.forecast.daysLate ?? 0) ? 'success' : 'error') : 'default'}
          label={`Forecast: ${late(before.forecast)} → ${late(after.forecast)}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={after.riskScore < before.riskScore ? 'success' : after.riskScore > before.riskScore ? 'error' : 'default'}
          label={`Risk: ${before.riskScore} → ${after.riskScore}`}
        />
        {loadChanges.map((l) => (
          <Chip key={l.userId} size="small" variant="outlined" label={`${l.name}: ${l.before} → ${l.after} open tasks`} />
        ))}
      </Stack>
    );
  }

  const rows = [
    { label: 'Forecast finish', before: forecastText(before.forecast), after: forecastText(after.forecast) },
    {
      label: 'Against target',
      before: lateText(before.forecast),
      after: lateText(after.forecast),
      color: deltaColor(before.forecast.daysLate, after.forecast.daysLate),
    },
    { label: 'Target date', before: formatDate(before.targetDate), after: formatDate(after.targetDate) },
    { label: 'Open tasks', before: before.openTasks, after: after.openTasks },
    {
      label: 'Delay risk',
      before: `${before.riskScore} (${before.riskLevel.toLowerCase()})`,
      after: `${after.riskScore} (${after.riskLevel.toLowerCase()})`,
      color: deltaColor(before.riskScore, after.riskScore),
      bold: true,
    },
    // Each risk factor, so the manager can see WHY the risk moved.
    ...before.riskFactors.map((f, i) => ({
      label: `  ${f.label}`,
      before: `+${f.contribution}`,
      after: `+${after.riskFactors[i].contribution}`,
      hint: after.riskFactors[i].detail,
      color: deltaColor(f.contribution, after.riskFactors[i].contribution),
      sub: true,
    })),
  ];

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Now</TableCell>
            <TableCell>After the change</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell sx={{ pl: r.sub ? 3 : 2, color: r.sub ? 'text.secondary' : 'text.primary', fontWeight: r.bold ? 700 : 400 }}>
                {r.label.trim()}
                {r.hint && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {r.hint}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{r.before}</TableCell>
              <TableCell sx={{ color: r.color ?? 'text.primary', fontWeight: r.before !== r.after ? 700 : 400 }}>{r.after}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {loadChanges.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Workload (open tasks, all projects):
          </Typography>
          {loadChanges.map((l) => (
            <Chip key={l.userId} size="small" variant="outlined" label={`${l.name}: ${l.before} → ${l.after}`} />
          ))}
        </Stack>
      )}
    </>
  );
}
