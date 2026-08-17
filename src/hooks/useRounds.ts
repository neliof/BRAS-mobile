import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRounds,
  fetchRoundDetails,
  fetchActiveRounds,
  createRound,
  cancelRound,
} from '../api/rounds';
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
        items: Array<{
          productId: string;
          productName: string;
          productImage?: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
        }>;
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
