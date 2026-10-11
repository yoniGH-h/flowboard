// תפקיד הקובץ: מצבי מסך משותפים: ריק, טעינה, שגיאה ואין הרשאה.
// משתמשים בו: AuditLogPage.jsx, AutomationRulesPanel.jsx, RolesPermissionsPage.jsx, UserManagementPage.jsx +18

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';

// מוצג כשאין נתונים להציג.
// נקרא מ: AutomationRulesPanel.jsx, ActivityFeed.jsx, PersonalDashboardPage.jsx, KanbanBoardPage.jsx +9
export function EmptyState({ icon, title, description, action }) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 6,
        px: 3,
        color: 'text.secondary',
      }}
    >
      <Box sx={{ mb: 1.5, color: '#A6ADBD' }}>{icon ?? <InboxOutlinedIcon sx={{ fontSize: 44 }} />}</Box>
      <Typography variant="subtitle1" color="text.primary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 420, mb: action ? 2 : 0 }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}

// מחוון טעינה עם טקסט.
// נקרא מ: AuditLogPage.jsx, RolesPermissionsPage.jsx, UserManagementPage.jsx, ManagementDashboardPage.jsx +13
export function LoadingState({ label = 'Loading…' }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 6 }} role="status" aria-live="polite">
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

// שלדי כרטיסים בזמן טעינה.
// נקרא מ: אין שימוש כרגע
export function CardSkeletonGrid({ count = 4 }) {
  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" width={260} height={110} />
      ))}
    </Stack>
  );
}

// הודעת שגיאה עם כפתור "נסה שוב".
// נקרא מ: RolesPermissionsPage.jsx
export function ErrorState({ title = 'Something went wrong', description, onRetry }) {
  return (
    <EmptyState
      icon={<ErrorOutlineOutlinedIcon sx={{ fontSize: 44, color: '#C62828' }} />}
      title={title}
      description={description ?? 'An unexpected error occurred while loading this data.'}
      action={
        onRetry && (
          <Button variant="outlined" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

// הודעה על בעיית תקשורת עם השרת.
// נקרא מ: אין שימוש כרגע
export function NetworkErrorState({ onRetry }) {
  return (
    <EmptyState
      icon={<WifiOffOutlinedIcon sx={{ fontSize: 44 }} />}
      title="Network connection lost"
      description="We couldn't reach the server. Check your connection and try again."
      action={
        onRetry && (
          <Button variant="outlined" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  );
}

// מוצג כשהחיפוש לא החזיר תוצאות.
// נקרא מ: AuditLogPage.jsx, UserManagementPage.jsx, MyProjectsPage.jsx, ProjectManagementPage.jsx +1
export function NoSearchResultsState({ onClear }) {
  return (
    <EmptyState
      icon={<SearchOffOutlinedIcon sx={{ fontSize: 44 }} />}
      title="No results found"
      description="Try adjusting your filters or search terms."
      action={
        onClear && (
          <Button variant="text" onClick={onClear}>
            Clear filters
          </Button>
        )
      }
    />
  );
}

// מוצג כשאין הרשאה לתוכן.
// נקרא מ: ForbiddenPage.jsx
export function ForbiddenState() {
  return (
    <EmptyState
      icon={<LockOutlinedIcon sx={{ fontSize: 44 }} />}
      title="403 — You don't have access to this page"
      description="Your current role does not have permission to view this content. Switch roles from the top bar if you're evaluating the prototype, or contact an administrator."
    />
  );
}
