// תגית עדיפות.

import Chip from '@mui/material/Chip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';

const CONFIG = {
  LOW: { label: 'Low', color: '#2A6FB0', bg: '#E8F1FA', icon: <ArrowDownwardIcon sx={{ fontSize: 14 }} /> },
  MEDIUM: { label: 'Medium', color: '#5C6478', bg: '#EEF0F5', icon: <RemoveIcon sx={{ fontSize: 14 }} /> },
  HIGH: { label: 'High', color: '#8A5A00', bg: '#FDF1DD', icon: <ArrowUpwardIcon sx={{ fontSize: 14 }} /> },
  URGENT: { label: 'Urgent', color: '#C62828', bg: '#FBE9E9', icon: <PriorityHighIcon sx={{ fontSize: 14 }} /> },
};

// תגית צבעונית לפי עדיפות.
export function PriorityChip({ priority }) {
  const cfg = CONFIG[priority];
  return (
    <Chip
      size="small"
      icon={cfg.icon}
      label={cfg.label}
      sx={{
        color: cfg.color,
        backgroundColor: cfg.bg,
        '& .MuiChip-icon': { color: cfg.color },
      }}
    />
  );
}
