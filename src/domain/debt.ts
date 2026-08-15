import type { PaymentMethod, Session } from '../types';
import { toCents, type Cents } from './money';

export interface DebtLine {
  productName: string;
  quantity: number;
  amountCents: Cents;
}

export interface MemberDebt {
  memberId: string;
  totalDrinks: number;
  totalCents: Cents;
  breakdown: DebtLine[];
  isPaid: boolean;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
}

/**
 * Dívida de um membro numa sessão.
 *
 * Rondas canceladas são ignoradas: foram anuladas, e cobrá-las seria cobrar
 * bebidas que ninguém bebeu.
 */
export function computeMemberDebt(session: Session, memberId: string): MemberDebt {
  const lines = new Map<string, DebtLine>();
  let totalCents: Cents = 0;
  let totalDrinks = 0;

  for (const round of session.rounds) {
    if (round.status === 'cancelled') continue;

    for (const item of round.items) {
      for (const consumption of item.consumptions) {
        if (consumption.member_id !== memberId) continue;

        const cents = toCents(consumption.amount);
        totalCents += cents;
        totalDrinks += consumption.quantity;

        const existing = lines.get(item.product_name);
        if (existing) {
          existing.quantity += consumption.quantity;
          existing.amountCents += cents;
        } else {
          lines.set(item.product_name, {
            productName: item.product_name,
            quantity: consumption.quantity,
            amountCents: cents,
          });
        }
      }
    }
  }

  const payment = session.payments.find((p) => p.member_id === memberId);
  const isPaid = payment?.status === 'paid';

  return {
    memberId,
    totalDrinks,
    totalCents,
    breakdown: [...lines.values()],
    isPaid,
    paymentMethod: isPaid ? payment?.payment_method : undefined,
    paidAt: isPaid ? payment?.paid_at : undefined,
  };
}

/**
 * Totais da sessão.
 *
 * A lista de membros é a união de `member_ids` com quem aparece nos consumos.
 * Alguém que entrou a meio da noite e ainda não foi acrescentado à lista tem
 * de continuar a constar das contas.
 */
export function computeSessionTotals(session: Session): {
  totalCents: Cents;
  totalDrinks: number;
  perMember: MemberDebt[];
} {
  const memberIds = new Set<string>(session.member_ids);

  for (const round of session.rounds) {
    if (round.status === 'cancelled') continue;
    for (const item of round.items) {
      for (const consumption of item.consumptions) {
        memberIds.add(consumption.member_id);
      }
    }
  }

  const perMember = [...memberIds].map((id) => computeMemberDebt(session, id));

  return {
    totalCents: perMember.reduce((sum, m) => sum + m.totalCents, 0),
    totalDrinks: perMember.reduce((sum, m) => sum + m.totalDrinks, 0),
    perMember,
  };
}
