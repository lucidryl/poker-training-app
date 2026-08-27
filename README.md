# Poker Training App

Aplicación web multi-jugador en tiempo real para partidas de Texas Hold'em No-Limit, enfocada en salas de entrenamiento privadas (fichas ficticias / play money).

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Radix UI
- **Backend:** Supabase (PostgreSQL, Realtime, Auth)
- **Motor de juego:** TypeScript puro (`lib/poker-engine`), evaluación de manos con `pokersolver`
- **Despliegue:** Vercel (CI/CD desde GitHub, rama `main`)

## Estructura

```
app/                    # Rutas (App Router)
  room/[code]/          # Sala de juego privada
  api/rooms/            # Endpoints: crear sala, acciones de juego
components/poker/       # Table, PlayerSeat, BetControls, HandHistory
lib/poker-engine/        # deck.ts, evaluator.ts, pots.ts, rules.ts
lib/supabase/            # client.ts (browser), server.ts (RSC/Route Handlers), types.ts
supabase/migrations/     # Esquema SQL + RLS
```

## Setup local

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Configurar Supabase**
   ```bash
   cp .env.example .env.local
   # Completar NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   # SUPABASE_SERVICE_ROLE_KEY con los valores de tu proyecto Supabase.

   npx supabase login
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push   # aplica supabase/migrations/*.sql
   ```

3. **Regenerar tipos de la base de datos**
   ```bash
   npx supabase gen types typescript --project-id <tu-project-ref> > lib/supabase/types.ts
   ```

4. **Correr en desarrollo**
   ```bash
   npm run dev
   ```

## Despliegue

Conectar el repositorio en Vercel → Import Project. Definir las mismas variables de `.env.example` como Environment Variables del proyecto en Vercel. Cada push a `main` dispara un build+deploy automático.

## Estado del scaffolding

Este repo contiene la estructura, configuración, esquema de base de datos (con RLS para ocultar cartas privadas) y stubs tipados de componentes/motor de juego descritos en la especificación. Pendiente de implementar (marcado con `TODO` en el código):

- Lógica completa de rondas de apuestas y transición de fases en `app/api/rooms/[code]/action`.
- `determineWinners` en `lib/poker-engine/evaluator.ts` (desempate/kickers vía `pokersolver`).
- Suscripción Realtime y sincronización de estado en `app/room/[code]/page.tsx`.
- Autenticación (Supabase Auth) y flujo de creación/unión a sala.
- Overlay de probabilidades (equity), Hand Replayer y personalización de mesa (sección 5).
