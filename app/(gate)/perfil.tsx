import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchGroupProfiles } from '../../src/api/profiles';
import { restoreAccess } from '../../src/api/access';
import { useSession } from '../../src/state/SessionContext';
import type { Profile } from '../../src/types';

export default function PerfilScreen() {
  const router = useRouter();
  const { grant, setGrant, setProfile } = useSession();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // O vínculo pode ainda não estar em memória se a app arrancou
        // diretamente neste ecrã.
        const current = grant ?? (await restoreAccess());
        if (!current) {
          if (!cancelled) router.replace('/(gate)/codigo');
          return;
        }
        if (!grant) setGrant(current);

        const list = await fetchGroupProfiles(current.groupId);
        if (!cancelled) setProfiles(list);
      } catch (err) {
        if (!cancelled) {
          setError('Não foi possível carregar os membros.');
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [grant, router, setGrant]);

  function choose(profile: Profile) {
    setProfile(profile);
    router.replace('/(mobile)');
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-ink px-8">
        <Text className="text-red-400 text-center">{error}</Text>
      </View>
    );
  }

  if (!profiles) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <ActivityIndicator color="#F27D26" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink px-6 pt-16">
      <Text className="text-white text-2xl font-black mb-1">Quem és tu?</Text>
      <Text className="text-white/50 mb-6">
        Escolhe o teu perfil para continuar.
      </Text>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => choose(item)}
            className="bg-white/10 rounded-2xl px-4 py-4"
          >
            <Text className="text-white font-bold">{item.name}</Text>
            {item.nickname && (
              <Text className="text-white/50 text-xs">{item.nickname}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}
