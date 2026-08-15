import type {
  Product, Profile, Round, RoundItem, Session, Consumption, Payment,
} from '../../types';

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;

export function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: id('prof'),
    name: 'Membro',
    avatar_url: '',
    role: 'member',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

export function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: id('prod'),
    name: 'Imperial',
    category: 'cerveja',
    unit_size: 'Fino 0.2L',
    image_url: '',
    current_price: 1.2,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

export function makeConsumption(over: Partial<Consumption> = {}): Consumption {
  return {
    id: id('cons'),
    round_item_id: 'ri-x',
    member_id: 'prof-x',
    quantity: 1,
    amount: 1.2,
    ...over,
  };
}

export function makeRoundItem(over: Partial<RoundItem> = {}): RoundItem {
  return {
    id: id('ri'),
    round_id: 'round-x',
    product_id: 'prod-x',
    product_name: 'Imperial',
    quantity: 1,
    unit_price: 1.2,
    total_price: 1.2,
    consumptions: [],
    ...over,
  };
}

export function makeRound(over: Partial<Round> = {}): Round {
  return {
    id: id('round'),
    session_id: 'sess-x',
    round_number: 1,
    requested_by: 'prof-x',
    created_by: 'prof-x',
    created_at: '2026-08-15T21:00:00Z',
    status: 'active',
    items: [],
    total_amount: 0,
    ...over,
  };
}

export function makePayment(over: Partial<Payment> = {}): Payment {
  return {
    id: id('pay'),
    session_id: 'sess-x',
    member_id: 'prof-x',
    amount: 0,
    status: 'pending',
    ...over,
  };
}

export function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: id('sess'),
    code: 'BRAS-2026-0815',
    group_id: 'grp-1',
    venue_id: 'ven-1',
    name: 'Sexta-feira no Brás',
    date: '2026-08-15',
    started_at: '2026-08-15T20:00:00Z',
    status: 'active',
    created_by: 'prof-x',
    member_ids: [],
    rounds: [],
    payments: [],
    photos: [],
    ...over,
  };
}
