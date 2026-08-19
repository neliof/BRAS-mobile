import { View, Text } from 'react-native';
import type { Achievement, MemberAchievement } from '../../types';

interface AchievementBadgeProps {
  achievement: Achievement;
  memberAchievement?: MemberAchievement;
  progress?: number;
  isLocked?: boolean;
}

export function AchievementBadge({
  achievement,
  memberAchievement,
  progress = 0,
  isLocked = false,
}: AchievementBadgeProps): React.ReactElement {
  const isEarned = memberAchievement !== undefined;
  const opacity = isLocked ? 'opacity-50' : 'opacity-100';
  const textColor = isLocked ? 'text-fg/40' : 'text-fg';
  const borderColor = isEarned ? 'border-brand' : 'border-fg/20';

  return (
    <View className={`bg-fg/10 rounded-2xl p-4 border ${borderColor} ${opacity}`}>
      <View className="flex-row items-start gap-3">
        <View className="bg-brand rounded-full w-12 h-12 items-center justify-center flex-shrink-0">
          <Text className="text-lg">{achievement.icon}</Text>
        </View>

        <View className="flex-1">
          <Text className={`${textColor} font-bold text-sm`}>{achievement.name}</Text>
          <Text className="text-fg/60 text-xs mt-1">{achievement.description}</Text>

          {!isEarned && progress > 0 && progress < 100 && (
            <View className="mt-2 bg-fg/10 rounded-full h-1.5 overflow-hidden">
              <View
                className="bg-brand h-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </View>
          )}

          {isEarned && (
            <Text className="text-brand text-xs font-semibold mt-2">
              Conquistado {new Date(memberAchievement.earned_at).toLocaleDateString('pt-PT')}
            </Text>
          )}

          {isLocked && progress === 0 && (
            <Text className="text-fg/40 text-xs mt-2">Bloqueado</Text>
          )}
        </View>
      </View>
    </View>
  );
}
