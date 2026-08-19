import { View, Text } from 'react-native';
import { useSyncStatus } from '../../hooks/useSyncStatus';

/**
 * Faixa de estado da fila offline.
 *
 * Só aparece quando há alguma coisa a dizer: sem rede, ou com mutações por
 * enviar. Em estado normal não ocupa espaço nenhum.
 */
export function SyncBanner() {
  const { syncStatus, pendingCount } = useSyncStatus();

  if (syncStatus === 'synced') return null;

  const label =
    syncStatus === 'offline'
      ? pendingCount > 0
        ? `Sem rede — ${pendingCount} por enviar`
        : 'Sem rede'
      : syncStatus === 'syncing'
        ? 'A sincronizar...'
        : `${pendingCount} por enviar`;

  const tone = syncStatus === 'syncing' ? 'bg-brand/20' : 'bg-fg/10';

  return (
    <View className={`px-4 py-2 ${tone} border-b border-fg/10`}>
      <Text className="text-fg/80 text-xs text-center font-semibold">{label}</Text>
    </View>
  );
}
