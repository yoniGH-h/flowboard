import Chip from '@mui/material/Chip';

const PROJECT_STATUS_CONFIG = {
  PLANNING: { label: 'Planning', color: 'info' },
  ACTIVE: { label: 'Active', color: 'success' },
  AT_RISK: { label: 'At Risk', color: 'error' },
  ON_HOLD: { label: 'On Hold', color: 'warning' },
  COMPLETED: { label: 'Completed', color: 'default' },
  ARCHIVED: { label: 'Archived', color: 'default' },
};

const COLUMN_CATEGORY_CONFIG = {
  TODO: { label: 'To Do', color: 'default' },
  IN_PROGRESS: { label: 'In Progress', color: 'info' },
  REVIEW: { label: 'In Review', color: 'warning' },
  DONE: { label: 'Done', color: 'success' },
};

export function ProjectStatusChip({ status }) {
  const cfg = PROJECT_STATUS_CONFIG[status];
  return <Chip size="small" label={cfg.label} color={cfg.color} variant={cfg.color === 'default' ? 'outlined' : 'filled'} />;
}

export function ColumnCategoryChip({ category }) {
  const cfg = COLUMN_CATEGORY_CONFIG[category];
  return <Chip size="small" label={cfg.label} color={cfg.color} variant={cfg.color === 'default' ? 'outlined' : 'filled'} />;
}
