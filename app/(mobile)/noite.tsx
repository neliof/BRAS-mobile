import { ScrollView, View, Text, FlatList, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSessionDetails } from '../../src/hooks/useSession';
import { useRounds } from '../../src/hooks/useRounds';
import { usePayments } from '../../src/hooks/usePayments';
import { RoundItem } from '../../src/components/mobile/RoundItem';
import { MemberDebt } from '../../src/components/mobile/MemberDebt';
import { computeSessionTotals } from '../../src/domain/debt';

export default function NiteScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const safeSessionId = sessionId ?? '';

  const { data: session, isLoading: sessionLoading } = useSessionDetails(safeSessionId);
  const { data: rounds = [] } = useRounds(safeSessionId);
  const { data: payments = [] } = usePayments(safeSessionId);

  if (!session) {
    return (
      <View className="flex-1 bg-ink items-center justify-center">
        <Text className="text-white text-center px-4">
          {sessionLoading ? 'A carregar...' : 'Nenhuma noite ativa'}
        </Text>
      </View>
    );
  }

  const totals = computeSessionTotals(session);
  const sessionWithPayments = {
    ...session,
    payments: payments || [],
  };
  const totalsWithPayments = computeSessionTotals(sessionWithPayments);

  const handleCloseSession = () => {
    router.push({
      pathname: '/modals/fechar-noite',
      params: { sessionId: safeSessionId },
    });
  };

  const handleAddRound = () => {
    router.push({
      pathname: '/modals/nova-ronda',
      params: { sessionId: safeSessionId },
    });
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-black mb-1">{session.name}</Text>
        <Text className="text-white/60 text-sm">{session.code}</Text>
      </View>

      <View className="px-4 mb-6">
        <View className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-white/60 text-xs mb-1">Total gasto</Text>
              <Text className="text-brand text-2xl font-black">
                {(totalsWithPayments.totalCents / 100).toFixed(2)}€
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-white/60 text-xs mb-1">Bebidas</Text>
              <Text className="text-brand text-2xl font-black">
                {totalsWithPayments.totalDrinks}
              </Text>
            </View>
          </View>
          <Text className="text-white/60 text-xs">
            {session.member_ids.length} membros na noite
          </Text>
        </View>
      </View>

      {rounds && rounds.length > 0 && (
        <View className="px-4 mb-6">
          <Text className="text-white/60 text-sm mb-3 font-semibold">Rondas</Text>
          <FlatList
            data={rounds}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <RoundItem round={item} />}
            scrollEnabled={false}
          />
        </View>
      )}

      <View className="px-4 mb-6">
        <Text className="text-white/60 text-sm mb-3 font-semibold">Dívidas</Text>
        <FlatList
          data={totalsWithPayments.perMember}
          keyExtractor={(item) => item.memberId}
          renderItem={({ item }) => <MemberDebt debt={item} />}
          scrollEnabled={false}
        />
      </View>

      <View className="px-4 pb-8 gap-2">
        <Pressable
          onPress={handleAddRound}
          className="bg-brand rounded-2xl px-6 py-4 items-center"
        >
          <Text className="text-black font-black text-center">Nova ronda</Text>
        </Pressable>

        <Pressable
          onPress={handleCloseSession}
          className="bg-white/10 rounded-2xl px-6 py-4 items-center border border-white/20"
        >
          <Text className="text-white font-black text-center">Fechar noite</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
