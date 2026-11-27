# Alysion Collection

Local app for tracking Digimon Alysion cards across 3 accounts. For personal use: card data and images belong to their owners.

## Open it

Double-click `index.html`. Card images need an internet connection; everything else works offline.

## What it does

| Section | Use it to |
|---|---|
| Library | Record the copies you own. `+` and `−` change standard copies; click a card to edit Shiny and alternate art versions; or paste a list. |
| Disassemble | See which copies beyond 4 you can disassemble and the CP they would give. It only informs: your quantities change only when you edit them. |
| Decks | Decks are grouped by color, with a Multicolor group. See which decks are `Ready`, `Craftable` or `Not yet`. Opening one shows its cards as pictures and, for each missing card, similar cards the account can use instead. |
| Packs | See which booster is expected to give the account the most for a goal, and why. |
| Staples | See the recommended cards you are missing. |
| Settings | Rename accounts, back up your data, correct CP values. |

Set each account's CP balance at the top of the page. The `Dark mode` button there switches the theme; until you use it, the page follows the system setting.

## Paste format

One card per line, such as `BT1-010 3`. Add `shiny`, `shiny+`, `alt`, `deluxe` or `premium` at the end for other versions: `BT1-010 1 shiny`.

## Backups

Data is saved only in the browser that opened the page. Export a backup from Settings after big changes, and import it to move to another browser or PC.

## Rules assumed

- Every version of a card counts toward the same 4 copies: 4 Standard plus 1 Shiny leaves 1 Standard to disassemble.
- Extra copies are taken in this order: Standard, Shiny, Shiny+, Alt Art, Deluxe Alt Art, Premium Alt Art.
- Promo and restricted cards give no CP and cannot be crafted.
- Unknown CP values stay empty until you enter them in Settings.

## Update the data

Cards:

```powershell
node tools/fetch-cards.mjs
```

Decks and staples are snapshots in `data/decks.js` (Game8), `data/decks-guides.js` (Simbozz guides, 2026-11-27) and `data/staples.js`, the first and last taken on 2026-11-26. Game8 blocks automated downloads, so they are updated by hand.

Community decks (complete and legal shared lists, written by players and not rated):

```powershell
node tools/fetch-community-decks.mjs
```

## Tests

```powershell
node --test tests/*.test.js
```
