-- TEMPORARY, Stage 78 — supports the dev-only test-tier routes
-- (/freetier, /protier, /maxtier, /trialtier, /sandbox). See lib/test-routes.js
-- and the note at the top of PROGRESS.md: this column, the 5 accounts that
-- set it true, and the routes that sign into them must ALL be removed
-- together as soon as Stripe checkout is live and tested. Do not build
-- anything else that depends on this column existing long-term.
--
-- A plain boolean marker so the 5 pre-seeded test accounts can be excluded
-- from real analytics, the admin dashboard, and user counts without
-- guessing from email patterns. Table-level GRANTs already cover every
-- role on public.users (confirmed live), so a new column needs no
-- additional GRANT statement.
alter table public.users
  add column if not exists is_test_account boolean not null default false;
