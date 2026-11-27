'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.js');

const card = (id, rarity = 'C', extra = {}) => ({ id, name: id, rarity, restriction: '', ...extra });
const CARDS = new Map(
  [
    card('BT1-001', 'C'),
    card('BT1-002', 'U'),
    card('BT1-003', 'R'),
    card('BT1-004', 'SR'),
    card('P-001', 'P'),
    card('BT2-047', 'SR', { restriction: 'Restricted to 1' }),
  ].map((entry) => [entry.id, entry]),
);

const setup = () => {
  const state = core.createState();
  return { state, account: state.accounts[0], cp: state.cpTable };
};
const deck = (main, eggs = '', tier = 'A', name = 'Deck') => ({ id: name, name, tier, main, eggs, alternates: '' });

test('creates three separate accounts with default names and no CP', () => {
  const { state } = setup();
  assert.deepEqual(state.accounts.map((a) => a.name), ['Account 1', 'Account 2', 'Account 3']);
  assert.deepEqual(state.accounts.map((a) => a.cp), [0, 0, 0]);
  core.setQuantity(state.accounts[0], 'BT1-001', 'std', 3);
  assert.equal(core.ownedTotal(state.accounts[0], 'BT1-001'), 3);
  assert.equal(core.ownedTotal(state.accounts[1], 'BT1-001'), 0);
});

test('quantities stay whole numbers between 0 and 99 and empty cards are removed', () => {
  const { account } = setup();
  core.setQuantity(account, 'BT1-001', 'std', 150);
  assert.equal(core.getQuantity(account, 'BT1-001', 'std'), 99);
  core.setQuantity(account, 'BT1-001', 'std', 2.9);
  assert.equal(core.getQuantity(account, 'BT1-001', 'std'), 2);
  core.setQuantity(account, 'BT1-001', 'std', -4);
  assert.deepEqual(account.cards, {});
});

test('owned total adds every version', () => {
  const { account } = setup();
  core.setQuantity(account, 'BT1-001', 'std', 2);
  core.setQuantity(account, 'BT1-001', 'shiny', 1);
  core.setQuantity(account, 'BT1-001', 'premium', 1);
  assert.equal(core.ownedTotal(account, 'BT1-001'), 4);
});

const surplusRows = (result) => result.rows.map((r) => [r.id, r.version, r.owned, r.total, r.surplus, r.cpTotal]);

test('a foil on top of 4 standard copies leaves 1 standard copy as surplus', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-004', 'std', 4);
  core.setQuantity(account, 'BT1-004', 'shiny', 1);
  const result = core.surplus(account, CARDS, cp);
  assert.deepEqual(surplusRows(result), [['BT1-004', 'std', 4, 5, 1, 200]]);
  assert.equal(result.totalCp, 200);
  assert.equal(result.unknownCount, 0);
});

test('foils are surplus once there are no standard copies left to give up', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-004', 'shiny', 5);
  assert.deepEqual(surplusRows(core.surplus(account, CARDS, cp)), [['BT1-004', 'shiny', 5, 5, 1, 250]]);
});

test('listing surplus and ranking decks never change the collection', () => {
  const { state, account, cp } = setup();
  account.cp = 50;
  core.setQuantity(account, 'BT1-004', 'std', 6);
  core.setQuantity(account, 'P-001', 'std', 7);
  const before = structuredClone(state);
  core.surplus(account, CARDS, cp);
  core.rankDecks([deck('BT1-001*4')], account, CARDS, cp);
  assert.deepEqual(state, before);
});

test('4 copies across versions are never surplus', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-004', 'std', 3);
  core.setQuantity(account, 'BT1-004', 'shiny', 1);
  assert.deepEqual(core.surplus(account, CARDS, cp).rows, []);
});

test('surplus takes standard first, then foils, then alternate art', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-004', 'std', 3);
  core.setQuantity(account, 'BT1-004', 'shiny', 1);
  core.setQuantity(account, 'BT1-004', 'shinyPlus', 1);
  core.setQuantity(account, 'BT1-004', 'deluxe', 4);
  const result = core.surplus(account, CARDS, cp);
  assert.deepEqual(surplusRows(result), [
    ['BT1-004', 'std', 3, 9, 3, 600],
    ['BT1-004', 'shiny', 1, 9, 1, 250],
    ['BT1-004', 'shinyPlus', 1, 9, 1, null],
  ]);
  assert.equal(result.totalCp, 850);
});

test('surplus with an unknown value is listed but left out of the total', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-001', 'deluxe', 5);
  core.setQuantity(account, 'BT1-001', 'std', 5);
  const result = core.surplus(account, CARDS, cp);
  const deluxe = result.rows.find((r) => r.version === 'deluxe');
  assert.equal(deluxe.cpTotal, null);
  assert.equal(result.totalCp, 50);
  assert.equal(result.unknownCount, 1);
});

test('an edited CP value changes the surplus total', () => {
  const { account, cp } = setup();
  cp.C.deluxe.dust = 500;
  core.setQuantity(account, 'BT1-001', 'deluxe', 6);
  assert.equal(core.surplus(account, CARDS, cp).totalCp, 1000);
});

test('promo and restricted surplus is reported as locked', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'P-001', 'std', 6);
  core.setQuantity(account, 'BT2-047', 'std', 5);
  const result = core.surplus(account, CARDS, cp);
  assert.deepEqual(result.rows, []);
  assert.equal(result.totalCp, 0);
  assert.deepEqual(result.locked.map((r) => [r.id, r.surplus]), [['BT2-047', 1], ['P-001', 2]]);
});

test('deck is ready when every main and egg card is owned in any version', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-001', 'std', 2);
  core.setQuantity(account, 'BT1-001', 'shiny', 2);
  core.setQuantity(account, 'BT1-002', 'std', 1);
  const result = core.evaluateDeck(deck('BT1-001*4', 'BT1-002*1'), account, CARDS, cp);
  assert.equal(result.status, 'ready');
  assert.deepEqual([result.owned, result.required, result.craftCp], [5, 5, 0]);
  assert.deepEqual(result.missing, []);
});

test('deck is craftable when CP balance plus surplus covers the missing cards', () => {
  const { account, cp } = setup();
  account.cp = 100;
  core.setQuantity(account, 'BT1-003', 'std', 6);
  core.setQuantity(account, 'BT1-004', 'std', 3);
  const result = core.evaluateDeck(deck('BT1-004*4 BT1-003*4 BT1-002*1'), account, CARDS, cp);
  assert.equal(result.craftCp, 880);
  assert.equal(result.budget, 200);
  assert.equal(result.status, 'not-yet');
  account.cp = 780;
  const funded = core.evaluateDeck(deck('BT1-004*4 BT1-003*4 BT1-002*1'), account, CARDS, cp);
  assert.equal(funded.budget, 880);
  assert.equal(funded.status, 'craftable');
});

test('missing promo or restricted cards keep a deck at not yet', () => {
  const { account, cp } = setup();
  account.cp = 100000;
  const result = core.evaluateDeck(deck('P-001*2 BT2-047*1 BT1-001*1'), account, CARDS, cp);
  assert.equal(result.status, 'not-yet');
  assert.equal(result.uncraftable, 3);
  assert.equal(result.craftCp, 40);
});

test('a card listed in main and eggs adds up its requirement', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-001', 'std', 2);
  const result = core.evaluateDeck(deck('BT1-001*2', 'BT1-001*1'), account, CARDS, cp);
  assert.deepEqual([result.owned, result.required], [2, 3]);
});

test('decks are ordered from the highest to the lowest share of owned cards', () => {
  const { account, cp } = setup();
  core.setQuantity(account, 'BT1-002', 'std', 4);
  const list = [
    deck('BT1-004*4', '', 'S', 'nothing'),
    deck('BT1-002*4 BT1-004*4', '', 'S', 'half'),
    deck('BT1-002*3 BT1-004*1', '', '', 'most'),
    deck('BT1-002*2', '', 'C', 'full'),
  ];
  const ordered = core.rankDecks(list, account, CARDS, cp).map((r) => r.deck.name);
  assert.deepEqual(ordered, ['full', 'most', 'half', 'nothing']);
});

test('decks with the same share are ordered by status, then tier, then CP cost', () => {
  const { account, cp } = setup();
  account.cp = 100;
  core.setQuantity(account, 'BT1-002', 'std', 4);
  const half = (other, tier, name) => deck(`BT1-002*1 ${other}*1`, '', tier, name);
  const list = [
    half('BT1-004', 'S', 'not-yet-s'),
    half('BT1-001', '', 'unranked'),
    half('BT1-002', 'C', 'ignored'),
    half('BT1-003', 'B', 'too-dear-b'),
    half('BT1-001', 'B', 'cheap-b'),
    half('BT1-001', 'A', 'cheap-a'),
  ].filter((entry) => entry.name !== 'ignored');
  const ordered = core.rankDecks(list, account, CARDS, cp).map((r) => r.deck.name);
  assert.deepEqual(ordered, ['cheap-a', 'cheap-b', 'unranked', 'not-yet-s', 'too-dear-b']);
});

test('paste accepts the three line formats and sets quantities', () => {
  const result = core.parseImport('BT1-001 3\n\n 2 bt1-002 \nBT1-003 x4\n1x BT1-004 Some name', CARDS);
  assert.deepEqual(result.entries, [
    { id: 'BT1-001', qty: 3 },
    { id: 'BT1-002', qty: 2 },
    { id: 'BT1-003', qty: 4 },
    { id: 'BT1-004', qty: 1 },
  ]);
  assert.deepEqual(result.errors, []);
});

test('paste reads a version word and keeps each version apart', () => {
  const result = core.parseImport(
    'BT1-001 2\nBT1-001 1 shiny\nbt1-002 1 Shiny+\n3 BT1-003 alt\nBT1-004 x1 premium\nBT1-004 2 standard',
    CARDS,
  );
  assert.deepEqual(result.entries, [
    { id: 'BT1-001', qty: 2 },
    { id: 'BT1-001', qty: 1, version: 'shiny' },
    { id: 'BT1-002', qty: 1, version: 'shinyPlus' },
    { id: 'BT1-003', qty: 3, version: 'alt' },
    { id: 'BT1-004', qty: 1, version: 'premium' },
    { id: 'BT1-004', qty: 2 },
  ]);
  assert.deepEqual(result.errors, []);
});

test('paste rejects an unknown version word', () => {
  const result = core.parseImport('BT1-001 1 golden', CARDS);
  assert.deepEqual(result.entries, []);
  assert.deepEqual(result.errors.map((e) => e.line), [1]);
});

test('paste reports bad lines and keeps the valid ones', () => {
  const result = core.parseImport('hello\nBT9-999 2\nBT1-001 120\nBT1-002 2\nBT1-002 3', CARDS);
  assert.deepEqual(result.entries, [{ id: 'BT1-002', qty: 3 }]);
  assert.deepEqual(result.errors.map((e) => e.line), [1, 2, 3]);
});

test('staples missing lists cards under their limit with the tiered decks that use them', () => {
  const { account } = setup();
  core.setQuantity(account, 'BT1-001', 'std', 4);
  core.setQuantity(account, 'BT2-047', 'std', 1);
  const staples = { Red: 'BT1-001 BT1-002', Green: 'BT1-003 BT2-047' };
  const decks = [deck('BT1-003*4', '', 'S', 'a'), deck('BT1-003*1', 'BT1-002*1', 'C', 'b'), deck('BT1-002*4', '', '', 'c')];
  const result = core.missingStaples(staples, decks, account, CARDS);
  assert.deepEqual(
    result.map((r) => [r.id, r.color, r.owned, r.limit, r.decks]),
    [['BT1-003', 'Green', 0, 4, 2], ['BT1-002', 'Red', 0, 4, 1]],
  );
});

const COMMUNITY_CARDS = new Map(
  [
    ...Array.from({ length: 14 }, (_, i) => card(`BT9-${i + 1}`, 'C', { type: 'Digimon' })),
    card('BT9-100', 'U', { type: 'Digi-Egg' }),
    card('BT9-101', 'SR', { type: 'Option', restriction: 'Restricted to 1' }),
  ].map((entry) => [entry.id, entry]),
);
const fifty = (extra = {}) => {
  const list = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`BT9-${i + 1}`, 4]));
  return { ...list, 'BT9-13': 2, ...extra };
};
const shared = (name, cards, id = name) => ({ id, name, cards, description: 'ignored' });

test('community decks keep complete lists and split main deck from eggs', () => {
  const [deckOne] = core.communityDecks([shared('  My   deck  ', fifty({ 'BT9-100': 4 }), 'abc-1')], COMMUNITY_CARDS);
  assert.deepEqual(
    [deckOne.id, deckOne.name, deckOne.source, deckOne.tier, deckOne.url],
    ['ac-abc-1', 'My deck', 'Community', '', 'https://alysioncards.com/decks?deck=abc-1'],
  );
  assert.equal(core.deckSize(deckOne.main), 50);
  assert.equal(deckOne.eggs, 'BT9-100*4');
});

test('community decks drop incomplete, illegal, unknown and repeated lists', () => {
  const list = [
    shared('short', { ...fifty(), 'BT9-13': 1 }),
    shared('long', { ...fifty(), 'BT9-13': 3 }),
    shared('eggs', fifty({ 'BT9-100': 6 })),
    shared('five copies', { ...fifty(), 'BT9-1': 5, 'BT9-13': 1 }, 'five'),
    shared('restricted', { ...fifty(), 'BT9-13': 0, 'BT9-101': 2 }),
    shared('unknown', { ...fifty(), 'BT9-13': 1, 'XX9-1': 1 }),
    shared('bad quantity', { ...fifty(), 'BT9-13': '2' }, 'bad-quantity'),
    shared('', fifty({ 'BT9-100': 1 }), 'nameless'),
    shared('good', fifty()),
    shared('same cards again', fifty(), 'same-2'),
  ];
  assert.deepEqual(core.communityDecks(list, COMMUNITY_CARDS).map((d) => d.name), ['Untitled deck', 'good']);
});

test('community deck names are cut to 60 characters and unsafe ids are skipped', () => {
  const result = core.communityDecks(
    [shared('x'.repeat(90), fifty(), 'ok-1'), shared('bad id', fifty({ 'BT9-100': 1 }), 'a b/../c')],
    COMMUNITY_CARDS,
  );
  assert.deepEqual(result.map((d) => d.name), ['x'.repeat(60)]);
});

const digimon = (id, color, level, cost, extra = {}) =>
  card(id, 'C', { type: 'Digimon', color, level: `Lv.${level}`, cost: String(cost), dp: '2000', ...extra });
const SWAP_CARDS = new Map(
  [
    digimon('SW1-1', 'Blue', 3, 3, { name: 'Veemon' }),
    digimon('SW1-2', 'Blue', 3, 3),
    digimon('SW1-3', 'Blue', 3, 5),
    digimon('SW1-4', 'Red', 3, 3),
    digimon('SW1-5', 'Blue', 4, 3),
    card('SW1-6', 'C', { type: 'Option', color: 'Blue', level: '', cost: '3', dp: '' }),
    digimon('SW1-7', 'Blue/Green', 3, 3),
    digimon('SW1-8', 'Blue', 3, 3),
    digimon('SW1-9', 'Blue', 3, 7, { name: 'Veemon' }),
    digimon('SW1-10', 'Blue', 3, 3, { restriction: 'Restricted to 1' }),
    card('SW1-20', 'C', { type: 'Digi-Egg', color: 'Blue', level: 'Lv.2', cost: '', dp: '' }),
    card('SW1-21', 'C', { type: 'Digi-Egg', color: 'Blue', level: 'Lv.2', cost: '', dp: '' }),
    card('SW1-22', 'C', { type: 'Digi-Egg', color: 'Red', level: 'Lv.2', cost: '', dp: '' }),
  ].map((entry) => [entry.id, entry]),
);
const owning = (quantities) => {
  const { account } = setup();
  for (const [id, qty] of Object.entries(quantities)) core.setQuantity(account, id, 'std', qty);
  return account;
};
const swaps = (list, missing, quantities, limit) =>
  core.substitutes(list, missing, owning(quantities), SWAP_CARDS, limit).map((s) => [s.id, s.available, s.reason]);

test('substitutes share type, color and level with the missing card, closest cost first', () => {
  const owned = { 'SW1-2': 2, 'SW1-3': 4, 'SW1-4': 4, 'SW1-5': 4, 'SW1-6': 4, 'SW1-7': 1 };
  assert.deepEqual(swaps(deck('SW1-1*4'), 'SW1-1', owned), [
    ['SW1-2', 2, 'similar'],
    ['SW1-7', 1, 'similar'],
    ['SW1-3', 4, 'similar'],
  ]);
});

test('substitutes only offer copies the deck is not already using, up to the copy limit', () => {
  const owned = { 'SW1-2': 4, 'SW1-3': 4, 'SW1-10': 3 };
  assert.deepEqual(swaps(deck('SW1-1*4 SW1-2*3 SW1-3*4'), 'SW1-1', owned), [
    ['SW1-2', 1, 'similar'],
    ['SW1-10', 1, 'similar'],
  ]);
});

test('suggested swaps come first, then cards with the same name', () => {
  const list = { ...deck('SW1-1*4'), alternates: 'SW1-6>SW1-1+SW1-4 SW1-5>SW1-4' };
  const owned = { 'SW1-1': 1, 'SW1-2': 1, 'SW1-5': 1, 'SW1-6': 2, 'SW1-9': 1 };
  assert.deepEqual(swaps(list, 'SW1-1', owned), [
    ['SW1-6', 2, 'suggested'],
    ['SW1-9', 1, 'same-name'],
    ['SW1-2', 1, 'similar'],
  ]);
  assert.equal(swaps(list, 'SW1-1', owned, 2).length, 2);
});

test('a missing Digi-Egg is replaced only by Digi-Eggs of its color', () => {
  const owned = { 'SW1-2': 4, 'SW1-21': 4, 'SW1-22': 4 };
  assert.deepEqual(swaps(deck('', 'SW1-20*4'), 'SW1-20', owned), [['SW1-21', 4, 'similar']]);
});

test('deck sections split main deck and eggs, ordered by type, level and cost', () => {
  const account = owning({ 'SW1-5': 2, 'SW1-20': 4 });
  const sections = core.deckSections(deck('SW1-6*4 SW1-5*3 SW1-3*2 SW1-2*1', 'SW1-20*3'), account, SWAP_CARDS);
  assert.deepEqual(sections.main.map((c) => [c.id, c.need, c.owned]), [
    ['SW1-2', 1, 0],
    ['SW1-3', 2, 0],
    ['SW1-5', 3, 2],
    ['SW1-6', 4, 0],
  ]);
  assert.deepEqual(sections.eggs.map((c) => [c.id, c.need, c.owned]), [['SW1-20', 3, 3]]);
});

const PACK_CARDS = new Map(
  [
    card('PK1-1', 'C', { pack: 'PK-1' }),
    card('PK1-2', 'C', { pack: 'PK-1' }),
    card('PK1-3', 'SR', { pack: 'PK-1' }),
    card('PK2-1', 'C', { pack: 'PK-2' }),
    card('PK9-1', 'P', { pack: 'SHOP' }),
  ].map((entry) => [entry.id, entry]),
);
const PACK = { id: 'PK-1', slots: 6, rates: { C: 90, SR: 10 }, guaranteed: { SR: 100 } };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`);
const evaluate = (needs, owned = {}, packs = 1) =>
  core.evaluatePack(PACK, new Map(Object.entries(needs)), owning(owned), PACK_CARDS, core.defaultCpTable(), packs);

test('pack odds split each rarity rate evenly across the cards of that rarity', () => {
  const result = evaluate({ 'PK1-1': 1 });
  // The purchase here is a single pack: five normal slots plus the guaranteed one.
  close(result.expected, 1 - 0.55 ** 5);
  close(result.craftValue, (1 - 0.55 ** 5) * 40);
  close(result.anyChance, 1 - 0.55 ** 6);
});

test('the guaranteed slot counts toward needed copies', () => {
  const result = evaluate({ 'PK1-3': 2 });
  close(result.expected, 1 + (1 - 0.9 ** 5));
  close(result.craftValue, (1 + (1 - 0.9 ** 5)) * 800);
});

test('copies beyond what the account can keep count as CP back', () => {
  const result = evaluate({}, { 'PK1-1': 4, 'PK1-2': 4, 'PK1-3': 4 });
  close(result.expected, 0);
  close(result.anyChance, 0);
  close(result.dustValue, 2.25 * 10 * 2 + 1.5 * 200);
});

test('a pack ignores needed cards that come from elsewhere and lists its most valuable ones', () => {
  const result = evaluate({ 'PK1-1': 3, 'PK1-3': 1, 'PK2-1': 4, 'PK9-1': 2 });
  assert.equal(result.needed, 4);
  assert.deepEqual(result.top.map((entry) => entry.id), ['PK1-3', 'PK1-1']);
});

test('ten packs have fifty-nine normal slots and one guaranteed slot', () => {
  close(evaluate({ 'PK1-1': 4 }, {}, 10).expected, [0, 1, 2, 3].reduce((sum, k) => {
    let below = 0;
    let term = 0.55 ** 59;
    for (let i = 0; i <= k; i += 1) {
      below += term;
      term *= ((59 - i) / (i + 1)) * (0.45 / 0.55);
    }
    return sum + 1 - below;
  }, 0));
});

test('needed copies follow the chosen target', () => {
  const account = owning({ 'BT1-001': 1, 'BT2-047': 1, 'BT1-002': 4 });
  const decks = [deck('BT1-001*2 BT1-003*1', '', 'S'), deck('BT1-001*4', '', 'B'), deck('BT1-004*4', '', '')];
  const needs = (target) => Object.fromEntries(core.neededCopies(target, decks, { Red: 'BT1-002 BT1-003 BT2-047' }, account, CARDS));
  assert.deepEqual(needs('meta'), { 'BT1-001': 3, 'BT1-003': 1 });
  assert.deepEqual(needs('staples'), { 'BT1-003': 4 });
  assert.deepEqual(needs(decks[2]), { 'BT1-004': 4 });
  assert.deepEqual(needs('all'), { 'BT1-001': 3, 'BT1-003': 4, 'BT1-004': 4, 'P-001': 4 });
});

test('backup round trip restores accounts, versions and CP values', () => {
  const { state, account, cp } = setup();
  account.name = 'Main';
  account.cp = 320;
  core.setQuantity(account, 'BT1-001', 'shiny', 5);
  cp.R.alt.dust = 900;
  assert.deepEqual(core.parseBackup(core.serializeBackup(state)), state);
});

test('backup import rejects files that are not a valid backup', () => {
  const valid = JSON.parse(core.serializeBackup(core.createState()));
  const broken = (change) => {
    const copy = structuredClone(valid);
    change(copy);
    return JSON.stringify(copy);
  };
  assert.throws(() => core.parseBackup('not json'), /not valid JSON/);
  assert.throws(() => core.parseBackup('{}'), /not a collection backup/);
  assert.throws(() => core.parseBackup(broken((b) => b.accounts.pop())), /3 accounts/);
  assert.throws(() => core.parseBackup(broken((b) => (b.accounts[0].cp = -1))), /CP balance/);
  assert.throws(() => core.parseBackup(broken((b) => (b.accounts[0].cards = { 'BT1-001': { std: 'x' } }))), /quantity/);
  assert.throws(() => core.parseBackup(broken((b) => (b.cpTable.C.std.craft = 'free'))), /CP value/);
});
