import NetInfo from '@react-native-community/netinfo';
import { createRound } from '../api/rounds';
import { settleMemberDebt } from '../api/payments';
import { enqueue, type MutationHandlers, type MutationKind } from './mutationQueue';

/**
 * O que a fila sabe reexecutar quando a rede voltar. As chaves têm de casar
 * com `MutationKind`, e o payload guardado é exatamente o argumento destas
 * funções — é isso que torna a fila reexecutável depois de a app reiniciar.
 */
export const offlineHandlers: MutationHandlers = {
  createRound: (payload: { sessionId: string; roundData: Parameters<typeof createRound>[1] }) =>
    createRound(payload.sessionId, payload.roundData),
  settleMemberDebt: (payload: Parameters<typeof settleMemberDebt>[0]) =>
    settleMemberDebt(payload),
};

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();

  // `isInternetReachable` é null enquanto a sondagem não termina; nesse caso
  // vale a ligação declarada, senão a primeira mutação após o arranque ficava
  // sempre em fila.
  if (state.isConnected === false) return false;
  return state.isInternetReachable !== false;
}

/**
 * Executa a mutação, ou guarda-a na fila se não houver rede.
 *
 * A decisão é tomada antes de tentar, não a partir do erro: distinguir "sem
 * rede" de "o servidor recusou" a partir da mensagem do Supabase não é
 * fiável, e pôr uma recusa legítima em fila fá-la-ia repetir cinco vezes.
 *
 * Devolve `null` quando ficou em fila — quem chama tem de saber que ainda não
 * há resultado do servidor.
 */
export async function runOrQueue<T>(
  kind: MutationKind,
  payload: unknown,
  run: () => Promise<T>,
): Promise<T | null> {
  if (await isOnline()) return run();

  await enqueue(kind, payload);
  return null;
}
