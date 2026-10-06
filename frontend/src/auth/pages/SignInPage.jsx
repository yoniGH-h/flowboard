import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../AuthLayout';
import { useAuth } from '../AuthContext';
import { signIn, DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../api/authApi';

export function SignInPage() {
  const { signInWithResult } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await signIn(email, password);
      signInWithResult(result);
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithDemoAccount = async (demoEmail) => {
    setFormError(null);
    setLoading(true);
    try {
      const result = await signIn(demoEmail, DEMO_PASSWORD);
      signInWithResult(result);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Sign in to continue to your workspace.">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          {formError && (
            <Alert severity="error" role="alert">
              {formError}
            </Alert>
          )}
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
            autoComplete="email"
            fullWidth
            required
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!errors.password}
            helperText={errors.password}
            autoComplete="current-password"
            fullWidth
            required
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box sx={{ textAlign: 'right' }}>
            <Link component={RouterLink} to="/forgot-password" variant="body2">
              Forgot password?
            </Link>
          </Box>
          <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </Box>
      <Typography variant="body2" sx={{ mt: 2.5, textAlign: 'center' }}>
        Don&apos;t have an account?{' '}
        <Link component={RouterLink} to="/sign-up">
          Sign up or join an organization
        </Link>
      </Typography>

      <Divider sx={{ my: 2.5 }}>
        <Typography variant="caption" color="text.secondary">
          SEEDED DEMO ACCOUNTS
        </Typography>
      </Divider>
      <Stack spacing={0.75}>
        {DEMO_ACCOUNTS.map((acc) => (
          <Button
            key={acc.email}
            variant="outlined"
            size="small"
            onClick={() => signInWithDemoAccount(acc.email)}
            disabled={loading}
            sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
          >
            {acc.label}
          </Button>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Password for any demo account: <strong>{DEMO_PASSWORD}</strong>. These are real accounts in the local development database (see
          the README for the full seeded list).
        </Typography>
      </Stack>
    </AuthLayout>
  );
}
