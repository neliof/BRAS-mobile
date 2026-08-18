import { ScrollView, View, Text, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Beer, Users, Calendar, Camera, Trophy, Settings } from 'lucide-react-native';
import { useSession } from '../../src/state/SessionContext';
import {
  useSession as useSessionQuery,
  useAllSessions,
  useRealtimeSessions,
} from '../../src/hooks/useSession';
import { useGroupProfiles } from '../../src/hooks/useProfiles';
import { SessionCard } from '../../src/components/mobile/SessionCard';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, grant } = useSession();
  const groupId = grant?.groupId ?? '';

  const { data: activeSessions = [] } = useSessionQuery(groupId);
  const { data: allSessions = [] } = useAllSessions(groupId);
  const { data: profiles = [] } = useGroupProfiles(groupId);

  // Uma noite aberta noutro telemóvel tem de aparecer aqui sem puxar para
  // refrescar: é assim que o resto do grupo entra na noite.
  useRealtimeSessions(groupId);

  const activeCount = activeSessions.length;
  const closedCount = allSessions.filter((s) => s.status === 'closed').length;
  const totalMembers = profiles.length;

  const handleSessionPress = (sessionId: string) => {
    router.push({
      pathname: '/(mobile)/noite',
      params: { sessionId },
    });
  };

  const handleStartSession = () => {
    router.push('/modals/iniciar-noite');
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-white text-3xl font-black mb-1">
            Olá, {profile?.name ?? 'amigo'}
          </Text>
          <Text className="text-white/60 text-sm">Bem-vindo ao BRÁS</Text>
        </View>
        {/* O perfil passou a ser restaurado no arranque; sem isto não havia
            forma de voltar ao ecrã de escolha nem de sair do grupo. */}
        <Pressable
          onPress={() => router.push('/modals/definicoes')}
          className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20"
        >
          <Text className="text-white font-semibold text-xs">Definições</Text>
        </Pressable>
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

      <View className="px-4 mb-6">
        <Pressable
          onPress={handleStartSession}
          className="bg-brand rounded-2xl px-6 py-4 items-center"
        >
          <Text className="text-black font-black text-center">Iniciar noite</Text>
        </Pressable>
      </View>

      {/* Atalhos em quadrados grandes: mais fáceis de acertar num bar do que
          a barra de abas. A barra continua em baixo, em todos os ecrãs. */}
      <View className="px-4 pb-8">
        <Text className="text-white/60 text-sm mb-3 font-semibold">Atalhos</Text>
        <View className="flex-row flex-wrap justify-between">
          {[
            {
              label: 'Noite',
              Icon: Beer,
              onPress: () =>
                activeSessions[0]
                  ? handleSessionPress(activeSessions[0].id)
                  : router.push('/(mobile)/noite'),
            },
            { label: 'Amigos', Icon: Users, onPress: () => router.push('/(mobile)/amigos') },
            { label: 'Histórico', Icon: Calendar, onPress: () => router.push('/(mobile)/historico') },
            { label: 'Memórias', Icon: Camera, onPress: () => router.push('/(mobile)/memorias') },
            { label: 'Troféus', Icon: Trophy, onPress: () => router.push('/(mobile)/conquistas') },
            { label: 'Definições', Icon: Settings, onPress: () => router.push('/modals/definicoes') },
          ].map(({ label, Icon, onPress }) => (
            <Pressable
              key={label}
              onPress={onPress}
              className="w-[31%] aspect-square bg-white/10 border border-white/20 rounded-2xl items-center justify-center mb-3"
            >
              <Icon size={30} color="#F27D26" />
              <Text className="text-white font-semibold text-xs mt-2">{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
