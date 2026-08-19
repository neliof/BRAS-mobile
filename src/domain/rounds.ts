import type { Product, Round, RoundItem } from '../types';
import { toEuros, type Cents } from './money';
import { priceAt } from './pricing';

/**
 * Uma rodada é um pedido de bebidas feito por um responsável — não uma conta
 * dividida. O número de membros na noite serve de referência para a
 * quantidade, mas o pedido real é o que o responsável decidir: 10 membros
 * podem dar 10 cervejas, ou 8 cervejas e 2 águas, ou outra coisa qualquer.
 */
export interface RoundDraftItem {
  productId: string;
  quantity: number;
}

export interface BuildRoundInput {
  sessionId: string;
  roundNumber: number;
  /** O responsável: quem pediu e quem paga esta rodada. */
  requestedBy: string;
  createdBy: string;
  createdAt: string;
  /** Snapshot dos membros na noite neste momento. Fica congelado na rodada. */
  memberIds: string[];
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

let counter = 0;
const nextId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;

/**
 * Constrói uma rodada validada a partir de um rascunho.
 *
 * O preço fica registado por ser útil ao histórico ("quanto custou a rodada
 * do Nélio"), mas é secundário: a rodada existe para responder a quem pediu,
 * quando, para quantas pessoas e o quê.
 */
export function buildRound(input: BuildRoundInput): Round {
  if (input.items.length === 0) {
    throw new RoundValidationError('a rodada tem de ter pelo menos uma bebida');
  }

  if (!input.requestedBy) {
    throw new RoundValidationError('a rodada tem de ter um responsável');
  }

  const roundId = nextId('round');
  let totalCents: Cents = 0;

  const items: RoundItem[] = input.items.map((draft) => {
    const product = input.products.find((p) => p.id === draft.productId);
    if (!product) {
      throw new RoundValidationError(`produto desconhecido: ${draft.productId}`);
    }

    if (draft.quantity <= 0 || !Number.isInteger(draft.quantity)) {
      throw new RoundValidationError(
        `quantidade tem de ser um inteiro positivo em ${product.name}`,
      );
    }

    const unitCents = priceAt(product, input.createdAt);
    const itemCents = unitCents * draft.quantity;
    totalCents += itemCents;

    return {
      id: nextId('ri'),
      round_id: roundId,
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url,
      quantity: draft.quantity,
      unit_price: toEuros(unitCents),
      total_price: toEuros(itemCents),
      consumptions: [],
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
    member_count: input.memberIds.length,
    member_ids: [...input.memberIds],
  };
}

/** Total de bebidas de uma rodada — a soma das quantidades dos artigos. */
export function totalDrinks(round: Round): number {
  return (round.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Quantas rodadas cada membro ativo já pediu (canceladas não contam).
 * Devolve todos os membros ativos, incluindo os que ainda vão a zero — o
 * ecrã precisa de mostrar "quem ainda não pediu", não só quem já pediu.
 */
export function roundsPerMember(
  rounds: Round[],
  activeMemberIds: string[],
): Map<string, number> {
  const counts = new Map<string, number>(activeMemberIds.map((id) => [id, 0]));

  for (const round of rounds) {
    if (round.status === 'cancelled') continue;
    counts.set(round.requested_by, (counts.get(round.requested_by) ?? 0) + 1);
  }

  return counts;
}

/**
 * Sugere o próximo responsável: de entre os membros ATUALMENTE na noite, quem
 * tem menos rodadas pedidas; em empate, quem está há mais tempo sem pedir
 * (nunca pediu > pediu há mais rodadas). Quando todos já pediram, o ciclo
 * recomeça naturalmente — toda a gente volta a estar empatada em contagem.
 *
 * É uma sugestão, nunca uma regra: o ecrã deixa escolher outro responsável, e
 * a rodada regista quem realmente pediu.
 */
export function nextResponsible(
  rounds: Round[],
  activeMemberIds: string[],
): string | null {
  if (activeMemberIds.length === 0) return null;

  const counts = roundsPerMember(rounds, activeMemberIds);

  // Posição da última rodada de cada um; quem nunca pediu fica em -1 e ganha
  // qualquer desempate.
  const lastIndex = new Map<string, number>(activeMemberIds.map((id) => [id, -1]));
  const ordered = [...rounds]
    .filter((r) => r.status !== 'cancelled')
    .sort((a, b) => a.round_number - b.round_number);
  ordered.forEach((round, index) => {
    if (lastIndex.has(round.requested_by)) lastIndex.set(round.requested_by, index);
  });

  return [...activeMemberIds].sort((a, b) => {
    const byCount = (counts.get(a) ?? 0) - (counts.get(b) ?? 0);
    if (byCount !== 0) return byCount;
    return (lastIndex.get(a) ?? -1) - (lastIndex.get(b) ?? -1);
  })[0];
}

/**
 * Adapta as quantidades da rodada anterior ao número atual de membros, para o
 * "repetir rodada anterior": 10 cervejas para 10 membros viram 8 cervejas
 * quando restam 8. Proporcional e arredondado; artigos que caiam a zero saem.
 * O utilizador ajusta à vontade antes de registar — isto é só o ponto de
 * partida.
 */
export function scaleQuantities(
  previousItems: { productId: string; quantity: number }[],
  previousMemberCount: number,
  currentMemberCount: number,
): RoundDraftItem[] {
  if (previousMemberCount <= 0 || currentMemberCount <= 0) {
    return previousItems.map(({ productId, quantity }) => ({ productId, quantity }));
  }

  const factor = currentMemberCount / previousMemberCount;

  return previousItems
    .map(({ productId, quantity }) => ({
      productId,
      quantity: Math.round(quantity * factor),
    }))
    .filter((item) => item.quantity > 0);
}
