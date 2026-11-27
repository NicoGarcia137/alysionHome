// Snapshot of the Simbozz deck guides taken on 2026-11-27: https://simbozz.gg/digimon-alysion/decks
// Guide decks have no tier. Left out because they need cards missing from the card data:
// Renamon & Yukinamon (ED01), UlforceVeedramon (ST8) and Mastemon DNA (ST10).
(function () {
  const guide = (slug, name, main, eggs) => ({
    id: `sb-${slug}`,
    tier: '',
    source: 'Simbozz',
    url: `https://simbozz.gg/digimon-alysion/decks/${slug}`,
    name,
    main,
    eggs,
    alternates: '',
  });

  globalThis.ALYSION_DECKS.push(
    guide('red-omnimon-deck-guide', 'Red Omnimon',
      'BT1-009*2 BT1-010*4 BT1-019*4 BT1-020*2 BT1-021*2 BT1-023*4 BT1-084*4 BT2-018*2 ST1-02*2 ST1-03*4 ST1-06*4 ST1-07*4 ST1-10*4 ST1-16*4 BT1-085*4',
      'ST1-01*4 BT2-001*1'),
    guide('blue-imperialdramon-deck-guide-digimon-alysion', 'Blue Imperialdramon',
      'BT1-029*2 BT1-030*1 BT2-021*4 BT3-021*4 ST2-02*4 BT1-032*2 BT1-037*2 BT3-025*4 ST2-07*4 BT3-027*4 BT3-055*4 BT3-031*4 BT3-111*3 BT1-084*2 BT3-093*2 ST2-13*4',
      'BT3-002*4 BT1-003*1'),
    guide('green-blue-imperialdramon-dragon-mode-deck-guide', 'Green/Blue Imperialdramon Dragon Mode',
      'BT1-068*4 BT3-047*4 BT2-043*4 BT3-046*2 BT3-050*4 BT1-073*4 BT1-074*2 BT1-072*2 BT3-055*4 BT3-027*2 BT1-079*2 BT3-054*2 BT3-111*2 BT3-058*2 BT3-057*2 BT3-094*3 BT1-110*2 BT2-100*2 BT1-112*1',
      'BT3-004*4 BT2-004*1'),
    guide('green-rusttyrannomon-control-deck-guide-digimon-alysion', 'Green RustTyrannomon Control',
      'BT1-067*4 BT3-046*4 ST4-03*4 BT1-066*2 BT2-044*4 BT1-074*4 BT2-045*2 ST4-08*2 BT2-046*4 BT1-079*2 BT3-054*2 BT2-051*4 BT3-057*2 BT2-088*4 BT1-089*2 BD2-009*2 BT1-110*2',
      'BT3-004*4 ST4-01*1'),
    guide('green-ceresmon-deck-guide-digimon-alysion', 'Green Ceresmon',
      'BT1-067*4 ST4-03*4 BT3-046*4 BT1-068*2 BT2-045*4 BT1-071*4 ST4-08*4 BT2-047*4 BT3-054*4 ST4-10*2 BT3-056*4 BT2-050*2 BT1-089*4 BT1-110*2 BT3-103*1 BT2-102*1',
      'BT2-004*4 ST4-01*1'),
    guide('yellow-shinegreymon-deck-guide-digimon-alysion', 'Yellow ShineGreymon',
      'BT1-049*4 BT2-034*4 BT3-033*4 ST3-04*2 BT2-035*4 ST3-07*4 BT3-036*2 BT2-038*4 ST3-09*3 BT2-041*4 BT1-087*4 BT2-087*4 ST3-12*3 BT2-099*4',
      'BT3-003*4 BT2-003*1'),
    guide('purple-piedmon-deck-guide-digimon-alysion', 'Purple Piedmon',
      'BT2-068*4 BT2-070*4 ST6-03*4 BT3-077*2 BT2-074*4 ST6-08*4 BT2-073*4 BT3-088*4 BT2-078*2 ST6-10*2 BT2-080*4 BT2-081*2 BT3-091*1 BT2-090*3 ST6-14*1 ST6-15*2 BT2-108*2 ST6-16*1',
      'BT3-006*4 ST6-01*1'),
    guide('black-craniamon-blocker-control-deck-guide-digimon-alysion', 'Black Craniamon Blocker Control',
      'ST5-03*4 BT2-055*4 ST5-04*4 BT2-058*4 ST5-08*3 BT2-057*3 ST5-11*4 BT2-061*2 BT2-063*2 BT3-075*4 BT2-065*3 ST5-12*1 BT2-089*2 BT3-095*2 ST5-14*1 BT3-106*3 BT3-105*2 BT2-104*2',
      'ST5-01*4 BT2-005*1'),
  );
})();
