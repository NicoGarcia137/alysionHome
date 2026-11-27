// Refreshes data/cards.js from the public AlysionCards card endpoint.
// Usage: node tools/fetch-cards.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const SOURCE = 'https://alysioncards.com/api/cards';

const response = await fetch(SOURCE, { headers: { 'User-Agent': 'collection-tool/1.0' } });
if (!response.ok) throw new Error(`Card download failed: HTTP ${response.status}`);

const raw = await response.json();
if (!Array.isArray(raw) || raw.length === 0) throw new Error('Card download returned no cards');

const text = (value) => (typeof value === 'string' && value !== '-' ? value : '');

const cards = raw.map((card) => ({
  id: card.cardNumber,
  name: card.name,
  color: text(card.color),
  rarity: card.rarity,
  type: text(card.cardType),
  level: text(card.cardLv),
  cost: text(card.playCost),
  dp: text(card.dp),
  image: text(card.cardImage),
  restriction: text(card.restriction),
  pack: text(card.acquisition_info),
  effect: [card.effect, card.optionCardEffect, card.digivolveEffect, card.securityEffect]
    .map(text)
    .filter(Boolean)
    .join('\n'),
}));

const ids = new Set(cards.map((card) => card.id));
if (ids.size !== cards.length) throw new Error('Card download contains duplicate card numbers');

cards.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

const snapshot = new Date().toISOString().slice(0, 10);
const body = [
  `// Snapshot of ${SOURCE} taken on ${snapshot}. Card data belongs to its owners; personal use only.`,
  `globalThis.ALYSION_CARDS = ${JSON.stringify(cards)};`,
  `globalThis.ALYSION_SNAPSHOT = ${JSON.stringify(snapshot)};`,
  '',
].join('\n');

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/cards.js', import.meta.url), body, 'utf8');
console.log(`Saved ${cards.length} cards to data/cards.js`);
