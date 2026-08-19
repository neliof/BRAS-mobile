import { ScrollView, View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useAllSessions, useDeleteSession } from '../../src/hooks/useSession';
import { computeSessionTotals } from '../../src/domain/debt';
import type { Session } from '../../src/types';

export default function HistoricoScreen() {
  const router = useRouter();
  const { grant, isAdmin } = useSession();
  const groupId = grant?.groupId ?? '';

  const { data: allSessions = [] } = useAllSessions(groupId);
  const deleteSessionMutation = useDeleteSession();

  const closedSessions = allSessions.filter((s) => s.status === 'closed');

  // Fase de testes: o admin limpa noites encerradas daqui. Apagar leva as
  // rodadas e as contas dessa noite de vez.
  const handleDelete = (session: Session) => {
    const roundCount = (session.rounds ?? []).filter((r) => r.status !== 'cancelled').length;
    Alert.alert(
      'Apagar noite',
      `"${session.name}" e as suas ${roundCount} ${roundCount === 1 ? 'rodada' : 'rodadas'} são apagadas de vez. Não dá para desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSessionMutation.mutateAsync({ sessionId: session.id, force: true });
            } catch (cause) {
              Alert.alert(
                'Não foi possível apagar',
                cause instanceof Error ? cause.message : 'Tenta outra vez.',
              );
            }
          },
        },
      ],
    );
  };

  const handleSessionPress = (sessionId: string) => {
    // Não existe ecrã `historico/detalhes`; o ecrã da Noite já mostra rodadas e
    // dívidas, e esconde as ações quando a noite está fechada.
    router.push({
      pathname: '/(mobile)/noite',
      params: { sessionId },
    });
  };

  const renderSessionCard = (session: Session) => {
    const totals = computeSessionTotals(session);
    const totalAmount = totals.totalCents / 100;
    const totalDrinks = totals.totalDrinks;

    // `date` é uma DATE: `new Date('2026-08-15')` é meia-noite UTC e a hora
    // mostrada seria sempre 00:00 ou 01:00. A hora a sério está em `started_at`.
    const date = new Date(session.started_at || session.date);
    const dateStr = date.toLocaleDateString('pt-PT');
    const timeStr = date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Pressable
        key={session.id}
        onPress={() => handleSessionPress(session.id)}
        className="bg-fg/10 rounded-2xl p-4 mb-3 border border-fg/20"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-fg font-bold text-base">{session.name}</Text>
            <Text className="text-fg/60 text-xs mt-1">
              {dateStr} às {timeStr}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-brand font-bold text-lg">{totalAmount.toFixed(2)}€</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-2 border-t border-fg/10">
          <Text className="text-fg/60 text-xs">
            {session.member_ids.length} membros
          </Text>
          <Text className="text-fg/60 text-xs">{totalDrinks} bebidas</Text>
          {session.rating && (
            <Text className="text-brand text-xs font-bold">★ {session.rating}</Text>
          )}
        </View>

        {session.quote_of_the_night && (
          <View className="mt-3 bg-fg/5 rounded-lg p-2 border-l-2 border-brand">
            <Text className="text-fg/60 text-xs italic">
              "{session.quote_of_the_night}"
            </Text>
          </View>
        )}

        {isAdmin && (
          <Pressable
            onPress={() => handleDelete(session)}
            disabled={deleteSessionMutation.isPending}
            className="mt-3 self-start rounded-lg px-3 py-1 bg-danger/20"
          >
            <Text className="text-danger text-xs font-semibold">Apagar</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView className="flex-1 bg-canvas">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-fg text-3xl font-black mb-1">Histórico</Text>
        <Text className="text-fg/60 text-sm">
          {closedSessions.length} noites encerradas
        </Text>
      </View>

      <View className="px-4 pb-8">
        {closedSessions.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-fg/60 text-center">
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
