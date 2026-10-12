// מסך ההתחברות.

import { lazy, Suspense, useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../AuthLayout';
import { useAuth } from '../AuthContext';
import { signIn } from '../../api/authApi';

// מצב דמו (VITE_DEMO_MODE=true, מוגדר ב-.env.development): כניסה בלחיצה אחת לחשבונות
// הדמו. הבדיקה כתובה ממש כאן, כדי שבנייה להפצה תשמיט לגמרי את DemoAccounts.jsx -
// ואיתו את החשבונות ואת הסיסמה.
const DemoAccounts = import.meta.env.VITE_DEMO_MODE === 'true' ? lazy(() => import('../DemoAccounts')) : null;

// טופס אימייל וסיסמה, עם בדיקת שדות והודעות שגיאה.
// נקרא מ: App.jsx, SignInPage.test.jsx
// קורא ל: useAuth, signIn, AuthLayout
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

  const signInWithDemoAccount = async (demoEmail, demoPassword) => {
    setFormError(null);
    setLoading(true);
    try {
      const result = await signIn(demoEmail, demoPassword);
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

      {DemoAccounts && (
        <Suspense fallback={null}>
          <DemoAccounts onSignIn={signInWithDemoAccount} disabled={loading} />
        </Suspense>
      )}
    </AuthLayout>
  );
}
