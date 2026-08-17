import { ScrollView, View, Text, FlatList } from 'react-native';
import { useMemo } from 'react';
import { useSession } from '../../src/state/SessionContext';
import { useAllSessions } from '../../src/hooks/useSession';
import { AchievementBadge } from '../../src/components/mobile/AchievementBadge';
import type { Achievement, MemberAchievement } from '../../src/types';

export default function ConquistasScreen() {
  const { profile, grant } = useSession();
  const groupId = grant?.group_id ?? '';

  const { data: allSessions = [] } = useAllSessions(groupId);

  const achievements: Achievement[] = [
    {
      id: '1',
      name: 'Primeiro passo',
      description: 'Participa na primeira noite',
      icon: '🍻',
      criteria: 'presence',
      category: 'presence',
    },
    {
      id: '2',
      name: 'Mestre cervejeiro',
      description: 'Bebe 100 bebidas',
      icon: '🍺',
      criteria: 'beer_master',
      category: 'beer_master',
    },
    {
      id: '3',
      name: 'Figura social',
      description: 'Participa em 10 noites',
      icon: '👥',
      criteria: 'social',
      category: 'social',
    },
    {
      id: '4',
      name: 'Lenda viva',
      description: 'Paga a ronda para 5 pessoas',
      icon: '👑',
      criteria: 'legend',
      category: 'legend',
    },
  ];

  const memberAchievements = useMemo(() => {
    if (!profile) return [];

    const earned: MemberAchievement[] = [];
    let totalDrinks = 0;
    let sessionCount = 0;

    for (const session of allSessions) {
      if (session.member_ids.includes(profile.id)) {
        sessionCount += 1;

        for (const round of session.rounds || []) {
          if (round.status === 'cancelled') continue;
          for (const item of round.items || []) {
            for (const consumption of item.consumptions || []) {
              if (consumption.member_id === profile.id) {
                totalDrinks += consumption.quantity;
              }
            }
          }
        }
      }
    }

    if (sessionCount >= 1) {
      earned.push({
        id: '1-' + profile.id,
        member_id: profile.id,
        achievement_id: '1',
        earned_at: new Date().toISOString(),
      });
    }

    if (totalDrinks >= 100) {
      earned.push({
        id: '2-' + profile.id,
        member_id: profile.id,
        achievement_id: '2',
        earned_at: new Date().toISOString(),
      });
    }

    if (sessionCount >= 10) {
      earned.push({
        id: '3-' + profile.id,
        member_id: profile.id,
        achievement_id: '3',
        earned_at: new Date().toISOString(),
      });
    }

    return earned;
  }, [profile, allSessions]);

  const getProgress = (achievementId: string): number => {
    if (!profile) return 0;

    const sessionCount = allSessions.filter((s) =>
      s.member_ids.includes(profile.id),
    ).length;

    let totalDrinks = 0;
    for (const session of allSessions) {
      if (session.member_ids.includes(profile.id)) {
        for (const round of session.rounds || []) {
          if (round.status === 'cancelled') continue;
          for (const item of round.items || []) {
            for (const consumption of item.consumptions || []) {
              if (consumption.member_id === profile.id) {
                totalDrinks += consumption.quantity;
              }
            }
          }
        }
      }
    }

    switch (achievementId) {
      case '1':
        return sessionCount > 0 ? 100 : 50;
      case '2':
        return Math.min((totalDrinks / 100) * 100, 100);
      case '3':
        return Math.min((sessionCount / 10) * 100, 100);
      case '4':
        return 0;
      default:
        return 0;
    }
  };

  const renderAchievement = (achievement: Achievement) => {
    const earned = memberAchievements.find((a) => a.achievement_id === achievement.id);
    const progress = getProgress(achievement.id);

    return (
      <AchievementBadge
        key={achievement.id}
        achievement={achievement}
        memberAchievement={earned}
        progress={Math.round(progress)}
        isLocked={!earned && progress === 0}
      />
    );
  };

  const earnedCount = memberAchievements.length;
  const totalCount = achievements.length;

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-black mb-1">Troféus</Text>
        <Text className="text-white/60 text-sm">
          {earnedCount} de {totalCount} conquistados
        </Text>
      </View>

      <View className="px-4 mb-6">
        <View className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <View className="flex-row justify-between">
            <View>
              <Text className="text-white/60 text-xs mb-1">Conquistados</Text>
              <Text className="text-brand text-2xl font-black">{earnedCount}</Text>
            </View>
            <View className="items-end">
              <Text className="text-white/60 text-xs mb-1">Por conquistar</Text>
              <Text className="text-brand text-2xl font-black">{totalCount - earnedCount}</Text>
            </View>
          </View>

          <View className="mt-4 bg-white/10 rounded-full h-2 overflow-hidden">
            <View
              className="bg-brand h-full"
              style={{ width: `${(earnedCount / totalCount) * 100}%` }}
            />
          </View>
        </View>
      </View>

      <View className="px-4 pb-8">
        <FlatList
          data={achievements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderAchievement(item)}
          scrollEnabled={false}
        />
      </View>
    </ScrollView>
  );
}
