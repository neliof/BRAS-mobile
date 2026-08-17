import { View, Text, FlatList } from 'react-native';
import type { Round, RoundItem as RoundItemType } from '../../types';

interface RoundItemProps {
  round: Round;
}

function RoundItemProduct({ item }: { item: RoundItemType }): React.ReactElement {
  const consumedByCount = item.consumptions?.length || 0;

  return (
    <View className="flex-row items-center justify-between py-2 px-2 bg-white/5 rounded-lg mb-2">
      <View className="flex-1">
        <Text className="text-white text-sm font-semibold">{item.product_name}</Text>
        <Text className="text-white/50 text-xs mt-1">
          {item.quantity}x • {consumedByCount} membros
        </Text>
      </View>
      <Text className="text-brand font-bold text-sm">
        {(item.total_price / 100).toFixed(2)}€
      </Text>
    </View>
  );
}

export function RoundItem({ round }: RoundItemProps): React.ReactElement {
  const totalAmount = round.total_amount / 100;

  return (
    <View className="bg-white/10 rounded-2xl p-4 mb-3 border border-white/20">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-bold">Ronda {round.round_number}</Text>
        <Text className="text-brand font-bold text-sm">{totalAmount.toFixed(2)}€</Text>
      </View>

      <FlatList
        data={round.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RoundItemProduct item={item} />}
        scrollEnabled={false}
      />

      <Text className="text-white/60 text-xs mt-2">
        {round.created_at ? new Date(round.created_at).toLocaleTimeString('pt-PT') : ''}
      </Text>
    </View>
  );
}
