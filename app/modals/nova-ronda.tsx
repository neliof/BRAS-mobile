import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import { useCreateRound, useRounds } from '../../src/hooks/useRounds';
import { useSessionDetails } from '../../src/hooks/useSession';
import { useActiveProducts } from '../../src/hooks/useCatalog';
import { useGroupProfiles } from '../../src/hooks/useProfiles';
import { buildRound, type RoundDraftItem, RoundValidationError } from '../../src/domain/rounds';
import type { Product } from '../../src/types';

interface RoundItemDraft {
  productId: string;
  quantity: number;
  consumers: { memberId: string; quantity: number }[];
}

export default function NovaRondaModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params?.sessionId;
  const { profile } = useSession();
  const createRoundMutation = useCreateRound();
  const { data: session } = useSessionDetails(sessionId || '');
  const { data: rounds = [] } = useRounds(sessionId || '');
  const { data: products = [], isLoading: productsLoading } = useActiveProducts(session?.venue_id);
  const { data: profiles = [] } = useGroupProfiles(session?.group_id ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<RoundItemDraft[]>([]);
  const [notes, setNotes] = useState('');

  // Valida se sessionId existe
  if (!sessionId) {
    return (
      <View className="flex-1 bg-ink justify-center items-center">
        <Text className="text-red-400 font-semibold">Erro: Sessão inválida</Text>
      </View>
    );
  }

  const handleAddProduct = (product: Product) => {
    const existing = selectedItems.find((item) => item.productId === product.id);

    // Sem `setSelectedItems` nada disto chegava ao ecrã: tocar outra vez num
    // produto já escolhido mexia no objeto em estado e o React não voltava a
    // desenhar.
    if (existing) {
      setSelectedItems(
        selectedItems.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
      return;
    }

    setSelectedItems([
      ...selectedItems,
      {
        productId: product.id,
        quantity: 1,
        consumers: profile ? [{ memberId: profile.id, quantity: 1 }] : [],
      },
    ]);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.max(0, quantity) } : item
      )
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedItems(selectedItems.filter((item) => item.productId !== productId));
  };

  const handleToggleConsumer = (productIndex: number, memberId: string) => {
    setSelectedItems(
      selectedItems.map((item, index) => {
        if (index !== productIndex) return item;

        const isConsumer = item.consumers.some((c) => c.memberId === memberId);
        return {
          ...item,
          consumers: isConsumer
            ? item.consumers.filter((c) => c.memberId !== memberId)
            : [...item.consumers, { memberId, quantity: 1 }],
        };
      }),
    );
  };

  const handleSubmit = async () => {
    if (!session || !profile || selectedItems.length === 0) {
      return;
    }

    setValidationError(null);

    try {
      // Constrói e valida a ronda
      const newRound = buildRound({
        sessionId: session.id,
        roundNumber: rounds.length + 1,
        requestedBy: profile.id,
        createdBy: profile.id,
        createdAt: new Date().toISOString(),
        // O domínio exige que os pesos dos consumidores somem, no mínimo, a
        // quantidade pedida. A interface só pergunta *quem* bebeu, logo o peso
        // é a quantidade dividida em partes iguais — duas canecas para uma
        // pessoa dão peso 2, não 1, e a validação deixa de rebentar.
        items: selectedItems.map<RoundDraftItem>((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          consumers: item.consumers.map((consumer) => ({
            memberId: consumer.memberId,
            quantity: item.quantity / item.consumers.length,
          })),
        })),
        products,
        notes: notes || undefined,
      });

      await createRoundMutation.mutateAsync({
        sessionId: session.id,
        roundData: {
          roundNumber: newRound.round_number,
          requestedBy: newRound.requested_by,
          createdBy: newRound.created_by,
          notes: newRound.notes,
          items: newRound.items.map((item) => ({
            productId: item.product_id,
            productName: item.product_name,
            productImage: item.product_image,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            // A divisão por consumidor é o que torna a dívida calculável.
            consumptions: item.consumptions.map((consumption) => ({
              memberId: consumption.member_id,
              quantity: consumption.quantity,
              amount: consumption.amount,
            })),
          })),
        },
      });

      router.back();
    } catch (error) {
      // Diferencia RoundValidationError de outros erros
      if (error instanceof RoundValidationError) {
        setValidationError(`Erro na ronda: ${error.message}`);
      } else {
        console.error('Erro ao criar ronda:', error);
        setValidationError('Erro ao criar ronda. Tenta novamente.');
      }
    }
  };

  const isValid =
    selectedItems.length > 0 &&
    selectedItems.every((item) => item.consumers.length > 0 && item.quantity > 0);

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-4 py-6">
        {/* Header */}
        <Text className="text-white text-2xl font-black mb-6">Nova ronda</Text>

        {/* Produtos disponíveis */}
        <View className="mb-6">
          <Text className="text-white/80 text-sm font-semibold mb-3">Produtos</Text>
          {productsLoading ? (
            <ActivityIndicator color="#F27D26" />
          ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text className="text-white/60 text-sm">
                Ainda não há produtos configurados para este bar.
              </Text>
            }
            renderItem={({ item }) => {
              const selected = selectedItems.find((i) => i.productId === item.id);
              return (
                <Pressable
                  onPress={() => handleAddProduct(item)}
                  className={`flex-row justify-between items-center rounded-2xl px-4 py-3 mb-2 border ${
                    selected ? 'bg-brand/20 border-brand' : 'bg-white/10 border-white/20'
                  }`}
                >
                  <View className="flex-1">
                    <Text className={`font-semibold ${selected ? 'text-brand' : 'text-white'}`}>
                      {item.name}
                    </Text>
                    <Text className="text-white/60 text-xs mt-1">{item.unit_size}</Text>
                  </View>
                  <Text className="text-white/80 font-semibold">{item.current_price.toFixed(2)}€</Text>
                </Pressable>
              );
            }}
            scrollEnabled={false}
          />
          )}
        </View>

        {/* Itens selecionados */}
        {selectedItems.length > 0 && (
          <View className="mb-6">
            <Text className="text-white/80 text-sm font-semibold mb-3">Seleção ({selectedItems.length})</Text>
            {selectedItems.map((item, index) => {
              const product = products.find((p) => p.id === item.productId);
              if (!product) return null;

              return (
                <View
                  key={item.productId}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4"
                >
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-white font-semibold">{product.name}</Text>
                    <Pressable
                      onPress={() => handleRemoveProduct(item.productId)}
                      className="px-3 py-1 bg-red-500/20 rounded-lg"
                    >
                      <Text className="text-red-400 text-xs font-semibold">Remover</Text>
                    </Pressable>
                  </View>

                  <View className="mb-3">
                    <Text className="text-white/60 text-xs mb-2">Quantidade</Text>
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        className="bg-white/10 rounded-lg px-3 py-2"
                      >
                        <Text className="text-white">−</Text>
                      </Pressable>
                      <TextInput
                        className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-white text-center"
                        keyboardType="number-pad"
                        value={item.quantity.toString()}
                        onChangeText={(text) => handleUpdateQuantity(item.productId, parseInt(text) || 0)}
                      />
                      <Pressable
                        onPress={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        className="bg-white/10 rounded-lg px-3 py-2"
                      >
                        <Text className="text-white">+</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View>
                    <Text className="text-white/60 text-xs mb-2">Consumidores</Text>
                    <FlatList
                      data={session?.member_ids || []}
                      keyExtractor={(id) => id}
                      renderItem={({ item: memberId }) => (
                        <Pressable
                          onPress={() => handleToggleConsumer(index, memberId)}
                          className={`flex-row items-center rounded-lg px-3 py-2 mb-1 ${
                            item.consumers.some((c) => c.memberId === memberId)
                              ? 'bg-brand/20'
                              : 'bg-white/5'
                          }`}
                        >
                          <View
                            className={`w-4 h-4 rounded-full border mr-2 ${
                              item.consumers.some((c) => c.memberId === memberId)
                                ? 'bg-brand border-brand'
                                : 'border-white/20'
                            }`}
                          />
                          <Text className="text-white/80 text-sm">
                            {profiles.find((p) => p.id === memberId)?.name ?? 'Membro'}
                          </Text>
                        </Pressable>
                      )}
                      scrollEnabled={false}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Notas */}
        <View className="mb-6">
          <Text className="text-white/80 text-sm font-semibold mb-2">Notas (opcional)</Text>
          <TextInput
            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            placeholder="ex: Ronda dos tiros"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || createRoundMutation.isPending}
          className={`rounded-2xl px-6 py-4 items-center ${
            isValid && !createRoundMutation.isPending ? 'bg-brand' : 'bg-white/10'
          }`}
        >
          {createRoundMutation.isPending ? (
            <ActivityIndicator color="rgba(255, 255, 255, 0.6)" />
          ) : (
            <Text
              className={`font-black text-center ${
                isValid ? 'text-black' : 'text-white/40'
              }`}
            >
              Criar ronda
            </Text>
          )}
        </Pressable>

        {(validationError || createRoundMutation.isError) && (
          <View className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-red-300 text-sm">
              {validationError || 'Erro ao criar ronda. Tenta novamente.'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
