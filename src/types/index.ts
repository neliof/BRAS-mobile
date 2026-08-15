export type UserRole = 'admin' | 'member';

export interface Profile {
  id: string;
  name: string;
  nickname?: string;
  avatar_url: string;
  email?: string;
  phone?: string;
  role: UserRole;
  birthday?: string; // YYYY-MM-DD
  active: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  motto?: string;
  logo_url: string;
  cover_url?: string;
  description?: string;
  primary_color?: string;
  mbway_contact?: string;
  created_at: string;
}

export interface Venue {
  id: string;
  name: string;
  logo_url: string;
  address?: string;
  created_at: string;
}

export type ProductCategory = 'cerveja' | 'shots' | 'sem_alcool' | 'vinho_sidra' | 'petiscos' | 'cafe_outros';

export interface ProductPrice {
  id: string;
  product_id: string;
  price: number;
  valid_from: string;
  valid_to?: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  venue_id?: string;
  name: string;
  category: ProductCategory;
  unit_size: string; // e.g. "Caneca 0.5L", "Fino 0.2L", "Imperial", "Garrafa 33cl", "Shot"
  description?: string;
  image_url: string;
  current_price: number;
  active: boolean;
  created_at: string;
  price_history?: ProductPrice[];
}

export type SessionStatus = 'active' | 'closed' | 'cancelled';

export interface SessionMember {
  id: string;
  session_id: string;
  member_id: string; // references Profile.id
  joined_at: string;
  left_at?: string;
}

export interface Consumption {
  id: string;
  round_item_id: string;
  member_id: string; // who drank it
  quantity: number;
  amount: number;
}

export interface RoundItem {
  id: string;
  round_id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  consumptions: Consumption[];
}

export interface Round {
  id: string;
  session_id: string;
  round_number: number;
  requested_by: string; // Profile.id
  created_by: string; // Profile.id
  created_at: string;
  notes?: string;
  status: 'active' | 'cancelled';
  cancellation_reason?: string;
  items: RoundItem[];
  total_amount: number;
}

export type PaymentMethod = 'mbway' | 'dinheiro' | 'cartao' | 'outro';
export type PaymentStatus = 'pending' | 'paid';

export interface Payment {
  id: string;
  session_id: string;
  member_id: string;
  amount: number;
  payment_method?: PaymentMethod;
  status: PaymentStatus;
  paid_at?: string;
  notes?: string;
}

export interface Session {
  id: string;
  code: string; // e.g. "BRAS-2026-0815"
  group_id: string;
  venue_id: string;
  name: string; // e.g. "Sexta-feira no Brás"
  date: string; // YYYY-MM-DD
  started_at: string;
  ended_at?: string;
  status: SessionStatus;
  created_by: string;
  notes?: string;
  rating?: number; // 1-5 stars
  quote_of_the_night?: string;
  memory_notes?: string;
  member_ids: string[];
  rounds: Round[];
  payments: Payment[];
  photos: Photo[];
  total_beers?: number;
  total_amount?: number;
}

export interface Photo {
  id: string;
  group_id?: string;
  session_id?: string;
  uploaded_by: string;
  image_url: string;
  caption?: string;
  tagged_member_ids?: string[];
  created_at: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  category: 'presence' | 'beer_master' | 'social' | 'legend';
}

export interface MemberAchievement {
  id: string;
  member_id: string;
  achievement_id: string;
  earned_at: string;
  progress?: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  table_name: string;
  record_id: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface SyncStatus {
  state: 'synced' | 'syncing' | 'offline';
  pendingCount: number;
  lastSyncedAt?: string;
}
