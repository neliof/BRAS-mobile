-- =========================================================
-- CONTROLO DE ACESSO
--
-- Não existe autenticação individual: o perfil é escolhido no cliente e não
-- está ligado a nenhuma identidade. Por isso nenhuma política pode confiar em
-- profiles.role, que qualquer dispositivo pode afirmar ser o que quiser.
--
-- A autorização vem de device_grants, escrito exclusivamente pelo servidor
-- quando um dispositivo troca um código de grupo válido.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.device_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'admin')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_user_id, group_id)
);

ALTER TABLE public.device_grants ENABLE ROW LEVEL SECURITY;

-- Um dispositivo pode ver o seu próprio vínculo, e mais nada.
-- Não há política de INSERT, UPDATE ou DELETE: a única via de escrita é
-- redeem_group_code, que corre como SECURITY DEFINER.
CREATE POLICY device_grants_select_own ON public.device_grants
  FOR SELECT USING (auth_user_id = auth.uid());

-- ---------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_group_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM public.device_grants WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.device_grants
    WHERE auth_user_id = auth.uid()
      AND group_id = p_group_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_any_group_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.device_grants
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------
-- Troca do código por um vínculo
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.redeem_group_code(p_code TEXT)
RETURNS TABLE (group_id UUID, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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

REVOKE ALL ON FUNCTION public.redeem_group_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_group_code(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------
-- Definição e rotação dos códigos
--
-- Alterar um código revoga os vínculos existentes com esse papel, obrigando
-- os dispositivos afetados a reintroduzi-lo. É o mecanismo de revogação.
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_group_codes(
  p_group_id UUID,
  p_member_code TEXT,
  p_admin_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_group_admin(p_group_id) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  IF p_member_code IS NOT NULL THEN
    IF length(p_member_code) < 12 THEN
      RAISE EXCEPTION 'codigo_curto';
    END IF;
    UPDATE public.groups
      SET member_code_hash = crypt(p_member_code, gen_salt('bf', 10))
      WHERE id = p_group_id;
    DELETE FROM public.device_grants
      WHERE group_id = p_group_id AND role = 'member';
  END IF;

  IF p_admin_code IS NOT NULL THEN
    IF length(p_admin_code) < 12 THEN
      RAISE EXCEPTION 'codigo_curto';
    END IF;
    UPDATE public.groups
      SET admin_code_hash = crypt(p_admin_code, gen_salt('bf', 10))
      WHERE id = p_group_id;
    DELETE FROM public.device_grants
      WHERE group_id = p_group_id
        AND role = 'admin'
        AND auth_user_id <> auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_codes(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_group_codes(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------
-- Políticas: dados do grupo
-- ---------------------------------------------------------

CREATE POLICY groups_select ON public.groups
  FOR SELECT USING (id IN (SELECT public.current_group_ids()));

CREATE POLICY groups_update_admin ON public.groups
  FOR UPDATE USING (public.is_group_admin(id))
  WITH CHECK (public.is_group_admin(id));

CREATE POLICY group_members_select ON public.group_members
  FOR SELECT USING (group_id IN (SELECT public.current_group_ids()));

CREATE POLICY group_members_write_admin ON public.group_members
  FOR ALL USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

-- Perfis: visíveis a quem partilha um grupo com eles.
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.profile_id = profiles.id
        AND gm.group_id IN (SELECT public.current_group_ids())
    )
  );

CREATE POLICY profiles_write_admin ON public.profiles
  FOR ALL USING (public.is_any_group_admin())
  WITH CHECK (public.is_any_group_admin());

-- ---------------------------------------------------------
-- Políticas: catálogo
-- ---------------------------------------------------------

CREATE POLICY venues_select ON public.venues
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY venues_write_admin ON public.venues
  FOR ALL USING (public.is_any_group_admin())
  WITH CHECK (public.is_any_group_admin());

CREATE POLICY products_select ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY products_write_admin ON public.products
  FOR ALL USING (public.is_any_group_admin())
  WITH CHECK (public.is_any_group_admin());

-- Histórico de preços: legível por todos, escrito só por administradores, e
-- nunca alterado nem apagado. Uma dívida antiga depende destes registos.
CREATE POLICY product_prices_select ON public.product_prices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY product_prices_insert_admin ON public.product_prices
  FOR INSERT WITH CHECK (public.is_any_group_admin());

-- ---------------------------------------------------------
-- Políticas: sessões e consumo
-- ---------------------------------------------------------

CREATE POLICY sessions_select ON public.sessions
  FOR SELECT USING (group_id IN (SELECT public.current_group_ids()));

CREATE POLICY sessions_insert ON public.sessions
  FOR INSERT WITH CHECK (group_id IN (SELECT public.current_group_ids()));

CREATE POLICY sessions_update ON public.sessions
  FOR UPDATE USING (group_id IN (SELECT public.current_group_ids()))
  WITH CHECK (group_id IN (SELECT public.current_group_ids()));

CREATE POLICY sessions_delete_admin ON public.sessions
  FOR DELETE USING (public.is_group_admin(group_id));

-- Predicado reutilizado: a linha pertence a uma sessão de um grupo do dispositivo.
CREATE OR REPLACE FUNCTION public.session_in_my_groups(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = p_session_id
      AND s.group_id IN (SELECT public.current_group_ids())
  );
$$;

CREATE POLICY session_members_all ON public.session_members
  FOR ALL USING (public.session_in_my_groups(session_id))
  WITH CHECK (public.session_in_my_groups(session_id));

CREATE POLICY rounds_all ON public.rounds
  FOR ALL USING (public.session_in_my_groups(session_id))
  WITH CHECK (public.session_in_my_groups(session_id));

CREATE POLICY round_items_all ON public.round_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_items.round_id
        AND public.session_in_my_groups(r.session_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_items.round_id
        AND public.session_in_my_groups(r.session_id)
    )
  );

CREATE POLICY consumption_all ON public.consumption
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.round_items ri
      JOIN public.rounds r ON r.id = ri.round_id
      WHERE ri.id = consumption.round_item_id
        AND public.session_in_my_groups(r.session_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.round_items ri
      JOIN public.rounds r ON r.id = ri.round_id
      WHERE ri.id = consumption.round_item_id
        AND public.session_in_my_groups(r.session_id)
    )
  );

CREATE POLICY payments_all ON public.payments
  FOR ALL USING (public.session_in_my_groups(session_id))
  WITH CHECK (public.session_in_my_groups(session_id));

-- ---------------------------------------------------------
-- Políticas: fotos, conquistas, auditoria
-- ---------------------------------------------------------

CREATE POLICY photos_select ON public.photos
  FOR SELECT USING (group_id IN (SELECT public.current_group_ids()));

CREATE POLICY photos_insert ON public.photos
  FOR INSERT WITH CHECK (group_id IN (SELECT public.current_group_ids()));

CREATE POLICY photos_delete_admin ON public.photos
  FOR DELETE USING (public.is_group_admin(group_id));

CREATE POLICY achievements_select ON public.achievements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY member_achievements_select ON public.member_achievements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY member_achievements_write ON public.member_achievements
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Auditoria: inserção livre para quem tem acesso, leitura só para
-- administradores, e nunca alteração nem remoção.
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT USING (public.is_any_group_admin());
