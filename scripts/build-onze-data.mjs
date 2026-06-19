#!/usr/bin/env node
/**
 * Build the Onze de Ouro player dataset (REAL data).
 *
 * Source: lbenz730/fifa_model — per-season FIFA player ratings scraped from
 * fifaindex.com (seasons 2005–2020), fields: name, rating (overall), club,
 * preferred_positions, headshot_url, nationality. We download each season,
 * filter to Liga Portugal clubs, normalise, and write a compact JSON bundled in
 * the app. Run: `node scripts/build-onze-data.mjs` (re-run to refresh).
 *
 * Data © fifaindex.com / EA Sports ratings — used here for a non-commercial,
 * play-money fan project.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'features', 'onze', 'data', 'onzeData.json');
const YEARS = Array.from({ length: 16 }, (_, i) => 2005 + i); // 2005..2020
const BASE = 'https://raw.githubusercontent.com/lbenz730/fifa_model/master/stats/player_stats_';

const LINE = {
  GK: 'GK',
  CB: 'DF', RB: 'DF', LB: 'DF', RWB: 'DF', LWB: 'DF', SW: 'DF',
  CDM: 'MF', DM: 'MF', CM: 'MF', CAM: 'MF', AM: 'MF', LM: 'MF', RM: 'MF',
  ST: 'FW', CF: 'FW', SS: 'FW', RW: 'FW', LW: 'FW', RF: 'FW', LF: 'FW',
};

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Map a raw club string to its canonical Liga Portugal name, or null if it's
 * not a Portuguese top-flight club. Rules are precise to avoid foreign false
 * positives (Porto Alegre, Internacional, Alavés, Hamilton "Academical", the
 * various "Nacional"/"Vitória" abroad, etc.).
 */
function canonClub(raw) {
  const n = norm(raw);
  const has = (...ks) => ks.every((k) => n.includes(k));
  if (n.includes('porto alegre') || n.includes('portuguesa') || n.includes('desportos')) return null;
  if (has('fc porto') || n === 'porto') return 'FC Porto';
  if (n.includes('benfica')) return 'Benfica';
  if (n.includes('sporting') && (n.includes('cp') || n.includes('lisbon') || n.includes('clube de portugal'))) return 'Sporting CP';
  if (n.includes('braga')) return 'SC Braga';
  if (n.includes('guimaraes')) return 'Vitória Guimarães';
  if (n.includes('setubal')) return 'Vitória Setúbal';
  if (n.includes('boavista')) return 'Boavista';
  if (n.includes('maritimo')) return 'Marítimo';
  if (n.includes('nacional') && (n.includes('madeira') || n.includes('funchal') || n.includes('cd nacional') || n.includes('desportivo nacional'))) return 'CD Nacional';
  if (n.includes('rio ave')) return 'Rio Ave';
  if (n.includes('belenenses')) return 'Belenenses';
  if (n.includes('academica') && n.includes('coimbra')) return 'Académica';
  if (n.includes('pacos')) return 'Paços de Ferreira';
  if (n.includes('estoril')) return 'Estoril';
  if (n.includes('moreirense')) return 'Moreirense';
  if (n.includes('arouca')) return 'Arouca';
  if (n.includes('tondela')) return 'Tondela';
  if (n.includes('famalicao')) return 'Famalicão';
  if (n.includes('gil vicente')) return 'Gil Vicente';
  if (n.includes('santa clara')) return 'Santa Clara';
  if (n.includes('portimonense')) return 'Portimonense';
  if (n.includes('chaves')) return 'GD Chaves';
  if (n.includes('feirense')) return 'Feirense';
  if (n.includes('leixoes')) return 'Leixões';
  if (n.includes('beira mar') || n.includes('beira-mar')) return 'Beira-Mar';
  if (n.includes('naval')) return 'Naval';
  if (n.includes('olhanense')) return 'Olhanense';
  if (n.includes('penafiel')) return 'Penafiel';
  if (n.includes('das aves') || n.includes('cd aves') || n.includes('deportivo aves')) return 'Desportivo das Aves';
  if (n.includes('vizela')) return 'Vizela';
  if (n.includes('casa pia')) return 'Casa Pia';
  if (n.includes('estrela') && n.includes('amadora')) return 'Estrela Amadora';
  if (n.includes('farense')) return 'Farense';
  if (n.includes('trofense')) return 'Trofense';
  if (n.includes('leiria')) return 'União de Leiria';
  return null;
}

function parseCSV(text) {
  const rows = [];
  let field = '', row = [], inq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inq = false; }
      else field += ch;
    } else if (ch === '"') inq = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function linesFor(posStr) {
  const out = [];
  for (const p of posStr.split('/')) {
    const l = LINE[p.trim().toUpperCase()];
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

const byYear = {};
const clubsSeen = new Set();

for (const year of YEARS) {
  const res = await fetch(`${BASE}${year}.csv`);
  if (!res.ok) { console.log(`! ${year}: ${res.status}`); continue; }
  const rows = parseCSV(await res.text());
  const header = rows[0];
  const idx = (k) => header.indexOf(k);
  const iName = idx('name'), iRating = idx('rating'), iClub = idx('club'),
    iPos = idx('preferred_positions'), iNat = idx('nationality');

  const clubs = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < header.length) continue;
    const clubRaw = row[iClub];
    const club = clubRaw ? canonClub(clubRaw) : null;
    if (!club) continue;
    const rating = parseInt(row[iRating], 10);
    const lines = linesFor(row[iPos] || '');
    if (!Number.isFinite(rating) || lines.length === 0) continue;
    clubsSeen.add(club);
    (clubs[club] ??= []).push({
      n: row[iName],
      r: rating,
      p: row[iPos],
      l: lines,
      ph: null, // fifaindex headshots are hotlink-blocked (403); use initials avatars
      nat: row[iNat] || null,
    });
  }

  // Per-club strength = average of the best 11 ratings; keep clubs with a full XI.
  const out = {};
  for (const [club, players] of Object.entries(clubs)) {
    if (players.length < 11) continue;
    players.sort((a, b) => b.r - a.r);
    const top11 = players.slice(0, 11);
    out[club] = { rating: Math.round(top11.reduce((s, p) => s + p.r, 0) / 11), players };
  }
  byYear[year] = out;
  console.log(`${year}: ${Object.keys(out).length} clubs, ${Object.values(out).reduce((s, c) => s + c.players.length, 0)} players`);
}

mkdirSync(dirname(OUT), { recursive: true });
const data = { years: YEARS.filter((y) => byYear[y] && Object.keys(byYear[y]).length >= 8), byYear };
writeFileSync(OUT, JSON.stringify(data));
console.log(`\nWrote ${OUT} (${(JSON.stringify(data).length / 1024).toFixed(0)} KB)`);
console.log(`Distinct clubs: ${[...clubsSeen].sort().join(', ')}`);
