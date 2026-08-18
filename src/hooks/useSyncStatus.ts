import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { readLastSyncAt, saveLastSyncAt } from '../api/storage';
import { flushQueue, readQueue } from '../state/mutationQueue';
import { isOnline, offlineHandlers } from '../state/offline';

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
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readLastSyncAt().then((value) => {
      if (!cancelled) setLastSyncedAt(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  /**
   * Sincronização pedida pelo utilizador: envia o que está em fila e volta a
   * ler do servidor o que está no ecrã.
   *
   * Existe porque o automático só dispara na transição para online. Quem chega
   * ao bar com a app já aberta, ou quem acabou de ser adicionado ao grupo,
   * precisa de puxar os dados sem esperar que a rede oscile.
   */
  const syncNow = useCallback(async () => {
    if (!(await isOnline())) {
      setSyncStatus('offline');
      await refreshCount();
      return false;
    }

    setSyncStatus('syncing');
    await flush();
    await queryClient.refetchQueries({ type: 'active' });

    const now = new Date().toISOString();
    await saveLastSyncAt(now);
    setLastSyncedAt(now);
    return true;
  }, [flush, queryClient, refreshCount]);

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

  return { syncStatus, pendingCount, lastSyncedAt, flush, syncNow };
}
