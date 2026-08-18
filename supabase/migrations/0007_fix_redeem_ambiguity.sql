-- =========================================================
-- 0007 — redeem_group_code: "column reference group_id is ambiguous"
--
-- A função devolve TABLE (group_id, role), e em PL/pgSQL esses nomes tornam-se
-- variáveis visíveis dentro do corpo. No `ON CONFLICT (auth_user_id, group_id)`
-- o Postgres não sabe se `group_id` é a coluna de device_grants ou a variável
-- de saída, e recusa com "column reference group_id is ambiguous".
--
-- O erro nunca apareceu antes porque nenhum dispositivo tinha chegado a
-- resgatar um código com a 0002 aplicada — a criação da função não valida o
-- corpo, só a primeira execução rebenta.
--
-- `#variable_conflict use_column` resolve a ambiguidade a favor da coluna, que
-- é sempre a leitura certa aqui: todas as variáveis locais usam o prefixo v_.
-- =========================================================

CREATE OR REPLACE FUNCTION public.redeem_group_code(p_code TEXT)
RETURNS TABLE (group_id UUID, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
DECLARE
  v_group_id UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sessao_inexistente';
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) < 8 THEN
    RAISE EXCEPTION 'codigo_invalido';
  END IF;

  SELECT g.id, 'admin' INTO v_group_id, v_role
  FROM public.groups g
  WHERE g.admin_code_hash IS NOT NULL
    AND g.admin_code_hash = crypt(p_code, g.admin_code_hash)
  LIMIT 1;

  IF v_group_id IS NULL THEN
    SELECT g.id, 'member' INTO v_group_id, v_role
    FROM public.groups g
    WHERE g.member_code_hash IS NOT NULL
      AND g.member_code_hash = crypt(p_code, g.member_code_hash)
    LIMIT 1;
  END IF;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'codigo_invalido';
  END IF;

  INSERT INTO public.device_grants (auth_user_id, group_id, role)
  VALUES (auth.uid(), v_group_id, v_role)
  ON CONFLICT (auth_user_id, group_id)
  DO UPDATE SET role = EXCLUDED.role, granted_at = NOW();

  RETURN QUERY SELECT v_group_id, v_role;
END;
$$;
