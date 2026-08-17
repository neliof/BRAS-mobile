import { createRound, fetchRounds } from '../rounds';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

function roundChain(result: { data: unknown; error: unknown }) {
  return {
    insert: jest.fn(function (this: any) {
      return this;
    }),
    select: jest.fn(function (this: any) {
      return this;
    }),
    single: jest.fn(() => Promise.resolve(result)),
  };
}

/** Cadeia de `insert(...).select()`, que resolve sem `.single()`. */
function bulkInsertChain(result: { data: unknown; error: unknown }) {
  const select = jest.fn(() => Promise.resolve(result));
  return { insert: jest.fn(() => ({ select })), select };
}

const DRAFT = {
  roundNumber: 2,
  requestedBy: 'user-1',
  createdBy: 'user-1',
  items: [
    {
      productId: 'prod-1',
      productName: 'Super Bock',
      quantity: 2,
      unitPrice: 1.5,
      totalPrice: 3,
      consumptions: [
        { memberId: 'user-1', quantity: 1, amount: 1.5 },
        { memberId: 'user-2', quantity: 1, amount: 1.5 },
      ],
    },
  ],
};

describe('createRound', () => {
  it('grava a ronda, os artigos e os consumos em três tabelas', async () => {
    const rounds = roundChain({ data: { id: 'round-1', total_amount: 3 }, error: null });
    const items = bulkInsertChain({
      data: [{ id: 'ri-1', round_id: 'round-1', product_name: 'Super Bock' }],
      error: null,
    });
    const consumption = bulkInsertChain({
      data: [
        { id: 'c-1', round_item_id: 'ri-1', member_id: 'user-1', amount: 1.5 },
        { id: 'c-2', round_item_id: 'ri-1', member_id: 'user-2', amount: 1.5 },
      ],
      error: null,
    });

    from
      .mockReturnValueOnce(rounds)
      .mockReturnValueOnce(items)
      .mockReturnValueOnce(consumption);

    const result = await createRound('sess-1', DRAFT);

    // `rounds` não tem coluna `items`: os artigos são linhas noutra tabela.
    expect(rounds.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ items: expect.anything() }),
    );
    expect(rounds.insert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'sess-1', total_amount: 3 }),
    );

    expect(items.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        round_id: 'round-1',
        product_id: 'prod-1',
        product_name: 'Super Bock',
        quantity: 2,
        unit_price: 1.5,
        total_price: 3,
      }),
    ]);

    expect(consumption.insert).toHaveBeenCalledWith([
      { round_item_id: 'ri-1', member_id: 'user-1', quantity: 1, amount: 1.5 },
      { round_item_id: 'ri-1', member_id: 'user-2', quantity: 1, amount: 1.5 },
    ]);

    expect(result.items[0].consumptions).toHaveLength(2);
  });

  it('apaga a ronda se os artigos falharem', async () => {
    const rounds = roundChain({ data: { id: 'round-1' }, error: null });
    const items = bulkInsertChain({ data: null, error: { message: 'RLS negado' } });
    const deleteEq = jest.fn(() => Promise.resolve({ error: null }));
    const del = { delete: jest.fn(() => ({ eq: deleteEq })) };

    from.mockReturnValueOnce(rounds).mockReturnValueOnce(items).mockReturnValueOnce(del);

    await expect(createRound('sess-1', DRAFT)).rejects.toThrow('RLS negado');
    expect(deleteEq).toHaveBeenCalledWith('id', 'round-1');
  });

  it('apaga a ronda se os consumos falharem', async () => {
    const rounds = roundChain({ data: { id: 'round-1' }, error: null });
    const items = bulkInsertChain({ data: [{ id: 'ri-1' }], error: null });
    const consumption = bulkInsertChain({
      data: null,
      error: { message: 'membro inexistente' },
    });
    const deleteEq = jest.fn(() => Promise.resolve({ error: null }));
    const del = { delete: jest.fn(() => ({ eq: deleteEq })) };

    from
      .mockReturnValueOnce(rounds)
      .mockReturnValueOnce(items)
      .mockReturnValueOnce(consumption)
      .mockReturnValueOnce(del);

    await expect(createRound('sess-1', DRAFT)).rejects.toThrow('membro inexistente');
    expect(deleteEq).toHaveBeenCalledWith('id', 'round-1');
  });
});

describe('fetchRounds', () => {
  it('traz os artigos e os consumos, que não são colunas de rounds', async () => {
    const round = {
      id: 'round-1',
      session_id: 'sess-1',
      items: [{ id: 'ri-1', product_name: 'Super Bock', consumptions: [] }],
    };
    const chain = {
      select: jest.fn(function (this: any) {
        return this;
      }),
      eq: jest.fn(function (this: any) {
        return this;
      }),
      order: jest.fn(() => Promise.resolve({ data: [round], error: null })),
    };
    from.mockReturnValue(chain);

    const result = await fetchRounds('sess-1');

    // Sem o embed, o cartão da ronda mostrava o total e nenhum produto.
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('round_items'));
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('consumption'));
    expect(result[0].items).toHaveLength(1);
  });
});
