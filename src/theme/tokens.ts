/**
 * Tokens de tema.
 *
 * Um único conjunto de papéis — fundo, texto, marca, perigo — que todos os
 * ecrãs consomem pelas mesmas classes (`bg-canvas`, `text-fg`, `bg-brand`).
 * Trocar de tema troca os valores por trás dessas classes; não existe nem uma
 * variante de componente nem uma segunda árvore de ecrãs.
 *
 * Os valores viajam para o NativeWind como canais RGB separados por espaço
 * ("242 125 38"), que é o formato que `rgb(var(--x) / <alpha-value>)` exige —
 * é ele que faz `bg-brand/20` e `text-fg/60` continuarem a funcionar.
 */

export type ThemeName = 'bras-classico' | 'dark-modern' | 'light';

export const THEME_NAMES: ThemeName[] = ['bras-classico', 'dark-modern', 'light'];

export interface ThemePalette {
  /** Fundo da app. */
  canvas: string;
  /** Texto e, com opacidade, as superfícies e as bordas (`bg-fg/10`). */
  fg: string;
  /** Cor de ação. */
  brand: string;
  /** Texto por cima da cor de ação — nunca `fg`, que some sobre a marca. */
  onBrand: string;
  /** Avisos e ações destrutivas. */
  danger: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  /** Decide a cor dos ícones do sistema na barra de estado. */
  isDark: boolean;
  colors: ThemePalette;
}

export const THEMES: Record<ThemeName, Theme> = {
  'bras-classico': {
    name: 'bras-classico',
    label: 'Brás Clássico',
    description: 'Laranja sobre preto, a identidade do bar.',
    isDark: true,
    colors: {
      canvas: '#12161F',
      fg: '#FFFFFF',
      brand: '#F27D26',
      onBrand: '#000000',
      danger: '#FCA5A5',
    },
  },
  'dark-modern': {
    name: 'dark-modern',
    label: 'Dark Modern',
    description: 'Grafite e latão, mais sóbrio.',
    isDark: true,
    colors: {
      canvas: '#16181D',
      fg: '#ECEDEF',
      brand: '#D4B483',
      onBrand: '#1A1614',
      danger: '#F0A5A5',
    },
  },
  light: {
    name: 'light',
    label: 'Light',
    description: 'Claro, para ler à luz do dia.',
    isDark: false,
    colors: {
      // O laranja da marca não tem contraste sobre branco: como texto, escurece.
      canvas: '#F4F5F7',
      fg: '#171B22',
      brand: '#C2410C',
      onBrand: '#FFFFFF',
      danger: '#B91C1C',
    },
  },
};

export const DEFAULT_THEME: ThemeName = 'bras-classico';

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && value in THEMES;
}

/** "#F27D26" → "242 125 38", o formato que `rgb(var(--x) / <alpha>)` espera. */
export function hexToChannels(hex: string): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Cor com transparência para as props que não aceitam classes — o `color` de
 * um ícone, o `placeholderTextColor` de um campo. É o equivalente em código do
 * `/60` das classes.
 */
export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${hexToChannels(hex).split(' ').join(', ')}, ${alpha})`;
}

/** As variáveis CSS de um tema, prontas para o `vars()` do NativeWind. */
export function themeVars(theme: Theme): Record<string, string> {
  return {
    '--color-canvas': hexToChannels(theme.colors.canvas),
    '--color-fg': hexToChannels(theme.colors.fg),
    '--color-brand': hexToChannels(theme.colors.brand),
    '--color-on-brand': hexToChannels(theme.colors.onBrand),
    '--color-danger': hexToChannels(theme.colors.danger),
  };
}
