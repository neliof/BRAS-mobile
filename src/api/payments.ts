import { supabase } from './supabase';
import type { Payment, PaymentMethod, PaymentStatus } from '../types';

export async function fetchPayments(sessionId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchPaymentsByMember(
  sessionId: string,
  memberId: string
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('session_id', sessionId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createPayment(
  sessionId: string,
  data: {
    memberId: string;
    amount: number;
    paymentMethod?: PaymentMethod;
    notes?: string;
  }
): Promise<Payment> {
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      session_id: sessionId,
      member_id: data.memberId,
      amount: data.amount,
      payment_method: data.paymentMethod,
      status: 'pending' as PaymentStatus,
      notes: data.notes,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return payment;
}

export async function markPaymentComplete(
  paymentId: string,
  paymentMethod?: PaymentMethod
): Promise<Payment> {
  const { data: payment, error } = await supabase
    .from('payments')
    .update({
      status: 'paid' as PaymentStatus,
      paid_at: new Date().toISOString(),
      ...(paymentMethod && { payment_method: paymentMethod }),
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return payment;
}

export async function updatePayment(
  paymentId: string,
  updates: {
    amount?: number;
    status?: PaymentStatus;
    paymentMethod?: PaymentMethod;
    notes?: string;
  }
): Promise<Payment> {
  const { data: payment, error } = await supabase
    .from('payments')
    .update({
      ...(updates.amount !== undefined && { amount: updates.amount }),
      ...(updates.status && { status: updates.status }),
      ...(updates.paymentMethod && { payment_method: updates.paymentMethod }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.status === 'paid' && { paid_at: new Date().toISOString() }),
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return payment;
}

export async function fetchPendingPayments(sessionId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
