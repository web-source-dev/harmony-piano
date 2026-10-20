/**
 * Harmony World — the Lovers' Garden: a walled rose garden full of things for couples to do together, south of the ring
 * road just off the airfield road (east of the Parkour Park). Outdoors.
 *
 * Local coordinates (origin at world 20, -199): x -32..32, z -31..31, inside a clipped hedge; the gate is in the west
 * side (x -32) at z -1.6..1.6, under a rose arch, at the end of the path from the airfield road.
 *   in the middle  a round pond with a glowing heart on its island and a swan boat for two gliding round it; love seats
 *                  round the pond; a picnic blanket (and a basket of strawberries, cake, juice...); the love-lock fence;
 *                  a table of sky lanterns; the fireworks button
 *   on the way in  the kissing arch (kiss whoever you're with under it: a shower of rose petals)
 *   north-west     the Love Wheel: a little Ferris wheel, six cabins for two
 *   north-east     the hot-air balloon for two: up over the garden and back down
 *   south-west     the slow-dance pavilion, and the music box that plays our song (a little waltz) while you dance
 *   south-east     the wishing fountain, and the love meter (how much do you love each other?)
 * The rides run on the wall clock (Date.now), so everyone sees the same wheel, balloon and boat; the next one to board
 * a cabin / the basket sits beside you. The love locks, the love meter's last reading, the song and the fireworks are
 * shared (KEY + ...); a sky lantern or the petals go up / come down for everyone (a "zfx" message).
 */
import { L, TX } from "./worldLang.js";

const OX = 20, OZ = -199;                           // = ZONES.romance ox / oz
const X0 = -32, X1 = 32, Z0 = -31, Z1 = 31;
const GATE = { z0: -1.6, z1: 1.6 };
const POND = { x: 4, z: 0, r: 7.5, isle: 1.8, boatR: 4.9, lap: 48 };   // (the boat goes round once every `lap` seconds)
const KEY = "z:love:";
const TAU = Math.PI * 2;
const clockS = () => Date.now() / 1000;
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const glow = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, o || {}));
	const esc = s => ctx.esc(String(s));
	const R = rng(1402);
	const _d = new THREE.Object3D(), Y = new THREE.Vector3(0, 1, 0);
	k.floor(() => 0);
	k.walk(X0 + 0.5, X1 - 0.5, Z0 + 0.5, Z1 - 0.5);
	k.walk(X0 - 0.6, X0 + 1.2, GATE.z0, GATE.z1);   // in through the gate
	k.cam = { minX: X0 - 4, maxX: X1 + 4, minZ: Z0 - 4, maxZ: Z1 + 4, maxY: 40, minY: 0.2 };   // (up with the balloon)
	const mats = {};
	const matOf = (c, rough = 0.6, metal = 0) => mats[c + rough + metal] || (mats[c + rough + metal] = mat(c, rough, metal));
	const whiteM = matOf("#f4efe6", 0.5), woodM = matOf("#8a5a3a", 0.7), darkWood = matOf("#4a2e1e", 0.75), goldM = matOf("#d8b04a", 0.3, 0.8), ironM = matOf("#2a262e", 0.5, 0.6);
	const fairyM = glow("#ffe2a8"), pinkGlow = glow("#ff8ab0");
	// pictures redrawn when the language changes
	const live = [];
	function fitText(c, w, h, text, o = {}) {
		let size = o.size || h * 0.62;
		const font = s => `${o.weight || 900} ${s}px ${o.family || "Nunito, 'Segoe UI', sans-serif"}`;
		c.font = font(size);
		while (c.measureText(text).width > w * 0.92 && size > 8) { size -= 3; c.font = font(size); }
		c.textAlign = o.align || "center"; c.textBaseline = "middle";
		if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 24; }
		c.fillStyle = o.color || "#fff";
		c.fillText(text, o.x !== undefined ? o.x : w / 2, o.y !== undefined ? o.y : h / 2 + 4);
		c.shadowBlur = 0;
	}
	const liveTex = (w, h, draw, state) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const r = { cv, t, draw, state, key: null }; live.push(r); paint(r); return t; };
	function paint(r) { const key = L("en", "tr") + "|" + (r.state ? r.state() : ""); if (key === r.key) return; r.key = key; const c = r.cv.getContext("2d"); c.clearRect(0, 0, r.cv.width, r.cv.height); r.draw(c, r.cv.width, r.cv.height); r.t.needsUpdate = true; }
	const signM = (fn, o = {}) => new THREE.MeshBasicMaterial({ map: liveTex(o.w || 1024, o.h || 256, (c, w, h) => { if (o.bg) { c.fillStyle = o.bg; c.fillRect(0, 0, w, h); } fitText(c, w, h, fn(), o); }), transparent: !o.bg, depthWrite: !!o.bg, toneMapped: false });
	// a point (local) turned round (x, z) by ry: the same turn as a group's rotation.y
	const turn = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
	const boxR = (x, z, ry, hx, hz) => { const c = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([a, b]) => turn(x, z, ry, a, b)); k.box(Math.min(...c.map(p => p[0])), Math.max(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[1]))); };
	// string fairy lights from a to b (a little sag), n bulbs
	const bulbs = [];
	function lights(a, b, n, sag = 0.25) { for (let i = 0; i <= n; i++) { const u = i / n; bulbs.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag, a[2] + (b[2] - a[2]) * u]); } }

	// a love seat for two (side by side, close enough to cuddle), facing h
	let seatN = 0;
	function loveSeat(x, z, h) {
		const sg = group(g, x, 0, z, h), id = "romSeat" + seatN++;
		add(sg, rbox(1.3, 0.08, 0.55, 0.03), matOf("#c04a6a", 0.8), 0, 0.44, 0);
		add(sg, rbox(1.3, 0.55, 0.1, 0.04), matOf("#c04a6a", 0.8), 0, 0.75, -0.25, { rx: -0.12 });
		for (const sx of [-0.6, 0.6]) add(sg, new THREE.CylinderGeometry(0.03, 0.03, 0.44, 6), ironM, sx, 0.22, 0, { cast: false });
		const hb = k.heartMesh(0.36, "#ff4d6d"); hb.position.set(0, 1.1, -0.27); sg.add(hb);
		const ids = [id + "A", id + "B"];
		[-0.3, 0.3].forEach((lx, j) => { const p = turn(x, z, h, lx, 0.04); k.spot({ id: ids[j], x: p[0], z: p[1], h, y: 0.06 }); });
		k.interact("rom:seat" + seatN, { label: () => L("Sit on the love seat", "Aşk koltuğuna otur"), stand: turn(x, z, h, 0, 0.8), sit: ids }, sg);
		boxR(x, z, h, 0.7, 0.32);
	}
	const roseGeo = new THREE.SphereGeometry(1, 8, 6), roseSpots = [];
	const roseBush = (x, z, s = 1) => { roseSpots.push([x, 0.35 * s, z, 0.5 * s, 3]); for (let i = 0; i < 9; i++) roseSpots.push([x + (R() - 0.5) * 1.1 * s, 0.25 + R() * 0.5 * s, z + (R() - 0.5) * 1.1 * s, 0.1 + R() * 0.06, R() < 0.7 ? 0 : 1]); };

	// ================================================================ the ground, the hedge, the way in
	const lawn = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#4a8a3e"; c.fillRect(0, 0, w, h);
		for (let n = 0; n < 4000; n++) { c.fillStyle = `rgba(${30 + R() * 40},${95 + R() * 60},${35 + R() * 30},0.5)`; c.fillRect(R() * w, R() * h, 2, 4); }
		for (let n = 0; n < 60; n++) { c.fillStyle = ["#ffd6e6", "#ffffff", "#ffe2a8"][n % 3]; c.beginPath(); c.arc(R() * w, R() * h, 2.5, 0, TAU); c.fill(); }
	}, 12, 12);
	add(g, new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat("#ffffff", 0.95, 0, { map: lawn }), 0, 0.005, 0, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
	const stone = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#e8d4d0"; c.fillRect(0, 0, w, h); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { c.fillStyle = `rgb(${225 + R() * 25 | 0},${195 + R() * 25 | 0},${195 + R() * 25 | 0})`; c.fillRect(i * 64 + 3, j * 64 + 3, 58, 58); } }, 1, 1);
	const pathM = mat("#ffffff", 0.85, 0, { map: stone });
	const pathTo = (x0, z0, x1, z1, w) => { const l = Math.hypot(x1 - x0, z1 - z0), t = stone.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(l / 1.4, w / 1.4); t.needsUpdate = true; const m = add(g, new THREE.PlaneGeometry(l, w), mat("#ffffff", 0.85, 0, { map: t }), (x0 + x1) / 2, 0.012, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false }); m.rotation.z = -Math.atan2(z1 - z0, x1 - x0); m.userData.floor = true; };
	pathTo(X0, 0, POND.x - POND.r - 0.4, 0, 2.2);
	pathTo(-20, 0, -20, 16, 1.6); pathTo(-20, 0, -20, -14.4, 1.6);
	pathTo(14, 0, 20, 0, 1.6); pathTo(20, -14, 20, 14, 1.6); pathTo(POND.x + POND.r + 0.4, 0, 14, 0, 1.6);
	{
		const hedgeM = matOf("#2f6a34", 0.95);
		const hedge = (x0, x1, z0, z1) => { const m = add(g, new THREE.BoxGeometry(1, 1, 1), hedgeM, (x0 + x1) / 2, 0.75, (z0 + z1) / 2); m.scale.set(x1 - x0, 1.5, z1 - z0); k.box(x0, x1, z0, z1); };
		hedge(X0 - 0.4, X1 + 0.4, Z1, Z1 + 0.8); hedge(X0 - 0.4, X1 + 0.4, Z0 - 0.8, Z0);
		hedge(X1, X1 + 0.8, Z0, Z1); hedge(X0 - 0.8, X0, Z0, GATE.z0 - 0.6); hedge(X0 - 0.8, X0, GATE.z1 + 0.6, Z1);
		for (let i = 0; i < 28; i++) { const t = i / 28; roseBush(X0 + 1.2 + t * (X1 - X0 - 2.4), Z1 - 1.0, 0.9); roseBush(X0 + 1.2 + t * (X1 - X0 - 2.4), Z0 + 1.0, 0.9); }
		for (let i = 0; i < 14; i++) { const t = i / 14; roseBush(X1 - 1.0, Z0 + 2 + t * (Z1 - Z0 - 4), 0.9); }
	}
	// the rose arch over the gate, with its sign
	{
		const ag = group(g, X0 + 0.6, 0, 0);
		for (const s of [-1, 1]) { add(ag, new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8), whiteM, 0, 1.4, s * 1.9); k.box(X0 + 0.45, X0 + 0.75, s * 1.9 - 0.15, s * 1.9 + 0.15); }
		const arc = add(ag, new THREE.TorusGeometry(1.9, 0.08, 8, 24, Math.PI), whiteM, 0, 2.8, 0, { ry: Math.PI / 2 });
		for (let i = 0; i < 26; i++) { const a = i / 25 * Math.PI; roseSpots.push([X0 + 0.6 + (R() - 0.5) * 0.3, 2.8 + Math.sin(a) * 1.9, Math.cos(a) * 1.9, 0.12, i % 3 ? 0 : 1]); }
		for (const s of [1, -1]) add(ag, new THREE.PlaneGeometry(3.4, 0.62), signM(() => L("LOVERS' GARDEN", "AŞIKLAR BAHÇESİ"), { color: "#ffffff", glow: "#ff4d8a", w: 1536, h: 280, size: 190 }), -s * 0.1, 3.55, 0, { ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, cast: false, receive: false });
		lights([X0 + 0.6, 2.7, -1.9], [X0 + 0.6, 2.7, 1.9], 10, -0.0);
	}

	// ================================================================ the pond, the heart on its island, the swan boat
	{
		const waterM = new THREE.MeshStandardMaterial({ color: "#3a7ad8", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.88 });
		add(g, new THREE.CircleGeometry(POND.r, 48), waterM, POND.x, 0.04, POND.z, { rx: -Math.PI / 2, cast: false });
		add(g, new THREE.TorusGeometry(POND.r, 0.22, 8, 64), matOf("#d8ccc4", 0.8), POND.x, 0.08, POND.z, { rx: Math.PI / 2, cast: false });
		// (you can't walk on the water: slices of the circle, a hair inside its rim)
		for (let i = 0; i < 6; i++) { const a = -POND.r + i * POND.r / 3, b = a + POND.r / 3, m = Math.max(Math.abs(a), Math.abs(b)) * 0.92, hz = Math.sqrt(Math.max(0, POND.r * POND.r - m * m)); k.box(POND.x + a, POND.x + b, POND.z - hz, POND.z + hz); }
		add(g, new THREE.CylinderGeometry(POND.isle, POND.isle + 0.2, 0.3, 24), matOf("#5a9a4a", 0.95), POND.x, 0.15, POND.z);
		var bigHeart = k.heartMesh(1.6, "#ff2d6d"); bigHeart.position.set(POND.x, 1.6, POND.z); bigHeart.material.emissiveIntensity = 0.8; g.add(bigHeart);
		for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; roseSpots.push([POND.x + Math.cos(a) * 1.4, 0.4, POND.z + Math.sin(a) * 1.4, 0.13, i % 2]); }
		// lily pads
		for (let i = 0; i < 12; i++) { const a = R() * TAU, r = POND.isle + 1 + R() * 3.5; if (Math.abs(r - POND.boatR) < 0.8) continue; add(g, new THREE.CircleGeometry(0.3 + R() * 0.2, 12, 0.3, TAU - 0.6), matOf("#3a8a3a", 0.8), POND.x + Math.cos(a) * r, 0.05, POND.z + Math.sin(a) * r, { rx: -Math.PI / 2, cast: false }); }
		var pondWater = waterM;
	}
	// the swan boat: round and round the island, two seats side by side
	const boat = group(g, 0, 0, 0);
	{
		const swanM = matOf("#ffffff", 0.45);
		// a hollow hull, open at the top (the two of you sit in it, not in a solid lump of swan)
		const hullM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.45, side: THREE.DoubleSide });
		add(boat, new THREE.SphereGeometry(1, 22, 12, 0, TAU, Math.PI / 2, Math.PI / 2), hullM, 0, 0.62, 0).scale.set(0.95, 0.6, 1.55);
		const rim = add(boat, new THREE.TorusGeometry(1, 0.05, 6, 32), matOf("#f0e6e6", 0.4), 0, 0.62, 0, { rx: Math.PI / 2, cast: false }); rim.scale.set(0.95, 1.55, 1);
		add(boat, rbox(1.0, 0.04, 1.8, 0.02), matOf("#e8dcdc", 0.6), 0, 0.2, 0, { cast: false });   // (its floor)
		add(boat, rbox(1.08, 0.12, 0.9, 0.05), matOf("#c04a6a", 0.8), 0, 0.5, -0.1, { cast: false });   // (the seat)
		add(boat, rbox(1.08, 0.4, 0.1, 0.04), matOf("#c04a6a", 0.8), 0, 0.74, -0.6, { cast: false });
		const neck = new THREE.CatmullRomCurve3([[0, 0.5, 1.1], [0, 1.1, 1.45], [0, 1.65, 1.25], [0, 1.75, 1.0]].map(p => new THREE.Vector3(...p)));
		add(boat, new THREE.TubeGeometry(neck, 16, 0.11, 8), swanM, 0, 0, 0);
		add(boat, new THREE.SphereGeometry(0.16, 12, 10), swanM, 0, 1.78, 1.0);
		add(boat, new THREE.ConeGeometry(0.06, 0.22, 8), matOf("#ff8a2a", 0.5), 0, 1.74, 1.22, { rx: Math.PI / 2, cast: false });
		for (const s of [-1, 1]) { const wg = add(boat, new THREE.SphereGeometry(1, 12, 8), swanM, s * 0.78, 0.62, -0.25); wg.scale.set(0.18, 0.32, 0.8); wg.rotation.z = s * 0.4; }
		const hb = k.heartMesh(0.3, "#ff4d6d"); hb.position.set(0, 0.95, -0.66); boat.add(hb);
	}
	const boatAt = s => { const a = s / POND.lap * TAU; return { x: POND.x + Math.cos(a) * POND.boatR, z: POND.z + Math.sin(a) * POND.boatR, h: Math.atan2(-Math.sin(a), Math.cos(a)) }; };
	// (riders: where the boat is now, sitting side by side on its seat)
	const _bp = new THREE.Vector3();
	const DOCK = { x: POND.x - POND.r - 0.9, z: 0 };
	const boatIds = ["romBoatA", "romBoatB"];
	boatIds.forEach((id, j) => k.spot({ id, x: DOCK.x, z: DOCK.z + (j ? 0.3 : -0.3), y: 0.12, h: 0, hands: true, stand: [DOCK.x - 0.3, DOCK.z + (j ? 0.6 : -0.6)], ride: (pos, quat) => {
		const b = boatAt(clockS());
		_bp.set((j ? 0.3 : -0.3), 0.14, -0.1).applyAxisAngle(Y, b.h);
		pos.set(OX + b.x + _bp.x, 0.18 + Math.sin(clockS() * 1.3) * 0.02, OZ + b.z + _bp.z);
		quat.setFromAxisAngle(Y, b.h);
	} }));
	{
		// the little pier you board it from
		add(g, rbox(1.6, 0.12, 1.8, 0.02), woodM, DOCK.x + 0.2, 0.1, DOCK.z);
		for (const s of [-0.75, 0.75]) add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), darkWood, DOCK.x + 0.9, 0.5, s, { cast: false });
		const pierSign = add(g, new THREE.PlaneGeometry(1.4, 0.36), signM(() => L("Swan boat for two", "İki kişilik kuğu tekne"), { bg: "#fff4f6", color: "#c0285a", size: 100 }), DOCK.x - 0.55, 1.1, DOCK.z - 1.05, { ry: -Math.PI / 2, cast: false });
		add(g, new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), darkWood, DOCK.x - 0.55, 0.55, DOCK.z - 1.05, { cast: false });
		k.interact("rom:boat", {
			label: () => L("Take the swan boat for two", "İki kişilik kuğu tekneye bin"), stand: [DOCK.x - 0.9, DOCK.z], face: Math.PI / 2, reach: 2.6,
			use: () => { if (ctx.sitOn(boatIds)) ctx.toast(L("Round and round the pond you go. Bring your love along: there's room for two. (<b>Esc</b> to get off)", "Gölün etrafında tur atıyorsun. Sevgilini de getir: iki kişilik yer var. (İnmek için <b>Esc</b>)"), null, null, 7000); }
		}, pierSign);
	}

	// ================================================================ the Love Wheel (north-west): a little Ferris wheel, cabins for two
	const WHEEL = { x: -19, z: 20, y: 7.9, r: 5.6, n: 6, lap: 64 };
	const wheel = group(g, WHEEL.x, WHEEL.y, WHEEL.z), cabins = [];
	{
		const legM = matOf("#f4efe6", 0.4, 0.2);
		for (const dz of [-1.1, 1.1]) for (const dx of [-1, 1]) {
			const lg = add(g, new THREE.CylinderGeometry(0.12, 0.16, WHEEL.y / Math.cos(0.32), 10), legM, WHEEL.x + dx * WHEEL.y * Math.tan(0.32) / 2, WHEEL.y / 2, WHEEL.z + dz);
			lg.rotation.z = -dx * 0.32;
			k.box(WHEEL.x + dx * WHEEL.y * Math.tan(0.32) - 0.25, WHEEL.x + dx * WHEEL.y * Math.tan(0.32) + 0.25, WHEEL.z + dz - 0.25, WHEEL.z + dz + 0.25);
		}
		add(g, new THREE.CylinderGeometry(0.22, 0.22, 2.6, 12), legM, WHEEL.x, WHEEL.y, WHEEL.z, { rx: Math.PI / 2 });
		for (const dz of [-0.5, 0.5]) {
			add(wheel, new THREE.TorusGeometry(WHEEL.r, 0.08, 8, 48), matOf("#ff7aa2", 0.4, 0.2), 0, 0, dz);
			for (let i = 0; i < 12; i++) add(wheel, new THREE.CylinderGeometry(0.04, 0.04, WHEEL.r, 6), legM, Math.sin(i / 12 * TAU) * WHEEL.r / 2, Math.cos(i / 12 * TAU) * WHEEL.r / 2, dz, { rz: -i / 12 * TAU, cast: false });
		}
		const hub = k.heartMesh(1.2, "#ff2d6d"); hub.material.emissiveIntensity = 0.8; hub.position.set(0, 0, 0.75); wheel.add(hub);
		const rimLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), fairyM, 48);
		for (let i = 0; i < 48; i++) { _d.position.set(Math.sin(i / 48 * TAU) * WHEEL.r, Math.cos(i / 48 * TAU) * WHEEL.r, 0.62); _d.rotation.set(0, 0, 0); _d.scale.setScalar(1); _d.updateMatrix(); rimLights.setMatrixAt(i, _d.matrix); }
		rimLights.castShadow = false; wheel.add(rimLights);
		const cabCols = ["#ff7aa2", "#c06aff", "#ffb86b", "#6ad0ff", "#7ae582", "#ff4d6d"];
		for (let i = 0; i < WHEEL.n; i++) {
			const cg = group(g, 0, 0, 0);
			add(cg, rbox(1.5, 0.08, 0.86, 0.03), matOf("#f4efe6", 0.5), 0, 0, 0);
			add(cg, rbox(1.4, 0.4, 0.4, 0.06), matOf(cabCols[i], 0.6), 0, 0.25, 0.2);   // (the bench, its back to the wheel)
			for (const sx of [-0.72, 0.72]) for (const sz of [-0.4, 0.4]) add(cg, new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), goldM, sx, 0.8, sz, { cast: false });
			add(cg, new THREE.ConeGeometry(1.05, 0.5, 4), matOf(cabCols[i], 0.5), 0, 1.85, 0, { ry: Math.PI / 4 });
			add(cg, new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), goldM, 0, 2.3, 0, { cast: false });
			cabins.push(cg);
		}
		// the boarding step
		add(g, rbox(3, 0.15, 2, 0.03), matOf("#e8d4d0", 0.8), WHEEL.x, 0.075, WHEEL.z - 1.6);
		var wheelSign = add(g, new THREE.PlaneGeometry(2.6, 0.5), signM(() => L("The Love Wheel", "Aşk Dönmedolabı"), { bg: "#fff4f6", color: "#c0285a", size: 110 }), WHEEL.x, 1.6, WHEEL.z - 2.7, { ry: Math.PI, cast: false });
		add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), darkWood, WHEEL.x - 1.35, 0.8, WHEEL.z - 2.7, { cast: false });
		add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), darkWood, WHEEL.x + 1.35, 0.8, WHEEL.z - 2.7, { cast: false });
	}
	// where cabin i is at time s (hanging straight down under its place on the rim)
	const cabinAt = (i, s) => { const a = s / WHEEL.lap * TAU + i / WHEEL.n * TAU; return { x: WHEEL.x + Math.sin(a) * WHEEL.r, y: WHEEL.y - Math.cos(a) * WHEEL.r - 2.15, z: WHEEL.z - 0.05 }; };
	// every cabin's two seats, in order (so whoever comes next sits beside you, not in another cabin); riders face south
	const wheelIds = [];
	for (let i = 0; i < WHEEL.n; i++) for (const j of [0, 1]) {
		const id = "romWheel" + i + (j ? "B" : "A");
		wheelIds.push(id);
		k.spot({ id, x: WHEEL.x + (j ? 0.3 : -0.3), z: WHEEL.z - 1.6, y: 0.1, h: Math.PI, hands: true, stand: [WHEEL.x + (j ? 0.7 : -0.7), WHEEL.z - 2.2], ride: (pos, quat) => {
			const c = cabinAt(i, clockS());
			pos.set(OX + c.x + (j ? -0.3 : 0.3), c.y + 0.07, OZ + c.z + 0.2);   // (on the bench)
			quat.setFromAxisAngle(Y, Math.PI);
		} });
	}
	k.interact("rom:wheel", {
		label: () => L("Ride the Love Wheel (a cabin for two)", "Aşk Dönmedolabı'na bin (iki kişilik kabin)"), stand: [WHEEL.x, WHEEL.z - 3.4], face: 0, reach: 3,
		use: () => { if (ctx.sitOn(wheelIds)) ctx.toast(L("Up you go! Bring your love: the next one in sits right beside you. (<b>Esc</b> to get off)", "Yukarı! Sevgilini de getir: sonra binen tam yanına oturur. (İnmek için <b>Esc</b>)"), null, null, 7000); }
	}, wheelSign);

	// ================================================================ the hot-air balloon for two (north-east)
	const BAL = { x: 20, z: 19, cycle: 80, ground: 14, top: 24 };
	// where the balloon is at time s: on the ground for a while (boarding), then up, a slow circle, and down again
	function balloonAt(s) {
		const u = ((s % BAL.cycle) + BAL.cycle) % BAL.cycle, fly = BAL.cycle - BAL.ground, f = Math.max(0, u - BAL.ground) / fly;
		const up = f <= 0 ? 0 : f < 0.25 ? smooth(f / 0.25) : f > 0.75 ? smooth((1 - f) / 0.25) : 1;
		const a = f * TAU, r = 7 * Math.sin(Math.PI * f);
		return { x: BAL.x + Math.sin(a) * r, y: up * BAL.top, z: BAL.z - (1 - Math.cos(a)) * r * 0.5, grounded: f <= 0, wait: f <= 0 ? BAL.ground - u : BAL.cycle - u, burn: f > 0 && f < 0.3 };
	}
	const balloon = group(g, BAL.x, 0, BAL.z);
	let flame;
	{
		const env = canvasTex(512, 256, c => { const cols = ["#ff4d6d", "#ffffff", "#ff8ab0", "#ffffff"]; for (let i = 0; i < 16; i++) { c.fillStyle = cols[i % 4]; c.fillRect(i * 32, 0, 32, 256); } c.fillStyle = "#d81a4a"; c.save(); c.translate(256, 128); c.beginPath(); c.moveTo(0, 40); c.bezierCurveTo(-60, 0, -40, -50, 0, -20); c.bezierCurveTo(40, -50, 60, 0, 0, 40); c.fill(); c.restore(); });
		const e = add(balloon, new THREE.SphereGeometry(2.6, 24, 18), mat("#ffffff", 0.7, 0, { map: env }), 0, 5.6, 0); e.scale.set(1, 1.2, 1);
		add(balloon, new THREE.CylinderGeometry(1.0, 0.45, 1.4, 16, 1, true), mat("#ffffff", 0.7, 0, { map: env, side: THREE.DoubleSide }), 0, 2.7, 0);
		for (const [sx, sz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) add(balloon, new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4), matOf("#5a4a3a", 0.9), sx * 0.85, 1.6, sz * 0.85, { cast: false });
		// the basket: a wicker floor and four walls, hollow, waist high (you stand in it and look out over the side)
		const wicker = canvasTex(128, 128, c => { c.fillStyle = "#8a5a2a"; c.fillRect(0, 0, 128, 128); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { c.fillStyle = (i + j) % 2 ? "#b8884a" : "#a8783a"; c.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); } }, 2, 1);
		const wickM = mat("#ffffff", 0.95, 0, { map: wicker, side: THREE.DoubleSide });
		add(balloon, rbox(1.3, 0.1, 1.3, 0.03), wickM, 0, 0.05, 0);
		for (const [x, z, w, d] of [[0, -0.62, 1.3, 0.06], [0, 0.62, 1.3, 0.06], [-0.62, 0, 0.06, 1.3], [0.62, 0, 0.06, 1.3]]) add(balloon, rbox(w, 1.0, d, 0.02), wickM, x, 0.5, z);
		for (const [x, z, w, d] of [[0, -0.62, 1.36, 0.1], [0, 0.62, 1.36, 0.1], [-0.62, 0, 0.1, 1.36], [0.62, 0, 0.1, 1.36]]) add(balloon, rbox(w, 0.06, d, 0.03), matOf("#6a4a2a", 0.9), x, 1.0, z, { cast: false });   // (its leather rim)
		flame = add(balloon, new THREE.ConeGeometry(0.16, 0.5, 8), glow("#ffb23a", { transparent: true, opacity: 0.9 }), 0, 2.1, 0, { cast: false });
		add(g, new THREE.CylinderGeometry(2.2, 2.2, 0.06, 32), matOf("#e8d4d0", 0.8), BAL.x, 0.03, BAL.z);
		var balSign = add(g, new THREE.PlaneGeometry(2.4, 0.48), signM(() => L("Balloon ride for two", "İki kişilik balon turu"), { bg: "#fff4f6", color: "#c0285a", size: 100 }), BAL.x, 1.5, BAL.z - 2.6, { ry: Math.PI, cast: false });
		for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), darkWood, BAL.x + s * 1.25, 0.75, BAL.z - 2.6, { cast: false });
	}
	const balIds = ["romBalA", "romBalB"];
	balIds.forEach((id, j) => k.spot({ id, x: BAL.x + (j ? 0.25 : -0.25), z: BAL.z, y: 0.0, h: Math.PI, hands: true, ridePose: () => "idle",   // (standing in the basket)
		 stand: [BAL.x + (j ? 0.8 : -0.8), BAL.z - 2.2], ride: (pos, quat) => {
		const b = balloonAt(clockS());
		pos.set(OX + b.x + (j ? -0.27 : 0.27), b.y + 0.1, OZ + b.z + 0.05);
		quat.setFromAxisAngle(Y, Math.PI);
	} }));
	k.interact("rom:balloon", {
		label: () => { const b = balloonAt(clockS()); return b.grounded ? L("Get in the balloon (room for two)", "Balona bin (iki kişilik)") : L(`The balloon is up in the sky: back in ${Math.ceil(b.wait)}s`, `Balon gökyüzünde: ${Math.ceil(b.wait)} sn sonra dönüyor`); },
		stand: [BAL.x, BAL.z - 3.2], face: 0, reach: 3,
		use: () => {
			const b = balloonAt(clockS());
			if (!b.grounded) { ctx.toast(L(`It's up in the sky. Back down in ${Math.ceil(b.wait)} seconds.`, `Şu an gökyüzünde. ${Math.ceil(b.wait)} saniye sonra iniyor.`), null, null, 3500); return; }
			if (ctx.sitOn(balIds)) ctx.toast(L(`Up, up and away in ${Math.ceil(b.wait)}s! Bring someone special. (<b>Esc</b> to get off)`, `${Math.ceil(b.wait)} sn sonra havalanıyoruz! Özel birini getir. (İnmek için <b>Esc</b>)`), null, null, 7000);
		}
	}, balSign);

	// ================================================================ the slow-dance pavilion (south-west), and its music box
	const PAV = { x: -19, z: -19, r: 4.2 };
	const SONG_BEAT = 0.5;
	// our song: a little waltz (melody and an arpeggio underneath: [beat, midi note, how loud])
	const SONG = (() => {
		const out = [], bars = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59], [48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 55]];
		const tune = [[76, 0], [74, 2], [72, 3], [76, 5], [81, 6], [79, 8], [77, 9], [76, 10], [74, 11], [76, 12], [79, 14], [84, 15], [83, 17], [81, 18], [79, 19], [77, 20], [79, 21], [76, 22], [72, 23.5]];
		for (let rep = 0; rep < 2; rep++) {
			bars.forEach((b, i) => b.forEach((n, j) => out.push([rep * 24 + i * 3 + j, n, 0.1])));
			tune.forEach(([n, beat]) => out.push([rep * 24 + beat, n, 0.2]));
		}
		return out.sort((a, b) => a[0] - b[0]);
	})();
	const SONG_LEN = 48 * SONG_BEAT + 1.5;
	let floorM, spotM;
	{
		floorM = new THREE.MeshStandardMaterial({ color: "#8a5a3a", roughness: 0.25, metalness: 0.1, emissive: "#ff4d8a", emissiveIntensity: 0 });
		add(g, new THREE.CylinderGeometry(PAV.r, PAV.r + 0.1, 0.1, 32), floorM, PAV.x, 0.05, PAV.z).userData.floor = true;
		for (let i = 0; i < 8; i++) {
			const a = i / 8 * TAU, px = PAV.x + Math.cos(a) * (PAV.r - 0.15), pz = PAV.z + Math.sin(a) * (PAV.r - 0.15);
			add(g, new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), whiteM, px, 1.6, pz, { cast: false });
			k.box(px - 0.1, px + 0.1, pz - 0.1, pz + 0.1);
			lights([px, 3.2, pz], [PAV.x, 4.6, PAV.z], 8, -0.2);
			const b = (i + 1) / 8 * TAU; lights([px, 3.2, pz], [PAV.x + Math.cos(b) * (PAV.r - 0.15), 3.2, PAV.z + Math.sin(b) * (PAV.r - 0.15)], 6, 0.2);
		}
		add(g, new THREE.CylinderGeometry(0.08, 0.08, 4.8, 8), whiteM, PAV.x, 2.4, PAV.z, { cast: false });
		const ph = k.heartMesh(0.6, "#ff2d6d"); ph.position.set(PAV.x, 5.0, PAV.z); g.add(ph);
		spotM = new THREE.MeshBasicMaterial({ color: "#ff8ab0", transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending });
		add(g, new THREE.ConeGeometry(PAV.r - 0.4, 4.4, 32, 1, true), spotM, PAV.x, 2.3, PAV.z, { cast: false, receive: false });
		// the music box on its pedestal, at the edge of the floor
		const mb = group(g, PAV.x + PAV.r + 0.7, 0, PAV.z, -Math.PI / 2);
		add(mb, new THREE.CylinderGeometry(0.2, 0.26, 0.9, 12), whiteM, 0, 0.45, 0);
		add(mb, rbox(0.5, 0.25, 0.36, 0.04), matOf("#c0285a", 0.4), 0, 1.03, 0);
		add(mb, rbox(0.5, 0.04, 0.36, 0.02), goldM, 0, 1.17, -0.05, { rx: -0.9 });
		var dancer = add(mb, new THREE.ConeGeometry(0.05, 0.16, 8), matOf("#ffd6e6", 0.4), 0, 1.25, 0.05, { cast: false });
		k.box(PAV.x + PAV.r + 0.45, PAV.x + PAV.r + 0.95, PAV.z - 0.3, PAV.z + 0.3);
		var musicBox = mb;
	}
	const songStart = () => { const v = ctx.get(KEY + "song"); return typeof v === "number" ? v : 0; };
	k.interact("rom:song", {
		label: () => L("Play our song and waltz", "Şarkımızı çal ve vals yap"), stand: [PAV.x + PAV.r - 0.4, PAV.z], face: Math.PI / 2, reach: 2.6,
		use: () => {
			if (Date.now() - songStart() > SONG_LEN * 1000) ctx.setShared(KEY + "song", Date.now());
			ctx.sfx("chime", 0.4);
			const m = ctx.me();
			let near = null, bd = 6;
			ctx.peers().forEach((p, id) => { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd && !p.sit) { bd = d; near = id; } });
			if (near) setTimeout(() => ctx.loveAct("cd_waltz"), 300);   // (our song is a waltz)
			else ctx.toast(L("The music box starts to play... now bring your partner onto the dance floor and slow dance.", "Müzik kutusu çalmaya başladı... şimdi sevgilini dans pistine getir ve ağır dans edin."), null, null, 6000);
		}
	}, musicBox);
	let songPlayed = -1, songKey = 0;
	function playSong(dt) {
		const st = songStart(), el = (Date.now() - st) / 1000;
		if (st !== songKey) { songKey = st; songPlayed = -1; }
		const on = el >= 0 && el < SONG_LEN;
		const m = ctx.me(), close = Math.hypot(m.x - OX - PAV.x, m.z - OZ - PAV.z) < 24;
		if (on && close) {
			const audio = ctx.audio && ctx.audio(), muted = ctx.muted && ctx.muted();
			for (let i = songPlayed + 1; i < SONG.length && SONG[i][0] * SONG_BEAT <= el; i++) { songPlayed = i; if (audio && !muted && el - SONG[i][0] * SONG_BEAT < 0.25) audio.pianoNote(SONG[i][1], SONG[i][2]); }
		}
		const glowK = on ? 0.5 + 0.5 * Math.sin(el / SONG_BEAT * Math.PI * 2 / 3) : 0;
		floorM.emissiveIntensity = on ? 0.15 + 0.25 * glowK : 0;
		spotM.opacity = on ? 0.08 + 0.08 * glowK : 0.02;
		dancer.rotation.y += dt * (on ? 3 : 0);
		return on;
	}

	// ================================================================ the wishing fountain and the love meter (south-east)
	const FOUNT = { x: 19, z: -19 };
	const jets = [];
	{
		add(g, new THREE.CylinderGeometry(2.3, 2.4, 0.5, 32), matOf("#e8dcd4", 0.7), FOUNT.x, 0.25, FOUNT.z);
		add(g, new THREE.CircleGeometry(2.05, 32), new THREE.MeshStandardMaterial({ color: "#5aa8e8", roughness: 0.08, metalness: 0.2, emissive: "#2a6ab8", emissiveIntensity: 0.3 }), FOUNT.x, 0.46, FOUNT.z, { rx: -Math.PI / 2, cast: false });
		add(g, new THREE.CylinderGeometry(0.25, 0.4, 1.4, 12), matOf("#e8dcd4", 0.7), FOUNT.x, 1.0, FOUNT.z);
		const fh = k.heartMesh(0.7, "#ff2d6d"); fh.position.set(FOUNT.x, 2.05, FOUNT.z); g.add(fh); var fountHeart = fh;
		const jetM = new THREE.MeshBasicMaterial({ color: "#cfe8ff", transparent: true, opacity: 0.6, toneMapped: false });
		for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; jets.push({ m: add(g, new THREE.SphereGeometry(0.06, 6, 4), jetM, FOUNT.x, 1.6, FOUNT.z, { cast: false }), a }); }
		for (let i = 0; i < 30; i++) roseSpots.push([FOUNT.x + (R() - 0.5) * 3, 0.47, FOUNT.z + (R() - 0.5) * 3, 0.03, 4]);   // (coins in the water)
		k.box(FOUNT.x - 2.35, FOUNT.x + 2.35, FOUNT.z - 2.35, FOUNT.z + 2.35);
	}
	const WISHES = [
		["May every day feel like your first date.", "Her gün ilk buluşmanız gibi olsun."],
		["May you always find your way back to each other.", "Her zaman birbirinize dönen yolu bulun."],
		["May your love grow a little more every day.", "Aşkınız her gün biraz daha büyüsün."],
		["May you laugh together until you're old and grey.", "Saçlarınız ağarana kadar birlikte gülün."],
		["May your hearts always beat as one.", "Kalpleriniz hep tek bir kalp gibi atsın."],
		["May every sunset find you holding hands.", "Her gün batımı sizi el ele bulsun."],
		["May your next kiss be the best one yet.", "Bir sonraki öpücüğünüz en güzeli olsun."]
	];
	let coin = null;
	k.interact("rom:wish", {
		label: () => L("Toss a coin and make a wish", "Bir bozuk para at ve dilek tut"), stand: [FOUNT.x - 3.0, FOUNT.z], face: Math.PI / 2, reach: 2.6,
		use: () => {
			const m = add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.01, 12), goldM, FOUNT.x - 2.6, 1.2, FOUNT.z, { cast: false });
			coin = { m, t: 0 };
			ctx.sfx("pop", 0.5);
			setTimeout(() => { ctx.sfx("water", 0.5); ctx.heartsFx(ctx.myAvatar().root, 5); ctx.toast("✨ " + TX(WISHES[Math.random() * WISHES.length | 0]), null, null, 6000); }, 800);
		}
	}, fountHeart);
	// the love meter: an old fairground machine. Two hands on it and it tells you how much you love each other
	const METER = { x: 24.4, z: -14.6 };
	const meterVal = () => { const v = ctx.get(KEY + "meter"); return v && typeof v.p === "number" ? v : null; };
	const meterT = liveTex(256, 512, (c, w, h) => {
		const v = meterVal();
		c.fillStyle = "#2a0a1a"; c.fillRect(0, 0, w, h);
		fitText(c, w, 70, L("LOVE METER", "AŞK ÖLÇER"), { y: 40, size: 34, color: "#ffd23a" });
		const p = v ? v.p : 0;
		c.fillStyle = "#4a1a2a"; c.fillRect(70, 80, 116, 340);
		const gr = c.createLinearGradient(0, 420, 0, 80); gr.addColorStop(0, "#ffd23a"); gr.addColorStop(0.5, "#ff7aa2"); gr.addColorStop(1, "#ff1a4a");
		c.fillStyle = gr; c.fillRect(74, 420 - 336 * p / 100, 108, 336 * p / 100);
		fitText(c, w, 80, v ? p + "%" : "?", { y: 460, size: 56, color: "#ffffff", glow: "#ff4d8a" });
	}, () => JSON.stringify(meterVal()));
	{
		const mg = group(g, METER.x, 0, METER.z, -Math.PI / 2 - 0.4);
		add(mg, rbox(1.0, 2.1, 0.7, 0.08), matOf("#c0285a", 0.5), 0, 1.05, 0);
		add(mg, new THREE.PlaneGeometry(0.62, 1.24), new THREE.MeshBasicMaterial({ map: meterT, toneMapped: false }), 0, 1.35, 0.355, { cast: false });
		const top = k.heartMesh(0.7, "#ffd23a"); top.position.set(0, 2.45, 0); mg.add(top);
		for (const sx of [-0.22, 0.22]) add(mg, new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), goldM, sx, 0.62, 0.38, { rx: Math.PI / 2, cast: false });
		var meterMesh = mg;
		k.box(METER.x - 0.6, METER.x + 0.6, METER.z - 0.6, METER.z + 0.6);
	}
	const MSG = [[95, ["Soulmates! Made for each other.", "Ruh eşi! Birbiriniz için yaratılmışsınız."]], [88, ["Head over heels in love!", "Sırılsıklam aşık!"]], [80, ["Sparks are flying!", "Kıvılcımlar uçuşuyor!"]], [0, ["Sweet! A love that's still growing.", "Tatlı! Hâlâ büyüyen bir aşk."]]];
	const strHash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
	k.interact("rom:meter", {
		label: () => L("Test your love on the love meter", "Aşkınızı aşk ölçerde test edin"), stand: [METER.x - 1.0, METER.z - 0.45], face: Math.PI / 2 + 0.4, reach: 2.6,
		use: () => {
			const m = ctx.me();
			let near = null, bd = 3.5;
			ctx.peers().forEach((p, id) => { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd) { bd = d; near = p; } });
			if (!near) { ctx.toast(L("It takes two hands on the machine... bring your partner!", "Makineye iki el lazım... sevgilini getir!"), null, null, 4500); return; }
			const a = String(ctx.profile().name || "You"), b = String(near.look.name || "?");
			const p = 72 + strHash([a, b].sort().join("♥") + new Date().toDateString()) % 29;
			const msg = TX(MSG.find(x => p >= x[0])[1]);
			ctx.setShared(KEY + "meter", { p, a: a.slice(0, 24), b: b.slice(0, 24), t: Date.now() });
			ctx.sfx("dice", 0.6);
			setTimeout(() => { ctx.sfx("yes", 0.6); ctx.heartsFx(ctx.myAvatar().root, 8, "#ff2d55"); ctx.toast(`💞 <b>${esc(a)} + ${esc(b)}: ${p}%</b><br>${msg}`, null, null, 8000); ctx.send({ t: "chat", text: `💞 ${a} + ${b}: ${p}% - ${msg}`, auto: 1 }); }, 1400);
		}
	}, meterMesh);

	// ================================================================ the picnic, north of the pond
	{
		const PX = POND.x, PZ = POND.z + POND.r + 4.6;
		const check = canvasTex(256, 256, c => { for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { c.fillStyle = (i + j) % 2 ? "#ffffff" : "#e8324a"; c.fillRect(i * 32, j * 32, 32, 32); } });
		const blanket = add(g, new THREE.PlaneGeometry(3.4, 2.6), mat("#ffffff", 0.95, 0, { map: check }), PX, 0.02, PZ, { rx: -Math.PI / 2, cast: false });
		const ids = ["romPicA", "romPicB"];
		[-0.35, 0.35].forEach((dx, j) => { add(g, new THREE.CylinderGeometry(0.3, 0.32, 0.22, 16), matOf(j ? "#ff8ab0" : "#c06aff", 0.9), PX + dx, 0.11, PZ + 0.5); k.spot({ id: ids[j], x: PX + dx, z: PZ + 0.5, h: Math.PI, y: -0.14 }); });
		const basket = group(g, PX + 1.1, 0, PZ - 0.5);
		add(basket, rbox(0.6, 0.35, 0.42, 0.05), matOf("#a8783a", 0.95), 0, 0.18, 0);
		add(basket, new THREE.TorusGeometry(0.22, 0.025, 6, 16, Math.PI), matOf("#8a5a2a", 0.9), 0, 0.35, 0, { cast: false });
		for (const [dx, c] of [[-0.6, "#d81a3a"], [-0.4, "#ff4d6d"], [-0.2, "#d81a3a"]]) add(g, new THREE.SphereGeometry(0.06, 8, 6), matOf(c, 0.6), PX + dx, 0.06, PZ - 0.6, { cast: false });
		add(g, new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8), matOf("#2a5a3a", 0.2, 0.3), PX - 0.9, 0.15, PZ - 0.4, { cast: false });
		k.interact("rom:picnic", { label: () => L("Sit on the picnic blanket", "Piknik örtüsüne otur"), stand: [PX, PZ + 1.6], sit: ids }, blanket);
		k.interact("rom:basket", { label: () => L("Open the picnic basket", "Piknik sepetini aç"), stand: [PX + 1.1, PZ - 1.3], face: 0, reach: 2.6, use: () => ctx.foodMenu(L("The picnic basket", "Piknik sepeti"), ["strawberry", "cake", "juice", "apple", "sandwich", "icecream"]) }, basket);
	}

	// ================================================================ fireworks over the pond (for everyone)
	const FW = { x: 21.5, z: 2.4, len: 22 };
	const fwStart = () => { const v = ctx.get(KEY + "fw"); return typeof v === "number" ? v : 0; };
	// the show is worked out from its start time, so everyone sees the same bursts: [when, x, y, z, colour]
	let fwPlan = [], fwKey = -1;
	const fwCols = ["#ff4d6d", "#ffd23a", "#c06aff", "#6ad0ff", "#7ae582", "#ffffff", "#ff8ab0"];
	function planShow(st) {
		let sd = st % 100000 + 1;
		const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
		fwPlan = [];
		for (let i = 0; i < 26; i++) fwPlan.push([1 + i * 0.75 + r() * 0.5 + (i > 20 ? -i * 0.3 + 6 : 0), POND.x + (r() - 0.5) * 12, 13 + r() * 9, POND.z + (r() - 0.5) * 12, fwCols[i % fwCols.length], i % 5 === 4 ? 1 : 0]);
	}
	const SPARKS = 48, BURSTS = 6;
	const fwIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), SPARKS * BURSTS);
	fwIM.frustumCulled = false; fwIM.castShadow = false; fwIM.visible = false; g.add(fwIM);
	const sparkDir = [];
	for (let i = 0; i < SPARKS; i++) { const a = i * 2.39996, y = 1 - (i + 0.5) / SPARKS * 2, rr = Math.sqrt(1 - y * y); sparkDir.push([Math.cos(a) * rr, y, Math.sin(a) * rr]); }
	{
		const post = group(g, FW.x, 0, FW.z);
		add(post, new THREE.CylinderGeometry(0.08, 0.1, 1.0, 10), ironM, 0, 0.5, 0);
		add(post, rbox(0.45, 0.25, 0.45, 0.04), matOf("#2a2a30", 0.4), 0, 1.1, 0);
		var fwBtn = add(post, new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16), glow("#ff2a2a"), 0, 1.26, 0, { cast: false });
		add(g, new THREE.PlaneGeometry(1.5, 0.32), signM(() => L("Fireworks!", "Havai fişek!"), { bg: "#1a1020", color: "#ffd23a", size: 110 }), FW.x, 1.65, FW.z - 0.01, { ry: Math.PI, cast: false });
		k.box(FW.x - 0.3, FW.x + 0.3, FW.z - 0.3, FW.z + 0.3);
		k.interact("rom:fireworks", {
			label: () => Date.now() - fwStart() < FW.len * 1000 ? L("The fireworks are on!", "Havai fişekler patlıyor!") : L("Light up the sky with fireworks", "Gökyüzünü havai fişeklerle aydınlat"), stand: [FW.x, FW.z - 0.9], face: 0, reach: 2.4,
			use: () => {
				if (Date.now() - fwStart() < FW.len * 1000) { ctx.toast(L("Look up! The show's already on.", "Yukarı bak! Gösteri zaten başladı."), null, null, 3000); return; }
				ctx.setShared(KEY + "fw", Date.now()); ctx.sfx("go", 0.5);
				ctx.send({ t: "fx", kind: "sys", text: L(`${ctx.profile().name || "Someone"} lit the fireworks at the Lovers' Garden`, `${ctx.profile().name || "Biri"} Aşıklar Bahçesi'nde havai fişekleri yaktı`) });
			}
		}, post);
	}
	const _fc = new THREE.Color();
	let fwSounded = -1;
	function fireworks(t) {
		const st = fwStart(), el = (Date.now() - st) / 1000;
		if (st !== fwKey) { fwKey = st; planShow(st); fwSounded = -1; }
		const on = st && el >= 0 && el < FW.len + 3;
		fwBtn.material.color.set(on ? "#3a1010" : Math.sin(t * 4) > 0 ? "#ff2a2a" : "#a01010");
		fwIM.visible = !!on;
		if (!on) return;
		let slot = 0;
		const m = ctx.me(), close = Math.hypot(m.x - OX - POND.x, m.z - OZ - POND.z) < 60;
		for (let bi = 0; bi < fwPlan.length && slot < BURSTS; bi++) {
			const [when, x, y, z, col, big] = fwPlan[bi], age = el - when;
			if (age < 0 || age > 2.4) continue;
			if (bi > fwSounded && close) { fwSounded = bi; ctx.sfx(big ? "crash" : "kick", big ? 0.35 : 0.25); }
			const rad = (big ? 7 : 4.5) * (1 - Math.exp(-age * 2.6)), drop = age * age * 0.9, fade = Math.max(0, 1 - age / 2.4);
			_fc.set(col).multiplyScalar(0.4 + 0.6 * fade);
			for (let i = 0; i < SPARKS; i++) {
				const d = sparkDir[i], id = slot * SPARKS + i;
				_d.position.set(x + d[0] * rad, y + d[1] * rad - drop, z + d[2] * rad);
				_d.rotation.set(0, 0, 0); _d.scale.setScalar(0.4 + fade * (big ? 1.4 : 1)); _d.updateMatrix();
				fwIM.setMatrixAt(id, _d.matrix); fwIM.setColorAt(id, _fc);
			}
			slot++;
		}
		for (let id = slot * SPARKS; id < SPARKS * BURSTS; id++) { _d.position.set(0, -50, 0); _d.scale.setScalar(0.001); _d.updateMatrix(); fwIM.setMatrixAt(id, _d.matrix); }
		fwIM.instanceMatrix.needsUpdate = true; if (fwIM.instanceColor) fwIM.instanceColor.needsUpdate = true;
	}
	// the attractions, every frame
	function attractions(dt, t) {
		const s = clockS();
		wheel.rotation.z = -s / WHEEL.lap * TAU;
		cabins.forEach((cg, i) => { const c = cabinAt(i, s); cg.position.set(c.x, c.y, c.z); cg.rotation.z = Math.sin(s * 0.8 + i) * 0.04; });
		const b = balloonAt(s);
		balloon.position.set(b.x, b.y, b.z); balloon.rotation.y = s * 0.05;
		flame.visible = b.burn || (b.grounded && b.wait < 3); flame.scale.set(1, 0.8 + 0.4 * Math.abs(Math.sin(t * 15)), 1);
		playSong(dt);
		fountHeart.rotation.y = t * 0.6;
		jets.forEach((j, i) => { const u = (t * 0.9 + i / jets.length) % 1; j.m.position.set(FOUNT.x + Math.cos(j.a) * u * 1.6, 1.6 + Math.sin(u * Math.PI) * 0.9 - u * 1.1, FOUNT.z + Math.sin(j.a) * u * 1.6); });
		if (coin) { coin.t += dt; const u = Math.min(1, coin.t / 0.8); coin.m.position.set(FOUNT.x - 2.6 + u * 2.2, 1.2 + Math.sin(u * Math.PI) * 1.2 - u * 0.75, FOUNT.z); coin.m.rotation.x = coin.t * 14; if (coin.t > 0.85) { g.remove(coin.m); coin = null; } }
		fireworks(t);
	}
	// love seats round the pond, facing the water
	for (const a of [0.8, 2.35, 3.95, 5.5]) { const x = POND.x + Math.cos(a) * (POND.r + 2.2), z = POND.z + Math.sin(a) * (POND.r + 2.2); loveSeat(x, z, Math.atan2(POND.x - x, POND.z - z)); }

	// ================================================================ the kissing arch, on the way in
	const KISS = { x: -14, z: 0 };
	{
		for (const s of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), goldM, KISS.x, 1.3, s * 1.5); k.box(KISS.x - 0.12, KISS.x + 0.12, s * 1.5 - 0.12, s * 1.5 + 0.12); }
		add(g, new THREE.TorusGeometry(1.5, 0.06, 8, 24, Math.PI), goldM, KISS.x, 2.6, 0, { ry: Math.PI / 2 });
		const kh = k.heartMesh(0.9, "#ff2d6d"); kh.position.set(KISS.x, 4.35, 0); kh.material.emissiveIntensity = 0.7; g.add(kh);
		var kissHeart = kh;
		add(g, new THREE.CircleGeometry(0.75, 24), pinkGlow, KISS.x, 0.02, 0, { rx: -Math.PI / 2, cast: false });
		lights([KISS.x, 2.5, -1.5], [KISS.x, 2.5, 1.5], 10, -0.9);
		const sign = add(g, new THREE.PlaneGeometry(2.4, 0.4), signM(() => L("Kiss under the arch", "Kemerin altında öpüş"), { color: "#ffffff", glow: "#ff4d8a", size: 110 }), KISS.x - 0.05, 3.25, 0, { ry: -Math.PI / 2, cast: false, receive: false });
		k.interact("rom:kiss", {
			label: () => L("Kiss under the arch", "Kemerin altında öpüş"), stand: [KISS.x - 0.4, 0], face: Math.PI / 2, reach: 2.4,
			use: () => {
				const m = ctx.me();
				let near = null, bd = 3.2;
				ctx.peers().forEach((p, id) => { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd && !p.sit) { bd = d; near = id; } });
				if (!near) { ctx.toast(L("Bring someone special under the arch... a kiss here is magic.", "Kemerin altına özel birini getir... burada bir öpücük büyülüdür."), null, null, 5000); return; }
				ctx.loveAct("smooch");
				petals(KISS.x, 0, true);
			}
		}, sign);
	}

	// ================================================================ the love-lock fence (south of the pond)
	const LOCKZ = POND.z - POND.r - 3.0, LOCKX0 = POND.x - 5, LOCKX1 = POND.x + 5;
	const locksOf = () => { const v = ctx.get(KEY + "locks"); return Array.isArray(v) ? v.filter(e => e && typeof e.n === "string").slice(-48) : []; };
	const lockMeshes = [];
	{
		for (let i = 0; i <= 10; i++) add(g, new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), ironM, LOCKX0 + (LOCKX1 - LOCKX0) * i / 10, 0.55, LOCKZ, { cast: false });
		for (const y of [0.55, 0.8, 1.05]) add(g, new THREE.BoxGeometry(LOCKX1 - LOCKX0, 0.025, 0.025), ironM, (LOCKX0 + LOCKX1) / 2, y, LOCKZ, { cast: false });
		k.box(LOCKX0, LOCKX1, LOCKZ - 0.08, LOCKZ + 0.08);
		const cols = ["#d8b04a", "#ff4d6d", "#ff8ab0", "#c06aff", "#4ab8ff", "#7ae582"];
		for (let i = 0; i < 48; i++) {
			const lg = group(g, LOCKX0 + 0.25 + (i % 16) * ((LOCKX1 - LOCKX0 - 0.5) / 15), [0.55, 0.8, 1.05][i / 16 | 0] - 0.07, LOCKZ + (i % 2 ? 0.04 : -0.04));
			add(lg, new THREE.BoxGeometry(0.09, 0.08, 0.04), matOf(cols[i % cols.length], 0.35, 0.6), 0, 0, 0, { cast: false });
			add(lg, new THREE.TorusGeometry(0.03, 0.009, 4, 10, Math.PI), matOf("#c8ccd2", 0.3, 0.8), 0, 0.04, 0, { cast: false });
			lg.visible = false; lockMeshes.push(lg);
		}
		const board = group(g, LOCKX1 + 1.2, 0, LOCKZ, 0);
		add(board, new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), darkWood, 0, 1.1, 0.06, { cast: false });
		var lockBoard = add(board, new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: liveTex(512, 512, (c, w, h) => {
			c.fillStyle = "#fff4f6"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c0285a"; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
			fitText(c, w, 90, L("LOVE LOCKS", "AŞK KİLİTLERİ"), { y: 52, size: 54, color: "#c0285a" });
			const list = locksOf().slice(-9).reverse();
			if (!list.length) fitText(c, w, 60, L("Be the first to hang one!", "İlk kilidi sen as!"), { y: h / 2, size: 34, color: "#6a4a5a", weight: 700 });
			list.forEach((e, i) => fitText(c, w - 40, 50, e.n, { y: 120 + i * 42, size: 34, color: "#3a2a30", weight: 700, family: "Caveat, Nunito, cursive" }));
		}, () => JSON.stringify(locksOf().slice(-9))), toneMapped: false }), 0, 1.55, 0, { cast: false });
		k.interact("rom:locks", {
			label: () => L("Hang a love lock", "Bir aşk kilidi as"), stand: [(LOCKX0 + LOCKX1) / 2, LOCKZ + 0.9], face: Math.PI, reach: 3,
			use: () => {
				const body = ctx.openModal("lovelock", L("Hang a love lock", "Bir aşk kilidi as"), `<p style="margin:0 0 10px;line-height:1.5">${L("Write your names on a lock and hang it on the fence, for everyone to see. Then throw away the key!", "İsimlerinizi bir kilide yazın ve herkes görsün diye çite asın. Sonra anahtarı atın!")}</p><input class="input" id="rom-lock" maxlength="40" placeholder="${L("e.g. Ali ♥ Ayşe", "örn. Ali ♥ Ayşe")}" autocomplete="off"><div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn primary" id="rom-lock-go">${L("Hang it", "As")}</button></div>`, 420);
				const inp = body.querySelector("#rom-lock");
				const go = () => {
					const n = inp.value.replace(/\s+/g, " ").trim().slice(0, 40);
					if (!n) return;
					ctx.setShared(KEY + "locks", locksOf().concat([{ n, by: String(ctx.profile().name || "").slice(0, 24), t: Date.now() }]).slice(-48));
					ctx.closeModal(); ctx.sfx("clack", 0.6); ctx.sfx("love", 0.5); ctx.heartsFx(ctx.myAvatar().root, 6);
					ctx.toast(L("Click! Your lock is on the fence. The key goes in the pond...", "Klik! Kilidin çitte. Anahtar göle gidiyor..."), null, null, 5000);
					ctx.send({ t: "fx", kind: "sys", text: L(`${ctx.profile().name || "Someone"} hung a love lock: ${n}`, `${ctx.profile().name || "Biri"} bir aşk kilidi astı: ${n}`) });
				};
				inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") go(); });
				body.querySelector("#rom-lock-go").onclick = go;
				setTimeout(() => inp.focus(), 60);
			}
		}, lockBoard);
	}

	// ================================================================ sky lanterns
	const LANT = { x: 17, z: 2.6 };
	const lanterns = [];
	{
		add(g, rbox(1.4, 0.08, 0.7, 0.02), woodM, LANT.x, 0.8, LANT.z);
		for (const [dx, dz] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]]) add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), darkWood, LANT.x + dx, 0.4, LANT.z + dz, { cast: false });
		k.box(LANT.x - 0.75, LANT.x + 0.75, LANT.z - 0.4, LANT.z + 0.4);
		const paperM = new THREE.MeshStandardMaterial({ color: "#ffb86b", emissive: "#ff8a2a", emissiveIntensity: 1.2, transparent: true, opacity: 0.92 });
		for (let i = 0; i < 3; i++) add(g, new THREE.CylinderGeometry(0.12, 0.09, 0.26, 10), paperM, LANT.x - 0.4 + i * 0.4, 0.97, LANT.z, { cast: false });
		for (let i = 0; i < 10; i++) { const m = add(g, new THREE.CylinderGeometry(0.22, 0.16, 0.45, 12), paperM.clone(), 0, -10, 0, { cast: false }); m.visible = false; lanterns.push({ m, t: -1, x: 0, z: 0, ph: R() * TAU }); }
		const sign = add(g, new THREE.PlaneGeometry(1.4, 0.32), signM(() => L("Sky lanterns: make a wish", "Dilek fenerleri: bir dilek tut"), { bg: "#fff4f6", color: "#c0285a", size: 90 }), LANT.x, 1.15, LANT.z - 0.36, { ry: Math.PI, cast: false });
		k.interact("rom:lantern", {
			label: () => L("Make a wish and light a sky lantern", "Bir dilek tut ve dilek feneri uçur"), stand: [LANT.x, LANT.z - 1.1], face: 0, reach: 2.4,
			use: () => { launch(LANT.x, LANT.z); ctx.send({ t: "fx", kind: "zfx", zone: "romance", what: "lantern" }); ctx.sfx("whoosh", 0.3); ctx.toast(L("Up it floats with your wish...", "Dileğinle birlikte yükseliyor..."), null, null, 3500); }
		}, sign);
	}
	function launch(x, z) { const L2 = lanterns.find(l => l.t < 0) || lanterns[0]; L2.t = 0; L2.x = x + (Math.random() - 0.5) * 0.6; L2.z = z + (Math.random() - 0.5) * 0.4; L2.m.visible = true; }

	// ================================================================ roses, fairy lights, fireflies, petals
	{
		const types = [["#d81a3a", roseGeo], ["#ff7aa2", roseGeo], ["#ff9ab8", new THREE.CircleGeometry(1, 6)], ["#2f6a34", roseGeo], ["#e8c04a", new THREE.CircleGeometry(1, 8)]];
		types.forEach(([c, geo], ti) => {
			const list = roseSpots.filter(r => r[4] === ti);
			if (!list.length) return;
			const im = new THREE.InstancedMesh(geo, ti === 2 ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }) : ti === 4 ? matOf(c, 0.3, 0.8) : matOf(c, 0.7), list.length);
			list.forEach((r, i) => { _d.position.set(r[0], r[1], r[2]); _d.rotation.set(ti === 2 || ti === 4 ? -Math.PI / 2 : 0, R() * 6, 0); _d.scale.setScalar(r[3]); _d.updateMatrix(); im.setMatrixAt(i, _d.matrix); });
			im.castShadow = false; g.add(im);
		});
		const bim = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), fairyM, bulbs.length);
		bulbs.forEach((b, i) => { _d.position.set(b[0], b[1], b[2]); _d.rotation.set(0, 0, 0); _d.scale.setScalar(1); _d.updateMatrix(); bim.setMatrixAt(i, _d.matrix); });
		bim.castShadow = false; g.add(bim);
	}
	const FLIES = 60, flyAt = [];
	const flies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), glow("#e8ff8a"), FLIES);
	for (let i = 0; i < FLIES; i++) flyAt.push([X0 + 2 + R() * (X1 - X0 - 4), 0.5 + R() * 2.2, Z0 + 2 + R() * (Z1 - Z0 - 4), R() * TAU]);
	flies.castShadow = false; flies.frustumCulled = false; g.add(flies);
	// a shower of rose petals (under the kissing arch)
	const PET = 80, petalIM = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 6), new THREE.MeshBasicMaterial({ color: "#ff5a8a", side: THREE.DoubleSide, toneMapped: false }), PET);
	petalIM.frustumCulled = false; petalIM.castShadow = false; petalIM.visible = false; g.add(petalIM);
	const petalP = [];
	let petalT = -1, petalAt = [0, 0];
	function petals(x, z, mine) {
		petalT = 0; petalAt = [x, z]; petalIM.visible = true;
		petalP.length = 0;
		for (let i = 0; i < PET; i++) petalP.push([(Math.random() - 0.5) * 3, 3.6 + Math.random() * 1.6, (Math.random() - 0.5) * 3, Math.random() * TAU, 0.6 + Math.random() * 0.6]);
		if (mine) ctx.send({ t: "fx", kind: "zfx", zone: "romance", what: "petals" });
	}

	// ================================================================ every frame
	let slow = 0, welcomed = false;
	function update(dt, t) {
		const s = clockS(), b = boatAt(s);
		boat.position.set(b.x, Math.sin(s * 1.3) * 0.02, b.z); boat.rotation.y = b.h; boat.rotation.z = Math.sin(s * 0.9) * 0.03;
		bigHeart.rotation.y = t * 0.5; bigHeart.position.y = 1.6 + Math.sin(t * 1.2) * 0.12;
		const beat = 1 + Math.max(0, Math.sin(t * 5)) * 0.06 * (Math.sin(t * 2.5) > 0 ? 1 : 0);
		bigHeart.scale.setScalar(beat); kissHeart.scale.setScalar(beat);
		attractions(dt, t);
		pondWater.color.setHSL(0.6, 0.6, 0.52 + 0.03 * Math.sin(t * 1.4));
		for (let i = 0; i < FLIES; i++) {
			const f = flyAt[i];
			_d.position.set(f[0] + Math.sin(t * 0.3 + f[3]) * 1.2, f[1] + Math.sin(t * 0.7 + f[3] * 2) * 0.3, f[2] + Math.cos(t * 0.25 + f[3]) * 1.2);
			_d.rotation.set(0, 0, 0); _d.scale.setScalar(0.4 + 0.6 * Math.max(0, Math.sin(t * 2.1 + f[3] * 3))); _d.updateMatrix(); flies.setMatrixAt(i, _d.matrix);
		}
		flies.instanceMatrix.needsUpdate = true;
		for (const l of lanterns) {
			if (l.t < 0) continue;
			l.t += dt;
			l.m.position.set(l.x + Math.sin(l.t * 0.4 + l.ph) * 0.6 * Math.min(1, l.t / 3), 1.1 + l.t * 0.9, l.z + Math.cos(l.t * 0.3 + l.ph) * 0.5 * Math.min(1, l.t / 3));
			l.m.material.opacity = 0.92 * Math.min(1, Math.max(0, (24 - l.t) / 4));
			if (l.t > 24) { l.t = -1; l.m.visible = false; }
		}
		if (petalT >= 0) {
			petalT += dt;
			for (let i = 0; i < PET; i++) {
				const p = petalP[i], y = Math.max(0.03, p[1] - petalT * p[4]);
				_d.position.set(petalAt[0] + p[0] + Math.sin(petalT * 2 + p[3]) * 0.3, y, petalAt[1] + p[2] + Math.cos(petalT * 1.6 + p[3]) * 0.3);
				_d.rotation.set(petalT * 3 + p[3], petalT * 2, 0); _d.scale.setScalar(1); _d.updateMatrix(); petalIM.setMatrixAt(i, _d.matrix);
			}
			petalIM.instanceMatrix.needsUpdate = true;
			if (petalT > 9) { petalT = -1; petalIM.visible = false; }
		}
		slow -= dt;
		if (slow <= 0) {
			slow = 0.3;
			live.forEach(paint);
			const n = locksOf().length;
			lockMeshes.forEach((m, i) => { m.visible = i < n; });
		}
	}

	return {
		update,
		onEnter() { if (welcomed) return; welcomed = true; ctx.toast(L("<b>Welcome to the Lovers' Garden.</b> Ride the Love Wheel or the balloon for two, slow dance to our song, take the swan boat, kiss under the arch, test your love, have a picnic, hang a love lock, light up the sky with fireworks...", "<b>Aşıklar Bahçesi'ne hoş geldiniz.</b> Aşk Dönmedolabı'na ya da iki kişilik balona binin, şarkımızla ağır dans edin, kuğu tekneye binin, kemerin altında öpüşün, aşkınızı ölçün, piknik yapın, bir aşk kilidi asın, gökyüzünü havai fişeklerle aydınlatın..."), null, null, 10000); },
		onFx(d) { if (d.what === "lantern") launch(LANT.x, LANT.z); else if (d.what === "petals") petals(KISS.x, 0, false); }
	};
}
