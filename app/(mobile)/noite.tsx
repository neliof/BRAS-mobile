import { ScrollView, View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession as useSessionContext } from '../../src/state/SessionContext';
import {
  useSessionDetails,
  useRealtimeSessions,
  useDeleteSession,
} from '../../src/hooks/useSession';
import { useRounds, useRealtimeRounds } from '../../src/hooks/useRounds';
import { usePayments, useRealtimePayments } from '../../src/hooks/usePayments';
import { useGroupProfiles } from '../../src/hooks/useProfiles';
import { usePhotosBySession, useRealtimePhotos } from '../../src/hooks/usePhotos';
import { usePhotoUrls } from '../../src/hooks/usePhotoUrls';
import { RoundItem } from '../../src/components/mobile/RoundItem';
import { MemberDebt } from '../../src/components/mobile/MemberDebt';
import { PhotoGallery } from '../../src/components/mobile/PhotoGallery';
import { computeSessionTotals } from '../../src/domain/debt';
import { nextResponsible, roundsPerMember, totalDrinks } from '../../src/domain/rounds';

export default function NiteScreen() {
  const router = useRouter();
  const { isAdmin } = useSessionContext();
  const deleteSessionMutation = useDeleteSession();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const safeSessionId = sessionId ?? '';

  const { data: session, isLoading: sessionLoading } = useSessionDetails(safeSessionId);
  const { data: rounds = [] } = useRounds(safeSessionId);
  const { data: payments = [] } = usePayments(safeSessionId);
  const { data: profiles = [] } = useGroupProfiles(session?.group_id ?? '');
  const { data: photos = [] } = usePhotosBySession(safeSessionId);
  const { data: photoUrls } = usePhotoUrls(photos);

  // Todos os hooks antes do primeiro return: a noite chega vazia no primeiro
  // render e a ordem dos hooks não pode mudar quando chegar. Uma noite é vivida
  // por várias pessoas ao mesmo tempo — sem estas subscrições, o telemóvel que
  // não pediu a rodada nunca a via aparecer.
  useRealtimeRounds(safeSessionId);
  useRealtimePayments(safeSessionId);
  useRealtimePhotos(safeSessionId);
  useRealtimeSessions(session?.group_id ?? '');

  if (!session) {
    return (
      <View className="flex-1 bg-ink items-center justify-center">
        <Text className="text-white text-center px-4">
          {sessionLoading ? 'A carregar...' : 'Nenhuma noite ativa'}
        </Text>
      </View>
    );
  }

  const sessionWithPayments = {
    ...session,
    payments: payments || [],
  };
  const totalsWithPayments = computeSessionTotals(sessionWithPayments);

  const nameOf = (memberId: string) =>
    profiles.find((p) => p.id === memberId)?.name ?? 'Membro';

  const activeRoundsSorted = rounds
    .filter((r) => r.status !== 'cancelled')
    .sort((a, b) => b.round_number - a.round_number);
  const lastRound = activeRoundsSorted[0];
  const nextId = nextResponsible(rounds, session.member_ids ?? []);
  const perMemberCounts = roundsPerMember(rounds, session.member_ids ?? []);

  const handleCloseSession = () => {
    router.push({
      pathname: '/modals/fechar-noite',
      params: { sessionId: safeSessionId },
    });
  };

  const handleDeleteSession = () => {
    const roundCount = rounds.filter((r) => r.status !== 'cancelled').length;
    const aviso =
      roundCount > 0
        ? `"${session.name}" tem ${roundCount} ${roundCount === 1 ? 'rodada' : 'rodadas'} — apagar leva as rodadas e as contas de vez. Não dá para desfazer.`
        : `"${session.name}" é apagada de vez. Não dá para desfazer.`;

    Alert.alert('Apagar noite', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSessionMutation.mutateAsync({
              sessionId: safeSessionId,
              force: roundCount > 0,
            });
            router.replace('/(mobile)');
          } catch (cause) {
            Alert.alert(
              'Não foi possível apagar',
              cause instanceof Error ? cause.message : 'Tenta outra vez.',
            );
          }
        },
      },
    ]);
  };

  const handleAddRound = () => {
    router.push({
      pathname: '/modals/nova-rodada',
      params: { sessionId: safeSessionId },
    });
  };

  const handleManageMembers = () => {
    router.push({
      pathname: '/modals/membros-noite',
      params: { sessionId: safeSessionId },
    });
  };

  const handleShowQrCode = () => {
    router.push({
      pathname: '/modals/qr-code',
      params: { sessionId: safeSessionId },
    });
  };

  const handleAddPhoto = () => {
    router.push({
      pathname: '/modals/carregar-foto',
      params: { sessionId: safeSessionId },
    });
  };

  const handleOpenPhoto = (photoId: string) => {
    router.push({
      pathname: '/modals/foto',
      params: { photoId },
    });
  };

  const handlePayDebt = (memberId: string) => {
    router.push({
      pathname: '/modals/pagar-divida',
      params: { sessionId: safeSessionId, memberId },
    });
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-white text-3xl font-black mb-1">{session.name}</Text>
          <Text className="text-white/60 text-sm">{session.code}</Text>
        </View>
        <Pressable
          onPress={handleShowQrCode}
          className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20"
        >
          <Text className="text-white font-semibold text-xs">Partilhar</Text>
        </Pressable>
      </View>

      {/* O ecrã responde primeiro às perguntas da mesa: quem pediu a última,
          quem deve pedir a seguir, quantos somos agora. As contas vêm depois —
          cada um paga as suas rodadas, não há divisão. */}
      <View className="px-4 mb-6">
        <View className="bg-white/10 rounded-2xl p-4 border border-white/20 mb-2">
          {lastRound ? (
            <>
              <Text className="text-white/60 text-xs mb-1">Última rodada</Text>
              <Text className="text-white text-xl font-black">
                {nameOf(lastRound.requested_by)}
              </Text>
              <Text className="text-white/60 text-xs mt-1">
                {lastRound.member_count ?? '?'} membros • {totalDrinks(lastRound)}{' '}
                bebidas •{' '}
                {new Date(lastRound.created_at).toLocaleTimeString('pt-PT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </>
          ) : (
            <Text className="text-white/60 text-sm">Ainda não há rodadas esta noite.</Text>
          )}
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 bg-white/10 rounded-2xl p-4 border border-white/20">
            <Text className="text-white/60 text-xs mb-1">Próximo (sugestão)</Text>
            <Text className="text-brand text-lg font-black">
              {nextId ? nameOf(nextId) : '—'}
            </Text>
          </View>
          <Pressable
            onPress={handleManageMembers}
            className="flex-1 bg-white/10 rounded-2xl p-4 border border-white/20"
          >
            <Text className="text-white/60 text-xs mb-1">Membros agora</Text>
            <Text className="text-brand text-lg font-black">
              {session.member_ids.length}
            </Text>
            <Text className="text-white/50 text-[10px] mt-1">Gerir entradas e saídas</Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4 mb-6">
        <Text className="text-white/60 text-sm mb-3 font-semibold">Rodadas por membro</Text>
        <View className="flex-row flex-wrap gap-2">
          {[...perMemberCounts.entries()].map(([memberId, count]) => (
            <View
              key={memberId}
              className={`rounded-full px-3 py-1.5 border ${
                count > 0 ? 'bg-brand/15 border-brand/50' : 'bg-white/10 border-white/20'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${count > 0 ? 'text-brand' : 'text-white/60'}`}
              >
                {nameOf(memberId)} {count > 0 ? `✓ ${count}` : '⏳'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {rounds && rounds.length > 0 && (
        <View className="px-4 mb-6">
          <Text className="text-white/60 text-sm mb-3 font-semibold">Rodadas</Text>
          <FlatList
            data={rounds}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RoundItem round={item} responsibleName={nameOf(item.requested_by)} />
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      <View className="px-4 mb-6">
        <Text className="text-white/60 text-sm mb-1 font-semibold">Contas</Text>
        <Text className="text-white/40 text-xs mb-3">
          Cada um paga as rodadas que pediu — não há divisão da conta.
        </Text>
        <FlatList
          data={totalsWithPayments.perMember}
          keyExtractor={(item) => item.memberId}
          renderItem={({ item }) => (
            <MemberDebt
              debt={item}
              profile={profiles.find((p) => p.id === item.memberId)}
              onPress={() => handlePayDebt(item.memberId)}
            />
          )}
          scrollEnabled={false}
        />
      </View>

      <View className="px-4 mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white/60 text-sm font-semibold">Fotos da noite</Text>
          {session.status === 'active' && (
            <Pressable
              onPress={handleAddPhoto}
              className="bg-white/10 rounded-2xl px-4 py-2 border border-white/20"
            >
              <Text className="text-white font-semibold text-xs">Adicionar</Text>
            </Pressable>
          )}
        </View>

        {photos.length === 0 ? (
          <Text className="text-white/40 text-sm">Ainda não há fotos desta noite.</Text>
        ) : (
          <PhotoGallery
            photos={photos}
            urls={photoUrls}
            numColumns={3}
            onPhotoPress={(photo) => handleOpenPhoto(photo.id)}
          />
        )}
      </View>

      {/* Uma noite fechada é histórico: nem se lhe juntam rodadas nem se fecha
          outra vez. */}
      {session.status === 'active' && (
        <View className="px-4 pb-8 gap-2">
          <Pressable
            onPress={handleAddRound}
            className="bg-brand rounded-2xl px-6 py-4 items-center"
          >
            <Text className="text-black font-black text-center">Nova rodada</Text>
          </Pressable>

          <Pressable
            onPress={handleCloseSession}
            className="bg-white/10 rounded-2xl px-6 py-4 items-center border border-white/20"
          >
            <Text className="text-white font-black text-center">Fechar noite</Text>
          </Pressable>

          {/* Fase de testes: o admin pode apagar mesmo com rodadas — o aviso
              diz quantas vão atrás. Fora de testes, fechar é o caminho normal. */}
          {isAdmin && (
            <Pressable
              onPress={handleDeleteSession}
              disabled={deleteSessionMutation.isPending}
              className="rounded-2xl px-6 py-4 items-center border border-red-500/40 bg-red-500/10"
            >
              <Text className="text-red-300 font-black text-center">Apagar noite</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}
