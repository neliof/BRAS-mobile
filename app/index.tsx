import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { restoreAccess } from '../src/api/access';
import { fetchGroupProfiles } from '../src/api/profiles';
import { readCurrentProfileId, readGroupCode } from '../src/api/storage';
import { useSession } from '../src/state/SessionContext';
import { useTheme } from '../src/theme/ThemeContext';

export default function Index() {
  const { theme } = useTheme();
  const router = useRouter();
  const { setGrant, setProfile } = useSession();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const grant = await restoreAccess();
      if (cancelled) return;

      if (!grant) {
        router.replace('/(gate)/codigo');
        return;
      }

      setGrant(grant);

      // O perfil escolhido é uma preferência guardada desde a Task 8 e nunca
      // era lida: cada arranque obrigava a escolher outra vez quem se é.
      const savedId = await readCurrentProfileId();
      if (cancelled) return;

      if (savedId) {
        const profiles = await fetchGroupProfiles(grant.groupId);
        if (cancelled) return;

        const saved = profiles.find((profile) => profile.id === savedId);
        // Um perfil desativado ou removido do grupo cai no ecrã de escolha em
        // vez de deixar a app a apontar para alguém que já não existe.
        if (saved) {
          setProfile(saved);
          router.replace('/(mobile)');
          return;
        }
      }

      router.replace('/(gate)/perfil');
    }

    boot().catch(async () => {
      if (cancelled) return;

      // Um código guardado que falha a revalidar por falta de rede não é um
      // código inválido — esse caso `restoreAccess` trata, apagando-o. Mandar o
      // utilizador para o ecrã de entrada seria pedir-lhe que escrevesse um
      // código que também não pode ser validado sem rede.
      const stored = await readGroupCode();
      if (cancelled) return;

      if (stored) {
        setFailed(true);
        return;
      }

      router.replace('/(gate)/codigo');
    });

    return () => {
      cancelled = true;
    };
  }, [attempt, router, setGrant, setProfile]);

  if (failed) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-8">
        <Text className="text-fg font-bold text-center mb-2">Sem ligação ao servidor</Text>
        <Text className="text-fg/60 text-center text-sm mb-6">
          O acesso deste telemóvel continua guardado. Assim que houver rede, entra na mesma.
        </Text>
        <Pressable onPress={retry} className="bg-brand rounded-2xl px-6 py-4">
          <Text className="text-on-brand font-black">Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator color={theme.colors.brand} />
    </View>
  );
}
