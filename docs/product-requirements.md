# Product Requirements Document

## Product Summary

Build a SaaS MVP that helps users audit Shopify stores for CRO and UX issues. The system should scan a store, identify objective checklist signals, pre-fill parts of an audit, and always allow manual review before export.

## Product Goal

Help users create faster, more consistent Shopify CRO audits without pretending to replace human strategy.

## Non-Goals

- Do not fully automate CRO strategy.
- Do not generate final recommendations without human review.
- Do not support every ecommerce platform in the MVP.
- Do not overbuild AI features in version 1.

## Core User Flow

1. User enters a Shopify store URL.
2. The backend scans the storefront.
3. The system detects Shopify and checks key pages.
4. The scanner extracts CRO signals and page metadata.
5. The app generates an editable audit table.
6. The user manually changes assessments, notes, and priorities.
7. The app recalculates scores in real time.
8. The user exports the audit.

## MVP Scope

### Must Have

- Create audit
- Scan URL
- Detect Shopify
- Generate checklist
- Auto-fill assessment where possible
- Manual editing
- Score calculation
- Export to CSV, XLSX, and PDF
- Persist audits in Supabase

### Nice to Have Later

- AI-generated recommendations
- Historical comparisons
- Team collaboration
- Scheduled re-scans
- Screenshot annotations

## Automatic Checks for MVP

- Shopify detected
- Announcement bar present
- Search present
- Cart present
- Add to Cart button present on PDP
- Sticky Add to Cart present
- Reviews present
- Product ratings visible
- Bundles or upsells present
- Wishlist present
- Policy links present
- Free shipping messaging present
- Social links present
- Mobile menu present
- H1 present
- Meta title present
- Meta description present
- Broken links detected
- PageSpeed score available

## UX Requirements

- The checklist must be editable row by row.
- Users must be able to override any auto-filled value.
- The UI must show scan status and partial results clearly.
- The audit table should support large datasets without becoming cluttered.
- Scores should update immediately after edits.

## Success Criteria

- A user can create an audit in less than 2 minutes.
- A user can export a usable report from one scanned URL.
- Auto-fill should cover technical checks where possible.
- Manual edits should always remain the source of truth.
