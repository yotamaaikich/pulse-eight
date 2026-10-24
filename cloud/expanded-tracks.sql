-- Longer full-song arrangements can exceed 2,000 successful notes.
-- Retains the existing scores and only raises the combo validation ceiling.
begin;
alter table public.pulse_keys_scores drop constraint pulse_keys_scores_max_combo_check;
alter table public.pulse_keys_scores add constraint pulse_keys_scores_max_combo_check check(max_combo between 0 and 4096);
commit;
