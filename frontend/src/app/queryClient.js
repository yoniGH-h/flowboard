// הגדרות המטמון.

import { QueryClient } from '@tanstack/react-query';

// המטמון המשותף: זמן טריות וניסיון חוזר.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
