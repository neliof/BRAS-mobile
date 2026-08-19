import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Atalhos } from '../../src/components/mobile/Atalhos';

/**
 * Layout móvel: barra de atalhos no topo, presente em todos os ecrãs.
 *
 * O navegador continua a ser Tabs — as rotas e o estado de cada ecrã
 * mantêm-se — mas a barra do rodapé está escondida: os atalhos do topo,
 * maiores e sempre à vista, substituem-na a pedido do utilizador.
 */
export default function MobileLayout() {
  return (
    <View className="flex-1 bg-canvas">
      <Atalhos />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Início' }} />
        <Tabs.Screen name="noite" options={{ title: 'Noite' }} />
        <Tabs.Screen name="amigos" options={{ title: 'Amigos' }} />
        <Tabs.Screen name="historico" options={{ title: 'Histórico' }} />
        <Tabs.Screen name="memorias" options={{ title: 'Memórias' }} />
        <Tabs.Screen name="conquistas" options={{ title: 'Troféus' }} />
      </Tabs>
    </View>
  );
}
