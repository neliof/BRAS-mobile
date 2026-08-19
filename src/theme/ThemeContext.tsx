import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { readTheme, saveTheme } from '../api/storage';
import { supabase } from '../api/supabase';
import {
  DEFAULT_THEME, THEMES, isThemeName, themeVars, type Theme, type ThemeName,
} from './tokens';

interface ThemeValue {
  theme: Theme;
  /** Troca o tema no dispositivo. Um administrador fixa-o também no grupo. */
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

/**
 * Tema global.
 *
 * As variáveis são postas numa `View` que embrulha a app inteira: o NativeWind
 * herda-as por toda a árvore, e é por isso que trocar de tema repinta tudo no
 * fotograma seguinte sem um único componente saber que o tema mudou.
 *
 * Precedência: o que o dispositivo escolheu ganha sempre; o tema do grupo é só
 * o ponto de partida de quem ainda não escolheu nada.
 */
export function ThemeProvider({
  children,
  groupId,
  isAdmin = false,
}: {
  children: ReactNode;
  groupId?: string | null;
  isAdmin?: boolean;
}) {
  const [name, setName] = useState<ThemeName>(DEFAULT_THEME);
  // Distingue "ainda não li o disco" de "li e não havia nada": sem isto, o
  // tema do grupo entrava por cima de uma escolha local a cada arranque.
  const [hasLocalChoice, setHasLocalChoice] = useState(false);

  useEffect(() => {
    let active = true;
    void readTheme().then((stored) => {
      if (!active || !isThemeName(stored)) return;
      setName(stored);
      setHasLocalChoice(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!groupId || hasLocalChoice) return;

    let active = true;
    void supabase
      .from('groups')
      .select('theme')
      .eq('id', groupId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && isThemeName(data?.theme)) setName(data.theme);
      });
    return () => {
      active = false;
    };
  }, [groupId, hasLocalChoice]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setName(next);
      setHasLocalChoice(true);
      void saveTheme(next);

      // Só administrador escreve em `groups` (`groups_update_admin`). Para os
      // outros a escolha é local, e a falha silenciosa seria o comportamento
      // certo à mesma — a app já mudou de cor.
      if (isAdmin && groupId) {
        void supabase.from('groups').update({ theme: next }).eq('id', groupId);
      }
    },
    [groupId, isAdmin],
  );

  const theme = THEMES[name];
  const value = useMemo<ThemeValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={vars(themeVars(theme))} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/**
 * Tema ativo. Para classes basta `bg-canvas`/`text-fg`; isto serve as props que
 * só aceitam cores em código — `color` de ícones, `placeholderTextColor`.
 */
export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme tem de ser usado dentro de <ThemeProvider>');
  }
  return context;
}
