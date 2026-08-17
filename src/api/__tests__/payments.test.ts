import { settleMemberDebt } from '../payments';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('settleMemberDebt', () => {
  it('faz upsert na chave (session_id, member_id) e marca como pago', async () => {
    const chain = {
      upsert: jest.fn(function (this: any) {
        return this;
      }),
      select: jest.fn(function (this: any) {
        return this;
      }),
      single: jest.fn(() =>
        Promise.resolve({ data: { id: 'pay-1', status: 'paid' }, error: null }),
      ),
    };
    from.mockReturnValue(chain);

    const result = await settleMemberDebt({
      sessionId: 'sess-1',
      memberId: 'user-2',
      amount: 12.5,
      paymentMethod: 'mbway',
    });

    expect(from).toHaveBeenCalledWith('payments');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'sess-1',
        member_id: 'user-2',
        amount: 12.5,
        payment_method: 'mbway',
        status: 'paid',
      }),
      { onConflict: 'session_id,member_id' },
    );
    expect(result.status).toBe('paid');
  });

  it('propaga o erro da base de dados', async () => {
    const chain = {
      upsert: jest.fn(function (this: any) {
        return this;
      }),
      select: jest.fn(function (this: any) {
        return this;
      }),
      single: jest.fn(() =>
        Promise.resolve({ data: null, error: { message: 'RLS negado' } }),
      ),
    };
    from.mockReturnValue(chain);

    await expect(
      settleMemberDebt({
        sessionId: 'sess-1',
        memberId: 'user-2',
        amount: 1,
        paymentMethod: 'dinheiro',
      }),
    ).rejects.toThrow('RLS negado');
  });
});
