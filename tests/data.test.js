'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../data/cards.js');
require('../data/decks.js');
require('../data/decks-guides.js');
require('../data/decks-community.js');
require('../data/staples.js');
const core = require('../src/core.js');

const ids = new Set(globalThis.ALYSION_CARDS.map((card) => card.id));
// The source page itself lists 49 main cards for this deck; it is reported in the app, not patched.
const KNOWN_SHORT = { 'Gaomon Digiburst Trashing': 49 };

test('every deck card exists in the card data', () => {
  for (const deck of globalThis.ALYSION_DECKS) {
    for (const { id } of core.parseDeckCards(`${deck.main} ${deck.eggs}`)) assert.ok(ids.has(id), `${deck.name}: ${id}`);
  }
});

test('guide decks carry their source and a link to the guide', () => {
  const guides = globalThis.ALYSION_DECKS.filter((deck) => deck.source === 'Simbozz');
  assert.equal(guides.length, 8);
  for (const deck of guides) {
    assert.match(deck.url, /^https:\/\/simbozz\.gg\/digimon-alysion\/decks\//, deck.name);
    assert.equal(deck.tier, '', deck.name);
  }
  assert.equal(new Set(globalThis.ALYSION_DECKS.map((deck) => deck.id)).size, globalThis.ALYSION_DECKS.length);
});

test('community decks are complete, legal and link to their source', () => {
  const cards = new Map(globalThis.ALYSION_CARDS.map((card) => [card.id, card]));
  const community = globalThis.ALYSION_DECKS.filter((deck) => deck.source === 'Community');
  assert.ok(community.length > 0);
  for (const deck of community) {
    assert.equal(core.deckSize(deck.main), 50, deck.name);
    assert.ok(core.deckSize(deck.eggs) <= 5, deck.name);
    assert.match(deck.url, /^https:\/\/alysioncards\.com\/decks\?deck=[\w-]+$/);
    for (const { id, qty } of core.parseDeckCards(`${deck.main} ${deck.eggs}`)) {
      assert.ok(qty <= core.copyLimit(cards.get(id)), `${deck.name}: ${id}`);
    }
  }
});

test('all 31 curated decks are present and every main deck has the expected size', () => {
  assert.equal(globalThis.ALYSION_DECKS.filter((deck) => deck.source !== 'Community').length, 31);
  assert.equal(globalThis.ALYSION_DECKS.filter((deck) => deck.tier).length, 17);
  for (const deck of globalThis.ALYSION_DECKS) {
    assert.equal(core.deckSize(deck.main), KNOWN_SHORT[deck.name] ?? 50, deck.name);
  }
});

test('every booster has its published rates and a card pool', () => {
  require('../data/packs.js');
  const boosters = globalThis.ALYSION_PACKS;
  assert.deepEqual(boosters.map((pack) => pack.id), ['BD-01', 'BD-02', 'BD-03', 'BD-04']);
  const pools = boosters.map((pack) => globalThis.ALYSION_CARDS.filter((card) => card.pack === pack.id));
  assert.deepEqual(pools.map((pool) => pool.length), [125, 121, 121, 125]);
  boosters.forEach((pack, index) => {
    // Base rarities plus alternate art add up to 100%.
    const total = (rates, extra) => Object.values(rates).reduce((sum, rate) => sum + rate, 0) + extra;
    assert.ok(Math.abs(total(pack.rates, pack.alternateArt) - 100) < 1e-6, pack.id);
    assert.ok(Math.abs(total(pack.guaranteed, pack.alternateArt) - 100) < 1e-6, pack.id);
    for (const rarity of Object.keys(pack.rates)) assert.ok(pools[index].some((card) => card.rarity === rarity), pack.id);
  });
});

test('every staple exists in the card data', () => {
  for (const list of Object.values(globalThis.ALYSION_STAPLES)) {
    for (const id of list.split(' ')) assert.ok(ids.has(id), id);
  }
});
