import { ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSessionDetails, useSessionMembers } from '../../src/hooks/useSession';
import { useGroupProfiles } from '../../src/hooks/useProfiles';

/**
 * Entradas e saídas de membros durante a noite.
 *
 * O conjunto de membros de uma noite não é fixo: quem chega às 21:00 conta
 * para a rodada seguinte, quem vai embora deixa de contar. As rodadas antigas
 * não mudam — cada uma guarda o seu snapshot.
 *
 * Qualquer membro pode gerir isto: é o registo social da mesa, não uma
 * operação de administração.
 */
export default function MembrosNoiteModal() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params?.sessionId ?? '';
  const { data: session } = useSessionDetails(sessionId);
  const { data: profiles = [], isLoading } = useGroupProfiles(session?.group_id ?? '');
  const { add, remove } = useSessionMembers();

  if (!sessionId) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <Text className="text-red-400 font-semibold">Erro: Sessão inválida</Text>
      </View>
    );
  }

  const activeIds = new Set(session?.member_ids ?? []);
  const pending = add.isPending || remove.isPending;

  const toggle = (memberId: string) => {
    if (pending) return;
    if (activeIds.has(memberId)) {
      remove.mutate({ sessionId, memberId });
    } else {
      add.mutate({ sessionId, memberId });
    }
  };

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="px-4 py-6">
        <Text className="text-white text-2xl font-black mb-1">Membros na noite</Text>
        <Text className="text-white/60 text-sm mb-6">
          {activeIds.size} {activeIds.size === 1 ? 'membro' : 'membros'} agora. Toca para
          marcar entradas e saídas — as rodadas anteriores não mudam.
        </Text>

        {isLoading ? (
          <ActivityIndicator color="#F27D26" />
        ) : (
          profiles.map((profile) => {
            const isIn = activeIds.has(profile.id);
            return (
              <Pressable
                key={profile.id}
                onPress={() => toggle(profile.id)}
                className={`flex-row items-center rounded-2xl px-4 py-3 mb-2 border ${
                  isIn ? 'bg-brand/20 border-brand' : 'bg-white/10 border-white/20'
                }`}
              >
                <View
                  className={`w-5 h-5 rounded-full border-2 mr-3 ${
                    isIn ? 'bg-brand border-brand' : 'border-white/40'
                  }`}
                />
                <View className="flex-1">
                  <Text className={`font-semibold ${isIn ? 'text-brand' : 'text-white'}`}>
                    {profile.name}
                  </Text>
                  <Text className="text-white/50 text-xs mt-0.5">
                    {isIn ? 'Na noite' : 'Fora da noite'}
                  </Text>
                </View>
                <Text className={`text-xs font-semibold ${isIn ? 'text-white/60' : 'text-brand'}`}>
                  {isIn ? 'Sair' : 'Entrar'}
                </Text>
              </Pressable>
            );
          })
        )}

        {(add.isError || remove.isError) && (
          <View className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-red-300 text-sm">
              Não foi possível atualizar os membros. Tenta outra vez.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
