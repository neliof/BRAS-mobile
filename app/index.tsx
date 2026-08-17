import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { restoreAccess } from '../src/api/access';
import { fetchGroupProfiles } from '../src/api/profiles';
import { readCurrentProfileId } from '../src/api/storage';
import { useSession } from '../src/state/SessionContext';

export default function Index() {
  const router = useRouter();
  const { setGrant, setProfile } = useSession();

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

    boot().catch(() => {
      if (!cancelled) router.replace('/(gate)/codigo');
    });

    return () => {
      cancelled = true;
    };
  }, [router, setGrant, setProfile]);

  return (
    <View className="flex-1 items-center justify-center bg-ink">
      <ActivityIndicator color="#F27D26" />
    </View>
  );
}
