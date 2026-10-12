// מסך הגדרות הארגון.

import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth } from '../../auth/AuthContext';
import { useUpdateOrganization } from '../../lib/queries';
import { AutomationRulesPanel } from './AutomationRulesPanel';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_WORKFLOW = [
  { name: 'Backlog', category: 'To Do' },
  { name: 'To Do', category: 'To Do' },
  { name: 'In Progress', category: 'In Progress' },
  { name: 'In Review', category: 'In Review' },
  { name: 'Done', category: 'Done' },
];

// עריכת פרטי הארגון וחוקי האוטומציה.
// נקרא מ: App.jsx
// קורא ל: useAuth, useUpdateOrganization, PageHeader, AutomationRulesPanel
export function OrganizationSettingsPage() {
  const { organization, refreshUser } = useAuth();
  const updateOrg = useUpdateOrganization();
  const [tab, setTab] = useState('general');
  const [name, setName] = useState(organization?.name ?? '');
  const [brandColor, setBrandColor] = useState(organization?.brandColor ?? '');
  const [tagline, setTagline] = useState(organization?.tagline ?? '');
  const [saved, setSaved] = useState(false);

  if (!organization) return null;

  const handleSave = async () => {
    const patch = { name: name.trim(), tagline: tagline.trim() };
    // שולחים את brandColor רק אם הוא ריק (ניקוי) או קוד hex תקין -
    // השרת דוחה כל דבר אחר, ולכן עריכה שעדיין באמצע לא נשלחת.
    if (brandColor.trim() === '' || HEX_COLOR_PATTERN.test(brandColor.trim())) {
      patch.brandColor = brandColor.trim() || null;
    }
    await updateOrg.mutateAsync({ orgId: organization.id, patch });
    refreshUser();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box>
      <PageHeader title="Organization Settings" description="Manage your organization's profile, default workflow, and automation." />

      <Card>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #E7E7EB' }}>
          <Tab value="general" label="General" />
          <Tab value="workflow" label="Default Workflow" />
          <Tab value="automation" label="Automation Rules" />
        </Tabs>
        <CardContent>
          {tab === 'general' && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7 }}>
                {saved && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Organization settings saved.
                  </Alert>
                )}
                <Stack spacing={2} sx={{ maxWidth: 420 }}>
                  <TextField label="Organization name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                  <TextField
                    label="Organization slug"
                    value={organization.slug}
                    fullWidth
                    disabled
                    helperText="Used in invite links. Contact support to change."
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Plan:
                    </Typography>
                    <Chip label={organization.plan} size="small" color="primary" variant="outlined" />
                  </Stack>

                  <Divider />

                  <Typography variant="subtitle2">Branding</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        flexShrink: 0,
                        backgroundColor: HEX_COLOR_PATTERN.test(brandColor) ? brandColor : 'transparent',
                        border: '1px solid #0002',
                      }}
                    />
                    <TextField
                      label="Brand color"
                      placeholder="#2E8A57"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      error={brandColor.trim() !== '' && !HEX_COLOR_PATTERN.test(brandColor.trim())}
                      helperText={
                        brandColor.trim() !== '' && !HEX_COLOR_PATTERN.test(brandColor.trim()) ? 'Hex color, e.g. #2E8A57' : ' '
                      }
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    label="Tagline"
                    placeholder="A short line describing your organization"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    inputProps={{ maxLength: 120 }}
                    fullWidth
                  />

                  <Box>
                    <Button variant="contained" onClick={handleSave} disabled={updateOrg.isPending}>
                      {updateOrg.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          )}

          {tab === 'workflow' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                New projects are created with this default board workflow. Individual project managers can further customize columns per
                project.
              </Typography>
              <List sx={{ maxWidth: 420 }}>
                {DEFAULT_WORKFLOW.map((col, idx) => (
                  <ListItem key={col.name} divider={idx !== DEFAULT_WORKFLOW.length - 1}>
                    <ListItemText primary={col.name} secondary={`Category: ${col.category}`} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {tab === 'automation' && <AutomationRulesPanel />}
        </CardContent>
      </Card>
    </Box>
  );
}
