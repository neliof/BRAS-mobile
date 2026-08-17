-- =========================================================
-- 0003 — Políticas de storage.objects para o bucket bar-media
--
-- A migração 0001 cria o bucket e deixa storage.objects com RLS ativo e sem
-- nenhuma política, o que nega tudo. Esta migração fecha esse buraco.
--
-- Duas decisões deliberadas:
--
-- 1. O bucket passa a privado. A 0001 criou-o com `public = true`, o que faz
--    com que qualquer pessoa com o URL leia o ficheiro sem passar por RLS —
--    incompatível com um modelo em que as fotos são visíveis só a quem
--    partilha o grupo. Como nenhum upload está implementado ainda, não há
--    ficheiros a quebrar. O cliente passa a precisar de `createSignedUrl`
--    em vez de `getPublicUrl`.
--
-- 2. Convenção de caminho: `<group_id>/<resto>`. A primeira pasta do objeto é
--    o UUID do grupo, e é o que as políticas verificam. Qualquer código de
--    upload tem de respeitar isto, senão o insert é recusado.
-- =========================================================

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'bar-media';

-- O grupo a que um objeto pertence, lido da primeira pasta do caminho.
-- Devolve NULL em vez de rebentar quando o caminho não começa por um UUID.
CREATE OR REPLACE FUNCTION public.storage_group_id(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_first TEXT := split_part(p_name, '/', 1);
BEGIN
  IF v_first = '' OR position('/' in p_name) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN v_first::UUID;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS bar_media_select ON storage.objects;
DROP POLICY IF EXISTS bar_media_insert ON storage.objects;
DROP POLICY IF EXISTS bar_media_delete_admin ON storage.objects;

CREATE POLICY bar_media_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bar-media'
    AND public.storage_group_id(name) IN (SELECT public.current_group_ids())
  );

CREATE POLICY bar_media_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bar-media'
    AND public.storage_group_id(name) IN (SELECT public.current_group_ids())
  );

-- Sem política de UPDATE: um objeto não se edita, substitui-se apagando e
-- voltando a carregar. Espelha `photos`, onde só o admin apaga.
CREATE POLICY bar_media_delete_admin ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bar-media'
    AND public.is_group_admin(public.storage_group_id(name))
  );
