// תפקיד הקובץ: החיפוש בסרגל העליון.
// משתמשים בו: Topbar.jsx

import { useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { useNavigate } from 'react-router-dom';
import { useProjects, useTasks } from '../lib/queries';

// שדה חיפוש של פרויקטים ומשימות.
// נקרא מ: Topbar.jsx
export function GlobalSearch() {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects({ includeArchived: true });
  const { data: tasks = [] } = useTasks({ includeArchived: false });

  const options = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    const projectOpts = projects
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({ id: p.id, type: 'project', label: p.name, secondary: 'Project', path: `/projects/${p.id}` }));
    const taskOpts = tasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({ id: t.id, type: 'task', label: t.title, secondary: 'Task', path: `/tasks/${t.id}` }));
    return [...projectOpts, ...taskOpts];
  }, [term, projects, tasks]);

  return (
    <Autocomplete
      size="small"
      freeSolo
      options={options}
      filterOptions={(x) => x}
      inputValue={term}
      onInputChange={(_e, value) => setTerm(value)}
      onChange={(_e, value) => {
        if (value && typeof value !== 'string') navigate(value.path);
      }}
      noOptionsText={term.trim().length < 2 ? 'Type to search projects and tasks…' : 'No matches'}
      sx={{ width: { xs: '100%', sm: 320 } }}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
          {option.type === 'project' ? (
            <FolderOutlinedIcon fontSize="small" color="action" />
          ) : (
            <TaskAltOutlinedIcon fontSize="small" color="action" />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {option.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {option.secondary}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search projects and tasks…"
          aria-label="Global search"
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
}
