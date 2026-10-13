// כרטיס פרויקט.

import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { useNavigate } from 'react-router-dom';

import { ProjectStatusChip } from './StatusChip';
import { RiskBadge } from './RiskBadge';
import { UserAvatarStack } from './UserAvatar';
import { formatDate } from '../../lib/format';

// כרטיס עם שם, סטטוס, התקדמות, סיכון וצוות.
export function ProjectCard({ project, manager, members }) {
  const navigate = useNavigate();
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea onClick={() => navigate(`/projects/${project.id}`)} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              {project.name}
            </Typography>
            <ProjectStatusChip status={project.status} />
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {project.description}
          </Typography>
          <Box sx={{ mt: 'auto' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" fontWeight={700}>
                {project.progress}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={project.progress}
              aria-label={`${project.name} progress`}
              sx={{ height: 6, borderRadius: 3, mb: 1.5 }}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <UserAvatarStack users={manager ? [manager, ...members.filter((m) => m.id !== manager.id)] : members} max={4} />
              <RiskBadge score={project.riskScore} level={project.riskLevel} compact />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Target date: {formatDate(project.targetDate)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
