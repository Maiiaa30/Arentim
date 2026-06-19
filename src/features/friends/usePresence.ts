import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Joins a shared presence channel and returns the set of online user ids.
 * Also sends a periodic last_online heartbeat so "last seen" stays fresh.
 */
export function usePresence(): Set<string> {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('presence:online', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ online_at: new Date().toISOString() });
        }
      });

    void supabase.rpc('touch_last_online');
    const heartbeat = window.setInterval(() => {
      void supabase.rpc('touch_last_online');
    }, 60_000);

    return () => {
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return online;
}
