import { View, Text, FlatList } from 'react-native';
import type { Round, RoundItem as RoundItemType } from '../../types';
import { totalDrinks } from '../../domain/rounds';

interface RoundItemProps {
  round: Round;
  /** Nome do responsável — o cartão nunca mostra UUIDs. */
  responsibleName?: string;
}

function RoundItemProduct({ item }: { item: RoundItemType }): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between py-2 px-2 bg-fg/5 rounded-lg mb-2">
      <View className="flex-1">
        <Text className="text-fg text-sm font-semibold">{item.product_name}</Text>
      </View>
      <Text className="text-fg/60 text-xs mr-3">{item.quantity}x</Text>
      {/* `total_price` já vem em euros: a conversão de cêntimos acontece
          dentro de src/domain, não aqui. */}
      <Text className="text-brand font-bold text-sm">
        {item.total_price.toFixed(2)}€
      </Text>
    </View>
  );
}

export function RoundItem({ round, responsibleName }: RoundItemProps): React.ReactElement {
  const drinks = totalDrinks(round);
  const hora = round.created_at
    ? new Date(round.created_at).toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View className="bg-fg/10 rounded-2xl p-4 mb-3 border border-fg/20">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-fg font-bold">Rodada {round.round_number}</Text>
        <Text className="text-brand font-bold text-sm">{round.total_amount.toFixed(2)}€</Text>
      </View>

      <Text className="text-fg/60 text-xs mb-3">
        {responsibleName ? `por ${responsibleName}` : ''}
        {round.member_count ? ` • ${round.member_count} membros na altura` : ''}
        {` • ${drinks} ${drinks === 1 ? 'bebida' : 'bebidas'}`}
        {hora ? ` • ${hora}` : ''}
      </Text>

      <FlatList
        data={round.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RoundItemProduct item={item} />}
        scrollEnabled={false}
      />
    </View>
  );
}
