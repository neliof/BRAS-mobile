import { supabase } from './supabase';
import type { Product, Venue } from '../types';

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * `price_history` não é coluna de `products`: é a tabela `product_prices`. Sem
 * o embed, `priceAt` caía sempre no `current_price` e uma ronda antiga era
 * recalculada ao preço de hoje.
 */
const PRODUCT_SELECT = '*, price_history:product_prices(*)';

export async function fetchActiveProducts(venueId?: string): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('active', true);

  if (venueId) {
    query = query.eq('venue_id', venueId);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Cria um bar. Só um administrador passa `venues_write_admin`.
 */
export async function createVenue(input: { name: string; address?: string }): Promise<Venue> {
  const name = input.name.trim();
  if (!name) throw new Error('createVenue: o nome é obrigatório');

  const { data, error } = await supabase
    .from('venues')
    .insert({ name, address: input.address?.trim() || undefined })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Cria um produto e abre a primeira linha do histórico de preços.
 *
 * `current_price` é conveniência de leitura; a verdade é `product_prices`, que
 * é imutável. Se a linha de preço falhar, o produto é apagado: um produto sem
 * histórico aparece na lista e mente sobre o preço em qualquer ronda antiga.
 */
export async function createProduct(input: {
  venueId: string;
  name: string;
  category: Product['category'];
  unitSize: string;
  price: number;
}): Promise<Product> {
  const name = input.name.trim();
  if (!name) throw new Error('createProduct: o nome é obrigatório');
  if (!(input.price > 0)) throw new Error('createProduct: o preço tem de ser positivo');

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      venue_id: input.venueId,
      name,
      category: input.category,
      unit_size: input.unitSize.trim(),
      current_price: input.price,
      active: true,
      image_url: '',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { error: priceError } = await supabase.from('product_prices').insert({
    product_id: product.id,
    price: input.price,
    valid_from: new Date().toISOString(),
  });

  if (priceError) {
    await supabase.from('products').delete().eq('id', product.id);
    throw new Error(priceError.message);
  }

  return product;
}

/**
 * Altera o preço de um produto sem tocar no passado.
 *
 * Fecha a linha em vigor com `valid_to`, abre uma nova a partir do mesmo
 * instante e só depois atualiza o `current_price`. Por esta ordem porque uma
 * falha a meio deixa o histórico coerente: o pior caso é o `current_price` ficar
 * atrasado, e é dele que ninguém depende para contas antigas.
 */
export async function changeProductPrice(input: {
  productId: string;
  price: number;
}): Promise<void> {
  if (!(input.price > 0)) {
    throw new Error('changeProductPrice: o preço tem de ser positivo');
  }

  const changedAt = new Date().toISOString();

  const { error: closeError } = await supabase
    .from('product_prices')
    .update({ valid_to: changedAt })
    .eq('product_id', input.productId)
    .is('valid_to', null);

  if (closeError) throw new Error(closeError.message);

  const { error: insertError } = await supabase.from('product_prices').insert({
    product_id: input.productId,
    price: input.price,
    valid_from: changedAt,
  });

  if (insertError) throw new Error(insertError.message);

  const { error: productError } = await supabase
    .from('products')
    .update({ current_price: input.price })
    .eq('id', input.productId);

  if (productError) throw new Error(productError.message);
}

/**
 * Desativa um produto. Apagar levaria atrás o histórico de preços por
 * `ON DELETE CASCADE` e as rondas antigas perdiam o preço a que foram pagas.
 */
export async function deactivateProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ active: false })
    .eq('id', productId);

  if (error) throw new Error(error.message);
}
