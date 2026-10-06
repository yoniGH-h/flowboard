import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

export function KpiCard({ label, value, icon, accentColor = '#3454D1', trend, helperText, sparkline }) {
  const gradientId = `kpiSpark-${label.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
          {icon && (
            <Box sx={{ color: accentColor, opacity: 0.85, display: 'flex', '& svg': { fontSize: 18 } }} aria-hidden>
              {icon}
            </Box>
          )}
        </Stack>
        <Typography variant="h2" sx={{ mt: 1, fontWeight: 700 }}>
          {value}
        </Typography>
        {(trend || helperText) && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
            {trend && (
              <>
                {trend.direction === 'up' ? (
                  <TrendingUpIcon sx={{ fontSize: 14, color: trend.positive === false ? 'error.main' : 'success.main' }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 14, color: trend.positive === false ? 'success.main' : 'error.main' }} />
                )}
                <Typography variant="caption" fontWeight={600} color={trend.positive === false ? 'error.main' : 'success.main'}>
                  {trend.label}
                </Typography>
              </>
            )}
            {helperText && (
              <Typography variant="caption" color="text.secondary">
                {trend ? `· ${helperText}` : helperText}
              </Typography>
            )}
          </Stack>
        )}
        {sparkline && sparkline.length > 1 && (
          <Box sx={{ height: 30, mt: 'auto', pt: 1, mx: -0.5 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline.map((v) => ({ v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentColor} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={accentColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
