import { createSession } from '../sessions';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('createSession members', () => {
  it('grava os membros presentes em session_members', async () => {
    const sessionChain = {
      insert: jest.fn(function (this: any) {
        return this;
      }),
      select: jest.fn(function (this: any) {
        return this;
      }),
      single: jest.fn(() =>
        Promise.resolve({
          data: {
            id: 'sess-new',
            group_id: 'grp-1',
            venue_id: 'venue-1',
            name: 'Noite nova',
            code: 'BRAS-2026-08-17',
            status: 'active',
            started_at: '2026-08-17T20:00:00Z',
            created_by: 'user-1',
          },
          error: null,
        }),
      ),
    };
    const membersInsert = jest.fn(() => Promise.resolve({ data: null, error: null }));
    from
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce({ insert: membersInsert });

    const result = await createSession({
      groupId: 'grp-1',
      venueId: 'venue-1',
      name: 'Noite nova',
      memberIds: ['user-1', 'user-2'],
      createdBy: 'user-1',
    });

    expect(sessionChain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ member_ids: expect.anything() }),
    );
    expect(membersInsert).toHaveBeenCalledWith([
      { session_id: 'sess-new', member_id: 'user-1' },
      { session_id: 'sess-new', member_id: 'user-2' },
    ]);
    expect(result.member_ids).toEqual(['user-1', 'user-2']);
  });

  it('apaga a sessão se a inserção dos membros falhar', async () => {
    const sessionChain = {
      insert: jest.fn(function (this: any) {
        return this;
      }),
      select: jest.fn(function (this: any) {
        return this;
      }),
      single: jest.fn(() =>
        Promise.resolve({ data: { id: 'sess-new' }, error: null }),
      ),
    };
    const membersInsert = jest.fn(() =>
      Promise.resolve({ data: null, error: { message: 'RLS negado' } }),
    );
    const deleteEq = jest.fn(() => Promise.resolve({ error: null }));
    const deleteChain = { delete: jest.fn(() => ({ eq: deleteEq })) };
    from
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce({ insert: membersInsert })
      .mockReturnValueOnce(deleteChain);

    await expect(
      createSession({
        groupId: 'grp-1',
        venueId: 'venue-1',
        name: 'Noite nova',
        memberIds: ['user-1'],
        createdBy: 'user-1',
      }),
    ).rejects.toThrow('RLS negado');

    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', 'sess-new');
  });
});
