import '../global.css';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '../src/state/SessionContext';
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
          },
          mutations: {
            // As mutações passam pela fila offline, que trata das repetições.
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="light" />
        <SyncBanner />
        <Stack screenOptions={{ headerShown: false }} />
      </SessionProvider>
    </QueryClientProvider>
  );
}
