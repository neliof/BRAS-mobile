# Brás Aquele Bar — Mobile App

React Native + Expo + Supabase. Gestão de noites de bar, rondas, dívidas, fotos.

## Quick Start

1. **Migrações no Supabase:** Ver [MIGRACAO_DETALHA.md](.superpowers/sdd/2026-08-15-fundacao/MIGRACAO_DETALHA.md)
2. **Usar a app:** Ver [GUIA_USUARIO.md](.superpowers/sdd/2026-08-15-fundacao/GUIA_USUARIO.md)

## Desenvolvimento

```bash
npm install
npx expo start
```

Abre Expo Go no telemóvel, scan QR code.

## Testes

```bash
npx jest
npx tsc --noEmit
```

## Arquitetura

- **Frontend:** React Native (Expo Router)
- **State:** TanStack Query (React Query) com persistência
- **API:** Supabase (PostgreSQL + RLS)
- **Offline:** AsyncStorage para fila de mutações e cache

## Docs

- `supabase/README.md` — schema e migrações
- `.superpowers/sdd/2026-08-15-fundacao/progress.md` — histórico de desenvolvimento
- `.superpowers/sdd/2026-08-15-fundacao/CHECKLIST_TESTE.md` — test checklist
