-- Drop old unused columns from form_submissions
ALTER TABLE public.form_submissions
DROP COLUMN IF EXISTS reason,
DROP COLUMN IF EXISTS reason_other,
DROP COLUMN IF EXISTS cans_quantity,
DROP COLUMN IF EXISTS comments,
DROP COLUMN IF EXISTS email_updates_opt_in,
DROP COLUMN IF EXISTS area_code,
DROP COLUMN IF EXISTS number_of_adults,
DROP COLUMN IF EXISTS number_of_children;

-- Add new columns for the updated form
ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS number_of_participants integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS join_menorah_lighting boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS join_chanukah_party boolean NOT NULL DEFAULT false;