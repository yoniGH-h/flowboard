import { useState } from 'react';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { useAuth } from '../../auth/AuthContext';
import { startMeeting } from '../../api/api';
import { fullName } from '../../lib/format';
import { hasPermission } from '../../lib/permissions';

const MODES = {
  voice: { title: 'Voice call', verb: 'Start voice call', description: 'a Zoom meeting with cameras off' },
  video: { title: 'Zoom meeting', verb: 'Start Zoom meeting', description: 'a Zoom video meeting' },
};

// Voice call + Zoom meeting buttons for contacting a teammate (hidden for yourself).
// Both create a real Zoom meeting through the backend (POST /api/meetings): the caller joins
// as host in a new tab, and the teammate gets a real-time notification with a join link.
export function ContactButtons({ user, projectId, taskId, size = 'small' }) {
  const { user: me } = useAuth();
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState(null);

  // Hidden for yourself, and for users without the calls.start permission.
  if (!user || user.id === me?.id || !hasPermission(me, 'calls.start')) return null;

  const name = fullName(user);
  const close = () => {
    setMode(null);
    setStatus('idle');
    setError(null);
  };

  const start = async () => {
    setStatus('loading');
    try {
      const meeting = await startMeeting({ inviteeId: user.id, mode, projectId, taskId });
      window.open(meeting.startUrl, '_blank', 'noopener');
      close();
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={0.25}>
        <Tooltip title={`Voice call with ${name}`}>
          <IconButton size={size} aria-label={`Voice call with ${name}`} onClick={() => setMode('voice')}>
            <PhoneOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Zoom meeting with ${name}`}>
          <IconButton size={size} aria-label={`Zoom meeting with ${name}`} onClick={() => setMode('video')}>
            <VideocamOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Dialog open={!!mode} onClose={close} maxWidth="xs" fullWidth>
        {mode && (
          <>
            <DialogTitle>
              {MODES[mode].title} with {name}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary">
                This starts {MODES[mode].description}. You join as the host in a new tab, and {user.firstName} gets a
                notification with a link to join.
              </Typography>
              {status === 'error' && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={close} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={start}
                disabled={status === 'loading'}
                startIcon={
                  status === 'loading' ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : mode === 'voice' ? (
                    <PhoneOutlinedIcon />
                  ) : (
                    <VideocamOutlinedIcon />
                  )
                }
              >
                {MODES[mode].verb}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
