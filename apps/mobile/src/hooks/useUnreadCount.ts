import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '@/api';

// 모든 훅 인스턴스가 하나의 상태를 공유
const listeners = new Set<(v: boolean) => void>();
let sharedValue = false;

function broadcast(v: boolean) {
  sharedValue = v;
  listeners.forEach((fn) => fn(v));
}

export function clearUnreadBadge() {
  broadcast(false);
}

// 진행 중인 fetch 공유 (5개 탭이 동시에 요청하지 않도록)
let fetchPromise: Promise<void> | null = null;

async function fetchUnread() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = api.get<{ count: number }>('/notifications/unread', { cacheTtl: 0 })
    .then((res) => { broadcast(res.count > 0); })
    .catch(() => {})
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
}

export function useUnreadCount(): boolean {
  const [hasUnread, setHasUnread] = useState(sharedValue);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    setHasUnread(sharedValue);
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
