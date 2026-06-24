import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  syncUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface AppUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  base_station_id: number | null;
  lending_address: string | null;
  user_type: 'lender' | 'renter' | 'both';
  expo_push_token: string | null;
  is_new?: boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  loading: true,

  setSession: (session) => {
    set({ session, loading: false });
  },

  syncUser: async () => {
    const { session } = get();
    if (!session) return;
    try {
      const res = await api.post('/auth/sync', {
        email: session.user.email,
        display_name: session.user.user_metadata?.full_name ?? session.user.email,
      });
      set({ user: res.data });
    } catch (e) {
      console.error('syncUser failed', e);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
