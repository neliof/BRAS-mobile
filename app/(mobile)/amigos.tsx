import { ScrollView, View, Text, FlatList, TextInput, Pressable, Alert } from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useAllSessions } from '../../src/hooks/useSession';
import { useGroupProfiles, useDeactivateProfile } from '../../src/hooks/useProfiles';
import { computeMemberDebt } from '../../src/domain/debt';

export default function AmigosScreen() {
  const router = useRouter();
  const { grant, isAdmin } = useSession();
  const groupId = grant?.groupId ?? '';

  const { data: allSessions = [] } = useAllSessions(groupId);
  const { data: profiles = [] } = useGroupProfiles(groupId);
  const deactivate = useDeactivateProfile();
  const [searchText, setSearchText] = useState('');

  const memberStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        memberId: string;
        memberName: string;
        sessionsCount: number;
        totalSpent: number;
        pendingDebt: number;
      }
    >();

    const nameOf = new Map(profiles.map((p) => [p.id, p.name]));

    // A lista parte dos perfis do grupo, não das noites: um membro criado hoje
    // ainda não foi a nenhuma e desaparecia do ecrã que serve para o gerir.
    for (const profile of profiles) {
      stats.set(profile.id, {
        memberId: profile.id,
        memberName: profile.name,
        sessionsCount: 0,
        totalSpent: 0,
        pendingDebt: 0,
      });
    }

    for (const session of allSessions) {
      // Noites canceladas não contam; as fechadas contam, senão o total gasto
      // esvaziava-se sempre que uma noite acabava.
      if (session.status === 'cancelled') continue;

      for (const memberId of session.member_ids) {
        const debt = computeMemberDebt(session, memberId);
        const existing = stats.get(memberId) || {
          memberId,
          memberName: nameOf.get(memberId) ?? 'Membro',
          sessionsCount: 0,
          totalSpent: 0,
          pendingDebt: 0,
        };

        existing.sessionsCount += 1;
        existing.totalSpent += debt.totalCents;

        if (!debt.isPaid) {
          existing.pendingDebt += debt.totalCents;
        }

        stats.set(memberId, existing);
      }
    }

    return [...stats.values()];
  }, [allSessions, profiles]);

  const filteredMembers = useMemo(() => {
    if (!searchText.trim()) return memberStats;

    const lowercaseSearch = searchText.toLowerCase();
    return memberStats.filter((m) =>
      m.memberName.toLowerCase().includes(lowercaseSearch),
    );
  }, [memberStats, searchText]);

  const handleDeactivate = (memberId: string, memberName: string) => {
    Alert.alert(
      'Desativar membro',
      `${memberName} deixa de aparecer nas noites novas. O histórico fica intacto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => {
            deactivate.mutate({ profileId: memberId, groupId });
          },
        },
      ],
    );
  };

  const renderMemberItem = (member: typeof memberStats[0]) => {
    const totalSpent = member.totalSpent / 100;
    const pendingDebt = member.pendingDebt / 100;

    return (
      <View key={member.memberId} className="bg-white/10 rounded-2xl p-4 mb-3 border border-white/20">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-white font-bold">{member.memberName}</Text>
            <Text className="text-white/60 text-xs mt-1">
              {member.sessionsCount} noites
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-white/60 text-xs mb-1">Gasto</Text>
            <Text className="text-brand font-bold text-sm">{totalSpent.toFixed(2)}€</Text>
          </View>
        </View>

        {pendingDebt > 0 && (
          <View className="border-t border-white/10 pt-2 mt-2">
            <View className="flex-row justify-between">
              <Text className="text-white/60 text-xs">Dívida pendente</Text>
              <Text className="text-brand text-xs font-bold">{pendingDebt.toFixed(2)}€</Text>
            </View>
          </View>
        )}

        {isAdmin && (
          <Pressable
            onPress={() => handleDeactivate(member.memberId, member.memberName)}
            disabled={deactivate.isPending}
            className="mt-3 self-start rounded-lg px-3 py-1 bg-red-500/20"
          >
            <Text className="text-red-300 text-xs font-semibold">Desativar</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-black mb-4">Amigos</Text>

        <TextInput
          placeholder="Procurar membro..."
          placeholderTextColor="#ffffff40"
          value={searchText}
          onChangeText={setSearchText}
          className="bg-white/10 text-white rounded-2xl px-4 py-3 border border-white/20 mb-4"
        />

        {isAdmin && (
          <Pressable
            onPress={() => router.push('/modals/novo-membro')}
            className="bg-brand rounded-2xl px-6 py-4 items-center"
          >
            <Text className="text-black font-black text-center">Adicionar membro</Text>
          </Pressable>
        )}
      </View>

      <View className="px-4 pb-8">
        {filteredMembers.length === 0 ? (
          <View className="items-center justify-center py-8">
            <Text className="text-white/60 text-center">
              {searchText ? 'Nenhum membro encontrado' : 'Nenhum membro no grupo'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.memberId}
            renderItem={({ item }) => renderMemberItem(item)}
            scrollEnabled={false}
          />
        )}
      </View>
    </ScrollView>
  );
}
