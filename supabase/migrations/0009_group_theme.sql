-- =========================================================
-- 0009 — Tema do grupo
--
-- O tema é uma preferência do dispositivo (guardada em AsyncStorage), mas o
-- grupo pode ter um tema de casa: é o que aparece a quem entra pela primeira
-- vez, antes de escolher outro. Só um administrador o define — a política
-- `groups_update_admin` (migração 0002) já cobre a escrita.
--
-- Sem valor por omissão: NULL significa "o grupo não decidiu", e o cliente
-- fica com o tema Brás Clássico.
-- =========================================================

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS theme TEXT;

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_theme_known;

-- Um nome desconhecido no cliente cairia em silêncio no tema por omissão; é
-- melhor a base de dados recusar já.
ALTER TABLE public.groups
  ADD CONSTRAINT groups_theme_known
  CHECK (theme IS NULL OR theme IN ('bras-classico', 'dark-modern', 'light'));
