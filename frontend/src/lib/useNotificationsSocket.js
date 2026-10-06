import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { createNotificationsConnection } from './socket';
import { mapNotification } from '../api/api';

// Real-time delivery for the Notification Center / bell: connects once per signed-in
// session (mounted in AppShell, which only renders behind ProtectedRoute) and keeps the
// `['notifications', userId]` TanStack Query cache in sync via server push, instead of the
// `refetchInterval` poll that hook used before this existed.
export function useNotificationsSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const connection = createNotificationsConnection();
    const queryKey = ['notifications', user.id];

    const handleNew = (raw) => {
      const notification = mapNotification(raw);
      queryClient.setQueryData(queryKey, (prev) => (prev ? [notification, ...prev] : [notification]));
    };
    const handleReadSync = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    connection.on('notification:new', handleNew);
    connection.on('notification:read', handleReadSync);
    connection.on('notification:read-all', handleReadSync);
    // A failed/aborted start (e.g. the component unmounted mid-connect) is not an error worth surfacing.
    connection.start().catch(() => {});

    return () => {
      connection.off('notification:new', handleNew);
      connection.off('notification:read', handleReadSync);
      connection.off('notification:read-all', handleReadSync);
      connection.stop().catch(() => {});
    };
  }, [user, queryClient]);
}
