# Alysion Collection App

Local app that tracks Digimon Alysion cards for 3 accounts. Status: design approved, building. No git repository.
Delivery: `C:\Users\Moby\Desktop\Digi`. Test runner: `node --test` (Node 24).

## Specs

### Intent
The user plays 3 accounts and wants, per account: which cards to disassemble, a card library of what they own, and which decks are viable with those cards. With no card trading, each account is evaluated on its own.

### Goals
- Loading a collection by hand is fast enough to keep 3 accounts up to date.
- Every answer is per account.

### Non-goals
- No server, sign-in, or sync between devices.
- No screenshot/OCR import, no custom deck builder, no automatic data refresh.
- Not published or shared: card data and images belong to their owners; personal use only.

### Constraints
- Opens in a PC browser by double-clicking `index.html` (works from `file://`).
- Plain HTML, CSS and JavaScript, no build step. Data ships as `.js` files.
- English UI (assumption).

### Approaches
| Approach | Trade-off | Outcome |
|---|---|---|
| Local PC app | Simplest; data stays in that browser | **Chosen by the user** |
| Private web page on claude.ai | PC and phone sync; depends on a Claude account; external images may not load | Not chosen |
| Local app with its own server | Could refresh data itself; too much upkeep | Discarded |

### Data (snapshot)
- Cards: `https://alysioncards.com/api/cards` (631 cards, about 640 KB).
- Decks: every deck linked from `https://game8.co/games/Digimon-Alysion/archives/557342` (23 found: 17 tiered S/A/B/C, 6 unranked), with card IDs, quantities, Digi-Eggs and alternate card suggestions.
- Staples: `https://alysioncards.com/guides/staple-cards-at-launch`.
- Card images: loaded from `images.alysioncards.com`; only images need a connection.
- Integrity: every deck card ID exists in the card data and every main deck has 50 cards. A deck that fails is reported, never silently dropped or patched.

### Game rules
Craft / disassemble CP per version (`?` = unknown, never guessed):

| Rarity | Standard | Shiny | Shiny+ | Alt Art | Deluxe AA | Premium AA |
|---|---|---|---|---|---|---|
| C | 40/10 | 60/15 | ?/? | ?/? | ?/? | ?/? |
| U | 80/20 | 120/30 | 160/? | ?/? | ?/? | ?/? |
| R | 200/50 | 300/? | ?/? | ?/800 | 12000/? | 18000/? |
| SR | 800/200 | 1000/250 | 1200/? | ?/? | 12000/3000 | 18000/? |
| SEC | 2400/600 | 3000/? | ?/? | 3200/? | ?/? | ?/? |

- Only surplus copies can be disassembled (confirmed by the user in game).
- Foil and alternate-art versions can be disassembled (confirmed by the user, L4; Game8 says otherwise).
- All versions of a card count toward the same 4 copies (user: with 4 Standard and 1 foil, the foil can be disassembled, L8).
- Surplus is assigned in this order: Standard, then Shiny and Shiny+ (user, L9), then Alt Art, Deluxe AA, Premium AA (assumption; keeps alternate art for last).
- CP values: https://simbozz.gg/guides/digimon-alysion-crafting-guide; SEC standard from https://game8.co/games/Digimon-Alysion/archives/561152. The user can edit every value in the app.
- Promo and restricted cards can be neither crafted nor disassembled (Game8).

### S1 Accounts
Three accounts, default names `Account 1` to `Account 3`, renameable. Each has its own card quantities (0 to 99) and a CP balance typed by the user.

### S2 Card library
"poder cargar que cartas tengo por cuenta como una biblioteca o card list"
- Card grid with image, number, name and owned quantity; add and subtract standard copies with one click; a card detail edits every version (Standard, Shiny, Shiny+, Alt Art, Deluxe Alt Art, Premium Alt Art). Decks count all versions together.
- Search by name or number; filter by color, rarity, set, owned/missing, staple.
- Bulk paste (proposal): one card per line (`BT1-010 3`, `3 BT1-010`, `BT1-010 x3`). It sets the quantity. Unknown lines are listed; valid lines still apply.

### S3 What to disassemble
"que cartas descraftear por cuenta" / "si me permite descraftear cartas con rarezas foil o diferentes a las normales de C U R SR y SEC"
- For each card above 4 copies, lists the versions to disassemble: owned, card total, surplus, CP gained; plus the total CP.
- Surplus with an unknown CP value is listed and excluded from the total, with a notice.
- Promo and restricted surplus is listed separately as not disassemblable.

### S4 Viable decks
"que decks por las cartas que tengo son viables de armar /jugar"
- Per deck: tier, owned/required cards, missing cards, CP to craft them.
- Status: `Ready` (nothing missing), `Craftable` (cost within CP balance plus surplus CP, and every missing card craftable), `Not yet`.
- "que los listados de decks esten de mayor a menor coincidencia ordenados" (L19): order by share of owned cards, highest first; ties by status, tier, CP cost. Each deck is evaluated alone and shows its percentage.
- Deck detail (L20): "que la visualizacion de los detalle de decks sea de esta forma y no de formato lista" (a picture grid with a quantity badge per card, Main Deck and Digi-Egg sections). Source alternate suggestions and the source link stay.
- "ademas mostrar opciones o variantes para las cartas faltantes segun las cartas disponibles en esa cuenta": per missing card, up to 4 owned options with spare copies: source swaps, then same name, then same type, color and level. Shown only; deck status does not count them. Effects are not compared (assumption).
- Comparison (proposal): each deck shows how close each of the 3 accounts is.

### S5 Craft advice (proposal)
- The deck detail is the craft list for that deck.
- A staples view lists staples missing in the account, with the number of tiered decks using each.

### S7 More decks (added 2026-11-27)
"buscar otras paginas que recomienden mas decks para alysion para poder poblar de opciones y sumar ademas de lo \"Meta\""
- Add recommended decks from other pages next to the Game8 meta decks, each showing its source, with a source filter.
- Only complete 50-card lists whose cards all exist in the card data.
- Community lists from AlysionCards (user: "Sí, sumalos", L18): 50 main cards, up to 5 eggs, legal copy limits, no repeated lists, shown as source `Community`; refresh with `node tools/fetch-community-decks.mjs`.

### S8 Dark mode (added 2026-11-27)
"agregar modo oscuro"
- A header button switches light and dark; the choice is remembered. Without a choice the page follows the system setting (assumption).

### S9 Packs (added 2026-11-27)
"buscar tambien las pulls por sobre de la expansion y que sobre conviene por porcentaje tirar sobre las opciones y porque , agregarlo como una pestaña para cada cuenta"
- A Packs tab per account ranking BD-01 to BD-04 for a goal (tiered meta decks, staples, any missing card, one deck), with percentages and the reasons.
- Rates from the Game8 pack pages (626090, 626112, 626115, 626116); card pool from `acquisition_info` in the card data.
- Assumptions: cards of one rarity are equally likely; value = craft CP of needed cards expected in a 10-pack purchase; alternate art draws are not counted.

### S6 Backup
Data is saved in the browser. Export and import one JSON file with all accounts; import asks before replacing. The app shows when the last export happened.

### Acceptance checks
- Logic (surplus, CP cost, deck status, paste parsing, backup round trip) covered by automated tests.
- In a browser: load cards into two accounts, reload, confirm they persist and stay separate.

## Tasks

- T1 Data snapshot script and data files (Data) — inline — done, 631 cards, 23 decks; no commit (no git)
- T2 Logic core with tests (S1-S6) — inline — done, RED (module missing) then GREEN 20/20
- T3 Interface (S1-S6) — inline — done
- T4 Browser verification (acceptance checks) — inline — done, see L7

## Log

- L1 (2026-11-26, original request): "quiero que utilices toda la informacion de estas 3 paginas para recabar informacion sobre meta del juego , crafteos y listas de cartas y decks https://game8.co/games/Digimon-Alysion/archives/557342 https://game8.co/games/Digimon-Alysion/archives/637066 https://game8.co/games/Digimon-Alysion/archives/636912 ademas esta pagina tiene la lista de todas las cartas actuales del juego https://alysioncards.com/guides/staple-cards-at-launch Tengo 3 cuentas la idea es realizar una aplicacion donde me diga que cartas descraftear por cuenta , poder cargar que cartas tengo por cuenta como una biblioteca o card list , y otra que sea de que decks por las cartas que tengo son viables de armar /jugar"
- L2 (2026-11-26): "No, solo extras" (only surplus copies can be disassembled).
- L3 (2026-11-26): "App en la PC".
- L4 (2026-11-26, approval): "tenes la carpeta de digi en el escritorio para desarrollarlo , empezar a construirlo , si me permite descraftear cartas con rarezas foil o diferentes a las normales de C U R SR y SEC". Read as: build it in `Desktop\Digi`; the game does allow disassembling foil and non-standard versions. Approval covers the stated data download.
- L5 (2026-11-26): tasks kept here instead of a separate plan file (user instructions: one feature document).
- L6 (2026-11-26): Game8 answers HTTP 403 to scripted downloads, so decks were read in the browser pane and stored by hand; only cards have a refresh script. Restricted cards in the data: BT2-047, BT3-103. The Gaomon deck lists 49 main cards at the source.
- L7 (2026-11-26): verified on a temporary localhost server: paste import, per-account separation, persistence after reload, surplus and locked rows, deck status and detail, staples, CP edit, rename, backup import (valid and invalid), card images, no console errors. Not verified: opening via `file://`, the export download click.
- Risk: item 6 (the interface has no automated tests). No independent verifier ran.
- Open: confirm whether the game counts surplus per version or per card number.
- L8 (2026-11-26, answer to "Con 4 normales y 1 foil de la misma carta, ¿te deja descraftear una?"): "si me deja la foil". Closes the open point: surplus is per card number. T2 and T3 reopened for it.
- L9 (2026-11-26): "si tengo mas copias de las 4 la normal , y despues las foil". Standard copies are disassembled first, then foils. Done: RED 2 failing, GREEN 23/23.
- L10 (2026-11-26): "osea no hacer descrafteo automatico sino informarlo como posible". Confirmed no code path disassembles; screen wording now presents it as a suggestion, and a test pins that listing never changes the collection (passes on existing behavior).
- L11 (2026-11-26): "Estás son las imágenes si vas a armar el listado , esto es solo de mi cuenta principal". 13 screenshots transcribed into `collections/main-account.txt`: 325 cards, 600 copies, all matched to the card data with no repeats; on-screen order is monotonic per level, which supports the choices between same-name cards (compared by art). The game showed 393/1180 progress. No ST, SD or P cards appear in the screenshots. Quantities were read by eye. All copies are listed as standard.
- L12 (2026-11-26): "estan ahi dentro de ese listado" (about ST, SD and P cards). Checked: the list has 0 ST, SD or P cards; same-stat pairs were compared by art. Waiting for one example card from the user.
- L13 (2026-11-27): "Ahí encontré donde está toda la lista completa ahora si" (20 Card List screenshots, CP balance 505). The user was right: this view shows ST, SD, P and foil entries that the Collection view did not. Added 68 entries; `collections/main-account.txt` now has 393 lines, 727 copies, 357 cards. Standard counts that overlap the first screenshots matched by eye. Renamon BD2-002, Agumon BT1-010 and Lobomon BT4-025 alternate art listed as Shiny+ (assumption). In game "Crimson Impale" is SD1-07, named "Burning Drive" in the card data. Pending: rows after Lv.5 MetalGreymon (black) and after Lv.6 SD1-05 are not in these screenshots.
- S2 change: bulk paste accepts a version word at the end of a line (needed to load foils). RED 1 failing, GREEN 26/26.
- L14 (2026-11-27): "Está así ahí está todo". User decision: the 393-line list stays as the complete one. Noted to the user once: screenshot 20 shows a cut row below SD1-05 that was not transcribed.
- L15 (2026-11-27): "Esto es lo de la cuenta 2" (20 Card List screenshots, sort None, CP 0). `collections/account-2.txt`: 320 lines, 564 copies, 290 cards, BT1 to BT4. All matched; on-screen order is ascending by card number in every set, with no repeats. Alternate art listed as Shiny+ (Lv.3-4) or Alt Art (Lv.6) (assumption). The last screenshot stops at BT1-093 area (Nuclear Laser) with more rows below.
- L16 (2026-11-27): "Ahí pase de 0 devuelta todo lo de cuenta 2". The new set reaches the end of the list. `collections/account-2.txt` replaced: 391 lines, 726 copies, 352 cards (BT, BD, ST, SD); all matched, ascending in every set, no repeats. Surplus 590 CP.
- L17 (2026-11-27, S7): added 8 Simbozz guide decks (31 total) with source filter. RED 1 failing, GREEN 27/27; Decks view checked with a DOM stand-in, not a browser. Left out: three Simbozz decks needing ED01, ST8 or ST10 cards; Game8 starter and entry tier lists (no card lists found); GachaGo and LDPlayer (no card numbers); DigimonCard (refuses automated access); AlysionCards community decks (unrated, not added).
- L18 (2026-11-27): "Sí, sumalos". 173 of 243 community lists added (204 decks total). RED 4 failing, GREEN 31/31.
- L19 (2026-11-27): "que los listados de decks esten de mayor a menor coincidencia ordenados". Done: RED 1 failing, GREEN 32/32.
- L20 (2026-11-27): picture view and options for missing cards (S4), with a screenshot of a DigimonCard deck list. Done: RED 5 failing, GREEN 37/37. A DOM stand-in render caught and led to fixing a nested-list bug. Layout not checked in a real browser (preview tool still points at the previous folder).
- L21 (2026-11-27): "Sí, está bien" (picture view accepted), then "agregar modo oscuro" (S8). Done: RED module missing, GREEN; contrast computed, not seen in a browser.
- L22 (2026-11-27, S9): Packs tab. RED 7 failing, GREEN 48/48; card data refreshed with pack names, other fields unchanged; rendered with a DOM stand-in, not a browser.
- L23 (2026-11-27): "subir esto a un repositorio de github de mi cuenta con mi mail franconicolas.garcia@gmail.com que sea alysionHome el nombre". Local git repository created; commit author email set for this repository only.
- L24 (2026-11-27): "ya deje mi cuenta abierta en el navegador pero revisa que sea mi mail personal y no el mail de moby mi empresa laboral el de github", "En mi Chrome". Verified in Chrome: account NicoGarcia137 lists the personal email and no work email. Private repository NicoGarcia137/alysionHome created; commit author set to that account.
