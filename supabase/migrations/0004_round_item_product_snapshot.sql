-- =========================================================
-- 0004 — Snapshot do produto em round_items
--
-- `round_items` guardava só `product_id`, mas o domínio (`src/domain/debt.ts`)
-- agrupa a dívida por nome de produto e a interface mostra a imagem. Ir buscar
-- os dois por junção à `products` daria o nome *atual*, não o nome à data da
-- ronda — um produto renomeado reescreveria o histórico.
--
-- Mesma lógica que já governa `product_prices`: o histórico é imutável, por
-- isso o nome e a imagem ficam congelados na linha da ronda.
-- =========================================================

ALTER TABLE public.round_items
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS product_image TEXT;

-- Preencher as linhas que já existam antes de tornar o nome obrigatório.
UPDATE public.round_items ri
SET product_name = p.name,
    product_image = p.image_url
FROM public.products p
WHERE ri.product_id = p.id
  AND ri.product_name IS NULL;

ALTER TABLE public.round_items
  ALTER COLUMN product_name SET NOT NULL;
