/**
 * Harmony World — the layout of the whole estate (plain data, no three.js), shared by the house (worldHouse.js),
 * the grounds (worldGrounds.js) and the world (world.js: walking, the weather).
 *
 * The house stands in the north with the terrace and the pool deck in its courtyard. Everything else stands on
 * landscaped grounds round it, each with room to breathe (world x -68..56, z -124..40, about 3.5 times the old
 * rooftop), joined by paved paths:
 *
 *   north   the house: one rectangular block under one flat roof, with the double-height lounge rising out of it
 *   centre  the lawn in front of the courtyard: the cross walk, and a round plaza with the Harmony sculpture
 *   south   the walled garden (the treehouse over it, the Box of Shame in it), and past it the Fun Park
 *   west    a line of attractions along the west avenue: the Aquarium, the Haunted Mansion, the Bumper Karts
 *   round   a walk all round the house and down the east side, with the roller coaster outside it
 *
 * Rects are [minX, maxX, minZ, maxZ] in world coordinates.
 */

// the grounds: everything inside the hedge
export const ESTATE = [-68, 56, -124, 40];
// (how far in from the edge you can walk: the hedge is in the way)
export const HEDGE_IN = 1.4;

// The house, from outside: one clean rectangle (x -22.55..33.7, z -8.8..18.25) with the terrace and the pool deck
// in a courtyard cut into its south side. Each block is the outside of its walls (the facade's skin).
export const HOUSE_BLOCKS = [
	[-22.55, -7.05, -8.8, 18.25],    // the west wing: the cinema, and rooms behind it
	[-7.05, 23.35, -6.3, 18.25],     // the middle: the living room, the lounge, the game room, the hallway, the spa
	[23.12, 33.7, -8.8, 18.25]       // the east wing: the bedroom and the bathroom
];
export const HOUSE_RECT = [-22.55, 33.7, -8.8, 18.25];
// the lounge's two storeys rise out of the flat roof
export const LOUNGE_RECT = [7.05, 23.35, -6.25, 8.15];
export const ROOF_Y = 5.4, PARAPET_Y = 5.85, LOUNGE_TOP = 7.85;
// the open-air courtyard: the terrace (behind the living room) and the pool deck
export const COURTS = [
	[-7.0, 5.5, -12.0, -6.2],
	[5.45, 33.6, -18.1, -6.05]
];

// The ways in and out of each place, as corridors that reach across its edge (a body needs its whole radius clear
// on one side or the other, so these overlap the place's own doorway on purpose: no seam in any doorway).
export const GATES = [
	{ id: "terrace", r: [-5.5, -4.0, -14.0, -11.5] },
	{ id: "poolDeck", r: [10.6, 12.0, -19.6, -17.4] },
	{ id: "gardenNorth", r: [10.6, 12.0, -39.6, -37.4] },
	{ id: "gardenWing", r: [-5.5, -4.0, -32.8, -30.6] },
	{ id: "gardenSouth", r: [19.1, 20.9, -51.6, -49.4] },
	{ id: "gardenHaunted", r: [-9.6, -6.6, -42.4, -40.9] },
	{ id: "gardenAquarium", r: [-9.6, -6.6, -34.35, -32.85] },
	{ id: "parkNorth", r: [19.1, 20.9, -74.8, -72.6] },
	{ id: "parkWest", r: [-9.6, -6.6, -86.6, -85.0] },
	{ id: "karts", r: [-28.6, -26.0, -86.6, -85.0] },
	{ id: "aquarium", r: [-30.6, -28.0, -22.25, -20.75] },
	{ id: "haunted", r: [-30.6, -28.0, -42.4, -40.9] }
];

// the paths: [x0, z0, x1, z1, width] (straight, along x or z)
export const PATHS = [
	[-4.75, -12.0, -4.75, -32.1, 1.9],      // from the terrace's steps down to the garden's west wing
	[11.3, -18.1, 11.3, -38.1, 1.9],        // from the pool deck's gate down to the garden
	[-29.6, -21.5, 39.0, -21.5, 2.6],       // the cross walk, from the Aquarium's doors east
	[-4.75, -26.5, 11.3, -26.5, 1.7],       // across the plaza
	[-20.0, -21.5, -20.0, -85.8, 2.6],      // the west avenue
	[-20.0, -33.6, -7.6, -33.6, 1.7],       // to the garden's west gate (the Aquarium's side)
	[-29.6, -41.65, -7.6, -41.65, 2.2],     // the Haunted Mansion's doors to the garden's west gate
	[-27.6, -85.8, -7.6, -85.8, 2.2],       // the Bumper Karts to the Fun Park's west gate
	[20.0, -50.1, 20.0, -74.1, 2.6],        // the garden's south gate to the Fun Park
	[-20.0, -62.0, 39.0, -62.0, 2.0],       // the south walk, between the garden and the park
	[39.0, 26.0, 39.0, -62.0, 2.0],         // the east walk
	[-27.0, 26.0, 39.0, 26.0, 2.0],         // behind the house
	[-27.0, 26.0, -27.0, -21.5, 2.0]        // along the west side of the house
];
// the plaza on the lawn in front of the courtyard (with the Harmony sculpture in the middle)
export const PLAZA = { x: 3.5, z: -26.5, r: 4.4, core: 1.5 };

export const inRect = (r, x, z, pad = 0) => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad;

// a rect minus some holes, as a list of rects that cover the rest (cut on a grid of every edge, merged into rows)
export function subtractRects(outer, holes) {
	const hs = holes.map(h => [Math.max(outer[0], h[0]), Math.min(outer[1], h[1]), Math.max(outer[2], h[2]), Math.min(outer[3], h[3])]).filter(h => h[1] > h[0] && h[3] > h[2]);
	const xs = [...new Set([outer[0], outer[1], ...hs.flatMap(h => [h[0], h[1]])])].sort((a, b) => a - b);
	const zs = [...new Set([outer[2], outer[3], ...hs.flatMap(h => [h[2], h[3]])])].sort((a, b) => a - b);
	const free = (i, j) => { const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2; return !hs.some(h => inRect(h, cx, cz)); };
	// each row of cells: runs of free cells along x; then stack identical runs from row to row
	const out = [], open = new Map();
	for (let j = 0; j < zs.length - 1; j++) {
		const runs = [];
		for (let i = 0; i < xs.length - 1; i++) {
			if (!free(i, j)) continue;
			const last = runs[runs.length - 1];
			if (last && last[1] === i) last[1] = i + 1; else runs.push([i, i + 1]);
		}
		const next = new Map();
		for (const [a, b] of runs) {
			const key = a + ":" + b, r = open.get(key);
			if (r) { r[3] = zs[j + 1]; next.set(key, r); open.delete(key); }
			else next.set(key, [xs[a], xs[b], zs[j], zs[j + 1]]);
		}
		open.forEach(r => out.push(r));
		open.clear();
		next.forEach((r, k) => open.set(k, r));
	}
	open.forEach(r => out.push(r));
	return out;
}

// distance from (x, z) to a path's centre line
export function pathDist(p, x, z) {
	const [x0, z0, x1, z1] = p;
	const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
	const u = L2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0;
	return Math.hypot(x - (x0 + dx * u), z - (z0 + dz * u));
}
