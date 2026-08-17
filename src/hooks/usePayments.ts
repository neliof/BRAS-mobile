import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPayments,
  fetchPaymentsByMember,
  fetchPendingPayments,
  createPayment,
  markPaymentComplete,
  updatePayment,
} from '../api/payments';
import { supabase } from '../api/supabase';
import type { Payment, PaymentMethod, PaymentStatus } from '../types';

/**
 * Hook para obter todos os pagamentos de uma sessão.
 * Cache: 15 segundos (pagamentos mudam frequentemente)
 */
export function usePayments(sessionId: string) {
  return useQuery({
    queryKey: ['payments', sessionId],
    queryFn: () => fetchPayments(sessionId),
    staleTime: 15 * 1000, // 15s
    enabled: !!sessionId,
  });
}

/**
 * Hook para obter pagamentos pendentes de uma sessão.
 * Cache: 10 segundos (página mais dinâmica)
 */
export function usePendingPayments(sessionId: string) {
  return useQuery({
    queryKey: ['payments', 'pending', sessionId],
    queryFn: () => fetchPendingPayments(sessionId),
    staleTime: 10 * 1000, // 10s
    enabled: !!sessionId,
  });
}

/**
 * Hook para obter pagamentos de um membro específico numa sessão.
 * Cache: 15 segundos
 */
export function usePaymentsByMember(sessionId: string, memberId: string) {
  return useQuery({
    queryKey: ['payments', sessionId, memberId],
    queryFn: () => fetchPaymentsByMember(sessionId, memberId),
    staleTime: 15 * 1000, // 15s
    enabled: !!sessionId && !!memberId,
  });
}

/**
 * Hook para criar um novo pagamento.
 * Atualiza cache após criar.
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      paymentData,
    }: {
      sessionId: string;
      paymentData: {
        memberId: string;
        amount: number;
        paymentMethod?: PaymentMethod;
        notes?: string;
      };
    }) => createPayment(sessionId, paymentData),

    onSuccess: (newPayment, { sessionId, paymentData }) => {
      // Adiciona o novo pagamento à lista
      queryClient.setQueryData(['payments', sessionId], (old: Payment[] | undefined) => [
        newPayment,
        ...(old || []),
      ]);

      // Invalida pagamentos pendentes
      queryClient.invalidateQueries({
        queryKey: ['payments', 'pending', sessionId],
      });

      // Invalida pagamentos do membro específico
      queryClient.invalidateQueries({
        queryKey: ['payments', sessionId, paymentData.memberId],
      });
    },
  });
}

/**
 * Hook para marcar um pagamento como completo.
 * Atualiza cache após marcar como pago.
 */
export function useMarkPaymentComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      paymentMethod,
    }: {
      paymentId: string;
      paymentMethod?: PaymentMethod;
    }) => markPaymentComplete(paymentId, paymentMethod),

    onSuccess: (completedPayment, { paymentId }) => {
      // Invalida todos os queries de pagamentos para refetch
      queryClient.invalidateQueries({
        queryKey: ['payments'],
      });
    },
  });
}

/**
 * Hook para atualizar um pagamento (quantidade, método, status, notas).
 * Atualiza cache após atualizar.
 */
export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      updates,
    }: {
      paymentId: string;
      updates: {
        amount?: number;
        status?: PaymentStatus;
        paymentMethod?: PaymentMethod;
        notes?: string;
      };
    }) => updatePayment(paymentId, updates),

    onSuccess: () => {
      // Invalida todos os queries de pagamentos para refetch
      queryClient.invalidateQueries({
        queryKey: ['payments'],
      });
    },
  });
}

/**
 * Hook para subscrições realtime em pagamentos de uma sessão.
 * Invalida cache quando há mudanças na BD.
 */
export function useRealtimePayments(sessionId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`payments:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'payments',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Invalida todas as queries de pagamentos desta sessão
          queryClient.invalidateQueries({
            queryKey: ['payments', sessionId],
          });
          queryClient.invalidateQueries({
            queryKey: ['payments', 'pending', sessionId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);
}
