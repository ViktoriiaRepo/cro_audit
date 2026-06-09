# Recommended Database Schema

Use Supabase Postgres as the persistence layer. Keep the schema simple for the MVP and store structured audit data in normalized tables with JSONB only where it helps flexibility.

## Tables

### `shops`

Stores the storefront being audited.

- `id` uuid primary key
- `user_id` uuid nullable, auth user reference
- `url` text unique not null
- `domain` text not null
- `is_shopify` boolean not null default false
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### `audits`

Represents one audit run for one shop.

- `id` uuid primary key
- `shop_id` uuid not null references `shops(id)`
- `name` text nullable
- `status` text not null, values like `draft`, `scanning`, `ready`, `failed`
- `overall_score` numeric nullable
- `performance_score` numeric nullable
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### `audit_pages`

Stores scanned pages and discovery results.

- `id` uuid primary key
- `audit_id` uuid not null references `audits(id)`
- `page_type` text not null, values like `homepage`, `collection`, `product`, `cart`, `policy`, `other`
- `url` text not null
- `status_code` integer nullable
- `title` text nullable
- `meta_description` text nullable
- `h1_text` text nullable
- `screenshot_url` text nullable
- `raw_data` jsonb not null default '{}'::jsonb
- `created_at` timestamptz not null default now()

### `audit_items`

Stores each checklist row and its editable audit state.

- `id` uuid primary key
- `audit_id` uuid not null references `audits(id)`
- `item_key` text not null
- `item_number` integer not null
- `item_label` text not null
- `assessment` text not null, values `good`, `can_be_improved`, `bad`, `irrelevant`
- `impact` text not null, values `high`, `medium`, `low`
- `example` text nullable
- `notes` text nullable
- `findings` text nullable
- `page_url` text nullable
- `priority_score` numeric nullable
- `priority_label` text nullable
- `impact_score` numeric nullable
- `full_impact_score` numeric nullable
- `performance_score` numeric nullable
- `auto_filled` boolean not null default false
- `source` text nullable, values like `scan`, `manual`, `default`
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### `scan_findings`

Optional detail table for machine-detected signals.

- `id` uuid primary key
- `audit_id` uuid not null references `audits(id)`
- `page_url` text not null
- `finding_type` text not null
- `finding_value` text nullable
- `confidence` numeric nullable
- `metadata` jsonb not null default '{}'::jsonb
- `created_at` timestamptz not null default now()

## Recommended Constraints

- Unique index on `audit_items(audit_id, item_key)`.
- Unique index on `audit_pages(audit_id, page_type, url)`.
- Index `audits(shop_id)` for fast lookup.
- Keep timestamps updated in the application layer or with a trigger.

## Notes

- Use `audit_items` as the editable source of truth for the UI.
- Use `scan_findings` for traceability, not for user-facing scoring.
- Store scanner output in `raw_data` only when the app does not need to query it frequently.
