// גרף מגמת הסיכון.

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useRiskHistory } from '../../lib/queries';
import { formatDate } from '../../lib/format';

// גרף קו של ציון הסיכון היומי של פרויקט.
export function RiskTrendChart({ projectId }) {
  const { data: history, isError } = useRiskHistory(projectId);

  // צריך לפחות יומיים כדי שתהיה מגמה; מוסתר כשאין היסטוריית סיכון.
  if (isError || !history || history.length < 2) return null;

  const points = history.map((h) => ({ day: formatDate(h.day), score: h.riskScore }));
  const change = history.at(-1).riskScore - history[0].riskScore;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Risk over the last {history.length} days
      </Typography>
      <Typography variant="caption" color={change > 0 ? 'error.main' : 'text.secondary'}>
        {change === 0 ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} points`} since {formatDate(history[0].day)}
      </Typography>
      <Box sx={{ height: 180, mt: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F5" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis domain={[0, 100]} ticks={[0, 30, 60, 100]} tick={{ fontSize: 11 }} />
            <ReferenceLine y={30} stroke="#B26A00" strokeDasharray="4 4" />
            <ReferenceLine y={60} stroke="#C62828" strokeDasharray="4 4" />
            <ReTooltip formatter={(v) => [v, 'Risk score']} />
            <Line type="monotone" dataKey="score" stroke="#3454D1" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
