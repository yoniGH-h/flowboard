// כותרת עמוד.

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// כותרת, תיאור, שביל ניווט וכפתורי פעולה.
export function PageHeader({ title, description, actions, breadcrumb }) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumb}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1.5}
      >
        <Box>
          <Typography variant="h1" sx={{ fontSize: { xs: '1.4rem', sm: '1.75rem' } }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
