// שורת משימה ברשימה.

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import { useNavigate } from 'react-router-dom';

import { PriorityChip } from './PriorityChip';
import { UserAvatar } from './UserAvatar';
import { formatDateShort } from '../../lib/format';
import { isOverdue } from '../../lib/taskStatus';

// שורה עם כותרת, אחראי, עדיפות ומועד; לחיצה פותחת את המשימה.
// נקרא מ: PersonalDashboardPage.jsx, MyTasksPage.jsx
export function TaskRow({ task, assignee, projectName, showProject = false }) {
  const navigate = useNavigate();
  const overdue = isOverdue(task);

  return (
    <ListItemButton
      onClick={() => navigate(`/tasks/${task.id}`)}
      sx={{ borderRadius: 2, border: '1px solid #E7E7EB', mb: 1, px: 1.5, py: 1 }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
        <UserAvatar user={assignee} size="small" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {task.title}
            </Typography>
            {task.blocked && <BlockIcon sx={{ fontSize: 15, color: 'error.main' }} titleAccess="Blocked" />}
          </Stack>
          {showProject && projectName && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {projectName}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {task.dueDate && (
            <Stack direction="row" spacing={0.4} alignItems="center">
              {overdue && <WarningAmberIcon sx={{ fontSize: 15, color: 'error.main' }} />}
              <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'} fontWeight={overdue ? 700 : 400}>
                {formatDateShort(task.dueDate)}
              </Typography>
            </Stack>
          )}
          <PriorityChip priority={task.priority} />
        </Stack>
      </Stack>
    </ListItemButton>
  );
}
