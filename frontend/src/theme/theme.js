// תפקיד הקובץ: ערכת העיצוב של MUI: צבעים, גופנים ועיצוב רכיבים.
// משתמשים בו: main.jsx

import { createTheme } from '@mui/material/styles';

// FlowBoard design language: calm light surface, one restrained brand blue,
// semantic colors reserved strictly for status meaning (never decoration).
// ערכת העיצוב שכל רכיבי MUI משתמשים בה.
// נקרא מ: main.jsx
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3454D1',
      light: '#5B75DC',
      dark: '#26399A',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#1B998B',
    },
    success: { main: '#2E7D32', light: '#E6F4EA' },
    warning: { main: '#8A5A00', light: '#FDF1DD' },
    error: { main: '#C62828', light: '#FBE9E9' },
    info: { main: '#2A6FB0', light: '#E8F1FA' },
    background: {
      default: '#FAFAFB',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#18181B',
      secondary: '#6B7080',
    },
    divider: '#E7E7EB',
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: -0.2 },
    h2: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: -0.1 },
    h3: { fontSize: '1.1rem', fontWeight: 600 },
    h4: { fontSize: '0.9rem', fontWeight: 600 },
    h5: { fontSize: '0.875rem', fontWeight: 600 },
    h6: { fontSize: '0.85rem', fontWeight: 600 },
    subtitle1: { fontSize: '0.85rem', fontWeight: 600 },
    body2: { fontSize: '0.8125rem' },
    caption: { fontSize: '0.72rem' },
    button: { textTransform: 'none', fontWeight: 500, fontSize: '0.825rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 6, boxShadow: 'none', paddingLeft: 14, paddingRight: 14, minHeight: 34 },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        outlined: { borderColor: '#DDDFE6' },
        sizeLarge: { borderRadius: 6, minHeight: 40 },
        sizeSmall: { minHeight: 28, paddingLeft: 10, paddingRight: 10 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #E7E7EB',
          borderRadius: 8,
          boxShadow: 'none',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 16, '&:last-child': { paddingBottom: 16 } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 4, fontSize: '0.72rem' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #EFEFF2' },
        head: {
          fontWeight: 600,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          // Was #8A8F9C (~3.2:1 on white - below WCAG AA's 4.5:1 for text this size).
          // text.secondary is already used everywhere else for muted labels and passes at ~4.9:1.
          color: '#6B7080',
          backgroundColor: 'transparent',
          borderBottom: '1px solid #E7E7EB',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: '0.75rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 6, backgroundColor: '#FFFFFF' },
        notchedOutline: { borderColor: '#DDDFE6' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
  },
});
