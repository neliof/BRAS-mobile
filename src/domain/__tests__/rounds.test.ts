import { buildRound, RoundValidationError } from '../rounds';
import { makeProduct } from './fixtures';

const base = {
  sessionId: 'sess-1',
  roundNumber: 1,
  requestedBy: 'prof-joao',
  createdBy: 'prof-joao',
  createdAt: '2026-08-15T21:00:00Z',
};

describe('buildRound', () => {
  it('calcula o total do artigo a partir do preço à data', () => {
    const imperial = makeProduct({ id: 'p-imp', current_price: 1.2 });

    const round = buildRound({
      ...base,
      products: [imperial],
      items: [
        {
          productId: 'p-imp',
          quantity: 3,
          consumers: [
            { memberId: 'a', quantity: 1 },
            { memberId: 'b', quantity: 1 },
            { memberId: 'c', quantity: 1 },
          ],
        },
      ],
    });

    expect(round.items[0].unit_price).toBe(1.2);
    expect(round.items[0].total_price).toBe(3.6);
    expect(round.total_amount).toBe(3.6);
  });

  it('divide o custo pelos consumidores sem perder cêntimos', () => {
    // 1 unidade a 1,00 € partilhada por 3 pessoas: 34 + 33 + 33 = 100.
    const shot = makeProduct({ id: 'p-shot', current_price: 1.0 });

    const round = buildRound({
      ...base,
      products: [shot],
      items: [
        {
          productId: 'p-shot',
          quantity: 1,
          consumers: [
            { memberId: 'a', quantity: 1 },
            { memberId: 'b', quantity: 1 },
            { memberId: 'c', quantity: 1 },
          ],
        },
      ],
    });

    const amounts = round.items[0].consumptions.map((c) => c.amount);
    expect(amounts).toEqual([0.34, 0.33, 0.33]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 10);
  });

  it('aceita quantidades fracionárias por consumidor', () => {
    const caneca = makeProduct({ id: 'p-can', current_price: 2.0 });

    const round = buildRound({
      ...base,
      products: [caneca],
      items: [
        {
          productId: 'p-can',
          quantity: 1,
          consumers: [
            { memberId: 'a', quantity: 0.5 },
            { memberId: 'b', quantity: 0.5 },
          ],
        },
      ],
    });

    expect(round.items[0].consumptions.map((c) => c.amount)).toEqual([1.0, 1.0]);
  });

  it('recusa quando os consumidores não somam a quantidade do artigo', () => {
    const imperial = makeProduct({ id: 'p-imp' });

    expect(() =>
      buildRound({
        ...base,
        products: [imperial],
        items: [
          {
            productId: 'p-imp',
            quantity: 3,
            consumers: [{ memberId: 'a', quantity: 1 }],
          },
        ],
      }),
    ).toThrow(RoundValidationError);
  });

  it('recusa uma ronda sem artigos', () => {
    expect(() =>
      buildRound({ ...base, products: [], items: [] }),
    ).toThrow('ronda tem de ter pelo menos um artigo');
  });

  it('recusa um artigo sem consumidores', () => {
    const imperial = makeProduct({ id: 'p-imp' });

    expect(() =>
      buildRound({
        ...base,
        products: [imperial],
        items: [{ productId: 'p-imp', quantity: 1, consumers: [] }],
      }),
    ).toThrow('tem de ter pelo menos um consumidor');
  });

  it('recusa um produto desconhecido', () => {
    expect(() =>
      buildRound({
        ...base,
        products: [],
        items: [
          {
            productId: 'p-fantasma',
            quantity: 1,
            consumers: [{ memberId: 'a', quantity: 1 }],
          },
        ],
      }),
    ).toThrow('produto desconhecido: p-fantasma');
  });

  it('nasce com estado ativo', () => {
    const imperial = makeProduct({ id: 'p-imp' });
    const round = buildRound({
      ...base,
      products: [imperial],
      items: [
        {
          productId: 'p-imp',
          quantity: 1,
          consumers: [{ memberId: 'a', quantity: 1 }],
        },
      ],
    });

    expect(round.status).toBe('active');
  });
});
