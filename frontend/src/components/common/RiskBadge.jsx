// תגית ציון הסיכון.

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

const CONFIG = {
  LOW: { label: 'Low Risk', color: '#2E7D32', bg: '#E6F4EA' },
  MEDIUM: { label: 'Medium Risk', color: '#8A5A00', bg: '#FDF1DD' },
  HIGH: { label: 'High Risk', color: '#C62828', bg: '#FBE9E9' },
};

// תגית צבעונית עם ציון הסיכון ורמתו.
// נקרא מ: ProjectCard.jsx, DecisionCenterPage.jsx, ProjectManagementPage.jsx, ProjectOverviewPage.jsx +1
// קורא ל: —
export function RiskBadge({ score, level, compact = false }) {
  const cfg = CONFIG[level];
  return (
    <Tooltip title="Delay risk score, 0 (low) to 100 (high) — see contributing factors on the project overview.">
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: compact ? 1 : 1.25,
          py: compact ? 0.25 : 0.5,
          borderRadius: 999,
          backgroundColor: cfg.bg,
        }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: cfg.color }}>
          {cfg.label} · {score}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// ממיר ציון מספרי לרמה: נמוך, בינוני או גבוה.
// נקרא מ: אין שימוש כרגע
// קורא ל: —
export function riskLevelFromScore(score) {
  if (score <= 30) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  return 'HIGH';
}
