// תפקיד הקובץ: החלק העליון של הדשבורד.
// משתמשים בו: ManagementDashboardPage.jsx, PersonalDashboardPage.jsx

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ברכה למשתמש וסיכום קצר.
// נקרא מ: ManagementDashboardPage.jsx, PersonalDashboardPage.jsx
export function DashboardHero({
  firstName,
  subtitle = "Here's what's happening today.",
  stats,
  weeklyGoalPercent,
  weeklyCompleted,
  weeklyTotal,
}) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        p: { xs: 2.5, sm: 3.5 },
        mb: 3,
        color: '#fff',
        background: 'linear-gradient(135deg, #3454D1 0%, #26399A 100%)',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={3}>
        <Box>
          <Typography variant="h1" sx={{ color: '#fff', fontSize: '1.5rem', mb: 0.5 }}>
            {greeting()}, {firstName}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', mb: 2.5 }}>
            {subtitle}
          </Typography>
          <Stack direction="row" spacing={{ xs: 2.5, sm: 4 }} flexWrap="wrap" useFlexGap>
            {stats.map((stat) => (
              <Stack key={stat.label} direction="row" spacing={1} alignItems="center">
                <Box sx={{ color: 'rgba(255,255,255,0.85)', display: 'flex', '& svg': { fontSize: 18 } }}>{stat.icon}</Box>
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#fff' }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'block' }, alignSelf: 'stretch' }}>
          <Divider orientation="vertical" sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
        </Box>

        <Box sx={{ minWidth: 220 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Weekly progress
          </Typography>
          <Typography variant="h1" sx={{ color: '#fff', fontSize: '2rem', mt: 0.25 }}>
            {weeklyGoalPercent}%
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 1 }}>
            of weekly goal
          </Typography>
          <LinearProgress
            variant="determinate"
            value={weeklyGoalPercent}
            aria-label="Weekly progress"
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#fff' },
            }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mt: 0.75 }}>
            {weeklyCompleted} / {weeklyTotal} tasks completed
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
