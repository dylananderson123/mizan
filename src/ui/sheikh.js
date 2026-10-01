// The guide. A sheikh in a carved stone niche, upper right of the play
// screen. He gives the instruction and the goal number, and he carries the
// hints. Drawn in SVG in the game's own palette, no image files.
//
// Dress from the second reference Dylan gave (1 Oct 2026): a soft,
// rounded white turban (lowered 2 Oct 2026 `[Dylan]`: it was far too tall), light olive skin, a short salt-and-pepper beard, and
// a long royal-blue tunic with a round neck, a white undershirt showing at
// the collar and a row of small cloth buttons. The face is deliberately
// simple and generic: it is not a likeness of anyone, and no one should be
// able to recognise a real person from it.

import { s } from './dom.js';

const C = {
  niche: '#ece3d1',
  nicheLine: 'rgba(91, 71, 51, 0.32)',
  nicheShade: '#ddd1b9',
  tunic: '#2f58a8',
  tunicShade: '#234685',
  tunicLight: '#4672c0',
  tunicLine: '#1a3269',
  under: '#f4f1ea',
  skin: '#c79a73',
  skinShade: '#b0825c',
  skinLight: '#d8ae8a',
  turban: '#f3f1f4',
  turbanShade: '#dad6df',
  turbanLine: '#c4bfcb',
  beard: '#bcb7b1',
  beardDark: '#4d4a48',
  beardShade: '#8f8a84',
  brow: '#5a524a',
  ink: '#3a291d',
};

export function sheikhSvg() {
  // One small cloth button: a knot with a darker centre.
  const button = (y) => [
    s('circle', { cx: 50, cy: y, r: 1.25, fill: C.tunicLight, stroke: C.tunicLine, 'stroke-width': 0.35 }),
    s('circle', { cx: 50, cy: y, r: 0.4, fill: C.tunicLine }),
  ];

  return s('svg', { class: 'sheikh-art', viewBox: '0 0 100 120', 'aria-hidden': 'true' },
    s('defs', {},
      s('clipPath', { id: 'niche-clip' },
        s('path', { d: 'M8 120 V46 C8 22 26 6 50 6 C74 6 92 22 92 46 V120 Z' }))),
    // the niche: a pointed arch cut into the stone, a fine border inside it
    s('path', { d: 'M4 120 V45 C4 19 25 2 50 2 C75 2 96 19 96 45 V120 Z', fill: C.nicheShade }),
    s('path', { d: 'M8 120 V46 C8 22 26 6 50 6 C74 6 92 22 92 46 V120 Z', fill: C.niche, stroke: C.nicheLine, 'stroke-width': 0.8 }),
    s('path', { d: 'M12 120 V47 C12 25 29 10 50 10 C71 10 88 25 88 47 V120', fill: 'none', stroke: C.nicheLine, 'stroke-width': 0.4, 'stroke-dasharray': '1.2 1.6' }),
    s('g', { 'clip-path': 'url(#niche-clip)' },
      s('g', { class: 'sh-body' },
        // shoulders and the royal-blue tunic
        s('path', { d: 'M10 122 C11 99 22 89 38 86 L62 86 C78 89 89 99 90 122 Z', fill: C.tunic }),
        s('path', { d: 'M10 122 C11 99 22 89 38 86 L40 88 C28 92 20 102 18 122 Z', fill: C.tunicShade }),
        s('path', { d: 'M90 122 C89 99 78 89 62 86 L60 88 C72 92 80 102 82 122 Z', fill: C.tunicShade }),
        // a soft fold or two in the cloth
        s('path', { d: 'M30 104 C34 110 35 116 34 122 M70 104 C66 110 65 116 66 122', fill: 'none', stroke: C.tunicLine, 'stroke-width': 0.5, opacity: 0.55 }),
        // neck, then the round collar with a white undershirt edge
        s('path', { d: 'M42 76 L42 88 C46 91 54 91 58 88 L58 76 Z', fill: C.skinShade }),
        s('path', { d: 'M38.6 85.6 C44 93 56 93 61.4 85.6', fill: 'none', stroke: C.tunicLine, 'stroke-width': 1.2 }),
        s('path', { d: 'M40 86 C45 91.4 55 91.4 60 86', fill: 'none', stroke: C.under, 'stroke-width': 1.7, 'stroke-linecap': 'round' }),
        // the placket: a double seam down the middle with small cloth buttons
        s('path', { d: 'M49 91.4 V116 M51 91.4 V116', stroke: C.tunicLine, 'stroke-width': 0.45 }),
        ...button(95.5), ...button(101.5), ...button(107.5)),
      s('g', { class: 'sh-head' },
        // ears
        s('ellipse', { cx: 33.5, cy: 54, rx: 2.6, ry: 4.4, fill: C.skinShade }),
        s('ellipse', { cx: 66.5, cy: 54, rx: 2.6, ry: 4.4, fill: C.skinShade }),
        // face
        s('path', { d: 'M35 44 C35 36 41 33 50 33 C59 33 65 36 65 44 L65 58 C65 70 58 78 50 78 C42 78 35 70 35 58 Z', fill: C.skin }),
        s('path', { d: 'M35 44 C35 37 39 34 44 33.6 C40 38 39 46 39 56 C39 64 41 70 44 74 C39 71 35 65 35 58 Z', fill: C.skinShade, opacity: 0.5 }),
        s('path', { d: 'M56 46 C59 46 61 47 62 49', fill: 'none', stroke: C.skinLight, 'stroke-width': 0.6, opacity: 0.8 }),
        // beard: short, salt and pepper. Grey along the cheeks, dark at the
        // chin and under the lip, and a darker moustache.
        s('path', { d: 'M36 57 C37 63 40 66 43 66 C46 64 54 64 57 66 C60 66 63 63 64 57 C65 68 59 79 50 80 C41 79 35 68 36 57 Z', fill: C.beard }),
        s('path', { d: 'M40 71 C43 77 57 77 60 71 C60 77 56 81 50 81 C44 81 40 77 40 71 Z', fill: C.beardDark }),
        s('path', { d: 'M43 66 C46 64 54 64 57 66 C55 69 45 69 43 66 Z', fill: C.skin }),
        s('path', { d: 'M43.5 63.6 C46 61.6 49 62 50 63 C51 62 54 61.6 56.5 63.6 C54 64.6 51.5 64.4 50 64 C48.5 64.4 46 64.6 43.5 63.6 Z', fill: C.beardDark }),
        s('path', { d: 'M38.6 62 l1 4 M41 68 l0.8 3 M61.4 62 l-1 4 M59 68 l-0.8 3', stroke: C.beardShade, 'stroke-width': 0.5, 'stroke-linecap': 'round' }),
        s('path', { d: 'M47 69.3 C48.5 70.2 51.5 70.2 53 69.3', fill: 'none', stroke: C.skinShade, 'stroke-width': 0.8, 'stroke-linecap': 'round' }),
        // nose: one line and a soft shadow
        s('path', { d: 'M50.6 50 C51 54 52.6 57 51.6 59 C50.6 59.6 49 59.4 48 58.8', fill: 'none', stroke: C.skinShade, 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
        // brows and calm, half-lowered eyes
        s('path', { d: 'M40.5 46.6 C42.5 45.4 45 45.4 46.6 46.4', fill: 'none', stroke: C.brow, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
        s('path', { d: 'M53.4 46.4 C55 45.4 57.5 45.4 59.5 46.6', fill: 'none', stroke: C.brow, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
        s('g', { class: 'sh-eyes' },
          s('path', { d: 'M41 50.6 C42.6 51.8 44.6 51.8 46 50.6', fill: 'none', stroke: C.ink, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
          s('path', { d: 'M54 50.6 C55.4 51.8 57.4 51.8 59 50.6', fill: 'none', stroke: C.ink, 'stroke-width': 1.1, 'stroke-linecap': 'round' })),
        // turban: a low, snug wrap. About half the height it had, a little
        // wider than the head, so it reads as a normal turban and not a tower
        s('path', { d: 'M31.5 45 C29.5 33.5 38 25 50 25 C62 25 70.5 33.5 68.5 45 C60 47.6 40 47.6 31.5 45 Z', fill: C.turban }),
        s('path', { d: 'M31.5 45 C29.5 33.5 38 25 50 25 C42 28.4 38.6 36 39.4 46.4 C36 46 33.4 45.6 31.5 45 Z', fill: C.turbanShade }),
        // the wrap: a few soft folds sweeping round the dome
        s('path', { d: 'M30.6 40.8 C40 36.8 60 36.8 69.4 40.6', fill: 'none', stroke: C.turbanLine, 'stroke-width': 0.7 }),
        s('path', { d: 'M31 35.2 C40.4 30.8 59.6 30.8 69 34.8', fill: 'none', stroke: C.turbanLine, 'stroke-width': 0.65 }),
        s('path', { d: 'M37.4 29.6 C43.6 27 56.4 27 62.6 29.4', fill: 'none', stroke: C.turbanLine, 'stroke-width': 0.6 }),
        s('path', { d: 'M32 44.5 C40 47.4 60 47.4 68 44.5 C68 46 66.8 46.8 64.6 47.4 C56 49 44 49 35.4 47.4 C33.2 46.8 32 46 32 44.5 Z', fill: C.turbanShade }))));
}
