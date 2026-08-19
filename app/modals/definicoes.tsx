import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../src/state/SessionContext';
import { useSyncStatus } from '../../src/hooks/useSyncStatus';
import { clearQueue, readQueue } from '../../src/state/mutationQueue';
import { clearPersistedCache } from '../../src/state/queryPersist';
import { useTheme } from '../../src/theme/ThemeContext';
import { THEMES, THEME_NAMES, withAlpha } from '../../src/theme/tokens';

export default function DefinicoesModal() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { profile, isAdmin, signOut } = useSession();
  const queryClient = useQueryClient();
  const { pendingCount, lastSyncedAt, syncNow } = useSyncStatus();
  // Escrita no app.json a cada build; o APK não sabe quando foi compilado.
  const buildDate = (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.BUILD_DATE;
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readQueue().then((queue) => {
      if (!cancelled) setPending(queue.length);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingCount]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      const done = await syncNow();
      if (!done) setError('Sem rede. Tenta outra vez quando houver ligação.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'A sincronização falhou.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    // Rodadas e pagamentos em fila pertencem à sessão deste grupo. Sem o vínculo
    // o RLS recusa-os para sempre, e ficariam a tentar até serem descartados.
    const pendingWarning =
      pending > 0
        ? ` Há ${pending} ${pending === 1 ? 'alteração' : 'alterações'} por enviar que se perdem.`
        : '';

    Alert.alert(
      'Sair do grupo',
      `O código do grupo é apagado deste telemóvel. Para voltar a entrar tens de o introduzir outra vez.${pendingWarning}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await signOut();
              // O cache guarda noites, dívidas e fotos do grupo de onde se
              // saiu; sem o limpar, o próximo código a entrar via-os.
              queryClient.clear();
              // `clear()` só esvazia a memória. O cache em disco tem de sair
              // também, senão o histórico do grupo anterior fica no telemóvel.
              await clearPersistedCache();
              await clearQueue();
              // `replace` e não `back`: sem vínculo não há ecrã de grupo para
              // onde voltar.
              router.replace('/(gate)/codigo');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Não foi possível sair.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView className="flex-1 bg-canvas">
      <View className="px-4 py-6">
        <Text className="text-fg text-2xl font-black mb-6">Definições</Text>

        <View className="bg-fg/10 rounded-2xl p-4 border border-fg/20 mb-6">
          <Text className="text-fg/60 text-xs mb-1">Perfil atual</Text>
          <Text className="text-fg font-bold text-lg">{profile?.name ?? 'Sem perfil'}</Text>
          <Text className="text-fg/60 text-xs mt-2">
            {isAdmin ? 'Administrador do grupo' : 'Membro do grupo'}
          </Text>
          {pending > 0 && (
            <Text className="text-brand text-xs mt-2">
              {pending} {pending === 1 ? 'alteração' : 'alterações'} por enviar
            </Text>
          )}
        </View>

        <View className="bg-fg/10 rounded-2xl p-4 border border-fg/20 mb-6">
          <Text className="text-fg/60 text-xs mb-1">Última sincronização</Text>
          <Text className="text-fg font-semibold">
            {lastSyncedAt
              ? new Date(lastSyncedAt).toLocaleString('pt-PT')
              : 'Ainda não sincronizado neste telemóvel'}
          </Text>
          <Text className="text-fg/40 text-xs mt-2">
            Os dados ficam guardados no telemóvel e continuam visíveis sem rede.
          </Text>

          <Pressable
            onPress={handleSyncNow}
            disabled={syncing}
            className={`rounded-2xl px-6 py-3 items-center mt-4 ${
              syncing ? 'bg-fg/10' : 'bg-brand'
            }`}
          >
            {syncing ? (
              <ActivityIndicator color={withAlpha(theme.colors.onBrand, 0.6)} />
            ) : (
              <Text className="text-on-brand font-black">Sincronizar agora</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/(gate)/perfil')}
          className="bg-fg/10 rounded-2xl px-6 py-4 items-center border border-fg/20 mb-2"
        >
          <Text className="text-fg font-black text-center">Trocar perfil</Text>
        </Pressable>

        {isAdmin && (
          <>
            <Pressable
              onPress={() => router.push('/modals/novo-membro')}
              className="bg-fg/10 rounded-2xl px-6 py-4 items-center border border-fg/20 mb-2"
            >
              <Text className="text-fg font-black text-center">Adicionar membro</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/modals/catalogo')}
              className="bg-fg/10 rounded-2xl px-6 py-4 items-center border border-fg/20 mb-2"
            >
              <Text className="text-fg font-black text-center">Bares e produtos</Text>
            </Pressable>
          </>
        )}

        <Pressable
          onPress={handleSignOut}
          disabled={busy}
          className="rounded-2xl px-6 py-4 items-center border border-danger/40 bg-danger/10 mt-4"
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.danger} />
          ) : (
            <Text className="text-danger font-black">Sair do grupo</Text>
          )}
        </Pressable>

        {error && (
          <View className="bg-danger/20 border border-danger/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        )}

        {/* Cada opção pinta-se com as suas próprias cores: escolhe-se pelo
            aspeto, não pelo nome. */}
        <View className="mt-6">
          <Text className="text-fg/60 text-xs font-semibold mb-3">Tema</Text>
          {THEME_NAMES.map((name) => {
            const option = THEMES[name];
            const selected = theme.name === name;
            return (
              <Pressable
                key={name}
                onPress={() => setTheme(name)}
                className={`flex-row items-center rounded-2xl px-4 py-3 mb-2 border ${
                  selected ? 'border-brand' : 'border-fg/20'
                }`}
                style={{ backgroundColor: option.colors.canvas }}
              >
                <View
                  className="w-8 h-8 rounded-full mr-3 items-center justify-center"
                  style={{ backgroundColor: option.colors.brand }}
                >
                  {selected && (
                    <Text style={{ color: option.colors.onBrand }} className="font-black text-xs">
                      ✓
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text style={{ color: option.colors.fg }} className="font-semibold">
                    {option.label}
                  </Text>
                  <Text style={{ color: withAlpha(option.colors.fg, 0.6) }} className="text-xs mt-0.5">
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {isAdmin && (
            <Text className="text-fg/40 text-xs mt-1">
              Como administrador, o tema que escolheres fica também como o tema de
              entrada do grupo.
            </Text>
          )}
        </View>

        <View className="bg-fg/5 border border-fg/10 rounded-2xl p-4 mt-6">
          <Text className="text-fg/60 text-xs font-semibold mb-2">Acerca da app</Text>
          <Text className="text-fg font-bold">Brás Aquele Bar</Text>
          <Text className="text-fg/60 text-xs mt-1">
            Versão {Constants.expoConfig?.version ?? '1.0.0'}
            {buildDate ? ` • compilada a ${buildDate}` : ''}
          </Text>
          <Text className="text-fg/60 text-xs mt-2">
            Desenvolvido e mantido por: Nélio Freitas
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
