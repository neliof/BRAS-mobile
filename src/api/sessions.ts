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
  '*, session_members(member_id), rounds(*, items:round_items(*, consumptions:consumption(*))), payments(*), photos(*)';

interface SessionRow extends Omit<Session, 'member_ids'> {
  session_members?: { member_id: string }[];
}

function normalizeSession(row: SessionRow): Session {
  const { session_members, ...rest } = row;

  return {
    ...rest,
    member_ids: (session_members ?? []).map((m) => m.member_id),
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
