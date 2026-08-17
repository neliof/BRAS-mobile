import { fetchActiveSessions, createSession, fetchSessionDetails, updateSessionStatus } from '../sessions';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

interface QueryChain {
  select?: jest.Mock;
  eq?: jest.Mock;
  order?: jest.Mock;
  insert?: jest.Mock;
  update?: jest.Mock;
  single?: jest.Mock;
}

function mockQuery(result: { data: unknown; error: unknown }) {
  const chain: QueryChain = {
    select: jest.fn(function (this: any) {
      return this;
    }),
    eq: jest.fn(function (this: any) {
      return this;
    }),
    order: jest.fn(() => Promise.resolve(result)),
    insert: jest.fn(function (this: any) {
      return this;
    }),
    update: jest.fn(function (this: any) {
      return this;
    }),
    single: jest.fn(() => Promise.resolve(result)),
  };
  from.mockReturnValue(chain);
  return chain;
}

beforeEach(() => jest.clearAllMocks());

describe('sessions API', () => {
  describe('fetchActiveSessions', () => {
    it('obtém as sessões ativas de um grupo, por ordem descendente', async () => {
      const mockSessions = [
        {
          id: 'sess-1',
          group_id: 'grp-1',
          status: 'active',
          name: 'Noite de sexta',
          code: 'BRAS-2026-08-15',
          venue_id: 'venue-1',
          date: '2026-08-15',
          started_at: '2026-08-15T20:00:00Z',
          created_by: 'user-1',
          // Vem da tabela de junção, não de uma coluna.
          session_members: [{ member_id: 'user-1' }, { member_id: 'user-2' }],
          rounds: [],
          payments: [],
          photos: [],
        },
      ];

      const chain = mockQuery({ data: mockSessions, error: null });

      const result = await fetchActiveSessions('grp-1');

      expect(from).toHaveBeenCalledWith('sessions');
      expect(chain.eq).toHaveBeenCalledWith('group_id', 'grp-1');
      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
      expect(result[0].member_ids).toEqual(['user-1', 'user-2']);
      // `session_members` é detalhe do transporte e não deve escapar.
      expect(result[0]).not.toHaveProperty('session_members');
    });

    it('devolve lista vazia se não há sessões ativas', async () => {
      mockQuery({ data: [], error: null });

      const result = await fetchActiveSessions('grp-1');

      expect(result).toEqual([]);
    });

    it('propaga o erro Supabase', async () => {
      mockQuery({ data: null, error: { message: 'Sem permissão' } });

      await expect(fetchActiveSessions('grp-1')).rejects.toThrow('Sem permissão');
    });
  });

  describe('fetchSessionDetails', () => {
    it('obtém os detalhes completos de uma sessão com rondas, pagamentos e fotos', async () => {
      const mockSession = {
        id: 'sess-1',
        group_id: 'grp-1',
        status: 'active',
        name: 'Noite de sexta',
        code: 'BRAS-2026-08-15',
        venue_id: 'venue-1',
        date: '2026-08-15',
        started_at: '2026-08-15T20:00:00Z',
        created_by: 'user-1',
        session_members: [{ member_id: 'user-1' }, { member_id: 'user-2' }],
        rounds: [
          {
            id: 'round-1',
            session_id: 'sess-1',
            round_number: 1,
            requested_by: 'user-1',
            created_by: 'user-1',
            created_at: '2026-08-15T20:30:00Z',
            status: 'active',
            total_amount: 1000,
            items: [],
          },
        ],
        payments: [],
        photos: [],
      };

      const chain = mockQuery({ data: mockSession, error: null });

      const result = await fetchSessionDetails('sess-1');

      expect(from).toHaveBeenCalledWith('sessions');
      expect(chain.eq).toHaveBeenCalledWith('id', 'sess-1');
      expect(result.member_ids).toEqual(['user-1', 'user-2']);
      expect(result.rounds).toHaveLength(1);
      expect(result).not.toHaveProperty('session_members');
    });

    it('propaga erro se a sessão não existe', async () => {
      mockQuery({ data: null, error: { message: 'Sessão não encontrada' } });

      await expect(fetchSessionDetails('sess-invalid')).rejects.toThrow(
        'Sessão não encontrada'
      );
    });
  });

  describe('createSession', () => {
    it('cria uma nova sessão com código de acesso e data de início', async () => {
      const mockSession = {
        id: 'sess-new',
        group_id: 'grp-1',
        venue_id: 'venue-1',
        name: 'Noite nova',
        code: 'BRAS-2026-08-17',
        status: 'active',
        started_at: expect.any(String),
        created_by: 'user-1',
        member_ids: ['user-1', 'user-2'],
        rounds: [],
        payments: [],
        photos: [],
      };

      const chain = mockQuery({ data: mockSession, error: null });

      const result = await createSession({
        groupId: 'grp-1',
        venueId: 'venue-1',
        name: 'Noite nova',
        memberIds: ['user-1', 'user-2'],
        createdBy: 'user-1',
      });

      expect(from).toHaveBeenCalledWith('sessions');
      expect(chain.insert).toHaveBeenCalled();
      expect(result.status).toBe('active');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ code: expect.stringMatching(/^BRAS-\d{4}-\d{2}-\d{2}-[A-Z0-9]{4}$/) }),
      );
    });

    it('propaga erro de inserção', async () => {
      mockQuery({ data: null, error: { message: 'Erro de BD' } });

      await expect(
        createSession({
          groupId: 'grp-1',
          venueId: 'venue-1',
          name: 'Noite nova',
          memberIds: ['user-1'],
          createdBy: 'user-1',
        })
      ).rejects.toThrow('Erro de BD');
    });
  });

  describe('updateSessionStatus', () => {
    it('fecha uma sessão com rating e quote of the night', async () => {
      const mockSession = {
        id: 'sess-1',
        group_id: 'grp-1',
        status: 'closed',
        rating: 5,
        quote_of_the_night: 'Foi incrível!',
        ended_at: expect.any(String),
        session_members: [{ member_id: 'user-1' }],
        rounds: [],
        payments: [],
        photos: [],
      };

      mockQuery({ data: mockSession, error: null });

      const result = await updateSessionStatus('sess-1', 'closed', {
        rating: 5,
        quote_of_the_night: 'Foi incrível!',
      });

      expect(result.status).toBe('closed');
      expect(result.rating).toBe(5);
    });

    it('devolve a sessão com os embeds, que vão parar ao cache dos detalhes', async () => {
      const chain = mockQuery({
        data: {
          id: 'sess-1',
          group_id: 'grp-1',
          status: 'closed',
          session_members: [{ member_id: 'user-1' }, { member_id: 'user-2' }],
          rounds: [{ id: 'round-1', items: [] }],
          payments: [],
          photos: [],
        },
        error: null,
      });

      const result = await updateSessionStatus('sess-1', 'closed');

      // O ecrã da noite lê `member_ids.length` e itera `rounds` logo a seguir a
      // fechar: sem estes campos rebenta em vez de mostrar a noite fechada.
      expect(result.member_ids).toEqual(['user-1', 'user-2']);
      expect(result.rounds).toHaveLength(1);
      expect(result.payments).toEqual([]);
      expect(result.photos).toEqual([]);
      expect(result).not.toHaveProperty('session_members');
      expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('session_members'));
    });

    it('propaga erro de atualização', async () => {
      mockQuery({ data: null, error: { message: 'Sessão bloqueada' } });

      await expect(updateSessionStatus('sess-1', 'closed')).rejects.toThrow(
        'Sessão bloqueada'
      );
    });
  });
});
