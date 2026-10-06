import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import { useDraggable } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';

import { PriorityChip } from '../../components/common/PriorityChip';
import { UserAvatar } from '../../components/common/UserAvatar';
import { formatDateShort } from '../../lib/format';
import { isOverdue } from '../../lib/taskStatus';

export function KanbanTaskCard({ task, assignee, labels, canDrag }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canDrag,
  });
  const overdue = isOverdue(task);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20, opacity: isDragging ? 0.85 : 1 }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      onClick={() => !isDragging && navigate(`/tasks/${task.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`Task: ${task.title}. Priority ${task.priority}. ${canDrag ? 'Press space or enter to pick up and move with arrow keys.' : 'You do not have permission to move this task.'}`}
      sx={{
        p: 1.5,
        mb: 1.25,
        cursor: canDrag ? 'grab' : 'pointer',
        border: task.blocked ? '1px solid #F3C6C6' : '1px solid #E7E7EB',
        backgroundColor: task.blocked ? '#FFFBFB' : '#fff',
        '&:hover': { borderColor: '#C9D0E8' },
        '&:focus-visible': { outline: '2px solid #3454D1', outlineOffset: 2 },
      }}
    >
      {labels.length > 0 && (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
          {labels.map((l) => (
            <Chip
              key={l.id}
              label={l.name}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', backgroundColor: `${l.color}22`, color: l.color, fontWeight: 700 }}
            />
          ))}
        </Stack>
      )}
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        {task.title}
      </Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={0.75} alignItems="center">
          {task.blocked && <BlockIcon sx={{ fontSize: 15, color: 'error.main' }} />}
          {task.dueDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              {overdue && <WarningAmberIcon sx={{ fontSize: 14, color: 'error.main' }} />}
              <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'} fontWeight={overdue ? 700 : 400}>
                {formatDateShort(task.dueDate)}
              </Typography>
            </Box>
          )}
        </Stack>
        <UserAvatar user={assignee} size="small" />
      </Stack>
      <Box sx={{ mt: 1 }}>
        <PriorityChip priority={task.priority} />
      </Box>
    </Card>
  );
}
