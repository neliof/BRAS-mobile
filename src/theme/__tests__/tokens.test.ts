import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_THEME, THEMES, THEME_NAMES, hexToChannels, isThemeName, themeVars, withAlpha,
} from '../tokens';

describe('hexToChannels', () => {
  it('devolve os canais separados por espaço, como o rgb(var(...)) exige', () => {
    expect(hexToChannels('#F27D26')).toBe('242 125 38');
    expect(hexToChannels('#000000')).toBe('0 0 0');
    expect(hexToChannels('#FFFFFF')).toBe('255 255 255');
  });
});

describe('withAlpha', () => {
  it('produz rgba a partir do hex do tema', () => {
    expect(withAlpha('#FFFFFF', 0.4)).toBe('rgba(255, 255, 255, 0.4)');
  });
});

describe('themeVars', () => {
  it('cobre todos os tokens que o tailwind.config declara', () => {
    // Se um token entrar na config e não aqui, a classe fica sem cor — falha
    // silenciosa, elemento invisível.
    expect(Object.keys(themeVars(THEMES['bras-classico'])).sort()).toEqual([
      '--color-brand',
      '--color-canvas',
      '--color-danger',
      '--color-fg',
      '--color-on-brand',
    ]);
  });
});

describe('THEMES', () => {
  it('define a paleta completa em todos os temas', () => {
    for (const name of THEME_NAMES) {
      const theme = THEMES[name];
      for (const [role, value] of Object.entries(theme.colors)) {
        expect(`${name}.${role}=${value}`).toMatch(/=#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('nunca usa a cor do texto por cima da marca', () => {
    // `text-on-brand` existe por isto: branco sobre laranja claro, ou preto
    // sobre grafite, era texto ilegível dentro dos botões de ação.
    for (const name of THEME_NAMES) {
      const { fg, onBrand } = THEMES[name].colors;
      expect(onBrand).not.toBe(fg);
    }
  });

  it('inverte fundo e texto no tema claro', () => {
    expect(THEMES.light.isDark).toBe(false);
    expect(THEMES['bras-classico'].isDark).toBe(true);
    expect(THEMES['dark-modern'].isDark).toBe(true);
  });

  it('arranca no tema da casa', () => {
    expect(DEFAULT_THEME).toBe('bras-classico');
    expect(THEMES[DEFAULT_THEME].colors.brand).toBe('#F27D26');
  });
});

describe('global.css', () => {
  it('tem a mesma paleta do tema por omissão', () => {
    // A folha de estilos é a rede para o que renderize fora do provider. Se
    // divergir, esse conteúdo aparece com as cores de outro tema — e ninguém
    // dá por isso até ver o ecrã.
    const css = readFileSync(join(__dirname, '../../../global.css'), 'utf8');

    for (const [token, value] of Object.entries(themeVars(THEMES[DEFAULT_THEME]))) {
      expect(css).toContain(`${token}: ${value};`);
    }
  });
});

describe('isThemeName', () => {
  it('aceita os temas conhecidos e recusa o resto', () => {
    expect(isThemeName('light')).toBe(true);
    expect(isThemeName('dark-modern')).toBe(true);
    // Um valor antigo em disco, ou de um grupo com uma versão mais recente,
    // tem de cair no tema por omissão em vez de deixar a app sem cores.
    expect(isThemeName('neon')).toBe(false);
    expect(isThemeName(null)).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
  });
});
