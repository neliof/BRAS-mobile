import { supabase } from './supabase';
import type { Round } from '../types';

export async function fetchRounds(sessionId: string): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchRoundDetails(roundId: string): Promise<Round> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*, round_items(*, consumptions(*))')
    .eq('id', roundId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createRound(
  sessionId: string,
  data: {
    roundNumber: number;
    requestedBy: string;
    createdBy: string;
    notes?: string;
    items: Array<{
      productId: string;
      productName: string;
      productImage?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }
): Promise<Round> {
  const totalAmount = data.items.reduce((sum, item) => sum + item.totalPrice, 0);

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      session_id: sessionId,
      round_number: data.roundNumber,
      requested_by: data.requestedBy,
      created_by: data.createdBy,
      created_at: new Date().toISOString(),
      notes: data.notes,
      status: 'active',
      total_amount: totalAmount,
      items: data.items,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return round;
}

export async function cancelRound(
  roundId: string,
  reason?: string
): Promise<Round> {
  const { data: round, error } = await supabase
    .from('rounds')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
    })
    .eq('id', roundId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return round;
}

export async function fetchActiveRounds(sessionId: string): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
