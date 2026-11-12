// Built-in song library: common bluegrass jam songs and fiddle tunes (no lyrics). Some also
// have a melody, in melodies.js under the same id.
// Charts follow the usual jam versions, mostly as charted by the Idaho Bluegrass Association's
// jam notes. Bands vary, so the chart stays editable after loading. Fiddle tunes are written
// out AABB, each part twice.
//
// Tempos are quarter notes per minute, the app's unit. Bluegrass is counted in cut time (two
// beats to the bar, a boom-chuck on each), so a 4/4 song here is at twice its cut-time tempo:
// 210 is the usual "105". They are set a little under recording speed, for practice.

export const KINDS = ['Songs', 'Gospel', 'Fiddle tunes', 'Waltzes'];

export const LIBRARY = [
  // ---- songs ----
  {
    id: 'roll-in-my-sweet-babys-arms', title: "Roll in My Sweet Baby's Arms", kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 250, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| G | G | D | D |\n| G | G | C | C |\n| D | D | G | G |',
  },
  {
    id: 'salty-dog-blues', title: 'Salty Dog Blues', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 230, preset: 'boom-chuck',
    chart: '| G | E | A | A |\n| D | D | G | G |',
    note: 'Circle-of-fifths changes. Many players use E7, A7 and D7.',
  },
  {
    id: 'worried-man-blues', title: 'Worried Man Blues', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 220, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| D | D | G | G |',
    note: 'The usual 12-bar jam form. The Stanley Brothers play a 16-bar version.',
  },
  {
    id: 'bury-me-beneath-the-willow', title: 'Bury Me Beneath the Willow', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '| G | G | C | C |\n| G | G | D | D |\n| G | G | C | C |\n| G | D | G | G |',
  },
  {
    id: 'keep-on-the-sunny-side', title: 'Keep on the Sunny Side', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '# verse\n| G | C | G | G |\n| G | G | D | D |\n| D | D | G | G |\n| D | D | G | G |\n'
      + '# chorus\n| G | G | C | G |\n| G | G | D | D |\n| G | G | C | G |\n| G | D | G | G |',
    note: 'Verse, then chorus.',
  },
  {
    id: 'wabash-cannonball', title: 'Wabash Cannonball', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 220, preset: 'boom-chuck',
    chart: '| G | G | G | C |\n| D | D | D | G |\n| G | G | G | C |\n| D | D | D | G | G |',
    note: 'The last line runs five bars.',
  },
  {
    id: 'you-are-my-sunshine', title: 'You Are My Sunshine', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| C | C | G | G |\n| G | D | G | G |',
  },
  {
    id: 'freight-train', title: 'Freight Train', kind: 'Songs',
    key: 'C', ts: '4/4', tempo: 180, preset: 'boom-chuck',
    chart: '| C | C | G | G |\n| G | G | C | C |\n| E | E | F | F |\n| C | G | C | C |',
  },

  {
    id: 'nine-pound-hammer', title: 'Nine Pound Hammer', kind: 'Songs',
    key: 'A', ts: '4/4', tempo: 230, preset: 'boom-chuck',
    chart: '| A | A | D | D |\n| A | E | A | A |\n| A | A | D | D |\n| A | E | A | A |',
  },
  {
    id: 'blue-ridge-cabin-home', title: 'Blue Ridge Cabin Home', kind: 'Songs',
    key: 'A', ts: '4/4', tempo: 230, preset: 'boom-chuck',
    chart: '| A | A | D | D |\n| E | E | A | A |\n| A | A | D | D |\n| E | E | A | A |',
    note: 'The four chord goes straight to the five, never back to the one.',
  },
  {
    id: 'mountain-dew', title: 'Mountain Dew', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 230, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| G | G | G | G |\n| G | D | G | G |',
    note: 'The same chords as Will the Circle Be Unbroken.',
  },
  {
    id: 'old-home-place', title: 'Old Home Place', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 220, preset: 'boom-chuck',
    chart:
      '# verse\n'
      + '| G | B | C | G |\n'
      + '| G | G | D | D |\n'
      + '| G | B | C | G |\n'
      + '| G | D | G | G |\n'
      + '# chorus\n'
      + '| D | D | G | G |\n'
      + '| A | A | D | D |\n'
      + '| G | B | C | G |\n'
      + '| G | D | G | G |',
    note: 'Verse, then chorus. Often sung as two verses before each chorus, and usually played in B flat (Key shift +3).',
  },
  {
    id: 'lonesome-road-blues', title: 'Lonesome Road Blues', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 240, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| C | C | G | G |\n| D | D | G | G |',
    note: 'Also known as Going Down the Road Feeling Bad.',
  },
  {
    id: 'columbus-stockade-blues', title: 'Columbus Stockade Blues', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 220, preset: 'boom-chuck',
    chart:
      '# verse\n'
      + '| G | G | G | G |\n'
      + '| D | D | G | G |\n'
      + '| G | G | G | G |\n'
      + '| D | D | G | G |\n'
      + '# chorus\n'
      + '| C | C | G | G |\n'
      + '| C | C | D | D |\n'
      + '| G | G | G | G |\n'
      + '| D | D | G | G |',
    note: 'Verse, then chorus.',
  },
  {
    id: 'im-thinking-tonight-of-my-blue-eyes', title: "I'm Thinking Tonight of My Blue Eyes", kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '| G | G | C | C |\n| D | D | G | G |\n| G | G | C | C |\n| D | D | G | G |',
  },
  {
    id: 'roving-gambler', title: 'Roving Gambler', kind: 'Songs',
    key: 'A', ts: '4/4', tempo: 230, preset: 'boom-chuck',
    chart: '| A | A | A | A |\n| A | A | D | A |\n| A | A | E | A | A |',
    note: 'Thirteen bars: the last line runs five.',
  },
  {
    id: 'beautiful-brown-eyes', title: 'Beautiful Brown Eyes', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '| G | G | C | C |\n| G | G | D | D |\n| G | G | C | C |\n| D | D | G | G |',
    note: 'The bluegrass version, counted two to the bar. Outside bluegrass it is usually a waltz.',
  },
  {
    id: 'shell-be-coming-round-the-mountain', title: "She'll Be Coming Round the Mountain", kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 230, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| G | G | D | D |\n| G | G | C | C |\n| G | D | G | G |',
  },
  {
    id: 'banks-of-the-ohio', title: 'Banks of the Ohio', kind: 'Songs',
    key: 'G', ts: '4/4', tempo: 190, preset: 'boom-chuck',
    chart: '| G | G | D | D |\n| D | D | G | G |\n| G | G | C | C |\n| G | D | G | G |',
  },
  {
    id: 'wildwood-flower', title: 'Wildwood Flower', kind: 'Songs',
    key: 'C', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '| C | C | G | C | C |\n| C | C | G | C | C |\n| C | C | F | C |\n| C | C | G | C | C |',
    note: 'Nineteen bars: the first, second and last lines run five.',
  },
  // ---- gospel ----
  {
    id: 'will-the-circle-be-unbroken', title: 'Will the Circle Be Unbroken', kind: 'Gospel',
    key: 'G', ts: '4/4', tempo: 190, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| G | G | G | G |\n| G | D | G | G |',
    note: 'Verse and chorus use the same chords.',
  },
  {
    id: 'ill-fly-away', title: "I'll Fly Away", kind: 'Gospel',
    key: 'G', ts: '4/4', tempo: 210, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| G | G | G | G |\n| G | D | G | G |',
    note: 'Verse and chorus use the same chords.',
  },
  {
    id: 'i-saw-the-light', title: 'I Saw the Light', kind: 'Gospel',
    key: 'G', ts: '4/4', tempo: 220, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | C | G |\n| G | G | G | G |\n| G | G | D | G | G |',
    note: 'The last line runs five bars.',
  },

  {
    id: 'cryin-holy', title: "Cryin' Holy Unto the Lord", kind: 'Gospel',
    key: 'G', ts: '4/4', tempo: 230, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| C | C | G | G |\n| G | G | G | G |\n| G | D | G | G |',
    note: 'The same chords as Will the Circle Be Unbroken.',
  },
  // ---- fiddle tunes ----
  {
    id: 'foggy-mountain-breakdown', title: 'Foggy Mountain Breakdown', kind: 'Fiddle tunes',
    key: 'G', ts: '4/4', tempo: 260, preset: 'boom-chuck',
    chart: '| G | G | G | G |\n| Em | Em | G | G |\n| Em | Em | G | G |\n| D | D | G | G |',
    note: 'The 1968 Flatt & Scruggs form. A banjo instrumental; recordings run faster still.',
  },
  {
    id: 'soldiers-joy', title: "Soldier's Joy", kind: 'Fiddle tunes',
    key: 'D', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '# A part\n| D | D | D | A |\n| D | D | D A | D |\n| D | D | D | A |\n| D | D | D A | D |\n'
      + '# B part\n| D | G | D | A |\n| D | G | D A | D |\n| D | G | D | A |\n| D | G | D A | D |',
  },
  {
    id: 'old-joe-clark', title: 'Old Joe Clark', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 210, preset: 'boom-chuck',
    chart: '# A part\n| A | A | A | E |\n| A | A | A E | A |\n| A | A | A | E |\n| A | A | A E | A |\n'
      + '# B part\n| A | A | A | G |\n| A | A | A E | A |\n| A | A | A | G |\n| A | A | A E | A |',
    note: 'The G in the B part is the flat seven of A.',
  },
  {
    id: 'cripple-creek', title: 'Cripple Creek', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '# A part\n| A | D A | A | E A |\n| A | D A | A | E A |\n'
      + '# B part\n| A | A | A | E A |\n| A | A | A | E A |',
    note: 'Short four-bar parts, each played twice.',
  },
  {
    id: 'angeline-the-baker', title: 'Angeline the Baker', kind: 'Fiddle tunes',
    key: 'D', ts: '4/4', tempo: 190, preset: 'boom-chuck',
    chart: '# A part\n| D | D | D | G |\n| D | D | D | D |\n| D | D | D | G |\n| D | D | D | D |\n'
      + '# B part\n| D | D | D | G |\n| D | D | D | D |\n| D | D | D | G |\n| D | D | D | D |',
    note: 'Unusual for bluegrass: no five chord.',
  },
  {
    id: 'blackberry-blossom', title: 'Blackberry Blossom', kind: 'Fiddle tunes',
    key: 'G', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart: '# A part\n| G D | C G | C G | A7 D |\n| G D | C G | C G | D G |\n| G D | C G | C G | A7 D |\n| G D | C G | C G | D G |\n'
      + '# B part\n| Em | Em | Em | B7 |\n| Em | Em | C G | D G |\n| Em | Em | Em | B7 |\n| Em | Em | C G | D G |',
    note: 'Quick changes in the A part.',
  },
  {
    id: 'bile-them-cabbage-down', title: 'Bile Them Cabbage Down', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 210, preset: 'boom-chuck',
    chart: '| A | D | A | E |\n| A | D | A E | A |',
    note: 'A first jam tune: the classic I-IV-V workout.',
  },

  {
    id: 'buffalo-gals', title: 'Buffalo Gals', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 210, preset: 'boom-chuck',
    chart:
      '# A part\n'
      + '| A | A | E | A |\n'
      + '| A | A | E | A |\n'
      + '| A | A | E | A |\n'
      + '| A | A | E | A |\n'
      + '# B part\n'
      + '| A | A | E | A |\n'
      + '| A | A | E | A |\n'
      + '| A | A | E | A |\n'
      + '| A | A | E | A |',
    note: 'Both parts use the same four-bar line, eight times through.',
  },
  {
    id: 'liberty', title: 'Liberty', kind: 'Fiddle tunes',
    key: 'D', ts: '4/4', tempo: 210, preset: 'boom-chuck',
    chart:
      '# A part\n'
      + '| D | D | D | D A7 |\n'
      + '| D | D | A7 | D |\n'
      + '| D | D | D | D A7 |\n'
      + '| D | D | A7 | D |\n'
      + '# B part\n'
      + '| D | G | Em | A7 |\n'
      + '| D | G | A7 | D |\n'
      + '| D | G | Em | A7 |\n'
      + '| D | G | A7 | D |',
  },
  {
    id: 'red-haired-boy', title: 'Red Haired Boy', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 210, preset: 'boom-chuck',
    chart:
      '# A part\n'
      + '| A | A D | A | G |\n'
      + '| A | A D | A E7 | A |\n'
      + '| A | A D | A | G |\n'
      + '| A | A D | A E7 | A |\n'
      + '# B part\n'
      + '| G | G D | A | G |\n'
      + '| A | A D | A E7 | A |\n'
      + '| G | G D | A | G |\n'
      + '| A | A D | A E7 | A |',
    note: 'The G is the flat seven of A.',
  },
  {
    id: 'cherokee-shuffle', title: 'Cherokee Shuffle', kind: 'Fiddle tunes',
    key: 'A', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart:
      '# A part\n'
      + '| A | A D | A | F#m |\n'
      + '| D | A | F#m E7 | A |\n'
      + '| A | A D | A | F#m |\n'
      + '| D | A | F#m E7 | A |\n'
      + '# B part\n'
      + '| D | A | D A | E A7 | D |\n'
      + '| A | F#m | D | D E7 | A |\n'
      + '| D | A | D A | E A7 | D |\n'
      + '| A | F#m | D | D E7 | A |',
    note: 'The B part is ten bars long, not the usual eight.',
  },
  {
    id: 'turkey-in-the-straw', title: 'Turkey in the Straw', kind: 'Fiddle tunes',
    key: 'G', ts: '4/4', tempo: 210, preset: 'boom-chuck',
    chart:
      '# A part\n'
      + '| G | G | G Em | Am D7 |\n'
      + '| G | G | G Em | D7 G |\n'
      + '| G | G | G Em | Am D7 |\n'
      + '| G | G | G Em | D7 G |\n'
      + '# B part\n'
      + '| G | G7 | C | C D7 |\n'
      + '| G | G D7 | G Em | D7 G |\n'
      + '| G | G7 | C | C D7 |\n'
      + '| G | G D7 | G Em | D7 G |',
  },
  {
    id: 'billy-in-the-lowground', title: 'Billy in the Lowground', kind: 'Fiddle tunes',
    key: 'C', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart:
      '# A part\n'
      + '| C | C | Am | Am |\n'
      + '| C | C | Am | Am G7 C |\n'
      + '| C | C | Am | Am |\n'
      + '| C | C | Am | Am G7 C |\n'
      + '# B part\n'
      + '| C | C G | Am | Am |\n'
      + '| C | C G | Am | Am G7 C |\n'
      + '| C | C G | Am | Am |\n'
      + '| C | C G | Am | Am G7 C |',
  },
  {
    id: 'golden-slippers', title: 'Golden Slippers', kind: 'Fiddle tunes',
    key: 'D', ts: '4/4', tempo: 200, preset: 'boom-chuck',
    chart:
      '# verse\n'
      + '| D | D A7 | D | A7 |\n'
      + '| A7 | A7 | A7 | D |\n'
      + '| D | D A7 | D | A7 |\n'
      + '| A7 | A7 | A7 | D |\n'
      + '# chorus (two endings)\n'
      + '| D | D7 | G | Em E7 |\n'
      + '| A7 | A7 | D A7 | D A7 |\n'
      + '| D | D7 | G | Em E7 |\n'
      + '| A7 | A7 | D A7 | D |',
  },
  // ---- waltzes ----
  {
    id: 'amazing-grace', title: 'Amazing Grace', kind: 'Waltzes',
    key: 'G', ts: '3/4', tempo: 95, preset: 'waltz',
    chart: '| G | G | C | G |\n| G | G | D | D |\n| G | G | C | G |\n| G | D | G | G |',
  },
  {
    id: 'all-the-good-times', title: 'All the Good Times Are Past and Gone', kind: 'Waltzes',
    key: 'A', ts: '3/4', tempo: 100, preset: 'waltz',
    chart: '| A | A | D | A |\n| A | A | E | E |\n| A | A | D | A |\n| A | E | A | A |',
    note: 'The same chords as Amazing Grace.',
  },
];
