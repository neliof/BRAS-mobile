import type { Product } from '../types';
import { toCents, type Cents } from './money';

/**
 * Preço de um produto no instante `whenIso`.
 *
 * Uma ronda registada no passado tem de manter o preço que estava em vigor
 * nessa data. Usar o preço atual alteraria retroativamente dívidas já
 * calculadas, e possivelmente já pagas.
 *
 * `valid_from` é inclusivo, `valid_to` é exclusivo.
 */
export function priceAt(product: Product, whenIso: string): Cents {
  const when = Date.parse(whenIso);
  const history = product.price_history ?? [];

  const entry = history.find((price) => {
    const from = Date.parse(price.valid_from);
    if (when < from) return false;
    if (!price.valid_to) return true;
    return when < Date.parse(price.valid_to);
  });

  return toCents(entry ? entry.price : product.current_price);
}
