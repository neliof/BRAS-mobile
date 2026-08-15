import { computeMemberDebt, computeSessionTotals } from '../debt';
import {
  makeSession, makeRound, makeRoundItem, makeConsumption, makePayment,
} from './fixtures';

function sessionWithRounds(...rounds: ReturnType<typeof makeRound>[]) {
  return makeSession({ member_ids: ['a', 'b'], rounds });
}

describe('computeMemberDebt', () => {
  it('soma apenas o que o membro consumiu', () => {
    const session = sessionWithRounds(
      makeRound({
        items: [
          makeRoundItem({
            product_name: 'Imperial',
            quantity: 2,
            consumptions: [
              makeConsumption({ member_id: 'a', quantity: 1, amount: 1.2 }),
              makeConsumption({ member_id: 'b', quantity: 1, amount: 1.2 }),
            ],
          }),
        ],
      }),
    );

    const debt = computeMemberDebt(session, 'a');
    expect(debt.totalCents).toBe(120);
    expect(debt.totalDrinks).toBe(1);
  });

  it('agrega várias linhas do mesmo produto numa só', () => {
    const session = sessionWithRounds(
      makeRound({
        items: [
          makeRoundItem({
            product_name: 'Imperial', quantity: 1,
            consumptions: [makeConsumption({ member_id: 'a', quantity: 1, amount: 1.2 })],
          }),
        ],
      }),
      makeRound({
        round_number: 2,
        items: [
          makeRoundItem({
            product_name: 'Imperial', quantity: 1,
            consumptions: [makeConsumption({ member_id: 'a', quantity: 1, amount: 1.2 })],
          }),
        ],
      }),
    );

    const debt = computeMemberDebt(session, 'a');
    expect(debt.breakdown).toEqual([
      { productName: 'Imperial', quantity: 2, amountCents: 240 },
    ]);
    expect(debt.totalCents).toBe(240);
  });

  it('ignora rondas canceladas', () => {
    const session = sessionWithRounds(
      makeRound({
        status: 'cancelled',
        cancellation_reason: 'pedido errado',
        items: [
          makeRoundItem({
            consumptions: [makeConsumption({ member_id: 'a', quantity: 1, amount: 5.0 })],
          }),
        ],
      }),
    );

    expect(computeMemberDebt(session, 'a').totalCents).toBe(0);
  });

  it('devolve zero para um membro que não consumiu nada', () => {
    const session = sessionWithRounds(
      makeRound({
        items: [
          makeRoundItem({
            consumptions: [makeConsumption({ member_id: 'a', quantity: 1, amount: 1.2 })],
          }),
        ],
      }),
    );

    const debt = computeMemberDebt(session, 'chegou-tarde');
    expect(debt.totalCents).toBe(0);
    expect(debt.breakdown).toEqual([]);
    expect(debt.isPaid).toBe(false);
  });

  it('reflete o pagamento registado', () => {
    const session = makeSession({
      rounds: [
        makeRound({
          items: [
            makeRoundItem({
              consumptions: [makeConsumption({ member_id: 'a', quantity: 1, amount: 1.2 })],
            }),
          ],
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
  it('a soma das dívidas individuais iguala o total da sessão', () => {
    // 1,00 € dividido por 3 dá 34 + 33 + 33. O total tem de continuar 100.
    const session = makeSession({
      member_ids: ['a', 'b', 'c'],
      rounds: [
        makeRound({
          items: [
            makeRoundItem({
              product_name: 'Shot', quantity: 1, total_price: 1.0,
              consumptions: [
                makeConsumption({ member_id: 'a', quantity: 1, amount: 0.34 }),
                makeConsumption({ member_id: 'b', quantity: 1, amount: 0.33 }),
                makeConsumption({ member_id: 'c', quantity: 1, amount: 0.33 }),
              ],
            }),
          ],
        }),
      ],
    });

    const totals = computeSessionTotals(session);
    expect(totals.totalCents).toBe(100);
    expect(totals.perMember.reduce((a, m) => a + m.totalCents, 0)).toBe(100);
  });

  it('inclui membros da sessão que não consumiram', () => {
    const session = makeSession({ member_ids: ['a', 'b'], rounds: [] });
    const totals = computeSessionTotals(session);

    expect(totals.perMember).toHaveLength(2);
    expect(totals.totalCents).toBe(0);
  });

  it('inclui quem consumiu mesmo sem constar em member_ids', () => {
    // Alguém que entrou a meio da noite e ainda não foi adicionado à lista
    // não pode desaparecer das contas.
    const session = makeSession({
      member_ids: ['a'],
      rounds: [
        makeRound({
          items: [
            makeRoundItem({
              consumptions: [
                makeConsumption({ member_id: 'tardio', quantity: 1, amount: 1.2 }),
              ],
            }),
          ],
        }),
      ],
    });

    const totals = computeSessionTotals(session);
    const ids = totals.perMember.map((m) => m.memberId).sort();
    expect(ids).toEqual(['a', 'tardio']);
    expect(totals.totalCents).toBe(120);
  });
});
