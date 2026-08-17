import { ScrollView, View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useAllSessions } from '../../src/hooks/useSession';
import { computeSessionTotals } from '../../src/domain/debt';
import type { Session } from '../../src/types';

export default function HistoricoScreen() {
  const router = useRouter();
  const { grant } = useSession();
  const groupId = grant?.group_id ?? '';

  const { data: allSessions = [] } = useAllSessions(groupId);

  const closedSessions = allSessions.filter((s) => s.status === 'closed');

  const handleSessionPress = (sessionId: string) => {
    router.push({
      pathname: '/(mobile)/historico/detalhes',
      params: { sessionId },
    });
  };

  const renderSessionCard = (session: Session) => {
    const totals = computeSessionTotals(session);
    const totalAmount = totals.totalCents / 100;
    const totalDrinks = totals.totalDrinks;

    const date = new Date(session.date || session.started_at);
    const dateStr = date.toLocaleDateString('pt-PT');
    const timeStr = date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Pressable
        key={session.id}
        onPress={() => handleSessionPress(session.id)}
        className="bg-white/10 rounded-2xl p-4 mb-3 border border-white/20"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-white font-bold text-base">{session.name}</Text>
            <Text className="text-white/60 text-xs mt-1">
              {dateStr} às {timeStr}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-brand font-bold text-lg">{totalAmount.toFixed(2)}€</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-2 border-t border-white/10">
          <Text className="text-white/60 text-xs">
            {session.member_ids.length} membros
          </Text>
          <Text className="text-white/60 text-xs">{totalDrinks} bebidas</Text>
          {session.rating && (
            <Text className="text-brand text-xs font-bold">★ {session.rating}</Text>
          )}
        </View>

        {session.quote_of_the_night && (
          <View className="mt-3 bg-white/5 rounded-lg p-2 border-l-2 border-brand">
            <Text className="text-white/60 text-xs italic">
              "{session.quote_of_the_night}"
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-black mb-1">Histórico</Text>
        <Text className="text-white/60 text-sm">
          {closedSessions.length} noites encerradas
        </Text>
      </View>

      <View className="px-4 pb-8">
        {closedSessions.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-white/60 text-center">
              Nenhuma noite no histórico ainda
            </Text>
          </View>
        ) : (
          <FlatList
            data={closedSessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderSessionCard(item)}
            scrollEnabled={false}
          />
        )}
      </View>
    </ScrollView>
  );
}
