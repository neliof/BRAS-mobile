import { redeemCode, restoreAccess, AccessError } from '../access';
import { supabase } from '../supabase';
import * as storage from '../storage';

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInAnonymously: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));
jest.mock('../storage');

const auth = supabase.auth as unknown as {
  getSession: jest.Mock;
  signInAnonymously: jest.Mock;
};
const rpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signInAnonymously.mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
    error: null,
  });
});

describe('redeemCode', () => {
  it('cria sessão anónima e troca o código pelo vínculo', async () => {
    rpc.mockResolvedValue({
      data: [{ group_id: 'g1', role: 'member' }],
      error: null,
    });

    const grant = await redeemCode('codigo-de-membro');

    expect(auth.signInAnonymously).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('redeem_group_code', {
      p_code: 'codigo-de-membro',
    });
    expect(grant).toEqual({ groupId: 'g1', role: 'member' });
  });

  it('guarda o código apenas quando a troca é bem sucedida', async () => {
    rpc.mockResolvedValue({
      data: [{ group_id: 'g1', role: 'admin' }],
      error: null,
    });

    await redeemCode('codigo-de-admin');
    expect(storage.saveGroupCode).toHaveBeenCalledWith('codigo-de-admin');
  });

  it('não guarda o código quando é rejeitado', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'codigo_invalido' },
    });

    await expect(redeemCode('errado')).rejects.toThrow(AccessError);
    expect(storage.saveGroupCode).not.toHaveBeenCalled();
  });

  it('classifica o código inválido para a interface poder distinguir', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'codigo_invalido' },
    });

    await expect(redeemCode('errado')).rejects.toMatchObject({
      code: 'codigo_invalido',
    });
  });

  it('reutiliza a sessão anónima existente', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });
    rpc.mockResolvedValue({
      data: [{ group_id: 'g1', role: 'member' }],
      error: null,
    });

    await redeemCode('codigo');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
});

describe('restoreAccess', () => {
  it('devolve null quando não há código guardado', async () => {
    (storage.readGroupCode as jest.Mock).mockResolvedValue(null);
    await expect(restoreAccess()).resolves.toBeNull();
  });

  it('revalida o código guardado', async () => {
    (storage.readGroupCode as jest.Mock).mockResolvedValue('guardado');
    rpc.mockResolvedValue({
      data: [{ group_id: 'g1', role: 'member' }],
      error: null,
    });

    await expect(restoreAccess()).resolves.toEqual({
      groupId: 'g1',
      role: 'member',
    });
  });

  it('apaga o código guardado quando deixou de ser válido', async () => {
    // Acontece quando um administrador roda o código para revogar acesso.
    (storage.readGroupCode as jest.Mock).mockResolvedValue('revogado');
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'codigo_invalido' },
    });

    await expect(restoreAccess()).resolves.toBeNull();
    expect(storage.clearGroupCode).toHaveBeenCalled();
  });
});
