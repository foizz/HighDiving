-- Allow two divers to share a finishing position.
--
-- 0002 originally made (competition_id, rank) unique, which forbids a tie. That is wrong:
-- divers do tie, and the rules handle it rather than preventing it — "If for example two
-- divers are in first place, both get the prize money for the 1st place and in terms of
-- points for the World Series both will get 20 points" (Red Bull 3.3.2). The 2025 World
-- Championships men's event and the 2025 World Cup women's event each have a shared
-- placing, so the real data breaks the constraint.
--
-- The primary key on (competition_id, diver_id) still stops a diver being recorded twice
-- in one competition, which is the thing that genuinely cannot happen.
--
-- Safe to run whether or not the index was ever created. 0002 no longer creates it, so a
-- fresh project never has it and this is a no-op.

drop index if exists public.results_one_diver_per_rank;
