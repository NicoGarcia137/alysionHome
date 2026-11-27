// Page behaviour. All collection rules live in core.js.
(function () {
  'use strict';

  const STORAGE_KEY = 'alysion-collection-v1';
  const IMAGE_BASE = 'https://images.alysioncards.com/';
  const TABS = ['Library', 'Disassemble', 'Decks', 'Packs', 'Staples', 'Settings'];
  const STATUS_LABEL = { ready: 'Ready', craftable: 'Craftable', 'not-yet': 'Not yet' };
  const VERSION_LABEL = Object.fromEntries(Core.VERSIONS.map((v) => [v.key, v.label]));
  const SOURCES = [
    ['Cards', 'https://alysioncards.com/cards'],
    ['Deck tier list', 'https://game8.co/games/Digimon-Alysion/archives/557342'],
    ['Deck guides', 'https://simbozz.gg/digimon-alysion/decks'],
    ['Community decks', 'https://alysioncards.com/decks'],
    ['Staples guide', 'https://alysioncards.com/guides/staple-cards-at-launch'],
    ['Rarity rules', 'https://game8.co/games/Digimon-Alysion/archives/561152'],
    ['CP values', 'https://simbozz.gg/guides/digimon-alysion-crafting-guide'],
  ];

  const cards = new Map(ALYSION_CARDS.map((card) => [card.id, card]));
  const stapleIds = new Set(Object.values(ALYSION_STAPLES).flatMap((list) => list.split(' ')));

  const ui = {
    account: 0,
    tab: 'Library',
    filters: { text: '', color: '', rarity: '', set: '', owned: '', staples: false },
    openDeck: null,
    tier: '',
    source: '',
    closedColors: new Set(),
    packTarget: 'meta',
    packDeck: '',
    packOpen: '',
    pasteResult: null,
  };
  let state = load();

  const $ = (selector) => document.querySelector(selector);
  const account = () => state.accounts[ui.account];
  const number = (value) => value.toLocaleString('en-US');

  // Builds elements with text nodes only, so card data is never read as HTML.
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key === 'class') node.className = value;
      else if (key in node && typeof value !== 'string') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    }
    node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
    return node;
  }

  function showNotice(message) {
    const notice = $('#notice');
    notice.textContent = message;
    notice.hidden = false;
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Core.parseBackup(raw) : Core.createState();
    } catch (error) {
      if (raw) {
        try {
          localStorage.setItem(`${STORAGE_KEY}-damaged`, raw);
        } catch {
          /* the notice below still tells the user */
        }
        queueMicrotask(() => showNotice(`Saved data could not be read (${error.message}) A copy was kept. Import a backup in Settings.`));
      } else {
        queueMicrotask(() => showNotice('This browser is blocking storage, so changes will be lost when the page closes.'));
      }
      return Core.createState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, Core.serializeBackup(state));
    } catch {
      showNotice('Changes could not be saved in this browser. Export a backup in Settings now.');
    }
  }

  function setQuantity(id, version, quantity) {
    Core.setQuantity(account(), id, version, quantity);
    save();
    renderHeader();
  }

  function art(card, props = {}) {
    const image = card.image.startsWith('assets/')
      ? el('img', { src: IMAGE_BASE + card.image, alt: `${card.name} ${card.id}`, loading: 'lazy', onerror: (e) => e.target.remove() })
      : null;
    return el(props.onclick ? 'button' : 'div', { class: 'art', type: props.onclick ? 'button' : null, ...props }, image, el('span', {}, card.id));
  }

  const thumb = (card) =>
    card && card.image.startsWith('assets/')
      ? el('img', { class: 'thumb', src: IMAGE_BASE + card.image, alt: '', loading: 'lazy' })
      : el('div', { class: 'thumb' });

  function stepper(label, read, write) {
    const output = el('output', {}, String(read()));
    const change = (delta) => {
      write(read() + delta);
      refresh();
    };
    const less = el('button', { type: 'button', 'aria-label': `Remove one ${label}`, onclick: () => change(-1) }, '−');
    const more = el('button', { type: 'button', 'aria-label': `Add one ${label}`, onclick: () => change(1) }, '+');
    function refresh() {
      output.textContent = String(read());
      less.disabled = read() <= 0;
      more.disabled = read() >= Core.MAX_QTY;
    }
    refresh();
    return el('div', { class: 'stepper' }, less, output, more);
  }

  function renderHeader() {
    $('#accounts').replaceChildren(
      ...state.accounts.map((entry, index) =>
        el('button', {
          type: 'button',
          'aria-pressed': String(index === ui.account),
          onclick: () => {
            ui.account = index;
            ui.pasteResult = null;
            render();
          },
        }, entry.name),
      ),
    );
    const input = $('#cp-balance');
    if (document.activeElement !== input) input.value = account().cp;
    const dust = Core.surplus(account(), cards, state.cpTable);
    $('#surplus-summary').textContent = `Surplus worth ${number(dust.totalCp)} CP${dust.unknownCount ? ' plus unknown values' : ''}`;
  }

  function renderTabs() {
    $('#tabs').replaceChildren(
      ...TABS.map((tab) =>
        el('button', {
          type: 'button',
          'aria-current': tab === ui.tab ? 'page' : null,
          onclick: () => {
            ui.tab = tab;
            render();
          },
        }, tab),
      ),
    );
  }

  function render() {
    renderHeader();
    renderTabs();
    const views = { Library: libraryView, Disassemble: disassembleView, Decks: decksView, Packs: packsView, Staples: staplesView, Settings: settingsView };
    $('#view').replaceChildren(...views[ui.tab]().filter(Boolean));
  }

  /* Library */

  function matches(card) {
    const { text, color, rarity, set, owned, staples } = ui.filters;
    const query = text.trim().toLowerCase();
    if (query && !`${card.id} ${card.name}`.toLowerCase().includes(query)) return false;
    if (color && !card.color.includes(color)) return false;
    if (rarity && card.rarity !== rarity) return false;
    if (set && card.id.split('-')[0] !== set) return false;
    if (staples && !stapleIds.has(card.id)) return false;
    if (owned === 'owned' && !Core.ownedTotal(account(), card.id)) return false;
    if (owned === 'missing' && Core.ownedTotal(account(), card.id) >= Core.copyLimit(card)) return false;
    if (owned === 'surplus' && Core.ownedTotal(account(), card.id) <= Core.KEEP) return false;
    return true;
  }

  function cardTile(card) {
    const tile = el('div', { class: 'card' });
    const draw = () => {
      const total = Core.ownedTotal(account(), card.id);
      const standard = Core.getQuantity(account(), card.id, 'std');
      const extra = total - standard;
      tile.classList.toggle('none', !total);
      tile.replaceChildren(
        art(card, { onclick: () => openCard(card, draw), 'aria-label': `Details for ${card.name} ${card.id}` }),
        el('div', { class: 'card-name' }, el('b', {}, card.name), `${card.id} ${card.rarity}${extra ? `, ${extra} special` : ''}`),
        stepper(`${card.name} ${card.id}`, () => Core.getQuantity(account(), card.id, 'std'), (value) => {
          setQuantity(card.id, 'std', value);
          const now = Core.ownedTotal(account(), card.id);
          tile.classList.toggle('none', !now);
        }),
      );
    };
    draw();
    return tile;
  }

  function openCard(card, onClose) {
    const dialog = $('#card-dialog');
    const rows = Core.VERSIONS.flatMap(({ key, label }) => [
      el('span', {}, label),
      stepper(`${label} ${card.name}`, () => Core.getQuantity(account(), card.id, key), (value) => setQuantity(card.id, key, value)),
    ]);
    const facts = [card.rarity, card.color, card.type, card.level, card.cost && `cost ${card.cost}`, card.dp && `${card.dp} DP`]
      .filter(Boolean)
      .join(', ');
    dialog.replaceChildren(
      el('div', { class: 'detail' },
        art(card),
        el('div', {},
          el('h2', { id: 'card-dialog-title' }, `${card.name} ${card.id}`),
          el('p', { class: 'hint' }, facts),
          card.restriction ? el('p', { class: 'warn' }, `${card.restriction}. It cannot be crafted or disassembled.`) : null,
          el('p', {}, `Copies in ${account().name}`),
          el('div', { class: 'versions' }, rows),
          el('p', { class: 'effect' }, card.effect),
          el('button', { type: 'button', class: 'primary', onclick: () => dialog.close() }, 'Done'),
        ),
      ),
    );
    dialog.onclose = onClose;
    dialog.showModal();
  }

  function select(label, key, options, onChange) {
    return el('select', {
      'aria-label': label,
      onchange: (e) => {
        ui.filters[key] = e.target.value;
        onChange();
      },
    }, options.map(([value, text]) => el('option', { value, selected: ui.filters[key] === value }, text)));
  }

  function libraryView() {
    const grid = el('div', { class: 'grid' });
    const count = el('span', { class: 'count', role: 'status' });
    const update = () => {
      const visible = ALYSION_CARDS.filter(matches);
      const owned = ALYSION_CARDS.filter((card) => Core.ownedTotal(account(), card.id)).length;
      count.textContent = `${visible.length} shown, ${owned} of ${ALYSION_CARDS.length} owned`;
      grid.replaceChildren(...(visible.length ? visible.map(cardTile) : [el('p', { class: 'empty' }, 'No cards match these filters.')]));
    };
    const unique = (values) => [...new Set(values)];
    const colors = unique(ALYSION_CARDS.flatMap((card) => card.color.split('/'))).sort();
    const sets = unique(ALYSION_CARDS.map((card) => card.id.split('-')[0]));
    const options = (all, values) => [['', all], ...values.map((v) => [v, v])];

    const toolbar = el('div', { class: 'toolbar' },
      el('input', {
        type: 'search',
        placeholder: 'Search name or number',
        'aria-label': 'Search name or number',
        value: ui.filters.text,
        oninput: (e) => {
          ui.filters.text = e.target.value;
          update();
        },
      }),
      select('Color', 'color', options('All colors', colors), update),
      select('Rarity', 'rarity', options('All rarities', ['C', 'U', 'R', 'SR', 'SEC', 'P']), update),
      select('Set', 'set', options('All sets', sets), update),
      select('Ownership', 'owned', [['', 'Owned or not'], ['owned', 'Owned'], ['missing', 'Missing copies'], ['surplus', 'With surplus']], update),
      el('label', {},
        el('input', {
          type: 'checkbox',
          checked: ui.filters.staples,
          onchange: (e) => {
            ui.filters.staples = e.target.checked;
            update();
          },
        }),
        ' Staples only'),
      count,
    );

    const area = el('textarea', { 'aria-label': 'Card list to paste', placeholder: 'BT1-010 3\n4 BT1-085\nBT3-003 x4' });
    const result = ui.pasteResult;
    const paste = el('details', { class: 'paste', open: Boolean(result) },
      el('summary', {}, 'Paste a card list'),
      el('p', { class: 'hint' }, 'One card per line. Each line sets the number of standard copies. Add shiny, shiny+, alt, deluxe or premium at the end for other versions.'),
      area,
      el('button', {
        type: 'button',
        class: 'primary',
        onclick: () => {
          const parsed = Core.parseImport(area.value, cards);
          parsed.entries.forEach(({ id, qty, version = 'std' }) => Core.setQuantity(account(), id, version, qty));
          save();
          ui.pasteResult = parsed;
          render();
        },
      }, 'Set quantities'),
      result ? el('p', { role: 'status' }, `Set ${result.entries.length} lines in ${account().name}.`) : null,
      result && result.errors.length
        ? el('ul', { class: 'errors' }, result.errors.map((e) => el('li', {}, `Line ${e.line}: ${e.reason}: ${e.text}`)))
        : null,
    );
    update();
    return [toolbar, paste, grid];
  }

  /* Disassemble */

  function cardCells(id) {
    const card = cards.get(id);
    return [el('td', {}, thumb(card)), el('td', {}, el('b', {}, card ? card.name : 'Unknown card'), ` ${id}`)];
  }

  function table(headers, rows) {
    return el('div', { class: 'table-wrap panel' },
      el('table', {},
        el('thead', {}, el('tr', {}, headers.map(([text, numeric]) => el('th', { class: numeric ? 'num' : null }, text)))),
        el('tbody', {}, rows),
      ),
    );
  }

  const cell = (value) => el('td', { class: 'num' }, typeof value === 'number' ? number(value) : value);

  function disassembleView() {
    const result = Core.surplus(account(), cards, state.cpTable);
    const nodes = [
      el('h2', {}, `You can disassemble in ${account().name}`),
      el('p', { class: 'hint' }, `Suggestions only: nothing here changes your cards. These are copies beyond ${Core.KEEP} of a card, counting every version together, suggesting standard copies first, then foils, then alternate art. After disassembling in the game, lower the quantity in Library.`),
    ];
    if (!result.rows.length) {
      nodes.push(el('p', { class: 'empty' }, `Nothing you can disassemble yet. Cards appear here once you own more than ${Core.KEEP} copies.`));
    } else {
      nodes.push(
        el('p', { class: 'figure' }, `Up to ${number(result.totalCp)} CP`),
        result.unknownCount
          ? el('p', { class: 'warn' }, `Rows marked Unknown (${result.unknownCount}) are not in the total. Add the value shown in game under Settings.`)
          : null,
        table(
          [['', false], ['Card', false], ['Version', false], ['Owned (all versions)', true], ['Can disassemble', true], ['CP', true]],
          result.rows.map((row) =>
            el('tr', {}, cardCells(row.id), el('td', {}, VERSION_LABEL[row.version]), cell(`${row.owned} (${row.total})`), cell(row.surplus), cell(row.cpTotal ?? 'Unknown')),
          ),
        ),
      );
    }
    if (result.locked.length) {
      nodes.push(
        el('h3', {}, 'Extra copies that cannot be disassembled'),
        el('p', { class: 'hint' }, 'Promo and restricted cards give no CP.'),
        table(
          [['', false], ['Card', false], ['Version', false], ['Owned (all versions)', true], ['Extra', true]],
          result.locked.map((row) => el('tr', {}, cardCells(row.id), el('td', {}, VERSION_LABEL[row.version]), cell(`${row.owned} (${row.total})`), cell(row.surplus))),
        ),
      );
    }
    return nodes;
  }

  /* Decks */

  const cardList = (text) => text.split('+').map((id) => (cards.has(id) ? `${cards.get(id).name} ${id}` : id)).join(' and ');

  // Decks without a source come from the Game8 tier list.
  const sourceOf = (deck) => deck.source || 'Game8';

  // A card picture with labels over its bottom corners. Clicking it opens the card.
  function slot(id, { left, right, state: look, caption, label }) {
    const card = cards.get(id);
    const picture = card
      ? art(card, { onclick: () => openCard(card, render), 'aria-label': label || `${card.name} ${id}`, title: `${card.name} ${id}` })
      : el('div', { class: 'art' }, el('span', {}, id));
    return el('figure', { class: look ? `slot ${look}` : 'slot' },
      el('div', { class: 'frame' },
        picture,
        left ? el('b', { class: 'badge left' }, left) : null,
        right ? el('b', { class: 'badge right' }, right) : null,
      ),
      caption ? el('figcaption', {}, caption) : null,
    );
  }

  const nameOf = (id) => (cards.has(id) ? cards.get(id).name : id);

  function deckGrid(title, list, result) {
    if (!list.length) return null;
    const total = list.reduce((sum, entry) => sum + entry.need, 0);
    return [
      el('h3', {}, `${title} (${total})`),
      el('div', { class: 'deck-grid' }, list.map(({ id, need, owned }) => {
        const lack = result.missing.find((entry) => entry.id === id);
        return slot(id, {
          left: !lack ? null : lack.craftCp === null ? 'No craft' : `${number(lack.craftCp)} CP`,
          right: lack ? `${owned}/${need}` : `x${need}`,
          state: !lack ? null : owned ? 'missing' : 'missing none',
          label: `${nameOf(id)} ${id}: you own ${owned} of ${need}${stapleIds.has(id) ? ', staple' : ''}`,
        });
      })),
    ];
  }

  function missingOptions(deck, result, order) {
    if (!result.missing.length) return null;
    const reasons = { suggested: `${sourceOf(deck)} swap`, 'same-name': 'Same name', similar: 'Similar' };
    const lacking = order.map((entry) => result.missing.find((missing) => missing.id === entry.id)).filter(Boolean);
    return [
      el('h3', {}, `Options in ${account().name} for missing cards`),
      el('p', { class: 'hint' }, 'Options match type, color and level, or are swaps proposed by the source. Effects are not compared, so read each card. The same spare copy can appear under several missing cards.'),
      ...lacking.map(({ id, qty }) => {
        const options = Core.substitutes(deck, id, account(), cards);
        return el('div', { class: 'swap' },
          slot(id, { right: `-${qty}`, state: 'missing none', caption: `Missing: ${nameOf(id)}` }),
          el('div', { class: 'swap-options' },
            options.length
              ? options.map((option) => slot(option.id, { right: `x${option.available}`, caption: `${reasons[option.reason]}: ${nameOf(option.id)}` }))
              : el('p', { class: 'hint' }, 'No similar card with spare copies in this account.'),
          ),
        );
      }),
    ];
  }

  function deckDetail(result, others) {
    const { deck } = result;
    const mainSize = Core.deckSize(deck.main);
    const sections = Core.deckSections(deck, account(), cards);
    const alternates = deck.alternates.split(' ').filter(Boolean).map((pair) => {
      const [suggested, replaced] = pair.split('>');
      return el('li', {}, replaced ? `${cardList(suggested)} instead of ${cardList(replaced)}` : `${cardList(suggested)} as an option`);
    });
    return el('div', { class: 'deck-detail' },
      el('p', {}, others),
      result.status === 'ready'
        ? el('p', {}, 'You own every card.')
        : el('p', {}, `Crafting needs ${number(result.craftCp)} CP. ${account().name} would have ${number(result.budget)} CP if you disassembled the surplus.`),
      result.uncraftable ? el('p', { class: 'warn' }, `${result.uncraftable} missing copies cannot be crafted. Get them from packs or the shop.`) : null,
      mainSize !== 50 ? el('p', { class: 'warn' }, `The source lists ${mainSize} main deck cards instead of 50.`) : null,
      deckGrid('Main deck', sections.main, result),
      deckGrid('Digi-Egg deck', sections.eggs, result),
      missingOptions(deck, result, [...sections.main, ...sections.eggs]),
      alternates.length ? [el('h3', {}, 'Suggested swaps (not counted above)'), el('ul', {}, alternates)] : null,
      el('p', {}, el('a', { href: deck.url || `https://game8.co/games/Digimon-Alysion/archives/${deck.id}`, target: '_blank', rel: 'noopener' },
        deck.source === 'Community' ? 'Open this list on AlysionCards' : `Read the strategy on ${sourceOf(deck)}`)),
    );
  }

  function decksView() {
    const list = Core.rankDecks(ALYSION_DECKS, account(), cards, state.cpTable).filter(
      (result) =>
        (!ui.tier || (ui.tier === 'none' ? !result.deck.tier : result.deck.tier === ui.tier)) &&
        (!ui.source || sourceOf(result.deck) === ui.source),
    );
    const sources = [...new Set(ALYSION_DECKS.map(sourceOf))];
    const sourceFilter = el('select', {
      'aria-label': 'Source',
      onchange: (e) => {
        ui.source = e.target.value;
        render();
      },
    }, [['', 'All sources'], ...sources.map((name) => [name, name])].map(([value, text]) =>
      el('option', { value, selected: ui.source === value }, text)));
    const percent = (deck, entry) => {
      const result = Core.evaluateDeck(deck, entry, cards, state.cpTable);
      return Math.floor((result.owned / result.required) * 100);
    };
    const filter = el('select', {
      'aria-label': 'Tier',
      onchange: (e) => {
        ui.tier = e.target.value;
        render();
      },
    }, [['', 'All tiers'], ['S', 'Tier S'], ['A', 'Tier A'], ['B', 'Tier B'], ['C', 'Tier C'], ['none', 'Unranked']].map(([value, text]) =>
      el('option', { value, selected: ui.tier === value }, text)));

    const row = (result) => {
      const { deck } = result;
      const { colors } = Core.deckColor(deck, cards);
      const open = ui.openDeck === deck.id;
      // Computed only for the open deck: there are a few hundred decks.
      const others = () => `Cards owned by account: ${state.accounts.map((entry) => `${entry.name} ${percent(deck, entry)}%`).join(', ')}`;
      return el('div', { class: 'deck panel' },
        el('button', {
          type: 'button',
          'aria-expanded': String(open),
          'data-deck': deck.id,
          onclick: () => {
            ui.openDeck = open ? null : deck.id;
            render();
            document.querySelector(`[data-deck="${deck.id}"]`).focus();
          },
        },
          el('span', { class: 'tier', title: deck.tier ? `Tier ${deck.tier}` : 'Unranked' }, deck.tier || '–'),
          el('span', { class: 'deck-name' }, el('b', {}, deck.name), el('small', {}, `${Math.floor((result.owned / result.required) * 100)}%: ${result.owned} of ${result.required} cards, ${sourceOf(deck)}${colors.length > 1 ? `, ${colors.join(' / ')}` : ''}`)),
          el('span', { class: 'gauge', 'aria-hidden': 'true' },
            Array.from({ length: result.required }, (_, i) => el('i', { class: i < result.owned ? 'on' : null }))),
          el('span', { class: 'cost' }, result.status === 'ready' ? '' : `${number(result.craftCp)} CP${result.uncraftable ? ` + ${result.uncraftable} uncraftable` : ''}`),
          el('span', { class: `status ${result.status}` }, STATUS_LABEL[result.status]),
        ),
        open ? deckDetail(result, others()) : null,
      );
    };

    const groups = Core.groupByColor(list, cards).map(({ group, results }) =>
      el('details', {
        class: 'color-group',
        open: !ui.closedColors.has(group),
        ontoggle: (e) => {
          if (e.target.open) ui.closedColors.delete(group);
          else ui.closedColors.add(group);
        },
      },
        el('summary', {},
          el('span', { class: `swatch ${group.toLowerCase()}`, 'aria-hidden': 'true' }),
          `${group} (${results.length})`),
        results.map(row),
      ));

    return [
      el('h2', {}, `Decks for ${account().name}`),
      el('p', { class: 'hint' }, 'Grouped by color and, inside each group, ordered from the highest to the lowest share of cards you own. A deck is Multicolor when a second color has 10 or more copies; White does not count. Craftable means your CP balance, plus what you could get by disassembling surplus, covers every missing card. Each deck is judged on its own.'),
      el('div', { class: 'toolbar' }, filter, sourceFilter),
      ...(groups.length ? groups : [el('p', { class: 'empty' }, 'No decks match these filters.')]),
    ];
  }

  /* Packs */

  const PACK_BUY = 10;
  const percentText = (chance) => `${(chance * 100).toFixed(chance < 0.1 ? 1 : 0)}%`;
  const decimal = (value) => value.toFixed(1);
  const whole = (value) => number(Math.round(value));

  function choice(label, value, options, onChange) {
    return el('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) },
      options.map(([key, text]) => el('option', { value: key, selected: key === value }, text)));
  }

  function packReasons(best, others) {
    const second = others[0];
    const gain = second && second.craftValue > 0 ? Math.round((best.craftValue / second.craftValue - 1) * 100) : null;
    const top = best.top.filter((entry) => ['SR', 'SEC'].includes(cards.get(entry.id).rarity));
    const moreCards = others.filter((result) => result.expected > best.expected).sort((a, b) => b.expected - a.expected)[0];
    return el('ul', {},
      el('li', {}, `Highest value for this goal: about ${whole(best.craftValue)} CP worth of needed cards per ${PACK_BUY} packs${gain === null ? '.' : `, ${gain}% more than ${second.pack.id}.`}`),
      el('li', {}, `About ${decimal(best.expected)} needed cards per ${PACK_BUY} packs. Chance that a single pack holds at least one: ${percentText(best.anyChance)}.`),
      el('li', {}, `${best.needed} needed copies come from this pack, across ${best.top.length} cards, ${top.length} of them SR or SEC.`),
      el('li', {}, `Copies you could not keep would give back about ${whole(best.dustValue)} CP.`),
      moreCards ? el('li', {}, `${moreCards.pack.id} gives more needed cards (${decimal(moreCards.expected)}), but they are cheaper to craft.`) : null,
    );
  }

  function packsView() {
    const ranked = Core.rankDecks(ALYSION_DECKS, account(), cards, state.cpTable);
    const chosen = ranked.find((entry) => entry.deck.id === ui.packDeck) || ranked[0];
    const target = ui.packTarget === 'deck' ? chosen.deck : ui.packTarget;
    const needs = Core.neededCopies(target, ALYSION_DECKS, ALYSION_STAPLES, account(), cards);
    const results = ALYSION_PACKS
      .map((pack) => Core.evaluatePack(pack, needs, account(), cards, state.cpTable, PACK_BUY))
      .sort((a, b) => b.craftValue - a.craftValue || b.expected - a.expected);
    const [best, ...others] = results;
    const shown = results.find((result) => result.pack.id === ui.packOpen) || best;

    const toolbar = el('div', { class: 'toolbar' },
      el('label', {}, 'Goal ',
        choice('Goal', ui.packTarget, [['meta', 'Tiered meta decks'], ['staples', 'Staples'], ['all', 'Any missing card'], ['deck', 'One deck']], (value) => {
          ui.packTarget = value;
          ui.packOpen = '';
          render();
        })),
      ui.packTarget === 'deck'
        ? choice('Deck', chosen.deck.id, ranked.map((entry) => [entry.deck.id, `${Math.floor((entry.owned / entry.required) * 100)}% ${entry.deck.name} (${sourceOf(entry.deck)})`]), (value) => {
          ui.packDeck = value;
          ui.packOpen = '';
          render();
        })
        : null,
    );
    const total = [...needs.values()].reduce((sum, qty) => sum + qty, 0);
    const inPacks = results.reduce((sum, result) => sum + result.needed, 0);
    const secrets = [...cards.values()].filter((card) => card.rarity === 'SEC');
    const secretsNeeded = secrets.filter((card) => needs.has(card.id)).length;
    const nodes = [
      el('h2', {}, `Packs for ${account().name}`),
      el('p', { class: 'hint' }, `Estimates for buying ${PACK_BUY} packs at once (1,000 DigiGems or 5,000 Coins), from published rates and assuming cards of one rarity are equally likely. Shiny draws count as the same card; alternate art draws are not counted.`),
      toolbar,
    ];
    if (!inPacks) {
      nodes.push(el('p', { class: 'empty' }, total ? 'No booster contains the cards missing for this goal.' : 'Nothing is missing for this goal.'));
    } else {
      nodes.push(
        el('p', { class: 'figure' }, `Pull ${best.pack.id} ${best.pack.name}`),
        packReasons(best, others),
        table(
          [['Pack', false], ['Needed copies', true], ['Chance per pack', true], [`Needed cards per ${PACK_BUY}`, true], [`CP value per ${PACK_BUY}`, true], ['CP back', true]],
          results.map((result) =>
            el('tr', {},
              el('td', {}, el('button', {
                type: 'button',
                'aria-pressed': String(result === shown),
                onclick: () => {
                  ui.packOpen = result.pack.id;
                  render();
                },
              }, `${result.pack.id} ${result.pack.name}`)),
              cell(result.needed),
              cell(percentText(result.anyChance)),
              cell(decimal(result.expected)),
              cell(whole(result.craftValue)),
              cell(whole(result.dustValue)),
            )),
        ),
        el('h3', {}, `Most valuable cards you need from ${shown.pack.id}`),
        el('div', { class: 'deck-grid' }, shown.top.slice(0, 16).map(({ id, need, craft }) =>
          slot(id, { left: craft ? `${number(craft)} CP` : 'No craft', right: `-${need}`, state: Core.ownedTotal(account(), id) ? 'missing' : 'missing none', caption: nameOf(id) }))),
        el('p', {}, el('a', { href: shown.pack.url, target: '_blank', rel: 'noopener' }, `Rates for ${shown.pack.id} on Game8`)),
      );
    }
    nodes.push(
      total > inPacks ? el('p', {}, `${total - inPacks} needed copies are in no booster: they come from starter decks or the shop.`) : null,
      el('p', {}, `SEC Decryption Pack (ticket only, one card): you need ${secretsNeeded} of the ${secrets.length} SEC cards, so a ticket has a ${percentText(secretsNeeded / secrets.length)} chance of giving a needed one.`),
    );
    return nodes;
  }

  /* Staples */

  function staplesView() {
    const rows = Core.missingStaples(ALYSION_STAPLES, ALYSION_DECKS, account(), cards).map((entry) => {
      const card = cards.get(entry.id);
      const craft = Core.isLocked(card) ? null : state.cpTable[card.rarity]?.std.craft ?? null;
      return el('tr', {},
        cardCells(entry.id),
        el('td', {}, entry.color),
        cell(`${entry.owned} of ${entry.limit}`),
        cell(entry.decks),
        cell(craft === null ? 'Cannot craft' : craft * (entry.limit - entry.owned)),
      );
    });
    return [
      el('h2', {}, `Staples missing in ${account().name}`),
      el('p', { class: 'hint' }, 'Cards that fit most decks of their color, ordered by how many tiered decks use them.'),
      rows.length
        ? table([['', false], ['Card', false], ['Guide color', false], ['Owned', true], ['Tiered decks', true], ['Craft CP', true]], rows)
        : el('p', { class: 'empty' }, 'You own every staple.'),
    ];
  }

  /* Settings */

  function exportBackup() {
    state.lastExport = new Date().toISOString();
    save();
    const url = URL.createObjectURL(new Blob([Core.serializeBackup(state)], { type: 'application/json' }));
    el('a', { href: url, download: `alysion-backup-${state.lastExport.slice(0, 10)}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    render();
  }

  async function importBackup(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;
    try {
      const imported = Core.parseBackup(await file.text());
      if (!confirm('Replace all three accounts and CP values with this backup?')) return;
      state = imported;
      save();
      $('#notice').hidden = true;
      render();
    } catch (error) {
      showNotice(`Import failed. ${error.message}`);
    } finally {
      input.value = '';
    }
  }

  function cpInput(rarity, version, field) {
    const value = state.cpTable[rarity][version][field];
    return el('input', {
      type: 'number',
      min: '0',
      step: '1',
      placeholder: '?',
      'aria-label': `${rarity} ${VERSION_LABEL[version]} ${field === 'craft' ? 'craft' : 'disassemble'} CP`,
      value: value === null ? '' : String(value),
      onchange: (e) => {
        const text = e.target.value.trim();
        state.cpTable[rarity][version][field] = text === '' ? null : Math.max(0, Math.trunc(Number(text)));
        save();
        render();
      },
    });
  }

  function settingsView() {
    const names = state.accounts.map((entry, index) =>
      el('label', {}, `Account ${index + 1} name`,
        el('input', {
          value: entry.name,
          maxlength: '30',
          onchange: (e) => {
            entry.name = e.target.value.trim() || `Account ${index + 1}`;
            e.target.value = entry.name;
            save();
            renderHeader();
          },
        })),
    );
    const cpRows = Object.keys(state.cpTable).flatMap((rarity) =>
      ['craft', 'dust'].map((field) =>
        el('tr', {},
          el('th', {}, `${rarity} ${field === 'craft' ? 'craft' : 'disassemble'}`),
          Core.VERSIONS.map(({ key }) => el('td', {}, cpInput(rarity, key, field))),
        ),
      ),
    );
    return [
      el('div', { class: 'settings-section' }, el('h2', {}, 'Accounts'), el('div', { class: 'names' }, names)),
      el('div', { class: 'settings-section' },
        el('h2', {}, 'Backup'),
        el('p', {}, 'Your collection is saved only in this browser. Clearing browser data erases it.'),
        el('p', { class: 'hint' }, state.lastExport ? `Last export: ${new Date(state.lastExport).toLocaleString('en-US')}` : 'Never exported.'),
        el('div', { class: 'toolbar' },
          el('button', { type: 'button', class: 'primary', onclick: exportBackup }, 'Export backup'),
          el('label', {}, 'Import backup ', el('input', { type: 'file', accept: '.json,application/json', onchange: importBackup })),
        ),
      ),
      el('div', { class: 'settings-section cp-table' },
        el('h2', {}, 'CP values'),
        el('p', { class: 'hint' }, 'Taken from community guides. Empty means unknown. Correct any value to match the game.'),
        table([['', false], ...Core.VERSIONS.map((v) => [v.label, false])], cpRows),
      ),
      el('div', { class: 'settings-section' },
        el('h2', {}, 'Data'),
        el('p', {}, `Card snapshot from ${ALYSION_SNAPSHOT}. ${ALYSION_CARDS.length} cards and ${ALYSION_DECKS.length} decks.`),
        el('ul', {}, SOURCES.map(([text, href]) => el('li', {}, el('a', { href, target: '_blank', rel: 'noopener' }, text)))),
      ),
    ];
  }

  // The button names the theme it switches to.
  function labelThemeButton() {
    $('#theme-toggle').textContent = Theme.current() === 'dark' ? 'Light mode' : 'Dark mode';
  }

  $('#theme-toggle').addEventListener('click', () => {
    Theme.toggle();
    labelThemeButton();
  });
  labelThemeButton();

  $('#cp-balance').addEventListener('change', (event) => {
    account().cp = Math.max(0, Math.trunc(Number(event.target.value) || 0));
    event.target.value = account().cp;
    save();
    render();
  });

  // Keeps a second open tab from overwriting newer changes.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = load();
    $('#card-dialog').close();
    render();
  });

  render();
})();
