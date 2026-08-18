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
/** Código do Postgres para violação de restrição única. */
const UNIQUE_VIOLATION = '23505';

/** Tentativas antes de desistir de encontrar um número livre. */
const NUMBER_ATTEMPTS = 5;

async function nextRoundNumber(sessionId: string): Promise<number> {
  const { data, error } = await supabase
    .from('rounds')
    .select('round_number')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return ((data?.[0]?.round_number as number | undefined) ?? 0) + 1;
}

export async function createRound(
  sessionId: string,
  data: {
    requestedBy: string;
    createdBy: string;
    notes?: string;
    items: CreateRoundItem[];
  }
): Promise<Round> {
  const totalAmount = data.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // O número vem do servidor, não da lista que o telemóvel tem em cache: dois
  // dispositivos na mesma noite — ou dois a esvaziar a fila offline — chegavam
  // ambos ao mesmo `rounds.length + 1`. A restrição `rounds_session_number_unique`
  // (migração 0006) recusa o segundo, e a tentativa seguinte já lê o número novo.
  let round: { id: string } | null = null;
  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < NUMBER_ATTEMPTS && !round; attempt += 1) {
    const roundNumber = await nextRoundNumber(sessionId);

    const { data: inserted, error } = await supabase
      .from('rounds')
      .insert({
        session_id: sessionId,
        round_number: roundNumber,
        requested_by: data.requestedBy,
        created_by: data.createdBy,
        created_at: new Date().toISOString(),
        notes: data.notes,
        status: 'active',
        total_amount: totalAmount,
      })
      .select()
      .single();

    if (!error) {
      round = inserted;
      break;
    }

    lastError = error;
    if (error.code !== UNIQUE_VIOLATION) break;
  }

  if (!round) {
    throw new Error(
      lastError?.message ?? 'createRound: não foi possível numerar a ronda',
    );
  }

  const created = round;

  const rollback = async (message: string): Promise<never> => {
    await supabase.from('rounds').delete().eq('id', created.id);
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
