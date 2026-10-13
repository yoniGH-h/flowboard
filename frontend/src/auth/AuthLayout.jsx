// המסגרת של מסכי ההתחברות.

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const HIGHLIGHTS = [
  'One board for projects, tasks, files, and conversations',
  'Explainable delay-risk scoring for every project',
  'Role-aware views for employees, managers, and admins',
];

// כרטיס ממורכז עם כותרת, לטפסי ההתחברות.
export function AuthLayout({ title, subtitle, children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', backgroundColor: 'background.default' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          width: '42%',
          px: 6,
          backgroundColor: '#1B2440',
          color: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <ViewKanbanIcon sx={{ fontSize: 30 }} />
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 800 }}>
            FlowBoard
          </Typography>
        </Stack>
        <Typography variant="h2" sx={{ color: '#fff', mb: 2, maxWidth: 420 }}>
          Plan the work. See what's at risk. Ship on time.
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {HIGHLIGHTS.map((h) => (
            <Stack key={h} direction="row" spacing={1.25} alignItems="flex-start">
              <CheckCircleOutlineIcon sx={{ fontSize: 20, color: '#7FA3F5', mt: 0.25 }} />
              <Typography variant="body2" sx={{ color: '#C8D0E8' }}>
                {h}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 }, borderRadius: 2, borderColor: '#E7E7EB' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3, display: { xs: 'flex', md: 'none' } }}>
            <ViewKanbanIcon color="primary" />
            <Typography variant="h4" fontWeight={800}>
              FlowBoard
            </Typography>
          </Stack>
          {/* Visually an h2 (matches AppShell's PageHeader elsewhere), but these auth pages
              have no other heading at this level - render it as the page's one <h1> so
              screen-reader users landing on /sign-in, /sign-up, etc. have a real heading
              to navigate to. */}
          <Typography variant="h2" component="h1" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {subtitle}
          </Typography>
          {children}
        </Paper>
      </Box>
    </Box>
  );
}
