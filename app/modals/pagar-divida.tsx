import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useSessionDetails } from '../../src/hooks/useSession';
import { useMarkPaymentComplete } from '../../src/hooks/usePayments';
import { computeMemberDebt } from '../../src/domain/debt';
import { toEuros } from '../../src/domain/money';
import type { PaymentMethod } from '../../src/types';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'mbway', label: 'MB Way', icon: '📱' },
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'cartao', label: 'Cartão', icon: '💳' },
  { id: 'outro', label: 'Outro', icon: '❓' },
];

export default function PagarDividaModal() {
  const router = useRouter();
  const { sessionId, memberId } = useLocalSearchParams();
  const { profile } = useSession();
  const { data: session, isLoading } = useSessionDetails(sessionId as string);
  const markPaymentMutation = useMarkPaymentComplete();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const memberDebt = session ? computeMemberDebt(session, (memberId as string) || profile?.id || '') : null;
  const debtAmount = memberDebt ? toEuros(memberDebt.totalCents) : 0;
  const isPaid = memberDebt?.isPaid;

  const handleConfirmPayment = async () => {
    const payment = session?.payments.find(
      (p) => p.member_id === ((memberId as string) || profile?.id)
    );

    if (payment && selectedMethod) {
      try {
        await markPaymentMutation.mutateAsync({
          paymentId: payment.id,
          paymentMethod: selectedMethod,
        });

        router.back();
      } catch (error) {
        console.error('Erro ao marcar pagamento como completo:', error);
      }
    }
  };

  if (isLoading || !session || !memberDebt) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <ActivityIndicator color="#F27D26" />
      </View>
    );
  }

  const isValid = selectedMethod && !isPaid;

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 py-6">
        {/* Header */}
        <Text className="text-white text-2xl font-black mb-6">Pagar dívida</Text>

        {/* Dívida atual */}
        <View className="bg-white/5 border border-white/20 rounded-2xl p-6 mb-6">
          <Text className="text-white/60 text-sm mb-2">Dívida total</Text>
          <Text className="text-brand text-4xl font-black mb-4">
            {debtAmount.toFixed(2)}€
          </Text>

          {/* Breakdown */}
          {memberDebt.breakdown.length > 0 && (
            <View className="border-t border-white/10 pt-4">
              <Text className="text-white/60 text-xs mb-3 font-semibold">Detalhes</Text>
              <FlatList
                data={memberDebt.breakdown}
                keyExtractor={(item) => item.productName}
                renderItem={({ item }) => (
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-white/80 text-sm">
                      {item.productName} ({item.quantity}x)
                    </Text>
                    <Text className="text-white font-semibold">
                      {toEuros(item.amountCents).toFixed(2)}€
                    </Text>
                  </View>
                )}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>

        {/* Status */}
        {isPaid ? (
          <View className="bg-green-500/20 border border-green-500/40 rounded-2xl px-4 py-4 mb-6">
            <Text className="text-green-300 font-semibold text-center">
              ✓ Pagamento concluído
            </Text>
            {memberDebt.paidAt && (
              <Text className="text-green-300/60 text-xs text-center mt-1">
                Pago em {new Date(memberDebt.paidAt).toLocaleDateString('pt-PT')}
              </Text>
            )}
          </View>
        ) : (
          <>
            {/* Seleção de método de pagamento */}
            <View className="mb-6">
              <Text className="text-white/80 text-sm font-semibold mb-3">Método de pagamento</Text>
              <FlatList
                data={PAYMENT_METHODS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setSelectedMethod(item.id)}
                    className={`flex-row items-center rounded-2xl px-4 py-4 mb-2 border ${
                      selectedMethod === item.id
                        ? 'bg-brand/20 border-brand'
                        : 'bg-white/10 border-white/20'
                    }`}
                  >
                    <Text className="text-2xl mr-3">{item.icon}</Text>
                    <Text
                      className={`font-semibold ${
                        selectedMethod === item.id ? 'text-brand' : 'text-white'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )}
                scrollEnabled={false}
              />
            </View>

            {/* Confirm button */}
            <Pressable
              onPress={handleConfirmPayment}
              disabled={!isValid || markPaymentMutation.isPending}
              className={`rounded-2xl px-6 py-4 items-center ${
                isValid && !markPaymentMutation.isPending ? 'bg-brand' : 'bg-white/10'
              }`}
            >
              {markPaymentMutation.isPending ? (
                <ActivityIndicator color="rgba(255, 255, 255, 0.6)" />
              ) : (
                <Text
                  className={`font-black text-center ${
                    isValid ? 'text-black' : 'text-white/40'
                  }`}
                >
                  Confirmar pagamento
                </Text>
              )}
            </Pressable>

            {markPaymentMutation.isError && (
              <View className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 mt-4">
                <Text className="text-red-300 text-sm">
                  Erro ao marcar pagamento. Tenta novamente.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
