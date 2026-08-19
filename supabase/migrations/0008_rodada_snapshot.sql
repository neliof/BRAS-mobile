-- =========================================================
-- 0008 — Rodada: snapshot dos membros no momento do pedido
--
-- Uma rodada é um pedido feito por um responsável para os membros que estão
-- na noite NAQUELE momento. Os membros entram e saem durante a noite, e as
-- rodadas antigas têm de continuar a mostrar quantos eram na altura — tal
-- como `round_items` congela `product_name` (migração 0004).
--
-- `member_count` é o número na altura; `member_ids` diz quem eram. Ler o
-- número atual da sessão daria o valor de agora a todas as rodadas antigas.
--
-- O backfill usa os membros atuais de cada sessão: é o melhor valor conhecido
-- para rodadas antigas, que nunca guardaram este snapshot.
-- =========================================================

ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS member_count INTEGER,
  ADD COLUMN IF NOT EXISTS member_ids UUID[];

UPDATE public.rounds r
SET
  member_count = sub.n,
  member_ids = sub.ids
FROM (
  SELECT session_id, COUNT(*) AS n, array_agg(member_id) AS ids
  FROM public.session_members
  WHERE left_at IS NULL
  GROUP BY session_id
) sub
WHERE sub.session_id = r.session_id
  AND r.member_count IS NULL;
