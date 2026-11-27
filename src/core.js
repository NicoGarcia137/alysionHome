// Collection rules. No DOM access: used by the page and by the tests.
(function (root) {
  'use strict';

  const ACCOUNTS = 3;
  const KEEP = 4;
  const MAX_QTY = 99;
  const TIERS = ['S', 'A', 'B', 'C', ''];
  const STATUSES = ['ready', 'craftable', 'not-yet'];
  const CARD_ID = /^[A-Z]+\d*-\d+$/;

  const VERSIONS = [
    { key: 'std', label: 'Standard' },
    { key: 'shiny', label: 'Shiny' },
    { key: 'shinyPlus', label: 'Shiny+' },
    { key: 'alt', label: 'Alt Art' },
    { key: 'deluxe', label: 'Deluxe Alt Art' },
    { key: 'premium', label: 'Premium Alt Art' },
  ];

  // [craft, disassemble] per version. null means unknown: it is never guessed.
  const DEFAULT_CP = {
    C: { std: [40, 10], shiny: [60, 15] },
    U: { std: [80, 20], shiny: [120, 30], shinyPlus: [160, null] },
    R: { std: [200, 50], shiny: [300, null], alt: [null, 800], deluxe: [12000, null], premium: [18000, null] },
    SR: { std: [800, 200], shiny: [1000, 250], shinyPlus: [1200, null], deluxe: [12000, 3000], premium: [18000, null] },
    SEC: { std: [2400, 600], shiny: [3000, null], alt: [3200, null] },
  };

  const byId =(a, b) => a.localeCompare(b, 'en', { numeric: true });
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

  function defaultCpTable() {
    const table = {};
    for (const [rarity, values] of Object.entries(DEFAULT_CP)) {
      table[rarity] = {};
      for (const { key } of VERSIONS) {
        const [craft, dust] = values[key] || [null, null];
        table[rarity][key] = { craft, dust };
      }
    }
    return table;
  }

  function createState() {
    return {
      version: 1,
      accounts: Array.from({ length: ACCOUNTS }, (_, i) => ({ name: `Account ${i + 1}`, cp: 0, cards: {} })),
      cpTable: defaultCpTable(),
      lastExport: null,
    };
  }

  function getQuantity(account, id, version) {
    return (has(account.cards, id) && account.cards[id][version]) || 0;
  }

  function setQuantity(account, id, version, quantity) {
    const value = Math.min(MAX_QTY, Math.max(0, Math.trunc(Number(quantity) || 0)));
    const entry = has(account.cards, id) ? account.cards[id] : {};
    if (value) entry[version] = value;
    else delete entry[version];
    if (Object.keys(entry).length) account.cards[id] = entry;
    else delete account.cards[id];
  }

  function ownedTotal(account, id) {
    return VERSIONS.reduce((sum, { key }) => sum + getQuantity(account, id, key), 0);
  }

  // Promo and restricted cards can be neither crafted nor disassembled.
  const isLocked = (card) => card.rarity === 'P' || Boolean(card.restriction);
  const copyLimit = (card) => (card.restriction ? 1 : KEEP);

  function surplus(account, cards, cpTable) {
    const result = { rows: [], locked: [], totalCp: 0, unknownCount: 0 };
    for (const id of Object.keys(account.cards).sort(byId)) {
      const card = cards.get(id);
      if (!card) continue;
      // Every version counts toward the same 4 copies of a card.
      const total = ownedTotal(account, id);
      let excess = total - KEEP;
      // VERSIONS order is the order copies are given up: standard, foils, then alternate art.
      for (const { key } of VERSIONS) {
        const owned = getQuantity(account, id, key);
        const spare = Math.min(owned, excess);
        if (spare <= 0) continue;
        excess -= spare;
        const row = { id, version: key, owned, total, surplus: spare };
        if (isLocked(card)) {
          result.locked.push(row);
          continue;
        }
        row.cpEach = cpTable[card.rarity]?.[key]?.dust ?? null;
        row.cpTotal = row.cpEach === null ? null : row.cpEach * row.surplus;
        if (row.cpTotal === null) result.unknownCount += 1;
        else result.totalCp += row.cpTotal;
        result.rows.push(row);
      }
    }
    return result;
  }

  // "BT1-001*4 BT1-002*2" into [{ id, qty }], adding up repeated cards.
  function parseDeckCards(text) {
    const totals = new Map();
    for (const token of text.split(/\s+/).filter(Boolean)) {
      const [id, qty] = token.split('*');
      totals.set(id, (totals.get(id) || 0) + Number(qty));
    }
    return [...totals].map(([id, qty]) => ({ id, qty }));
  }

  const deckSize = (text) => parseDeckCards(text).reduce((sum, card) => sum + card.qty, 0);

  function evaluateDeck(deck, account, cards, cpTable, dust = surplus(account, cards, cpTable)) {
    const result = { deck, required: 0, owned: 0, missing: [], craftCp: 0, uncraftable: 0 };
    for (const { id, qty } of parseDeckCards(`${deck.main} ${deck.eggs}`)) {
      const owned = Math.min(qty, ownedTotal(account, id));
      result.required += qty;
      result.owned += owned;
      const lacking = qty - owned;
      if (!lacking) continue;
      const card = cards.get(id);
      const each = card && !isLocked(card) ? cpTable[card.rarity]?.std?.craft ?? null : null;
      if (each === null) result.uncraftable += lacking;
      else result.craftCp += each * lacking;
      result.missing.push({ id, need: qty, owned, qty: lacking, craftCp: each === null ? null : each * lacking });
    }
    result.budget = account.cp + dust.totalCp;
    if (!result.missing.length) result.status = 'ready';
    else if (!result.uncraftable && result.craftCp <= result.budget) result.status = 'craftable';
    else result.status = 'not-yet';
    return result;
  }

  // How much of a deck is already owned, from 0 to 1.
  const share = (result) => result.owned / result.required;

  function rankDecks(decks, account, cards, cpTable) {
    const dust = surplus(account, cards, cpTable);
    return decks
      .map((deck) => evaluateDeck(deck, account, cards, cpTable, dust))
      .sort(
        (a, b) =>
          share(b) - share(a) ||
          STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) ||
          TIERS.indexOf(a.deck.tier) - TIERS.indexOf(b.deck.tier) ||
          a.craftCp - b.craftCp ||
          a.deck.name.localeCompare(b.deck.name),
      );
  }

  const VERSION_WORDS = {
    standard: 'std',
    std: 'std',
    shiny: 'shiny',
    'shiny+': 'shinyPlus',
    shinyplus: 'shinyPlus',
    alt: 'alt',
    deluxe: 'deluxe',
    premium: 'premium',
  };

  const TYPE_ORDER = ['Digimon', 'Tamer', 'Option', 'Digi-Egg'];
  const SWAP_REASONS = ['suggested', 'same-name', 'similar'];
  const levelOf = (card) => Number(String(card.level || '').replace(/\D/g, '')) || 0;
  const numberOf = (value) => Number(value) || 0;

  // The main deck and the eggs, each ordered the way a deck is read: type, level, cost.
  function deckSections(deck, account, cards) {
    const section = (text) =>
      parseDeckCards(text)
        .map(({ id, qty }) => ({ id, need: qty, owned: Math.min(qty, ownedTotal(account, id)) }))
        .sort((a, b) => {
          const [x, y] = [cards.get(a.id), cards.get(b.id)];
          if (!x || !y) return Boolean(y) - Boolean(x) || byId(a.id, b.id);
          return (
            TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type) ||
            levelOf(x) - levelOf(y) ||
            numberOf(x.cost) - numberOf(y.cost) ||
            byId(a.id, b.id)
          );
        });
    return { main: section(deck.main), eggs: section(deck.eggs) };
  }

  // "suggested>replaced" pairs: the cards a source proposes instead of the missing one.
  function suggestedFor(deck, missingId) {
    const result = new Set();
    for (const pair of deck.alternates.split(' ').filter(Boolean)) {
      const [suggested, replaced = ''] = pair.split('>');
      if (replaced.split('+').includes(missingId)) suggested.split('+').forEach((id) => result.add(id));
    }
    return result;
  }

  // Owned cards that could stand in for a missing one: the source's swaps, then cards of the
  // same type, color and level. Only copies the deck does not use already are offered.
  // Card effects are not compared.
  function substitutes(deck, missingId, account, cards, limit = 4) {
    const target = cards.get(missingId);
    if (!target) return [];
    const used = new Map(parseDeckCards(`${deck.main} ${deck.eggs}`).map(({ id, qty }) => [id, qty]));
    const suggested = suggestedFor(deck, missingId);
    const colors = target.color.split('/');
    const options = [];
    for (const id of Object.keys(account.cards)) {
      const card = cards.get(id);
      if (!card || id === missingId) continue;
      const taken = used.get(id) || 0;
      const available = Math.min(ownedTotal(account, id), copyLimit(card)) - taken;
      if (available <= 0) continue;
      const similar =
        card.type === target.type &&
        levelOf(card) === levelOf(target) &&
        card.color.split('/').some((color) => colors.includes(color));
      let reason;
      if (suggested.has(id)) reason = 'suggested';
      else if (similar) reason = card.name === target.name ? 'same-name' : 'similar';
      else continue;
      options.push({
        id,
        available,
        reason,
        costGap: Math.abs(numberOf(card.cost) - numberOf(target.cost)),
        dpGap: Math.abs(numberOf(card.dp) - numberOf(target.dp)),
      });
    }
    return options
      .sort(
        (a, b) =>
          SWAP_REASONS.indexOf(a.reason) - SWAP_REASONS.indexOf(b.reason) ||
          a.costGap - b.costGap ||
          a.dpGap - b.dpGap ||
          byId(a.id, b.id),
      )
      .slice(0, limit)
      .map(({ id, available, reason }) => ({ id, available, reason }));
  }

  // Missing copies per card for a target: 'meta' (any tiered deck), 'staples', 'all' or one deck.
  function neededCopies(target, decks, staples, account, cards) {
    const wanted = new Map();
    const want = (id, qty) => {
      if (cards.has(id)) wanted.set(id, Math.max(wanted.get(id) || 0, Math.min(qty, copyLimit(cards.get(id)))));
    };
    const wantDeck = (deck) => parseDeckCards(`${deck.main} ${deck.eggs}`).forEach(({ id, qty }) => want(id, qty));
    if (target === 'all') for (const id of cards.keys()) want(id, KEEP);
    else if (target === 'staples') Object.values(staples).forEach((list) => list.split(' ').forEach((id) => want(id, KEEP)));
    else if (target === 'meta') decks.filter((deck) => deck.tier).forEach(wantDeck);
    else wantDeck(target);
    const needs = new Map();
    for (const [id, qty] of wanted) {
      const missing = qty - ownedTotal(account, id);
      if (missing > 0) needs.set(id, missing);
    }
    return needs;
  }

  // Chances of getting 0, 1, ... copies of one card: `slots` equal draws plus one guaranteed draw.
  function copyChances(slots, chance, guaranteed, upTo) {
    const binomial = [(1 - chance) ** slots];
    for (let i = 0; i < upTo; i += 1) binomial.push(binomial[i] * ((slots - i) / (i + 1)) * (chance / (1 - chance)));
    return binomial.map((value, k) => value * (1 - guaranteed) + (k ? binomial[k - 1] * guaranteed : 0));
  }

  // What a purchase of `packs` packs is expected to give an account. Its last card comes from
  // the guaranteed rates (the game does this when buying 10). Cards of a rarity are assumed
  // equally likely. Foil and alternate art draws are not counted apart.
  function evaluatePack(pack, needs, account, cards, cpTable, packs = 10) {
    const pool = [...cards.values()].filter((card) => card.pack === pack.id);
    const perRarity = pool.reduce((count, card) => count.set(card.rarity, (count.get(card.rarity) || 0) + 1), new Map());
    const result = { pack, needed: 0, expected: 0, craftValue: 0, dustValue: 0, top: [] };
    const slots = packs * pack.slots - 1;
    let useful = 0;
    for (const card of pool) {
      const share = (rates) => (rates[card.rarity] || 0) / 100 / perRarity.get(card.rarity);
      const [chance, guaranteed] = [share(pack.rates), share(pack.guaranteed)];
      const need = needs.get(card.id) || 0;
      const spare = isLocked(card) ? 0 : Math.max(0, KEEP - ownedTotal(account, card.id));
      const chances = copyChances(slots, chance, guaranteed, Math.max(need, spare));
      // Expected copies up to a limit: the sum of the chances of getting more than 0, 1, ...
      const upTo = (limit) => {
        let below = 0;
        let sum = 0;
        for (let k = 0; k < limit; k += 1) {
          below += chances[k];
          sum += 1 - below;
        }
        return sum;
      };
      const values = isLocked(card) ? null : cpTable[card.rarity]?.std;
      if (values) result.dustValue += (slots * chance + guaranteed - upTo(spare)) * (values.dust || 0);
      if (!need) continue;
      useful += chance;
      result.needed += need;
      result.expected += upTo(need);
      result.craftValue += upTo(need) * (values?.craft || 0);
      result.top.push({ id: card.id, need, craft: values?.craft || 0 });
    }
    result.anyChance = 1 - (1 - useful) ** pack.slots;
    result.top.sort((a, b) => b.craft - a.craft || byId(a.id, b.id));
    return result;
  }

  // One card per line: "BT1-010 3", "3 BT1-010" or "BT1-010 x3", optionally followed by a
  // version word such as "shiny". Later lines win.
  function parseImport(text, cards) {
    const entries = new Map();
    const errors = [];
    text.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (!line) return;
      const idFirst = line.match(/^([a-z]+\d*-\d+)\s*(?:[x×*]\s*|\s+)(\d+)(?:\s+(\S+))?$/i);
      const qtyFirst = line.match(/^(\d+)\s*[x×]?\s+([a-z]+\d*-\d+)(?:\s+(.*))?$/i);
      const fail = (reason) => errors.push({ line: index + 1, text: line, reason });
      if (!idFirst && !qtyFirst) return fail('Unrecognized format');
      const id = (idFirst ? idFirst[1] : qtyFirst[2]).toUpperCase();
      const qty = Number(idFirst ? idFirst[2] : qtyFirst[1]);
      const word = ((idFirst || qtyFirst)[3] || '').toLowerCase();
      const known = has(VERSION_WORDS, word);
      // After "3 BT1-010" other text is a card name; after "BT1-010 3" it must be a version.
      if (idFirst && word && !known) return fail('Unrecognized version');
      if (!cards.has(id)) return fail('Unknown card number');
      if (qty > MAX_QTY) return fail(`Quantity above ${MAX_QTY}`);
      const version = known ? VERSION_WORDS[word] : 'std';
      entries.set(`${id} ${version}`, version === 'std' ? { id, qty } : { id, qty, version });
    });
    return { entries: [...entries.values()], errors };
  }

  function missingStaples(staples, decks, account, cards) {
    const used = decks
      .filter((deck) => deck.tier)
      .map((deck) => new Set(parseDeckCards(`${deck.main} ${deck.eggs}`).map((card) => card.id)));
    const seen = new Set();
    const result = [];
    for (const [color, list] of Object.entries(staples)) {
      for (const id of list.split(' ')) {
        const card = cards.get(id);
        if (!card || seen.has(id)) continue;
        seen.add(id);
        const owned = ownedTotal(account, id);
        const limit = copyLimit(card);
        if (owned >= limit) continue;
        result.push({ id, color, owned, limit, decks: used.filter((ids) => ids.has(id)).length });
      }
    }
    return result.sort((a, b) => b.decks - a.decks || byId(a.id, b.id));
  }

  // Turns shared AlysionCards lists into decks, keeping only complete, legal and distinct ones.
  // The input is written by strangers: anything unexpected drops the list.
  function communityDecks(shared, cards) {
    const seen = new Set();
    const decks = [];
    for (const source of shared) {
      if (!isObject(source) || !/^[\w-]+$/.test(source.id) || !isObject(source.cards)) continue;
      const entries = Object.entries(source.cards).sort(([a], [b]) => byId(a, b));
      const legal = entries.every(
        ([id, qty]) => cards.has(id) && Number.isInteger(qty) && qty >= 1 && qty <= copyLimit(cards.get(id)),
      );
      if (!legal) continue;
      const isEgg = ([id]) => cards.get(id).type === 'Digi-Egg';
      const text = (list) => list.map(([id, qty]) => `${id}*${qty}`).join(' ');
      const main = text(entries.filter((entry) => !isEgg(entry)));
      const eggs = text(entries.filter(isEgg));
      if (deckSize(main) !== 50 || deckSize(eggs) > 5) continue;
      const key = `${main} ${eggs}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const name = String(source.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      decks.push({
        id: `ac-${source.id}`,
        tier: '',
        source: 'Community',
        url: `https://alysioncards.com/decks?deck=${source.id}`,
        name: name || 'Untitled deck',
        main,
        eggs,
        alternates: '',
      });
    }
    return decks;
  }

  const serializeBackup =(state) => JSON.stringify(state, null, 2);

  function parseBackup(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('The file is not valid JSON.');
    }
    if (!isObject(data) || data.version !== 1 || !Array.isArray(data.accounts) || !isObject(data.cpTable)) {
      throw new Error('The file is not a collection backup.');
    }
    if (data.accounts.length !== ACCOUNTS) throw new Error(`A backup must contain ${ACCOUNTS} accounts.`);
    const state = createState();
    data.accounts.forEach((source, index) => {
      const account = state.accounts[index];
      if (!isObject(source) || typeof source.name !== 'string' || !isObject(source.cards)) {
        throw new Error('The backup has an invalid account.');
      }
      if (!Number.isInteger(source.cp) || source.cp < 0) throw new Error('The backup has an invalid CP balance.');
      account.name = source.name;
      account.cp = source.cp;
      for (const [id, versions] of Object.entries(source.cards)) {
        if (!CARD_ID.test(id) || !isObject(versions)) throw new Error('The backup has an invalid card entry.');
        for (const [key, qty] of Object.entries(versions)) {
          const known = VERSIONS.some((version) => version.key === key);
          if (!known || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
            throw new Error(`The backup has an invalid quantity for ${id}.`);
          }
          setQuantity(account, id, key, qty);
        }
      }
    });
    for (const [rarity, versions] of Object.entries(state.cpTable)) {
      for (const [key, value] of Object.entries(versions)) {
        const source = data.cpTable[rarity]?.[key];
        if (source === undefined) continue;
        for (const field of ['craft', 'dust']) {
          const number = source?.[field];
          if (number !== null && !(Number.isInteger(number) && number >= 0)) {
            throw new Error(`The backup has an invalid CP value for ${rarity} ${key}.`);
          }
          value[field] = number;
        }
      }
    }
    state.lastExport = typeof data.lastExport === 'string' ? data.lastExport : null;
    return state;
  }

  const api = {
    KEEP,
    MAX_QTY,
    VERSIONS,
    createState,
    defaultCpTable,
    getQuantity,
    setQuantity,
    ownedTotal,
    isLocked,
    copyLimit,
    surplus,
    parseDeckCards,
    deckSize,
    evaluateDeck,
    rankDecks,
    deckSections,
    substitutes,
    neededCopies,
    evaluatePack,
    parseImport,
    missingStaples,
    communityDecks,
    serializeBackup,
    parseBackup,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(globalThis);
