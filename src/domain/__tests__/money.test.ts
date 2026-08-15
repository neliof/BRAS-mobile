import { toCents, toEuros, formatEuros, splitCents } from '../money';

describe('toCents', () => {
  it('converte euros em cêntimos inteiros', () => {
    expect(toCents(1.2)).toBe(120);
    expect(toCents(0)).toBe(0);
    expect(toCents(12.5)).toBe(1250);
  });

  it('arredonda artefactos de vírgula flutuante em vez de os truncar', () => {
    // 3 * 0.29 === 0.8699999999999999 em IEEE 754.
    // Truncar daria 86 cêntimos e perderia um cêntimo por operação.
    expect(toCents(3 * 0.29)).toBe(87);
  });
});

describe('toEuros', () => {
  it('inverte toCents', () => {
    expect(toEuros(120)).toBe(1.2);
    expect(toEuros(87)).toBe(0.87);
  });
});

describe('formatEuros', () => {
  it('formata em português de Portugal com duas casas', () => {
    expect(formatEuros(1250)).toBe('12,50 €');
    expect(formatEuros(0)).toBe('0,00 €');
    expect(formatEuros(5)).toBe('0,05 €');
  });
});

describe('splitCents', () => {
  it('divide de forma exata quando é divisível', () => {
    expect(splitCents(300, [1, 1, 1])).toEqual([100, 100, 100]);
  });

  it('nunca perde nem inventa um cêntimo quando não é divisível', () => {
    const parts = splitCents(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it('respeita pesos diferentes', () => {
    expect(splitCents(300, [2, 1])).toEqual([200, 100]);
  });

  it('dá o resto a quem tem maior fração, com desempate estável pela ordem', () => {
    expect(splitCents(1000, [1, 1, 1, 1, 1, 1])).toEqual([
      167, 167, 167, 167, 166, 166,
    ]);
  });

  it('recusa peso total nulo', () => {
    expect(() => splitCents(100, [0, 0])).toThrow('peso total tem de ser positivo');
  });

  it('devolve lista vazia para lista de pesos vazia', () => {
    expect(splitCents(0, [])).toEqual([]);
  });
});
