import { priceAt } from '../pricing';
import { makeProduct } from './fixtures';

describe('priceAt', () => {
  it('usa o preço atual quando não há histórico', () => {
    const product = makeProduct({ current_price: 1.2 });
    expect(priceAt(product, '2026-08-15T21:00:00Z')).toBe(120);
  });

  it('usa o preço em vigor à data, não o preço atual', () => {
    // Uma rodada de janeiro tem de continuar a custar 1,00 €, mesmo depois
    // de o preço ter subido para 1,20 € em julho.
    const product = makeProduct({
      current_price: 1.2,
      price_history: [
        {
          id: 'pp-1', product_id: 'p', price: 1.0,
          valid_from: '2026-01-01T00:00:00Z',
          valid_to: '2026-07-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'pp-2', product_id: 'p', price: 1.2,
          valid_from: '2026-07-01T00:00:00Z',
          valid_to: null,
          created_at: '2026-07-01T00:00:00Z',
        },
      ],
    });

    expect(priceAt(product, '2026-03-10T21:00:00Z')).toBe(100);
    expect(priceAt(product, '2026-08-15T21:00:00Z')).toBe(120);
  });

  it('trata valid_from como inclusivo e valid_to como exclusivo', () => {
    const product = makeProduct({
      current_price: 9,
      price_history: [
        {
          id: 'pp-1', product_id: 'p', price: 1.0,
          valid_from: '2026-01-01T00:00:00Z',
          valid_to: '2026-07-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    expect(priceAt(product, '2026-01-01T00:00:00Z')).toBe(100);
    // No instante exato do fim, esta entrada já não se aplica.
    expect(priceAt(product, '2026-07-01T00:00:00Z')).toBe(900);
  });

  it('recorre ao preço atual para datas anteriores a todo o histórico', () => {
    const product = makeProduct({
      current_price: 1.5,
      price_history: [
        {
          id: 'pp-1', product_id: 'p', price: 1.0,
          valid_from: '2026-01-01T00:00:00Z',
          valid_to: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    expect(priceAt(product, '2025-06-01T00:00:00Z')).toBe(150);
  });
});
