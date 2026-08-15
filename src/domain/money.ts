/**
 * Todo o dinheiro dentro de src/domain/ é um inteiro de cêntimos.
 * Euros em vírgula flutuante entram e saem apenas nas fronteiras
 * (base de dados e interface).
 */
export type Cents = number;

export function toCents(euros: number): Cents {
  return Math.round(euros * 100);
}

export function toEuros(cents: Cents): number {
  return cents / 100;
}

export function formatEuros(cents: Cents): string {
  const value = (cents / 100).toFixed(2).replace('.', ',');
  return `${value} €`;
}

/**
 * Distribui `total` pelos `weights` mantendo a soma exatamente igual a `total`.
 * Usa o método do maior resto: cada parte recebe o valor inteiro por defeito, e
 * os cêntimos que sobram vão para as partes com maior fração descartada.
 * O desempate é feito pela ordem de entrada, o que torna o resultado estável.
 */
export function splitCents(total: Cents, weights: number[]): Cents[] {
  if (weights.length === 0) return [];

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    throw new Error('splitCents: peso total tem de ser positivo');
  }

  const exact = weights.map((w) => (total * w) / totalWeight);
  const parts = exact.map(Math.floor);
  const remainder = total - parts.reduce((a, b) => a + b, 0);

  const byLargestFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < remainder; i++) {
    parts[byLargestFraction[i % byLargestFraction.length].index] += 1;
  }

  return parts;
}
