import '../global.css';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SessionProvider } from '../src/state/SessionContext';
import { persistOptions, QUERY_CACHE_MAX_AGE } from '../src/state/queryPersist';
import { SyncBanner } from '../src/components/mobile/SyncBanner';

export default function RootLayout() {
  // Instância única por arranque. Criada em estado e não em módulo para que o
  // fast refresh não deixe dois clientes com caches divergentes.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Uma noite no bar passa-se em rede fraca: uma tentativa extra
            // chega, cinco só atrasam o erro que o utilizador tem de ver.
            retry: 1,
            refetchOnWindowFocus: false,
            // O cache vai para disco: uma query descartada da memória antes de
            // ser guardada nunca chegaria lá. Tem de acompanhar o `maxAge` da
            // persistência.
            gcTime: QUERY_CACHE_MAX_AGE,
          },
          mutations: {
            // As mutações passam pela fila offline, que trata das repetições.
            retry: 0,
          },
        },
      }),
  );

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <SessionProvider>
        <StatusBar style="light" />
        <SyncBanner />
        <Stack screenOptions={{ headerShown: false }} />
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}
