import { createRound, deleteRound, fetchRounds, updateRound } from '../rounds';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` limpa as chamadas mas não a fila do `mockReturnValueOnce`:
  // um valor que um teste enfileirou e não chegou a consumir aparecia no teste
  // seguinte, que falhava por causa do anterior.
  from.mockReset();
});

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

/**
 * `createRound` lê primeiro o número mais alto da noite. Esta cadeia responde a
 * essa leitura; `last` é o número já gravado, ou `undefined` para noite vazia.
 */
interface NumberChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
}

function numberChain(last?: number) {
  const chain: NumberChain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() =>
      Promise.resolve({
        data: last === undefined ? [] : [{ round_number: last }],
        error: null,
      }),
    ),
  };
  return chain;
}

/** Cadeia de `insert(...).select()`, que resolve sem `.single()`. */
function bulkInsertChain(result: { data: unknown; error: unknown }) {
  const select = jest.fn(() => Promise.resolve(result));
  return { insert: jest.fn(() => ({ select })), select };
}

const DRAFT = {
  requestedBy: 'user-1',
  createdBy: 'user-1',
  memberIds: ['user-1', 'user-2', 'user-3'],
  items: [
    {
      productId: 'prod-1',
      productName: 'Super Bock',
      quantity: 3,
      unitPrice: 1.5,
      totalPrice: 4.5,
    },
  ],
};

describe('createRound', () => {
  it('grava a rodada e os artigos, sem tocar em consumption', async () => {
    const rounds = roundChain({ data: { id: 'round-1', total_amount: 4.5 }, error: null });
    const items = bulkInsertChain({
      data: [{ id: 'ri-1', round_id: 'round-1', product_name: 'Super Bock' }],
      error: null,
    });

    from.mockReturnValueOnce(numberChain(2)).mockReturnValueOnce(rounds).mockReturnValueOnce(items);

    const result = await createRound('sess-1', DRAFT);

    // O número vem da noite que está no servidor, não da lista em cache.
    expect(rounds.insert).toHaveBeenCalledWith(
      expect.objectContaining({ round_number: 3 }),
    );

    // `rounds` não tem coluna `items`: os artigos são linhas noutra tabela.
    expect(rounds.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ items: expect.anything() }),
    );
    expect(rounds.insert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'sess-1', total_amount: 4.5 }),
    );

    expect(items.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        round_id: 'round-1',
        product_id: 'prod-1',
        product_name: 'Super Bock',
        quantity: 3,
        unit_price: 1.5,
        total_price: 4.5,
      }),
    ]);

    // Uma rodada não se divide pelos presentes: `consumption` já não é
    // escrita, e `from` só é chamado três vezes (número, rodada, artigos).
    expect(from).toHaveBeenCalledTimes(3);
    expect(result.items[0].consumptions).toEqual([]);
  });

  it('congela o snapshot dos membros na rodada', async () => {
    const rounds = roundChain({ data: { id: 'round-1' }, error: null });
    const items = bulkInsertChain({ data: [{ id: 'ri-1' }], error: null });

    from.mockReturnValueOnce(numberChain()).mockReturnValueOnce(rounds).mockReturnValueOnce(items);

    await createRound('sess-1', DRAFT);

    // As rodadas antigas têm de continuar a mostrar quantos eram na altura,
    // mesmo que os membros da noite mudem depois.
    expect(rounds.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 3,
        member_ids: ['user-1', 'user-2', 'user-3'],
      }),
    );
  });

  it('apaga a rodada se os artigos falharem', async () => {
    const rounds = roundChain({ data: { id: 'round-1' }, error: null });
    const items = bulkInsertChain({ data: null, error: { message: 'RLS negado' } });
    const deleteEq = jest.fn(() => Promise.resolve({ error: null }));
    const del = { delete: jest.fn(() => ({ eq: deleteEq })) };

    from
      .mockReturnValueOnce(numberChain())
      .mockReturnValueOnce(rounds)
      .mockReturnValueOnce(items)
      .mockReturnValueOnce(del);

    await expect(createRound('sess-1', DRAFT)).rejects.toThrow('RLS negado');
    expect(deleteEq).toHaveBeenCalledWith('id', 'round-1');
  });

  it('numera a partir de 1 numa noite sem rodadas', async () => {
    const rounds = roundChain({ data: { id: 'round-1' }, error: null });
    const items = bulkInsertChain({ data: [{ id: 'ri-1' }], error: null });

    from.mockReturnValueOnce(numberChain()).mockReturnValueOnce(rounds).mockReturnValueOnce(items);

    await createRound('sess-1', DRAFT);

    expect(rounds.insert).toHaveBeenCalledWith(
      expect.objectContaining({ round_number: 1 }),
    );
  });

  it('volta a numerar se outro dispositivo apanhou o número primeiro', async () => {
    const colidido = roundChain({
      data: null,
      error: { message: 'duplicate key', code: '23505' },
    });
    const aceite = roundChain({ data: { id: 'round-2' }, error: null });
    const items = bulkInsertChain({ data: [{ id: 'ri-1' }], error: null });

    from
      .mockReturnValueOnce(numberChain(2))
      .mockReturnValueOnce(colidido)
      .mockReturnValueOnce(numberChain(3))
      .mockReturnValueOnce(aceite)
      .mockReturnValueOnce(items);

    const result = await createRound('sess-1', DRAFT);

    expect(colidido.insert).toHaveBeenCalledWith(
      expect.objectContaining({ round_number: 3 }),
    );
    expect(aceite.insert).toHaveBeenCalledWith(
      expect.objectContaining({ round_number: 4 }),
    );
    expect(result.id).toBe('round-2');
  });

  it('não repete quando o erro não é de número repetido', async () => {
    const recusado = roundChain({
      data: null,
      error: { message: 'RLS negado', code: '42501' },
    });

    from.mockReturnValueOnce(numberChain(1)).mockReturnValueOnce(recusado);

    await expect(createRound('sess-1', DRAFT)).rejects.toThrow('RLS negado');
    expect(recusado.insert).toHaveBeenCalledTimes(1);
  });
});

const EDIT = {
  requestedBy: 'user-2',
  memberIds: ['user-1', 'user-2'],
  items: [
    {
      productId: 'prod-1',
      productName: 'Super Bock',
      quantity: 2,
      unitPrice: 1.5,
      totalPrice: 3,
    },
  ],
};

/** `select('id').eq('round_id', ...)` — os artigos que já lá estão. */
function oldItemsChain(ids: string[]) {
  const chain: { select: jest.Mock; eq: jest.Mock } = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => Promise.resolve({ data: ids.map((id) => ({ id })), error: null })),
  };
  return chain;
}

function insertChain(error: { message: string } | null = null) {
  return { insert: jest.fn(() => Promise.resolve({ error })) };
}

function deleteInChain(error: { message: string } | null = null) {
  const inFn = jest.fn(() => Promise.resolve({ error }));
  return { delete: jest.fn(() => ({ in: inFn })), in: inFn };
}

function updateEqChain(error: { message: string } | null = null) {
  const eq = jest.fn(() => Promise.resolve({ error }));
  return { update: jest.fn(() => ({ eq })), eq };
}

describe('updateRound', () => {
  it('grava as bebidas novas antes de apagar as antigas', async () => {
    const olds = oldItemsChain(['ri-old-1', 'ri-old-2']);
    const inserted = insertChain();
    const removed = deleteInChain();
    const updated = updateEqChain();

    from
      .mockReturnValueOnce(olds)
      .mockReturnValueOnce(inserted)
      .mockReturnValueOnce(removed)
      .mockReturnValueOnce(updated);

    await updateRound('round-1', EDIT);

    // A ordem é a garantia: sem transação, uma falha a meio tem de deixar
    // bebidas a mais e nunca uma rodada vazia.
    const insertOrder = inserted.insert.mock.invocationCallOrder[0];
    const deleteOrder = removed.in.mock.invocationCallOrder[0];
    expect(insertOrder).toBeLessThan(deleteOrder);
    expect(removed.in).toHaveBeenCalledWith('id', ['ri-old-1', 'ri-old-2']);
  });

  it('atualiza responsável, snapshot e total', async () => {
    const updated = updateEqChain();

    from
      .mockReturnValueOnce(oldItemsChain([]))
      .mockReturnValueOnce(insertChain())
      .mockReturnValueOnce(updated);

    await updateRound('round-1', EDIT);

    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({
        requested_by: 'user-2',
        member_count: 2,
        member_ids: ['user-1', 'user-2'],
        total_amount: 3,
      }),
    );
  });

  it('não toca no número nem na hora da rodada', async () => {
    const updated = updateEqChain();

    from
      .mockReturnValueOnce(oldItemsChain([]))
      .mockReturnValueOnce(insertChain())
      .mockReturnValueOnce(updated);

    await updateRound('round-1', EDIT);

    // A posição no histórico e a hora a que aconteceu são o que aconteceu.
    expect(updated.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ round_number: expect.anything() }),
    );
    expect(updated.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ created_at: expect.anything() }),
    );
  });

  it('deixa a rodada intacta se as bebidas novas falharem', async () => {
    const removed = deleteInChain();

    from
      .mockReturnValueOnce(oldItemsChain(['ri-old-1']))
      .mockReturnValueOnce(insertChain({ message: 'RLS negado' }))
      .mockReturnValueOnce(removed);

    await expect(updateRound('round-1', EDIT)).rejects.toThrow('RLS negado');
    expect(removed.delete).not.toHaveBeenCalled();
  });

  it('recusa uma rodada sem bebidas', async () => {
    await expect(
      updateRound('round-1', { ...EDIT, items: [] }),
    ).rejects.toThrow('pelo menos uma bebida');
    expect(from).not.toHaveBeenCalled();
  });
});

describe('deleteRound', () => {
  it('apaga a rodada', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null, count: 1 }));
    const chain = { delete: jest.fn(() => ({ eq })) };
    from.mockReturnValueOnce(chain);

    await deleteRound('round-1');

    expect(chain.delete).toHaveBeenCalledWith({ count: 'exact' });
    expect(eq).toHaveBeenCalledWith('id', 'round-1');
  });

  it('avisa quando não apagou nada', async () => {
    // Zero linhas sem erro: outro telemóvel apagou-a primeiro.
    const eq = jest.fn(() => Promise.resolve({ error: null, count: 0 }));
    from.mockReturnValueOnce({ delete: jest.fn(() => ({ eq })) });

    await expect(deleteRound('round-1')).rejects.toThrow('já não existe');
  });
});

describe('fetchRounds', () => {
  it('traz os artigos, que não são colunas de rounds', async () => {
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

    // Sem o embed, o cartão da rodada mostrava o total e nenhum produto.
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('round_items'));
    expect(result[0].items).toHaveLength(1);
  });
});
