import { supabase } from './supabase';
import type { Profile } from '../types';

/**
 * Perfis ativos de um grupo.
 *
 * A consulta parte de group_members porque é essa tabela que define a
 * pertença. As políticas RLS já limitam o resultado aos grupos do
 * dispositivo, mas o filtro explícito mantém a intenção legível.
 */
export async function fetchGroupProfiles(groupId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('profiles(*)')
    .eq('group_id', groupId)
    .order('profile_id', { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as { profiles: Profile | null }[])
    .map((row) => row.profiles)
    .filter((p): p is Profile => p !== null && p.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));
}
