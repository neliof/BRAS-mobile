import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Home, Beer, Users, Calendar, Camera, Trophy } from 'lucide-react-native';
import { useSession } from '../../state/SessionContext';
import { useSession as useActiveSessions } from '../../hooks/useSession';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha } from '../../theme/tokens';

/**
 * Barra de atalhos no topo, presente em todos os ecrãs do grupo (mobile).
 *
 * Substitui a barra de abas do rodapé a pedido do utilizador: quadrados
 * maiores, no topo, sempre à vista. Vive no layout — um só sítio — em vez de
 * ser colada ecrã a ecrã.
 */
export function Atalhos() {
  const router = useRouter();
  const pathname = usePathname();
  const { grant } = useSession();
  const { theme } = useTheme();
  const { data: activeSessions = [] } = useActiveSessions(grant?.groupId ?? '');

  const items = [
    { label: 'Início', href: '/', Icon: Home, go: () => router.push('/(mobile)') },
    {
      label: 'Noite',
      href: '/noite',
      Icon: Beer,
      // Com uma noite aberta, o atalho entra logo nela; sem noite, o ecrã
      // explica que não há nenhuma ativa.
      go: () =>
        activeSessions[0]
          ? router.push({
              pathname: '/(mobile)/noite',
              params: { sessionId: activeSessions[0].id },
            })
          : router.push('/(mobile)/noite'),
    },
    { label: 'Amigos', href: '/amigos', Icon: Users, go: () => router.push('/(mobile)/amigos') },
    {
      label: 'Histórico',
      href: '/historico',
      Icon: Calendar,
      go: () => router.push('/(mobile)/historico'),
    },
    {
      label: 'Memórias',
      href: '/memorias',
      Icon: Camera,
      go: () => router.push('/(mobile)/memorias'),
    },
    {
      label: 'Troféus',
      href: '/conquistas',
      Icon: Trophy,
      go: () => router.push('/(mobile)/conquistas'),
    },
  ];

  return (
    <View className="flex-row gap-1.5 px-3 pt-2 pb-1 bg-canvas">
      {items.map(({ label, href, Icon, go }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Pressable
            key={label}
            onPress={go}
            className={`flex-1 items-center justify-center rounded-xl py-2 border ${
              active ? 'bg-brand/20 border-brand' : 'bg-fg/10 border-fg/20'
            }`}
          >
            <Icon
              size={20}
              color={active ? theme.colors.brand : withAlpha(theme.colors.fg, 0.7)}
            />
            <Text
              className={`text-[9px] font-semibold mt-1 ${
                active ? 'text-brand' : 'text-fg/70'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
