/**
 * Harmony World — Harmony Airfield and its two planes, out in the far south of the grounds past the ring road (AIR in
 * worldEstate.js): a long runway (09 / 27) with edge lights, an apron with a hangar and a control tower, a windsock, a
 * road up to the ring road, and a target out on the lawn to aim for under a parachute.
 *
 * Two planes wait on the apron, each with a seat for a pilot and one for a passenger: Buttercup, a yellow open-cockpit
 * biplane (slow, forgiving, turns on a sixpence), and Bluebird, a sleek blue sport plane (fast, with retractable gear).
 * Take off from the runway - or from any lawn with room - fly anywhere over the grounds, and land on the runway or on
 * any open lawn: gently, wings level, not diving, wheels down. Come down too hard, belly first at speed, into the trees,
 * a building, the roller coaster or another plane, and it's a crash: a fireball, a burning wreck, and you crawl out a
 * little singed. The plane is back at the hangar a few seconds later.
 * Up in the air anyone in a plane can jump out (J): freefall, then open the parachute (Space; it opens by itself low
 * down if you forget), steer it down and try to land on the target. A plane its pilot jumped out of flies on alone till
 * it comes down somewhere.
 *
 * Flying: W / S throttle, the arrow keys ↑ / ↓ the stick (↑ nose down, ↓ nose up; I swaps them), A / D (or ← / →) bank
 * to turn, Shift a burst of power, Space the wheel brakes, G the landing gear (Bluebird), R a smoke trail, C the camera,
 * J jump, Esc get out (on the ground) or jump (in the air). On a phone the joystick is the stick, and the prompt has
 * the throttle.
 *
 * Shared state, like the cars (worldCars.js): "plane:<id>" { d: who flies it (or last flew it), st: park | fly | ghost
 * (flying with nobody in it) | wreck, x, y, z, h, p, r, b (landed on its belly) }, written only by that person (every
 * few seconds, and when something happens), and "planep:<id>" { p: the passenger }, written only by them. While it
 * flies, whoever flies it sends where it is about 15 times a second ("pl" zfx messages) and everyone else predicts it
 * between them; skydivers send theirs ("sd"). Crashes ("pcrash") and planes coming home ("pspawn") go to everyone too.
 *
 * Built by the grounds (worldGrounds.js) into their group: world coordinates. A plane's own coordinates: the nose toward
 * +z, its left wing toward +x, its middle (what it turns about) at 0.
 */
import { floorAt } from "./worldRoom.js";
import { AIR, ESTATE, HEDGE_IN, HOUSE_RECT, RACE, ROAD_W } from "./worldEstate.js";

const G = 9.8;
const CEIL = 240;          // how high a plane can climb
const EDGE = 45;           // this near the hedge, a plane turns itself back toward the middle
const SEND = 1 / 15;       // how often whoever flies a plane sends where it is
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const lerp = (a, b, t) => a + (b - a) * t;
const nowS = () => performance.now() / 1000;
// local (lx, lz) on something at (x, z) facing h -> world
const toWorld = (x, z, h, lx, lz) => [x + lx * Math.cos(h) + lz * Math.sin(h), z - lx * Math.sin(h) + lz * Math.cos(h)];

const HOME_H = -Math.PI / 2 - 0.45;   // parked on the apron, angled toward the runway (its long end, west)
const DEFS = [
	{
		id: "buttercup", name: "Buttercup", kind: "bi", reg: "H-LOVE",
		paint: "#f5c518", wing: "#fff1cf", trim: "#e2456f", smokeCol: "#ff7aa2",
		x: -62, z: -304, h: HOME_H,
		gearH: 1.37, bellyH: 0.6, rest: 0.17,
		stall: 11, fly: 16, top: 34, boost: 44, acc: 7.5, roll: 2.6, maxBank: 1.15, pitchRate: 1.1,
		retract: false, camDist: 11.5,
		seats: { pilot: [0, -0.48, -1.35], pass: [0, -0.46, -0.05] },
		stands: { pilot: [1.35, -1.9], pass: [-1.35, -1.6] },
		solid: [[-0.62, 0.62, -4.4, 2.6], [-4.3, 4.3, -0.45, 0.95], [-1.6, 1.6, -4.3, -3.3]],
		smokeAt: [0, -0.15, -4.5], span: 4.6, nose: 2.6, tail: -4.4
	},
	{
		id: "bluebird", name: "Bluebird", kind: "sport", reg: "H-SKY",
		paint: "#1f5fae", wing: "#f4f6fa", trim: "#f4f6fa", smokeCol: "#7cc8ff",
		x: -30, z: -304, h: HOME_H,
		gearH: 1.05, bellyH: 0.58, rest: 0,
		stall: 16, fly: 22, top: 52, boost: 68, acc: 9.5, roll: 3.2, maxBank: 1.2, pitchRate: 1.0,
		retract: true, camDist: 13,
		seats: { pilot: [0.33, -0.6, -0.25], pass: [-0.33, -0.6, -0.25] },
		stands: { pilot: [1.55, -1.7], pass: [-1.55, -1.7] },
		solid: [[-0.7, 0.7, -4.6, 3.3], [-4.95, 4.95, -0.9, 1.0], [-1.8, 1.8, -4.6, -3.5]],
		smokeAt: [0, -0.1, -4.6], span: 4.95, nose: 3.3, tail: -4.6
	}
];

// up in the air, what a plane can fly into (besides the trees, the roller coaster and the other planes):
// [minX, maxX, minZ, maxZ, top, what happened]
const BLOCKS = [
	[HOUSE_RECT[0], HOUSE_RECT[1], HOUSE_RECT[2], HOUSE_RECT[3], 9.8, "Flew straight into the house!"],
	[-53.0, -29.6, -27.5, -16.8, 9, "Flew into the Aquarium!"],
	[-53.0, -29.6, -50.1, -39.7, 13, "Flew into the Haunted Mansion! (The ghosts are thrilled.)"],
	[-7.6, 33.6, -144.0, -108.1, 9, "Flew into the Fun Park's rides!"],
	[-6.6, 7.6, -130.6, -127.4, 16.6, "Flew into the Ferris wheel!"],
	[25.5, 29.5, -118.5, -114.5, 25.5, "Flew into the drop tower!"],
	[3.0, 26.0, -70.0, -54.0, 14, "Flew into the treehouse!"],
	[-66.0, -27.6, -143.6, -96.8, 5, "Flew into the bumper kart arena!"],
	[RACE.stand[0], RACE.stand[1], RACE.stand[2], RACE.stand[3], 9, "Flew into the grandstand!"],
	[-121, -103, -32, -28, 8, "Flew into the race track's start gantry!"],
	[AIR.hangar[0], AIR.hangar[1], AIR.hangar[2], AIR.hangar[3], 11.4, "Flew into the hangar!"],
	[AIR.tower[0] - 3.4, AIR.tower[0] + 3.4, AIR.tower[1] - 3.4, AIR.tower[1] + 3.4, 17.2, "Flew into the control tower!"]
];

export function buildPlanes(k, { PATH_Y, track }) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(5150);
	const glow = (c, extra) => new THREE.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, extra || {}));
	const repeat = (t, rx, ry) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
	const softTex = canvasTex(64, 64, (c, w, h) => {
		const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
		gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
	});
	const blobTex = canvasTex(128, 128, (c, w, h) => {
		const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
		gr.addColorStop(0, "rgba(0,0,0,0.7)"); gr.addColorStop(0.6, "rgba(0,0,0,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
	});

	// flat rects and strips, merged into one mesh per material (y: the height, facing up)
	function flatMesh(rects, lines, y, material) {
		const pos = [], nor = [], uv = [], idx = [];
		const quad = pts => {
			const b = pos.length / 3;
			pts.forEach(p => { pos.push(p[0], y, p[1]); nor.push(0, 1, 0); uv.push(p[0] / 8, -p[1] / 8); });
			idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
		};
		for (const [x0, x1, z0, z1] of rects) quad([[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);
		// a strip from (ax, az) to (bx, bz), w wide
		for (const [ax, az, bx, bz, w] of lines) {
			const l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l * w / 2, nz = (bx - ax) / l * w / 2;
			const pts = [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]];
			// (wound to face up, whichever way the strip runs)
			const cr = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]);
			quad(cr > 0 ? pts : pts.reverse());
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
		geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
		geo.setIndex(idx);
		geo.computeBoundingSphere();
		const m = new THREE.Mesh(geo, material);
		m.castShadow = false; m.receiveShadow = true;
		g.add(m);
		return m;
	}
	function asphaltTex(seed, base, rx, ry) {
		return repeat(canvasTex(256, 256, (c, w, h) => {
			c.fillStyle = base; c.fillRect(0, 0, w, h);
			const r = rng(seed);
			for (let i = 0; i < 7000; i++) { const t = 36 + r() * 44; c.fillStyle = `rgba(${t + 8},${t + 6},${t + 12},0.5)`; c.fillRect(r() * w, r() * h, 2, 2); }
		}), rx, ry);
	}

	// ================================================================ the runway, the apron, the road up to the ring
	const RW = AIR.runway, RLEN = RW.x1 - RW.x0;
	{
		const rw = add(g, new THREE.PlaneGeometry(RLEN, RW.hw * 2), mat("#ffffff", 0.9, 0, { map: asphaltTex(31, "#2f2e35", RLEN / 14, RW.hw * 2 / 14) }), (RW.x0 + RW.x1) / 2, PATH_Y + 0.004, RW.z, { rx: -Math.PI / 2, cast: false });
		rw.userData.floor = true;
		// the apron: pale concrete slabs
		const ap = AIR.apron;
		const concrete = repeat(canvasTex(256, 256, (c, w, h) => {
			c.fillStyle = "#9b968e"; c.fillRect(0, 0, w, h);
			const r = rng(57);
			for (let i = 0; i < 5000; i++) { const t = 130 + r() * 50; c.fillStyle = `rgba(${t},${t - 4},${t - 10},0.35)`; c.fillRect(r() * w, r() * h, 2, 2); }
			c.strokeStyle = "rgba(60,55,50,0.55)"; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
		}), (ap[1] - ap[0]) / 8, (ap[3] - ap[2]) / 8);
		add(g, new THREE.PlaneGeometry(ap[1] - ap[0], ap[3] - ap[2]), mat("#ffffff", 0.92, 0, { map: concrete }), (ap[0] + ap[1]) / 2, PATH_Y + 0.002, (ap[2] + ap[3]) / 2, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
		// the road up to the ring road's south side
		const rd = AIR.road, rl = rd.z1 - rd.z0 + 3.2;
		add(g, new THREE.PlaneGeometry(ROAD_W, rl), mat("#ffffff", 0.9, 0, { map: asphaltTex(43, "#34333a", 1, rl / 8) }), rd.x, PATH_Y + 0.003, rd.z0 + rl / 2, { rx: -Math.PI / 2, cast: false }).userData.floor = true;

		// white paint: the centre line, the edge lines, the threshold "piano keys", the aiming points
		const white = [], yellow = [], ylines = [];
		const z = RW.z, hw = RW.hw;
		for (let x = RW.x0 + 40; x < RW.x1 - 40; x += 30) white.push([x, x + 15, z - 0.35, z + 0.35]);
		white.push([RW.x0 + 2, RW.x1 - 2, z - hw + 0.6, z - hw + 1.0], [RW.x0 + 2, RW.x1 - 2, z + hw - 1.0, z + hw - 0.6]);
		for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
			const zc = z + sd * (2.0 + i * 2.4);
			white.push([RW.x0 + 3, RW.x0 + 21, zc - 0.75, zc + 0.75], [RW.x1 - 21, RW.x1 - 3, zc - 0.75, zc + 0.75]);
		}
		for (const sd of [-1, 1]) white.push([RW.x0 + 70, RW.x0 + 100, z + sd * 4.2 - 1.1, z + sd * 4.2 + 1.1], [RW.x1 - 100, RW.x1 - 70, z + sd * 4.2 - 1.1, z + sd * 4.2 + 1.1]);
		flatMesh(white, [], PATH_Y + 0.009, glow("#efece4", { transparent: true, opacity: 0.85, depthWrite: false })).renderOrder = 1;
		// yellow paint: the apron's edge, a lead-in line from each parking spot to the runway, the parking T's, the road's
		// centre line
		yellow.push([ap[0] + 1, ap[1] - 1, ap[2] + 1.2, ap[2] + 1.5]);
		for (const d of DEFS) {
			const [ex, ez] = toWorld(d.x, d.z, d.h, 0, 4.5);
			ylines.push([ex, ez, ex + Math.sin(d.h) * 42, ez + Math.cos(d.h) * 42, 0.3]);
			const [tx, tz] = toWorld(d.x, d.z, d.h, 0, 3.2);
			ylines.push([tx - Math.cos(d.h) * 2, tz + Math.sin(d.h) * 2, tx + Math.cos(d.h) * 2, tz - Math.sin(d.h) * 2, 0.3]);
		}
		for (let zz = rd.z0 + 4; zz < rd.z1 - 3; zz += 7) yellow.push([rd.x - 0.12, rd.x + 0.12, zz, zz + 3.5]);
		flatMesh(yellow, ylines, PATH_Y + 0.012, glow("#f2c94c", { transparent: true, opacity: 0.85, depthWrite: false })).renderOrder = 1;
		// the runway's numbers (read by a pilot coming in to land): 09 at the west end, 27 at the east end
		for (const [txt, x, rz] of [["09", RW.x0 + 42, -Math.PI / 2], ["27", RW.x1 - 42, Math.PI / 2]]) {
			const m = add(g, new THREE.PlaneGeometry(14, 9), new THREE.MeshBasicMaterial({ map: k.tex.text(txt, { w: 512, h: 320, color: "#efece4", font: "900 300px Nunito, 'Segoe UI', sans-serif" }), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.88 }), x, PATH_Y + 0.012, z, { cast: false, receive: false });
			m.rotation.set(-Math.PI / 2, 0, rz);
			m.renderOrder = 1;
		}
		// the lights: white along both edges, green across both ends (lit day and night)
		const edge = [], ends = [];
		for (let x = RW.x0 + 5; x <= RW.x1 - 5; x += 24) for (const sd of [-1, 1]) edge.push([x, z + sd * (hw + 0.7)]);
		for (let zz = z - hw + 1; zz <= z + hw - 1; zz += 2.2) ends.push([RW.x0 - 1.2, zz], [RW.x1 + 1.2, zz]);
		const lights = (pts, col) => {
			const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), glow(col), pts.length), d = new THREE.Object3D();
			pts.forEach(([x, zz], i) => { d.position.set(x, 0.22, zz); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
			im.castShadow = false; im.instanceMatrix.needsUpdate = true; g.add(im);
			const base = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), mat("#3a3640", 0.6, 0.3), pts.length);
			pts.forEach(([x, zz], i) => { d.position.set(x, 0.1, zz); d.updateMatrix(); base.setMatrixAt(i, d.matrix); });
			base.castShadow = false; base.instanceMatrix.needsUpdate = true; g.add(base);
		};
		lights(edge, "#fff6dc"); lights(ends, "#5dff8f");
	}

	// ================================================================ the hangar (big rose doors facing the apron)
	{
		const [x0, x1, z0, z1] = AIR.hangar, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, WH = 7;
		const wallM = mat("#efe6d6", 0.85);
		const roofTex = repeat(canvasTex(128, 128, (c, w, h) => {
			c.fillStyle = "#c3ccd6"; c.fillRect(0, 0, w, h);
			for (let i = 0; i < 8; i++) { const gr = c.createLinearGradient(i * 16, 0, i * 16 + 16, 0); gr.addColorStop(0, "#9eabb8"); gr.addColorStop(0.5, "#e4e9ee"); gr.addColorStop(1, "#9eabb8"); c.fillStyle = gr; c.fillRect(i * 16, 0, 16, h); }
		}), 1, W / 1.2);
		const arch = new THREE.CylinderGeometry(D / 2, D / 2, W, 40, 1, true, 0, Math.PI);
		arch.rotateZ(Math.PI / 2);
		arch.scale(1, 0.36, 1);
		add(g, arch, mat("#ffffff", 0.45, 0.45, { map: roofTex, side: THREE.DoubleSide }), cx, WH, cz);
		// the gable ends (half ellipses over the side walls)
		const gs = new THREE.Shape(); gs.absellipse(0, 0, D / 2, D / 2 * 0.36, 0, Math.PI, false);
		for (const x of [x0, x1]) add(g, new THREE.ShapeGeometry(gs, 24), mat("#e6dccb", 0.85, 0, { side: THREE.DoubleSide }), x, WH, cz, { ry: Math.PI / 2 });
		add(g, new THREE.BoxGeometry(W, WH, 0.3), wallM, cx, WH / 2, z1 - 0.15);
		for (const x of [x0 + 0.15, x1 - 0.15]) add(g, new THREE.BoxGeometry(0.3, WH, D), wallM, x, WH / 2, cz);
		// the front: rose doors in panels, a white band over them with the airfield's name
		const doorTex = canvasTex(1024, 128, (c, w, h) => {
			c.fillStyle = "#d9577a"; c.fillRect(0, 0, w, h);
			for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"; c.fillRect(i * 64, 0, 64, h); c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(i * 64, 0, 2, h); }
			c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(0, h * 0.48, w, 3);
		});
		add(g, new THREE.BoxGeometry(W, WH - 1.4, 0.3), mat("#ffffff", 0.6, 0.15, { map: doorTex }), cx, (WH - 1.4) / 2, z0 + 0.15);
		add(g, new THREE.BoxGeometry(W, 1.4, 0.32), wallM, cx, WH - 0.7, z0 + 0.15);
		add(g, new THREE.PlaneGeometry(26, 1.1), new THREE.MeshBasicMaterial({ map: k.tex.text("HARMONY AIRFIELD", { w: 1024, h: 64, color: "#d9577a", font: "900 52px Nunito, 'Segoe UI', sans-serif" }), transparent: true, toneMapped: false }), cx, WH - 0.7, z0 - 0.02, { ry: Math.PI, cast: false, receive: false });
		// a big heart over the doors
		const hs = new THREE.Shape();
		hs.moveTo(0, -1); hs.bezierCurveTo(-1.6, 0.1, -1.0, 1.3, 0, 0.55); hs.bezierCurveTo(1.0, 1.3, 1.6, 0.1, 0, -1);
		add(g, new THREE.ShapeGeometry(hs, 16), glow("#ff8fab"), cx, WH + 2.2, z0 - 0.3, { ry: Math.PI, cast: false, receive: false }).scale.set(1.4, 1.4, 1);
		k.box(x0, x1, z0, z1);
	}

	// ================================================================ the control tower (its beacon turns), the windsock
	let beacon, sock;
	{
		const [tx, tz] = AIR.tower;
		const white = mat("#f3efe8", 0.7);
		add(g, new THREE.CylinderGeometry(2.3, 2.8, 13, 20), white, tx, 6.5, tz);
		add(g, new THREE.CylinderGeometry(3.7, 3.7, 0.3, 24), mat("#3a3640", 0.6, 0.3), tx, 13.15, tz);
		add(g, new THREE.CylinderGeometry(3.1, 2.9, 2.6, 8, 1, true), new THREE.MeshPhysicalMaterial({ color: "#9fd4ff", transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }), tx, 14.6, tz, { cast: false });
		add(g, new THREE.CylinderGeometry(2.9, 2.9, 0.1, 8), glow("#ffe2a8"), tx, 13.35, tz, { cast: false });
		add(g, new THREE.CylinderGeometry(3.6, 3.4, 0.4, 8), white, tx, 16.1, tz);
		add(g, new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat("#3a3640", 0.5, 0.5), tx + 1.5, 17.4, tz);
		add(g, new THREE.PlaneGeometry(1.4, 2.3), mat("#5a4a52", 0.6), tx, 1.15, tz + 2.72, { cast: false });
		beacon = group(g, tx, 16.6, tz);
		add(beacon, new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), mat("#2e2a31", 0.5, 0.4), 0, 0, 0);
		add(beacon, new THREE.BoxGeometry(0.18, 0.18, 0.12), glow("#6dff9a"), 0, 0.05, 0.22, { cast: false });
		add(beacon, new THREE.BoxGeometry(0.18, 0.18, 0.12), glow("#ffffff"), 0, 0.05, -0.22, { cast: false });
		k.box(tx - 2.8, tx + 2.8, tz - 2.8, tz + 2.8);
		// the windsock (the wind's from the west today)
		const [wx, wz] = AIR.windsock;
		add(g, new THREE.CylinderGeometry(0.06, 0.08, 6, 8), mat("#d8d4cc", 0.5, 0.4), wx, 3, wz);
		sock = group(g, wx, 5.85, wz);
		const sockTex = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? "#ffffff" : "#ff7a2f"; c.fillRect(i * w / 5, 0, w / 5, h); } });
		sockTex.rotation = Math.PI / 2; sockTex.center.set(0.5, 0.5);
		const cone = new THREE.ConeGeometry(0.45, 2.6, 16, 1, true);
		cone.rotateZ(-Math.PI / 2);
		add(sock, cone, mat("#ffffff", 0.8, 0, { map: sockTex, side: THREE.DoubleSide }), 1.3, 0, 0, { cast: false });
		add(sock, new THREE.TorusGeometry(0.45, 0.03, 6, 20), mat("#d8d4cc", 0.5, 0.4), 0, 0, 0, { ry: Math.PI / 2, cast: false });
		k.box(wx - 0.15, wx + 0.15, wz - 0.15, wz + 0.15);
	}

	// ================================================================ the parachute target, the signs
	{
		const [px, pz] = AIR.target;
		const rings = [[10, "#ff7aa2"], [8, "#ffffff"], [6, "#ff7aa2"], [4, "#ffffff"], [2, "#ff7aa2"], [0.8, "#ffffff"]];
		rings.forEach(([r, c], i) => add(g, new THREE.CircleGeometry(r, 48), mat(c, 0.9), px, PATH_Y + 0.004 + i * 0.002, pz, { rx: -Math.PI / 2, cast: false }));
		const board = (x, z, ry, w, h, draw, post) => {
			const sg = group(g, x, 0, z, ry);
			for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) add(sg, new THREE.CylinderGeometry(0.06, 0.07, post + h / 2, 8), mat("#4a3a30", 0.8), sx, (post + h / 2) / 2, -0.06);
			add(sg, rbox(w + 0.15, h + 0.15, 0.08, 0.03), mat("#4a3a30", 0.8), 0, post, -0.06);
			add(sg, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(Math.round(w * 110), Math.round(h * 110), draw), toneMapped: false }), 0, post, 0, { cast: false, receive: false });
			const [ax, az] = toWorld(x, z, ry, w / 2, 0), [bx, bz] = toWorld(x, z, ry, -w / 2, 0);
			k.box(Math.min(ax, bx) - 0.15, Math.max(ax, bx) + 0.15, Math.min(az, bz) - 0.15, Math.max(az, bz) + 0.15);
		};
		const lines = (c, w, h, title, rows, col) => {
			c.fillStyle = "#fdf7ec"; c.fillRect(0, 0, w, h);
			c.fillStyle = col; c.fillRect(0, 0, w, h * 0.2);
			c.fillStyle = "#ffffff"; c.font = `900 ${Math.round(h * 0.12)}px Nunito, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
			c.fillText(title, w / 2, h * 0.1);
			c.textAlign = "left"; c.fillStyle = "#3b2b40";
			const fs = Math.round(h * 0.066);
			rows.forEach((r, i) => { c.font = `${r[0] === "*" ? 900 : 700} ${fs}px Nunito, sans-serif`; c.fillText(r.replace(/^\*/, ""), w * 0.05, h * 0.27 + i * fs * 1.32); });
		};
		board(px + 12, pz + 4, Math.PI * 0.75, 3.4, 1.7, (c, w, h) => lines(c, w, h, "PARACHUTE TARGET", ["*Jump from a plane (J), then", "open your parachute (Space).", "A / D to steer, W faster, S to slow,", "and land right in the middle!"], "#ff7aa2"), 1.4);
		board(AIR.apron[1] - 6, AIR.apron[3] - 3, Math.PI, 6.4, 3.6, (c, w, h) => lines(c, w, h, "HARMONY AIRFIELD", [
			"*Hop in a plane (click it, or E beside it) - a friend can ride along!",
			"W / S  throttle      Shift  burst of power      Space  brakes",
			"↓  pull up (nose up)     ↑  push down (nose down)     I  swaps them",
			"A / D  bank to turn      G  landing gear      R  smoke trail      C  camera",
			"*Take off down the runway (its long end is west), land gently anywhere:",
			"wings level, not diving, wheels down. Anything else is a crash!",
			"*J  jump out with a parachute      Esc  get out (once you've stopped)"
		], "#4c7bd9"), 1.6);
		board(AIR.road.x + ROAD_W / 2 + 2.2, AIR.road.z1 - 8, 0, 3.6, 1.1, (c, w, h) => {
			c.fillStyle = "#4c7bd9"; c.fillRect(0, 0, w, h);
			c.fillStyle = "#ffffff"; c.font = `900 ${Math.round(h * 0.42)}px Nunito, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
			c.fillText("AIRFIELD  ▼", w / 2, h / 2);
		}, 1.6);
	}

	// ================================================================ a plane's parts
	const metal = mat("#d9dee4", 0.25, 0.85), dark = mat("#26232a", 0.6, 0.3), tyre = mat("#1b1a1e", 0.9), leather = mat("#6b3f2a", 0.7);
	const glass = new THREE.MeshPhysicalMaterial({ color: "#cfe9ff", transparent: true, opacity: 0.28, roughness: 0.04, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
	// a body of revolution along z: [radius, z] from the tail to the nose; sx / sy squash it across / up
	function lathe(prof, sx, sy) {
		const geo = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 28);
		geo.rotateX(Math.PI / 2);
		geo.scale(sx, sy, 1);
		geo.computeVertexNormals();
		return geo;
	}
	// a thin rod from a to b (each [x, y, z])
	const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
	function rod(parent, a, b, r, m) {
		_d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
		const len = _d.length();
		const mesh = add(parent, new THREE.CylinderGeometry(r, r, len, 6), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { cast: false });
		mesh.quaternion.setFromUnitVectors(_up, _d.normalize());
		return mesh;
	}
	// a side profile (along: z, up: y) extruded t thick across the middle (a fin, a rudder)
	function finGeo(pts, t) {
		const s = new THREE.Shape();
		pts.forEach(([zz, y], i) => i ? s.lineTo(zz, y) : s.moveTo(zz, y));
		const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
		geo.translate(0, 0, -t / 2);
		geo.rotateY(-Math.PI / 2);
		geo.computeVertexNormals();
		return geo;
	}
	// a wing's outline seen from above ([x, z] round it), t thick
	function planGeo(pts, t) {
		const s = new THREE.Shape();
		pts.forEach(([x, zz], i) => i ? s.lineTo(x, zz) : s.moveTo(x, zz));
		const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
		geo.rotateX(Math.PI / 2);
		geo.translate(0, t / 2, 0);
		geo.computeVertexNormals();
		return geo;
	}
	const heartTex = canvasTex(128, 128, (c, w, h) => {
		c.fillStyle = "#ffffff"; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill();
		c.fillStyle = "#e2456f"; c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.fill();
		c.fillStyle = "#ffffff";
		c.beginPath(); c.moveTo(64, 100); c.bezierCurveTo(14, 66, 30, 22, 64, 46); c.bezierCurveTo(98, 22, 114, 66, 64, 100); c.fill();
	});
	const regTex = (txt, col) => k.tex.text(txt, { w: 512, h: 128, color: col, font: "900 92px Nunito, 'Segoe UI', sans-serif" });
	function navLights(parent, xL, xR, y, zz, tailY, tailZ) {
		const red = add(parent, new THREE.SphereGeometry(0.08, 10, 8), glow("#ff3b4e"), xL, y, zz, { cast: false });
		const grn = add(parent, new THREE.SphereGeometry(0.08, 10, 8), glow("#3bff7a"), xR, y, zz, { cast: false });
		const strobe = add(parent, new THREE.SphereGeometry(0.1, 10, 8), glow("#ffffff"), 0, tailY, tailZ, { cast: false });
		return { red, grn, strobe };
	}
	function propeller(parent, z, blades, len, bladeM, hubM, hubR) {
		const prop = group(parent, 0, 0, z);
		for (let i = 0; i < blades; i++) {
			const b = group(prop, 0, 0, 0);
			b.rotation.z = i / blades * Math.PI * 2;
			const bl = add(b, rbox(0.15, len, 0.04, 0.02), bladeM, 0, len / 2 + 0.05, 0, { cast: false });
			bl.rotation.y = 0.35;
		}
		add(prop, new THREE.ConeGeometry(hubR, hubR * 2.2, 18), hubM, 0, 0, hubR * 0.6, { rx: Math.PI / 2, cast: false });
		const disc = add(parent, new THREE.CircleGeometry(len + 0.08, 40), new THREE.MeshBasicMaterial({ color: "#e8e2d4", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 0, 0, z + 0.03, { cast: false, receive: false });
		return { prop, disc };
	}

	// Buttercup: an open-cockpit biplane (pilot behind, passenger in front), yellow with cream wings and rose trim
	function makeBiplane(def) {
		const root = group(g, def.x, 0, def.z, def.h);
		const paintM = new THREE.MeshPhysicalMaterial({ color: def.paint, roughness: 0.35, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
		const wingM = mat(def.wing, 0.55), trimM = mat(def.trim, 0.45, 0.1), woodM = mat("#7a4b2a", 0.6);
		const B = group(root, 0, 0, 0);
		add(B, lathe([[0.05, -4.4], [0.2, -3.85], [0.34, -2.9], [0.46, -1.7], [0.52, -0.5], [0.53, 0.7], [0.54, 1.5]], 0.92, 1.0), paintM, 0, 0.02, 0);
		// rose bands round the tail, a rose cowling with the engine's cylinders sticking out of it
		for (const [zz, r] of [[-3.2, 0.32], [-3.55, 0.27]]) add(B, new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.1, 24), trimM, 0, 0.02, zz, { rx: Math.PI / 2, cast: false });
		add(B, new THREE.CylinderGeometry(0.57, 0.53, 0.72, 28, 1, true), trimM, 0, 0.02, 1.86, { rx: Math.PI / 2 });
		add(B, new THREE.CircleGeometry(0.55, 28), dark, 0, 0.02, 2.2, { cast: false });
		for (let i = 0; i < 7; i++) {
			const a = i / 7 * Math.PI * 2, cyl = add(B, new THREE.CylinderGeometry(0.07, 0.085, 0.26, 10), metal, Math.cos(a) * 0.42, 0.02 + Math.sin(a) * 0.42, 2.12, { cast: false });
			cyl.rotation.z = a - Math.PI / 2;
		}
		const { prop, disc } = propeller(B, 2.3, 2, 1.0, woodM, trimM, 0.15);
		// the wings: the lower one through the bottom of the fuselage, the upper one up on struts, a little forward
		add(B, rbox(8.6, 0.12, 1.3, 0.05), wingM, 0, -0.42, 0.25);
		add(B, rbox(9.2, 0.12, 1.3, 0.05), wingM, 0, 1.12, 0.6);
		for (const sx of [-1, 1]) {
			add(B, new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: heartTex, transparent: true, toneMapped: false }), sx * 3.0, 1.19, 0.6, { rx: -Math.PI / 2, cast: false, receive: false });
			add(B, new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: heartTex, transparent: true, toneMapped: false }), sx * 2.9, -0.49, 0.25, { rx: Math.PI / 2, cast: false, receive: false });
			add(B, rbox(0.3, 0.13, 1.32, 0.05), trimM, sx * 4.47, 1.12, 0.6, { cast: false });
		}
		const ails = [-1, 1].map(sx => { const a = group(B, sx * 3.3, 1.12, -0.05); add(a, rbox(2.3, 0.07, 0.36, 0.03), trimM, 0, 0, -0.17, { cast: false }); return a; });
		// struts (wood) and the bracing wires
		for (const sx of [-1, 1]) {
			for (const zz of [0.12, 0.92]) rod(B, [sx * 0.32, 0.45, zz], [sx * 0.34, 1.07, zz + 0.25], 0.03, metal);
			for (const zz of [-0.05, 0.75]) rod(B, [sx * 3.3, -0.36, zz], [sx * 3.3, 1.06, zz + 0.32], 0.045, woodM);
		}
		const wires = [];
		for (const sx of [-1, 1]) wires.push(sx * 0.4, -0.36, 0.5, sx * 3.25, 1.06, 0.85, sx * 0.4, 1.06, 0.85, sx * 3.25, -0.36, 0.5);
		const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
		B.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: "#3a3640" })));
		// the tail: the tailplane and its elevator, the fin and its rudder (rose, striped)
		add(B, rbox(3.2, 0.07, 0.8, 0.03), wingM, 0, 0.12, -3.75);
		const elev = group(B, 0, 0.12, -4.15);
		add(elev, rbox(3.0, 0.05, 0.42, 0.02), trimM, 0, 0, -0.2, { cast: false });
		add(B, finGeo([[-3.5, 0.2], [-3.95, 1.2], [-4.3, 1.28], [-4.32, 0.2]], 0.07), wingM, 0, 0, 0);
		const rud = group(B, 0, 0.75, -4.32);
		add(rud, rbox(0.06, 1.1, 0.42, 0.02), trimM, 0, 0, -0.2, { cast: false });
		// the cockpits: leather rims and little windscreens
		for (const zz of [-1.35, -0.05]) {
			const rim = add(B, new THREE.TorusGeometry(0.34, 0.05, 8, 24), leather, 0, 0.5, zz, { rx: Math.PI / 2, cast: false });
			rim.scale.set(1, 1.35, 1);
			add(B, new THREE.PlaneGeometry(0.5, 0.24), glass, 0, 0.62, zz + 0.52, { rx: -0.45, cast: false, receive: false });
		}
		// the landing gear: two V legs to the main wheels, and a little tail wheel
		for (const sx of [-1, 1]) {
			rod(B, [sx * 0.25, -0.42, 0.85], [sx * 0.88, -1.02, 0.62], 0.035, metal);
			rod(B, [sx * 0.25, -0.42, 0.25], [sx * 0.88, -1.02, 0.62], 0.035, metal);
			add(B, new THREE.CylinderGeometry(0.35, 0.35, 0.17, 24), tyre, sx * 0.92, -1.02, 0.62, { rz: Math.PI / 2 });
			add(B, new THREE.CylinderGeometry(0.17, 0.17, 0.19, 16), trimM, sx * 0.92, -1.02, 0.62, { rz: Math.PI / 2, cast: false });
		}
		rod(B, [-0.88, -1.02, 0.62], [0.88, -1.02, 0.62], 0.025, metal);
		rod(B, [0, -0.12, -4.0], [0, -0.47, -4.12], 0.03, metal);
		add(B, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), tyre, 0, -0.47, -4.12, { rz: Math.PI / 2, cast: false });
		// its name down both sides
		for (const sx of [-1, 1]) add(B, new THREE.PlaneGeometry(1.25, 0.31), new THREE.MeshBasicMaterial({ map: regTex(def.reg, "#3b2b40"), transparent: true, toneMapped: false }), sx * 0.42, 0.05, -2.45, { ry: sx * Math.PI / 2, cast: false, receive: false });
		const nav = navLights(B, 4.62, -4.62, 1.12, 0.6, 1.33, -4.25);
		return { root, B, prop, disc, ails, elev, rud, nav, legs: null, paints: [paintM, wingM, trimM, woodM] };
	}

	// Bluebird: a low-wing sport plane (two side by side under a bubble canopy), blue and white, the gear folds away
	function makeSport(def) {
		const root = group(g, def.x, 0, def.z, def.h);
		const paintM = new THREE.MeshPhysicalMaterial({ color: def.paint, roughness: 0.28, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });
		const wingM = new THREE.MeshPhysicalMaterial({ color: def.wing, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
		const redM = mat("#e2456f", 0.4, 0.1);
		const B = group(root, 0, 0, 0);
		add(B, lathe([[0.07, -4.55], [0.28, -3.7], [0.48, -2.3], [0.62, -1.0], [0.67, 0.2], [0.63, 1.3], [0.52, 2.2], [0.38, 2.78]], 0.95, 0.88), paintM, 0, 0, 0);
		// a white cheat line and red trim
		for (const [zz, r] of [[-1.6, 0.6], [-1.9, 0.57]]) add(B, new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.12, 28), wingM, 0, 0, zz, { rx: Math.PI / 2, cast: false });
		const { prop, disc } = propeller(B, 2.85, 3, 0.95, dark, redM, 0.33);
		// the canopy over the two seats, and the panel in front of them
		const can = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
		add(B, can, glass, 0, 0.42, -0.3, { cast: false, receive: false }).scale.set(0.6, 0.58, 1.3);
		add(B, new THREE.TorusGeometry(0.6, 0.025, 6, 24, Math.PI), metal, 0, 0.42, 0.25, { cast: false }).scale.set(1, 0.95, 1);
		add(B, rbox(0.9, 0.2, 0.2, 0.05), dark, 0, 0.42, 0.55, { cast: false });
		// the wing (tapered, white with blue tips), its ailerons, the landing light in its leading edge
		add(B, planGeo([[-4.9, 0.5], [0, 0.98], [4.9, 0.5], [4.9, -0.42], [0, -0.85], [-4.9, -0.42]], 0.14), wingM, 0, -0.38, 0);
		for (const sx of [-1, 1]) add(B, rbox(0.1, 0.32, 0.95, 0.04), paintM, sx * 4.92, -0.33, 0.04, { cast: false });
		const ails = [-1, 1].map(sx => { const a = group(B, sx * 3.7, -0.36, -0.52); add(a, rbox(1.7, 0.06, 0.3, 0.02), wingM, 0, 0, -0.14, { cast: false }); return a; });
		const landM = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6d8", emissiveIntensity: 0, roughness: 0.1 });
		add(B, new THREE.SphereGeometry(0.09, 12, 8), landM, 1.9, -0.36, 0.78, { cast: false }).scale.set(1, 0.6, 0.6);
		// the tail
		add(B, planGeo([[-1.8, -3.55], [1.8, -3.55], [1.65, -4.2], [-1.65, -4.2]], 0.07), wingM, 0, 0.1, 0);
		const elev = group(B, 0, 0.13, -4.2);
		add(elev, rbox(3.2, 0.05, 0.38, 0.02), paintM, 0, 0, -0.18, { cast: false });
		add(B, finGeo([[-3.3, 0.25], [-4.05, 1.5], [-4.42, 1.52], [-4.42, 0.25]], 0.08), paintM, 0, 0, 0);
		const rud = group(B, 0, 0.88, -4.42);
		add(rud, rbox(0.07, 1.2, 0.36, 0.02), wingM, 0, 0, -0.17, { cast: false });
		add(rud, rbox(0.08, 0.3, 0.37, 0.02), redM, 0, 0.42, -0.17, { cast: false });
		// the landing gear: a nose wheel (folds back) and two main wheels (fold in under the wing)
		const legs = [];
		const wheel = (parent, y) => {
			add(parent, new THREE.CylinderGeometry(0.28, 0.28, 0.14, 22), tyre, 0, y, 0, { rz: Math.PI / 2 });
			add(parent, new THREE.CylinderGeometry(0.13, 0.13, 0.16, 14), metal, 0, y, 0, { rz: Math.PI / 2, cast: false });
		};
		{
			const nose = group(B, 0, -0.45, 2.0);
			add(nose, new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), metal, 0, -0.16, 0, { cast: false });
			wheel(nose, -0.3);
			legs.push({ g: nose, axis: "x", up: 1.45 });
			for (const sx of [-1, 1]) {
				const m = group(B, sx * 1.3, -0.42, -0.2);
				add(m, new THREE.CylinderGeometry(0.04, 0.04, 0.36, 8), metal, 0, -0.18, 0, { cast: false });
				wheel(m, -0.35);
				legs.push({ g: m, axis: "z", up: -sx * 1.5 });
			}
		}
		for (const sx of [-1, 1]) add(B, new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({ map: regTex(def.reg, "#ffffff"), transparent: true, toneMapped: false }), sx * 0.47, 0.06, -2.6, { ry: sx * Math.PI / 2, cast: false, receive: false });
		const nav = navLights(B, 4.98, -4.98, -0.3, 0.45, 1.56, -4.3);
		return { root, B, prop, disc, ails, elev, rud, nav, legs, landM, paints: [paintM, wingM, redM] };
	}

	// ================================================================ the planes, and their shared state
	const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
	const planes = DEFS.map((def, i) => {
		const m = def.kind === "bi" ? makeBiplane(def) : makeSport(def);
		const shadow = add(g, new THREE.PlaneGeometry(def.span * 2.1, 9.5), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.7 }), def.x, PATH_Y + 0.02, def.z, { rx: -Math.PI / 2, cast: false, receive: false });
		shadow.renderOrder = 1;
		const orig = m.paints.map(p => p.color.clone());
		return Object.assign(m, {
			i, def, key: "plane:" + def.id, pkey: "planep:" + def.id, shadow, orig,
			x: def.x, y: def.gearH, z: def.z, h: def.h, p: def.rest, r: 0, v: 0, vy: 0, thr: 0,
			ground: true, gear: 1, gearK: 1, belly: false, smoke: false, boosting: false, stall: false, edge: false,
			ctrlP: 0, ctrlB: 0, rpm: 0, propA: 0, net: null, sendT: 0, saveT: 0, smokeT: 0, fireT: 0,
			wrecked: false, wreckSeen: 0, staleT: 0, snd: null
		});
	});
	const home = pl => ({ d: "", st: "park", x: pl.def.x, y: 0, z: pl.def.z, h: pl.def.h, p: pl.def.rest, r: 0, b: 0 });
	function stateOf(pl) {
		const s = ctx.get(pl.key);
		const o = s && typeof s === "object" && isFinite(+s.x) && isFinite(+s.z) ? s : home(pl);
		const sp = ctx.get(pl.pkey);
		return {
			d: typeof o.d === "string" ? o.d : "", st: ["park", "fly", "ghost", "wreck"].includes(o.st) ? o.st : "park",
			x: +o.x, y: isFinite(+o.y) ? +o.y : 0, z: +o.z, h: isFinite(+o.h) ? +o.h : pl.def.h, p: isFinite(+o.p) ? +o.p : 0, r: isFinite(+o.r) ? +o.r : 0, b: !!o.b,
			p2: sp && typeof sp === "object" && typeof sp.p === "string" ? sp.p : ""
		};
	}
	const peerOf = id => (id ? ctx.peers().get(id) : null) || null;
	const fix = (n, d) => +(+n).toFixed(d);
	// (the plane's key: only ever written by whoever flies it - or flew it last)
	function setPlane(pl, st, patch) {
		ctx.setShared(pl.key, Object.assign({ d: st === "park" ? "" : ctx.MY_ID, st, x: fix(pl.x, 2), y: fix(pl.y, 2), z: fix(pl.z, 2), h: fix(pl.h, 3), p: fix(pl.p, 3), r: fix(pl.r, 3), b: pl.belly ? 1 : 0 }, patch || {}));
	}
	function setRide(pl, id) { ctx.setShared(pl.pkey, { p: id }); }
	const fresh = pl => !!pl.net && nowS() - pl.net.at < 1.6;

	// who's in the pilot's seat / the passenger's seat right now (someone here, sitting in it - not a stale name)
	let K = null;   // { pl } while I fly a plane
	let P = null;   // { pl } while I ride in one
	let SK = null;  // me, skydiving
	const ghosts = new Set();   // planes I jumped out of, still flying (I fly them on till they come down)
	const mine = () => (K ? K.pl : P ? P.pl : null);
	function pilotOf(pl) {
		const s = stateOf(pl);
		if (s.st !== "fly" || !s.d) return "";
		if (s.d === ctx.MY_ID) return K && K.pl === pl ? s.d : "";
		const p = peerOf(s.d);
		return p && p.upper === "fly" ? s.d : "";
	}
	function passengerOf(pl) {
		const s = stateOf(pl), id = s.p2;
		if (!id) return "";
		if (id === ctx.MY_ID) return P && P.pl === pl ? id : "";
		const p = peerOf(id);
		return p && p.upper === "flypass" && Math.hypot(p.tx - pl.x, p.tz - pl.z) < 15 ? id : "";
	}
	// is somebody (here) flying it, or flying it on after jumping out?
	function controlled(pl) {
		const s = stateOf(pl);
		if (s.st !== "fly" && s.st !== "ghost") return false;
		if (s.d === ctx.MY_ID) return (K && K.pl === pl) || ghosts.has(pl);
		return !!peerOf(s.d);
	}

	// ================================================================ effects: smoke, fire, explosions, bits flying about
	const fx = group(g, 0, 0, 0);
	const puffs = [];   // { s: sprite, t, life, size, grow, op, vx, vy, vz, add }
	const MAX_PUFFS = 260;
	function puff(x, y, z, o) {
		let P = puffs.find(q => q.t >= q.life && q.add === !!o.add);
		if (!P) {
			if (puffs.length >= MAX_PUFFS) {
				// (all in use: the one nearest the end of its life makes way)
				let best = -1;
				for (const q of puffs) if (q.add === !!o.add && q.t / q.life > best) { best = q.t / q.life; P = q; }
				if (!P) return;
			} else {
				const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false, toneMapped: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
				fx.add(s);
				P = { s, add: !!o.add };
				puffs.push(P);
			}
		}
		Object.assign(P, { t: 0, life: o.life || 2, size: o.size || 1, grow: o.grow || 1, op: o.op === undefined ? 0.8 : o.op, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, drag: o.drag || 0.6 });
		P.s.material.color.set(o.color || "#ffffff");
		P.s.position.set(x, y, z);
		P.s.visible = true;
		P.s.scale.setScalar(P.size);
	}
	const debris = [];
	const debrisGeo = new THREE.BoxGeometry(0.35, 0.08, 0.55);
	function bits(x, y, z, col) {
		for (let i = 0; i < 12; i++) {
			let d = debris.find(q => q.t >= q.life);
			if (!d) { if (debris.length >= 36) break; d = { m: add(fx, debrisGeo, mat("#2a2624", 0.8), 0, 0, 0, { cast: false }) }; debris.push(d); }
			const a = R() * Math.PI * 2, sp = 6 + R() * 12;
			Object.assign(d, { t: 0, life: 5 + R() * 2, vx: Math.cos(a) * sp, vy: 5 + R() * 11, vz: Math.sin(a) * sp, sx: (R() - 0.5) * 14, sy: (R() - 0.5) * 14 });
			d.m.material.color.set(i % 3 ? "#2a2624" : col);
			d.m.position.set(x, y + 0.5, z);
			d.m.visible = true;
		}
	}
	function explode(x, y, z, col, loud) {
		puff(x, y + 1, z, { add: true, color: "#fff4c8", size: 6, grow: 3, life: 0.35, op: 1 });
		for (let i = 0; i < 12; i++) puff(x + (R() - 0.5) * 3, y + 0.5 + R() * 2, z + (R() - 0.5) * 3, { add: true, color: R() < 0.5 ? "#ffb347" : "#ff5a1f", size: 2.5 + R() * 2.5, grow: 1.6, life: 0.7 + R() * 0.7, op: 0.95, vx: (R() - 0.5) * 8, vy: 3 + R() * 6, vz: (R() - 0.5) * 8 });
		for (let i = 0; i < 14; i++) puff(x + (R() - 0.5) * 4, y + 1 + R() * 2, z + (R() - 0.5) * 4, { color: R() < 0.5 ? "#3a3433" : "#5a5250", size: 3 + R() * 2, grow: 2.5, life: 4 + R() * 3, op: 0.7, vx: (R() - 0.5) * 3, vy: 2 + R() * 3, vz: (R() - 0.5) * 3 });
		bits(x, y, z, col);
		// the bang (fainter the further off it is)
		const m = ctx.myAvatar().root.position, dist = Math.hypot(m.x - x, m.y - y, m.z - z), vol = loud ? 1 : Math.max(0, 1 - dist / 260);
		if (vol > 0.03) { ctx.sfx("thunder", vol); ctx.sfx("crash", vol * 0.8); ctx.sfx("bump", vol); }
	}
	function poof(x, z) {
		for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; puff(x + Math.cos(a) * 3, 0.8, z + Math.sin(a) * 3, { color: "#fff6fb", size: 1.8, grow: 1.8, life: 1.3, op: 0.85, vx: Math.cos(a) * 3, vy: 1.2, vz: Math.sin(a) * 3 }); }
		const m = ctx.myAvatar().root.position;
		if (Math.hypot(m.x - x, m.z - z) < 60) ctx.sfx("pop", 0.6);
	}
	function tickFx(dt) {
		for (const P of puffs) {
			if (P.t >= P.life) continue;
			P.t += dt;
			if (P.t >= P.life) { P.s.visible = false; continue; }
			const u = P.t / P.life, dr = Math.max(0, 1 - P.drag * dt);
			P.vx *= dr; P.vz *= dr; P.vy *= P.add ? dr : 1;
			P.s.position.x += P.vx * dt; P.s.position.y += P.vy * dt; P.s.position.z += P.vz * dt;
			P.s.scale.setScalar(P.size * (1 + P.grow * u));
			P.s.material.opacity = P.op * Math.pow(1 - u, 1.4) * Math.min(1, P.t * 12);
		}
		for (const d of debris) {
			if (d.t >= d.life) continue;
			d.t += dt;
			if (d.t >= d.life) { d.m.visible = false; continue; }
			d.vy -= G * dt;
			const p = d.m.position;
			p.x += d.vx * dt; p.y += d.vy * dt; p.z += d.vz * dt;
			const gy = floorAt(p.x, p.z) + 0.05;
			if (p.y < gy) { p.y = gy; d.vy = Math.abs(d.vy) > 2 ? -d.vy * 0.3 : 0; d.vx *= 0.5; d.vz *= 0.5; d.sx *= 0.4; d.sy *= 0.4; }
			d.m.rotation.x += d.sx * dt; d.m.rotation.y += d.sy * dt;
		}
	}

	// ================================================================ the parachutes (one for each skydiver)
	const CHUTE_COLS = ["#ff7aa2", "#ffb86b", "#ffe66b", "#7ae582", "#7cc8ff", "#b18cff"];
	const chuteTexes = CHUTE_COLS.map((_, o) => canvasTex(256, 64, (c, w, h) => {
		for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : CHUTE_COLS[(i / 2 + o) % CHUTE_COLS.length]; c.fillRect(i * w / 8, 0, w / 8, h); }
	}));
	const chuteGeo = (() => {
		const geo = new THREE.BoxGeometry(4.6, 0.34, 1.8, 16, 1, 2);
		const pos = geo.attributes.position;
		for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setY(i, pos.getY(i) - x * x * 0.1 + (pos.getZ(i) > 0 ? 0.06 : 0)); }
		geo.computeVertexNormals();
		return geo;
	})();
	const lineGeo = (() => {
		const pts = [];
		for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) for (const zz of [-0.7, 0.7]) pts.push(0, 0, 0, x, 2.15 - x * x * 0.1, zz);
		const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
		return geo;
	})();
	const chutes = new Map();   // person id -> { grp, openK }
	function chuteFor(id) {
		let c = chutes.get(id);
		if (c) return c;
		let hsh = 0; for (const ch of String(id)) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
		const grp = group(g, 0, 0, 0);
		grp.rotation.order = "YXZ";
		add(grp, chuteGeo, mat("#ffffff", 0.7, 0, { map: chuteTexes[Math.abs(hsh) % chuteTexes.length], side: THREE.DoubleSide }), 0, 2.32, 0, { cast: false });
		grp.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: "#e8e4ee", transparent: true, opacity: 0.75 })));
		grp.visible = false;
		c = { grp, openK: 0 };
		chutes.set(id, c);
		return c;
	}
	// the body: flat on its belly in freefall, hanging under the canopy once it's open
	function poseSkydiver(av, id, x, y, z, h, open, roll, dt) {
		const c = chuteFor(id);
		c.openK = open ? Math.min(1, c.openK + dt / 1.2) : 0;
		av.root.position.set(x, y, z);
		av.root.rotation.order = "YXZ";
		if (open) av.root.rotation.set(Math.sin(performance.now() / 1000 * 1.7) * 0.05, h, roll);
		else av.root.rotation.set(1.3, h, roll);
		av.root.visible = true;
		c.grp.visible = open;
		if (open) {
			const u = c.openK, s = u < 1 ? Math.max(0.05, 1 + 1.4 * Math.pow(u - 1, 3) + 0.4 * Math.pow(u - 1, 2)) : 1;
			c.grp.position.set(x, y + 1.45, z);
			c.grp.rotation.set(0, h, roll * 0.6);
			c.grp.scale.set(s, Math.min(1, u * 1.6), s);
		}
	}
	function hideChute(id) { const c = chutes.get(id); if (c) { c.grp.visible = false; c.openK = 0; } }

	// ================================================================ engine, wind, warning beeps (WebAudio)
	function engineSnd(pl, vol, rpm) {
		const a = ctx.audio();
		if (!a || !a.ctx) return;
		if (!pl.snd) {
			if (vol <= 0.001) return;
			const ac = a.ctx;
			const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), gn = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
			o1.type = "sawtooth"; o2.type = pl.def.kind === "bi" ? "square" : "triangle";
			lp.type = "lowpass"; lp.Q.value = 1.5;
			gn.gain.value = 0; lg.gain.value = 0;
			o1.connect(lp); o2.connect(lp); lp.connect(gn); gn.connect(a.master);
			lfo.connect(lg); lg.connect(gn.gain);
			o1.start(); o2.start(); lfo.start();
			pl.snd = { o1, o2, lp, gn, lfo, lg, ac };
		}
		const S = pl.snd, t = S.ac.currentTime, v = ctx.muted() ? 0 : vol;
		const f = (pl.def.kind === "bi" ? 36 : 52) + rpm * (pl.def.kind === "bi" ? 48 : 75);
		S.o1.frequency.setTargetAtTime(f, t, 0.08);
		S.o2.frequency.setTargetAtTime(f * (pl.def.kind === "bi" ? 0.5 : 2.01), t, 0.08);
		S.lp.frequency.setTargetAtTime(420 + rpm * 1400, t, 0.1);
		S.lfo.frequency.setTargetAtTime(9 + rpm * 26, t, 0.1);
		S.gn.gain.setTargetAtTime(v, t, 0.15);
		S.lg.gain.setTargetAtTime(v * 0.45, t, 0.15);
	}
	let wind = null;
	function windSnd(vol) {
		const a = ctx.audio();
		if (!a || !a.ctx) return;
		if (!wind) {
			if (vol <= 0.001) return;
			const ac = a.ctx, buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
			const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
			const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.6;
			const gn = ac.createGain(); gn.gain.value = 0;
			src.connect(bp); bp.connect(gn); gn.connect(a.master); src.start();
			wind = { gn, bp, ac };
		}
		const t = wind.ac.currentTime;
		wind.gn.gain.setTargetAtTime(ctx.muted() ? 0 : vol, t, 0.2);
		wind.bp.frequency.setTargetAtTime(500 + vol * 9000, t, 0.3);
	}
	let beepT = 0;

	// ================================================================ the flight HUD (and the parachute's)
	if (!document.getElementById("flyhud-css")) {
		const st = document.createElement("style");
		st.id = "flyhud-css";
		st.textContent = `
#flyhud { position: fixed; left: 50%; top: calc(max(14px, env(safe-area-inset-top)) + 56px); transform: translateX(-50%); z-index: 9; padding: 9px 16px 8px; display: flex; flex-direction: column; align-items: center; gap: 5px; pointer-events: none; color: var(--text, #f6f0ff); font-family: Nunito, "Segoe UI", sans-serif; max-width: calc(100vw - 32px); box-sizing: border-box; }
#flyhud.off { display: none; }
#flyhud .fh-top { font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: var(--accent, #ff7aa2); }
#flyhud .fh-stats { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; justify-content: center; }
#flyhud .fh-s { display: flex; flex-direction: column; align-items: center; min-width: 52px; }
#flyhud .fh-s b { font: 900 21px/1.05 Nunito, "Segoe UI", sans-serif; font-variant-numeric: tabular-nums; }
#flyhud .fh-s span { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--muted, #b9adc9); text-transform: uppercase; }
#flyhud .fh-bar { width: 74px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.13); overflow: hidden; margin: 6px 0 3px; }
#flyhud .fh-bar i { display: block; height: 100%; width: 0; border-radius: 4px; background: linear-gradient(90deg, #7ae582, #ffb86b, #ff7aa2); }
#flyhud .fh-msg { font-size: 13.5px; font-weight: 900; text-align: center; }
#flyhud .fh-msg:empty { display: none; }
#flyhud .fh-msg.warn { color: #ff6b81; animation: fhblink .55s steps(2) infinite; }
#flyhud .fh-msg.good { color: #7ae582; }
#flyhud .fh-keys { font-size: 11px; font-weight: 700; color: var(--muted, #b9adc9); text-align: center; line-height: 1.45; }
#flyhud .fh-keys kbd { font: 900 10px Nunito, sans-serif; background: rgba(255,255,255,.14); border-radius: 4px; padding: 0 4px; color: var(--text, #f6f0ff); }
body.touch #flyhud .fh-keys { display: none; }
@keyframes fhblink { 50% { opacity: .35; } }
@media (max-width: 560px) { #flyhud { top: calc(max(10px, env(safe-area-inset-top)) + 50px); padding: 6px 10px; } #flyhud .fh-stats { gap: 10px; } #flyhud .fh-s b { font-size: 16px; } #flyhud .fh-s { min-width: 42px; } }
@media (prefers-reduced-motion: reduce) { #flyhud .fh-msg.warn { animation: none; } }`;
		document.head.appendChild(st);
	}
	const hud = document.getElementById("flyhud") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "flyhud", className: "chip off" }));
	hud.innerHTML = `<div class="fh-top"></div><div class="fh-stats"></div><div class="fh-msg" aria-live="polite"></div><div class="fh-keys"></div>`;
	const hudEls = { top: hud.querySelector(".fh-top"), stats: hud.querySelector(".fh-stats"), msg: hud.querySelector(".fh-msg"), keys: hud.querySelector(".fh-keys") };
	let hudMode = "", flashMsg = null;
	function flash(text, cls, secs) { flashMsg = { text, cls: cls || "good", until: nowS() + (secs || 3.5) }; }
	const stat = (v, l) => `<div class="fh-s"><b>${v}</b><span>${l}</span></div>`;
	function setMsg(text, cls) {
		if (flashMsg && nowS() < flashMsg.until) { text = flashMsg.text; cls = flashMsg.cls; }
		if (hudEls.msg.textContent !== text) hudEls.msg.textContent = text;
		const c = "fh-msg" + (cls ? " " + cls : "");
		if (hudEls.msg.className !== c) hudEls.msg.className = c;
	}
	function setKeys(mode, html) { if (hudMode !== mode) { hudMode = mode; hudEls.keys.innerHTML = html; } }
	function hudOff() { if (!hud.classList.contains("off")) hud.classList.add("off"); hudMode = ""; }
	let hudT = 0;
	function hudPlane(pl, asPilot) {
		hud.classList.remove("off");
		if (nowS() - hudT < 0.08) return;
		hudT = nowS();
		const agl = Math.max(0, pl.y - floorAt(pl.x, pl.z) - (pl.belly ? pl.def.bellyH : pl.def.gearH));
		hudEls.top.textContent = pl.def.name + (asPilot ? "" : " - passenger");
		hudEls.stats.innerHTML = stat(Math.round(pl.v * 3.6), "km/h") + stat(Math.round(agl), "alt m") + stat((pl.vy >= 0 ? "+" : "") + pl.vy.toFixed(1), "climb m/s")
			+ (asPilot ? `<div class="fh-s"><div class="fh-bar"><i style="width:${Math.round(pl.thr * 100)}%"></i></div><span>${pl.boosting ? "boost!" : "throttle " + Math.round(pl.thr * 100) + "%"}</span></div>` : "")
			+ (pl.def.retract ? stat(pl.gear ? "DOWN" : "UP", "gear") : "");
		let m = "", cls = "";
		if (!asPilot) m = pl.ground ? "Esc to get out" : stateOf(pl).st === "ghost" ? "Your pilot jumped out! Press J to jump too!" : "J to jump out with a parachute";
		else if (pl.ground) {
			if (pl.belly) m = pl.v < 0.5 ? "On your belly - G puts the wheels back down" : "Scraping along on your belly!";
			else if (pl.thr < 0.05 && pl.v < 0.5) m = "W to open the throttle - steer with A / D";
			else if (pl.v > pl.def.fly * 0.92) { m = "Pull up! Press ↓ to take off"; cls = "good"; }
			else if (pl.v > 1) m = "Faster down the runway... (Shift for more)";
		} else {
			const sink = -pl.vy;
			if (pl.stall) { m = "STALL! Nose down (↑) and more throttle"; cls = "warn"; }
			else if (agl < 45 && sink > 9 && pl.p < -0.15) { m = "PULL UP! (↓)"; cls = "warn"; }
			else if (pl.edge) { m = "That's the edge of the grounds - turning back"; cls = "warn"; }
			else if (pl.def.retract && !pl.gear && agl < 30 && sink > 1) { m = "Gear's up! Press G before you land"; cls = "warn"; }
			else if (agl < 25 && sink > 0.5) m = sink > 5.5 ? "Too fast a descent to land - ease back (↓)" : "Wings level, gentle... nice and easy";
			else if (pl.y > CEIL - 25) m = "The air's too thin up here";
		}
		setMsg(m, cls);
		if (asPilot) setKeys("plane", `<kbd>W</kbd>/<kbd>S</kbd> throttle · <kbd>↓</kbd> nose up · <kbd>↑</kbd> nose down${inv ? " (swapped: I)" : ""} · <kbd>A</kbd>/<kbd>D</kbd> bank · <kbd>Shift</kbd> boost · <kbd>Space</kbd> brakes${pl.def.retract ? " · <kbd>G</kbd> gear" : ""} · <kbd>R</kbd> smoke · <kbd>C</kbd> camera · <kbd>J</kbd> jump · <kbd>Esc</kbd> get out`);
		else setKeys("pass", `<kbd>J</kbd> jump out with a parachute · <kbd>Esc</kbd> get out (on the ground)`);
	}
	function hudSky(S) {
		hud.classList.remove("off");
		if (nowS() - hudT < 0.08) return;
		hudT = nowS();
		const agl = Math.max(0, S.y - floorAt(S.x, S.z)), td = Math.hypot(S.x - AIR.target[0], S.z - AIR.target[1]);
		hudEls.top.textContent = S.open ? "Parachute" : "Freefall!";
		hudEls.stats.innerHTML = stat(Math.round(agl), "alt m") + stat(Math.round(-S.vy * 3.6), "fall km/h") + stat(td < 999 ? Math.round(td) + "m" : "-", "target");
		setMsg(S.open ? (agl < 12 ? "Flare! Hold S to land softly" : "Steer to the pink target - A / D turn, W faster, S slower") : agl < 90 ? "Open your parachute! (Space)" : "Space opens your parachute", S.open ? "" : agl < 90 ? "warn" : "");
		setKeys(S.open ? "chute" : "fall", S.open ? `<kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>W</kbd> faster · <kbd>S</kbd> flare (slow down)` : `<kbd>Space</kbd> open parachute · <kbd>A</kbd>/<kbd>D</kbd> turn · <kbd>W</kbd> glide forward`);
	}

	// ================================================================ crash checks: trees, the coaster, buildings, other planes
	const CELL = 12, hash = new Map();
	const hkey = (i, j) => i * 100003 + j;
	function hashAdd(x, z, rad, o) {
		for (let i = Math.floor((x - rad) / CELL); i <= Math.floor((x + rad) / CELL); i++)
			for (let j = Math.floor((z - rad) / CELL); j <= Math.floor((z + rad) / CELL); j++) {
				const key = hkey(i, j), l = hash.get(key);
				if (l) l.push(o); else hash.set(key, [o]);
			}
	}
	for (const [x, z, kind, sz] of k.trees || []) {
		const r = kind ? 1.2 * sz : 1.75 * sz, top = kind ? 6.6 * sz : 5.6 * sz;
		hashAdd(x, z, r + 2.5, { t: 0, x, z, r, top });
	}
	for (const p of track || []) hashAdd(p.x, p.z, 3, { t: 1, x: p.x, y: p.y, z: p.z });
	function hitWhat(pl) {
		const { x, y, z } = pl;
		if (y < 40) {
			for (const b of BLOCKS) if (x > b[0] - 2 && x < b[1] + 2 && z > b[2] - 2 && z < b[3] + 2 && y - 0.7 < b[4]) return b[5];
			const l = hash.get(hkey(Math.floor(x / CELL), Math.floor(z / CELL)));
			if (l) for (const o of l) {
				if (o.t === 0) { if (y - 0.8 < o.top && Math.hypot(o.x - x, o.z - z) < o.r * 0.75 + 1.8) return "Flew into a tree!"; }
				else if (Math.hypot(o.x - x, o.y - y, o.z - z) < 2.8) return "Flew into the roller coaster!";
			}
		}
		for (const o of planes) {
			if (o === pl || o.wrecked) continue;
			if (Math.hypot(o.x - x, o.y - y, o.z - z) < 4.6) return o.ground ? `Flew into ${o.def.name} on the ground!` : `Mid-air collision with ${o.def.name}!`;
		}
		return null;
	}
	// on the ground: can it roll to (x, z) facing h? (the wheels, the nose, the tail and the wingtips all clear)
	function fitsGround(pl, x, z, h) {
		const D = pl.def;
		if (!ctx.canDrive(x, z, 0.8)) return false;
		for (const [lx, lz] of [[0, D.nose], [0, D.tail], [D.span * 0.95, 0.2], [-D.span * 0.95, 0.2]]) {
			const [px, pz] = toWorld(x, z, h, lx, lz);
			if (!ctx.canDrive(px, pz, 0.3)) return false;
		}
		for (const o of planes) {
			if (o === pl || !o.ground) continue;
			const d = Math.hypot(o.x - x, o.z - z);
			if (d < 9.5 && d < Math.hypot(o.x - pl.x, o.z - pl.z)) return false;
		}
		return true;
	}

	// ================================================================ the flight model (my plane, and the ones I jumped out of)
	function sim(pl, dt, inp) {
		const D = pl.def;
		pl.thr = clamp(pl.thr + (inp.thr || 0) * dt * 0.7, 0, 1);
		const boost = !!inp.boost && pl.thr > 0.3 && !pl.belly;
		pl.boosting = boost;
		const top = boost ? D.boost : D.top, A = D.acc * (boost ? 1.45 : 1);
		const kd = A / (top * top) * (D.retract && pl.gear ? 1.12 : 1);
		pl.ctrlP = inp.pitch; pl.ctrlB = inp.bank;
		const gy = floorAt(pl.x, pl.z);
		if (pl.ground) rollOn(pl, dt, inp, A, kd, gy);
		else flyOn(pl, dt, inp, A, kd, gy);
	}
	function rollOn(pl, dt, inp, A, kd, gy) {
		const D = pl.def;
		let v = pl.v;
		let a = A * pl.thr - kd * v * v - (pl.belly ? 6 : 0.45);
		if (inp.brake) a -= 7;
		v = Math.max(0, v + a * dt);
		// the tail comes up as it picks up speed (a taildragger); pull back, fast enough, and the nose lifts
		const lift = clamp((v - 0.35 * D.fly) / (0.3 * D.fly), 0, 1);
		let tp = D.rest * (1 - lift);
		if (inp.pitch > 0.1 && v > 0.75 * D.fly && !pl.belly) tp += inp.pitch * 0.24;
		pl.p += (tp - pl.p) * Math.min(1, dt * 4);
		pl.r += (0 - pl.r) * Math.min(1, dt * 6);
		// steering: the nose wheel when slow (it'll even turn on the spot), the rudder when fast
		const sr = v < 14 ? 0.8 * Math.min(1, 0.45 + v / 6) : 0.32;
		const nh = wrap(pl.h - inp.bank * sr * dt);
		const steps = Math.max(1, Math.ceil(v * dt / 0.8)), sdt = dt / steps;
		for (let n = 0; n < steps; n++) {
			const hh = wrap(pl.h + wrap(nh - pl.h) / (steps - n));
			const nx = pl.x + Math.sin(hh) * v * sdt, nz = pl.z + Math.cos(hh) * v * sdt;
			if (fitsGround(pl, nx, nz, hh)) { pl.x = nx; pl.z = nz; pl.h = hh; continue; }
			if (fitsGround(pl, pl.x, pl.z, hh)) pl.h = hh;
			if (v > 9) { pl.v = v; crash(pl, "Ran into something on the ground!"); return; }
			if (v > 1.5 && K && K.pl === pl) { ctx.sfx("thunk", 0.5); ctx.sfx("bump", 0.4); }
			v = 0;
			break;
		}
		pl.v = v;
		pl.y = gy + (pl.belly ? D.bellyH : D.gearH);
		pl.vy = 0;
		// off the ground
		if (!pl.belly && v >= D.fly * 0.95 && inp.pitch > 0.1 && pl.p > D.rest * (1 - lift) + 0.05) {
			pl.ground = false;
			pl.vy = v * Math.sin(pl.p);
			if (K && K.pl === pl) { ctx.sfx("whoosh", 0.5); flash("You're flying! Climb gently, bank with A / D to turn", "good", 4); }
		}
	}
	function flyOn(pl, dt, inp, A, kd, gy) {
		const D = pl.def;
		let v = pl.v, bank = inp.bank;
		const pitch = inp.pitch;
		const L = clamp((v - D.stall) / (D.fly - D.stall), 0, 1);
		const auth = clamp(v / D.fly, 0.3, 1.25);
		// near the hedge: it banks round, back toward the middle of the grounds
		pl.edge = false;
		if (pl.x < ESTATE[0] + EDGE || pl.x > ESTATE[1] - EDGE || pl.z < ESTATE[2] + EDGE || pl.z > ESTATE[3] - EDGE) {
			const cx = (ESTATE[0] + ESTATE[1]) / 2, cz = (ESTATE[2] + ESTATE[3]) / 2;
			if (Math.sin(pl.h) * (cx - pl.x) + Math.cos(pl.h) * (cz - pl.z) < 0) {
				bank = clamp(-wrap(Math.atan2(cx - pl.x, cz - pl.z) - pl.h) * 2, -1, 1);
				pl.edge = true;
			}
		}
		// roll toward the bank asked for (let go and the wings level out again)
		pl.r += (bank * D.maxBank - pl.r) * Math.min(1, dt * D.roll);
		// the stick: nose up / down (less of it banked right over, or slow)
		pl.p += pitch * D.pitchRate * auth * (0.35 + 0.65 * Math.cos(pl.r)) * dt;
		// too slow and it stalls: the nose drops and it sinks
		if (L < 1) pl.p += (-0.5 - pl.p) * dt * 1.8 * (1 - L);
		// up at the ceiling the air's too thin: the nose comes down
		if (pl.y > CEIL - 20) pl.p = Math.min(pl.p, lerp(pl.p, -0.1, clamp((pl.y - CEIL + 20) / 20, 0, 1) * dt * 3));
		pl.p = clamp(pl.p, -1.35, 1.3);
		// banked over, it turns (pulling back tightens the turn)
		const tight = 1 + Math.max(0, pitch) * 0.7 * Math.abs(Math.sin(pl.r));
		pl.h = wrap(pl.h - G * Math.tan(pl.r) / Math.max(v, 10) * dt * (0.35 + 0.65 * L) * tight);
		// speed: the engine, the drag, and gravity along the way it points (diving speeds it up, climbing slows it)
		v = Math.max(0, v + (A * pl.thr - kd * v * v - G * Math.sin(pl.p) * 0.85 - 0.15) * dt);
		pl.v = v;
		const vy = v * Math.sin(pl.p) * (0.3 + 0.7 * L) - (1 - L) * 10;
		pl.vy = vy;
		const cp = Math.cos(pl.p);
		pl.x += Math.sin(pl.h) * cp * v * dt; pl.z += Math.cos(pl.h) * cp * v * dt; pl.y = Math.min(CEIL, pl.y + vy * dt);
		pl.x = clamp(pl.x, ESTATE[0] + HEDGE_IN + 3, ESTATE[1] - HEDGE_IN - 3);
		pl.z = clamp(pl.z, ESTATE[2] + HEDGE_IN + 3, ESTATE[3] - HEDGE_IN - 3);
		pl.stall = L < 0.55;
		const hit = hitWhat(pl);
		if (hit) { crash(pl, hit); return; }
		// down onto the ground: a landing - or a crash
		if (pl.y - (pl.gear || !D.retract ? D.gearH : D.bellyH) <= gy) touchdown(pl, gy);
	}
	function touchdown(pl, gy) {
		const D = pl.def, sink = -pl.vy, wheels = pl.gear || !D.retract, me = K && K.pl === pl;
		const level = Math.abs(pl.r) < 0.42 && pl.p > -0.24 && pl.p < 0.55;
		const room = ctx.canDrive(pl.x, pl.z, 1.4);
		if (sink < 6 && level && room && (wheels || pl.v < 34)) {
			pl.ground = true; pl.belly = !wheels; pl.vy = 0; pl.r *= 0.3;
			pl.y = gy + (wheels ? D.gearH : D.bellyH);
			if (!wheels) pl.v *= 0.55;
			if (me) {
				ctx.sfx("thunk", 0.7); ctx.sfx("bump", Math.min(0.8, 0.2 + sink * 0.1));
				const onRunway = pl.x > AIR.runway.x0 && pl.x < AIR.runway.x1 && Math.abs(pl.z - AIR.runway.z) < AIR.runway.hw;
				if (!wheels) flash("Belly landing! Scraped, but in one piece.", "good", 5);
				else flash((sink < 1.5 ? "Butter-smooth landing!" : sink < 3.5 ? "Nice landing!" : "Bumpy landing - but you made it!") + (onRunway ? " Welcome to Harmony Airfield." : ""), "good", 5);
				if (sink < 1.5 && onRunway) ctx.sfx("yes", 0.5);
			}
			setPlane(pl, me ? "fly" : "ghost");
			return;
		}
		crash(pl, !room ? "There was no room to land there!" : !wheels ? "Belly-flopped in far too fast - the wheels were up!" : sink >= 6 ? "Came down much too hard!" : "Hit the ground at a crazy angle!");
	}

	// a crash: a fireball, a burning wreck where it came down, and whoever was in it crawls out beside it
	function crash(pl, why) {
		const gy = floorAt(pl.x, pl.z), ey = pl.y, wasMe = !!(K && K.pl === pl);
		ghosts.delete(pl);
		pl.v = 0; pl.thr = 0; pl.smoke = false; pl.ground = true; pl.vy = 0;
		pl.y = gy + pl.def.bellyH * 0.45;
		pl.p = clamp(pl.p * 0.4, -0.3, 0.12); pl.r = clamp(pl.r * 0.5 + (R() < 0.5 ? -0.35 : 0.35), -0.6, 0.6);
		pl.x = clamp(pl.x, ESTATE[0] + 4, ESTATE[1] - 4); pl.z = clamp(pl.z, ESTATE[2] + 4, ESTATE[3] - 4);
		setPlane(pl, "wreck");
		ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "pcrash", i: pl.i, x: fix(pl.x, 2), y: fix(ey, 2), z: fix(pl.z, 2), why: String(why).slice(0, 80) });
		explode(pl.x, ey, pl.z, pl.def.paint, wasMe);
		pl.wreckSeen = nowS();
		if (wasMe) { K = null; crawlOut(pl, why, true); }
	}
	function crawlOut(pl, why, pilot) {
		const m = ctx.me();
		m.upper = null; m.anim = "idle"; m.speed = 0; m.sit = null;
		const spot = freeSpot(pl.x, pl.z, 6);
		m.x = spot[0]; m.z = spot[1]; m.h = Math.atan2(pl.x - m.x, pl.z - m.z);
		hudOff();
		if (ctx.doUpper) ctx.doUpper("stumble", 2200);
		ctx.notice(`<b>Crash!</b> ${ctx.esc(why)} You crawl out of the wreck - a bit singed, but fine. <b>${pl.def.name}</b> will be back at the hangar in a moment.${pilot ? "" : " (Next time, jump!)"}`);
		document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 700);
		ctx.sendPose(true);
	}
	// somewhere free to stand near (x, z), out on the open grounds
	function freeSpot(x, z, r0) {
		if (r0 === 0 && ctx.canDrive(x, z, 0.4)) return [x, z];
		for (let r = Math.max(1, r0); r < 60; r += 1.5) for (let i = 0; i < 16; i++) {
			const a = i / 16 * Math.PI * 2 + r * 0.37, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
			if (ctx.canDrive(px, pz, 0.4)) return [px, pz];
		}
		return [AIR.target[0], AIR.target[1] + 12];
	}
	function respawn(pl, quiet) {
		pl.wrecked = false; pl.wreckSeen = 0; pl.belly = false; pl.gear = 1; pl.ground = true; pl.v = 0; pl.thr = 0; pl.smoke = false; pl.net = null;
		pl.x = pl.def.x; pl.z = pl.def.z; pl.h = pl.def.h; pl.p = pl.def.rest; pl.r = 0; pl.y = floorAt(pl.x, pl.z) + pl.def.gearH;
		ctx.setShared(pl.key, home(pl));
		if (!quiet) { ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "pspawn", i: pl.i }); poof(pl.def.x, pl.def.z); }
	}

	// ================================================================ getting in and out, jumping out
	function getIn(pl, asPass) {
		const m = ctx.me();
		if (m.carrying || m.carriedBy) { ctx.notice("You can't climb in while carrying someone (or being carried)!"); return; }
		if (SK) return;
		if (K || P) leave(true);
		if (m.sit) ctx.standUp(true);
		m.target = null; if (m.path) m.path = [];
		m.anim = "sit"; m.sit = null; m.upperUntil = 0; m.speed = 0;
		if (asPass) {
			P = { pl, warned: false };
			m.upper = "flypass";
			setRide(pl, ctx.MY_ID);
			const d = peerOf(pilotOf(pl));
			ctx.notice(d ? `You climb in with <b>${ctx.esc(d.look.name)}</b>. Hold on tight! <b>J</b> jumps out with a parachute once you're up high.` : `You sit in ${pl.def.name}'s passenger seat - wait for a pilot! <b>Esc</b> to get out.`);
		} else {
			K = { pl };
			const s = stateOf(pl);
			pl.belly = s.b; pl.gear = s.b ? 0 : 1; pl.ground = true; pl.v = 0; pl.thr = 0; pl.smoke = false; pl.net = null; pl.wrecked = false;
			pl.y = floorAt(pl.x, pl.z) + (pl.belly ? pl.def.bellyH : pl.def.gearH); pl.p = pl.belly ? 0 : pl.def.rest; pl.r = 0;
			m.upper = "fly";
			setPlane(pl, "fly");
			ctx.notice(`You climb into <b>${pl.def.name}</b>'s cockpit. <b>W</b> opens the throttle, <b>A/D</b> steer; at speed press <b>↓</b> to lift off (<b>↑</b> pushes the nose down). <b>J</b> jumps out with a parachute up high. The sign by the hangar has all the controls.`);
		}
		ctx.sfx("door", 0.45);
		poseRoot(pl);
		seatMe(pl);
		ctx.sendPose(true);
	}
	// out of a plane on the ground: beside your door (or wherever there's room)
	function leave(quiet) {
		const pl = mine();
		if (!pl) return;
		const m = ctx.me(), wasPilot = !!K;
		if (wasPilot) { K = null; pl.v = 0; pl.thr = 0; pl.smoke = false; if (stateOf(pl).d === ctx.MY_ID) setPlane(pl, "park"); }
		else { P = null; if (stateOf(pl).p2 === ctx.MY_ID) setRide(pl, ""); }
		const D = pl.def, st = wasPilot ? D.stands.pilot : D.stands.pass;
		const tries = [st, [-st[0], st[1]], [0, D.nose + 2.2], [0, D.tail - 1.8], [D.span + 1.2, -0.5], [-D.span - 1.2, -0.5]];
		let spot = null;
		for (const [lx, lz] of tries) { const p = toWorld(pl.x, pl.z, pl.h, lx, lz); if (ctx.canDrive(p[0], p[1], 0.35) && !inPlanes(p[0], p[1], 0.3)) { spot = p; break; } }
		spot = spot || freeSpot(pl.x, pl.z, 6);
		m.x = spot[0]; m.z = spot[1]; m.h = pl.h + Math.PI / 2;
		m.anim = "idle"; m.speed = 0;
		if (m.upper === "fly" || m.upper === "flypass") m.upper = null;
		hudOff();
		ctx.sendPose(true);
		if (!quiet) ctx.sfx("door", 0.4);
	}
	function bail() {
		const pl = mine();
		if (!pl) return;
		if (pl.ground) { exitPlane(); return; }
		const agl = pl.y - floorAt(pl.x, pl.z);
		if (agl < 10) { ctx.notice("Too low to jump - land first, or climb higher!"); return; }
		const m = ctx.me(), w = seatWorld(pl, K ? "pilot" : "pass");
		const cp = Math.cos(pl.p);
		if (K) {
			K = null;
			ghosts.add(pl);
			pl.ghostBank = clamp(pl.ctrlB * 0.3 + (R() - 0.5) * 0.5, -0.6, 0.6);
			pl.smoke = false;
			setPlane(pl, "ghost");
			if (passengerOf(pl)) ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "pbail", i: pl.i });
		} else {
			if (stateOf(pl).p2 === ctx.MY_ID) setRide(pl, "");
			P = null;
		}
		// out over the side, with the plane's speed (it soon falls away behind)
		const side = (R() < 0.5 ? -1 : 1) * 2.2;
		SK = {
			x: w.x + Math.cos(pl.h) * side, y: w.y + 0.6, z: w.z - Math.sin(pl.h) * side, h: pl.h,
			vx: Math.sin(pl.h) * cp * pl.v * 0.8, vy: Math.max(pl.vy, 0) + 2, vz: Math.cos(pl.h) * cp * pl.v * 0.8,
			open: false, roll: 0, t: 0, sendT: 0, poseT: 0
		};
		m.upper = "freefall"; m.anim = "idle"; m.sit = null; m.speed = 0;
		ctx.sfx("whoosh", 0.8);
		flash("Geronimo! Space opens your parachute", "good", 3);
		ctx.sendPose(true);
	}
	function exitPlane() {
		const pl = mine();
		if (!pl) return;
		if (!pl.ground) { bail(); return; }
		if (K && pl.v > 1.5) { ctx.notice("Stop first! (<b>Space</b> brakes, <b>S</b> closes the throttle)"); return; }
		leave(false);
	}
	function toggleGear() {
		if (!K || !K.pl.def.retract) return;
		const pl = K.pl;
		if (pl.ground && !pl.belly) { ctx.notice("Not on the ground - you'd sit down on your belly!"); return; }
		if (pl.ground && pl.belly) {
			if (pl.v > 0.5) { ctx.notice("Stop first, then put the wheels down."); return; }
			pl.belly = false; pl.gear = 1; pl.p = pl.def.rest; ctx.sfx("clack", 0.6); setPlane(pl, "fly"); return;
		}
		pl.gear = pl.gear ? 0 : 1;
		ctx.sfx("clack", 0.6);
		flash(pl.gear ? "Gear down" : "Gear up - faster, but remember it before you land!", "good", 2.5);
	}
	function toggleSmoke() { if (!K) return; K.pl.smoke = !K.pl.smoke; ctx.sfx("steam", 0.3); }
	function thrStep(d) { if (K) K.pl.thr = clamp(Math.round((K.pl.thr + d) * 4) / 4, 0, 1); }

	// where a seat is, in the world (the plane's root must be posed)
	function seatWorld(pl, which) { pl.root.updateMatrixWorld(true); return pl.root.localToWorld(_v.set(...pl.def.seats[which])); }
	function seatAvatar(av, pl, which) {
		const w = seatWorld(pl, which);
		av.root.position.copy(w);
		pl.root.getWorldQuaternion(_q);
		av.root.quaternion.copy(_q);
		av.root.visible = true;
		return w;
	}
	function seatMe(pl) {
		const m = ctx.me(), w = seatWorld(pl, K && K.pl === pl ? "pilot" : "pass");
		m.x = w.x; m.z = w.z; m.h = pl.h;
	}
	function poseRoot(pl) {
		pl.root.position.set(pl.x, pl.y, pl.z);
		pl.root.rotation.order = "YXZ";
		pl.root.rotation.set(-pl.p, pl.h, pl.r);
	}

	// ================================================================ flying it (my plane): the keys and the joystick
	let inv = false, camFar = false;
	try { inv = localStorage.getItem("harmonyPlaneInvert") === "1"; } catch (e) { /* (no storage: the default) */ }
	let prevKeys = new Set();
	const pressed = (keys, k2) => keys.has(k2) && !prevKeys.has(k2);
	function commonKeys(keys) {
		if (pressed(keys, "i")) { inv = !inv; try { localStorage.setItem("harmonyPlaneInvert", inv ? "1" : "0"); } catch (e) { /* (fine) */ } flash(inv ? "Stick swapped: ↑ nose up, ↓ nose down" : "Stick: ↓ nose up, ↑ nose down", "good", 2.5); hudMode = ""; }
		if (pressed(keys, "c")) camFar = !camFar;
	}
	function planeDrive(dt, inp) {
		if (!K) return;
		const pl = K.pl, m = ctx.me(), s = stateOf(pl);
		if (m.upper !== "fly" || m.sit || s.d !== ctx.MY_ID || s.st === "wreck") { K = null; leave(true); return; }
		dt = Math.min(0.05, dt);
		const keys = inp.keys || new Set();
		commonKeys(keys);
		if (pressed(keys, "j")) { prevKeys = new Set(keys); bail(); return; }
		const kb = (a, b) => keys.has(a) || keys.has(b);
		const kbZ = (kb("w", "arrowup") ? 1 : 0) - (kb("s", "arrowdown") ? 1 : 0);
		const joyZ = clamp((+inp.z || 0) - kbZ, -1, 1);
		let pitch = (keys.has("arrowdown") ? 1 : 0) - (keys.has("arrowup") ? 1 : 0) - joyZ;
		if (inv) pitch = -pitch;
		const bank = clamp(+inp.x || 0, -1, 1);
		const thr = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
		prevKeys = new Set(keys);
		sim(pl, dt, { pitch: clamp(pitch, -1, 1), bank, thr, brake: keys.has(" "), boost: keys.has("shift") });
		if (!K) return;   // (crashed)
		poseRoot(pl);
		seatMe(pl);
		m.anim = "sit"; m.speed = 0;
		hudPlane(pl, true);
	}
	function riderDrive(dt, inp) {
		if (!P) return;
		const pl = P.pl, m = ctx.me(), s = stateOf(pl);
		if (s.st === "wreck") { P = null; setRide(pl, ""); crawlOut(pl, "Your plane crashed!", false); return; }
		if (m.upper !== "flypass" || m.sit || s.p2 !== ctx.MY_ID) { leave(true); return; }
		const keys = inp.keys || new Set();
		commonKeys(keys);
		if (pressed(keys, "j")) { prevKeys = new Set(keys); bail(); return; }
		prevKeys = new Set(keys);
		if (s.st === "ghost" && !P.warned) { P.warned = true; ctx.notice("Your pilot jumped out! Press <b>J</b> to jump too!"); }
		seatMe(pl);
		m.anim = "sit"; m.speed = 0;
		hudPlane(pl, false);
	}

	// ================================================================ skydiving (me)
	function openChute(auto) {
		if (!SK || SK.open) return;
		SK.open = true;
		const m = ctx.me();
		m.upper = "chute";
		ctx.sfx("whoosh", 0.7); ctx.sfx("pop", 0.5);
		if (auto) ctx.notice("Your parachute opened by itself - that was low! Steer with <b>A/D</b>, aim for the pink target.");
		ctx.sendPose(true);
	}
	function skyDrive(dt, inp) {
		if (!SK) return;
		const S = SK, m = ctx.me();
		dt = Math.min(0.05, dt);
		const keys = inp.keys || new Set();
		commonKeys(keys);
		if (pressed(keys, " ") || pressed(keys, "j")) openChute(false);
		prevKeys = new Set(keys);
		const fwd = clamp(+inp.z || 0, -1, 1), turn = clamp(+inp.x || 0, -1, 1);
		const gy = floorAt(S.x, S.z);
		if (!S.open && S.y - gy < 45) openChute(true);
		S.t += dt;
		if (!S.open) {
			// freefall: falling ever faster (till the air holds you at about 140 km/h), the plane's speed fading
			S.vy -= G * dt; S.vy -= S.vy * Math.abs(S.vy) * 0.0068 * dt;
			S.h = wrap(S.h - turn * 1.8 * dt);
			const want = 3 + Math.max(0, fwd) * 9, kk = Math.min(1, dt * 0.7);
			S.vx += (Math.sin(S.h) * want - S.vx) * kk; S.vz += (Math.cos(S.h) * want - S.vz) * kk;
			S.roll += (-turn * 0.45 - S.roll) * Math.min(1, dt * 4);
		} else {
			// under the canopy: a gentle glide; W dives faster, S flares (slow down to land softly)
			const tvy = fwd > 0.2 ? -6.5 : fwd < -0.2 ? -2.2 : -4.3, sp = fwd > 0.2 ? 9 : fwd < -0.2 ? 2.5 : 6;
			S.vy += (tvy - S.vy) * Math.min(1, dt * 2);
			S.h = wrap(S.h - turn * (fwd > 0.2 ? 1.2 : 0.85) * dt);
			const kk = Math.min(1, dt * 1.2);
			S.vx += (Math.sin(S.h) * sp - S.vx) * kk; S.vz += (Math.cos(S.h) * sp - S.vz) * kk;
			S.roll += (turn * 0.3 - S.roll) * Math.min(1, dt * 3);
		}
		S.x = clamp(S.x + S.vx * dt, ESTATE[0] + HEDGE_IN + 2, ESTATE[1] - HEDGE_IN - 2);
		S.z = clamp(S.z + S.vz * dt, ESTATE[2] + HEDGE_IN + 2, ESTATE[3] - HEDGE_IN - 2);
		S.y += S.vy * dt;
		if (S.y <= gy) { landChute(); return; }
		m.x = S.x; m.z = S.z; m.h = S.h; m.anim = "idle"; m.speed = 0; m.sit = null;
		m.upper = S.open ? "chute" : "freefall";
		// where I am: to everyone, ten times a second (and the pose now and then)
		S.sendT -= dt; S.poseT -= dt;
		if (S.sendT <= 0) { S.sendT = 0.1; ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "sd", x: fix(S.x, 2), y: fix(S.y, 2), z: fix(S.z, 2), h: fix(S.h, 3), vx: fix(S.vx, 2), vy: fix(S.vy, 2), vz: fix(S.vz, 2), o: S.open ? 1 : 0, rl: fix(S.roll, 2) }); }
		if (S.poseT <= 0) { S.poseT = 0.3; ctx.sendPose(true); }
		hudSky(S);
	}
	function landChute() {
		const S = SK, m = ctx.me();
		SK = null;
		hideChute(ctx.MY_ID);
		const [x, z] = freeSpot(S.x, S.z, 0);
		m.x = x; m.z = z; m.h = S.h; m.anim = "idle"; m.upper = null; m.speed = 0;
		hudOff();
		const hard = !S.open || S.vy < -6;
		ctx.sfx("thunk", 0.6);
		if (hard && ctx.doUpper) ctx.doUpper("stumble", 1800);
		const td = Math.hypot(x - AIR.target[0], z - AIR.target[1]);
		let msg = hard ? "Oof - a hard landing! (S flares the parachute to slow you down.)" : "A soft landing - well done!";
		if (td < 1.2) { msg = "<b>BULLSEYE!</b> Right in the middle of the target!"; ctx.sfx("yes", 0.7); ctx.sfx("applause", 0.6); }
		else if (td < 10) { msg += ` You landed on the target, <b>${td.toFixed(1)} m</b> from the middle!`; ctx.sfx("applause", 0.4); }
		else if (td < 60) msg += ` <b>${Math.round(td)} m</b> from the target.`;
		ctx.notice(msg);
		ctx.sendPose(true);
	}

	// the vehicles (world.js drives them: the keys / joystick go to them instead of walking, the camera follows)
	const pilotVeh = {
		label: "Esc to get out", air: true,
		get camY() { return K ? K.pl.y + 1.5 : undefined; },
		get cam() { const pl = K && K.pl; if (!pl) return { dist: 6, pitch: 0.35 }; return { dist: (pl.def.camDist + Math.min(4, pl.v * 0.07)) * (camFar ? 1.6 : 1), pitch: pl.ground ? 0.2 : clamp(0.17 - pl.p * 0.45, 0.06, 0.8) }; },
		get fov() { return 55 + Math.min(14, (K ? K.pl.v : 0) * 0.22); },
		drive: planeDrive,
		exit: exitPlane
	};
	const riderVeh = {
		label: "Esc to get out", air: true,
		get camY() { return P ? P.pl.y + 1.5 : undefined; },
		get cam() { const pl = P && P.pl; if (!pl) return { dist: 6, pitch: 0.35 }; return { dist: (pl.def.camDist + Math.min(4, pl.v * 0.07)) * (camFar ? 1.6 : 1), pitch: pl.ground ? 0.22 : clamp(0.2 - pl.p * 0.45, 0.06, 0.8) }; },
		get fov() { return 55 + Math.min(14, (P ? P.pl.v : 0) * 0.22); },
		drive: riderDrive,
		exit: exitPlane
	};
	const skyVeh = {
		label: "Skydiving", air: true,
		get camY() { return SK ? SK.y + (SK.open ? 1.8 : 0.5) : undefined; },
		get cam() { return SK && SK.open ? { dist: 8.5 * (camFar ? 1.5 : 1), pitch: 0.22 } : { dist: 6.5 * (camFar ? 1.5 : 1), pitch: 0.55 }; },
		get fov() { return SK && !SK.open ? 68 : 58; },
		drive: skyDrive,
		exit: () => { if (SK && !SK.open) openChute(false); else ctx.notice("You're hanging under a parachute - steer down to the ground!"); }
	};

	// ================================================================ everyone else's planes (predicted between messages)
	function follow(pl, n, dt) {
		const ahead = Math.min(0.3, nowS() - n.at);
		const px = n.x + n.vx * ahead, py = n.y + n.vy * ahead, pz = n.z + n.vz * ahead, ph = n.h + n.w * ahead;
		if (Math.hypot(px - pl.x, py - pl.y, pz - pl.z) > 25) { pl.x = px; pl.y = py; pl.z = pz; pl.h = ph; pl.p = n.p; pl.r = n.r; }
		else {
			const kk = Math.min(1, dt * 10);
			pl.x += (px - pl.x) * kk; pl.y += (py - pl.y) * kk; pl.z += (pz - pl.z) * kk;
			pl.h = wrap(pl.h + wrap(ph - pl.h) * kk); pl.p += (n.p - pl.p) * kk; pl.r += (n.r - pl.r) * kk;
		}
		pl.v = n.v; pl.vy = n.vy; pl.thr = n.th; pl.gear = n.g; pl.ground = !!n.gd; pl.smoke = !!n.sm; pl.belly = !!n.b;
		pl.ctrlP += (n.cp - pl.ctrlP) * Math.min(1, dt * 8); pl.ctrlB += (n.cb - pl.ctrlB) * Math.min(1, dt * 8);
	}
	function onPlaneMsg(d) {
		const pl = planes[d.i | 0];
		if (!pl || d.id === ctx.MY_ID || (K && K.pl === pl) || ghosts.has(pl)) return;
		for (const f of ["x", "y", "z", "h", "p", "r", "v"]) if (!isFinite(+d[f])) return;
		const t = nowS();
		let n = pl.net;
		if (!n || n.from !== d.id || t - n.at > 2) n = pl.net = { from: d.id, x: +d.x, y: +d.y, z: +d.z, h: +d.h, at: t, vx: 0, vy: 0, vz: 0, w: 0 };
		else {
			const el = Math.max(0.03, t - n.at);
			n.vx += (clamp((d.x - n.x) / el, -90, 90) - n.vx) * 0.6;
			n.vy += (clamp((d.y - n.y) / el, -60, 60) - n.vy) * 0.6;
			n.vz += (clamp((d.z - n.z) / el, -90, 90) - n.vz) * 0.6;
			n.w += (clamp(wrap(d.h - n.h) / el, -4, 4) - n.w) * 0.6;
			n.x = +d.x; n.y = +d.y; n.z = +d.z; n.h = +d.h; n.at = t;
		}
		Object.assign(n, { p: +d.p, r: +d.r, v: +d.v, th: +d.th || 0, g: d.g ? 1 : 0, gd: d.gd ? 1 : 0, sm: d.sm ? 1 : 0, b: d.b ? 1 : 0, cp: +d.cp || 0, cb: +d.cb || 0 });
	}
	const skyNet = new Map();   // skydiver id -> their last message
	function onSkyMsg(d) {
		if (d.id === ctx.MY_ID) return;
		for (const f of ["x", "y", "z", "h"]) if (!isFinite(+d[f])) return;
		skyNet.set(d.id, { x: +d.x, y: +d.y, z: +d.z, h: +d.h, vx: +d.vx || 0, vy: +d.vy || 0, vz: +d.vz || 0, o: !!d.o, rl: +d.rl || 0, at: nowS() });
	}

	// ================================================================ every frame
	let healT = 0, beaconA = 0;
	function update(dt, t) {
		dt = Math.min(0.05, dt);
		const m = ctx.me();
		// a stale state: "flying" (or skydiving) with nothing to fly
		if (!K && !P && !SK && ["fly", "flypass", "freefall", "chute"].includes(m.upper)) { m.upper = null; if (m.anim === "sit" && !m.sit) m.anim = "idle"; ctx.sendPose(true); hudOff(); }
		if (!K && !P && !SK) hudOff();
		// the planes I jumped out of fly on, alone (gently nosing down, turning a little), till they come down
		for (const pl of [...ghosts]) {
			sim(pl, dt, { pitch: -0.12, bank: pl.ghostBank || 0, thr: 0, brake: pl.ground, boost: false });
			if (ghosts.has(pl) && pl.ground && pl.v < 0.3) { ghosts.delete(pl); setPlane(pl, "park"); }
		}
		// where my planes are: to everyone, ~15 times a second (twice a second, parked), and saved every few seconds
		for (const pl of planes) {
			if (!((K && K.pl === pl) || ghosts.has(pl))) continue;
			pl.sendT -= dt; pl.saveT -= dt;
			if (pl.sendT <= 0) {
				pl.sendT = pl.ground && pl.v < 0.2 ? 0.5 : SEND;
				ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "pl", i: pl.i, x: fix(pl.x, 2), y: fix(pl.y, 2), z: fix(pl.z, 2), h: fix(pl.h, 3), p: fix(pl.p, 3), r: fix(pl.r, 3), v: fix(pl.v, 1), th: fix(pl.thr, 2), g: pl.gear ? 1 : 0, gd: pl.ground ? 1 : 0, sm: pl.smoke ? 1 : 0, b: pl.belly ? 1 : 0, cp: fix(pl.ctrlP, 2), cb: fix(pl.ctrlB, 2) });
			}
			if (pl.saveT <= 0) { pl.saveT = 3; setPlane(pl, ghosts.has(pl) ? "ghost" : "fly"); }
		}
		// the airfield's own bits: the tower's beacon, the windsock
		beaconA += dt * 2.4; beacon.rotation.y = beaconA;
		sock.rotation.y = Math.sin(t * 0.7) * 0.18 + Math.sin(t * 2.3) * 0.05;
		sock.rotation.z = -0.12 + Math.sin(t * 1.3) * 0.06;
		tickFx(dt);
		// wrecks: back home after a while (whoever crashed it brings it back; anyone, if they've gone)
		const tn = nowS();
		for (const pl of planes) {
			const s = stateOf(pl);
			if (s.st === "wreck") {
				if (!pl.wreckSeen) pl.wreckSeen = tn;
				const age = tn - pl.wreckSeen;
				if ((s.d === ctx.MY_ID && age > 11) || (age > 22 && !peerOf(s.d)) || age > 32) respawn(pl);
			} else pl.wreckSeen = 0;
		}
		if ((healT -= dt) > 0) return;
		healT = 1.5;
		for (const pl of planes) {
			const s = stateOf(pl);
			// my name on a plane I'm not in (I reloaded, or my "I got out" was lost)
			if (s.d === ctx.MY_ID && (s.st === "fly" || s.st === "ghost") && !(K && K.pl === pl) && !ghosts.has(pl)) {
				if (s.y - floorAt(s.x, s.z) > pl.def.gearH + 1.5) respawn(pl, false); else setPlane(pl, "park", { x: s.x, y: s.y, z: s.z, h: s.h, p: s.p, r: s.r });
			}
			if (s.p2 === ctx.MY_ID && !(P && P.pl === pl)) setRide(pl, "");
			// someone flying it has gone (closed the tab mid-flight): after a few seconds, it's put away
			if ((s.st === "fly" || s.st === "ghost") && s.d && s.d !== ctx.MY_ID && !peerOf(s.d) && !fresh(pl)) {
				pl.staleT += 1.5;
				if (pl.staleT > 6) { pl.staleT = 0; respawn(pl, false); }
			} else pl.staleT = 0;
		}
	}

	function lateUpdate(dt, t) {
		dt = Math.min(0.05, dt);
		const me = ctx.me(), tn = nowS(), lp = ctx.myAvatar().root.position;
		for (const pl of planes) {
			const s = stateOf(pl), D = pl.def;
			const ctl = (K && K.pl === pl) || ghosts.has(pl);
			let running = ctl;
			if (ctl) { /* sim() moved it */ }
			else if (fresh(pl) && (s.st === "fly" || s.st === "ghost")) { follow(pl, pl.net, dt); running = true; }
			else {
				// at rest where the state says: parked, a wreck, or someone's plane we haven't heard from in a while
				const gy = floorAt(s.x, s.z);
				const ty = s.st === "wreck" ? gy + D.bellyH * 0.45 : s.st === "park" ? gy + (s.b ? D.bellyH : D.gearH) : s.y;
				const tp = s.st === "park" ? (s.b ? 0 : D.rest) : s.p, tr = s.st === "park" ? 0 : s.r;
				if (Math.hypot(s.x - pl.x, s.z - pl.z) > 8 || pl.wrecked !== (s.st === "wreck")) { pl.x = s.x; pl.y = ty; pl.z = s.z; pl.h = s.h; pl.p = tp; pl.r = tr; }
				else { const kk = Math.min(1, dt * 4); pl.x += (s.x - pl.x) * kk; pl.y += (ty - pl.y) * kk; pl.z += (s.z - pl.z) * kk; pl.h = wrap(pl.h + wrap(s.h - pl.h) * kk); pl.p += (tp - pl.p) * kk; pl.r += (tr - pl.r) * kk; }
				pl.v = 0; pl.vy = 0; pl.thr = 0; pl.smoke = false; pl.ground = true; pl.belly = s.b; pl.gear = s.b ? 0 : 1;
				pl.ctrlP *= 0.9; pl.ctrlB *= 0.9;
			}
			// a wreck: charred, the propeller stopped, still burning
			const wreck = s.st === "wreck";
			if (wreck !== pl.wrecked) {
				pl.wrecked = wreck;
				pl.paints.forEach((m, i) => { m.color.copy(wreck ? new THREE.Color("#2b2624") : pl.orig[i]); });
				if (!wreck) { pl.x = s.x; pl.z = s.z; }
			}
			poseRoot(pl);
			// the propeller, the control surfaces, the gear
			const rpm = running && !wreck ? 0.3 + pl.thr * 0.7 : 0;
			pl.rpm += (rpm - pl.rpm) * Math.min(1, dt * (rpm > pl.rpm ? 2.5 : 0.8));
			pl.propA += pl.rpm * 70 * dt;
			pl.prop.rotation.z = pl.propA;
			pl.disc.material.opacity = clamp((pl.rpm - 0.25) * 0.6, 0, 0.32);
			pl.disc.visible = pl.disc.material.opacity > 0.01;
			pl.ails[0].rotation.x = pl.ctrlB * 0.35; pl.ails[1].rotation.x = -pl.ctrlB * 0.35;
			pl.elev.rotation.x = -pl.ctrlP * 0.32;
			pl.rud.rotation.y = pl.ctrlB * 0.3;
			if (D.retract) pl.gearK += ((pl.gear && !pl.belly ? 1 : 0) - pl.gearK) * Math.min(1, dt * 1.6);
			if (pl.legs) for (const l of pl.legs) l.g.rotation[l.axis] = l.up * (1 - pl.gearK);
			// lights: navigation lights while it's running, a white strobe blinking, the landing light (Bluebird)
			const on = running && !wreck;
			pl.nav.red.visible = pl.nav.grn.visible = on;
			pl.nav.strobe.visible = on && (tn % 1.3) < 0.07;
			if (pl.landM) pl.landM.emissiveIntensity = on && pl.gearK > 0.5 ? 2.2 : 0;
			// its shadow on the ground, fainter and wider the higher it flies
			const gy = floorAt(pl.x, pl.z), alt = Math.max(0, pl.y - gy - D.gearH);
			pl.shadow.position.set(pl.x, gy + PATH_Y + 0.02, pl.z);
			pl.shadow.rotation.set(-Math.PI / 2, 0, pl.h);
			pl.shadow.scale.setScalar(1 + alt / 70);
			pl.shadow.material.opacity = 0.7 * clamp(1 - alt / 90, 0, 1);
			pl.shadow.visible = alt < 90;
			// a smoke trail behind it
			pl.smokeT -= dt;
			if (pl.smoke && on && !pl.ground && pl.smokeT <= 0) {
				pl.smokeT = 0.05;
				const tail = pl.root.localToWorld(_v.set(...D.smokeAt));
				puff(tail.x + (R() - 0.5) * 0.3, tail.y, tail.z + (R() - 0.5) * 0.3, { color: D.smokeCol, size: 1.1, grow: 3.2, life: 6, op: 0.75, vy: 0.3, drag: 0.2 });
			}
			// fire and smoke from a wreck
			if (wreck) {
				pl.fireT -= dt;
				if (pl.fireT <= 0) {
					pl.fireT = 0.09;
					puff(pl.x + (R() - 0.5) * 2.4, pl.y + 0.3, pl.z + (R() - 0.5) * 2.4, { add: true, color: R() < 0.5 ? "#ffb347" : "#ff6a2a", size: 0.9 + R() * 0.8, grow: 0.6, life: 0.55, op: 0.9, vy: 2.4 + R() * 1.5 });
					if (R() < 0.45) puff(pl.x + (R() - 0.5) * 1.5, pl.y + 1.2, pl.z + (R() - 0.5) * 1.5, { color: "#3d3836", size: 1.6, grow: 3.5, life: 5, op: 0.55, vy: 2.8, vx: 0.6, drag: 0.1 });
				}
			}
			// the engine: loud in it, fading with distance
			const mineNow = mine() === pl;
			const dist = Math.hypot(lp.x - pl.x, lp.y - pl.y, lp.z - pl.z);
			const vol = on ? (mineNow ? 0.05 + pl.thr * 0.06 : 0.09 * Math.pow(Math.max(0, 1 - dist / 220), 2) * (0.5 + pl.thr * 0.5)) : 0;
			if (vol > 0.001 || pl.snd) engineSnd(pl, vol, pl.rpm);
			// whoever's in it
			const pId = pilotOf(pl), paId = passengerOf(pl);
			if (pId && pId !== ctx.MY_ID) { const p = peerOf(pId); if (p) seatAvatar(p.avatar, pl, "pilot"); }
			if (paId && paId !== ctx.MY_ID) { const p = peerOf(paId); if (p) seatAvatar(p.avatar, pl, "pass"); }
			if (mineNow) seatAvatar(ctx.myAvatar(), pl, K ? "pilot" : "pass");
		}
		// skydivers: me, and everyone else (from their messages, predicted between them)
		if (SK) poseSkydiver(ctx.myAvatar(), ctx.MY_ID, SK.x, SK.y, SK.z, SK.h, SK.open, SK.roll, dt);
		else hideChute(ctx.MY_ID);
		ctx.peers().forEach((p, id) => {
			const n = skyNet.get(id);
			if ((p.upper === "freefall" || p.upper === "chute") && n && tn - n.at < 2.5) {
				const a = Math.min(0.4, tn - n.at);
				const tx = n.x + n.vx * a, ty = Math.max(floorAt(n.x, n.z), n.y + n.vy * a), tz = n.z + n.vz * a;
				const d = p._sky || (p._sky = { x: tx, y: ty, z: tz });
				const kk = Math.hypot(tx - d.x, ty - d.y, tz - d.z) > 20 ? 1 : Math.min(1, dt * 10);
				d.x += (tx - d.x) * kk; d.y += (ty - d.y) * kk; d.z += (tz - d.z) * kk;
				poseSkydiver(p.avatar, id, d.x, d.y, d.z, n.h, p.upper === "chute", n.rl, dt);
			} else { p._sky = null; hideChute(id); }
		});
		for (const id of [...chutes.keys()]) if (id !== ctx.MY_ID && !ctx.peers().has(id)) { const c = chutes.get(id); g.remove(c.grp); chutes.delete(id); }
		// the wind rushing by: falling, or flying fast in the open
		const myPl = mine();
		windSnd(SK ? (SK.open ? 0.012 : 0.02 + Math.min(0.05, -SK.vy * 0.0012)) : myPl && !myPl.ground ? Math.min(0.035, myPl.v * 0.0006) : 0);
		// a beep while it's stalling or diving at the ground
		beepT -= dt;
		if (K && !K.pl.ground && beepT <= 0) {
			const pl = K.pl, agl = pl.y - floorAt(pl.x, pl.z);
			if (pl.stall || (agl < 45 && pl.vy < -9 && pl.p < -0.15)) { beepT = 0.45; ctx.sfx("count", 0.35); }
		}
	}

	// ================================================================ clicking a plane (or E beside it)
	planes.forEach(pl => {
		const nm = pl.def.name;
		const isIn = () => mine() === pl;
		const pilotName = () => { const p = peerOf(pilotOf(pl)); return p ? p.look.name : "someone"; };
		const busy = () => { const s = stateOf(pl); return s.st === "wreck" ? `${nm} is a smoking wreck - it'll be back soon` : s.st === "ghost" ? `${nm} is flying itself!` : null; };
		const onGround = () => pl.ground && pl.v < 1;
		k.interact("plane:" + pl.def.id + ":fly", {
			get stand() { return toWorld(pl.x, pl.z, pl.h, ...pl.def.stands.pilot); },
			reach: 3.2,
			label: () => {
				if (isIn()) return "Get out of " + nm;
				const b = busy(); if (b) return b;
				if (!pilotOf(pl) && !controlled(pl)) return "Fly " + nm;
				if (!passengerOf(pl) && onGround()) return "Ride with " + pilotName();
				return nm + (onGround() ? " is full" : " is flying");
			},
			use: () => {
				if (isIn()) { exitPlane(); return; }
				const b = busy(); if (b) { ctx.notice(b + "."); return; }
				if (!pilotOf(pl) && !controlled(pl)) getIn(pl, false);
				else if (!passengerOf(pl) && onGround()) getIn(pl, true);
				else ctx.notice(onGround() ? nm + " is full - two at a time!" : nm + " is up in the air!");
			}
		}, pl.B);
		k.interact("plane:" + pl.def.id + ":ride", {
			get stand() { return toWorld(pl.x, pl.z, pl.h, ...pl.def.stands.pass); },
			reach: 3.2,
			label: () => {
				if (P && P.pl === pl) return "Get out of " + nm;
				const b = busy(); if (b) return b;
				if (passengerOf(pl)) return nm + "'s passenger seat is taken";
				return pilotOf(pl) ? "Ride with " + pilotName() : "Sit in " + nm + "'s passenger seat";
			},
			use: () => {
				if (P && P.pl === pl) { exitPlane(); return; }
				const b = busy(); if (b) { ctx.notice(b + "."); return; }
				if (passengerOf(pl)) ctx.notice("Someone's already in that seat.");
				else if (!onGround()) ctx.notice(nm + " is up in the air!");
				else getIn(pl, true);
			}
		});
	});

	// people can't walk through a plane on the ground (its fuselage, its wings, its tail)
	function inPlanes(x, z, r) {
		for (const pl of planes) {
			if (mine() === pl || !pl.ground || pl.y - floorAt(pl.x, pl.z) > pl.def.gearH + 1) continue;
			const dx = x - pl.x, dz = z - pl.z;
			if (dx * dx + dz * dz > 120) continue;
			const c = Math.cos(pl.h), s = Math.sin(pl.h), lx = dx * c - dz * s, lz = dx * s + dz * c;
			for (const [x0, x1, z0, z1] of pl.def.solid) if (lx > x0 - r && lx < x1 + r && lz > z0 - r && lz < z1 + r) return true;
		}
		return false;
	}

	return {
		update, lateUpdate,
		vehicle: () => (SK ? skyVeh : K ? pilotVeh : P ? riderVeh : null),
		solidAt: (x, z, r) => inPlanes(x, z, r),
		onFx(d) {
			if (d.what === "pl") onPlaneMsg(d);
			else if (d.what === "sd") onSkyMsg(d);
			else if (d.what === "pcrash") {
				const pl = planes[d.i | 0];
				if (!pl || !isFinite(+d.x)) return;
				pl.net = null;
				explode(+d.x, +d.y || 0, +d.z, pl.def.paint, false);
				pl.wreckSeen = nowS();
			} else if (d.what === "pspawn") { const pl = planes[d.i | 0]; if (pl) { pl.net = null; poof(pl.def.x, pl.def.z); } }
			else if (d.what === "pbail") { const pl = planes[d.i | 0]; if (pl && P && P.pl === pl && !P.warned) { P.warned = true; ctx.notice("Your pilot jumped out! Press <b>J</b> to jump too!"); } }
		},
		promptOpts(opts) {
			const free = k2 => !opts.some(o => o.k === k2);
			if (SK) { if (!SK.open && free("Space")) opts.push({ k: "Space", label: "Open your parachute", fn: () => openChute(false) }); return; }
			const pl = mine();
			if (pl) {
				if (!pl.ground && free("J")) opts.push({ k: "J", label: "Jump out (parachute)", fn: bail });
				if (K) {
					if (pl.def.retract && free("G")) opts.push({ k: "G", label: pl.gear && !pl.belly ? "Gear up" : "Gear down", fn: toggleGear });
					if (free("R")) opts.push({ k: "R", label: pl.smoke ? "Smoke off" : "Smoke trail", fn: toggleSmoke });
					if (document.body.classList.contains("touch")) {
						opts.push({ k: "+", label: "Throttle up", fn: () => thrStep(0.25) });
						opts.push({ k: "−", label: "Throttle down", fn: () => thrStep(-0.25) });
					}
				}
				if (pl.ground && free("Esc")) opts.push({ k: "Esc", label: "Get out of " + pl.def.name, fn: exitPlane });
				return;
			}
			// on foot beside a plane that landed far from the airfield: send it home
			const m = ctx.me();
			for (const q of planes) {
				const s = stateOf(q);
				if (s.st !== "park" || Math.hypot(q.x - m.x, q.z - m.z) > 7 || Math.hypot(q.x - q.def.x, q.z - q.def.z) < 25 || pilotOf(q) || passengerOf(q)) continue;
				if (free("R")) opts.push({ k: "R", label: `Send ${q.def.name} back to the hangar`, fn: () => respawn(q) });
				break;
			}
		}
	};
}
