/**
 * Harmony World — the layout of the whole estate (plain data, no three.js), shared by the house (worldHouse.js),
 * the grounds (worldGrounds.js) and the world (world.js: walking, the weather).
 *
 * The house stands in the north with the terrace and the pool deck in its courtyard. Everything else stands on
 * landscaped grounds round it, each with plenty of room to breathe (world x -430..56, z -470..40), joined by paved paths:
 *
 *   north   the house: one rectangular block, a walkable roof deck on top with the gym and the playroom up there, the
 *           terrace cantilevered off its south edge, and the double-height lounge rising out of it
 *   centre  the lawn in front of the courtyard: the cross walk, and a round plaza with the Harmony sculpture
 *   south   the walled garden (the treehouse over it, the Box of Shame in it), and past it the Fun Park
 *   west    a line of attractions along the west avenue: the Aquarium, the Haunted Mansion, the Bumper Karts
 *   round   a walk all round the house and down the east side, with the roller coaster outside it
 *   far west past the ring road: the Harmony Grand Prix circuit (RACE) - a big race track with a start gantry, a
 *           grandstand, a paddock of race cars, and hurdles on the way (cone slaloms, barrier chicanes, tyre gates)
 *   far south past the ring road, down the airfield road: Harmony Airfield (AIR) - a long runway, an apron with a hangar
 *           and a control tower, two planes to fly (worldPlanes.js), and a target on the lawn for parachutists
 *
 * Rects are [minX, maxX, minZ, maxZ] in world coordinates.
 */

// the grounds: everything inside the hedge
export const ESTATE = [-430, 56, -470, 40];
// (how far in from the edge you can walk: the hedge is in the way)
export const HEDGE_IN = 1.4;

// The house, from outside: one clean rectangle (x -22.55..33.7, z -8.8..24.7) with the pool deck and the patio in a
// courtyard cut into its south side. Each block is the outside of its walls (the facade's skin).
// (NORTH_IN: the inside face of its north wall - the back of every room along the north side)
export const NORTH_IN = 24.4;
export const HOUSE_BLOCKS = [
	[-22.55, -7.05, -8.8, 24.7],     // the west wing: the cinema, the dining room, the powder room, the library
	[-7.05, 23.35, -6.3, 24.7],      // the middle: the living room, the lounge, the foyer, the game room, the spa
	[23.12, 33.7, -8.8, 24.7]        // the east wing: the bedroom, the bathroom, the music room
];
export const HOUSE_RECT = [-22.55, 33.7, -8.8, 24.7];
// Inside, the house is rooms wall to wall, all opening onto one long hallway - the Gallery (worldGallery.js) - that runs
// right across it (x -22.25..33.4, z 8.42..12.2) with a front door at each end, out onto the lawns.
//   south of it: the cinema, the dining room, the powder room, the living room, the lounge (with the kitchen, and the
//     loft upstairs), the bathroom; the bedroom (and its walk-in wardrobe) behind the bathroom, onto the pool deck
//   north of it, every room with its own door straight off the hall (no two doors face each other): the library, the
//     foyer with the grand staircase up to the roof, the game room, the spa and the music room
//   up on the roof: a roof deck you can walk all over (worldRoof.js), the gym and the playroom in big pavilions along
//     its north side (a wide promenade in front of their doors), and the terrace cantilevered out over the lawn from
//     its south edge, nothing under it
// The rooms' insides, in world coordinates (the rooftop ones as they're drawn, up on the roof):
export const WING = {
	dining: [-22.25, -11.62, 1.92, 8.2],
	powder: [-11.42, -7.42, 1.92, 8.2],
	library: [-22.25, -8.25, 12.42, 24.4],
	games: [3.95, 13.95, 12.42, 24.4],
	spa: [14.35, 23.05, 12.42, 24.4],
	music: [23.35, 33.4, 12.42, 24.4],
	closet: [31.82, 33.4, 0.92, 8.4],
	gym: [21.8, 33.0, 14.0, 24.0],             // on the roof (over the spa and the music room), 11.2 x 10 m
	playroom: [4.2, 19.4, 14.0, 24.0]          // on the roof (over the game room and the spa), 15.2 x 10 m
};
// every doorway off the hall, [a, b] along it (x): the south side's in its z = 8.42 wall, the north side's in its
// z = 12.2 wall (none of them face each other)
export const HALL_DOORS = {
	dining: [-17.7, -16.1], powder: [-10.2, -8.65], living: [1.15, 2.55], lounge: [12.6, 14.1],
	library: [-13.4, -11.8], games: [8.15, 9.75], spa: [17.9, 19.5], music: [27.6, 29.2]
};
// the Gallery's parts: the hall, the bit in front of the living room's doorway, and the foyer
export const GALLERY = {
	hall: [-22.25, 33.4, 8.42, 12.2],
	bump: [-7.2, 7.03, 6.22, 8.42],
	foyer: [-8.05, 3.75, 12.2, 24.4],
	entrance: [9.5, 11.1]                       // the front doors at each end (z)
};
// the foyer's grand staircase, up to the roof: along its west wall, rising north; the top steps come up through a glass
// pavilion on the roof deck
export const STAIR = { x0: -8.05, x1: -5.65, z0: 15.4, z1: 23.4, top: 24.4, n: 30, hole: 19.9 };
// The roof: drawn over the house (its deck at ROOF_FLOOR), but on the floor plan it's ROOF_FP away (500 m east), so it
// never mixes with the rooms under it (the loft's trick). The terrace and the rooftop rooms share that floor plan.
export const ROOF_FP = [500, 0];
export const ROOF_FLOOR = 5.52;
// where you can't walk up there (drawn coordinates): the lounge's two storeys, the glass pavilion over the stairwell, the
// rooftop rooms; and the ways through: the top of the stairs, the rooms' doors, the gap onto the terrace
// (the rooftop rooms' doors are in their south walls, onto the promenade between them and the lounge's upper storey:
// gymDoor / playDoor are the doorway [x0, x1] and a corridor through it, reaching well in on both sides)
export const ROOF_DECK = [-22.25, 33.4, -8.5, 24.4];   // inside the parapet (the deck's own edge)
export const ROOF_PLAN = {
	inner: [-22.15, 33.3, -8.4, 24.3],          // inside the parapet
	notch: [-6.97, 23.12, -8.8, -6.4],          // the courtyard (open to the sky, down to the patio and the pool)
	upper: [6.75, 23.65, -6.32, 8.25],          // the lounge's double height, rising out of the roof
	pavilion: [-8.25, -5.45, 19.7, 23.2],       // the glass box over the stairwell (its north end is the landing)
	landing: [-8.05, -4.6, 22.6, 24.4],         // the top of the stairs, and out of the pavilion's open east side
	gymDoor: [26.4, 28.4, 12.4, 15.6],         // (the doorways are 2 m wide, onto a promenade 5.5 m wide)
	playDoor: [10.8, 12.8, 12.4, 15.6],
	terraceGap: [-19.3, -17.3, -9.6, -7.4]
};
// Real windows in the outside walls (glass in the facade, with the room behind it): face (w / n / e, from outside),
// a..b along it (z on the west and east faces, x on the north), y0..y1. own: the room makes its own opening.
// (the game room and the spa are shells of their own, k.shell: no windows in the facade there, timber panels instead)
export const WINDOWS = [
	{ face: "w", a: 3.2, b: 4.8, y0: 0.8, y1: 2.6 }, { face: "w", a: 5.9, b: 7.5, y0: 0.8, y1: 2.6 },               // dining room
	{ face: "w", a: 14.8, b: 16.6, y0: 0.75, y1: 2.75 }, { face: "w", a: 20.2, b: 22.0, y0: 0.75, y1: 2.75 },       // library
	{ face: "n", a: -20.2, b: -18.4, y0: 0.75, y1: 2.75 }, { face: "n", a: -12.6, b: -10.8, y0: 0.75, y1: 2.75 },   // library
	{ face: "n", a: -4.0, b: -2.2, y0: 0.6, y1: 4.6 }, { face: "n", a: -0.4, b: 1.4, y0: 0.6, y1: 4.6 },           // foyer
	{ face: "n", a: 25.8, b: 27.6, y0: 0.8, y1: 2.6 }, { face: "n", a: 29.8, b: 31.6, y0: 0.8, y1: 2.6 },           // music room
	{ face: "e", a: 15.4, b: 17.2, y0: 0.8, y1: 2.6 }, { face: "e", a: 20.0, b: 21.8, y0: 0.8, y1: 2.6 },           // music room
	{ face: "e", a: 4.0, b: 5.2, y0: 1.4, y1: 2.4 },                                                                 // wardrobe
	{ face: "w", a: 9.5, b: 11.1, y0: 0, y1: 2.6, door: true }, { face: "e", a: 9.5, b: 11.1, y0: 0, y1: 2.6, door: true },   // the front doors
	{ face: "e", a: -4.5, b: -2.3, y0: 0.75, y1: 2.45, own: true }                                                  // bedroom
];
// a room's windows, as holes in its own walls (n / s / w / e as in makeRoom: n is its low-z side, s its high-z side)
export function windowsOf(r) {
	const out = [];
	for (const w of WINDOWS) {
		if (w.own || w.door) continue;
		const on = w.face === "n" ? Math.abs(r[3] - NORTH_IN) < 0.01 && w.a >= r[0] && w.b <= r[1]
			: w.face === "w" ? Math.abs(r[0] + 22.25) < 0.01 && w.a >= r[2] && w.b <= r[3]
			: Math.abs(r[1] - 33.4) < 0.01 && w.a >= r[2] && w.b <= r[3];
		if (on) out.push({ wall: w.face === "n" ? "s" : w.face, a: w.a, b: w.b, y0: w.y0, y1: w.y1, glass: true });
	}
	return out;
}
// the lounge's two storeys rise out of the flat roof
export const LOUNGE_RECT = [7.05, 23.35, -6.25, 8.15];
export const ROOF_Y = 5.4, PARAPET_Y = 5.85, LOUNGE_TOP = 7.85;
// the open-air courtyard: the terrace (behind the living room) and the pool deck
// (the terrace used to be here too: it's up on the roof now, and where it stood is a paved patio, PATIO, on the grounds)
export const COURTS = [
	[5.45, 33.6, -18.1, -6.05]
];
export const PATIO = [-7.0, 5.45, -12.0, -6.3];

// The ways in and out of each place, as corridors that reach across its edge (a body needs its whole radius clear
// on one side or the other, so these overlap the place's own doorway on purpose: no seam in any doorway).
export const GATES = [
	{ id: "backDoor", r: [-6.1, -4.5, -7.4, -5.9] },          // the living room's back door, out to the patio
	{ id: "poolWest", r: [4.0, 6.9, -10.3, -8.3] },           // the patio onto the pool deck (its west railing's gate)
	{ id: "poolDeck", r: [10.6, 12.0, -19.6, -17.4] },
	{ id: "gardenNorth", r: [10.6, 12.0, -39.6, -37.4] },
	{ id: "gardenWing", r: [-5.5, -4.0, -32.8, -30.6] },
	{ id: "gardenSouth", r: [19.1, 20.9, -85.6, -83.4] },
	{ id: "gardenHaunted", r: [-9.6, -6.6, -42.4, -40.9] },
	{ id: "gardenAquarium", r: [-9.6, -6.6, -34.35, -32.85] },
	{ id: "parkNorth", r: [19.1, 20.9, -108.8, -106.6] },
	{ id: "parkWest", r: [-9.6, -6.6, -120.6, -119.0] },
	{ id: "karts", r: [-28.6, -26.0, -120.6, -119.0] },
	{ id: "aquarium", r: [-30.6, -28.0, -22.25, -20.75] },
	{ id: "haunted", r: [-30.6, -28.0, -42.4, -40.9] },
	// the Gallery's front doors, at each end of the house (reaching well past the hall's own area, whose edge the
	// grounds keep a body's width away from: short of that there was a strip outside each door nobody could stand on)
	{ id: "frontWest", r: [-25.2, -21.6, 9.5, 11.1] },
	{ id: "frontEast", r: [32.9, 36.5, 9.5, 11.1] }
];

// the paths: [x0, z0, x1, z1, width] (straight, along x or z)
export const PATHS = [
	[-4.75, -12.0, -4.75, -32.1, 1.9],      // from the patio down to the garden's west wing
	[11.3, -18.1, 11.3, -38.1, 1.9],        // from the pool deck's gate down to the garden
	[-29.6, -21.5, 39.0, -21.5, 2.6],       // the cross walk, from the Aquarium's doors east
	[-4.75, -26.5, 11.3, -26.5, 1.7],       // across the plaza
	[-20.0, -21.5, -20.0, -119.8, 2.6],     // the west avenue
	[-20.0, -33.6, -7.6, -33.6, 1.7],       // to the garden's west gate (the Aquarium's side)
	[-29.6, -41.65, -7.6, -41.65, 2.2],     // the Haunted Mansion's doors to the garden's west gate
	[-27.6, -119.8, -7.6, -119.8, 2.2],     // the Bumper Karts to the Fun Park's west gate
	[20.0, -84.1, 20.0, -108.1, 2.6],       // the garden's south gate to the Fun Park
	[-20.0, -96.0, 39.0, -96.0, 2.0],       // the south walk, between the garden and the park
	[39.0, 29.0, 39.0, -96.0, 2.0],         // the east walk
	[-27.0, 29.0, 39.0, 29.0, 2.0],         // behind the house
	[-27.0, 29.0, -27.0, -21.5, 2.0],       // along the west side of the house
	[-27.0, 10.3, -22.55, 10.3, 2.0],       // to the front door at the west end of the Gallery
	[33.7, 10.3, 39.0, 10.3, 2.0]           // to the front door at its east end
];
// The roads (for the cars - people can walk on them too): a ring road all round the outside of the grounds, just
// inside the hedge and outside everything else (the roller coaster runs over it here and there), and a drive in from
// its west side to the cars' parking pad by the house's west front door. The white paths are for walking.
export const ROAD_W = 6.4;
// the ring's centre line: a rounded rectangle
export const RING = { x0: -87.2, x1: 50.2, z0: -160.6, z1: 35.0, r: 12 };
// the drive: from the ring (its west side) east along z to the parking pad's west edge
export const DRIVE = { x0: -87.2, x1: -37.8, z: 10.3 };
// where the drive meets the ring and the pad, widened so a car can swing in: x0..x1, half-width h0 at x0 to h1 at x1
// (and on the ring's far side, the road on west to the race track)
export const MOUTHS = [
	{ x0: -84.0, x1: -77.5, z: 10.3, h0: 7.0, h1: ROAD_W / 2 },
	{ x0: -44.5, x1: -37.8, z: 10.3, h0: ROAD_W / 2, h1: 5.7 },
	{ x0: -96.9, x1: -90.4, z: 10.3, h0: ROAD_W / 2, h1: 7.0 }
];

// ================================================================ the race track (worldRace.js)
// The Harmony Grand Prix: a closed circuit out in the far west, past the ring road. Its centre line is a smooth loop
// (Catmull-Rom) through these points, run in this order; the first one is the start / finish line, on the main straight
// that runs south down its east side (x -112). The road from the ring's west side (RACE_ROAD, on along the drive's line)
// comes in at the top of that straight.
export const RACE = {
	hw: 6.5,   // half the track's width
	pts: [
		[-112, -30], [-112, -80], [-117, -118], [-140, -142], [-190, -150], [-260, -148], [-322, -140], [-372, -118],
		[-402, -78], [-408, -26], [-388, 16], [-336, 26], [-276, 20], [-236, -6], [-226, -52], [-196, -84],
		[-160, -74], [-152, -40], [-176, -6], [-160, 20], [-130, 26], [-112, 8]
	],
	// everything the circuit takes up (the track, its run-off, the grandstand, the paddock): nothing else stands here
	area: [-426, -98, -162, 36],
	// the paddock in the infield (race cars parked in a row, facing the track), and the grandstand beside the main straight
	paddock: [-137, -124, -54, -22],
	stand: [-103.4, -97.6, -74, -36]
};
export const RACE_ROAD = { x0: -112, x1: -87.2, z: 10.3 };
// ================================================================ the airfield (worldPlanes.js)
// Harmony Airfield, out in the far south past the ring road: one long runway running east-west (09 / 27), an apron on
// its north side with a hangar and a control tower, and a road up from the ring road's south side. Two planes wait on
// the apron; the lawn round it is kept clear of trees (the approaches too), and there's a target out on the lawn to
// aim for under a parachute.
export const AIR = {
	runway: { x0: -380, x1: -20, z: -340, hw: 12 },
	apron: [-120, 0, -328, -270],
	hangar: [-112, -44, -268, -244],
	tower: [14, -284],
	road: { x: -20, z0: -270, z1: -160.6 },
	target: [-205, -240],
	windsock: [-200, -318],
	// nothing tall in here: the runway, its approaches, the apron and its buildings
	clear: [-450, 30, -372, -236]
};
AIR.runwayRect = [AIR.runway.x0, AIR.runway.x1, AIR.runway.z - AIR.runway.hw, AIR.runway.z + AIR.runway.hw];
// the centre line, sampled every ~step metres from the start line: [x, z, tangent x, tangent z, metres from the line]
let raceLine = null;
export function racePath() {
	if (raceLine) return raceLine;
	const P = RACE.pts, n = P.length, dense = [];
	for (let i = 0; i < n; i++) {
		const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
		for (let j = 0; j < 40; j++) {
			const t = j / 40, t2 = t * t, t3 = t2 * t;
			const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
			dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
		}
	}
	// even spacing (~1.5 m)
	const out = [];
	let along = 0;
	out.push([dense[0][0], dense[0][1], 0, 0, 0]);
	let last = dense[0];
	for (let i = 1; i <= dense.length; i++) {
		const q = dense[i % dense.length];
		along += Math.hypot(q[0] - last[0], q[1] - last[1]);
		last = q;
		if (along - out[out.length - 1][4] >= 1.5 && i < dense.length) out.push([q[0], q[1], 0, 0, along]);
	}
	out.len = along;
	for (let i = 0; i < out.length; i++) {
		const a = out[(i - 1 + out.length) % out.length], b = out[(i + 1) % out.length];
		const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
		out[i][2] = dx / L; out[i][3] = dz / L;
	}
	// a coarse grid of which samples are near each 8 m cell (finding the nearest sample is then quick)
	const C = 8, cells = new Map();
	out.forEach((p, i) => {
		const ci = Math.floor(p[0] / C), cj = Math.floor(p[1] / C);
		for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
			const key = (ci + di) * 4096 + (cj + dj), l = cells.get(key);
			if (l) l.push(i); else cells.set(key, [i]);
		}
	});
	out.near = (x, z) => cells.get(Math.floor(x / C) * 4096 + Math.floor(z / C)) || null;
	raceLine = out;
	return out;
}
// where (x, z) is on the track: { d: distance from the centre line, s: metres round from the start line, i: the sample,
// u: how far across (+: to the left of the way round) } - or null if it's nowhere near it (over 16 m off)
export function raceAt(x, z) {
	const L = racePath(), near = L.near(x, z);
	if (!near) return null;
	let best = -1, bd = Infinity;
	for (const i of near) { const p = L[i], d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = i; } }
	if (best < 0) return null;
	const p = L[best], dx = x - p[0], dz = z - p[1];
	const u = dx * p[3] - dz * p[2];   // (heading +z, left is +x)
	const t = dx * p[2] + dz * p[3];
	return { d: Math.abs(u), s: (p[4] + t + L.len) % L.len, i: best, u };
}
function ringSd(x, z) {
	const cx = (RING.x0 + RING.x1) / 2, cz = (RING.z0 + RING.z1) / 2;
	const qx = Math.abs(x - cx) - ((RING.x1 - RING.x0) / 2 - RING.r), qz = Math.abs(z - cz) - ((RING.z1 - RING.z0) / 2 - RING.r);
	return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - RING.r;
}
// is (x, z) on a road? (pad: that much further out; negative: that far inside its edges)
export function roadAt(x, z, pad = 0) {
	const hw = ROAD_W / 2 + pad;
	if (Math.abs(ringSd(x, z)) < hw) return true;
	if (x > DRIVE.x0 && x < DRIVE.x1 && Math.abs(z - DRIVE.z) < hw) return true;
	if (x > RACE_ROAD.x0 && x < RACE_ROAD.x1 && Math.abs(z - RACE_ROAD.z) < hw) return true;
	if (x < RACE.area[1] + 6 + pad) { const r = raceAt(x, z); if (r && r.d < RACE.hw + 1.2 + pad) return true; }
	if (Math.abs(x - AIR.road.x) < hw && z > AIR.road.z0 - pad && z < AIR.road.z1 + pad) return true;
	if (inRect(AIR.apron, x, z, pad) || inRect(AIR.runwayRect, x, z, pad)) return true;
	for (const m of MOUTHS) if (x > m.x0 - Math.max(0, pad) && x < m.x1 + Math.max(0, pad)) {
		const t = Math.max(0, Math.min(1, (x - m.x0) / (m.x1 - m.x0)));
		if (Math.abs(z - m.z) < m.h0 + (m.h1 - m.h0) * t + pad) return true;
	}
	return false;
}
// points along the ring's centre line every ~step metres: [x, z, tangent x, tangent z] (anticlockwise seen from above)
export function ringPath(step = 2) {
	const { x0, x1, z0, z1, r } = RING, out = [];
	const line = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) out.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n, (bx - ax) / L, (bz - az) / L]); };
	const arc = (cx, cz, a0) => { const n = Math.max(4, Math.round(r * Math.PI / 2 / step)); for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI / 2; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, -Math.sin(a), Math.cos(a)]); } };
	line(x0 + r, z0, x1 - r, z0); arc(x1 - r, z0 + r, -Math.PI / 2);
	line(x1, z0 + r, x1, z1 - r); arc(x1 - r, z1 - r, 0);
	line(x1 - r, z1, x0 + r, z1); arc(x0 + r, z1 - r, Math.PI / 2);
	line(x0, z1 - r, x0, z0 + r); arc(x0 + r, z0 + r, Math.PI);
	return out;
}

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
