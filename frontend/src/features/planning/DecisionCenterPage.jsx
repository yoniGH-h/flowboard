// מסך מרכז ההחלטות.

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/States';
import { RiskBadge } from '../../components/common/RiskBadge';
import { usePlanningView, useProjects } from '../../lib/queries';
import { formatDate } from '../../lib/format';
import { RecommendationsPanel } from './RecommendationsPanel';
import { SimulatorPanel } from './SimulatorPanel';
import { DecisionLogPanel } from './DecisionLogPanel';

// מרכז ההחלטות: מזהים בעיה, מקבלים המלצה, בודקים שינויים בסימולטור
// "מה אם" לפני שמתחייבים, מבצעים אותם, ואחר כך רואים אם ההחלטה הצליחה.
// המלצות, סימולטור ויומן החלטות לפרויקט.
// נקרא מ: App.jsx
export function DecisionCenterPage() {
  // רק הפרויקטים שהמנהל מנהל (scope=all = הפרויקטים המנוהלים, עבור מנהל פרויקט).
  const { data: projects, isLoading } = useProjects({ scope: 'all' });
  const [chosenProjectId, setProjectId] = useState('');
  const [tab, setTab] = useState('recommendations');
  // המלצה שנפתחה בסימולטור, ומפתח להפעלה מחדש של הסימולטור איתה.
  const [simulatorSeed, setSimulatorSeed] = useState({ key: 0, changes: null });

  // עד שהמנהל בוחר פרויקט, מוצג הפרויקט הראשון שלו.
  const projectId = chosenProjectId || projects?.[0]?.id || '';

  const { data: view, isLoading: viewLoading, isError } = usePlanningView(projectId || undefined);

  if (isLoading) return <LoadingState label="Loading projects…" />;

  const f = view?.evaluation.forecast;
  const forecastLabel = !f
    ? ''
    : f.status === 'done'
      ? 'All tasks done'
      : f.status === 'stalled'
        ? 'Stalled - nothing completed in 4 weeks'
        : `${formatDate(f.forecastDate)}${f.confident ? '' : ' (rough)'}${f.daysLate > 0 ? ` · ${f.daysLate} days late` : ' · on time'}`;

  return (
    <Box>
      <PageHeader
        title="Decision Center"
        description="Spot problems, test a fix before you commit to it, and see afterwards whether it worked."
      />

      <TextField
        select
        size="small"
        label="Project"
        value={projectId}
        onChange={(e) => {
          setProjectId(e.target.value);
          setSimulatorSeed({ key: simulatorSeed.key + 1, changes: null });
        }}
        sx={{ minWidth: 260, mb: 2.5 }}
      >
        {(projects ?? []).map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>

      {!projects?.length && <Alert severity="info">You don&apos;t manage any projects yet.</Alert>}
      {isError && (
        <Alert severity="info">The Decision Center needs the Node.js + Express backend (npm run dev:express).</Alert>
      )}
      {projectId && viewLoading && <LoadingState label="Loading project…" />}

      {view && (
        <>
          {/* איפה הפרויקט עומד כרגע */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {[
              { label: 'Forecast finish', value: forecastLabel },
              { label: 'Target date', value: formatDate(view.project.targetDate) },
              { label: 'Open tasks', value: view.evaluation.openTasks },
              {
                label: 'Over capacity',
                value: view.evaluation.overCapacity.length
                  ? view.evaluation.load.filter((l) => view.evaluation.overCapacity.includes(l.userId)).map((l) => l.name).join(', ')
                  : 'Nobody',
              },
            ].map((s) => (
              <Grid key={s.label} size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      {s.label}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {s.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Delay risk
                  </Typography>
                  <RiskBadge score={view.evaluation.riskScore} level={view.evaluation.riskLevel} compact />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #E7E7EB' }}>
              <Tab value="recommendations" label="Recommendations" />
              <Tab value="simulator" label="What-if simulator" />
              <Tab value="log" label="Decision log" />
            </Tabs>
            <CardContent>
              {tab === 'recommendations' && (
                <RecommendationsPanel
                  projectId={projectId}
                  onOpenInSimulator={(changes) => {
                    setSimulatorSeed({ key: simulatorSeed.key + 1, changes });
                    setTab('simulator');
                  }}
                />
              )}
              {tab === 'simulator' && (
                <SimulatorPanel key={`${projectId}-${simulatorSeed.key}`} projectId={projectId} view={view} initialChanges={simulatorSeed.changes} />
              )}
              {tab === 'log' && (
                <Stack spacing={1}>
                  <DecisionLogPanel projectId={projectId} />
                </Stack>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
