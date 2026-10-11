// תפקיד הקובץ: הגדרות המטמון של TanStack Query לכל האתר.
// משתמשים בו: main.jsx

import { QueryClient } from '@tanstack/react-query';

// המטמון המשותף: זמן טריות וניסיון חוזר.
// נקרא מ: main.jsx
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
