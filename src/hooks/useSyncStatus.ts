import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { flushQueue, readQueue } from '../state/mutationQueue';
import { offlineHandlers } from '../state/offline';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline';

/**
 * Estado da sincronização offline.
 *
 * Faz duas coisas: mostra quantas mutações estão por enviar, e esvazia a fila
 * assim que a rede volta. O envio é disparado pela transição para online, não
 * por um temporizador — esperar até 5 segundos com rede disponível seria tempo
 * perdido à frente do utilizador.
 */
export function useSyncStatus() {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const queue = await readQueue();
    setPendingCount(queue.length);
    return queue.length;
  }, []);

  const flush = useCallback(async () => {
    const pending = await refreshCount();
    if (pending === 0) {
      setSyncStatus('synced');
      return;
    }

    setSyncStatus('syncing');

    try {
      const result = await flushQueue(offlineHandlers);

      if (result.sent > 0) {
        // A fila toca em rondas e pagamentos; ambos alimentam a sessão.
        queryClient.invalidateQueries({ queryKey: ['rounds'] });
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        queryClient.invalidateQueries({ queryKey: ['sessions'] });
      }

      if (result.dropped.length > 0) {
        console.warn(
          `Fila offline: ${result.dropped.length} mutações descartadas após esgotarem as tentativas.`,
        );
      }

      setPendingCount(result.remaining);
      setSyncStatus(result.remaining > 0 ? 'pending' : 'synced');
    } catch (error) {
      console.error('Erro ao esvaziar a fila offline:', error);
      setSyncStatus('pending');
    }
  }, [queryClient, refreshCount]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (cancelled) return;

      const online = state.isConnected !== false && state.isInternetReachable !== false;

      if (!online) {
        setSyncStatus('offline');
        void refreshCount();
        return;
      }

      void flush();
    });

    // Uma primeira leitura para o caso de a app abrir já com fila pendente e a
    // rede não mudar de estado tão cedo.
    void flush();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [flush, refreshCount]);

  return { syncStatus, pendingCount, flush };
}
