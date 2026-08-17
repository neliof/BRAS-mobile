import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hook para monitorar estado de sincronização offline/online.
 * Verifica AsyncStorage para mutações pendentes e atualiza status.
 */
export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending'>('synced');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const checkPendingMutations = async () => {
      try {
        // Verificar AsyncStorage para chave de fila de mutações
        const queueKey = '@bras_mutation_queue';
        const queueData = await AsyncStorage.getItem(queueKey);

        if (isMounted) {
          if (queueData) {
            try {
              const queue = JSON.parse(queueData);
              const count = Array.isArray(queue) ? queue.length : 0;
              setPendingCount(count);
              setSyncStatus(count > 0 ? 'pending' : 'synced');
            } catch {
              // Fila inválida, limpar
              await AsyncStorage.removeItem(queueKey);
              setPendingCount(0);
              setSyncStatus('synced');
            }
          } else {
            setPendingCount(0);
            setSyncStatus('synced');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar mutações pendentes:', error);
        if (isMounted) {
          setSyncStatus('synced');
          setPendingCount(0);
        }
      }
    };

    // Verificar imediatamente
    checkPendingMutations();

    // Recheck a cada 5 segundos
    const interval = setInterval(checkPendingMutations, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { syncStatus, pendingCount };
}
