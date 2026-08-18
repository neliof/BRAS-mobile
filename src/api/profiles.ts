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

/**
 * Cria um perfil e liga-o ao grupo.
 *
 * Duas escritas sem transação, como em `createSession`: se a ligação falhar, o
 * perfil é apagado. Um perfil sem linha em `group_members` não é visível por
 * ninguém — a política de leitura passa por essa tabela — e ficaria a ocupar o
 * nome sem forma de lhe chegar.
 *
 * Só um administrador passa `profiles_write_admin`; para os restantes o insert
 * é recusado pelo RLS.
 */
export async function createGroupProfile(input: {
  groupId: string;
  name: string;
  nickname?: string;
}): Promise<Profile> {
  const name = input.name.trim();
  const nickname = input.nickname?.trim();

  if (!name) {
    throw new Error('createGroupProfile: o nome é obrigatório');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({
      name,
      nickname: nickname || undefined,
      // O papel que conta é o do vínculo do dispositivo (`device_grants`), não
      // esta coluna; fica em `member` para não sugerir o contrário.
      role: 'member',
      active: true,
      avatar_url: '',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: input.groupId,
    profile_id: profile.id,
    role: 'member',
  });

  if (memberError) {
    await supabase.from('profiles').delete().eq('id', profile.id);
    throw new Error(memberError.message);
  }

  return profile;
}

/**
 * Corrige o nome ou a alcunha de um membro. Só admin (`profiles_write_admin`);
 * para os restantes o RLS não encontra a linha e o update devolve zero linhas
 * sem erro — daí a verificação explícita.
 */
export async function updateGroupProfile(input: {
  profileId: string;
  name: string;
  nickname?: string;
}): Promise<void> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('O nome é obrigatório.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ name, nickname: input.nickname?.trim() || null })
    .eq('id', input.profileId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Só um administrador pode editar membros.');
  }
}

/**
 * Desativa um perfil. Apagar levaria atrás consumos e pagamentos por
 * `ON DELETE CASCADE`, e as noites passadas deixariam de fechar as contas.
 */
export async function deactivateProfile(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ active: false })
    .eq('id', profileId);

  if (error) throw new Error(error.message);
}
