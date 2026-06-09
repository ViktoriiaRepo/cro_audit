# Folder Structure

Recommended monorepo layout for the MVP:

```text
cro_audit/
  apps/
    web/
      src/
        components/
        pages/
        features/
        styles/
        api/
    api/
      src/
        routes/
        controllers/
        services/
        scanner/
        scoring/
        exports/
        db/
  packages/
    shared/
      src/
        types/
        constants/
        utils/
  docs/
  supabase/
    migrations/
    seed/
```

## Why This Structure

- `apps/web` holds the UI.
- `apps/api` holds scan orchestration and business logic.
- `packages/shared` prevents duplicated types and scoring constants.
- `docs` holds product and technical decisions.
- `supabase` stores schema migrations and seed data.
