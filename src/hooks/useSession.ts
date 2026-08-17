import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchActiveSessions,
  fetchSessionDetails,
  fetchAllSessions,
  createSession,
  updateSessionStatus,
} from '../api/sessions';
import type { Session } from '../types';

/**
 * Hook para obter sessões ativas de um grupo.
 * Cache: 30 segundos
 */
export function useSession(groupId: string) {
  return useQuery({
    queryKey: ['sessions', groupId],
    queryFn: () => fetchActiveSessions(groupId),
    staleTime: 30 * 1000, // 30s
    enabled: !!groupId,
  });
}

/**
 * Hook para obter todas as sessões (ativas e fechadas) de um grupo.
 * Cache: 30 segundos
 */
export function useAllSessions(groupId: string) {
  return useQuery({
    queryKey: ['sessions', 'all', groupId],
    queryFn: () => fetchAllSessions(groupId),
    staleTime: 30 * 1000, // 30s
    enabled: !!groupId,
  });
}

/**
 * Hook para obter detalhes de uma sessão específica, incluindo rondas e pagamentos.
 * Cache: 30 segundos
 */
export function useSessionDetails(sessionId: string) {
  return useQuery({
    queryKey: ['sessions', 'details', sessionId],
    queryFn: () => fetchSessionDetails(sessionId),
    staleTime: 30 * 1000, // 30s
    enabled: !!sessionId,
  });
}

/**
 * Hook para criar uma nova sessão.
 * Atualiza cache após criar.
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSession,
    onSuccess: (newSession) => {
      // Adiciona a nova sessão à lista de sessões ativas
      queryClient.setQueryData(['sessions', newSession.group_id], (old: Session[] | undefined) => [
        newSession,
        ...(old || []),
      ]);

      // Invalida a lista de todas as sessões para refetch
      queryClient.invalidateQueries({
        queryKey: ['sessions', 'all', newSession.group_id],
      });
    },
  });
}

/**
 * Hook para atualizar o status de uma sessão (fechar, cancelar, etc.).
 * Atualiza cache após mudar status.
 */
export function useUpdateSessionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      status,
      updates,
    }: {
      sessionId: string;
      status: 'active' | 'closed' | 'cancelled';
      updates?: {
        rating?: number;
        quote_of_the_night?: string;
        memory_notes?: string;
      };
    }) => updateSessionStatus(sessionId, status, updates),

    onSuccess: (updatedSession) => {
      // Atualiza a sessão no cache de detalhes
      queryClient.setQueryData(['sessions', 'details', updatedSession.id], updatedSession);

      // Invalida lista de sessões ativas (para remover se fechada)
      queryClient.invalidateQueries({
        queryKey: ['sessions', updatedSession.group_id],
      });

      // Invalida lista de todas as sessões
      queryClient.invalidateQueries({
        queryKey: ['sessions', 'all', updatedSession.group_id],
      });
    },
  });
}
