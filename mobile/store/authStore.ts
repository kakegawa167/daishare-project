import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { loginRevenueCat, logoutRevenueCat } from '@/lib/purchases';

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
  plan: 'normal' | 'pro';
  plan_expires_at: string | null;
  is_over_limit: boolean;
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
    const body = {
      email: session.user.email,
      display_name: session.user.user_metadata?.full_name ?? session.user.email,
    };
    // Render コールドスタート対策: 最大3回リトライ
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await api.post('/auth/sync', body);
        set({ user: res.data });
        loginRevenueCat(session.user.id).catch(() => {});
        return;
      } catch (e) {
        console.warn(`syncUser attempt ${attempt} failed`, e);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    console.error('syncUser failed after 3 attempts');
  },

  signOut: async () => {
    logoutRevenueCat().catch(() => {});
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
