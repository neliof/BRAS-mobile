-- =========================================================
-- 0006 — Numeração de rondas: uma por número, por noite
--
-- O número da ronda era decidido no cliente (`rounds.length + 1`). Dois
-- telemóveis a registar rondas ao mesmo tempo — ou dois a esvaziar a fila
-- offline depois de a rede voltar — chegavam ambos ao mesmo número, e a noite
-- ficava com duas "ronda 3" e nenhuma "ronda 4".
--
-- A restrição transforma isso num erro que o cliente apanha e repete com o
-- número seguinte, em vez de uma noite mal contada que ninguém nota.
--
-- Se a tabela já tiver duplicados de uma versão anterior, esta migração falha
-- de propósito. Ver quais são:
--
--   SELECT session_id, round_number, count(*)
--   FROM public.rounds GROUP BY 1, 2 HAVING count(*) > 1;
-- =========================================================

ALTER TABLE public.rounds
  ADD CONSTRAINT rounds_session_number_unique UNIQUE (session_id, round_number);
