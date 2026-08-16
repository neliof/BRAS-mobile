import { Text, View } from 'react-native';
import { useSession } from '../../src/state/SessionContext';

export default function HomePlaceholder() {
  const { profile, isAdmin } = useSession();

  return (
    <View className="flex-1 items-center justify-center bg-ink px-8">
      <Text className="text-brand text-2xl font-black mb-2">
        Olá, {profile?.name ?? 'amigo'}
      </Text>
      <Text className="text-white/50">
        {isAdmin ? 'Sessão de administrador' : 'Sessão de membro'}
      </Text>
    </View>
  );
}
