// קבלת התראות בזמן אמת.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { createNotificationsConnection } from './socket';
import { mapNotification } from '../api/api';

// פותח חיבור ומוסיף כל התראה חדשה לרשימה.
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
    // התחלה שנכשלה או בוטלה (למשל הרכיב ירד מהמסך באמצע ההתחברות) אינה שגיאה שכדאי להציג.
    connection.start().catch(() => {});

    return () => {
      connection.off('notification:new', handleNew);
      connection.off('notification:read', handleReadSync);
      connection.off('notification:read-all', handleReadSync);
      connection.stop().catch(() => {});
    };
  }, [user, queryClient]);
}
