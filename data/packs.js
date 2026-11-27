// Booster draw rates published on the Game8 pack pages, taken on 2026-11-27 (percent per card).
// `guaranteed` applies to the last card of the 10th pack when buying 10.
// `alternateArt` is the share of alternate art draws, which the app does not track by card.
globalThis.ALYSION_PACKS = [
  { id: 'BD-01', name: 'New Evolution', page: '626090', alternateArt: 0.7,
    rates: { C: 55.8, U: 24, R: 15, SR: 4, SEC: 0.5 }, guaranteed: { SR: 97.3, SEC: 2 } },
  { id: 'BD-02', name: 'Ultimate Power', page: '626112', alternateArt: 0.2,
    rates: { C: 56.3, U: 24, R: 15, SR: 4, SEC: 0.5 }, guaranteed: { SR: 97.8, SEC: 2 } },
  { id: 'BD-03', name: 'Union Impact', page: '626115', alternateArt: 0.2,
    rates: { C: 56.3, U: 24, R: 15, SR: 4, SEC: 0.5 }, guaranteed: { SR: 97.8, SEC: 2 } },
  { id: 'BD-04', name: 'Great Legend', page: '626116', alternateArt: 0.7,
    rates: { C: 55.8, U: 24, R: 15, SR: 4, SEC: 0.5 }, guaranteed: { SR: 97.3, SEC: 2 } },
].map((pack) => ({ ...pack, slots: 6, url: `https://game8.co/games/Digimon-Alysion/archives/${pack.page}` }));
