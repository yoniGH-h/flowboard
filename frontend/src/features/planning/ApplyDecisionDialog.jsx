// אישור ביצוע החלטה.

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { useApplyDecision } from '../../lib/queries';

// אישור לביצוע השינויים בפועל. הם מתבצעים דרך הפעולות הרגילות של משימות ופרויקטים
// (עם ההתראות והרישום ביומן שלהן) ונרשמים ביומן ההחלטות.
// מציג את השינויים, מקבל הערה ומבצע.
// נקרא מ: RecommendationsPanel.jsx, SimulatorPanel.jsx
export function ApplyDecisionDialog({ open, onClose, onApplied, projectId, changes, summary, source }) {
  const applyDecision = useApplyDecision();
  const [note, setNote] = useState('');

  const close = () => {
    setNote('');
    applyDecision.reset();
    onClose();
  };

  const apply = async () => {
    try {
      await applyDecision.mutateAsync({ projectId, changes, source, note });
      setNote('');
      onApplied?.();
      onClose();
    } catch {
      // מוצג למטה
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Apply this decision?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          These changes will be made now - people are notified as usual - and the decision is saved in the decision log with
          today&apos;s risk and forecast, so you can see later whether it worked.
        </Typography>
        <List dense>
          {(summary ?? []).map((text) => (
            <ListItem key={text} sx={{ py: 0 }}>
              <ListItemText primary={`• ${text}`} />
            </ListItem>
          ))}
        </List>
        <TextField
          label="Why? (optional)"
          placeholder="e.g. Marcus is needed on the release blocker"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          inputProps={{ maxLength: 500 }}
          multiline
          minRows={2}
          fullWidth
        />
        {applyDecision.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {applyDecision.error.message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={apply} disabled={applyDecision.isPending}>
          {applyDecision.isPending ? 'Applying…' : 'Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
