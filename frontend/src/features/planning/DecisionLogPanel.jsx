// יומן ההחלטות.

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useDecisions } from '../../lib/queries';
import { formatDate } from '../../lib/format';

// "אז -> נחזה -> עכשיו" למספר אחד שבו נמוך יותר טוב יותר (סיכון, ימי איחור).
function Trajectory({ before, predicted, now, unit = '' }) {
  if (before == null && now == null) return <Typography variant="body2">—</Typography>;
  const show = (v) => (v == null ? '—' : `${v}${unit}`);
  const change = before != null && now != null ? now - before : null;
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">
        {show(before)} → <span title="What the model predicted">{show(predicted)}</span> → <strong>{show(now)}</strong>
      </Typography>
      {change !== null && change !== 0 && (
        <Chip
          size="small"
          variant="outlined"
          color={change < 0 ? 'success' : 'error'}
          label={`${change > 0 ? '+' : ''}${change}${unit} since`}
          sx={{ alignSelf: 'flex-start' }}
        />
      )}
    </Stack>
  );
}

// כל החלטה שהתקבלה במרכז ההחלטות, ואיך הפרויקט התפתח אחריה.
// ההחלטות שבוצעו: מה נחזה ומה קרה בפועל.
// נקרא מ: DecisionCenterPage.jsx
export function DecisionLogPanel({ projectId }) {
  const { data: decisions, isLoading } = useDecisions(projectId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
        <CircularProgress aria-label="Loading decisions" />
      </Box>
    );
  }
  if (!decisions?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No decisions yet. Apply a recommendation or a simulation and it will be tracked here.
      </Typography>
    );
  }

  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Decision</TableCell>
              <TableCell>Delay risk: then → predicted → now</TableCell>
              <TableCell>Days late: then → predicted → now</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {decisions.map((d) => (
              <TableRow key={d.id} sx={{ verticalAlign: 'top' }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDate(d.createdAt)}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {d.daysAgo === 0 ? 'today' : `${d.daysAgo} days ago`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {d.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {d.project.name} · {d.actor.firstName} {d.actor.lastName} · {d.source === 'RECOMMENDATION' ? 'from a recommendation' : 'from the simulator'}
                  </Typography>
                  {d.summary.length > 1 &&
                    d.summary.map((s) => (
                      <Typography key={s} variant="caption" sx={{ display: 'block' }}>
                        • {s}
                      </Typography>
                    ))}
                  {d.note && (
                    <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                      &ldquo;{d.note}&rdquo;
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Trajectory before={d.riskBefore} predicted={d.riskPredicted} now={d.riskNow} />
                </TableCell>
                <TableCell>
                  <Trajectory before={d.daysLateBefore} predicted={d.daysLatePredicted} now={d.daysLateNow} unit="d" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        &quot;Now&quot; is today&apos;s value. Other things also change after a decision, so treat the difference as a signal of whether
        it helped - not as proof.
      </Typography>
    </>
  );
}
