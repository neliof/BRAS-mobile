import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { restoreAccess } from '../src/api/access';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    restoreAccess()
      .then((grant) => {
        if (cancelled) return;
        router.replace(grant ? '/(gate)/perfil' : '/(gate)/codigo');
      })
      .catch(() => {
        if (!cancelled) router.replace('/(gate)/codigo');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-ink">
      <ActivityIndicator color="#F27D26" />
    </View>
  );
}
