import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QUEUE_KEY,
  MAX_ATTEMPTS,
  enqueue,
  readQueue,
  clearQueue,
  flushQueue,
  type MutationHandlers,
  type QueuedMutation,
} from '../mutationQueue';

/**
 * AsyncStorage falso, em memória, para não depender do nativo. O prefixo
 * `mock` é o que o Jest exige para deixar a fábrica ver a variável.
 */
const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

function handlers(overrides: Partial<MutationHandlers> = {}): MutationHandlers {
  return {
    createRound: jest.fn(async () => undefined),
    settleMemberDebt: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('fila de mutações', () => {
  it('devolve fila vazia quando não há nada guardado', async () => {
    await expect(readQueue()).resolves.toEqual([]);
  });

  it('devolve fila vazia quando o conteúdo guardado está corrompido', async () => {
    mockStore.set(QUEUE_KEY, 'isto não é JSON');
    await expect(readQueue()).resolves.toEqual([]);
  });

  it('acrescenta ao fim, preservando a ordem de entrada', async () => {
    await enqueue('createRound', { roundNumber: 1 });
    await enqueue('createRound', { roundNumber: 2 });

    const queue = await readQueue();
    expect(queue.map((m) => (m.payload as { roundNumber: number }).roundNumber)).toEqual([
      1, 2,
    ]);
    expect(queue[0].attempts).toBe(0);
  });

  it('apaga a chave em vez de guardar uma lista vazia', async () => {
    await enqueue('createRound', {});
    await clearQueue();

    expect(mockStore.has(QUEUE_KEY)).toBe(false);
  });
});

describe('flushQueue', () => {
  it('envia tudo por ordem e esvazia a fila', async () => {
    await enqueue('createRound', { roundNumber: 1 });
    await enqueue('settleMemberDebt', { memberId: 'user-1' });

    const seen: unknown[] = [];
    const result = await flushQueue(
      handlers({
        createRound: jest.fn(async (p) => {
          seen.push(p);
        }),
        settleMemberDebt: jest.fn(async (p) => {
          seen.push(p);
        }),
      }),
    );

    expect(result.sent).toBe(2);
    expect(result.remaining).toBe(0);
    expect(seen).toEqual([{ roundNumber: 1 }, { memberId: 'user-1' }]);
    await expect(readQueue()).resolves.toEqual([]);
  });

  it('para à primeira falha para não trocar a ordem das rondas', async () => {
    await enqueue('createRound', { roundNumber: 1 });
    await enqueue('createRound', { roundNumber: 2 });

    const createRound = jest.fn(async () => {
      throw new Error('sem rede');
    });

    const result = await flushQueue(handlers({ createRound }));

    expect(result.sent).toBe(0);
    expect(result.remaining).toBe(2);
    // Uma única tentativa, não uma por entrada.
    expect(createRound).toHaveBeenCalledTimes(1);

    const queue = await readQueue();
    expect(queue[0].attempts).toBe(1);
    expect(queue[1].attempts).toBe(0);
  });

  it('mantém as mutações por enviar entre execuções', async () => {
    await enqueue('createRound', { roundNumber: 1 });

    const falha = handlers({
      createRound: jest.fn(async () => {
        throw new Error('sem rede');
      }),
    });

    await flushQueue(falha);
    await flushQueue(falha);

    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].attempts).toBe(2);
  });

  it('descarta a mutação que esgota as tentativas e continua a fila', async () => {
    await enqueue('createRound', { roundNumber: 1 });
    await enqueue('settleMemberDebt', { memberId: 'user-1' });

    const envenenada: QueuedMutation[] = await readQueue();
    envenenada[0].attempts = MAX_ATTEMPTS - 1;
    mockStore.set(QUEUE_KEY, JSON.stringify(envenenada));

    const settleMemberDebt = jest.fn(async () => undefined);
    const result = await flushQueue(
      handlers({
        createRound: jest.fn(async () => {
          throw new Error('payload inválido');
        }),
        settleMemberDebt,
      }),
    );

    expect(result.dropped).toHaveLength(1);
    expect(result.sent).toBe(1);
    expect(settleMemberDebt).toHaveBeenCalled();
    await expect(readQueue()).resolves.toEqual([]);
  });

  it('não envia duas vezes se for chamada em paralelo', async () => {
    await enqueue('createRound', { roundNumber: 1 });

    let resolveHandler: () => void = () => undefined;
    const createRound = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHandler = resolve;
        }),
    );

    const first = flushQueue(handlers({ createRound }));
    const second = await flushQueue(handlers({ createRound }));

    expect(second.sent).toBe(0);

    resolveHandler();
    await expect(first).resolves.toMatchObject({ sent: 1 });
    expect(createRound).toHaveBeenCalledTimes(1);
  });
});
