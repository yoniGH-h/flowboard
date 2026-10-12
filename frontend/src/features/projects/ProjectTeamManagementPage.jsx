// ניהול צוות הפרויקט.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { PageHeader } from '../../components/common/PageHeader';
import { UserIdentity } from '../../components/common/UserAvatar';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ContactButtons } from '../../components/common/ContactButtons';
import { LoadingState } from '../../components/common/States';
import { useAddProjectMember, useOrganizationUsers, useProject, useRemoveProjectMember } from '../../lib/queries';
import { fullName } from '../../lib/format';

// הוספה והסרה של חברי צוות.
// נקרא מ: App.jsx
export function ProjectTeamManagementPage() {
  const { projectId } = useParams();
  const { data: project, isLoading } = useProject(projectId);
  const { data: users } = useOrganizationUsers();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const [addOpen, setAddOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);
  const members = useMemo(() => (project ? project.memberIds.map((id) => userMap.get(id)).filter((u) => !!u) : []), [project, userMap]);
  const availableUsers = useMemo(() => (users ?? []).filter((u) => !project?.memberIds.includes(u.id)), [users, project]);

  if (isLoading) return <LoadingState label="Loading team…" />;
  if (!project) return <Box>Project not found.</Box>;

  return (
    <Box>
      <Breadcrumbs
        items={[
          { label: 'Project Management', to: '/management/projects' },
          { label: project.name, to: `/projects/${project.id}` },
          { label: 'Team' },
        ]}
      />
      <PageHeader
        title={`${project.name} — Team`}
        description="Add or remove members from this project."
        actions={
          <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => setAddOpen(true)}>
            Add Member
          </Button>
        }
      />

      <Card>
        <CardContent>
          <List>
            {members.map((m) => {
              const isProjectManager = m.id === project.managerId;
              return (
                <ListItem
                  key={m.id}
                  divider
                  sx={{ pr: 7 }}
                  secondaryAction={
                    !isProjectManager && (
                      <IconButton edge="end" aria-label={`Remove ${fullName(m)}`} onClick={() => setRemoveTarget(m)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )
                  }
                >
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
                    <UserIdentity user={m} subtitle={m.title} />
                    {isProjectManager && <Chip label="Project Manager" size="small" color="primary" variant="outlined" />}
                    <Box sx={{ flexGrow: 1 }} />
                    <ContactButtons user={m} projectId={project.id} />
                  </Stack>
                </ListItem>
              );
            })}
          </List>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add member</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={availableUsers}
            getOptionLabel={(u) => `${fullName(u)} (${u.title})`}
            value={selectedUser}
            onChange={(_e, value) => setSelectedUser(value)}
            renderInput={(params) => <TextField {...params} label="Select a team member" autoFocus sx={{ mt: 1 }} />}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!selectedUser || addMember.isPending}
            onClick={async () => {
              if (selectedUser && project) {
                await addMember.mutateAsync({ projectId: project.id, userId: selectedUser.id });
                setSelectedUser(null);
                setAddOpen(false);
              }
            }}
          >
            Add to project
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member"
        description={`Remove ${removeTarget ? fullName(removeTarget) : ''} from "${project.name}"? They will lose access to this project's board and tasks.`}
        confirmLabel="Remove"
        danger
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (removeTarget && project) await removeMember.mutateAsync({ projectId: project.id, userId: removeTarget.id });
          setRemoveTarget(null);
        }}
      />
    </Box>
  );
}
