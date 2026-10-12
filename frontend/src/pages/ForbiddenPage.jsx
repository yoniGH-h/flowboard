// מסך 403.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { ForbiddenState } from '../components/common/States';

// המסך שמוצג למי שאין לו הרשאה לעמוד.
// נקרא מ: App.jsx
// קורא ל: ForbiddenState
export function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <ForbiddenState />
      <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ mt: 1 }}>
        Back to dashboard
      </Button>
    </Box>
  );
}
