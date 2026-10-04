/**
 * Harmony World — the rest of the house.
 *
 * One connected home. The living room's French doors (by the arcade) open into
 * a big two-storey lounge: a sofa round a double-sided fireplace, an open
 * kitchen and dining table on the other side of it, a pet corner, and stairs up
 * to a balcony with the cinema's doors. Off the back of the lounge: the bedroom
 * and the bathroom. Out through the gap in the terrace railing: the pool, under
 * the sky. Biscuit and Mochi wander the whole house (worldPets.js).
 *
 * Each room is its own module and its own group. They're all built in the
 * background shortly after you arrive (a tenth of a second each), but a room is
 * only drawn while you're in it or next to it (you see into the next room
 * through an open door), so the house costs nothing where you aren't.
 *
 * Lights: three.js recompiles every shader when the number of lights changes,
 * so the house never adds lights. It owns a fixed pool of point lights (as many
 * as the living room uses), plus the living room's ceiling spot (which casts
 * the shadows) and its fill light, and moves them into whichever room you're
 * in. (The pool is outdoors: it keeps the terrace's lights and the moon.)
 *
 * A room module exports build(k): k is a kit of local-coordinate helpers (see
 * makeKit). Everything the room registers (colliders, seats, things to use)
 * goes into the same lists the living room uses, in world coordinates, so the
 * rest of the world (walking, sitting, cuddling, prompts) just works there.
 */
import * as THREE from "three";
import { kit, registerArea, floorAt, areaOf, frenchDoor } from "./worldRoom.js";
import { roundRect } from "./worldAvatar.js";
import { createPets } from "./worldPets.js";

// where each room sits in the world (its local origin), the area it covers [minX, maxX, minZ, maxZ],
// and which rooms you can see into from it through open doors
// (ry turns a room round: the cinema is built facing +z and turned so its doors face the living room)
export const ZONES = {
	lounge:  { name: "Lounge",   ox: 15.2,   oy: 0,    oz: 1.0,   bounds: [7.1, 23.25, -6.05, 8.05],   see: ["main", "bedroom", "bath", "pool", "loft"], file: "./worldLounge.js" },
	// upstairs, over the east half of the lounge: drawn there (vis), but on the floor plan it's 30 m further south,
	// so the two floors never overlap (see shiftAt). The stairs carry you across (portals in worldLoft.js).
	disco:   { name: "Disco",    ox: 15.2,   oy: 3.6,  oz: 31.0,  vis: [15.2, 1.0], bounds: [18.4, 23.15, 32.2, 37.95], see: ["loft"], file: "./worldDisco.js" },
	loft:    { name: "Upstairs", ox: 15.2,   oy: 3.6,  oz: 31.0,  vis: [15.2, 1.0], bounds: [16.2, 23.15, 24.05, 37.95], see: ["lounge", "disco", "pool", "main"], borrow: "lounge", file: "./worldLoft.js" },
	cinema:  { name: "Cinema",   ox: -13.25, oy: -1.8, oz: -3.5,  ry: Math.PI / 2, bounds: [-22.6, -7.05, -8.8, 1.8], see: ["main"], file: "./worldCinema.js" },
	bedroom: { name: "Bedroom",  ox: 28.4,   oy: 0,    oz: -4,    bounds: [23.25, 33.6, -8.62, 0.75],  see: ["lounge", "pool", "loft"], file: "./worldBedroom.js" },
	bath:    { name: "Bathroom", ox: 27.4,   oy: 0,    oz: 4.7,   bounds: [23.25, 31.6, 0.95, 8.4],    see: ["lounge", "loft"], file: "./worldBath.js" },
	pool:    { name: "Pool",     ox: 19.55,  oy: 0,    oz: -12.1, bounds: [5.45, 33.6, -18.1, -6.15],  see: ["main", "lounge", "bedroom", "loft"], outdoor: true, file: "./worldPool.js" }
};
// what you can see from the living room / terrace
const MAIN_SEES = ["lounge", "pool", "cinema", "loft"];
const BUILD_ORDER = ["lounge", "loft", "pool", "bedroom", "bath", "cinema", "disco"];

export function createHouse(ctx) {
	const { scene, room, renderer, camera } = ctx;
	const built = {};       // id -> zone
	const loading = {};     // id -> promise
	// every room's area is registered up front, so everyone knows which room each person is in, built or not
	for (const id in ZONES) {
		const Z = ZONES[id], b = Z.bounds;
		Z.area = registerArea({ id, bounds: { minX: b[0], maxX: b[1], minZ: b[2], maxZ: b[3] } });
		if (Z.vis) Z.area.shift = [Z.ox - Z.vis[0], Z.oz - Z.vis[1]];
	}

	// the living room, the terrace and the sky go in one group, so they can be switched off in one go
	const mainGroup = new THREE.Group();
	mainGroup.name = "livingRoom";
	scene.children.filter(o => !o.isLight).forEach(o => mainGroup.add(o));
	scene.add(mainGroup);

	// lights: a fixed pool the size of the living room's, moved into whichever room you are in
	const nPool = room.areaLights.room.length + room.minorLights.room.length;
	const pool = [];
	for (let i = 0; i < nPool; i++) {
		const l = new THREE.PointLight("#000000", 0, 1, 2);
		l.position.set(0, -50, 0);
		l.visible = false;
		scene.add(l);
		pool.push(l);
	}
	const ML = room.mainLight, FL = room.fillLight;
	const mainSaved = { pos: ML.position.clone(), target: ML.target.position.clone(), color: ML.color.clone(), angle: ML.angle, penumbra: ML.penumbra, distance: ML.distance, decay: ML.decay, fpos: FL.position.clone(), fcolor: FL.color.clone(), fdist: FL.distance, fdecay: FL.decay };

	let region = "main";     // "main" (living room + terrace) or a room id
	let lit = "main";        // whose lights are on: "main" or an indoor room id
	let visibleSet = new Set(["main"].concat(MAIN_SEES));
	let pets = null;

	function regionOf(area) { return ZONES[area] ? area : "main"; }

	// the header's Night button works in every room: the big lights go down, lamps and candles glow on
	let nightK = 0;
	function applyLights(Z) {
		const n = nightK;
		const list = Z.borrow && built[Z.borrow] ? Z.lights.concat(built[Z.borrow].lights) : Z.lights;
		for (let i = 0; i < pool.length; i++) {
			const l = pool[i], d = list[i];
			if (d) { l.position.copy(d.pos); l.color.copy(d.color); l.intensity = d.intensity * (1 + n * 0.15); l.distance = d.distance; l.decay = d.decay; }
			else { l.intensity = 0; l.position.set(Z.ox, -50, 0); }
		}
		const key = Z.key;
		ML.position.copy(key.pos); ML.target.position.copy(key.target); ML.target.updateMatrixWorld();
		ML.color.copy(key.color); ML.intensity = key.intensity * (1 - n * 0.85); ML.angle = key.angle; ML.penumbra = key.penumbra; ML.distance = key.distance; ML.decay = key.decay;
		const f = Z.fill;
		FL.position.copy(f.pos); FL.color.copy(f.color); FL.intensity = f.intensity * (1 - n * 0.7); FL.distance = f.distance; FL.decay = f.decay;
		ctx.hemi.intensity = Z.hemi * (1 - n * 0.7);
		ctx.moon.intensity = 0;
		scene.environmentIntensity = Z.env * (1 - n * 0.7);
		renderer.toneMappingExposure = Z.exposure * (1 - n * 0.05);
	}
	function restoreMain() {
		ML.position.copy(mainSaved.pos); ML.target.position.copy(mainSaved.target); ML.target.updateMatrixWorld();
		ML.color.copy(mainSaved.color); ML.angle = mainSaved.angle; ML.penumbra = mainSaved.penumbra; ML.distance = mainSaved.distance; ML.decay = mainSaved.decay;
		FL.position.copy(mainSaved.fpos); FL.color.copy(mainSaved.fcolor); FL.distance = mainSaved.fdist; FL.decay = mainSaved.fdecay;
		pool.forEach(l => { l.visible = false; });
		ctx.restoreMainLights();   // ceiling light / lamp on or off, night mode
	}
	// which rooms get drawn: the one you're in and the ones you can see into
	function applyVisibility() {
		visibleSet = new Set([region].concat(region === "main" ? MAIN_SEES : ZONES[region].see));
		for (const id in built) built[id].group.visible = visibleSet.has(id);
		mainGroup.visible = visibleSet.has("main");
	}
	function setRegion(r) {
		if (r === region) return;
		const prev = region;
		region = r;
		if (built[prev] && built[prev].onLeave) built[prev].onLeave();
		applyVisibility();
		// the pool is outdoors: it keeps the living room / terrace lighting
		const wantLit = r !== "main" && !ZONES[r].outdoor ? r : "main";
		if (wantLit !== lit) {
			lit = wantLit;
			if (lit === "main") restoreMain();
			else { pool.forEach(l => { l.visible = true; }); if (built[lit]) applyLights(built[lit]); }
		}
		if (built[r] && built[r].onEnter) built[r].onEnter();
		ctx.onRegion(r);
		renderer.shadowMap.needsUpdate = true;
	}

	// ---------------------------------------------------------------- building rooms (in the background, once)
	function ensure(id) {
		if (built[id]) return Promise.resolve(built[id]);
		if (loading[id]) return loading[id];
		const Z = ZONES[id];
		loading[id] = import(Z.file).then(mod => {
			const k = makeKit(id);
			const t0 = performance.now();
			const api = mod.build(k) || {};
			const zone = finishZone(id, k, api);
			built[id] = zone;
			delete loading[id];
			if (ctx.debug) console.log(`[house] built ${id} in ${Math.round(performance.now() - t0)}ms`);
			// shaders for everything in it, in the background, so walking in never stutters
			zone.group.visible = true;
			try { renderer.compileAsync(zone.group, camera, scene).catch(() => {}); } catch (e) { /* older browsers: compiled on first sight instead */ }
			applyVisibility();
			if (lit === id) applyLights(zone);
			if (region === id && zone.onEnter) zone.onEnter();
			// the pets live in the lounge (their beds and bowls are there) and roam the whole house
			if (id === "lounge" && !pets) pets = createPets(ctx, zone.petSpots, houseApi);
			ctx.onZoneBuilt(id);
			return zone;
		}).catch(err => { delete loading[id]; console.error("[house] could not build " + id, err); throw err; });
		return loading[id];
	}
	// build everything, one room at a time, while the browser has nothing else to do
	const queue = BUILD_ORDER.slice();
	let pumping = false;
	function pump() {
		if (pumping || !queue.length) return;
		pumping = true;
		const idle = window.requestIdleCallback || (fn => setTimeout(fn, 200));
		idle(() => {
			const id = queue.shift();
			const done = () => { pumping = false; setTimeout(pump, 150); };
			if (!id || built[id]) { done(); return; }
			ensure(id).then(done, done);
		}, { timeout: 2000 });
	}

	// ---------------------------------------------------------------- doors (French doors with curtains, shared open / closed)
	const doors = [];
	// fd: a frenchDoor(); col: the doorway's box (blocks walking while the door is closed); stands: where to stand on each side
	function addDoor(id, fd, col, stands, labels) {
		labels = labels || ["Close the door", "Open the door", "Draw the curtains", "Open the curtains"];
		const dk = "z:door:" + id, ck = "z:curt:" + id;
		const isOpen = () => ctx.get(dk) !== false;
		const curtOpen = () => ctx.get(ck) !== false;
		const door = { id, isOpen, open: () => { if (!isOpen()) { ctx.setShared(dk, true); ctx.sfx("door", 0.4); } } };
		room.colliders.push(Object.assign({}, col, { door }));
		const did = "door:" + id, cid = "curtain:" + id;
		room.interactables[did] = { id: did, objects: fd.leaves, nearest: true, stand: stands[0], stands, label: () => isOpen() ? labels[0] : labels[1], use: () => { ctx.setShared(dk, !isOpen()); ctx.sfx("door", 0.5); } };
		fd.leaves.forEach(o => o.traverse(c => { c.userData.interact = did; }));
		room.interactables[cid] = { id: cid, objects: fd.curtains, nearest: true, stand: stands[0], stands, label: () => curtOpen() ? labels[2] : labels[3], use: () => { ctx.setShared(ck, !curtOpen()); ctx.sfx("whoosh", 0.4); } };
		fd.curtains.forEach(o => { o.userData.interact = cid; });
		doors.push({ fd, isOpen, curtOpen });
		return door;
	}
	// ---------------------------------------------------------------- stairs between floors
	// Stepping into a portal's box moves you across the floor plan by (dx, dz): from the top of the lounge's
	// stairs onto the loft and back. It looks seamless because the loft is drawn right there (see ZONES.vis).
	const portals = [];
	// the living room's doors to the lounge
	addDoor("living", room.livingDoor, { minX: 6.95, maxX: 7.3, minZ: 2.9, maxZ: 4.6 }, [[6.2, 3.75], [8.1, 3.75]]);
	addDoor("cinema", room.cinemaDoor, { minX: -7.3, maxX: -6.95, minZ: -4.2, maxZ: -2.8 }, [[-6.2, -3.5], [-8.1, -3.5]]);

	function makeKit(id) {
		const Z = ZONES[id], ox = Z.ox, oy = Z.oy || 0, oz = Z.oz, ry = Z.ry || 0;
		// where it's drawn (the same place, unless it's upstairs over another room)
		const vx = Z.vis ? Z.vis[0] : ox, vz = Z.vis ? Z.vis[1] : oz, shift = Z.area.shift || null;
		const g = new THREE.Group();
		g.name = "zone:" + id;
		g.position.set(vx, oy, vz);
		g.rotation.y = ry;
		g.visible = false;
		scene.add(g);
		// local (x, z) -> world, and back (the room may be turned round by ry)
		const c = Math.round(Math.cos(ry) * 1e6) / 1e6, sn = Math.round(Math.sin(ry) * 1e6) / 1e6;
		const W = p => [ox + p[0] * c + p[1] * sn, oz - p[0] * sn + p[1] * c];
		const Wv = p => [vx + p[0] * c + p[1] * sn, vz - p[0] * sn + p[1] * c];
		const toLocal = (x, z) => { const dx = x - ox, dz = z - oz; return [dx * c - dz * sn, dx * sn + dz * c]; };
		const rect = (x0, x1, z0, z1) => { const a = W([x0, z0]), b = W([x1, z1]); return { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]) }; };
		const k = Object.assign({}, kit, {
			THREE, g, ox, oy, oz, id, ctx, roundRect,
			lights: [],
			key: { pos: new THREE.Vector3(vx, oy + 3, vz), target: new THREE.Vector3(vx, oy, vz), color: new THREE.Color("#ffe2c0"), intensity: 22, angle: 1.2, penumbra: 0.7, distance: 18, decay: 1.6 },
			fill: { pos: new THREE.Vector3(vx, oy + 2.6, vz), color: new THREE.Color("#ffe6c8"), intensity: 5, distance: 26, decay: 1.2 },
			hemi: 0.45, env: 0.28, exposure: 1.05,
			updaters: [],
			cam: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, maxY: 3 },
			W, Wv, ry, shift,
			// a point in the room as it's drawn (lights, the camera): the same as W unless the room is upstairs
			V: (x, y, z) => { const p = Wv([x, z]); return new THREE.Vector3(p[0], y + oy, p[1]); },
			// stairs: step into the box (local coords; below: on the room underneath) and you're moved across
			// to the other floor, nudged on by jx along x. goal: where to walk to use it
			portal(below, x0, x1, z0, z1, jx) {
				const a = (below ? Wv : W)([x0, z0]), b = (below ? Wv : W)([x1, z1]);
				const s = shift || [0, 0], dx = (below ? s[0] : -s[0]) + jx, dz = below ? s[1] : -s[1];
				const r = { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]), dx, dz };
				r.goal = [(r.minX + r.maxX) / 2 + (jx > 0 ? 0.08 : -0.08), (r.minZ + r.maxZ) / 2];
				portals.push(r);
				return r;
			},
			// a framed photo on the wall: one of the shared photo slots (see world.js photoFrame)
			photo(slot, x, y, z, rot, o) { return ctx.photoFrame(g, slot, x, y, z, rot, o || {}, shift); },
			box(x0, x1, z0, z1) { room.colliders.push(rect(x0, x1, z0, z1)); },
			walk(x0, x1, z0, z1) { Z.area.rects.push(rect(x0, x1, z0, z1)); },
			floor(fn) { Z.area.floor = (x, z) => { const l = toLocal(x, z); return fn(l[0], l[1]) + oy; }; },
			spot(s) {
				const p = W([s.x, s.z]);
				const w = Object.assign({}, s, { x: p[0], z: p[1], y: s.y + oy, h: s.h + ry });
				if (s.stand) w.stand = W(s.stand);
				if (s.side) w.side = W(s.side);
				room.sitSpots.push(w);
				return w;
			},
			interact(iid, def, ...objs) {
				def.id = iid;
				def.objects = objs;
				// (a stand that's a getter - something that moves, like a pet - already answers in world coordinates)
				const sd = Object.getOwnPropertyDescriptor(def, "stand");
				if (sd && !sd.get && def.stand) def.stand = W(def.stand);
				if (def.stands) def.stands = def.stands.map(W);
				if (def.face !== undefined) def.face += ry;
				if (shift) def.shift = shift;
				objs.forEach(o => o.traverse(ch => { ch.userData.interact = iid; }));
				room.interactables[iid] = def;
				return def;
			},
			// one of this room's lights (the house moves the shared light pool here while you're in it)
			light(x, y, z, color, intensity, distance = 6, decay = 2) {
				const d = { pos: k.V(x, y, z), color: new THREE.Color(color), intensity, base: intensity, distance, decay };
				k.lights.push(d);
				return d;
			},
			// a lamp you can switch on and off (shared): its light (may be null), the materials that glow,
			// the objects you click, where you stand to reach it, and what to call it
			lamp(name, light, glows, objs, stand, label) {
				const key = "z:" + id + ":lamp:" + name;
				const on = () => ctx.get(key) !== false;
				const base = glows.map(m => m.isMeshBasicMaterial ? m.color.clone() : m.emissiveIntensity);
				let kOn = 1;
				k.updaters.push(dt => {
					kOn += ((on() ? 1 : 0) - kOn) * Math.min(1, dt * 8);
					if (light) light.intensity = light.base * kOn;
					glows.forEach((m, i) => {
						if (m.isMeshBasicMaterial) m.color.copy(base[i]).multiplyScalar(0.18 + 0.82 * kOn);
						else m.emissiveIntensity = base[i] * (0.03 + 0.97 * kOn);
					});
				});
				k.interact(id + ":lamp:" + name, { label: () => (on() ? "Turn off the " : "Turn on the ") + (label || "lamp"), stand, reach: 2.6, use: () => { ctx.setShared(key, !on()); ctx.sfx("switch"); } }, ...objs);
				return { on, light };
			},
			// French doors in this room's wall (local position), shared open / closed; col: local doorway box [x0, x1, z0, z1]
			frenchDoor(did, o, col, stands) {
				const fd = frenchDoor(g, o);
				addDoor(did, fd, rect(col[0], col[1], col[2], col[3]), stands.map(W));
				return fd;
			},
			// any other kind of door (the bedroom's sliding glass wall): fd = { leaves, curtains, update(dt, open, curtainsOpen) }
			addDoor(did, fd, col, stands, labels) { return addDoor(did, fd, rect(col[0], col[1], col[2], col[3]), stands.map(W), labels); },
			tex: makeTextures(kit),
			shell: (opt) => makeShell(k, opt)
		});
		return k;
	}
	function finishZone(id, k, api) {
		const Z = ZONES[id];
		if (k.lights.length > pool.length) console.warn(`[house] ${id} has ${k.lights.length} lights, only ${pool.length} are used`);
		// small props don't need to cast shadows (same rule as the living room)
		const ws = new THREE.Vector3();
		k.g.updateMatrixWorld(true);
		k.g.traverse(o => {
			if (!o.isMesh || !o.castShadow) return;
			if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
			o.getWorldScale(ws);
			if (o.geometry.boundingSphere.radius * Math.max(ws.x, ws.y, ws.z) < 0.22) o.castShadow = false;
		});
		const cb = k.cam;
		const own = api.update;
		const ca = k.W([cb.minX, cb.minZ]), cz = k.W([cb.maxX, cb.maxZ]);
		const camRect = { minX: Math.min(ca[0], cz[0]), maxX: Math.max(ca[0], cz[0]), minZ: Math.min(ca[1], cz[1]), maxZ: Math.max(ca[1], cz[1]) };
		return Object.assign({}, api, {
			id, name: Z.name, ox: k.ox, group: k.g, outdoor: !!Z.outdoor, borrow: Z.borrow || null,
			lights: k.lights, key: k.key, fill: k.fill,
			get hemi() { return k.hemi; }, get env() { return k.env; }, get exposure() { return k.exposure; },
			cam: Object.assign(camRect, { maxY: cb.maxY + k.oy, minY: cb.minY === undefined ? -99 : cb.minY + k.oy }),
			update(dt, t) { k.updaters.forEach(u => u(dt, t)); if (own) own(dt, t); }
		});
	}

	// ---------------------------------------------------------------- every frame
	function update(dt, t, x, z) {
		nightK += ((ctx.get("night") ? 1 : 0) - nightK) * Math.min(1, dt * 3);
		setRegion(regionOf(areaOf(x, z)));
		// the room you're in, and the rooms you can see into, keep moving
		for (const id in built) if (visibleSet.has(id)) built[id].update(dt, t);
		if (lit !== "main" && built[lit]) applyLights(built[lit]);
		doors.forEach(d => d.fd.update(dt, d.isOpen(), d.curtOpen()));
		if (pets) pets.update(dt, t, visibleSet);
	}

	const houseApi = {
		ZONES, built, ensure, update, addDoor, portals,
		start: pump,
		region: () => region,
		regionOf,
		inHouse: () => region !== "main",
		indoorsAway: () => lit !== "main",
		visible: r => visibleSet.has(r),
		current: () => built[region] || null,
		pets: () => pets,
		// camera limits for the room you're in
		camBounds: () => (built[region] ? built[region].cam : null),
		applyKey(k, remote) { for (const id in built) if (built[id].applyKey) built[id].applyKey(k, remote); if (pets) pets.applyKey(k, remote); },
		onFx(d, p) { if (d.zone === "pets") { if (pets) pets.onFx(d, p); return; } const Z = built[d.zone]; if (Z && Z.onFx) Z.onFx(d, p); },
		cssActive: () => { for (const id in built) if (visibleSet.has(id) && built[id].cssActive && built[id].cssActive()) return true; return false; },
		// a seat that watches a screen (cinema): the camera looks at this from your eyes
		screenFor(sitId) { for (const id in built) { const Z = built[id]; if (Z.screenFor) { const s = Z.screenFor(sitId); if (s) return s; } } return null; },
		promptOpts(opts) { const Z = built[region]; if (Z && Z.promptOpts) Z.promptOpts(opts); if (pets) pets.promptOpts(opts); },
		musicAt(x, z) { const Z = built[region]; return Z && Z.musicAt ? Z.musicAt(x, z) : 0; },
		floorAt
	};
	return houseApi;
}

// ---------------------------------------------------------------- shared textures for the house
function makeTextures(K) {
	const { canvasTex, rng } = K;
	const cache = {};
	const once = (key, fn) => cache[key] || (cache[key] = fn());
	return {
		// planks; tones is a list of colors, rx/ry how often it repeats
		wood(tones, rx, ry, seed = 7) {
			return canvasTex(1024, 1024, (g, w, h) => {
				const r = rng(seed);
				const rows = 14, ph = h / rows;
				for (let i = 0; i < rows; i++) {
					let x = -r() * 400;
					while (x < w) {
						const len = 300 + r() * 420;
						g.fillStyle = tones[Math.floor(r() * tones.length)];
						g.fillRect(x, i * ph, len, ph);
						for (let k = 0; k < 12; k++) {
							g.strokeStyle = `rgba(40,25,10,${0.04 + r() * 0.1})`;
							g.lineWidth = 0.6 + r() * 1.4;
							g.beginPath();
							const y0 = i * ph + r() * ph;
							g.moveTo(x, y0);
							for (let s = 0; s <= 8; s++) g.lineTo(x + (len * s) / 8, y0 + Math.sin(s * 0.9 + r() * 2) * 2);
							g.stroke();
						}
						g.fillStyle = "rgba(30,18,8,0.45)"; g.fillRect(x, i * ph, 2, ph);
						x += len;
					}
					g.fillStyle = "rgba(30,18,8,0.4)"; g.fillRect(0, i * ph, w, 2);
				}
			}, rx, ry);
		},
		// soft carpet with an optional border
		carpet(base, accent, rx = 1, ry = 1, border = true) {
			return canvasTex(512, 512, (g, w, h) => {
				g.fillStyle = base; g.fillRect(0, 0, w, h);
				const r = rng(29);
				for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
				if (border) { g.strokeStyle = accent; g.lineWidth = 14; g.strokeRect(22, 22, w - 44, h - 44); g.lineWidth = 3; g.strokeRect(46, 46, w - 92, h - 92); }
			}, rx, ry);
		},
		runner(base, accent) {
			return canvasTex(256, 1024, (g, w, h) => {
				g.fillStyle = base; g.fillRect(0, 0, w, h);
				g.strokeStyle = accent; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
				g.fillStyle = accent;
				for (let y = 70; y < h - 40; y += 64) { g.save(); g.translate(w / 2, y); g.rotate(Math.PI / 4); g.fillRect(-14, -14, 28, 28); g.restore(); }
				const r = rng(31);
				for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.07})`; g.fillRect(r() * w, r() * h, 2, 2); }
			});
		},
		// painted wall: plain, striped or with a little pattern
		wall(base, kind, accent, rx, ry) {
			return canvasTex(512, 512, (g, w, h) => {
				g.fillStyle = base; g.fillRect(0, 0, w, h);
				if (kind === "stripes") for (let x = 0; x < w; x += 64) { g.fillStyle = accent; g.fillRect(x, 0, 30, h); }
				else if (kind === "dots") { g.fillStyle = accent; for (let y = 16; y < h; y += 64) for (let x = 16 + ((y / 64) % 2) * 32; x < w; x += 64) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); } }
				else if (kind === "paws") {
					g.fillStyle = accent;
					for (let y = 40; y < h; y += 128) for (let x = 40 + ((y / 128) % 2) * 64; x < w; x += 128) {
						g.beginPath(); g.ellipse(x, y + 8, 13, 11, 0, 0, Math.PI * 2); g.fill();
						[[-15, -10], [-5, -18], [6, -18], [16, -10]].forEach(([dx, dy]) => { g.beginPath(); g.ellipse(x + dx, y + dy, 5, 6.5, 0, 0, Math.PI * 2); g.fill(); });
					}
				} else if (kind === "panel") {
					g.strokeStyle = accent; g.lineWidth = 4;
					for (let x = 0; x < w; x += 128) g.strokeRect(x + 14, 30, 100, h - 60);
				}
				const r = rng(41);
				for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.025})`; g.fillRect(r() * w, r() * h, 2, 2); }
			}, rx, ry);
		},
		tiles(c1, c2, grout, rx, ry, n = 4) {
			return canvasTex(256, 256, (g, w, h) => {
				g.fillStyle = grout; g.fillRect(0, 0, w, h);
				const s = w / n;
				for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
					g.fillStyle = (i + j) % 2 ? c1 : c2;
					g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
					g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(i * s + 4, j * s + 4, s - 8, 3);
				}
			}, rx, ry);
		},
		// what you see out of a window at night: sky, moon, a city skyline
		view(seed = 3, moon = true) {
			return once("view" + seed + moon, () => canvasTex(1024, 512, (g, w, h) => {
				const r = rng(seed);
				const sky = g.createLinearGradient(0, 0, 0, h);
				sky.addColorStop(0, "#050817"); sky.addColorStop(0.55, "#16194a"); sky.addColorStop(0.8, "#4a2a5e"); sky.addColorStop(1, "#8a4a6a");
				g.fillStyle = sky; g.fillRect(0, 0, w, h);
				for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.7})`; g.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5); }
				if (moon) {
					const mx = w * (0.2 + r() * 0.6), my = h * 0.22;
					const glow = g.createRadialGradient(mx, my, 10, mx, my, 120);
					glow.addColorStop(0, "rgba(255,244,214,0.5)"); glow.addColorStop(1, "rgba(255,244,214,0)");
					g.fillStyle = glow; g.fillRect(0, 0, w, h);
					g.fillStyle = "#fff6dc"; g.beginPath(); g.arc(mx, my, 26, 0, Math.PI * 2); g.fill();
				}
				for (let layer = 0; layer < 2; layer++) {
					let x = -20;
					while (x < w) {
						const bw = 30 + r() * 70, bh = (layer ? 60 : 110) + r() * (layer ? 120 : 200);
						g.fillStyle = layer ? "#1a1830" : "#0d0c1c";
						g.fillRect(x, h - bh, bw, bh);
						for (let wy = h - bh + 8; wy < h - 6; wy += 12) for (let wx = x + 5; wx < x + bw - 5; wx += 9) {
							if (r() < (layer ? 0.15 : 0.3)) { g.fillStyle = r() < 0.8 ? "rgba(255,210,130,0.85)" : "rgba(160,200,255,0.8)"; g.fillRect(wx, wy, 4, 6); }
						}
						x += bw + r() * 8;
					}
				}
			}));
		},
		// a door / room sign: dark plate, gold edge, name, and a little drawn icon
		sign(text, icon, opt = {}) {
			return canvasTex(768, 192, (g, w, h) => {
				g.fillStyle = opt.bg || "#231b29"; roundRect(g, 6, 6, w - 12, h - 12, 34); g.fill();
				g.strokeStyle = opt.edge || "#d4ac63"; g.lineWidth = 7; roundRect(g, 18, 18, w - 36, h - 36, 26); g.stroke();
				const ix = 108, iy = h / 2;
				g.save(); g.translate(ix, iy); drawIcon(g, icon, opt.edge || "#d4ac63"); g.restore();
				g.fillStyle = opt.fg || "#f8ecd2";
				g.font = `800 ${text.length > 12 ? 66 : 80}px Nunito, 'Segoe UI', sans-serif`;
				g.textAlign = "left"; g.textBaseline = "middle";
				g.fillText(text, 180, h / 2 + 4);
			});
		},
		// plain text on transparent background (labels, marquees)
		text(text, opt = {}) {
			return canvasTex(opt.w || 1024, opt.h || 256, (g, w, h) => {
				if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, w, h); }
				g.fillStyle = opt.color || "#fff";
				g.font = opt.font || "800 120px Nunito, 'Segoe UI', sans-serif";
				g.textAlign = "center"; g.textBaseline = "middle";
				if (opt.glow) { g.shadowColor = opt.glow; g.shadowBlur = 30; }
				g.fillText(text, w / 2, h / 2 + 6);
			});
		},
		// a framed picture: soft abstract painting
		art(seed) {
			return canvasTex(384, 480, (g, w, h) => {
				const r = rng(seed * 13 + 5);
				const pal = [["#f4a261", "#e76f51", "#2a9d8f", "#264653"], ["#ffcdb2", "#e5989b", "#b5838d", "#6d6875"], ["#a8dadc", "#457b9d", "#1d3557", "#f1faee"], ["#ffd166", "#ef476f", "#06d6a0", "#118ab2"], ["#e9edc9", "#ccd5ae", "#d4a373", "#faedcd"]][seed % 5];
				g.fillStyle = pal[3]; g.fillRect(0, 0, w, h);
				for (let i = 0; i < 9; i++) {
					g.fillStyle = pal[i % 3];
					g.globalAlpha = 0.55 + r() * 0.4;
					g.beginPath();
					if (r() < 0.5) g.arc(r() * w, r() * h, 30 + r() * 110, 0, Math.PI * 2);
					else { g.ellipse(r() * w, r() * h, 40 + r() * 120, 20 + r() * 60, r() * 3, 0, Math.PI * 2); }
					g.fill();
				}
				g.globalAlpha = 1;
			});
		}
	};
}

// little line icons for the room signs
function drawIcon(g, icon, color) {
	g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 8; g.lineCap = "round"; g.lineJoin = "round";
	const P = (pts, close) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); if (close) g.closePath(); g.stroke(); };
	switch (icon) {
		case "film":
			g.strokeRect(-46, -34, 92, 68);
			for (let i = -1; i <= 1; i++) { g.fillRect(-58 + 4, -28 + (i + 1) * 22, 8, 10); g.fillRect(46, -28 + (i + 1) * 22, 8, 10); }
			g.beginPath(); g.moveTo(-12, -16); g.lineTo(20, 0); g.lineTo(-12, 16); g.closePath(); g.fill();
			break;
		case "food":
			P([[-30, -44], [-30, -8]]); P([[-42, -44], [-42, -16], [-18, -16], [-18, -44]]); P([[-30, -8], [-30, 44]]);
			g.beginPath(); g.ellipse(26, -18, 14, 26, 0, 0, Math.PI * 2); g.stroke(); P([[26, 8], [26, 44]]);
			break;
		case "bed":
			P([[-56, 34], [-56, -30]]); P([[-56, 8], [56, 8], [56, 34]]); g.strokeRect(-48, -14, 30, 18); P([[-14, -6], [54, -6], [56, 8]]);
			break;
		case "sofa":
			P([[-50, 30], [-50, -4], [50, -4], [50, 30]]); P([[-40, -4], [-40, -28], [40, -28], [40, -4]]); P([[-50, 14], [50, 14]]);
			break;
		case "paw":
			g.beginPath(); g.ellipse(0, 16, 22, 18, 0, 0, Math.PI * 2); g.fill();
			[[-28, -10], [-11, -28], [11, -28], [28, -10]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 9, 12, 0, 0, Math.PI * 2); g.fill(); });
			break;
		case "bath":
			P([[-56, 0], [56, 0]]); P([[-50, 0], [-42, 30], [42, 30], [50, 0]]); P([[-40, 0], [-40, -40], [-24, -44]]);
			for (const x of [-6, 12, 30]) { g.beginPath(); g.arc(x, -16, 6, 0, Math.PI * 2); g.stroke(); }
			break;
		case "wave":
			for (let k = 0; k < 2; k++) { g.beginPath(); for (let x = -56; x <= 56; x += 4) { const y = -12 + k * 26 + Math.sin(x / 12) * 9; x === -56 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
			break;
		case "home":
			P([[-48, 0], [0, -40], [48, 0]]); P([[-36, -8], [-36, 38], [36, 38], [36, -8]]); g.strokeRect(-10, 12, 20, 26);
			break;
	}
}

// ---------------------------------------------------------------- a room's walls, floor and ceiling
// opt: { w, d, h, floor: material, wall: material (or {n,s,e,w}), ceil, trim, holes: [{ wall: "n"|"s"|"e"|"w", at, w, y0, y1 }] }
// walls: n is z = -d/2, s is z = +d/2, w is x = -w/2, e is x = +w/2 (local coordinates)
function makeShell(k, opt) {
	const { THREE, add, mat, g } = k;
	const W = opt.w, D = opt.d, H = opt.h;
	// (floor: false / ceil: false when the room builds its own - the pool has a hole in its floor and a glass roof)
	let floor = null;
	if (opt.floor !== false) { floor = add(g, new THREE.PlaneGeometry(W, D), opt.floor, 0, 0, 0, { rx: -Math.PI / 2, cast: false }); floor.userData.floor = true; }
	if (opt.ceil !== false) {
		add(g, new THREE.PlaneGeometry(W, D), opt.ceil || mat("#f3ece2", 0.95), 0, H, 0, { rx: Math.PI / 2, cast: false });
		// a roof on top (the pool deck is outdoors: from up there you'd otherwise see straight in)
		add(g, new THREE.BoxGeometry(W + 0.5, 0.22, D + 0.5), mat("#4a4048", 0.9), 0, H + 0.13, 0, { cast: false });
	}
	const sides = {
		n: { len: W, x: 0, z: -D / 2 - 0.1, ry: 0 },
		s: { len: W, x: 0, z: D / 2 + 0.1, ry: Math.PI },
		w: { len: D, x: -W / 2 - 0.1, z: 0, ry: Math.PI / 2 },
		e: { len: D, x: W / 2 + 0.1, z: 0, ry: -Math.PI / 2 }
	};
	const holes = opt.holes || [];
	for (const side in sides) {
		const S = sides[side];
		const m = opt.wall[side] || opt.wall;
		const wallG = new THREE.Group();
		wallG.position.set(S.x, 0, S.z);
		wallG.rotation.y = S.ry;
		g.add(wallG);
		// a hole's 'at' is the room x (n / s walls) or room z (w / e walls) of its centre
		const hs = holes.filter(h => h.wall === side).map(h => { const c = wallAt(side, h.at); return { u0: c - h.w / 2, u1: c + h.w / 2, y0: h.y0 || 0, y1: h.y1 }; }).sort((a, b) => a.u0 - b.u0);
		let u = -S.len / 2 - 0.2;
		const seg = (u0, u1, y0, y1) => {
			if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
			add(wallG, new THREE.BoxGeometry(u1 - u0, y1 - y0, 0.2), m, (u0 + u1) / 2, (y0 + y1) / 2, 0, { cast: false });
		};
		for (const h of hs) {
			seg(u, h.u0, 0, H);
			seg(h.u0, h.u1, 0, h.y0);
			seg(h.u0, h.u1, h.y1, H);
			u = h.u1;
		}
		seg(u, S.len / 2 + 0.2, 0, H);
	}
	// skirting + crown moulding
	if (opt.trim !== false) {
		const trim = opt.trim || mat("#fbf7f0", 0.5);
		for (const [x, z, len, side] of [[0, -D / 2 + 0.01, W, 0], [0, D / 2 - 0.01, W, 0], [-W / 2 + 0.01, 0, D, 1], [W / 2 - 0.01, 0, D, 1]]) {
			add(g, new THREE.BoxGeometry(side ? 0.03 : len, 0.12, side ? len : 0.03), trim, x, 0.06, z, { cast: false });
			add(g, new THREE.BoxGeometry(side ? 0.06 : len, 0.08, side ? len : 0.06), trim, x, H - 0.04, z, { cast: false });
		}
	}
	return floor;
}
// a room coordinate -> position along that wall's own x axis
// (n: room +x; s is turned around: room -x; w (turned +90 deg): room -z; e (turned -90 deg): room +z)
export function wallAt(side, roomCoord) {
	if (side === "n") return roomCoord;
	if (side === "s") return -roomCoord;
	if (side === "w") return -roomCoord;
	return roomCoord;
}

