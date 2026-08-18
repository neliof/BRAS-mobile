import '../global.css';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SessionProvider } from '../src/state/SessionContext';
import { persistOptions, QUERY_CACHE_MAX_AGE } from '../src/state/queryPersist';
import { SyncBanner } from '../src/components/mobile/SyncBanner';

/**
 * Num APK de produção, um erro de render fecha a app sem dizer nada — foi
 * exatamente o sintoma reportado ao iniciar uma noite. Este ecrã transforma
 * esse fecho silencioso numa mensagem legível e num botão de voltar a tentar.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#12161F' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text className="text-white text-xl font-black mb-3">Algo correu mal</Text>
        <Text className="text-red-300 text-sm mb-6">{error.message}</Text>
        <Pressable onPress={retry} className="bg-brand rounded-2xl px-6 py-4 items-center">
          <Text className="text-black font-black">Tentar de novo</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

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
        {/* Android novo desenha edge-to-edge: sem a safe area, o conteúdo
            ficava debaixo da barra de estado em todos os ecrãs. */}
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#12161F' }}>
          <StatusBar style="light" />
          <SyncBanner />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#12161F' } }} />
        </SafeAreaView>
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}
