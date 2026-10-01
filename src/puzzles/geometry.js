// Where each node sits on a board that is not a plain grid. Pure numbers, so
// the layout can be checked in a test (nothing overlaps, everything stays
// inside the carved panel) without a browser.
//
// Coordinates are percentages of the board, 0 to 100, the same space the
// frame and the stones already use. The frame band is F = 12.5 wide, so the
// panel is 12.5 to 87.5.

export const PANEL = { min: 12.5, max: 87.5 };

// A triangle with the apex up: the corners first, then two nodes on each side.
export function triangleLayout(sides) {
  const apex = { x: 50, y: 25 };
  const right = { x: 79, y: 75.2 };
  const left = { x: 21, y: 75.2 };
  const corners = [apex, right, left];
  const points = {};
  sides.forEach((side, k) => {
    const a = corners[k];
    const b = corners[(k + 1) % 3];
    side.forEach((node, i) => {
      const t = i / (side.length - 1);
      points[node] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
  });
  return { points, size: 14 };
}

// n nodes on a ring, the first at the top, going clockwise.
export function ringLayout(n, radius = 29.5, size = 15) {
  const points = {};
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    points[i] = { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) };
  }
  return { points, size };
}

export function layoutFor(def) {
  switch (def.geometry.kind) {
    case 'triangle': return triangleLayout(def.constraints.find((c) => c.id === 'sides').groups);
    case 'ring': return ringLayout(def.geometry.n);
    default: throw new Error(`${def.id}: no layout for ${def.geometry.kind}`);
  }
}

// Which lines of the board a node's marker joins, for the screen: the three
// sides of a triangle each get a marker in the frame band.
export const SIDE_MARKERS = [
  { x: 87.5 + 6.25, y: 50 }, // side 0, apex to right corner: right band
  { x: 50, y: 87.5 + 6.25 }, // side 1, right to left corner: bottom band
  { x: 6.25, y: 50 }, // side 2, left corner to apex: left band
];
