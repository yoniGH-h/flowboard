// שביל ניווט.

import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Link as RouterLink } from 'react-router-dom';

// מציג את המיקום הנוכחי כשרשרת קישורים.
// נקרא מ: KanbanBoardPage.jsx, ProjectOverviewPage.jsx, ProjectTeamManagementPage.jsx, TaskDetailsPage.jsx
// קורא ל: —
export function Breadcrumbs({ items }) {
  return (
    <MuiBreadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 16 }} />} sx={{ mb: 1 }} aria-label="Breadcrumb">
      {items.map((item, idx) =>
        item.to && idx !== items.length - 1 ? (
          <Link key={item.label} component={RouterLink} to={item.to} underline="hover" color="text.secondary" variant="body2">
            {item.label}
          </Link>
        ) : (
          <Typography key={item.label} variant="body2" color="text.primary" fontWeight={600}>
            {item.label}
          </Typography>
        ),
      )}
    </MuiBreadcrumbs>
  );
}
