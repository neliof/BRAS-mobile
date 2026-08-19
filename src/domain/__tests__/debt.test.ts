import { computeMemberDebt, computeSessionTotals } from '../debt';
import { makeSession, makeRound, makeRoundItem, makePayment } from './fixtures';

function sessionWithRounds(...rounds: ReturnType<typeof makeRound>[]) {
  return makeSession({ member_ids: ['a', 'b'], rounds });
}

describe('computeMemberDebt', () => {
  it('soma apenas as rodadas de que o membro foi responsável', () => {
    const session = sessionWithRounds(
      makeRound({
        requested_by: 'a',
        items: [
          makeRoundItem({ product_name: 'Imperial', quantity: 2, total_price: 2.4 }),
        ],
      }),
      makeRound({
        round_number: 2,
        requested_by: 'b',
        items: [
          makeRoundItem({ product_name: 'Imperial', quantity: 3, total_price: 3.6 }),
        ],
      }),
    );

    const debt = computeMemberDebt(session, 'a');
    expect(debt.totalCents).toBe(240);
    expect(debt.totalDrinks).toBe(2);
    expect(debt.roundsRequested).toBe(1);
  });

  it('não divide a rodada pelos presentes — o responsável paga tudo', () => {
    // Rodada de 10 bebidas com 10 membros na noite: a conta é toda de quem
    // pediu, não 1/10 para cada um.
    const session = makeSession({
      member_ids: ['a', 'b', 'c'],
      rounds: [
        makeRound({
          requested_by: 'a',
          member_count: 10,
          items: [
            makeRoundItem({ product_name: 'Imperial', quantity: 10, total_price: 12.0 }),
          ],
        }),
      ],
    });

    expect(computeMemberDebt(session, 'a').totalCents).toBe(1200);
    expect(computeMemberDebt(session, 'b').totalCents).toBe(0);
  });

  it('agrega o mesmo produto de várias rodadas numa só linha', () => {
    const session = sessionWithRounds(
      makeRound({
        requested_by: 'a',
        items: [makeRoundItem({ product_name: 'Imperial', quantity: 1, total_price: 1.2 })],
      }),
      makeRound({
        round_number: 2,
        requested_by: 'a',
        items: [makeRoundItem({ product_name: 'Imperial', quantity: 1, total_price: 1.2 })],
      }),
    );

    const debt = computeMemberDebt(session, 'a');
    expect(debt.breakdown).toEqual([
      { productName: 'Imperial', quantity: 2, amountCents: 240 },
    ]);
    expect(debt.roundsRequested).toBe(2);
  });

  it('ignora rodadas canceladas', () => {
    const session = sessionWithRounds(
      makeRound({
        requested_by: 'a',
        status: 'cancelled',
        cancellation_reason: 'pedido errado',
        items: [makeRoundItem({ total_price: 5.0 })],
      }),
    );

    expect(computeMemberDebt(session, 'a').totalCents).toBe(0);
  });

  it('devolve zero para um membro que ainda não pediu nenhuma rodada', () => {
    const session = sessionWithRounds(
      makeRound({
        requested_by: 'a',
        items: [makeRoundItem({ total_price: 1.2 })],
      }),
    );

    const debt = computeMemberDebt(session, 'b');
    expect(debt.totalCents).toBe(0);
    expect(debt.roundsRequested).toBe(0);
    expect(debt.breakdown).toEqual([]);
    expect(debt.isPaid).toBe(false);
  });

  it('reflete o pagamento registado', () => {
    const session = makeSession({
      rounds: [
        makeRound({
          requested_by: 'a',
          items: [makeRoundItem({ total_price: 1.2 })],
        }),
      ],
      payments: [
        makePayment({
          member_id: 'a', amount: 1.2, status: 'paid',
          payment_method: 'mbway', paid_at: '2026-08-16T01:00:00Z',
        }),
      ],
    });

    const debt = computeMemberDebt(session, 'a');
    expect(debt.isPaid).toBe(true);
    expect(debt.paymentMethod).toBe('mbway');
    expect(debt.paidAt).toBe('2026-08-16T01:00:00Z');
  });

  it('não marca como pago um pagamento ainda pendente', () => {
    const session = makeSession({
      rounds: [],
      payments: [makePayment({ member_id: 'a', amount: 1.2, status: 'pending' })],
    });

    expect(computeMemberDebt(session, 'a').isPaid).toBe(false);
  });
});

describe('computeSessionTotals', () => {
  it('a soma das contas individuais iguala o total da noite', () => {
    const session = makeSession({
      member_ids: ['a', 'b', 'c'],
      rounds: [
        makeRound({
          requested_by: 'a',
          items: [makeRoundItem({ product_name: 'Imperial', quantity: 3, total_price: 3.6 })],
        }),
        makeRound({
          round_number: 2,
          requested_by: 'b',
          items: [makeRoundItem({ product_name: 'Imperial', quantity: 3, total_price: 3.6 })],
        }),
      ],
    });

    const totals = computeSessionTotals(session);
    expect(totals.totalCents).toBe(720);
    expect(totals.perMember.reduce((a, m) => a + m.totalCents, 0)).toBe(720);
  });

  it('inclui membros da noite que ainda não pediram', () => {
    const session = makeSession({ member_ids: ['a', 'b'], rounds: [] });
    const totals = computeSessionTotals(session);

    expect(totals.perMember).toHaveLength(2);
    expect(totals.totalCents).toBe(0);
  });

  it('inclui quem pediu uma rodada e entretanto saiu da noite', () => {
    // A rodada dele aconteceu — a conta não desaparece com a saída.
    const session = makeSession({
      member_ids: ['a'],
      rounds: [
        makeRound({
          requested_by: 'foi-embora',
          items: [makeRoundItem({ total_price: 1.2 })],
        }),
      ],
    });

    const totals = computeSessionTotals(session);
    const ids = totals.perMember.map((m) => m.memberId).sort();
    expect(ids).toEqual(['a', 'foi-embora']);
    expect(totals.totalCents).toBe(120);
  });
});
