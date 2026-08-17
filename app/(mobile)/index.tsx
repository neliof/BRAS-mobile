import { ScrollView, View, Text, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useSession as useSessionQuery, useAllSessions } from '../../src/hooks/useSession';
import { SessionCard } from '../../src/components/mobile/SessionCard';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, grant } = useSession();
  const groupId = grant?.group_id ?? '';

  const { data: activeSessions = [] } = useSessionQuery(groupId);
  const { data: allSessions = [] } = useAllSessions(groupId);

  const activeCount = activeSessions.length;
  const closedCount = allSessions.filter((s) => s.status === 'closed').length;
  const totalMembers = profile ? 1 : 0;

  const handleSessionPress = (sessionId: string) => {
    router.push({
      pathname: '/(mobile)/noite',
      params: { sessionId },
    });
  };

  const handleStartSession = () => {
    router.push('/(mobile)/noite');
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-black mb-1">
          Olá, {profile?.name ?? 'amigo'}
        </Text>
        <Text className="text-white/60 text-sm">Bem-vindo ao BRÁS</Text>
      </View>

      <View className="px-4 mb-6 gap-2">
        <View className="flex-row gap-2">
          <View className="flex-1 bg-white/10 rounded-2xl p-4 border border-white/20">
            <Text className="text-white/60 text-xs mb-1">Noites ativas</Text>
            <Text className="text-brand text-2xl font-black">{activeCount}</Text>
          </View>
          <View className="flex-1 bg-white/10 rounded-2xl p-4 border border-white/20">
            <Text className="text-white/60 text-xs mb-1">Histórico</Text>
            <Text className="text-brand text-2xl font-black">{closedCount}</Text>
          </View>
          <View className="flex-1 bg-white/10 rounded-2xl p-4 border border-white/20">
            <Text className="text-white/60 text-xs mb-1">Membros</Text>
            <Text className="text-brand text-2xl font-black">{totalMembers}</Text>
          </View>
        </View>
      </View>

      {activeSessions.length > 0 && (
        <View className="px-4 mb-6">
          <Text className="text-white/60 text-sm mb-3 font-semibold">Noites ativas</Text>
          <FlatList
            data={activeSessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SessionCard
                session={item}
                onPress={() => handleSessionPress(item.id)}
              />
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      <View className="px-4 pb-8">
        <Pressable
          onPress={handleStartSession}
          className="bg-brand rounded-2xl px-6 py-4 items-center"
        >
          <Text className="text-black font-black text-center">Iniciar noite</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
