import { View, Text, Pressable } from 'react-native';
import type { Session } from '../../types';

interface SessionCardProps {
  session: Session;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: SessionCardProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white/10 rounded-2xl p-4 mb-3 border border-white/20"
    >
      <Text className="text-white text-lg font-bold">{session.name}</Text>
      <Text className="text-white/60 text-sm mt-1">{session.code}</Text>
      <Text className="text-brand text-xs mt-2">
        {session.member_ids.length} membros
      </Text>
    </Pressable>
  );
}
