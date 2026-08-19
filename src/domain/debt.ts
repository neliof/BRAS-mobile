import type { PaymentMethod, Session } from '../types';
import { toCents, type Cents } from './money';

export interface DebtLine {
  productName: string;
  quantity: number;
  amountCents: Cents;
}

export interface MemberDebt {
  memberId: string;
  /** Rodadas que este membro pediu (não canceladas). */
  roundsRequested: number;
  totalDrinks: number;
  totalCents: Cents;
  breakdown: DebtLine[];
  isPaid: boolean;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
}

/**
 * A conta de um membro numa noite: a soma das rodadas de que foi RESPONSÁVEL.
 *
 * Não há divisão da conta — cada um paga aquilo que pediu na sua rodada. O
 * valor é secundário face ao controlo social ("quem já pediu, quem falta"),
 * mas fica disponível para quem quiser acertar contas.
 *
 * Rodadas canceladas são ignoradas: foram anuladas, e cobrá-las seria cobrar
 * bebidas que ninguém bebeu.
 */
export function computeMemberDebt(session: Session, memberId: string): MemberDebt {
  const lines = new Map<string, DebtLine>();
  let totalCents: Cents = 0;
  let totalDrinks = 0;
  let roundsRequested = 0;

  // Os `?? []` protegem contra sessões vindas de queries sem os embeds: é
  // preferível uma conta a zero do que a app a rebentar num ecrã de lista.
  for (const round of session.rounds ?? []) {
    if (round.status === 'cancelled') continue;
    if (round.requested_by !== memberId) continue;

    roundsRequested += 1;

    for (const item of round.items ?? []) {
      const cents = toCents(item.total_price);
      totalCents += cents;
      totalDrinks += item.quantity;

      const existing = lines.get(item.product_name);
      if (existing) {
        existing.quantity += item.quantity;
        existing.amountCents += cents;
      } else {
        lines.set(item.product_name, {
          productName: item.product_name,
          quantity: item.quantity,
          amountCents: cents,
        });
      }
    }
  }

  const payment = (session.payments ?? []).find((p) => p.member_id === memberId);
  const isPaid = payment?.status === 'paid';

  return {
    memberId,
    roundsRequested,
    totalDrinks,
    totalCents,
    breakdown: [...lines.values()],
    isPaid,
    paymentMethod: isPaid ? payment?.payment_method : undefined,
    paidAt: isPaid ? payment?.paid_at : undefined,
  };
}

/**
 * Totais da noite.
 *
 * A lista de membros é a união dos membros atuais com quem já pediu rodadas:
 * alguém que pediu uma rodada e entretanto saiu da noite continua a constar
 * das contas — a rodada dele aconteceu.
 */
export function computeSessionTotals(session: Session): {
  totalCents: Cents;
  totalDrinks: number;
  perMember: MemberDebt[];
} {
  const memberIds = new Set<string>(session.member_ids ?? []);

  for (const round of session.rounds ?? []) {
    if (round.status === 'cancelled') continue;
    memberIds.add(round.requested_by);
  }

  const perMember = [...memberIds].map((id) => computeMemberDebt(session, id));

  return {
    totalCents: perMember.reduce((sum, m) => sum + m.totalCents, 0),
    totalDrinks: perMember.reduce((sum, m) => sum + m.totalDrinks, 0),
    perMember,
  };
}
