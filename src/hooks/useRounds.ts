import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRounds,
  fetchRoundDetails,
  fetchActiveRounds,
  createRound,
  cancelRound,
  type CreateRoundItem,
} from '../api/rounds';
import { supabase } from '../api/supabase';
import type { Round } from '../types';

/**
 * Hook para obter todas as rondas de uma sessão.
 * Cache: 15 segundos (rondas mudam frequentemente)
 */
export function useRounds(sessionId: string) {
  return useQuery({
    queryKey: ['rounds', sessionId],
    queryFn: () => fetchRounds(sessionId),
    staleTime: 15 * 1000, // 15s
    enabled: !!sessionId,
  });
}

/**
 * Hook para obter apenas as rondas ativas (não canceladas) de uma sessão.
 * Cache: 15 segundos
 */
export function useActiveRounds(sessionId: string) {
  return useQuery({
    queryKey: ['rounds', 'active', sessionId],
    queryFn: () => fetchActiveRounds(sessionId),
    staleTime: 15 * 1000, // 15s
    enabled: !!sessionId,
  });
}

/**
 * Hook para obter detalhes de uma ronda específica, incluindo items e consumo.
 * Cache: 15 segundos
 */
export function useRoundDetails(roundId: string) {
  return useQuery({
    queryKey: ['rounds', 'details', roundId],
    queryFn: () => fetchRoundDetails(roundId),
    staleTime: 15 * 1000, // 15s
    enabled: !!roundId,
  });
}

/**
 * Hook para criar uma nova ronda.
 * Atualiza cache após criar.
 */
export function useCreateRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      roundData,
    }: {
      sessionId: string;
      roundData: {
        roundNumber: number;
        requestedBy: string;
        createdBy: string;
        notes?: string;
        items: CreateRoundItem[];
      };
    }) => createRound(sessionId, roundData),

    onSuccess: (newRound, { sessionId }) => {
      // Adiciona a nova ronda à lista
      queryClient.setQueryData(['rounds', sessionId], (old: Round[] | undefined) => [
        newRound,
        ...(old || []),
      ]);

      // Invalida rondas ativas para refetch
      queryClient.invalidateQueries({
        queryKey: ['rounds', 'active', sessionId],
      });
    },
  });
}

/**
 * Hook para cancelar uma ronda.
 * Atualiza cache após cancelar.
 */
export function useCancelRound() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roundId, reason }: { roundId: string; reason?: string }) =>
      cancelRound(roundId, reason),

    onSuccess: (cancelledRound, { roundId }) => {
      // Atualiza a ronda no cache de detalhes
      queryClient.setQueryData(['rounds', 'details', roundId], cancelledRound);

      // Invalida todas as queries de rondas (melhor refetch de todas)
      queryClient.invalidateQueries({
        queryKey: ['rounds'],
      });
    },
  });
}

/**
 * Hook para subscrições realtime em rondas de uma sessão.
 * Invalida cache quando há mudanças na BD.
 */
export function useRealtimeRounds(sessionId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`rounds:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'rounds',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Invalida todas as queries de rondas desta sessão
          queryClient.invalidateQueries({
            queryKey: ['rounds', sessionId],
          });
          queryClient.invalidateQueries({
            queryKey: ['rounds', 'active', sessionId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);
}
