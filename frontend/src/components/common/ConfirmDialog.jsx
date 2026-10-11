// תפקיד הקובץ: חלון אישור כללי.
// משתמשים בו: UserManagementPage.jsx, ProjectManagementPage.jsx, ProjectTeamManagementPage.jsx, OrganizationsSystemManagementPage.jsx +1

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

// חלון "האם אתה בטוח?" עם כפתורי אישור וביטול.
// נקרא מ: UserManagementPage.jsx, ProjectManagementPage.jsx, ProjectTeamManagementPage.jsx, OrganizationsSystemManagementPage.jsx +1
export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', danger = false, loading = false, onConfirm, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="confirm-dialog-title">
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={onConfirm} color={danger ? 'error' : 'primary'} variant="contained" disabled={loading} autoFocus>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
