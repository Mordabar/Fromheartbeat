// Fromheartbeat icon set: one monoline vector language for the 3D studio (canvas) and the DOM (svg).
// Every icon lives on a 24×24 grid. A shape is [path, mode]: 's' stroke (default), 't' tinted fill + stroke, 'f' solid fill.
const C = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const dot = (x, y, r = 0.9) => [C(x, y, r), 'f'];
const head = (x, y, r) => [C(x, y, r), 't'];

export const ICONS = {
  // ---- interface
  play: [['M8 5v14l11-7z', 't']],
  pause: [['M8 5v14M16 5v14']],
  rec: [[C(12, 12, 8.5)], dot(12, 12, 4.2)],
  check: [['M5 12.5l4.5 4.5L19 7.5']],
  arrow: [['M5 12h14M13 6l6 6-6 6']],
  back: [['M19 12H5M11 6l-6 6 6 6']],
  close: [['M6 6l12 12M18 6L6 18']],
  lines: [['M4 6h16M4 12h16M4 18h10']],
  headphones: [['M3 14v-2a9 9 0 0 1 18 0v2'], ['M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z', 't']],
  pen: [['M12 20h9'], ['M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', 't']],
  refresh: [['M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5']],
  star: [['M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z', 't']],
  lock: [['M5 11h14v10H5z', 't'], ['M8 11V7a4 4 0 0 1 8 0v4']],
  mail: [['M3 5.5h18v13H3z', 't'], ['M3 7l9 6.5L21 7']],
  user: [head(12, 8, 4), ['M4 21c.8-4 3.8-6 8-6s7.2 2 8 6']],
  sliders: [['M4 21v-6M4 11V3M12 21v-10M12 7V3M20 21v-4M20 13V3M1.5 15h5M9.5 11h5M17.5 17h5']],
  // ---- genres: Latino
  flame: [['M12 2.5c1 3.2 5.500 5.500 5.500 10.500a5.500 5.500 0 0 1-11 0c0-2.200 1-3.800 2.200-5 .3 1.800 1 2.600 2.100 3C10.400 8 10.600 5 12 2.500z', 't'], ['M12 18.500c-1.500 0-2.500-1-2.500-2.300 0-1.200 1-2 2.500-3.500 1.500 1.500 2.500 2.300 2.500 3.500 0 1.300-1 2.300-2.500 2.300z']],
  maracas: [head(7.200, 7.500, 3.400), head(16.800, 7.500, 3.400), ['M8.300 10.800L10.800 17.500M15.700 10.800L13.200 17.500'], dot(11, 19.200, 1), dot(13, 19.200, 1), ['M5.800 6.500c1-1 2.400-1 3.400-.2M15.400 6.500c1-1 2.400-1 3.400-.2']],
  rose: [['M12 3.500c3 0 5 2 5 4.500 0 3-2.500 5-5 5s-5-2-5-5c0-2.500 2-4.500 5-4.500z', 't'], ['M12 6.500c1.600 0 2.500 1 2.500 2.200S13.400 11 12 11s-2.500-1-2.500-2.300S10.400 6.500 12 6.500zM12 13v8M12 18c-2.200 0-3.600-1-4-2.500 2.200-.3 3.600.5 4 2.500zM12 16.500c2 0 3.200-.9 3.600-2.300-2 0-3.300.7-3.600 2.300z']],
  drum: [['M4.500 8c0-1.700 3.400-3 7.500-3s7.500 1.300 7.500 3-3.400 3-7.500 3-7.500-1.300-7.500-3z', 't'], ['M4.500 8v8c0 1.700 3.400 3 7.500 3s7.500-1.300 7.500-3V8M7 12l1.500 6.500M12 13v6.500M17 12l-1.500 6.500']],
  confetti: [['M4 20l4.500-12 7.500 7.500z', 't'], ['M10 5c1-1.500 2.500-1.500 3 0M15 7c1-1 2.500-.5 2.500 1M11 11l1.500 1.500'], dot(17, 4, .8), dot(20.500, 10, .8), dot(13, 2.800, .6)],
  accordion: [['M3 6.500h3.500v11H3zM17.500 6.500H21v11h-3.500z', 't'], ['M6.500 6.500h11M6.500 17.500h11M8 6.500v11M10.500 6.500v11M13 6.500v11M15.500 6.500v11'], dot(4.750, 9.500, .7), dot(4.750, 12, .7), dot(4.750, 14.500, .7)],
  micvintage: [['M8 3.500h8v8a4 4 0 0 1-8 0z', 't'], ['M8 6.500h8M8 9h8M6.500 11a5.500 5.500 0 0 0 11 0M12 16.500V20M8.500 20.500h7']],
  sombrero: [['M2 16c0 2.200 4.500 3.500 10 3.500s10-1.300 10-3.500c0-1.500-3-2.500-6.500-2.800h-7C5 13.500 2 14.500 2 16z', 't'], ['M8.500 13.200c.2-3.200 1.400-6 3.500-6s3.300 2.800 3.500 6M8.700 11.200h6.600']],
  horseshoe: [['M4.500 21V12a7.500 7.500 0 0 1 15 0v9h-4.500v-9a3 3 0 0 0-6 0v9z', 't'], dot(6.700, 15.500, .7), dot(6.700, 18.500, .7), dot(17.300, 15.500, .7), dot(17.300, 18.500, .7)],
  palm: [['M12.500 21c-.2-4 0-7 1-10.500M13.500 10.500c-2-2.500-5-3-8-1.500M13.500 10.500c-.5-3-3-5-6.500-5M13.500 10.500c1-3 3.500-4.500 7-4M13.500 10.500c2.500-1 5.500-.5 7.500 2M13.500 10.500c-1 2-3 3-5.500 3M7 21h11'], dot(12.600, 11.800, 1)],
  bolt: [['M13.500 2.500L5 13.500h6l-1 8 8.500-11h-6z', 't']],
  wave: [['M2.500 10c2.200-3 4.200-3 6.400 0s4.200 3 6.400 0 4.200-3 6.200 0M2.500 15.500c2.200-3 4.200-3 6.400 0s4.200 3 6.400 0 4.200-3 6.200 0']],
  // ---- genres: Pop y rock
  note: [['M9 18V5.500l11-2V16'], head(6, 18, 3), head(17, 16, 3)],
  piano: [['M3 5.500h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z', 't'], ['M6.500 12.500v6M10.200 12.500v6M13.800 12.500v6M17.500 12.500v6'], ['M5.200 5.500h2.600v7H5.200zM9 5.500h2.600v7H9zM12.400 5.500H15v7h-2.600zM16.200 5.500h2.600v7h-2.600z', 'f']],
  guitar: [['M12 9.500c1.900 0 3.400 1.200 3.400 3.100 0 1-.5 1.700-.5 2.400 1.100.6 1.800 1.700 1.800 3.100 0 2.500-2.200 4.400-4.700 4.400s-4.700-1.900-4.700-4.400c0-1.400.7-2.500 1.800-3.100 0-.7-.5-1.400-.5-2.400C8.600 10.700 10.100 9.500 12 9.500z', 't'], ['M12 9.500V3M10.700 1.500h2.600v3h-2.600zM10.400 20.500h3.200'], [C(12, 16.300, 1.300)]],
  eguitar: [['M12 10c1.500-.9 3.500-.4 4.100 1.100.4 1 .2 1.800.9 2.800 1 1.200 1.700 2.200 1.700 3.600 0 2.400-2 3.600-4.300 3.600-.8 0-1.400-.5-2.400-.5s-1.600.5-2.400.5C7.300 21.100 5.300 19.900 5.300 17.500c0-1.400.7-2.400 1.700-3.600.7-1 .5-1.800.9-2.800C8.500 9.600 10.500 9.100 12 10z', 't'], ['M12 10V3.500M10.800 1.800h2.400v3h-2.400zM9.500 16h5M10.200 18.500h3.600']],
  moon: [['M20 14.500A8.500 8.500 0 1 1 9.500 4 7 7 0 0 0 20 14.500z', 't'], ['M18 4v3M16.500 5.500h3']],
  pick: [['M12 21c-4.500-4-7-8.500-7-12 0-3 3-5 7-5s7 2 7 5c0 3.500-2.500 8-7 12z', 't']],
  spikes: [['M3 19l2-11 3.500 5L12 4l3.500 9L19 8l2 11z', 't']],
  skull: [['M12 3a8 8 0 0 0-8 8c0 2.700 1.300 4.500 3 5.500V20h3v-2h4v2h3v-3.500c1.700-1 3-2.800 3-5.500a8 8 0 0 0-8-8z', 't'], dot(9, 11.500, 1.800), dot(15, 11.500, 1.800), ['M12 14l-1 2h2z', 'f']],
  // ---- genres: Urbano, Electrónica
  gem: [['M6.500 4h11l4 5.200L12 21 2.500 9.200z', 't'], ['M2.500 9.200h19M9.500 4L8 9.200 12 21l4-11.800L14.500 4']],
  mic: [['M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 't'], ['M5.500 11a6.500 6.500 0 0 0 13 0M12 17.500V21M8.500 21h7']],
  heart: [['M12 20.500S3.500 15 3.500 9A4.500 4.500 0 0 1 12 7a4.500 4.500 0 0 1 8.500 2c0 6-8.500 11.500-8.500 11.500z', 't']],
  sun: [head(12, 12, 4), ['M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800']],
  speaker: [['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 't'], [C(12, 14.500, 3.700)], dot(12, 14.500, 1.200), [C(12, 7, 1.600)]],
  skyline: [['M3 21V12h4v9M7 21V6h5v15M12 21V9.500h4V21M16 21v-6h4v6M2 21h20'], dot(9.500, 9, .6), dot(9.500, 12, .6), dot(9.500, 15, .6)],
  eq: [['M4 20v-6M8 20V8M12 20V4M16 20V10M20 20v-8']],
  house: [['M3.500 11L12 3.500l8.500 7.500V20a1 1 0 0 1-1 1H15v-6H9v6H4.500a1 1 0 0 1-1-1z', 't']],
  knobs: [['M4 21v-6M4 11V3M12 21v-10M12 7V3M20 21v-4M20 13V3M1.500 15h5M9.500 11h5M17.500 17h5']],
  coffee: [['M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 't'], ['M17 10.500h1.500a2.500 2.500 0 0 1 0 5H17M8 3c-1 1.500 1 2.500 0 4M12 3c-1 1.500 1 2.500 0 4M3 21.500h14']],
  sunset: [['M6 15a6 6 0 0 1 12 0', 't'], ['M2 15h20M12 15v6.500M7 15l-3 6.500M17 15l3 6.500M3 18.500h18M8 11.500h8']],
  discoball: [[C(12, 13, 7.500), 't'], ['M4.500 13h15M12 5.500v15M7.500 8c3 2.500 6 2.500 9 0M7.500 18c3-2.500 6-2.500 9 0M12 2.500v3M20 3.500v3M18.500 5h3']],
  // ---- genres: Raíces y más
  cowboy: [['M2.500 14.500c1.500 3.500 5.500 5 9.500 5s8-1.500 9.500-5c-3 1-6.500 1.500-9.500 1.500s-6.500-.5-9.500-1.500z', 't'], ['M7.500 14.700c-.3-3 .3-6 1.700-7.700 1-.9 2.100-.7 2.800.1.700-.8 1.800-1 2.800-.1 1.400 1.700 2 4.700 1.700 7.700']],
  leaf: [['M4.500 19.500C4.500 10 10 4.500 20 4.500c0 10-5.500 15.500-15.500 15z', 't'], ['M4.500 19.500L14 10']],
  sax: [['M13 2.500h3.500l-.5 3.500V14c0 4.500-2.500 7.500-6.500 7.500S3 18.500 3 15v-2.500h4V15c0 1.700.9 2.500 2 2.500s2-.8 2-2.500V6z', 't'], dot(13.800, 9, .7), dot(13.800, 12, .7)],
  vinyl: [[C(12, 12, 9), 't'], [C(12, 12, 3)], dot(12, 12, .9), ['M6.500 12a5.500 5.500 0 0 1 5.500-5.500M17.500 12a5.500 5.500 0 0 1-5.500 5.500']],
  sunglasses: [['M3 9.500h8v3.500a4 4 0 0 1-8 0z', 't'], ['M13 9.500h8v3.500a4 4 0 0 1-8 0z', 't'], ['M11 10.500h2M3 9.500L2 8M21 9.500l1-1.500']],
  cross: [['M12 3v18M6 9h12M3 12h1.500M19.500 12H21M4.500 5.500l1.500 1.500M19.500 5.500L18 7']],
  violin: [['M8.500 11.500c0 1.500 1.200 2 1.200 3.200S8 16 8 18c0 2.500 1.800 4 4 4s4-1.500 4-4c0-2-1.700-2.300-1.700-3.500S15.500 13 15.500 11.500 14 9.500 12 9.500 8.500 10 8.500 11.500z', 't'], ['M12 9.500V3.500M11 1.500h2v2.500h-2zM10.200 16c-.4 1-.4 2 0 3M13.800 16c.4 1 .4 2 0 3M10.500 20h3']],
  sunwave: [head(12, 9, 3.500), ['M12 2.500v1.500M5.500 5l1 1M18.500 5l-1 1M3 9h1.500M19.500 9H21M2.500 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2.500 19.500c2-2 4-2 6 0s4 2 6 0 4-2 6 0']],
  teddy: [[C(12, 13.500, 6.500), 't'], ['M6.500 8.500a2.500 2.500 0 1 1 3-3.500M17.500 8.500a2.500 2.500 0 1 0-3-3.500M10.500 17c.5.6 2.500.6 3 0'], dot(9.800, 12.500, .8), dot(14.200, 12.500, .8), ['M12 14.500v1', 's']],
  dice: [['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 't'], dot(8, 8, 1.100), dot(16, 8, 1.100), dot(12, 12, 1.100), dot(8, 16, 1.100), dot(16, 16, 1.100)],
  // ---- moods
  hearts: [['M11 19.500S3 14.500 3 9a4.200 4.200 0 0 1 8-1.800A4.200 4.200 0 0 1 19 9c0 5.500-8 10.500-8 10.500z', 't'], ['M19.500 3.500c.8-1 2.500-.7 2.500.8 0 1.500-2.500 2.700-2.500 2.700S17 5.800 17 4.300c0-1.500 1.700-1.800 2.500-.8z']],
  smile: [[C(12, 12, 9), 't'], dot(9, 10, 1), dot(15, 10, 1), ['M7.500 14c1 2.500 2.800 3.500 4.500 3.500s3.500-1 4.500-3.500']],
  tear: [['M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z', 't'], ['M9 14a3 3 0 0 0 2 3']],
  hourglass: [['M6 3h12M6 21h12M7 3v3a5 5 0 0 0 2.500 4.300L12 12l-2.500 1.700A5 5 0 0 0 7 18v3M17 3v3a5 5 0 0 1-2.500 4.300L12 12l2.500 1.700A5 5 0 0 1 17 18v3']],
  clapper: [['M3 10h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 't'], ['M3 10l1.500-5 16.500 3.500L20 10M8 5.800l2.500 4M13 6.900l2.500 3.500']],
  lotus: [['M12 20c-3-3-3-9 0-14 3 5 3 11 0 14z', 't'], ['M12 20c-5 0-8-3-9-7 4 0 7 2 9 7zM12 20c5 0 8-3 9-7-4 0-7 2-9 7z']],
  rain: [['M7 15a4 4 0 0 1-.5-8A5.500 5.500 0 0 1 17 8a3.500 3.500 0 0 1 .5 7z', 't'], ['M8 18l-1 3M12 18l-1 3M16 18l-1 3']],
  laugh: [[C(12, 12, 9), 't'], ['M7.500 9.500l2 1-2 1M16.500 9.500l-2 1 2 1'], ['M7.500 14h9a4.500 4.500 0 0 1-9 0z', 'f']],
  sparkle: [['M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z', 't'], ['M19 15l.8 2.200 2.200.8-2.200.8L19 21l-.8-2.200-2.200-.8 2.200-.8z']],
  lips: [['M3 12c3-4 6-4.500 9-2.500C15 7.500 18 8 21 12c-3 5-6 6.500-9 6.500S6 17 3 12z', 't'], ['M3 12h18']],
  rainbow: [['M2.500 19a9.500 9.500 0 0 1 19 0M6 19a6 6 0 0 1 12 0M9.500 19a2.500 2.500 0 0 1 5 0']],
  // ---- voices, tempo
  singer_f: [head(12, 8.500, 3.800), ['M8 9c-.5 4-1 6.500-2.500 8.500M16 9c.5 4 1 6.500 2.500 8.500M5 21c.7-3.500 3.500-5.500 7-5.500s6.300 2 7 5.500']],
  singer_m: [head(12, 8.500, 3.800), ['M8.500 7.500c1.500-2.500 5.500-2.500 7 0M5 21c.7-3.500 3.500-5.500 7-5.500s6.300 2 7 5.500']],
  duo: [head(8.500, 8.500, 3), head(16, 9, 3), ['M2.500 20c.5-3 3-5 6-5s5.500 2 6 5M14.500 15.500c3-.5 6 1 7 4.500']],
  choir: [head(12, 7.500, 3), head(4.800, 10, 2.200), head(19.200, 10, 2.200), ['M6.500 21c.5-3.500 2.700-5.500 5.500-5.500s5 2 5.500 5.500M1.500 19c.3-2.200 1.700-3.500 3.300-3.500M22.500 19c-.3-2.200-1.700-3.500-3.300-3.500']],
  gauge1: [['M3.500 17a8.500 8.500 0 0 1 17 0'], ['M12 17L6.500 12.500'], dot(12, 17, 1.400)],
  gauge2: [['M3.500 17a8.500 8.500 0 0 1 17 0'], ['M12 17V8.500'], dot(12, 17, 1.400)],
  gauge3: [['M3.500 17a8.500 8.500 0 0 1 17 0'], ['M12 17l5.500-4.500'], dot(12, 17, 1.400)],
  // ---- occasions
  ring: [[C(12, 15, 5.500)], ['M9.500 6.500L12 3l2.500 3.500L12 9z', 't']],
  cake: [['M4 20h16v-6H4z', 't'], ['M4 14c2 2 4 2 6 0s4-2 6 0 3 1.500 4 0M9 11V8M12 11V7M15 11V8'], dot(9, 6.500, .8), dot(12, 5.500, .8), dot(15, 6.500, .8)],
  letter: [['M3 6h18v12H3z', 't'], ['M3 7l9 6.500L21 7'], ['M12 17s-2.800-1.700-2.800-3.400a1.500 1.500 0 0 1 2.800-.7 1.500 1.500 0 0 1 2.800.7C14.800 15.300 12 17 12 17z', 'f']],
  medal: [[C(12, 9, 5), 't'], ['M9 13.500L7 21l5-2.500 5 2.500-2-7.500'], ['M12 6.500l.9 1.800 2 .3-1.400 1.400.3 2-1.800-.9-1.800.9.3-2L9.100 8.600l2-.3z', 'f']],
  rings: [[C(9, 14, 5)], [C(15, 14, 5)], ['M12 5l1.500-2 1.500 2-1.500 1.500z', 't']],
  flower: [dot(12, 12, 2.500), [C(12, 6.500, 3)], [C(12, 17.500, 3)], [C(6.500, 12, 3)], [C(17.500, 12, 3)]],
  tie: [['M10 3h4l-1 3 1.500 2L12 21 8.500 8 10 6z', 't']],
  link: [['M10 14a4 4 0 0 0 5.600 0l3-3a4 4 0 0 0-5.600-5.600l-1 1M14 10a4 4 0 0 0-5.600 0l-3 3a4 4 0 0 0 5.600 5.600l1-1']],
  candle: [['M9 11h6v10H9z', 't'], ['M12 3c1.800 2 2.500 3.500 2.500 4.800a2.500 2.500 0 0 1-5 0C9.500 6.500 10.200 5 12 3z', 't'], ['M12 8v3']],
};

// Instruments are drawn upright and tilted like a classic icon.
export const TILT = {guitar: 38, eguitar: 38, violin: 32};

// Which icon stands for each option of the brief (the order and names come from the server catalogue).
export const GENRE_ICON = {'Reggaetón': 'flame', 'Salsa': 'maracas', 'Bachata': 'rose', 'Merengue': 'confetti', 'Cumbia': 'drum', 'Vallenato': 'accordion', 'Bolero': 'micvintage', 'Ranchera': 'sombrero', 'Corridos': 'horseshoe', 'Pop latino': 'palm', 'Dembow': 'bolt', 'Champeta': 'wave',
  'Pop': 'note', 'Balada': 'piano', 'Acústico': 'guitar', 'Indie': 'moon', 'Pop rock': 'pick', 'Rock': 'eguitar', 'Punk': 'spikes', 'Metal': 'skull',
  'Trap': 'gem', 'Hip hop': 'mic', 'R&B': 'heart', 'Afrobeat': 'sun', 'Dancehall': 'speaker', 'Drill': 'skyline',
  'EDM': 'eq', 'House': 'house', 'Techno': 'knobs', 'Lo-fi': 'coffee', 'Synthwave': 'sunset', 'Disco': 'discoball',
  'Country': 'cowboy', 'Folk': 'leaf', 'Jazz': 'sax', 'Blues': 'vinyl', 'Soul': 'star', 'Funk': 'sunglasses', 'Gospel': 'cross', 'Clásica': 'violin', 'Bossa nova': 'sunwave', 'Infantil': 'teddy', 'A tu criterio': 'dice'};
export const BANK_ICON = {'Latino': 'palm', 'Pop y rock': 'eguitar', 'Urbano': 'gem', 'Electrónica': 'knobs', 'Raíces y más': 'sax', 'Sin decidir': 'dice'};
export const MOOD_ICON = {'Romántica': 'hearts', 'Alegre': 'smile', 'Emotiva': 'tear', 'Nostálgica': 'hourglass', 'Energética': 'bolt', 'Épica': 'clapper', 'Tranquila': 'lotus', 'Melancólica': 'rain', 'Divertida': 'laugh', 'Inspiradora': 'sparkle', 'Sensual': 'lips', 'Esperanzadora': 'rainbow'};
export const VOICE_ICON = {'Femenina': 'singer_f', 'Masculina': 'singer_m', 'Dúo': 'duo', 'Coro': 'choir', 'A tu criterio': 'dice'};
export const TEMPO_ICON = {'Lento': 'gauge1', 'Medio': 'gauge2', 'Rápido': 'gauge3', 'A tu criterio': 'dice'};
export const OCCASION_ICON = {'Aniversario': 'ring', 'Cumpleaños': 'cake', 'Declaración de amor': 'letter', 'Agradecimiento': 'medal', 'Boda': 'rings', 'Día de la madre': 'flower', 'Día del padre': 'tie', 'Amistad': 'link', 'Homenaje': 'candle', 'Solo porque sí': 'sparkle'};
export const LANGUAGE_BADGE = {'Español': 'ES', 'Inglés': 'EN', 'Spanglish': 'ES·EN', 'Portugués': 'PT'};
export const PRODUCT_ICON = {dedicatoria: 'note', personalizada: 'mic', full: 'clapper'};
export const iconFor = (kind, value) => ({genre: GENRE_ICON, bank: BANK_ICON, mood: MOOD_ICON, voice: VOICE_ICON, tempo: TEMPO_ICON, occasion: OCCASION_ICON, product: PRODUCT_ICON}[kind]?.[value]) || 'sparkle';

const cache = new Map();
const path2d = d => { let p = cache.get(d); if (!p) cache.set(d, p = new Path2D(d)); return p; };

// Canvas: draws icon `name` centred on (x, y), `size` px wide.
export function drawIcon(g, name, x, y, size, {color = '#fff', width = 1.7, glow = 0} = {}) {
  const shapes = ICONS[name] || ICONS.sparkle;
  g.save();
  g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24);
  if (TILT[name]) { g.translate(12, 12); g.rotate(TILT[name] * Math.PI / 180); g.translate(-12, -12); }
  g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color; g.fillStyle = color;
  if (glow) { g.shadowColor = color; g.shadowBlur = glow; }
  for (const [d, mode = 's'] of shapes) {
    const p = path2d(d);
    if (mode === 'f') g.fill(p);
    else { if (mode === 't') { g.globalAlpha = 0.22; g.fill(p); g.globalAlpha = 1; } g.stroke(p); }
  }
  g.restore();
}

// DOM: the same shapes as inline SVG (currentColor), for the plain-text panels and the HUD.
export function iconSvg(name, cls = '') {
  const shapes = ICONS[name] || ICONS.sparkle;
  const body = shapes.map(([d, mode = 's']) => mode === 'f' ? `<path d="${d}" fill="currentColor" stroke="none"/>` : mode === 't' ? `<path d="${d}" fill="currentColor" fill-opacity=".22"/>` : `<path d="${d}"/>`).join('');
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TILT[name] ? `<g transform="rotate(${TILT[name]} 12 12)">${body}</g>` : body}</svg>`;
}
