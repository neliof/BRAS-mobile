import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../src/state/SessionContext';
import {
  useCreateRound,
  useDeleteRound,
  useRounds,
  useUpdateRound,
} from '../../src/hooks/useRounds';
import { useSessionDetails } from '../../src/hooks/useSession';
import { useActiveProducts } from '../../src/hooks/useCatalog';
import { useGroupProfiles } from '../../src/hooks/useProfiles';
import {
  buildRound,
  nextResponsible,
  scaleQuantities,
  RoundValidationError,
  type RoundDraftItem,
} from '../../src/domain/rounds';
import type { Product, Round } from '../../src/types';
import { useTheme } from '../../src/theme/ThemeContext';
import { withAlpha } from '../../src/theme/tokens';

/**
 * Nova rodada — e, com `roundId`, correção de uma já registada.
 *
 * Um responsável pede para a mesa. Não se escolhe "quem bebeu o quê": cada um
 * paga as rodadas que pediu, não uma fatia das dos outros. O número de membros
 * na noite é a referência da quantidade; o pedido real é o que o responsável
 * decidir.
 *
 * O mesmo formulário serve os dois casos — criar e corrigir são o mesmo
 * conjunto de campos, e duplicar o ecrã era duplicar cada correção futura.
 */
export default function NovaRodadaModal() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; roundId?: string }>();
  const sessionId = params?.sessionId;
  const roundId = params?.roundId;
  const { profile, isAdmin } = useSession();
  const createRoundMutation = useCreateRound();
  const updateRoundMutation = useUpdateRound();
  const deleteRoundMutation = useDeleteRound();
  const { data: session } = useSessionDetails(sessionId || '');
  const { data: rounds = [] } = useRounds(sessionId || '');
  const { data: products = [], isLoading: productsLoading } = useActiveProducts(session?.venue_id);
  const { data: profiles = [] } = useGroupProfiles(session?.group_id ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<RoundDraftItem[]>([]);
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  // Só a edição mexe no snapshot: ao criar, ele é quem está na noite. `null`
  // significa "ainda não carreguei a rodada a editar".
  const [snapshotIds, setSnapshotIds] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  const editing = roundId ? rounds.find((r) => r.id === roundId) : undefined;
  const activeMemberIds = session?.member_ids ?? [];
  const memberCount = editing ? (snapshotIds?.length ?? 0) : activeMemberIds.length;
  const suggestedId = nextResponsible(rounds, activeMemberIds);

  // A sugestão preenche o responsável, mas nunca o prende: escolher outro
  // membro é um toque. A app regista quem realmente pediu.
  useEffect(() => {
    if (editing) return;
    if (!responsibleId && suggestedId) setResponsibleId(suggestedId);
  }, [editing, responsibleId, suggestedId]);

  // Uma só vez: depois disto o formulário é do utilizador, e um refetch da
  // lista não pode arrastar as escolhas dele de volta ao que está gravado.
  useEffect(() => {
    if (!editing || loaded) return;
    setResponsibleId(editing.requested_by);
    setNotes(editing.notes ?? '');
    setSelectedItems(
      (editing.items ?? []).map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
      })),
    );
    setSnapshotIds(editing.member_ids ?? []);
    setLoaded(true);
  }, [editing, loaded]);

  if (!sessionId) {
    return (
      <View className="flex-1 bg-canvas justify-center items-center">
        <Text className="text-danger font-semibold">Erro: Sessão inválida</Text>
      </View>
    );
  }

  const nameOf = (memberId: string) =>
    profiles.find((p) => p.id === memberId)?.name ?? 'Membro';

  const lastRound: Round | undefined = [...rounds]
    .filter((r) => r.status !== 'cancelled')
    .sort((a, b) => b.round_number - a.round_number)[0];

  const setQuantity = (productId: string, quantity: number) => {
    setSelectedItems((current) => {
      if (quantity <= 0) return current.filter((item) => item.productId !== productId);
      const exists = current.some((item) => item.productId === productId);
      if (exists) {
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        );
      }
      return [...current, { productId, quantity }];
    });
  };

  const quantityOf = (productId: string) =>
    selectedItems.find((item) => item.productId === productId)?.quantity ?? 0;

  const totalSelected = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  /**
   * Repetir a rodada anterior como ponto de partida, com as quantidades
   * adaptadas aos membros de agora: 10 cervejas para 10 membros viram 8
   * quando restam 8. Tudo ajustável antes de registar.
   */
  const handleRepeatLast = () => {
    if (!lastRound) return;

    const previousItems = (lastRound.items ?? []).map((item) => ({
      productId: item.product_id,
      quantity: item.quantity,
    }));

    const scaled = scaleQuantities(
      previousItems,
      lastRound.member_count ?? memberCount,
      memberCount,
    );

    // Produtos entretanto desativados saem da sugestão em vez de rebentar a
    // validação.
    const available = new Set(products.map((p) => p.id));
    setSelectedItems(scaled.filter((item) => available.has(item.productId)));
  };

  const toggleSnapshotMember = (memberId: string) => {
    setSnapshotIds((current) => {
      const list = current ?? [];
      return list.includes(memberId)
        ? list.filter((id) => id !== memberId)
        : [...list, memberId];
    });
  };

  const handleSubmit = async () => {
    if (!session || !profile || !responsibleId || selectedItems.length === 0) {
      return;
    }

    setValidationError(null);
    const memberIds = editing ? (snapshotIds ?? []) : activeMemberIds;

    try {
      // `buildRound` valida e calcula os preços à data em ambos os casos; a
      // rodada que devolve é descartada na edição, onde só interessam os
      // artigos já com preço.
      const built = buildRound({
        sessionId: session.id,
        // Só para o objeto local. O número gravado é o que já existe (edição)
        // ou o que o servidor atribui (criação).
        roundNumber: editing?.round_number ?? rounds.length + 1,
        requestedBy: responsibleId,
        createdBy: profile.id,
        createdAt: editing?.created_at ?? new Date().toISOString(),
        memberIds,
        items: selectedItems,
        products,
        notes: notes || undefined,
      });

      const items = built.items.map((item) => ({
        productId: item.product_id,
        productName: item.product_name,
        productImage: item.product_image,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
      }));

      if (editing) {
        await updateRoundMutation.mutateAsync({
          roundId: editing.id,
          roundData: {
            requestedBy: built.requested_by,
            notes: built.notes,
            memberIds,
            items,
          },
        });
      } else {
        await createRoundMutation.mutateAsync({
          sessionId: session.id,
          roundData: {
            requestedBy: built.requested_by,
            createdBy: built.created_by,
            notes: built.notes,
            memberIds,
            items,
          },
        });
      }

      router.back();
    } catch (cause) {
      if (cause instanceof RoundValidationError) {
        setValidationError(cause.message);
      } else {
        setValidationError(
          cause instanceof Error ? cause.message : 'Não foi possível guardar a rodada.',
        );
      }
    }
  };

  const handleDelete = () => {
    if (!editing) return;

    Alert.alert(
      'Apagar rodada',
      `A rodada ${editing.round_number}, de ${nameOf(editing.requested_by)}, é apagada de vez. As rodadas seguintes mantêm os números que têm.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoundMutation.mutateAsync(editing.id);
              router.back();
            } catch (cause) {
              setValidationError(
                cause instanceof Error ? cause.message : 'Não foi possível apagar.',
              );
            }
          },
        },
      ],
    );
  };

  const pending = createRoundMutation.isPending || updateRoundMutation.isPending;
  const isValid = Boolean(responsibleId && selectedItems.length > 0);
  // Ao editar, o responsável pode já não estar na noite — quem pediu, pediu.
  const responsibleOptions = editing
    ? [...new Set([...activeMemberIds, ...(snapshotIds ?? []), editing.requested_by])]
    : activeMemberIds;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <View className="px-4 py-6">
        <Text className="text-fg text-2xl font-black mb-1">
          {editing ? `Editar rodada ${editing.round_number}` : 'Nova rodada'}
        </Text>
        <Text className="text-fg/60 text-sm mb-6">
          {editing
            ? 'Corrige o responsável, as bebidas ou quem estava na mesa. A posição no histórico e a hora não mudam.'
            : `${memberCount} ${memberCount === 1 ? 'membro' : 'membros'} na noite — a referência são ${memberCount} bebidas, mas o pedido é o que tu decidires.`}
        </Text>

        <View className="mb-6">
          <Text className="text-fg/80 text-sm font-semibold mb-2">Responsável</Text>
          <View className="flex-row flex-wrap gap-2">
            {responsibleOptions.map((memberId) => {
              const selected = responsibleId === memberId;
              const suggested = !editing && suggestedId === memberId;
              return (
                <Pressable
                  key={memberId}
                  onPress={() => setResponsibleId(memberId)}
                  className={`rounded-full px-4 py-2 border ${
                    selected ? 'bg-brand/20 border-brand' : 'bg-fg/10 border-fg/20'
                  }`}
                >
                  <Text
                    className={`font-semibold text-sm ${selected ? 'text-brand' : 'text-fg'}`}
                  >
                    {nameOf(memberId)}
                    {suggested ? ' • sugerido' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Só na edição: ao criar, o snapshot é quem está na noite, e mais um
            seletor só atrasava os três toques que a rodada tem de custar. */}
        {editing && (
          <View className="mb-6">
            <Text className="text-fg/80 text-sm font-semibold mb-1">
              Quem estava na mesa ({memberCount})
            </Text>
            <Text className="text-fg/50 text-xs mb-2">
              O que ficou registado no momento da rodada.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[...new Set([...activeMemberIds, ...(snapshotIds ?? [])])].map((memberId) => {
                const included = (snapshotIds ?? []).includes(memberId);
                return (
                  <Pressable
                    key={memberId}
                    onPress={() => toggleSnapshotMember(memberId)}
                    className={`rounded-full px-4 py-2 border ${
                      included ? 'bg-brand/20 border-brand' : 'bg-fg/10 border-fg/20'
                    }`}
                  >
                    <Text
                      className={`font-semibold text-sm ${included ? 'text-brand' : 'text-fg/60'}`}
                    >
                      {nameOf(memberId)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {!editing && lastRound && (
          <Pressable
            onPress={handleRepeatLast}
            className="bg-fg/10 border border-fg/20 rounded-2xl px-4 py-3 mb-6"
          >
            <Text className="text-fg font-semibold text-sm">
              Repetir rodada anterior ({lastRound.member_count ?? '?'} membros →{' '}
              {memberCount} agora)
            </Text>
            <Text className="text-fg/50 text-xs mt-1">
              Usa a rodada de {nameOf(lastRound.requested_by)} como modelo, ajustada aos
              membros atuais.
            </Text>
          </Pressable>
        )}

        <View className="mb-2 flex-row items-baseline justify-between">
          <Text className="text-fg/80 text-sm font-semibold">Bebidas</Text>
          <Text className={`text-xs font-semibold ${totalSelected > 0 ? 'text-brand' : 'text-fg/40'}`}>
            {totalSelected} escolhidas
          </Text>
        </View>

        {productsLoading ? (
          <ActivityIndicator color={theme.colors.brand} />
        ) : products.length === 0 ? (
          <Text className="text-fg/60 text-sm mb-6">
            Ainda não há produtos para este bar.
          </Text>
        ) : (
          <View className="mb-6">
            {products.map((product: Product) => {
              const quantity = quantityOf(product.id);
              return (
                <View
                  key={product.id}
                  className={`flex-row items-center rounded-2xl px-4 py-3 mb-2 border ${
                    quantity > 0 ? 'bg-brand/10 border-brand/60' : 'bg-fg/10 border-fg/20'
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-fg font-semibold">{product.name}</Text>
                    <Text className="text-fg/50 text-xs mt-0.5">
                      {product.unit_size} • {product.current_price.toFixed(2)}€
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setQuantity(product.id, quantity - 1)}
                    disabled={quantity === 0}
                    className={`w-9 h-9 rounded-xl items-center justify-center border ${
                      quantity > 0 ? 'bg-fg/10 border-fg/20' : 'bg-fg/5 border-fg/10'
                    }`}
                  >
                    <Text className={quantity > 0 ? 'text-fg font-black' : 'text-fg/30 font-black'}>
                      −
                    </Text>
                  </Pressable>
                  <Text className="text-fg font-black w-8 text-center">{quantity}</Text>
                  <Pressable
                    onPress={() => setQuantity(product.id, quantity + 1)}
                    className="w-9 h-9 rounded-xl items-center justify-center bg-brand"
                  >
                    <Text className="text-on-brand font-black">+</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <Text className="text-fg/80 text-sm font-semibold mb-2">Observações (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="ex: rodada de aniversário"
          placeholderTextColor={withAlpha(theme.colors.fg, 0.4)}
          className="bg-fg/10 border border-fg/20 rounded-2xl px-4 py-3 text-fg mb-6"
        />

        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || pending}
          className={`rounded-2xl px-6 py-4 items-center ${
            isValid && !pending ? 'bg-brand' : 'bg-fg/10'
          }`}
        >
          {pending ? (
            <ActivityIndicator color={withAlpha(theme.colors.onBrand, 0.6)} />
          ) : (
            <Text className={`font-black text-center ${isValid ? 'text-on-brand' : 'text-fg/40'}`}>
              {editing ? 'Guardar alterações' : 'Registar rodada'}
            </Text>
          )}
        </Pressable>

        {/* Apagar é o último recurso: corrigir a rodada resolve quase sempre,
            e o histórico da noite fica mais fiel com a correção do que com o
            buraco. Por isso só admin, e só depois de confirmar. */}
        {editing && isAdmin && (
          <Pressable
            onPress={handleDelete}
            disabled={deleteRoundMutation.isPending}
            className="rounded-2xl px-6 py-4 items-center border border-danger/40 bg-danger/10 mt-3"
          >
            <Text className="text-danger font-black text-center">Apagar rodada</Text>
          </Pressable>
        )}

        {validationError && (
          <View className="bg-danger/20 border border-danger/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-danger text-sm">{validationError}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
