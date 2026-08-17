import { createGroupProfile, deactivateProfile, fetchGroupProfiles } from '../profiles';
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

interface InsertChain {
  insert: jest.Mock;
  select: jest.Mock;
  single: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  update: jest.Mock;
}

function mockWrite(result: { data: unknown; error: unknown }) {
  const chain: InsertChain = {
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    delete: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn(() => Promise.resolve(result)),
  };
  from.mockReturnValue(chain);
  return chain;
}

describe('createGroupProfile', () => {
  it('cria o perfil e liga-o ao grupo', async () => {
    const profile = { id: 'p9', name: 'Rita', active: true, role: 'member' };
    const profiles = mockWrite({ data: profile, error: null });
    // O insert em `group_members` é esperado diretamente, sem `.single()`.
    const members = { insert: jest.fn(() => Promise.resolve({ error: null })) };
    from.mockReturnValueOnce(profiles).mockReturnValueOnce(members);

    await expect(
      createGroupProfile({ groupId: 'g1', name: '  Rita  ', nickname: ' Ritz ' }),
    ).resolves.toEqual(profile);

    expect(profiles.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Rita', nickname: 'Ritz', active: true, role: 'member' }),
    );
    expect(members.insert).toHaveBeenCalledWith({
      group_id: 'g1',
      profile_id: 'p9',
      role: 'member',
    });
  });

  it('recusa um nome vazio antes de escrever', async () => {
    const chain = mockWrite({ data: null, error: null });

    await expect(createGroupProfile({ groupId: 'g1', name: '   ' })).rejects.toThrow(/nome/);
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('apaga o perfil se a ligação ao grupo falhar', async () => {
    const profiles = mockWrite({ data: { id: 'p9', name: 'Rita' }, error: null });
    const members = {
      insert: jest.fn(() => Promise.resolve({ error: { message: 'RLS negado' } })),
    };
    const cleanupEq = jest.fn(() => Promise.resolve({ error: null }));
    const cleanup = { delete: jest.fn(() => ({ eq: cleanupEq })) };

    from
      .mockReturnValueOnce(profiles)
      .mockReturnValueOnce(members)
      .mockReturnValueOnce(cleanup);

    await expect(createGroupProfile({ groupId: 'g1', name: 'Rita' })).rejects.toThrow(
      'RLS negado',
    );
    // Um perfil sem grupo é invisível para toda a gente, incluindo o admin.
    expect(cleanupEq).toHaveBeenCalledWith('id', 'p9');
  });
});

describe('deactivateProfile', () => {
  it('desativa em vez de apagar, para não levar o histórico atrás', async () => {
    const chain = mockWrite({ data: null, error: null });

    await deactivateProfile('p9');

    expect(from).toHaveBeenCalledWith('profiles');
    expect(chain.update).toHaveBeenCalledWith({ active: false });
    expect(chain.eq).toHaveBeenCalledWith('id', 'p9');
  });
});
