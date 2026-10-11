// תפקיד הקובץ: מסך "שכחתי סיסמה".
// משתמשים בו: App.jsx

import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import { Link as RouterLink } from 'react-router-dom';
import { AuthLayout } from '../AuthLayout';
import { requestPasswordReset } from '../../api/authApi';

// טופס לבקשת איפוס סיסמה.
// נקרא מ: App.jsx
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      setResetToken(result.resetToken ?? null);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="">
        <Alert severity="success" sx={{ mb: 2 }}>
          If an account exists for <strong>{email}</strong>, a password reset link has been sent.
        </Alert>
        {resetToken && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No email provider is configured for local development, so here is the reset link directly (see docs/security.md).
          </Alert>
        )}
        <Button
          component={RouterLink}
          to={resetToken ? `/reset-password?token=${encodeURIComponent(resetToken)}` : '/reset-password'}
          variant="outlined"
          fullWidth
          sx={{ mb: 1.5 }}
          disabled={!resetToken}
        >
          Continue to reset password
        </Button>
        <Link component={RouterLink} to="/sign-in" variant="body2">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!error}
            fullWidth
            required
            autoComplete="email"
          />
          <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
          <Link component={RouterLink} to="/sign-in" variant="body2" sx={{ textAlign: 'center' }}>
            Back to sign in
          </Link>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
