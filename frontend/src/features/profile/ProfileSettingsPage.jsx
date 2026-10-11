// תפקיד הקובץ: מסך הפרופיל.
// משתמשים בו: App.jsx

import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { PageHeader } from '../../components/common/PageHeader';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useAuth, ROLE_LABELS } from '../../auth/AuthContext';
import { useUpdateProfile } from '../../lib/queries';
import { changePassword } from '../../api/authApi';
import { fullName } from '../../lib/format';

// עריכת פרטים אישיים ושינוי סיסמה.
// נקרא מ: App.jsx
export function ProfileSettingsPage() {
  const { user, organization, availableRoles, refreshUser } = useAuth();
  const updateProfile = useUpdateProfile();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [title, setTitle] = useState(user?.title ?? '');
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  if (!user) return null;

  const handleSaveProfile = async () => {
    await updateProfile.mutateAsync({
      userId: user.id,
      patch: { firstName: firstName.trim(), lastName: lastName.trim(), title: title.trim() },
    });
    refreshUser();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordSaved(false), 4000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Unable to change your password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader title="Profile & Settings" description="Manage your personal information and password." />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 2 }}>
                Personal information
              </Typography>
              {saved && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Your profile has been updated.
                </Alert>
              )}
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
                <UserAvatar user={user} size="large" />
                <Box>
                  <Typography variant="body1" fontWeight={700}>
                    {fullName(user)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
              </Stack>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth />
                  <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
                </Stack>
                <TextField label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
                <TextField
                  label="Email address"
                  value={user.email}
                  fullWidth
                  disabled
                  helperText="Contact an organization administrator to change your email."
                  sx={{ '& .MuiFormHelperText-root.Mui-disabled': { color: 'text.secondary' } }}
                />
                <Box>
                  <Button variant="contained" onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 2 }}>
                Security
              </Typography>
              {passwordSaved && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Your password has been changed. Other devices were signed out.
                </Alert>
              )}
              {passwordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {passwordError}
                </Alert>
              )}
              <Stack spacing={2} sx={{ maxWidth: 420 }}>
                <TextField
                  label="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  fullWidth
                  helperText="At least 8 characters."
                />
                <Box>
                  <Button variant="outlined" onClick={handleChangePassword} disabled={passwordSaving}>
                    {passwordSaving ? 'Changing…' : 'Change password'}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1.5 }}>
                Account
              </Typography>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Organization
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {organization?.name}
                  </Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Roles
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {availableRoles.map((r) => (
                      <Chip key={r} label={ROLE_LABELS[r]} size="small" />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
