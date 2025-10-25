# Welcome to your Lovable project

## Project info

## How can I edit this code?

There are several ways of editing your application.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

````sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
## stockwise-receipt — technical README

This repository contains the frontend application for a small offline-capable shop stock & sales tracker. The app is built with Vite + React + TypeScript and uses an IndexedDB-based local storage layer for offline-first behavior. A Supabase client also exists for optional remote sync or hosted features.

This README documents the project layout, where features live, how to run the app locally, and quick notes about where to change behaviour.

## Quick facts

- Project root: `c:/Users/Jason/stockwise-receipt`
- Frontend: Vite + React + TypeScript
- UI: shadcn-ui-derived components plus custom `src/components/ui` wrappers
- Offline storage: IndexedDB wrapper in `src/storage/DatabaseManager.ts` and `src/storage/StorageService.ts`
- Remote: Supabase client in `src/integrations/supabase/client.ts` (publishable key present in repo)
- State/data managers: `src/managers/*` (ProductManager, SalesManager, StockManager, etc.)
- App entry: `src/main.tsx` -> `src/App.tsx` -> `src/pages/*`

## How to run (dev / build)

Primary npm scripts (from `package.json`):

```powershell
# install
npm install

# start dev server (Vite)
npm run dev

# build for production
npm run build

# preview production build
npm run preview

# lint the project
npm run lint
````

Notes:

- Vite dev server binds to port 8080 (configured in `vite.config.ts`).
- The project uses `@` path alias -> `./src` (see `vite.config.ts` and `tsconfig.json`).

## High-level file map

- `src/main.tsx` — React entry that mounts the app.
- `src/App.tsx` — top-level providers (React Query, routing, tooltip, toasters), routes: `/`, `/auth`, and a catch-all `*`.
- `src/pages/` — route pages: `Index.tsx`, `Auth.tsx`, `NotFound.tsx`.
- `src/components/ShopTracker.tsx` — main shop UI component. Exposes Dashboard, Restocking, Sales, Reports tabs and initializes offline managers.
- `src/components/shop/*` — feature UIs: `Dashboard.tsx`, `Restocking.tsx`, `Sales.tsx`, `Reports.tsx`, `ProductForm.tsx`.
- `src/components/ui/*` — UI primitives & wrappers (buttons, cards, toast, inputs etc.) used throughout the app.
- `src/managers/*` — business logic / data managers that operate on storage:
  - `ProductManager.ts` — create/edit/search products, import.
  - `SalesManager.ts` — record sales and query sales history (used by UI and reports).
  - `StockManager.ts` — log stock movements and query by date or product.
  - `StaffManager.ts`, `SettingsManager.ts` — other business concerns.
- `src/storage/DatabaseManager.ts` — IndexedDB schema and open/destroy helpers.
- `src/storage/StorageService.ts` — higher-level wrapper for CRUD operations the managers call (used by managers).
- `src/hooks/useShopData.ts` — React hook that wires ProductManager + SalesManager into the UI (loads initial data, exposes refresh functions).
- `src/integrations/supabase/*` — generated supabase client (`client.ts`, `types.ts`). The client includes a publishable key and URL.
- `supabase/migrations/` — SQL migrations for the remote DB (if using Supabase server-side functionality).

## Feature → file mapping (common edits)

- Change UI for dashboard metrics: edit `src/components/shop/Dashboard.tsx` and `src/components/ShopTracker.tsx` for metric calculations.
- Change product fields/validation or storage shape: edit `src/types/business.ts` and `src/managers/ProductManager.ts`.
- Change how sales are recorded/calculated: edit `src/managers/SalesManager.ts` and `src/components/shop/Sales.tsx`.
- Change restocking workflows: edit `src/components/shop/Restocking.tsx` and `src/managers/StockManager.ts`.
- Change IndexedDB schema (store names / indexes): edit `src/storage/DatabaseManager.ts` (careful: this affects migrations and existing user data).
- Add/modify sync to Supabase: edit `src/integrations/supabase/client.ts` (or wrap it with a new sync service) and create syncing logic that reconciles local `StorageService` with remote.

## Data flow & contracts (short)

- StorageService provides CRUD ops for named stores (`products`, `sales`, `stock_movements`, `staff`, `business_settings`).
- Managers (ProductManager, SalesManager, StockManager) call `StorageService` and implement business rules (validation with `zod` in ProductManager).
- `useShopData` initializes managers at boot and exposes `products`, `sales`, `productManager`, `salesManager`, and `refreshData` for UI components to call.

## Important implementation details discovered

- Offline-first: the app uses an IndexedDB DB per client (name `shop_db_<clientId>`) created in `DatabaseManager`.
- Client ID generation: `getClientId()` stored in `localStorage` (used by `useShopData` and `ShopTracker`).
- Supabase: `src/integrations/supabase/client.ts` contains a published URL and publishable key. If you plan server-side operations or secret keys, switch to environment variables and do not commit secret keys.
- Routing: React Router v6 is used in `src/App.tsx`. Add routes there.
- Design system: UI building blocks live in `src/components/ui/*` and follow shadcn-like APIs.

## Where to make common changes (step-by-step examples)

- Add a product field (example: `supplier_code`):

  1.  Update the shape in `src/types/business.ts`.
  2.  Update `productSchema` (zod) in the same file to validate the new field.
  3.  Update any forms / components that create or edit products, e.g. `src/components/shop/ProductForm.tsx`.
  4.  Update any mapping code that reads product fields (e.g. `ShopTracker`'s transformations).

- To change how low-stock alerts are computed: edit `src/components/ShopTracker.tsx` (UI) and optionally `ProductManager.lowStockAlerts()` (storage-side filter).

## Dev tips

- Path alias: import with `@/` (maps to `src/`).
- Formatting/linting: the repo includes ESLint; run `npm run lint`.
- Dev-only plugin: `lovable-tagger` runs in dev per `vite.config.ts`.

## Security & maintenance notes

- A Supabase publishable key is checked into `src/integrations/supabase/client.ts`. This is a public key but be mindful: do not add service_role or other secrets into the frontend.
- If you plan server-side sync, move secret keys to environment variables and reference them from server code.

## Files changed by this update

- `README.md` — replaced with this technical README (this is the current change).

---

If you'd like, I can:

- add a short `docs/` folder with feature-specific notes and diagrams;
- create small unit tests for `ProductManager` and `StockManager` using Jest (or vitest);
- implement a simple Supabase sync example (one-way push from local IndexedDB to Supabase) behind a feature flag.

Tell me which follow-up you'd like and I'll implement it next.
