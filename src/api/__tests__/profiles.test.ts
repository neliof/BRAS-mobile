import { fetchGroupProfiles } from '../profiles';
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

describe('fetchGroupProfiles', () => {
  it('devolve apenas os membros ativos do grupo, por nome', async () => {
    const chain = mockQuery({
      data: [
        { profiles: { id: 'p1', name: 'Ana', active: true, role: 'member' } },
        { profiles: { id: 'p2', name: 'Bruno', active: true, role: 'admin' } },
      ],
      error: null,
    });

    const profiles = await fetchGroupProfiles('g1');

    expect(from).toHaveBeenCalledWith('group_members');
    expect(chain.eq).toHaveBeenCalledWith('group_id', 'g1');
    expect(profiles.map((p) => p.name)).toEqual(['Ana', 'Bruno']);
  });

  it('descarta linhas sem perfil associado', async () => {
    mockQuery({
      data: [
        { profiles: { id: 'p1', name: 'Ana', active: true, role: 'member' } },
        { profiles: null },
      ],
      error: null,
    });

    await expect(fetchGroupProfiles('g1')).resolves.toHaveLength(1);
  });

  it('propaga o erro em vez de devolver lista vazia', async () => {
    mockQuery({ data: null, error: { message: 'boom' } });
    await expect(fetchGroupProfiles('g1')).rejects.toThrow('boom');
  });
});
