import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { restoreAccess } from '../../src/api/access';
import { useGroupProfiles } from '../../src/hooks/useProfiles';
import { useSession } from '../../src/state/SessionContext';
import type { Profile } from '../../src/types';

export default function PerfilScreen() {
  const router = useRouter();
  const { grant, isAdmin, setGrant, setProfile } = useSession();

  useEffect(() => {
    let cancelled = false;

    async function ensureGrant() {
      if (grant) return;

      // O vínculo pode ainda não estar em memória se a app arrancou
      // diretamente neste ecrã.
      const current = await restoreAccess();
      if (cancelled) return;

      if (!current) {
        router.replace('/(gate)/codigo');
        return;
      }

      setGrant(current);
    }

    void ensureGrant();
    return () => {
      cancelled = true;
    };
  }, [grant, router, setGrant]);

  // A lista passa pelo React Query para que um membro criado no modal apareça
  // aqui ao voltar, em vez de ficar preso num `useState` carregado uma vez.
  const { data: profiles, isLoading, isError } = useGroupProfiles(grant?.groupId ?? '');

  function choose(profile: Profile) {
    setProfile(profile);
    router.replace('/(mobile)');
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-ink px-8">
        <Text className="text-red-400 text-center">
          Não foi possível carregar os membros.
        </Text>
      </View>
    );
  }

  if (!grant || isLoading || !profiles) {
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
        // Um grupo acabado de criar não tem perfis nenhuns. Sem esta saída, o
        // primeiro arranque ficava numa lista vazia sem nada para tocar.
        ListEmptyComponent={
          <View className="items-center">
            <Text className="text-white/60 text-center mb-4">
              Este grupo ainda não tem membros.
            </Text>
            {isAdmin ? (
              <Pressable
                onPress={() => router.push('/modals/novo-membro')}
                className="bg-brand rounded-2xl px-6 py-4"
              >
                <Text className="text-black font-black">Criar o primeiro membro</Text>
              </Pressable>
            ) : (
              <Text className="text-white/40 text-center text-xs">
                Pede a um administrador do grupo para te criar um perfil.
              </Text>
            )}
          </View>
        }
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
