# Supabase — Brás Aquele Bar

## Migrações

Executar por ordem, no editor SQL do Supabase (SQL Editor → New query). Cada
ficheiro tem de terminar sem erro antes de correr o seguinte.

1. `migrations/0001_schema.sql` — tabelas do schema base (perfis, grupos,
   catálogo, sessões, rondas, consumo, pagamentos, fotos, conquistas,
   auditoria). Ativa RLS em todas as tabelas de dados de negócio, sem
   nenhuma política: entre esta migração e a seguinte, o acesso fica negado
   por omissão, que é o estado seguro.
2. `migrations/0002_access_control.sql` — tabela `device_grants`, as funções
   `current_group_ids()`, `is_group_admin()`, `is_any_group_admin()`,
   `session_in_my_groups()`, `redeem_group_code()`, `set_group_codes()`, e as
   políticas RLS reais de cada tabela.

Não há CLI de migrações configurada neste projeto — os ficheiros em
`migrations/` são a fonte da verdade, aplicados manualmente. Se o projeto
Supabase for recriado (novo ambiente, restauro), correr os dois ficheiros
outra vez, por esta ordem, num projeto vazio.

### Antes de migrar

Em **Authentication → Sign In / Providers**, ativar **Anonymous sign-ins**.
Sem isto, `signInAnonymously()` no cliente falha e a porta de acesso por
código de grupo nunca chega a validar nada — mas nenhuma migração depende
disto para correr sem erro; é um requisito de runtime, não de schema.

Copiar `.env.example` para `.env` e preencher `EXPO_PUBLIC_SUPABASE_URL` e
`EXPO_PUBLIC_SUPABASE_ANON_KEY` com os valores do projeto (Project Settings →
API). O `.env` não é versionado.

## Códigos de grupo: definir e rodar

Não existe autenticação individual nem administrador pré-existente, por isso
os primeiros códigos de um grupo são definidos diretamente no editor SQL, que
corre com privilégios de serviço (contorna RLS).

Criar o grupo:

```sql
INSERT INTO public.groups (name, motto, primary_color)
VALUES ('Brás Aquele Bar', 'Onde a noite começa', '#F27D26')
RETURNING id;
```

Definir os códigos (substituir `<GROUP_ID>` pelo id devolvido acima e
escolher códigos próprios com pelo menos 12 caracteres — os valores abaixo
são marcadores, nunca usar em produção):

```sql
UPDATE public.groups SET
  member_code_hash = crypt('troca-este-codigo-membro', gen_salt('bf', 10)),
  admin_code_hash  = crypt('troca-este-codigo-admin',  gen_salt('bf', 10))
WHERE id = '<GROUP_ID>';
```

Guardar os dois códigos num gestor de palavras-passe assim que forem
definidos. A base de dados só guarda os hashes (`crypt`/`bf`); os códigos em
claro não voltam a ser legíveis depois disto.

**Nunca** commitar códigos reais em claro — nem no histórico do git, nem em
ficheiros de migração. Os marcadores acima (`troca-este-codigo-membro`,
`troca-este-codigo-admin`) só existem para serem substituídos no editor SQL.

### Rodar um código (revogação)

Depois de existir pelo menos um administrador, a rotação é feita pela app (ou
pelo editor SQL, autenticado como esse administrador) através de:

```sql
SELECT public.set_group_codes(
  '<GROUP_ID>',
  '<novo-codigo-membro-ou-NULL>',
  '<novo-codigo-admin-ou-NULL>'
);
```

Passar `NULL` num dos dois parâmetros deixa esse código inalterado. Alterar
um código revoga imediatamente os vínculos `device_grants` existentes com
esse papel (exceto o do próprio dispositivo que fez a chamada, no caso do
código de admin) — os dispositivos afetados têm de reintroduzir o código
novo. É o único mecanismo de revogação de acesso.

## Verificar que o acesso está mesmo fechado

Depois de qualquer alteração a políticas RLS, repetir esta verificação.

Num terminal, substituindo `<URL>` e `<ANON_KEY>` pelos valores do projeto
(sem sessão anónima ativa, ou seja, um pedido "frio", sem token de
utilizador):

```bash
curl -s "<URL>/rest/v1/profiles?select=*" -H "apikey: <ANON_KEY>"
```

Esperado: uma lista vazia `[]`, nunca dados de perfis. Um pedido sem sessão
anónima não tem `auth.uid()`, logo `current_group_ids()` não devolve nenhuma
linha e nenhuma política deixa passar nada.

Se este comando devolver perfis, **parar** e investigar — alguma política com
`USING (true)` sobreviveu. Confirmar com:

```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public' AND qual = 'true';
```

Esperado: zero linhas. Qualquer linha devolvida é uma política a corrigir
antes de continuar.

## 0003 — Políticas de storage

Resolve o buraco que a `0001` deixou em aberto: o bucket `bar-media` existia
com RLS ativo e zero políticas, ou seja, tudo negado.

Duas mudanças com impacto no cliente:

**O bucket passa a privado.** A `0001` criou-o com `public = true`, o que dava
leitura a qualquer pessoa com o URL, sem passar por RLS. Incompatível com fotos
visíveis só a quem partilha o grupo. O cliente tem de usar
`createSignedUrl` — `getPublicUrl` deixa de servir.

**Convenção de caminho obrigatória: `<group_id>/<resto>`.** As políticas leem a
primeira pasta do nome do objeto e comparam com os grupos do dispositivo.
Upload fora desta convenção é recusado.

Políticas criadas: `SELECT` e `INSERT` para quem partilha o grupo, `DELETE` só
para admin desse grupo. Não há `UPDATE` — um objeto substitui-se apagando e
voltando a carregar.

## Estado conhecido em aberto

Upload de fotos ainda não existe no cliente: `uploadPhoto` só grava um
`image_url` na tabela `photos`, ninguém chama `supabase.storage`, e o botão
"Carregar foto" no ecrã Memórias é um no-op. A `0003` deixa o lado do servidor
pronto; falta o seletor de imagem, o upload para `<group_id>/…` e os URLs
assinados.
