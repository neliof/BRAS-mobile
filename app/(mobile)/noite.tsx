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
  // não pediu a ronda nunca a via aparecer.
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

  const handleCloseSession = () => {
    router.push({
      pathname: '/modals/fechar-noite',
      params: { sessionId: safeSessionId },
    });
  };

  const handleDeleteSession = () => {
    Alert.alert(
      'Apagar noite',
      `"${session.name}" ainda não tem rondas e é apagada de vez. Não dá para desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSessionMutation.mutateAsync(safeSessionId);
              router.replace('/(mobile)');
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

  const handleAddRound = () => {
    router.push({
      pathname: '/modals/nova-ronda',
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

      {/* Uma noite fechada é histórico: nem se lhe juntam rondas nem se fecha
          outra vez. */}
      {session.status === 'active' && (
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

          {/* Uma noite aberta por engano sai daqui. Com rondas já não: o
              cascade levaria consumo e pagamentos atrás — fecha-se. */}
          {isAdmin && rounds.length === 0 && (
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
