import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSession } from '../../src/state/SessionContext';
import {
  useVenues,
  useActiveProducts,
  useCreateVenue,
  useCreateProduct,
  useChangeProductPrice,
  useDeactivateProduct,
  useUpdateProduct,
} from '../../src/hooks/useCatalog';
import type { ProductCategory } from '../../src/types';

const CATEGORIES: { id: ProductCategory; label: string }[] = [
  { id: 'cerveja', label: 'Cerveja' },
  { id: 'shots', label: 'Shots' },
  { id: 'sem_alcool', label: 'Sem álcool' },
  { id: 'vinho_sidra', label: 'Vinho e sidra' },
  { id: 'petiscos', label: 'Petiscos' },
  { id: 'cafe_outros', label: 'Café e outros' },
];

/** Aceita vírgula decimal, que é como se escreve um preço em Portugal. */
function parsePrice(text: string): number {
  return Number.parseFloat(text.replace(',', '.'));
}

export default function CatalogoModal() {
  const { isAdmin } = useSession();

  const { data: venues = [], isLoading: venuesLoading } = useVenues();
  const [venueId, setVenueId] = useState<string | null>(null);
  const selectedVenueId = venueId ?? venues[0]?.id ?? null;

  const { data: products = [], isLoading: productsLoading } = useActiveProducts(
    selectedVenueId ?? undefined,
  );

  const createVenue = useCreateVenue();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const changePrice = useChangeProductPrice();
  const deactivate = useDeactivateProduct();

  const [venueName, setVenueName] = useState('');
  const [productName, setProductName] = useState('');
  const [unitSize, setUnitSize] = useState('');
  const [category, setCategory] = useState<ProductCategory>('cerveja');
  const [price, setPrice] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  // Com um id aqui, o formulário de baixo edita esse produto em vez de criar.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-ink justify-center items-center px-6">
        <Text className="text-red-400 font-semibold text-center">
          Só um administrador do grupo pode gerir bares e produtos.
        </Text>
      </View>
    );
  }

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallback);
    }
  };

  const handleCreateVenue = () =>
    run(async () => {
      const venue = await createVenue.mutateAsync({ name: venueName });
      setVenueName('');
      setVenueId(venue.id);
    }, 'Não foi possível criar o bar.');

  const resetProductForm = () => {
    setEditingId(null);
    setProductName('');
    setUnitSize('');
    setPrice('');
    setCategory('cerveja');
  };

  const handleStartEditing = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setEditingId(product.id);
    setProductName(product.name);
    setUnitSize(product.unit_size);
    setCategory(product.category);
    setPrice('');
  };

  const handleSaveProduct = () =>
    run(async () => {
      if (editingId) {
        await updateProduct.mutateAsync({
          productId: editingId,
          name: productName,
          unitSize,
          category,
        });
        resetProductForm();
        return;
      }

      if (!selectedVenueId) throw new Error('Escolhe um bar primeiro.');

      await createProduct.mutateAsync({
        venueId: selectedVenueId,
        name: productName,
        category,
        unitSize,
        price: parsePrice(price),
      });

      resetProductForm();
    }, 'Não foi possível guardar o produto.');

  const handleChangePrice = (productId: string) =>
    run(async () => {
      await changePrice.mutateAsync({ productId, price: parsePrice(prices[productId] ?? '') });
      setPrices((current) => ({ ...current, [productId]: '' }));
    }, 'Não foi possível alterar o preço.');

  const handleDeactivate = (productId: string, name: string) => {
    Alert.alert('Desativar produto', `${name} deixa de aparecer nas rodadas novas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desativar',
        style: 'destructive',
        onPress: () => void run(() => deactivate.mutateAsync(productId), 'Não foi possível desativar.'),
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-ink"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <View className="px-4 py-6">
        <Text className="text-white text-2xl font-black mb-6">Bares e produtos</Text>

        <Text className="text-white/80 text-sm font-semibold mb-3">Bares</Text>
        {venuesLoading ? (
          <ActivityIndicator color="#F27D26" />
        ) : (
          <View className="mb-3">
            {venues.length === 0 && (
              <Text className="text-white/60 text-sm mb-2">
                Ainda não há bares. Cria o primeiro para poder abrir noites.
              </Text>
            )}
            {venues.map((venue) => (
              <Pressable
                key={venue.id}
                onPress={() => setVenueId(venue.id)}
                className={`rounded-2xl px-4 py-3 mb-2 border ${
                  selectedVenueId === venue.id
                    ? 'bg-brand/20 border-brand'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    selectedVenueId === venue.id ? 'text-brand' : 'text-white'
                  }`}
                >
                  {venue.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View className="flex-row gap-2 mb-8">
          <TextInput
            value={venueName}
            onChangeText={setVenueName}
            placeholder="Nome do bar"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white"
          />
          <Pressable
            onPress={handleCreateVenue}
            disabled={!venueName.trim() || createVenue.isPending}
            className={`rounded-2xl px-4 py-3 items-center justify-center ${
              venueName.trim() && !createVenue.isPending ? 'bg-brand' : 'bg-white/10'
            }`}
          >
            <Text className={venueName.trim() ? 'text-black font-black' : 'text-white/40 font-black'}>
              Criar
            </Text>
          </Pressable>
        </View>

        <Text className="text-white/80 text-sm font-semibold mb-3">
          Produtos {selectedVenueId ? '' : '(escolhe um bar)'}
        </Text>

        {productsLoading ? (
          <ActivityIndicator color="#F27D26" />
        ) : (
          <View className="mb-6">
            {products.length === 0 && (
              <Text className="text-white/60 text-sm mb-2">
                Este bar ainda não tem produtos. Sem produtos não há rodadas.
              </Text>
            )}
            {products.map((product) => (
              <View
                key={product.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3"
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 pr-3">
                    <Text className="text-white font-semibold">{product.name}</Text>
                    <Text className="text-white/60 text-xs mt-1">{product.unit_size}</Text>
                  </View>
                  <Text className="text-brand font-bold">
                    {product.current_price.toFixed(2)}€
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <TextInput
                    value={prices[product.id] ?? ''}
                    onChangeText={(text) =>
                      setPrices((current) => ({ ...current, [product.id]: text }))
                    }
                    placeholder="Novo preço"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    keyboardType="decimal-pad"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white"
                  />
                  <Pressable
                    onPress={() => handleChangePrice(product.id)}
                    disabled={!prices[product.id] || changePrice.isPending}
                    className={`rounded-xl px-4 py-2 items-center justify-center ${
                      prices[product.id] ? 'bg-brand' : 'bg-white/10'
                    }`}
                  >
                    <Text
                      className={
                        prices[product.id] ? 'text-black font-black' : 'text-white/40 font-black'
                      }
                    >
                      Guardar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleStartEditing(product.id)}
                    className="rounded-xl px-3 py-2 bg-white/10 border border-white/20 items-center justify-center"
                  >
                    <Text className="text-white text-xs font-semibold">Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeactivate(product.id, product.name)}
                    className="rounded-xl px-3 py-2 bg-red-500/20 items-center justify-center"
                  >
                    <Text className="text-red-300 text-xs font-semibold">Desativar</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text className="text-white/80 text-sm font-semibold mb-3">
          {editingId ? 'Editar produto' : 'Novo produto'}
        </Text>
        <TextInput
          value={productName}
          onChangeText={setProductName}
          placeholder="Nome (ex: Imperial)"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white mb-2"
        />
        <TextInput
          value={unitSize}
          onChangeText={setUnitSize}
          placeholder="Tamanho (ex: Caneca 0.5L)"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white mb-2"
        />
        {/* Em edição o preço não entra aqui: tem o seu próprio fluxo no cartão
            do produto, porque mexe no histórico imutável. */}
        {!editingId && (
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Preço (ex: 1,50)"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            keyboardType="decimal-pad"
            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white mb-3"
          />
        )}

        <View className="flex-row flex-wrap gap-2 mb-4">
          {CATEGORIES.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setCategory(option.id)}
              className={`rounded-full px-4 py-2 border ${
                category === option.id
                  ? 'bg-brand/20 border-brand'
                  : 'bg-white/10 border-white/20'
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  category === option.id ? 'text-brand' : 'text-white'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSaveProduct}
          disabled={
            !productName.trim() ||
            !unitSize.trim() ||
            (!editingId && (!selectedVenueId || !(parsePrice(price) > 0))) ||
            createProduct.isPending ||
            updateProduct.isPending
          }
          className={`rounded-2xl px-6 py-4 items-center ${
            productName.trim() &&
            unitSize.trim() &&
            (editingId || (selectedVenueId && parsePrice(price) > 0))
              ? 'bg-brand'
              : 'bg-white/10'
          }`}
        >
          {createProduct.isPending || updateProduct.isPending ? (
            <ActivityIndicator color="rgba(0, 0, 0, 0.6)" />
          ) : (
            <Text className="text-black font-black text-center">
              {editingId ? 'Guardar alterações' : 'Criar produto'}
            </Text>
          )}
        </Pressable>

        {editingId && (
          <Pressable
            onPress={resetProductForm}
            className="rounded-2xl px-6 py-3 items-center mt-2 bg-white/10 border border-white/20"
          >
            <Text className="text-white font-semibold text-center">Cancelar edição</Text>
          </Pressable>
        )}

        {error && (
          <View className="bg-red-500/20 border border-red-500/40 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-red-300 text-sm">{error}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
