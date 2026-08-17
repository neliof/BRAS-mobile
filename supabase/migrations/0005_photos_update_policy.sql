-- =========================================================
-- 0005 — Fotos: política de UPDATE e group_id obrigatório
--
-- Dois buracos que só aparecem contra o Supabase real:
--
-- 1. A 0001 dá a `photos` políticas de SELECT, INSERT e DELETE, mas nenhuma de
--    UPDATE. Com RLS ativo isso nega qualquer alteração: marcar pessoas numa
--    foto ou corrigir a legenda falhava sempre, em silêncio (o UPDATE não
--    encontra linha nenhuma e devolve zero linhas em vez de erro).
--
-- 2. `group_id` é anulável, mas as três políticas existentes leem-no. Uma foto
--    gravada só com `session_id` fica invisível para toda a gente e nem um
--    administrador a consegue apagar — `is_group_admin(NULL)` é falso.
--
-- A tabela está vazia enquanto não houver uploads em produção. Se o backfill
-- deixar alguma linha sem grupo nem sessão, o SET NOT NULL falha de propósito:
-- é uma linha que ninguém consegue ver nem apagar e tem de ser tratada à mão.
-- =========================================================

UPDATE public.photos p
SET group_id = s.group_id
FROM public.sessions s
WHERE p.session_id = s.id
  AND p.group_id IS NULL;

ALTER TABLE public.photos ALTER COLUMN group_id SET NOT NULL;

-- Qualquer membro do grupo marca pessoas e escreve legendas; é conteúdo
-- partilhado, não do autor. Apagar continua a ser só do administrador
-- (`photos_delete_admin`, na 0001). O WITH CHECK impede mover a foto para um
-- grupo onde o dispositivo não entra.
DROP POLICY IF EXISTS photos_update ON public.photos;

CREATE POLICY photos_update ON public.photos
  FOR UPDATE
  USING (group_id IN (SELECT public.current_group_ids()))
  WITH CHECK (group_id IN (SELECT public.current_group_ids()));
