import { Tabs } from 'expo-router';
import { Home, Beer, Users, Calendar, Camera, Trophy } from 'lucide-react-native';

/**
 * Layout móvel com 6 abas inferiores.
 * Cores: brand #F27D26, fundo #12161F
 */
export default function MobileLayout() {
  const renderIconHome = (props: any) => <Home {...props} />;
  const renderIconBeer = (props: any) => <Beer {...props} />;
  const renderIconUsers = (props: any) => <Users {...props} />;
  const renderIconCalendar = (props: any) => <Calendar {...props} />;
  const renderIconCamera = (props: any) => <Camera {...props} />;
  const renderIconTrophy = (props: any) => <Trophy {...props} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#12161F',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#F27D26',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: renderIconHome,
        }}
      />

      <Tabs.Screen
        name="noite"
        options={{
          title: 'Noite',
          tabBarIcon: renderIconBeer,
        }}
      />

      <Tabs.Screen
        name="amigos"
        options={{
          title: 'Amigos',
          tabBarIcon: renderIconUsers,
        }}
      />

      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: renderIconCalendar,
        }}
      />

      <Tabs.Screen
        name="memorias"
        options={{
          title: 'Memórias',
          tabBarIcon: renderIconCamera,
        }}
      />

      <Tabs.Screen
        name="conquistas"
        options={{
          title: 'Troféus',
          tabBarIcon: renderIconTrophy,
        }}
      />
    </Tabs>
  );
}
