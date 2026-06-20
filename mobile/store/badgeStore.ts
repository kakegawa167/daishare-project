import { api } from '@/lib/api';
import { create } from 'zustand';

interface BadgeState {
  unreadNotifications: number;
  unreadMessages: number;
  fetchUnread: () => Promise<void>;
  decrementNotification: () => void;
  clearNotifications: () => void;
}

export const useBadgeStore = create<BadgeState>((set) => ({
  unreadNotifications: 0,
  unreadMessages: 0,

  fetchUnread: async () => {
    try {
      const [notifRes, reqRes] = await Promise.all([
        api.get<{ id: number; is_read: boolean }[]>('/notifications'),
        api.get<{ id: number; unread_count?: number }[]>('/rental-requests'),
      ]);
      const unreadNotifications = notifRes.data.filter((n) => !n.is_read).length;
      set({ unreadNotifications });
    } catch {}
  },

  decrementNotification: () =>
    set((s) => ({ unreadNotifications: Math.max(0, s.unreadNotifications - 1) })),

  clearNotifications: () => set({ unreadNotifications: 0 }),
}));
