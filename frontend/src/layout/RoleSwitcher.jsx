// החלפת התפקיד הפעיל.

import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import { useAuth, ROLE_LABELS } from '../auth/AuthContext';

// בחירה באיזה תפקיד לצפות באתר.
// נקרא מ: Topbar.jsx
// קורא ל: useAuth
export function RoleSwitcher() {
  const { availableRoles, activeRole, setActiveRole } = useAuth();
  if (availableRoles.length <= 1) return null;

  const handleChange = (e) => setActiveRole(e.target.value);

  return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          borderRadius: 2,
          pl: 1,
          pr: 0.5,
        }}
      >
        <ManageAccountsOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
          Active role
        </Typography>
        <FormControl size="small" variant="standard">
          <Select
            value={activeRole}
            onChange={handleChange}
            disableUnderline
            inputProps={{ 'aria-label': 'Choose active role' }}
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              maxWidth: { xs: 96, sm: 180, md: 'none' },
              '.MuiSelect-select': {
                py: 0.5,
                pr: '24px !important',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            }}
          >
            {availableRoles.map((role) => (
              <MenuItem key={role} value={role} sx={{ fontSize: '0.85rem' }}>
                {ROLE_LABELS[role]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
  );
}
