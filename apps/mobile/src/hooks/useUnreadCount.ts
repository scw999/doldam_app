import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '@/api';

const listeners = new Set<(v: boolean) => void>();

export function clearUnreadBadge() {
  listeners.forEach((fn) => fn(false));
}

export function useUnreadCount(): boolean {
  const [hasUnread, setHasUnread] = useState(false);
  const appState = useRef(AppState.currentState);

  async function fetchUnread() {
    try {
      const res = await api.get<{ count: number }>('/notifications/unread');
      setHasUnread(res.count > 0);
    } catch {}
  }

  useEffect(() => {
    listeners.add(setHasUnread);
    return () => { listeners.delete(setHasUnread); };
  }, []);

  useEffect(() => {
    fetchUnread();
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        fetchUnread();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  return hasUnread;
}
