// עמודה בלוח.

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import { useDroppable } from '@dnd-kit/core';

import { KanbanTaskCard } from './KanbanTaskCard';
import { EmptyState } from '../../components/common/States';

// עמודה שאפשר לשחרר בה כרטיס, עם מונה ומגבלת WIP.
// נקרא מ: KanbanBoardPage.jsx
export function KanbanColumn({ column, tasks, userMap, labelMap, canDragTask }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const overLimit = !!column.wipLimit && tasks.length > column.wipLimit;

  return (
    <Box
      sx={{
        minWidth: 288,
        maxWidth: 288,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F6F6F8',
        borderRadius: 2,
        border: isOver ? '2px dashed #3454D1' : '2px dashed transparent',
        transition: 'border-color 0.15s ease',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1">{column.name}</Typography>
          <Chip label={tasks.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        </Stack>
        {column.wipLimit && (
          <Typography variant="caption" color={overLimit ? 'error.main' : 'text.secondary'} fontWeight={overLimit ? 700 : 400}>
            WIP {tasks.length}/{column.wipLimit}
          </Typography>
        )}
      </Stack>
      <Box
        ref={setNodeRef}
        data-testid="kanban-column-dropzone"
        data-column-name={column.name}
        sx={{ flex: 1, px: 1.5, pb: 1.5, minHeight: 160, overflowY: 'auto' }}
      >
        {tasks.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <EmptyState title="No tasks" description="Drag a task here." />
          </Box>
        ) : (
          tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              assignee={task.assigneeId ? userMap.get(task.assigneeId) : null}
              labels={task.labelIds.map((id) => labelMap.get(id)).filter((l) => !!l)}
              canDrag={canDragTask(task)}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
