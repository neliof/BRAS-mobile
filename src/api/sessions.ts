import { supabase } from './supabase';
import type { Session } from '../types';

/**
 * `member_ids`, `rounds`, `payments` e `photos` não são colunas de `sessions` —
 * vivem em tabelas próprias. Sem estes embeds o tipo `Session` mente, e o
 * domínio rebenta a iterar `session.rounds` indefinido.
 *
 * Os alias existem porque a tabela se chama `consumption` (singular) e porque
 * `round.items` é o nome que os tipos usam para `round_items`.
 */
const SESSION_SELECT =
  '*, session_members(member_id, left_at), rounds(*, items:round_items(*, consumptions:consumption(*))), payments(*), photos(*)';

interface SessionRow extends Omit<Session, 'member_ids'> {
  session_members?: { member_id: string; left_at?: string | null }[];
}

function normalizeSession(row: SessionRow): Session {
  const { session_members, ...rest } = row;

  return {
    ...rest,
    // Só quem ESTÁ na noite: quem saiu tem `left_at` e deixa de contar para a
    // próxima rodada — mas as rodadas antigas guardam o seu próprio snapshot.
    member_ids: (session_members ?? [])
      .filter((m) => !m.left_at)
      .map((m) => m.member_id),
    rounds: rest.rounds ?? [],
    payments: rest.payments ?? [],
    photos: rest.photos ?? [],
  };
}

export async function fetchActiveSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(normalizeSession);
}

export async function fetchSessionDetails(sessionId: string): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('id', sessionId)
    .single();

  if (error) throw new Error(error.message);
  return normalizeSession(data);
}

export async function fetchAllSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('group_id', groupId)
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(normalizeSession);
}

export async function createSession(data: {
  groupId: string;
  venueId: string;
  name: string;
  memberIds: string[];
  createdBy: string;
}): Promise<Session> {
  // Sufixo aleatório: a coluna `code` é UNIQUE, e várias noites podem
  // começar no mesmo dia.
  const day = new Date().toISOString().split('T')[0];
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `BRAS-${day}-${suffix}`;
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      group_id: data.groupId,
      venue_id: data.venueId,
      name: data.name,
      code,
      status: 'active',
      started_at: new Date().toISOString(),
      created_by: data.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { error: membersError } = await supabase
    .from('session_members')
    .insert(
      data.memberIds.map((memberId) => ({
        session_id: session.id,
        member_id: memberId,
      })),
    );

  if (membersError) {
    // Sem transação do lado do cliente: apagar a sessão para não deixar
    // uma noite órfã sem membros.
    await supabase.from('sessions').delete().eq('id', session.id);
    throw new Error(membersError.message);
  }

  return {
    ...session,
    member_ids: data.memberIds,
    rounds: [],
    payments: [],
    photos: [],
  };
}

/**
 * Junta um membro à noite (ou volta a juntá-lo, se tinha saído).
 *
 * Quem chega às 21:00 passa a contar para a rodada seguinte; as rodadas
 * anteriores não mudam, porque têm o seu próprio snapshot de membros.
 */
export async function addSessionMember(sessionId: string, memberId: string): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('session_members')
    .select('id')
    .eq('session_id', sessionId)
    .eq('member_id', memberId)
    .limit(1);

  if (findError) throw new Error(findError.message);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('session_members')
      .update({ left_at: null })
      .eq('id', existing[0].id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('session_members').insert({
    session_id: sessionId,
    member_id: memberId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Marca a saída de um membro da noite. Não apaga a linha: `left_at` preserva
 * que esteve cá, e as rodadas em que entrou continuam a mostrá-lo.
 */
export async function removeSessionMember(sessionId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('session_members')
    .update({ left_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('member_id', memberId)
    .is('left_at', null);

  if (error) throw new Error(error.message);
}

/**
 * Apaga uma noite ainda vazia. Só admin — política `sessions_delete_admin`.
 *
 * A guarda das rodadas é deliberada: `sessions` cascateia para `rounds`,
 * `consumption` e `payments`, e apagar uma noite com consumo real apagava
 * contas. Uma noite com rodadas fecha-se, não se apaga.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('rounds')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error('Esta noite já tem rodadas — fecha-a em vez de a apagar.');
  }

  const { error, count: deleted } = await supabase
    .from('sessions')
    .delete({ count: 'exact' })
    .eq('id', sessionId);

  if (error) throw new Error(error.message);
  // Sem permissão, o RLS devolve zero linhas sem erro nenhum. Dizer é melhor
  // do que deixar a noite reaparecer no próximo refetch.
  if ((deleted ?? 0) === 0) {
    throw new Error('Só um administrador pode apagar uma noite.');
  }
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'closed' | 'cancelled',
  updates?: {
    rating?: number;
    quote_of_the_night?: string;
    memory_notes?: string;
  }
): Promise<Session> {
  const { data: session, error } = await supabase
    .from('sessions')
    .update({
      status,
      ended_at: status !== 'active' ? new Date().toISOString() : undefined,
      ...updates,
    })
    .eq('id', sessionId)
    // Com `select()` simples voltava a linha crua, sem `member_ids`, `rounds`,
    // `payments` nem `photos` — e é este objeto que o hook mete no cache dos
    // detalhes. O ecrã da noite lia campos indefinidos logo a seguir a fechar.
    .select(SESSION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return normalizeSession(session);
}

export async function fetchSessionsByDate(groupId: string, date: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('group_id', groupId)
    .eq('date', date)
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(normalizeSession);
}
