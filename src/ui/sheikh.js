// The guide. A sheikh in a carved stone niche, upper right of the play
// screen. He gives the instruction and the goal number, and he carries the
// hints. Drawn in SVG in the game's own palette, no image files.
//
// Dress from the reference Dylan gave (1 Oct 2026): a pale mint thobe, a
// white wrapped turban, a white scarf with black and grey stripes, brown
// skin, a short grey beard. The face is deliberately simple and is not a
// likeness of anyone.

import { s } from './dom.js';

const C = {
  niche: '#ece3d1',
  nicheLine: 'rgba(91, 71, 51, 0.32)',
  nicheShade: '#ddd1b9',
  thobe: '#cfe0c9',
  thobeShade: '#b7cdb1',
  thobeLine: '#8fa98a',
  skin: '#8a5a3c',
  skinShade: '#73472d',
  skinLight: '#9c6a49',
  turban: '#f6f4ee',
  turbanShade: '#dcd6c8',
  turbanLine: '#c5bdab',
  scarf: '#f3f1ea',
  scarfShade: '#dad5c9',
  stripe: '#2c2b30',
  stripeGrey: '#8b8780',
  beard: '#d9d3c8',
  beardShade: '#a9a196',
  ink: '#3a291d',
};

export function sheikhSvg() {
  // Scarf stripes: a band of three across each hanging end.
  const stripes = (x, y, w, slant) => [0, 3.4, 6.8].map((dy, i) => s('path', {
    d: `M${x} ${y + dy} l${w} ${slant} l0 ${i === 1 ? 1.2 : 1.8} l${-w} ${-slant} z`,
    fill: i === 1 ? C.stripeGrey : C.stripe,
  }));

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
        // shoulders and thobe
        s('path', { d: 'M10 122 C11 99 22 89 38 86 L62 86 C78 89 89 99 90 122 Z', fill: C.thobe }),
        s('path', { d: 'M10 122 C11 99 22 89 38 86 L40 88 C28 92 20 102 18 122 Z', fill: C.thobeShade }),
        s('path', { d: 'M90 122 C89 99 78 89 62 86 L60 88 C72 92 80 102 82 122 Z', fill: C.thobeShade }),
        // neck and round collar with its placket
        s('path', { d: 'M42 76 L42 88 C46 91 54 91 58 88 L58 76 Z', fill: C.skinShade }),
        s('path', { d: 'M39 86 C44 92 56 92 61 86', fill: 'none', stroke: C.thobeLine, 'stroke-width': 1 }),
        s('path', { d: 'M50 91 V108', stroke: C.thobeLine, 'stroke-width': 0.7 }),
        // scarf: round the neck, both ends hanging down the front
        s('path', { d: 'M33 84 C38 79 62 79 67 84 C66 90 60 92 50 92 C40 92 34 90 33 84 Z', fill: C.scarf }),
        s('path', { d: 'M33 84 C34 89 39 91 46 92 L42 121 L28 121 Z', fill: C.scarf }),
        s('path', { d: 'M67 84 C66 89 61 91 54 92 L60 121 L74 121 Z', fill: C.scarf }),
        s('path', { d: 'M33 84 C34 89 37 90 40 91 L33 121 L28 121 Z', fill: C.scarfShade }),
        s('path', { d: 'M67 84 C66 89 63 90 60 91 L68 121 L74 121 Z', fill: C.scarfShade }),
        // long stripes running down each end
        s('path', { d: 'M38 92 L33 121', stroke: C.stripe, 'stroke-width': 1.1 }),
        s('path', { d: 'M41 92 L37 121', stroke: C.stripeGrey, 'stroke-width': 0.6 }),
        s('path', { d: 'M62 92 L67 121', stroke: C.stripe, 'stroke-width': 1.1 }),
        s('path', { d: 'M59 92 L63 121', stroke: C.stripeGrey, 'stroke-width': 0.6 }),
        // the striped band across each end
        ...stripes(29.5, 104, 13, 0.8),
        ...stripes(58, 104.8, 13, -0.8),
        s('path', { d: 'M36 81 C42 84 58 84 64 81', fill: 'none', stroke: C.stripe, 'stroke-width': 1 }),
        s('path', { d: 'M38 83.2 C44 85.6 56 85.6 62 83.2', fill: 'none', stroke: C.stripeGrey, 'stroke-width': 0.5 })),
      s('g', { class: 'sh-head' },
        // ears
        s('ellipse', { cx: 33.5, cy: 54, rx: 2.6, ry: 4.4, fill: C.skinShade }),
        s('ellipse', { cx: 66.5, cy: 54, rx: 2.6, ry: 4.4, fill: C.skinShade }),
        // face
        s('path', { d: 'M35 44 C35 36 41 33 50 33 C59 33 65 36 65 44 L65 58 C65 70 58 78 50 78 C42 78 35 70 35 58 Z', fill: C.skin }),
        s('path', { d: 'M35 44 C35 37 39 34 44 33.6 C40 38 39 46 39 56 C39 64 41 70 44 74 C39 71 35 65 35 58 Z', fill: C.skinShade, opacity: 0.55 }),
        s('path', { d: 'M56 46 C59 46 61 47 62 49', fill: 'none', stroke: C.skinLight, 'stroke-width': 0.6, opacity: 0.7 }),
        // beard: short, grey, round the jaw, with a moustache
        s('path', { d: 'M36 57 C37 63 40 66 43 66 C46 64 54 64 57 66 C60 66 63 63 64 57 C65 68 59 79 50 80 C41 79 35 68 36 57 Z', fill: C.beard }),
        s('path', { d: 'M43 66 C46 64 54 64 57 66 C55 69 45 69 43 66 Z', fill: C.skin }),
        s('path', { d: 'M43.5 63.6 C46 61.6 49 62 50 63 C51 62 54 61.6 56.5 63.6 C54 64.6 51.5 64.4 50 64 C48.5 64.4 46 64.6 43.5 63.6 Z', fill: C.beardShade }),
        s('path', { d: 'M40 70 l1 3 M45 74 l0.5 3 M55 74 l-0.5 3 M60 70 l-1 3 M50 75.5 v3', stroke: C.beardShade, 'stroke-width': 0.5, 'stroke-linecap': 'round' }),
        s('path', { d: 'M47 69.3 C48.5 70.2 51.5 70.2 53 69.3', fill: 'none', stroke: C.skinShade, 'stroke-width': 0.8, 'stroke-linecap': 'round' }),
        // nose: one line and a soft shadow
        s('path', { d: 'M50.6 50 C51 54 52.6 57 51.6 59 C50.6 59.6 49 59.4 48 58.8', fill: 'none', stroke: C.skinShade, 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
        // brows and calm, half-lowered eyes
        s('path', { d: 'M40.5 46.6 C42.5 45.4 45 45.4 46.6 46.4', fill: 'none', stroke: C.beardShade, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
        s('path', { d: 'M53.4 46.4 C55 45.4 57.5 45.4 59.5 46.6', fill: 'none', stroke: C.beardShade, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
        s('g', { class: 'sh-eyes' },
          s('path', { d: 'M41 50.6 C42.6 51.8 44.6 51.8 46 50.6', fill: 'none', stroke: C.ink, 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
          s('path', { d: 'M54 50.6 C55.4 51.8 57.4 51.8 59 50.6', fill: 'none', stroke: C.ink, 'stroke-width': 1.1, 'stroke-linecap': 'round' })),
        // turban: a broad white wrap, wider than the head, low on the brow
        s('path', { d: 'M27 43 C23 29 33 18 50 18 C67 18 77 29 73 43 C64 47 36 47 27 43 Z', fill: C.turban }),
        s('path', { d: 'M27 43 C23 29 33 18 50 18 C39 22 34 32 36 45.6 C32.4 45 29.2 44.2 27 43 Z', fill: C.turbanShade }),
        s('path', { d: 'M26.6 36 C38 30 60 29 73.4 35', fill: 'none', stroke: C.turbanLine, 'stroke-width': 0.8 }),
        s('path', { d: 'M28.6 29.6 C40 25 60 24.4 71.6 28.6', fill: 'none', stroke: C.turbanLine, 'stroke-width': 0.8 }),
        s('path', { d: 'M33 23.6 C42 20.4 58 20.2 67 23', fill: 'none', stroke: C.turbanLine, 'stroke-width': 0.7 }),
        s('path', { d: 'M27.4 41 C40 36 62 35.4 72.8 40', fill: 'none', stroke: C.turbanLine, 'stroke-width': 0.7 }),
        s('path', { d: 'M27 43 C36 47 64 47 73 43 C73 44.8 71.6 45.8 69 46.4 C58 48 42 48 31 46.4 C28.4 45.8 27 44.8 27 43 Z', fill: C.turbanShade }))));
}
