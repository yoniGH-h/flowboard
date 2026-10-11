// תפקיד הקובץ: רשימת ההמלצות.
// משתמשים בו: DecisionCenterPage.jsx

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useRecommendations } from '../../lib/queries';
import { ImpactSummary } from './ImpactSummary';
import { ApplyDecisionDialog } from './ApplyDecisionDialog';

const TYPE_LABELS = { REBALANCE: 'Rebalance work', DEFER: 'Reduce scope', ADD_MEMBER: 'Add capacity' };

// הצעות מבוססות כללים לפרויקט הזה, כל אחת כבר עברה בסימולטור.
// המנהל מחליט: לפתוח בסימולטור ולהתאים, או לבצע כמו שהיא.
// המלצות המערכת, עם פתיחה בסימולטור או ביצוע.
// נקרא מ: DecisionCenterPage.jsx
export function RecommendationsPanel({ projectId, onOpenInSimulator }) {
  const { data: recs, isLoading } = useRecommendations(projectId);
  const [applying, setApplying] = useState(null);
  const [expanded, setExpanded] = useState(null);

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
        <CircularProgress aria-label="Loading recommendations" />
      </Box>
    );
  }

  if (!recs?.length) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
        <CheckCircleOutlineIcon color="success" />
        <Typography variant="body2" color="text.secondary">
          No recommendations - none of the rules found a change that clearly helps this project right now.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      {recs.map((rec) => (
        <Card key={rec.id} variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Box>
                <Chip size="small" label={TYPE_LABELS[rec.type] ?? rec.type} color="primary" variant="outlined" sx={{ mb: 0.75 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  {rec.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {rec.reason}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexShrink: 0 }}>
                <Button size="small" onClick={() => onOpenInSimulator(rec.changes)}>
                  Adjust in simulator
                </Button>
                <Button size="small" variant="contained" onClick={() => setApplying(rec)}>
                  Apply
                </Button>
              </Stack>
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.5 }}>
              Predicted effect
            </Typography>
            <ImpactSummary before={rec.before} after={rec.after} loadChanges={rec.loadChanges} compact />

            <Button size="small" sx={{ mt: 1, px: 0 }} onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}>
              {expanded === rec.id ? 'Hide assumptions' : 'Assumptions'}
            </Button>
            <Collapse in={expanded === rec.id}>
              {rec.assumptions.map((a) => (
                <Typography key={a} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  • {a}
                </Typography>
              ))}
            </Collapse>
          </CardContent>
        </Card>
      ))}

      <ApplyDecisionDialog
        open={!!applying}
        onClose={() => setApplying(null)}
        projectId={projectId}
        changes={applying?.changes}
        summary={applying ? [applying.title] : []}
        source="RECOMMENDATION"
      />
    </Stack>
  );
}
