import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Fila de mutações por enviar.
 *
 * A app é usada num bar, onde a rede falha. Uma ronda registada sem rede não
 * pode desaparecer: fica aqui até haver ligação.
 *
 * A chave é a mesma que `useSyncStatus` lê para mostrar o estado.
 */
export const QUEUE_KEY = '@bras_mutation_queue';

/** Ao fim disto a mutação é descartada: já não vai passar. */
export const MAX_ATTEMPTS = 5;

export type MutationKind = 'createRound' | 'settleMemberDebt';

export interface QueuedMutation {
  id: string;
  kind: MutationKind;
  payload: unknown;
  createdAt: string;
  attempts: number;
}

export type MutationHandlers = {
  [K in MutationKind]: (payload: any) => Promise<unknown>;
};

export interface FlushResult {
  sent: number;
  /** Mutações descartadas por terem esgotado as tentativas. */
  dropped: QueuedMutation[];
  /** Sobraram por enviar — a fila parou antes do fim. */
  remaining: number;
}

/**
 * Uma fila ilegível é indistinguível de uma fila vazia para efeitos de leitura,
 * mas não se apaga aqui: apagar em silêncio destruía trabalho do utilizador.
 * `useSyncStatus` é que trata do caso, ao mostrar o estado.
 */
export async function readQueue(): Promise<QueuedMutation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

let counter = 0;
const nextId = () => `mut-${Date.now().toString(36)}-${(++counter).toString(36)}`;

export async function enqueue(
  kind: MutationKind,
  payload: unknown,
): Promise<QueuedMutation> {
  const entry: QueuedMutation = {
    id: nextId(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await writeQueue([...(await readQueue()), entry]);
  return entry;
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

let flushing = false;

/**
 * Envia a fila por ordem de entrada.
 *
 * Para à primeira falha em vez de saltar por cima: as rondas são numeradas em
 * sequência, e enviar a terceira antes da segunda dá uma noite com a ordem
 * trocada. A exceção é uma mutação que esgotou as tentativas — essa é
 * descartada e a fila continua, senão uma linha envenenada bloqueava tudo.
 *
 * Chamadas concorrentes não duplicam envios: a segunda devolve logo.
 */
export async function flushQueue(
  handlers: MutationHandlers,
): Promise<FlushResult> {
  if (flushing) return { sent: 0, dropped: [], remaining: (await readQueue()).length };

  flushing = true;
  try {
    let queue = await readQueue();
    const dropped: QueuedMutation[] = [];
    let sent = 0;

    while (queue.length > 0) {
      const [head, ...rest] = queue;

      try {
        await handlers[head.kind](head.payload);
        sent += 1;
        queue = rest;
      } catch {
        const attempted = { ...head, attempts: head.attempts + 1 };

        if (attempted.attempts >= MAX_ATTEMPTS) {
          dropped.push(attempted);
          queue = rest;
          continue;
        }

        queue = [attempted, ...rest];
        break;
      }

      await writeQueue(queue);
    }

    await writeQueue(queue);
    return { sent, dropped, remaining: queue.length };
  } finally {
    flushing = false;
  }
}
