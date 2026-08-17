import { supabase } from './supabase';
import type { Round } from '../types';

/**
 * `items` não é coluna de `rounds`: os artigos são linhas em `round_items`, e os
 * consumos linhas em `consumption`. Com um `select('*')` a lista de rondas vinha
 * sem artigos nenhuns e o cartão da ronda mostrava o total sem nunca dizer o que
 * se bebeu.
 *
 * A tabela chama-se `consumption` (singular); o alias mantém a forma que os
 * tipos e o domínio esperam (`item.consumptions`).
 */
const ROUND_SELECT = '*, items:round_items(*, consumptions:consumption(*))';

export async function fetchRounds(sessionId: string): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select(ROUND_SELECT)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchRoundDetails(roundId: string): Promise<Round> {
  const { data, error } = await supabase
    .from('rounds')
    .select(ROUND_SELECT)
    .eq('id', roundId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export interface CreateRoundItem {
  productId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Quem bebeu o quê. Sem isto a dívida de toda a gente fica a zero. */
  consumptions: Array<{
    memberId: string;
    quantity: number;
    amount: number;
  }>;
}

/**
 * Grava uma ronda nas três tabelas que a compõem: `rounds`, `round_items` e
 * `consumption`. Não há coluna `items` em `rounds` — os artigos são linhas.
 *
 * Sem transação do lado do cliente: se um dos passos falhar, apaga-se a ronda,
 * e o `ON DELETE CASCADE` leva atrás os artigos e os consumos já inseridos.
 */
export async function createRound(
  sessionId: string,
  data: {
    roundNumber: number;
    requestedBy: string;
    createdBy: string;
    notes?: string;
    items: CreateRoundItem[];
  }
): Promise<Round> {
  const totalAmount = data.items.reduce((sum, item) => sum + item.totalPrice, 0);

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      session_id: sessionId,
      round_number: data.roundNumber,
      requested_by: data.requestedBy,
      created_by: data.createdBy,
      created_at: new Date().toISOString(),
      notes: data.notes,
      status: 'active',
      total_amount: totalAmount,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const rollback = async (message: string): Promise<never> => {
    await supabase.from('rounds').delete().eq('id', round.id);
    throw new Error(message);
  };

  const { data: insertedItems, error: itemsError } = await supabase
    .from('round_items')
    .insert(
      data.items.map((item) => ({
        round_id: round.id,
        product_id: item.productId,
        product_name: item.productName,
        product_image: item.productImage,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      })),
    )
    .select();

  if (itemsError) return rollback(itemsError.message);

  if (!insertedItems || insertedItems.length !== data.items.length) {
    return rollback('round_items: número de linhas devolvidas não bate com o pedido');
  }

  // A ordem de retorno do insert acompanha a ordem enviada, por isso o índice
  // liga cada artigo gravado ao rascunho que lhe deu origem.
  const consumptionRows = data.items.flatMap((item, index) =>
    item.consumptions.map((consumption) => ({
      round_item_id: insertedItems[index].id,
      member_id: consumption.memberId,
      quantity: consumption.quantity,
      amount: consumption.amount,
    })),
  );

  const { data: insertedConsumptions, error: consumptionError } = await supabase
    .from('consumption')
    .insert(consumptionRows)
    .select();

  if (consumptionError) return rollback(consumptionError.message);

  return {
    ...round,
    items: insertedItems.map((item: { id: string }, index: number) => ({
      ...item,
      consumptions: (insertedConsumptions || []).filter(
        (c: { round_item_id: string }) => c.round_item_id === item.id,
      ),
    })),
  } as Round;
}

export async function cancelRound(
  roundId: string,
  reason?: string
): Promise<Round> {
  const { data: round, error } = await supabase
    .from('rounds')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
    })
    .eq('id', roundId)
    .select(ROUND_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return round;
}

export async function fetchActiveRounds(sessionId: string): Promise<Round[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select(ROUND_SELECT)
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
