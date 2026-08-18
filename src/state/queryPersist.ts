import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

export const QUERY_CACHE_KEY = '@bras_query_cache';

/**
 * Uma semana. A app é usada uma ou duas noites por semana; menos do que isto e
 * quem abre à sexta seguinte encontrava tudo vazio.
 */
export const QUERY_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Cache do React Query guardado em disco.
 *
 * Sem isto, fechar a app apaga tudo o que já se tinha lido: reabrir no bar sem
 * rede dava ecrãs vazios. As escritas offline já estavam tratadas pela fila de
 * mutações; faltava o lado da leitura.
 *
 * O que fica em disco são dados do grupo — nomes, dívidas, rondas. Não é
 * segredo do mesmo nível que o código do grupo (esse continua no SecureStore),
 * mas é histórico do grupo em claro no dispositivo, logo `signOut` tem de o
 * apagar. Ver `clearPersistedCache`.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  // Uma escrita por segundo, no máximo: durante uma ronda o cache muda muitas
  // vezes seguidas e gravar em cada mudança bloqueia a interface.
  throttleTime: 1000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: QUERY_CACHE_MAX_AGE,
  dehydrateOptions: {
    // As mutações pendentes pertencem à fila offline, que as guarda com as suas
    // próprias tentativas. Persistir aqui também seria enviá-las duas vezes.
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) => {
      // URLs assinados expiram numa hora: guardá-los é guardar links mortos.
      if (query.queryKey[0] === 'photo-urls') return false;
      return query.state.status === 'success';
    },
  },
};

/** Apaga o cache em disco. Chamado ao sair do grupo. */
export async function clearPersistedCache(): Promise<void> {
  await queryPersister.removeClient();
}
