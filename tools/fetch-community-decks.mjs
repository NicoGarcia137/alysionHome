// Refreshes data/decks-community.js from the shared lists on AlysionCards.
// Usage: node tools/fetch-community-decks.mjs
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../data/cards.js');
const core = require('../src/core.js');

const SOURCE = 'https://alysioncards.com/api/community/decks';
const MAX_PAGES = 100;

const shared = [];
for (let page = 1; page <= MAX_PAGES; page += 1) {
  const response = await fetch(`${SOURCE}?limit=50&page=${page}`, { headers: { 'User-Agent': 'collection-tool/1.0' } });
  if (!response.ok) throw new Error(`Deck download failed on page ${page}: HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.decks)) throw new Error(`Unexpected answer on page ${page}`);
  shared.push(...body.decks);
  if (!body.hasNext) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const cards = new Map(globalThis.ALYSION_CARDS.map((card) => [card.id, card]));
const decks = core.communityDecks(shared, cards);
if (!decks.length) throw new Error('No complete decks found; the previous file was kept.');

const snapshot = new Date().toISOString().slice(0, 10);
const body = [
  `// Complete shared lists from ${SOURCE}, taken on ${snapshot}.`,
  '// Written by players and not rated. Only the name, id and cards are kept.',
  `globalThis.ALYSION_DECKS.push(...${JSON.stringify(decks, null, 1)});`,
  '',
].join('\n');

await writeFile(new URL('../data/decks-community.js', import.meta.url), body, 'utf8');
console.log(`Saved ${decks.length} of ${shared.length} shared lists to data/decks-community.js`);
