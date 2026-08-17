import { supabase } from './supabase';
import type { Session } from '../types';

export async function fetchActiveSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchSessionDetails(sessionId: string): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, rounds(*, round_items(*, consumptions(*))), payments(*), photos(*)')
    .eq('id', sessionId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchAllSessions(groupId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createSession(data: {
  groupId: string;
  venueId: string;
  name: string;
  memberIds: string[];
  createdBy: string;
}): Promise<Session> {
  const code = `BRAS-${new Date().toISOString().split('T')[0]}`;
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
      member_ids: data.memberIds,
      rounds: [],
      payments: [],
      photos: [],
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return session;
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
    .select()
    .single();

  if (error) throw new Error(error.message);
  return session;
}

export async function fetchSessionsByDate(groupId: string, date: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', date)
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
