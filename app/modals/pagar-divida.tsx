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
import { useSettleMemberDebt } from '../../src/hooks/usePayments';
import { computeMemberDebt } from '../../src/domain/debt';
import { toEuros } from '../../src/domain/money';
import type { PaymentMethod } from '../../src/types';
import { useTheme } from '../../src/theme/ThemeContext';
import { withAlpha } from '../../src/theme/tokens';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'mbway', label: 'MB Way', icon: '📱' },
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'cartao', label: 'Cartão', icon: '💳' },
  { id: 'outro', label: 'Outro', icon: '❓' },
];

export default function PagarDividaModal() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; memberId?: string }>();
  const sessionId = params?.sessionId;
  const memberId = params?.memberId;
  const { profile } = useSession();
  const { data: session, isLoading } = useSessionDetails(sessionId || '');
  const settleDebtMutation = useSettleMemberDebt();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  if (!sessionId) {
    return (
      <View className="flex-1 bg-canvas justify-center items-center">
        <Text className="text-danger font-semibold">Erro: Sessão inválida</Text>
      </View>
    );
  }

  const memberDebt = session ? computeMemberDebt(session, memberId || profile?.id || '') : null;
  const debtAmount = memberDebt ? toEuros(memberDebt.totalCents) : 0;
  const isPaid = memberDebt?.isPaid;

  const handleConfirmPayment = async () => {
    const payer = memberId || profile?.id;

    // A dívida é calculada a partir dos consumos e pode ainda não ter linha em
    // `payments`. O upsert trata os dois casos.
    if (!payer || !selectedMethod || !memberDebt) return;

    try {
      await settleDebtMutation.mutateAsync({
        sessionId,
        memberId: payer,
        amount: debtAmount,
        paymentMethod: selectedMethod,
      });

      router.back();
    } catch (error) {
      console.error('Erro ao registar o pagamento:', error);
    }
  };

  if (isLoading || !session || !memberDebt) {
    return (
      <View className="flex-1 bg-canvas justify-center items-center">
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  const isValid = selectedMethod && !isPaid;

  return (
    <ScrollView className="flex-1 bg-canvas">
      <View className="px-4 py-6">
        {/* Header */}
        <Text className="text-fg text-2xl font-black mb-6">Pagar dívida</Text>

        {/* Dívida atual */}
        <View className="bg-fg/5 border border-fg/20 rounded-2xl p-6 mb-6">
          <Text className="text-fg/60 text-sm mb-2">Dívida total</Text>
          <Text className="text-brand text-4xl font-black mb-4">
            {debtAmount.toFixed(2)}€
          </Text>

          {/* Breakdown */}
          {memberDebt.breakdown.length > 0 && (
            <View className="border-t border-fg/10 pt-4">
              <Text className="text-fg/60 text-xs mb-3 font-semibold">Detalhes</Text>
              <FlatList
                data={memberDebt.breakdown}
                keyExtractor={(item) => item.productName}
                renderItem={({ item }) => (
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-fg/80 text-sm">
                      {item.productName} ({item.quantity}x)
                    </Text>
                    <Text className="text-fg font-semibold">
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
              <Text className="text-fg/80 text-sm font-semibold mb-3">Método de pagamento</Text>
              <FlatList
                data={PAYMENT_METHODS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setSelectedMethod(item.id)}
                    className={`flex-row items-center rounded-2xl px-4 py-4 mb-2 border ${
                      selectedMethod === item.id
                        ? 'bg-brand/20 border-brand'
                        : 'bg-fg/10 border-fg/20'
                    }`}
                  >
                    <Text className="text-2xl mr-3">{item.icon}</Text>
                    <Text
                      className={`font-semibold ${
                        selectedMethod === item.id ? 'text-brand' : 'text-fg'
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
              disabled={!isValid || settleDebtMutation.isPending}
              className={`rounded-2xl px-6 py-4 items-center ${
                isValid && !settleDebtMutation.isPending ? 'bg-brand' : 'bg-fg/10'
              }`}
            >
              {settleDebtMutation.isPending ? (
                <ActivityIndicator color={withAlpha(theme.colors.onBrand, 0.6)} />
              ) : (
                <Text
                  className={`font-black text-center ${
                    isValid ? 'text-on-brand' : 'text-fg/40'
                  }`}
                >
                  Confirmar pagamento
                </Text>
              )}
            </Pressable>

            {settleDebtMutation.isError && (
              <View className="bg-danger/20 border border-danger/40 rounded-2xl px-4 py-3 mt-4">
                <Text className="text-danger text-sm">
                  Erro ao registar o pagamento. Tenta novamente.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
