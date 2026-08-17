# BRÁS Mobile — Plano 2: Interface Móvel

Data: 2026-08-17
Estado: Em rascunho para aprovação

## 1. Contexto

Plano 1 (Fundação) entregue: scaffold Expo, lógica de domínio testada, Supabase RLS, porta de acesso, seleção de perfil.

Plano 2 constrói a interface do utilizador móvel: 6 separadores inferiores, 5 modais, integração com Supabase em tempo real, suporte para offline.

## 2. Escopo

### 2.1 Separadores (6)

1. **Início** — dashboard, próxima noite, atalhos
2. **Noite ativa** — sessão aberta, rondas, consumo, dívida
3. **Amigos** — lista de membros, estatísticas pessoais
4. **Histórico** — noites passadas, replay, detalhes
5. **Memórias** — fotos, stories, tagged moments
6. **Troféus** — conquistas, progress, leaderboard

### 2.2 Modais (5)

1. **Iniciar noite** — escolher grupo, bar, membros presentes
2. **Nova ronda** — selecionar produtos, quantidade, divisão de consumo
3. **QR code** — partilhar código da noite, entrada de convidados
4. **Pagar dívida** — seleção de método, confirmação
5. **Fechar noite** — rating, quote of the night, memory notes

### 2.3 Dados

- Sessões (CRUD via Supabase)
- Rondas (create, read, cancel)
- Consumo por membro (divisão automática)
- Pagamentos (status, método)
- Fotos (upload, tagged)
- Conquistas (earned_at)

### 2.4 Características

- **Realtime:** Supabase subscriptions em sessions, rounds, payments, photos
- **Offline:** fila de mutações, retry ao conectar
- **UI:** NativeWind v4, cores `#F27D26` (brand) e `#12161F` (fundo)
- **Texto:** português de Portugal

## 3. Arquitetura

### 3.1 Estrutura de ficheiros

```
app/(mobile)/
  _layout.tsx          bottom tabs (6), layout wrapper
  index.tsx            Início
  noite.tsx            Noite ativa
  amigos.tsx           Amigos
  historico.tsx        Histórico
  memorias.tsx         Memórias
  conquistas.tsx       Troféus

app/modals/
  iniciar-noite.tsx
  nova-ronda.tsx
  qr-code.tsx
  pagar-dívida.tsx
  fechar-noite.tsx

src/api/
  sessions.ts          queries, mutations
  rounds.ts
  payments.ts
  photos.ts
  profiles.ts

src/hooks/
  useSession.tsx
  useRounds.tsx
  usePayments.tsx
  usePhotos.tsx
  useSyncStatus.tsx    realtime + offline queue

src/components/mobile/
  SessionCard.tsx
  RoundItem.tsx
  MemberDebt.tsx
  PhotoGallery.tsx
  AchievementBadge.tsx
```

### 3.2 Estado

TanStack Query para servidor (cache, revalidação).
Supabase Realtime para updates em tempo real.
AsyncStorage para cache persistence.
Fila de mutações para offline.

### 3.3 Fluxos principais

**Iniciar noite:**
1. Modal pede grupo, bar, membros
2. Cria sessão em Supabase
3. Gera código de acesso (QR)
4. Mostra "Noite ativa"

**Registar ronda:**
1. Modal seleciona produtos
2. Especifica quantidade por membro
3. Calcula divisão (domain/debt.ts)
4. Insere em rounds table
5. Realtime atualiza para outros membros

**Pagar dívida:**
1. Mostra dívida acumulada
2. Seleciona método
3. Marca como paid
4. Realtime atualiza status

**Fechar noite:**
1. Modal: rating (1-5), quote, notas
2. Atualiza sessions.status = 'closed'
3. Arquivo: rondas, consumo, pagamentos

## 4. Integração com Plano 1

- **Tipos:** Reutiliza `Session`, `Round`, `Payment`, `Profile` de Tasks 1-2
- **Domínio:** Usa `computeMemberDebt`, `buildRound` de Tasks 3-6
- **Supabase:** Queries contra schema de Task 7
- **Cliente:** Usa `supabase` client de Task 8
- **Context:** Estende `SessionProvider` de Task 10

## 5. Realtime + Offline

### 5.1 Realtime

```typescript
supabase
  .channel(`session:${sessionId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rounds' }, handleNewRound)
  .subscribe()
```

Tabelas com realtime (já ativadas em Plano 1):
- `sessions`
- `rounds`
- `payments`
- `photos`

### 5.2 Offline

Fila de mutações: quando offline, salva mutation em AsyncStorage. Ao reconectar, retry.

`SyncStatus` do Plano 1 mostra estado (syncing, synced, pendingCount).

## 6. Testes

- Domain logic já testada (Plano 1)
- UI verificada em emulador/telemóvel real
- Integração com Supabase em staging
- Fluxos de offline em isolation

## 7. Fora de escopo

- Push notifications
- Analytics
- A/B testing
- Internacionalização (só pt-PT)
- Acessibilidade avançada
- Dark mode toggle (sempre escuro)

## 8. Cronograma

~15-20 tarefas, ~20h de execução.

Após aprovação, inicia Plano 3 (Admin).
