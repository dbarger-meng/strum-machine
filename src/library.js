// Built-in song library: common bluegrass jam songs and fiddle tunes, chords only (no lyrics).
// Charts follow the usual jam versions, mostly as charted by the Idaho Bluegrass Association's
// jam notes. Bands vary, so the chart stays editable after loading. Fiddle tunes are written
// out AABB, each part twice.

export const KINDS = ['Songs', 'Gospel', 'Fiddle tunes', 'Waltzes'];

export const LIBRARY = [
  // ---- songs ----
  {
    id: 'roll-in-my-sweet-babys-arms', title: "Roll in My Sweet Baby's Arms", kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 140, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| G | G | D | D |\n| G | G | C | C |\n| D | D | G | G |',
  },
  {
    id: 'salty-dog-blues', title: 'Salty Dog Blues', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 130, preset: 'boom-chuck',
    chart: '| G | E | A | A |\n| D | D | G | G |',
    note: 'Circle-of-fifths changes. Many players use E7, A7 and D7.',
  },
  {
    id: 'worried-man-blues', title: 'Worried Man Blues', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 120, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| D | D | G | G |',
    note: 'The usual 12-bar jam form. The Stanley Brothers play a 16-bar version.',
  },
  {
    id: 'bury-me-beneath-the-willow', title: 'Bury Me Beneath the Willow', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 115, preset: 'boom-chuck',
    chart: '| G | G | C | C |\n| G | G | D | D |\n| G | G | C | C |\n| G | D | G | G |',
  },
  {
    id: 'keep-on-the-sunny-side', title: 'Keep on the Sunny Side', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 115, preset: 'boom-chuck',
    chart: '# verse\n| G | C | G | G |\n| G | G | D | D |\n| D | D | G | G |\n| D | D | G | G |\n'
      + '# chorus\n| G | G | C | G |\n| G | G | D | D |\n| G | G | C | G |\n| G | D | G | G |',
    note: 'Verse, then chorus.',
  },
  {
    id: 'wabash-cannonball', title: 'Wabash Cannonball', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 125, preset: 'boom-chuck',
    chart: '| G | G | G | C |\n| D | D | D | G |\n| G | G | G | C |\n| D | D | D | G | G |',
    note: 'The last line runs five bars.',
  },
  {
    id: 'you-are-my-sunshine', title: 'You Are My Sunshine', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 115, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| C | C | G | G |\n| G | D | G | G |',
  },
  {
    id: 'freight-train', title: 'Freight Train', kind: 'Songs',
    key: 'C', ts: '4/4', tempo: 105, preset: 'boom-chuck',
    chart: '| C | C | G | G |\n| G | G | C | C |\n| E | E | F | F |\n| C | G | C | C |',
  },

  // ---- gospel ----
  {
    id: 'will-the-circle-be-unbroken', title: 'Will the Circle Be Unbroken', kind: 'Gospel',
    key: 'G', ts: '4/4', tempo: 110, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| G | G | G | G |\n| G | D | G | G |',
    note: 'Verse and chorus use the same chords.',
  },
  {
    id: 'ill-fly-away', title: "I'll Fly Away", kind: 'Gospel',
    key: 'G', ts: '4/4', tempo: 120, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| G | G | G | G |\n| G | D | G | G |',
    note: 'Verse and chorus use the same chords.',
  },
  {
    id: 'i-saw-the-light', title: 'I Saw the Light', kind: 'Gospel',
    key: 'G', ts: '4/4', tempo: 125, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | C | G |\n| G | G | G | G |\n| G | G | D | G | G |',
    note: 'The last line runs five bars.',
  },

  // ---- fiddle tunes ----
  {
    id: 'foggy-mountain-breakdown', title: 'Foggy Mountain Breakdown', kind: 'Fiddle tunes',
    key: 'G', ts: '4/4', tempo: 130, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| Em | Em | G | G |\n| Em | Em | G | G |\n| D | D | G | G |',
    note: 'The 1968 Flatt & Scruggs form. A banjo instrumental; the real thing is much faster.',
  },
  {
    id: 'soldiers-joy', title: "Soldier's Joy", kind: 'Fiddle tunes',
    key: 'D', ts: '4/4', tempo: 110, preset: 'boom-chuck',
    chart: '# A part\n| D | D | D | A |\n| D | D | D A | D |\n| D | D | D | A |\n| D | D | D A | D |\n'
      + '# B part\n| D | G | D | A |\n| D | G | D A | D |\n| D | G | D | A |\n| D | G | D A | D |',
  },
  {
    id: 'old-joe-clark', title: 'Old Joe Clark', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 115, preset: 'boom-chuck',
    chart: '# A part\n| A | A | A | E |\n| A | A | A E | A |\n| A | A | A | E |\n| A | A | A E | A |\n'
      + '# B part\n| A | A | A | G |\n| A | A | A E | A |\n| A | A | A | G |\n| A | A | A E | A |',
    note: 'The G in the B part is the flat seven of A.',
  },
  {
    id: 'cripple-creek', title: 'Cripple Creek', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 115, preset: 'boom-chuck',
    chart: '# A part\n| A | D A | A | E A |\n| A | D A | A | E A |\n'
      + '# B part\n| A | A | A | E A |\n| A | A | A | E A |',
    note: 'Short four-bar parts, each played twice.',
  },
  {
    id: 'angeline-the-baker', title: 'Angeline the Baker', kind: 'Fiddle tunes',
    key: 'D', ts: '4/4', tempo: 105, preset: 'boom-chuck',
    chart: '# A part\n| D | D | D | G |\n| D | D | D | D |\n| D | D | D | G |\n| D | D | D | D |\n'
      + '# B part\n| D | D | D | G |\n| D | D | D | D |\n| D | D | D | G |\n| D | D | D | D |',
    note: 'Unusual for bluegrass: no five chord.',
  },
  {
    id: 'blackberry-blossom', title: 'Blackberry Blossom', kind: 'Fiddle tunes',
    key: 'G', ts: '4/4', tempo: 110, preset: 'boom-chuck',
    chart: '# A part\n| G D | C G | C G | A7 D |\n| G D | C G | C G | D G |\n| G D | C G | C G | A7 D |\n| G D | C G | C G | D G |\n'
      + '# B part\n| Em | Em | Em | B7 |\n| Em | Em | C G | D G |\n| Em | Em | Em | B7 |\n| Em | Em | C G | D G |',
    note: 'Quick changes in the A part.',
  },
  {
    id: 'bile-them-cabbage-down', title: 'Bile Them Cabbage Down', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 120, preset: 'boom-chuck',
    chart: '| A | D | A | E |\n| A | D | A E | A |',
    note: 'A first jam tune: the classic I-IV-V workout.',
  },

  // ---- waltzes ----
  {
    id: 'amazing-grace', title: 'Amazing Grace', kind: 'Waltzes',
    key: 'G', ts: '3/4', tempo: 95, preset: 'waltz',
    chart: '| G | G | C | G |\n| G | G | D | D |\n| G | G | C | G |\n| G | D | G | G |',
  },
];
