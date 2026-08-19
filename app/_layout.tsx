import '../global.css';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SessionProvider, useSession } from '../src/state/SessionContext';
import { persistOptions, QUERY_CACHE_MAX_AGE } from '../src/state/queryPersist';
import { SyncBanner } from '../src/components/mobile/SyncBanner';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

/**
 * Num APK de produção, um erro de render fecha a app sem dizer nada — foi
 * exatamente o sintoma reportado ao iniciar uma noite. Este ecrã transforma
 * esse fecho silencioso numa mensagem legível e num botão de voltar a tentar.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Cor literal de propósito: este ecrã existe para apanhar erros vindos dos
  // providers, e um deles é o do tema — pedir-lhe cores aqui era arriscar
  // rebentar dentro do próprio tratamento do erro.
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#12161F' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text className="text-fg text-xl font-black mb-3">Algo correu mal</Text>
        <Text className="text-danger text-sm mb-6">{error.message}</Text>
        <Pressable onPress={retry} className="bg-brand rounded-2xl px-6 py-4 items-center">
          <Text className="text-on-brand font-black">Tentar de novo</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A casca visual, já dentro dos providers: é o único sítio que precisa das
 * cores do tema em código — a barra de estado e os fundos que o navegador
 * pinta por baixo dos ecrãs não aceitam classes.
 */
function ThemedShell() {
  const { theme } = useTheme();
  const canvas = theme.colors.canvas;

  return (
    // Android novo desenha edge-to-edge: sem a safe area, o conteúdo ficava
    // debaixo da barra de estado em todos os ecrãs.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: canvas }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <SyncBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: canvas } }} />
    </SafeAreaView>
  );
}

/** O tema precisa do grupo (tema de casa) e do papel (só admin o fixa). */
function ThemedSession() {
  const { grant, isAdmin } = useSession();

  return (
    <ThemeProvider groupId={grant?.groupId} isAdmin={isAdmin}>
      <ThemedShell />
    </ThemeProvider>
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
        <ThemedSession />
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}
