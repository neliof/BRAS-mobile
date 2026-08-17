import { View, Text, FlatList, Pressable } from 'react-native';
import type { MemberDebt as MemberDebtType } from '../../domain/debt';
import type { Profile } from '../../types';

interface MemberDebtProps {
  debt: MemberDebtType;
  profile?: Profile;
  onPress?: () => void;
}

interface DebtBreakdownItemProps {
  productName: string;
  quantity: number;
  amountCents: number;
}

function DebtBreakdownItem({
  productName,
  quantity,
  amountCents,
}: DebtBreakdownItemProps): React.ReactElement {
  const amount = amountCents / 100;

  return (
    <View className="flex-row items-center justify-between py-1 px-2">
      <Text className="text-white/60 text-xs flex-1">{productName}</Text>
      <Text className="text-white/60 text-xs">{quantity}x</Text>
      <Text className="text-white text-xs font-semibold ml-2">{amount.toFixed(2)}€</Text>
    </View>
  );
}

export function MemberDebt({ debt, profile, onPress }: MemberDebtProps): React.ReactElement {
  const totalAmount = debt.totalCents / 100;
  const statusColor = debt.isPaid ? 'text-white/40' : 'text-brand';
  const statusText = debt.isPaid ? 'Pago' : 'Pendente';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="bg-white/10 rounded-2xl p-4 mb-3 border border-white/20"
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1">
          <Text className="text-white font-bold">{profile?.name || 'Membro'}</Text>
          <Text className={`text-xs mt-1 ${statusColor}`}>{statusText}</Text>
        </View>
        <Text className="text-brand font-bold text-lg">{totalAmount.toFixed(2)}€</Text>
      </View>

      {debt.breakdown.length > 0 && (
        <View className="mt-2 border-t border-white/10 pt-2">
          <FlatList
            data={debt.breakdown}
            keyExtractor={(item) => item.productName}
            renderItem={({ item }) => (
              <DebtBreakdownItem
                productName={item.productName}
                quantity={item.quantity}
                amountCents={item.amountCents}
              />
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      <Text className="text-white/40 text-xs mt-2">{debt.totalDrinks} bebidas</Text>
    </Pressable>
  );
}
