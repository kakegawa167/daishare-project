import axios from 'axios';
import { supabase } from './supabase';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
  timeout: 30000,
});

// リクエスト時にSupabaseのJWTを自動付与
api.interceptors.request.use(async (config) => {
  // まず Supabase から直接取得（最も信頼性が高い）
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
