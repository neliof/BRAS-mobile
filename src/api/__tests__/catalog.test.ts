import { fetchActiveProducts, fetchVenues } from '../catalog';
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
});
