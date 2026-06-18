import { describe, it, expect } from 'vitest';
// The Edge Function's parsing helpers are pure (no Deno APIs), so we can unit
// test them from here even though they live under supabase/functions.
import { parseFixtures, parseOdds } from '../../../supabase/functions/_shared/apiFootball';

describe('parseFixtures', () => {
  it('maps a raw API-Football fixture and skips incomplete rows', () => {
    const raw = [
      {
        fixture: { id: 123, date: '2026-07-01T18:00:00+00:00', status: { short: 'NS' } },
        league: { name: 'Primeira Liga', season: 2026 },
        teams: { home: { name: 'SL Benfica' }, away: { name: 'FC Porto' } },
      },
      { fixture: { id: 999 }, teams: { home: { name: 'A' } } }, // incomplete -> skipped
    ];
    const out = parseFixtures(raw as never[], 'Primeira Liga');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      external_ref: '123',
      home: 'SL Benfica',
      away: 'FC Porto',
      status: 'scheduled',
      season: 2026,
    });
  });

  it('maps live and finished statuses', () => {
    const raw = [
      {
        fixture: { id: 1, date: '2026-07-01T18:00:00+00:00', status: { short: '2H' } },
        teams: { home: { name: 'A' }, away: { name: 'B' } },
      },
      {
        fixture: { id: 2, date: '2026-07-01T18:00:00+00:00', status: { short: 'FT' } },
        teams: { home: { name: 'C' }, away: { name: 'D' } },
      },
    ];
    const out = parseFixtures(raw as never[], 'X');
    expect(out[0]!.status).toBe('live');
    expect(out[1]!.status).toBe('finished');
  });
});

describe('parseOdds', () => {
  it('extracts 1X2, over/under and BTTS from the first bookmaker', () => {
    const raw = [
      {
        fixture: { id: 123 },
        bookmakers: [
          {
            bets: [
              {
                name: 'Match Winner',
                values: [
                  { value: 'Home', odd: '2.10' },
                  { value: 'Draw', odd: '3.30' },
                  { value: 'Away', odd: '3.40' },
                ],
              },
              {
                name: 'Goals Over/Under',
                values: [
                  { value: 'Over 2.5', odd: '1.80' },
                  { value: 'Under 2.5', odd: '1.95' },
                ],
              },
              {
                name: 'Both Teams Score',
                values: [
                  { value: 'Yes', odd: '1.70' },
                  { value: 'No', odd: '2.05' },
                ],
              },
            ],
          },
        ],
      },
    ];
    const out = parseOdds(raw as never[]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      external_ref: '123',
      odds: {
        '1x2': { home: 2.1, draw: 3.3, away: 3.4 },
        ou25: { over: 1.8, under: 1.95 },
        btts: { yes: 1.7, no: 2.05 },
      },
    });
  });

  it('omits markets with missing or invalid odds', () => {
    const raw = [
      {
        fixture: { id: 5 },
        bookmakers: [{ bets: [{ name: 'Match Winner', values: [{ value: 'Home', odd: '2.0' }] }] }],
      },
    ];
    const out = parseOdds(raw as never[]);
    expect(out).toHaveLength(0); // incomplete 1X2 -> no markets -> skipped
  });
});
