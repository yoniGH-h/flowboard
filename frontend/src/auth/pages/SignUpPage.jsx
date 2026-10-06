import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../AuthLayout';
import { useAuth } from '../AuthContext';
import { signUpCreateOrganization, signUpJoinOrganization } from '../../api/authApi';

const INITIAL_STATE = {
  organizationName: '',
  inviteCode: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function SignUpPage() {
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState(INITIAL_STATE);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { signInWithResult } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (mode === 'create' && !form.organizationName.trim()) next.organizationName = 'Organization name is required.';
    if (mode === 'join' && !form.inviteCode.trim()) next.inviteCode = 'Invite code or organization slug is required.';
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const result =
        mode === 'create'
          ? await signUpCreateOrganization({
              organizationName: form.organizationName,
              firstName: form.firstName,
              lastName: form.lastName,
              email: form.email,
              password: form.password,
            })
          : await signUpJoinOrganization({
              organizationSlugOrInviteCode: form.inviteCode,
              firstName: form.firstName,
              lastName: form.lastName,
              email: form.email,
              password: form.password,
            });
      signInWithResult(result);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start a new organization or join one with an invite code.">
      <Tabs value={mode} onChange={(_e, v) => setMode(v)} sx={{ mb: 2.5 }} variant="fullWidth">
        <Tab value="create" label="Create organization" />
        <Tab value="join" label="Join organization" />
      </Tabs>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {mode === 'create' ? (
            <TextField
              label="Organization name"
              value={form.organizationName}
              onChange={set('organizationName')}
              error={!!errors.organizationName}
              helperText={errors.organizationName}
              fullWidth
              required
            />
          ) : (
            <TextField
              label="Invite code or organization slug"
              value={form.inviteCode}
              onChange={set('inviteCode')}
              error={!!errors.inviteCode}
              helperText={errors.inviteCode || 'Try "nimbus-digital" or "harborline-logistics" for this demo.'}
              fullWidth
              required
            />
          )}
          <Stack direction="row" spacing={2}>
            <TextField
              label="First name"
              value={form.firstName}
              onChange={set('firstName')}
              error={!!errors.firstName}
              helperText={errors.firstName}
              fullWidth
              required
            />
            <TextField
              label="Last name"
              value={form.lastName}
              onChange={set('lastName')}
              error={!!errors.lastName}
              helperText={errors.lastName}
              fullWidth
              required
            />
          </Stack>
          <TextField
            label="Email address"
            type="email"
            value={form.email}
            onChange={set('email')}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
            required
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={set('password')}
            error={!!errors.password}
            helperText={errors.password || 'At least 8 characters.'}
            fullWidth
            required
          />
          <TextField
            label="Confirm password"
            type="password"
            value={form.confirmPassword}
            onChange={set('confirmPassword')}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            fullWidth
            required
          />
          <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth>
            {loading ? 'Creating account…' : mode === 'create' ? 'Create organization' : 'Join organization'}
          </Button>
        </Stack>
      </Box>
      <Typography variant="body2" sx={{ mt: 2.5, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link component={RouterLink} to="/sign-in">
          Sign in
        </Link>
      </Typography>
    </AuthLayout>
  );
}
