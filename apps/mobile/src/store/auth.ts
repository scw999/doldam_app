import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

interface AuthState {
  token: string | null;         // 최종 user JWT
  tempToken: string | null;     // 온보딩 중인 임시 JWT (temp_phone scope)
  userId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUser: (token: string, userId: string) => Promise<void>;
  setTempToken: (t: string) => Promise<void>;
  clear: () => Promise<void>;
}

const KEYS = {
  TOKEN: 'auth_token',
  TEMP: 'auth_temp_token',
  USER: 'user_id',
} as const;

const onClearCallbacks: (() => void)[] = [];
export function onAuthClear(cb: () => void) { onClearCallbacks.push(cb); }

export const useAuth = create<AuthState>((set) => ({
  token: null,
  tempToken: null,
  userId: null,
  hydrated: false,

  hydrate: async () => {
    const [token, temp, userId] = await Promise.all([
      AsyncStorage.getItem(KEYS.TOKEN),
      AsyncStorage.getItem(KEYS.TEMP),
      AsyncStorage.getItem(KEYS.USER),
    ]);
    set({ token, tempToken: temp, userId, hydrated: true });
  },

  setUser: async (token, userId) => {
    await AsyncStorage.multiSet([[KEYS.TOKEN, token], [KEYS.USER, userId]]);
    await AsyncStorage.removeItem(KEYS.TEMP);
    set({ token, userId, tempToken: null });
  },

  setTempToken: async (t) => {
    await AsyncStorage.setItem(KEYS.TEMP, t);
    set({ tempToken: t });
  },

  clear: async () => {
    await AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.TEMP, KEYS.USER]);
    onClearCallbacks.forEach((cb) => cb());
    set({ token: null, tempToken: null, userId: null });
  },
}));
