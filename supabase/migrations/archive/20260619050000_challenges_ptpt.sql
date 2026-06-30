-- ============================================================================
-- Arentim — translate the challenge catalog to Português de Portugal.
--
-- The challenge titles/descriptions are stored in public.challenge_catalog and
-- surfaced via list_challenges. The original seed (…220000_challenges) was in
-- English; the rescale (…010000) localised a few descriptions. This finishes
-- the job: every title + remaining description in PT-PT. Targets/rewards are
-- left untouched (set by the rescale migration). Idempotent.
-- ============================================================================

update public.challenge_catalog set title = 'De volta ao jogo',  description = 'Jogar 5 lances'                              where key = 'rebuild_play5';
update public.challenge_catalog set title = 'Encontrar o ritmo', description = 'Ganhar 3 lances'                             where key = 'rebuild_win3';
update public.challenge_catalog set title = 'A ficar a sério',   description = 'Apostar 500 Tostões no total'                where key = 'wager_5k';
update public.challenge_catalog set title = 'Grande apostador',  description = 'Apostar 5 000 Tostões no total'              where key = 'wager_50k';
update public.challenge_catalog set title = 'Em maré de sorte',  description = 'Atingir uma sequência de 5 dias'             where key = 'streak_5';
update public.challenge_catalog set title = 'Grande golpe',      description = 'Ganhar 500 Tostões num só lance'             where key = 'bigwin_5k';
update public.challenge_catalog set title = 'Ás das múltiplas',  description = 'Acertar uma múltipla vencedora de 3 jogos'   where key = 'parlay_3leg';
update public.challenge_catalog set title = 'Experiente',        description = 'Ganhar 25 lances'                            where key = 'win_25';
