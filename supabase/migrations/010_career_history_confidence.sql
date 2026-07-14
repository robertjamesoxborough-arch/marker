-- Session M: structured career history. career_history has always had
-- (id, user_id, role_title, company, start_date, end_date, description,
-- achievements) but no way to record parse confidence -- needed so a
-- low-confidence AI-parsed role can be flagged for the user to review
-- rather than silently presented as fact (Rob's explicit requirement:
-- "flag low-confidence parses rather than silently accepting them").
--
-- source distinguishes an AI-parsed row (needs review) from one the user
-- has since confirmed or hand-edited (source='user'), so a review flag
-- clears once the user has actually looked at and fixed/confirmed a row.

ALTER TABLE public.career_history
  ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'ai_parse';
