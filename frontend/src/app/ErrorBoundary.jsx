// תפיסת קריסות בממשק.

import { Component } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

// רכיב שתופס שגיאות ציור של כל מה שבתוכו.
// נקרא מ: main.jsx
export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('FlowBoard prototype crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            p: 3,
          }}
        >
          <ErrorOutlineOutlinedIcon sx={{ fontSize: 56, color: '#C62828', mb: 2 }} />
          <Typography variant="h1" sx={{ mb: 1 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 420 }}>
            An unexpected error occurred in this prototype. Reloading the page usually resolves it.
          </Typography>
          <Button variant="contained" onClick={() => window.location.assign('/dashboard')}>
            Reload FlowBoard
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
