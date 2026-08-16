import { supabase } from './supabase';
import { saveGroupCode, readGroupCode, clearGroupCode } from './storage';

export interface GroupGrant {
  groupId: string;
  role: 'member' | 'admin';
}

export type AccessErrorCode = 'codigo_invalido' | 'sem_rede' | 'desconhecido';

export class AccessError extends Error {
  code: AccessErrorCode;
  constructor(code: AccessErrorCode, message: string) {
    super(message);
    this.name = 'AccessError';
    this.code = code;
  }
}

async function ensureAnonymousSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new AccessError('sem_rede', 'Não foi possível contactar o servidor.');
  }
}

async function exchange(code: string): Promise<GroupGrant> {
  await ensureAnonymousSession();

  const { data, error } = await supabase.rpc('redeem_group_code', {
    p_code: code,
  });

  if (error) {
    if (error.message.includes('codigo_invalido')) {
      throw new AccessError('codigo_invalido', 'Código inválido.');
    }
    throw new AccessError('desconhecido', error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new AccessError('codigo_invalido', 'Código inválido.');
  }

  return { groupId: row.group_id, role: row.role };
}

/** Troca um código introduzido pelo utilizador. Só guarda se for aceite. */
export async function redeemCode(code: string): Promise<GroupGrant> {
  const grant = await exchange(code.trim());
  await saveGroupCode(code.trim());
  return grant;
}

/**
 * Revalida o código guardado no arranque.
 *
 * A revalidação não é opcional: um administrador pode ter rodado o código para
 * revogar o acesso deste dispositivo. Se deixou de ser válido, o código local
 * é apagado e o utilizador volta ao ecrã de entrada.
 */
export async function restoreAccess(): Promise<GroupGrant | null> {
  const code = await readGroupCode();
  if (!code) return null;

  try {
    return await exchange(code);
  } catch (err) {
    if (err instanceof AccessError && err.code === 'codigo_invalido') {
      await clearGroupCode();
      return null;
    }
    throw err;
  }
}
