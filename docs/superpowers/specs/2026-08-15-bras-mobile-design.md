# BRÁS Mobile — Especificação de Desenho

Data: 2026-08-15
Estado: aprovado para planeamento

## 1. Contexto

O repositório [neliof/BRAS](https://github.com/neliof/BRAS) contém uma aplicação web
React 19 + Vite + TypeScript + Tailwind 4, com cerca de 9000 linhas. Não é um
template vazio: é uma aplicação funcional de gestão de noites de bar em grupo.

Um grupo de amigos abre uma "sessão" (noite) num bar, regista rondas de bebidas,
distribui o consumo por membro, calcula a dívida individual de cada um e fecha a
noite com os pagamentos.

O objetivo desta especificação é portar essa aplicação para React Native + Expo,
correndo em Android e iOS.

### 1.1 Inventário do que existe

Duas aplicações num só bundle, alternadas por `userMode` em `src/App.tsx`:

**Mobile** — `src/components/mobile/`, 6 separadores:
Início, Noite ativa, Amigos, Histórico, Memórias, Troféus.
Modais: iniciar noite, nova ronda, QR code da noite, pagar dívida, fechar noite.

**Admin** — `src/components/admin/`, 8 ecrãs:
overview, membros, produtos, sessões, fotos, estatísticas, definições, Supabase.

**Modelo de dados** — `src/types/index.ts`:
`Profile`, `Group`, `Venue`, `Product` (com histórico de preços),
`Session` → `Round` → `RoundItem` → `Consumption`, `Payment`, `Photo`,
`Achievement`, `MemberAchievement`, `AuditLog`, `SyncStatus`.

**Estado** — `src/lib/store.tsx`, 983 linhas. Context API único, persistência em
`localStorage`, dados de demonstração em `src/lib/mockData.ts` (667 linhas).

**Backend** — `src/lib/supabase.ts`. Supabase presente mas opcional e parcial: só
carregamento de imagens, com recurso a base64 quando falha. O schema SQL existe em
`src/lib/sqlSchema.ts` (288 linhas) mas não há leitura nem escrita de dados de
negócio via Supabase. Na prática, a aplicação atual é offline puro, sem
sincronização entre dispositivos.

## 2. Decisões tomadas

| Área | Decisão |
|---|---|
| Escopo | Mobile (6 separadores) + Admin completo (8 ecrãs) |
| Backend | Supabase a sério: leitura, escrita e tempo real |
| Estilo | NativeWind v4 |
| Identidade | Seletor de perfil local, sem palavra-passe individual |
| Acesso | Código do grupo trocado por sessão anónima do Supabase |

## 3. Problema de segurança identificado e sua resolução

### 3.1 O problema

Todas as políticas RLS em `sqlSchema.ts` estão escritas como `USING (true)`:

```sql
CREATE POLICY "Sessions viewable by group members"
  ON public.sessions FOR ALL
  USING (true);
```

Isto concede leitura e escrita totais a qualquer detentor da chave anónima.

Numa aplicação móvel a chave anónima é distribuída dentro do binário `.apk` /
`.ipa` e extrai-se descompactando o ficheiro. Qualquer pessoa que instale a
aplicação poderia ler todos os perfis (nome, email, telefone, data de nascimento),
apagar noites e alterar pagamentos de terceiros.

Combinado com a ausência de autenticação individual, nada no sistema distingue um
membro legítimo de um estranho.

### 3.2 A resolução adotada

Porta de acesso por código de grupo, com sessão anónima do Supabase:

1. Ao abrir pela primeira vez, o dispositivo pede um código secreto do grupo.
2. A aplicação chama `supabase.auth.signInAnonymously()`, obtendo um `auth.uid()`.
3. Chama a função `redeem_group_code(codigo)`, declarada `SECURITY DEFINER`, que
   valida o código no servidor e insere uma linha em `device_grants` ligando esse
   `auth.uid()` ao `group_id`. O código nunca é comparado no cliente.
4. Todas as políticas RLS passam a exigir pertença ao grupo, através de um
   `EXISTS` sobre `device_grants`.
5. Operações destrutivas (apagar sessão, alterar produtos, alterar preços) exigem
   adicionalmente `role = 'admin'` no perfil associado.
6. O código do grupo é guardado no dispositivo em `expo-secure-store` (Keychain no
   iOS, Keystore no Android), nunca em armazenamento simples.

Ciclo de vida do código:

- O código é definido por um administrador no ecrã de definições do Admin.
- Na base de dados é guardado apenas o seu hash (`pgcrypto`, `crypt` com salt),
  na coluna `groups.access_code_hash`. O código em claro nunca é persistido no
  servidor nem legível por qualquer política de leitura.
- `redeem_group_code` compara o código recebido com o hash e, em caso de
  correspondência, insere o vínculo. A função é a única via de escrita em
  `device_grants`; não existe política que permita inserção direta.
- Alterar o código no Admin apaga todas as linhas de `device_grants` do grupo,
  obrigando cada dispositivo a reintroduzi-lo. É este o mecanismo de revogação,
  usado quando alguém sai do grupo ou o código é divulgado.

Tabela de suporte:

```sql
CREATE TABLE public.device_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_user_id, group_id)
);
```

### 3.3 Limitação assumida

Sem autenticação individual, quem possua o código do grupo pode agir em nome de
qualquer perfil dentro desse grupo. Isto é aceite conscientemente: é proporcional
a um grupo fechado de amigos e fecha o acesso a estranhos, que era o risco real.

Se no futuro a aplicação passar a servir grupos que não confiam entre si, é
necessário migrar para autenticação individual (Supabase Auth por email e código
OTP). O desenho não impede essa migração.

## 4. Arquitetura

Projeto Expo novo em `c:\Users\TI\Desktop\APP_BRAS`, independente do repositório
web, que fica intacto. Os tipos e a lógica de domínio são copiados, não
partilhados por monorepo: a complexidade de workspaces não se justifica para um
único projeto consumidor.

```
app/                          expo-router, navegação por ficheiros
  (gate)/codigo.tsx           código do grupo, uma vez por dispositivo
  (gate)/perfil.tsx           seletor de perfil
  (mobile)/_layout.tsx        separadores inferiores
  (mobile)/index.tsx          Início
  (mobile)/noite.tsx          Noite ativa
  (mobile)/amigos.tsx
  (mobile)/historico.tsx
  (mobile)/memorias.tsx
  (mobile)/conquistas.tsx
  (admin)/_layout.tsx         drawer
  (admin)/index.tsx           overview
  (admin)/membros.tsx
  (admin)/produtos.tsx
  (admin)/sessoes.tsx
  (admin)/fotos.tsx
  (admin)/estatisticas.tsx
  (admin)/definicoes.tsx
  (admin)/supabase.tsx
  modals/nova-ronda.tsx
  modals/iniciar-noite.tsx
  modals/fechar-noite.tsx
  modals/pagar.tsx
  modals/qr.tsx
src/
  api/          cliente Supabase e um repositório por entidade
  domain/       funções puras: dívidas, totais, conquistas — cobertas por testes
  hooks/        hooks de query e mutation
  components/   UI partilhada
  theme/        cores e tokens do design atual
```

### 4.1 Porquê isolar `domain/`

O `store.tsx` atual mistura, num único ficheiro de 983 linhas, estado de UI,
persistência e cálculo financeiro. O cálculo de dívidas (`getMemberSessionDebt`,
divisão de consumo por membro dentro de `addRound`) é a zona onde um erro custa
dinheiro real a pessoas reais.

Extraído para funções puras sem dependência de React nem de rede, esse cálculo
testa-se de forma isolada e determinística. É também o único código desta
aplicação cuja correção não pode ser verificada só por inspeção visual.

### 4.2 Estado e sincronização

- **TanStack Query** para o estado do servidor: cache, revalidação e mutações
  otimistas.
- **Supabase Realtime** nas tabelas `sessions`, `rounds`, `payments` e `photos`,
  que já constam da publicação `supabase_realtime` no schema existente. É isto que
  faz o QR code da noite funcionar de facto: outro membro lê o código, entra na
  sessão, e uma ronda registada aparece em ambos os dispositivos.
- **Funcionamento sem rede**: o bar tem sinal fraco. O cache do TanStack Query é
  persistido em AsyncStorage e as mutações entram numa fila. É possível registar
  uma ronda sem rede e sincronizar mais tarde. O tipo `SyncStatus`, que já existe
  mas hoje é decorativo, passa a refletir o estado real da fila.

## 5. Substituição de dependências específicas da web

| Web atual | Equivalente React Native |
|---|---|
| Tailwind via `@tailwindcss/vite` | NativeWind v4 |
| `lucide-react` | `lucide-react-native` + `react-native-svg` |
| `recharts` | `react-native-gifted-charts` |
| `qrcode` (canvas) | `react-native-qrcode-svg`; leitura com `expo-camera` |
| `canvas-confetti` | `react-native-confetti-cannon` |
| `motion` | `react-native-reanimated` + `moti` |
| `localStorage` | AsyncStorage; segredos em `expo-secure-store` |
| `<input type="file">` | `expo-image-picker` |
| Descarregar CSV | `expo-file-system` + `expo-sharing` |

`react-native-gifted-charts` e AsyncStorage foram escolhidos em detrimento de
alternativas assentes em Skia ou MMKV para que o projeto continue a correr em
**Expo Go** durante o desenvolvimento. Sem isso, cada iteração exigiria uma build
nativa completa. A diferença de desempenho é irrelevante nesta escala de dados.

As versões concretas do SDK Expo e dos pacotes são fixadas no momento da
instalação, com `npx create-expo-app` e `npx expo install`, que resolvem as
versões compatíveis entre si. Não são fixadas nesta especificação.

## 6. Fases de entrega

Cada fase termina com a aplicação a correr num dispositivo, nunca com código
por terminar.

1. **Scaffold**: projeto Expo, NativeWind, tema, navegação e ecrãs vazios.
2. **Base de dados e acesso**: schema SQL corrigido, políticas RLS reescritas,
   `device_grants`, `redeem_group_code`, ecrã de código do grupo.
3. **Domínio**: lógica de dívidas, rondas e conquistas portada, com testes.
4. **Mobile**: os 6 separadores e os respetivos modais.
5. **Admin**: os 8 ecrãs.
6. **Sincronização**: tempo real e fila de mutações sem rede.
7. **Distribuição**: ícones, splash screen e EAS Build para Android e iOS.

## 7. Estratégia de testes

Desenvolvimento guiado por testes nas funções de `src/domain/`, onde residem os
cálculos monetários. Casos a cobrir: divisão de consumo com quantidades
fracionárias, ronda cancelada, membro que entra a meio da noite, pagamento
parcial, e histórico de preços (uma ronda antiga tem de manter o preço em vigor à
data, não o preço atual).

A interface é verificada a correr em dispositivo real. Não são prometidos testes
de interface automatizados, por não serem executáveis no ambiente de
desenvolvimento em uso.

## 8. Migração de dados

O ficheiro `mockData.ts` (667 linhas) é convertido num script de seed do Supabase,
fornecendo dados de demonstração para desenvolvimento e para o primeiro arranque.

## 9. Requisitos externos

- Conta Apple Developer para publicação na App Store: 99 USD por ano.
- Conta Google Play Developer: 25 USD, pagamento único.
- Projeto Supabase com as variáveis `EXPO_PUBLIC_SUPABASE_URL` e
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## 10. Fora de escopo

- Autenticação individual por utilizador.
- Notificações push.
- Continuação do desenvolvimento da aplicação web existente, que fica inalterada.
- Partilha de dados entre grupos distintos.
