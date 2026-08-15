import type { Product, Round, RoundItem, Consumption } from '../types';
import { splitCents, toEuros, type Cents } from './money';
import { priceAt } from './pricing';

export interface RoundDraftItem {
  productId: string;
  quantity: number;
  consumers: { memberId: string; quantity: number }[];
}

export interface BuildRoundInput {
  sessionId: string;
  roundNumber: number;
  requestedBy: string;
  createdBy: string;
  createdAt: string;
  items: RoundDraftItem[];
  products: Product[];
  notes?: string;
}

export class RoundValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoundValidationError';
  }
}

const EPSILON = 1e-9;

let counter = 0;
const nextId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;

/**
 * Constrói uma ronda validada a partir de um rascunho.
 *
 * Toda a aritmética passa por cêntimos inteiros: o custo de cada artigo é
 * dividido pelos consumidores com splitCents, o que garante que a soma das
 * parcelas iguala o total do artigo ao cêntimo.
 */
export function buildRound(input: BuildRoundInput): Round {
  if (input.items.length === 0) {
    throw new RoundValidationError('ronda tem de ter pelo menos um artigo');
  }

  const roundId = nextId('round');
  let totalCents: Cents = 0;

  const items: RoundItem[] = input.items.map((draft) => {
    const product = input.products.find((p) => p.id === draft.productId);
    if (!product) {
      throw new RoundValidationError(`produto desconhecido: ${draft.productId}`);
    }

    if (draft.quantity <= 0) {
      throw new RoundValidationError(
        `quantidade tem de ser positiva em ${product.name}`,
      );
    }

    if (draft.consumers.length === 0) {
      throw new RoundValidationError(
        `${product.name} tem de ter pelo menos um consumidor`,
      );
    }

    // A soma dos consumidores tem de cobrir, no mínimo, a quantidade pedida do
    // artigo — caso contrário falta alguém por contabilizar. Pode exceder a
    // quantidade (ex.: um shot partilhado onde cada pessoa regista quantidade
    // 1 como peso de divisão): o dinheiro nunca se perde, porque o total do
    // artigo vem sempre de unitCents * draft.quantity, e splitCents distribui
    // esse total pelos pesos indicados, sejam eles quais forem.
    const consumedTotal = draft.consumers.reduce((a, c) => a + c.quantity, 0);
    if (consumedTotal < draft.quantity - EPSILON) {
      throw new RoundValidationError(
        `consumo de ${product.name} soma ${consumedTotal}, mas a quantidade pedida é ${draft.quantity}`,
      );
    }

    const unitCents = priceAt(product, input.createdAt);
    const itemCents = unitCents * draft.quantity;
    totalCents += itemCents;

    const itemId = nextId('ri');
    const shares = splitCents(
      itemCents,
      draft.consumers.map((c) => c.quantity),
    );

    const consumptions: Consumption[] = draft.consumers.map((c, i) => ({
      id: nextId('cons'),
      round_item_id: itemId,
      member_id: c.memberId,
      quantity: c.quantity,
      amount: toEuros(shares[i]),
    }));

    return {
      id: itemId,
      round_id: roundId,
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url,
      quantity: draft.quantity,
      unit_price: toEuros(unitCents),
      total_price: toEuros(itemCents),
      consumptions,
    };
  });

  return {
    id: roundId,
    session_id: input.sessionId,
    round_number: input.roundNumber,
    requested_by: input.requestedBy,
    created_by: input.createdBy,
    created_at: input.createdAt,
    notes: input.notes,
    status: 'active',
    items,
    total_amount: toEuros(totalCents),
  };
}
