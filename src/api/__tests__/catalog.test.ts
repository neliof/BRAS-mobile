import {
  changeProductPrice,
  createProduct,
  fetchActiveProducts,
  fetchVenues,
} from '../catalog';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

interface QueryChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
}

function mockQuery(result: { data: unknown; error: unknown }) {
  const chain: QueryChain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(result)),
  };
  from.mockReturnValue(chain);
  return chain;
}

beforeEach(() => jest.clearAllMocks());

describe('catalog API', () => {
  it('obtém os venues por nome', async () => {
    const venues = [{ id: 'v1', name: 'Brás', logo_url: '', created_at: 'now' }];
    const chain = mockQuery({ data: venues, error: null });

    await expect(fetchVenues()).resolves.toEqual(venues);

    expect(from).toHaveBeenCalledWith('venues');
    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('obtém apenas produtos ativos e pode filtrar por venue', async () => {
    const products = [
      {
        id: 'p1',
        venue_id: 'v1',
        name: 'Imperial',
        category: 'cerveja',
        unit_size: '0.2L',
        image_url: '',
        current_price: 1.5,
        active: true,
        created_at: 'now',
      },
    ];
    const chain = mockQuery({ data: products, error: null });

    await expect(fetchActiveProducts('v1')).resolves.toEqual(products);

    expect(from).toHaveBeenCalledWith('products');
    expect(chain.eq).toHaveBeenCalledWith('active', true);
    expect(chain.eq).toHaveBeenCalledWith('venue_id', 'v1');
  });

  it('propaga erros do Supabase', async () => {
    mockQuery({ data: null, error: { message: 'sem acesso' } });

    await expect(fetchVenues()).rejects.toThrow('sem acesso');
  });

  it('traz o histórico de preços, que vive noutra tabela', async () => {
    const chain = mockQuery({ data: [], error: null });

    await fetchActiveProducts('v1');

    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('product_prices'));
  });
});

describe('createProduct', () => {
  it('abre a primeira linha do histórico com o preço inicial', async () => {
    const product = { id: 'p1', name: 'Imperial', current_price: 1.5 };
    const products = {
      insert: jest.fn(function (this: any) {
        return this;
      }),
      select: jest.fn(function (this: any) {
        return this;
      }),
      single: jest.fn(() => Promise.resolve({ data: product, error: null })),
    };
    const prices = { insert: jest.fn(() => Promise.resolve({ error: null })) };
    from.mockReturnValueOnce(products).mockReturnValueOnce(prices);

    await expect(
      createProduct({
        venueId: 'v1',
        name: ' Imperial ',
        category: 'cerveja',
        unitSize: '0.2L',
        price: 1.5,
      }),
    ).resolves.toEqual(product);

    expect(products.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Imperial', venue_id: 'v1', current_price: 1.5 }),
    );
    expect(prices.insert).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 'p1', price: 1.5 }),
    );
  });

  it('recusa preço zero ou negativo antes de escrever', async () => {
    const chain = mockQuery({ data: null, error: null });

    await expect(
      createProduct({ venueId: 'v1', name: 'X', category: 'cerveja', unitSize: '0.2L', price: 0 }),
    ).rejects.toThrow(/preço/);

    expect(chain.select).not.toHaveBeenCalled();
  });

  it('apaga o produto se o histórico de preços falhar', async () => {
    const products = {
      insert: jest.fn(function (this: any) {
        return this;
      }),
      select: jest.fn(function (this: any) {
        return this;
      }),
      single: jest.fn(() => Promise.resolve({ data: { id: 'p1' }, error: null })),
    };
    const prices = {
      insert: jest.fn(() => Promise.resolve({ error: { message: 'RLS negado' } })),
    };
    const cleanupEq = jest.fn(() => Promise.resolve({ error: null }));
    const cleanup = { delete: jest.fn(() => ({ eq: cleanupEq })) };

    from
      .mockReturnValueOnce(products)
      .mockReturnValueOnce(prices)
      .mockReturnValueOnce(cleanup);

    await expect(
      createProduct({
        venueId: 'v1',
        name: 'Imperial',
        category: 'cerveja',
        unitSize: '0.2L',
        price: 1.5,
      }),
    ).rejects.toThrow('RLS negado');

    expect(cleanupEq).toHaveBeenCalledWith('id', 'p1');
  });
});

describe('changeProductPrice', () => {
  it('fecha a linha em vigor antes de abrir a nova', async () => {
    const order: string[] = [];

    interface UpdateChain {
      update: jest.Mock;
      eq: jest.Mock;
      is?: jest.Mock;
    }

    const close: UpdateChain = {
      update: jest.fn(() => close),
      eq: jest.fn(() => close),
      is: jest.fn(() => {
        order.push('fecha');
        return Promise.resolve({ error: null });
      }),
    };
    const insert = {
      insert: jest.fn(() => {
        order.push('abre');
        return Promise.resolve({ error: null });
      }),
    };
    const current: UpdateChain = {
      update: jest.fn(() => current),
      eq: jest.fn(() => {
        order.push('current_price');
        return Promise.resolve({ error: null });
      }),
    };

    from
      .mockReturnValueOnce(close)
      .mockReturnValueOnce(insert)
      .mockReturnValueOnce(current);

    await changeProductPrice({ productId: 'p1', price: 2 });

    // O histórico é imutável: alterar a linha antiga apagaria o preço a que as
    // rodadas passadas foram pagas.
    expect(close.is).toHaveBeenCalledWith('valid_to', null);
    expect(order).toEqual(['fecha', 'abre', 'current_price']);
    expect(current.update).toHaveBeenCalledWith({ current_price: 2 });
  });
});
