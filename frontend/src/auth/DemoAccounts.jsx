import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

// Demo mode only (VITE_DEMO_MODE=true): one-click sign-in with the seeded demo accounts, for
// presenting the system. SignInPage loads this file only in demo mode, so a production build
// contains neither the accounts nor the password.
const DEMO_PASSWORD = 'password123';

const DEMO_ACCOUNTS = [
  { email: 'ava.reynolds@nimbusdigital.io', label: 'Ava Reynolds — all roles (Nimbus Digital)' },
  { email: 'priya.sharma@nimbusdigital.io', label: 'Priya Sharma — Employee (Nimbus Digital)' },
  { email: 'daniel.cho@nimbusdigital.io', label: 'Daniel Cho — Project Manager (Nimbus Digital)' },
  { email: 'grace.kim@harborline.com', label: 'Grace Kim — Org Admin (Harborline Logistics)' },
];

export default function DemoAccounts({ onSignIn, disabled }) {
  return (
    <>
      <Divider sx={{ my: 2.5 }}>
        <Typography variant="caption" color="text.secondary">
          DEMO ACCOUNTS
        </Typography>
      </Divider>
      <Stack spacing={0.75}>
        {DEMO_ACCOUNTS.map((acc) => (
          <Button
            key={acc.email}
            variant="outlined"
            size="small"
            onClick={() => onSignIn(acc.email, DEMO_PASSWORD)}
            disabled={disabled}
            sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
          >
            {acc.label}
          </Button>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Demo mode is on. Password for any demo account: <strong>{DEMO_PASSWORD}</strong> (local demo data only).
        </Typography>
      </Stack>
    </>
  );
}
