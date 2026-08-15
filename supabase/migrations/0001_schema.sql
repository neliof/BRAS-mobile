-- =========================================================
-- BRÁS AQUELE BAR - SUPABASE DATABASE SCHEMA
-- PostgreSQL 15+ compatible for Supabase
--
-- Adaptado de src/lib/sqlSchema.ts do repositório original
-- (https://github.com/neliof/BRAS). Diferenças deliberadas:
--   1. Nenhuma política RLS é criada aqui. O schema original tinha todas as
--      políticas escritas como USING (true), que concede acesso total a
--      qualquer detentor da chave anónima. As linhas ENABLE ROW LEVEL
--      SECURITY são mantidas: com RLS ativo e nenhuma política, o acesso
--      fica negado por omissão, que é o estado seguro até a migração
--      0002_access_control.sql definir as políticas corretas.
--   2. public.groups ganha member_code_hash e admin_code_hash, usadas pela
--      porta de acesso por código de grupo da migração seguinte.
-- =========================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Users & Friends)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  avatar_url TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  birthday DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GROUPS
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  motto TEXT,
  logo_url TEXT,
  cover_url TEXT,
  description TEXT,
  primary_color VARCHAR(20) DEFAULT '#F59E0B',
  mbway_contact VARCHAR(50),
  member_code_hash TEXT,
  admin_code_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GROUP MEMBERS
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, profile_id)
);

-- 4. VENUES (O Bar)
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL DEFAULT 'Brás Aquele Bar',
  logo_url TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCTS (Bebidas e Petiscos)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('cerveja', 'shots', 'sem_alcool', 'vinho_sidra', 'petiscos', 'cafe_outros')),
  unit_size VARCHAR(100) NOT NULL,
  description TEXT,
  image_url TEXT,
  current_price NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRODUCT PRICES (Histórico Imutável de Preços)
CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SESSIONS (Noites no Bar)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  quote_of_the_night TEXT,
  memory_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SESSION MEMBERS (Amigos Presentes na Noite)
CREATE TABLE IF NOT EXISTS public.session_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(session_id, member_id)
);

-- 9. ROUNDS (Rodadas de Bebidas)
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancellation_reason TEXT,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- 10. ROUND ITEMS (Bebidas pedidas na rodada)
CREATE TABLE IF NOT EXISTS public.round_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CONSUMPTIONS (Distribuição Individual de Consumo)
CREATE TABLE IF NOT EXISTS public.consumption (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_item_id UUID NOT NULL REFERENCES public.round_items(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity NUMERIC(6, 2) NOT NULL CHECK (quantity > 0),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PAYMENTS (Pagamentos e Acertos Individuais)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method VARCHAR(20) CHECK (payment_method IN ('mbway', 'dinheiro', 'cartao', 'outro')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, member_id)
);

-- 13. PHOTOS (Álbum de Memórias do Grupo)
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  image_url TEXT NOT NULL,
  caption TEXT,
  tagged_member_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. ACHIEVEMENTS & GAMIFICATION
CREATE TABLE IF NOT EXISTS public.achievements (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL,
  criteria TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'presence'
);

CREATE TABLE IF NOT EXISTS public.member_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id VARCHAR(50) NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, achievement_id)
);

-- 15. AUDIT LOGS (Auditoria de Alterações)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(100) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
--
-- RLS é ativado em todas as tabelas de dados de negócio, sem nenhuma
-- política. Enquanto não existir política, o acesso é negado por omissão —
-- este é o estado seguro entre esta migração e 0002_access_control.sql, que
-- define as políticas reais.
-- =========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- REALTIME ENABLEMENT
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;

-- =========================================================
-- STORAGE BUCKETS SETUP
--
-- Nenhuma política de storage.objects é criada aqui pela mesma razão das
-- tabelas acima: as duas políticas do schema original não usavam
-- USING (true), mas também não são recriadas nesta migração. Ficam por
-- definir numa migração futura, quando a funcionalidade de fotos for
-- implementada; até lá, o bucket existe mas o acesso a storage.objects
-- fica negado por omissão.
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('bar-media', 'bar-media', true)
ON CONFLICT (id) DO NOTHING;
