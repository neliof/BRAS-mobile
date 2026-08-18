import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// Em desenvolvimento os valores vêm do `.env`. Num APK compilado no EAS o
// `.env` não existe — está no `.gitignore` e nunca é enviado para o servidor
// de build — por isso o fallback lê o `extra` do app.json, que é empacotado.
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

export const isSupabaseConfigured =
  url.startsWith('http') && anonKey.length > 0;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Não há redirecionamentos OAuth nesta app.
    detectSessionInUrl: false,
  },
});
