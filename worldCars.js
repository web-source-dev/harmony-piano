/**
 * Harmony World — two open-top cars, parked on a paved pad on the west lawn by the house's west front door.
 *
 * Get in (the driver's door) and drive anywhere out on the grounds: down the drive and round the ring road that runs all
 * the way round the outside (worldEstate.js), or off across the lawns and the paths, round the house, down the avenues
 * (not indoors, not into the pool, and only through gateways wide enough for a car). Someone else can hop in
 * the passenger seat and ride along. W / S (or the arrow keys, or the joystick) for the pedals, A / D to steer, Shift
 * for a burst of speed, Space for the handbrake, R (or E) for the horn, Esc to get out - the car stays where you left it.
 *
 * Each car's state is shared ("car:<id>": { d: driver id, p: passenger id, x, z, h }), x / z / h being where it's
 * parked (the middle of the car, facing h). While someone drives it, it's drawn round their avatar (their client moves
 * it; everyone else predicts it between pose updates so it glides instead of stepping), and whoever rides in it is
 * glued to their seat.
 *
 * Built by the grounds (worldGrounds.js) into their group: world coordinates. Local car coordinates: facing +z, x to
 * the side, the floor at y = 0.
 */
import { floorAt } from "./worldRoom.js";
import { DRIVE, ROAD_W } from "./worldEstate.js";

// the parking pad (a car's length of paving in front of it joins the path down the west side of the house)
export const PAD = [-37.8, -28.0, 4.6, 16.0];
const CARS = [
	{ id: "cherry", name: "Cherry", paint: "#b10f2e", seats: "#efe0c8", trim: "#f4efe8", plate: "LOVE 01", x: -32.6, z: 7.8, h: -Math.PI / 2 },
	{ id: "midnight", name: "Midnight", paint: "#173a6b", seats: "#7a4b32", trim: "#c9a05a", plate: "LOVE 02", x: -32.6, z: 12.8, h: -Math.PI / 2 }
];
const SEAT = [0.37, -0.26], PSEAT = [-0.37, -0.26];   // where the driver / the passenger sits (their avatar's root)
const WB = 2.56, FZ = 1.28, RZ = -1.28, TW = 0.79, WR = 0.34;
const MAX_V = 15, TURBO_V = 22, REV_V = 5;
const HIT = [1.42, 0, -1.42], HIT_R = 0.92;            // the car as three circles along its middle (for bumping)
const HALF = { w: 0.98, l: 2.3 };                       // half its width and length (people can't walk through it)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// local (lx, lz) on a car at (x, z) facing h -> world
const toWorld = (x, z, h, lx, lz) => [x + lx * Math.cos(h) + lz * Math.sin(h), z - lx * Math.sin(h) + lz * Math.cos(h)];

export function buildCars(k, { PATH_Y }) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex } = k;
	const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

	// ================================================================ the parking pad
	{
		const asphalt = canvasTex(512, 512, (c, w, h) => {
			c.fillStyle = "#3a3740"; c.fillRect(0, 0, w, h);
			for (let i = 0; i < 9000; i++) { const t = 40 + Math.random() * 40; c.fillStyle = `rgba(${t + 10},${t + 6},${t + 14},0.5)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
		}, 3, 3);
		const [x0, x1, z0, z1] = PAD;
		add(g, new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat("#ffffff", 0.92, 0, { map: asphalt }), (x0 + x1) / 2, PATH_Y + 0.004, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
		// a kerb of pale stone round it, and painted bays
		const kerb = mat("#cfc8bb", 0.8);
		// (open on the west side, where the drive comes in)
		const gz0 = DRIVE.z - ROAD_W / 2 - 0.3, gz1 = DRIVE.z + ROAD_W / 2 + 0.3;
		for (const [w, d, x, z] of [[x1 - x0 + 0.3, 0.15, (x0 + x1) / 2, z0], [x1 - x0 + 0.3, 0.15, (x0 + x1) / 2, z1], [0.15, gz0 - z0, x0, (z0 + gz0) / 2], [0.15, z1 - gz1, x0, (gz1 + z1) / 2]]) add(g, new THREE.BoxGeometry(w, 0.1, d), kerb, x, 0.05, z, { cast: false });
		const paint = new THREE.MeshBasicMaterial({ color: "#efe9dc", toneMapped: false, transparent: true, opacity: 0.75 });
		for (const z of [5.4, 10.3, 15.2]) add(g, new THREE.PlaneGeometry(5.2, 0.12), paint, -33.4, PATH_Y + 0.008, z, { rx: -Math.PI / 2, cast: false, receive: false });
		add(g, new THREE.PlaneGeometry(0.12, 9.92), paint, -36.0, PATH_Y + 0.008, 10.3, { rx: -Math.PI / 2, cast: false, receive: false });
		// a sign
		const sg = group(g, x0 + 0.5, 0, z1 - 0.6, Math.PI / 2);
		add(sg, new THREE.CylinderGeometry(0.04, 0.05, 1.9, 8), mat("#2e2a31", 0.45, 0.4), 0, 0.95, 0);
		add(sg, rbox(1.1, 0.5, 0.05, 0.03), mat("#2e2a31", 0.5, 0.3), 0, 1.95, 0);
		add(sg, new THREE.PlaneGeometry(1.0, 0.42), new THREE.MeshBasicMaterial({ map: k.tex.text("PARKING", { w: 512, h: 192, color: "#ffffff", glow: "#4cc9f0", font: "900 110px Nunito, 'Segoe UI', sans-serif" }), transparent: true, toneMapped: false }), 0, 1.95, 0.03, { cast: false, receive: false });
		k.box(x0 + 0.45, x0 + 0.55, z1 - 0.65, z1 - 0.55);
	}

	// ================================================================ a car (local: facing +z, the floor at 0)
	const chrome = mat("#e9edf2", 0.12, 1.0), rubber = mat("#1b1a1e", 0.85), darkM = mat("#121116", 0.6, 0.2), carpet = mat("#2a2420", 0.95);
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe6ff", transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
	const blobTex = canvasTex(128, 256, (c, w, h) => {
		const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h / 2);
		gr.addColorStop(0, "rgba(0,0,0,0.75)"); gr.addColorStop(0.55, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
	});
	const beamTex = canvasTex(128, 256, (c, w, h) => {
		const gr = c.createRadialGradient(w / 2, h * 0.25, 0, w / 2, h * 0.25, h * 0.75);
		gr.addColorStop(0, "rgba(255,238,200,0.9)"); gr.addColorStop(0.4, "rgba(255,230,180,0.35)"); gr.addColorStop(1, "rgba(255,230,180,0)");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
	});
	const gaugeTex = canvasTex(512, 128, (c, w, h) => {
		c.fillStyle = "#111014"; c.fillRect(0, 0, w, h);
		for (const [cx, col] of [[150, "#ffb86b"], [362, "#7cf0ff"]]) {
			c.strokeStyle = "#3a3640"; c.lineWidth = 10; c.beginPath(); c.arc(cx, 70, 48, 0, Math.PI * 2); c.stroke();
			c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(cx, 70, 40, Math.PI * 0.8, Math.PI * 2.2); c.stroke();
			for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.8 + i * 0.175); c.beginPath(); c.moveTo(cx + Math.cos(a) * 30, 70 + Math.sin(a) * 30); c.lineTo(cx + Math.cos(a) * 38, 70 + Math.sin(a) * 38); c.stroke(); }
			c.strokeStyle = "#ff4d6d"; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, 70); c.lineTo(cx + Math.cos(Math.PI * 1.25) * 34, 70 + Math.sin(Math.PI * 1.25) * 34); c.stroke();
		}
		c.fillStyle = "#ff8fab"; c.font = "800 26px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("♥", 256, 78);
	});

	// the body's side profile (z along, y up), extruded across the car; the cockpit is the dip in the middle
	function bodyGeo() {
		const s = new THREE.Shape();
		s.moveTo(-2.12, 0.36);
		s.lineTo(-1.72, 0.33);
		s.absarc(RZ, WR, 0.44, Math.PI, 0, true);
		s.lineTo(0.84, 0.33);
		s.absarc(FZ, WR, 0.44, Math.PI, 0, true);
		s.lineTo(2.06, 0.34);
		s.quadraticCurveTo(2.25, 0.36, 2.23, 0.6);
		s.quadraticCurveTo(2.2, 0.8, 1.92, 0.84);
		s.lineTo(0.74, 0.92);
		s.lineTo(0.66, 0.68);
		s.lineTo(-1.0, 0.68);
		s.lineTo(-1.07, 0.93);
		s.lineTo(-1.62, 0.95);
		s.quadraticCurveTo(-2.15, 0.95, -2.22, 0.72);
		s.lineTo(-2.23, 0.5);
		s.quadraticCurveTo(-2.23, 0.37, -2.12, 0.36);
		const geo = new THREE.ExtrudeGeometry(s, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 5, curveSegments: 20 });
		geo.translate(0, 0, -0.81);
		geo.rotateY(-Math.PI / 2);
		geo.computeVertexNormals();
		return geo;
	}
	// a door: the side of the cockpit, up to the belt line
	function doorGeo() {
		const s = new THREE.Shape();
		s.moveTo(-1.04, 0.5);
		s.lineTo(0.7, 0.5);
		s.lineTo(0.7, 0.86);
		s.quadraticCurveTo(0.7, 0.93, 0.6, 0.93);
		s.lineTo(-0.94, 0.94);
		s.quadraticCurveTo(-1.04, 0.94, -1.04, 0.86);
		s.lineTo(-1.04, 0.5);
		const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 8 });
		geo.translate(0, 0, -0.035);
		geo.rotateY(-Math.PI / 2);
		geo.computeVertexNormals();
		return geo;
	}
	const BODY = bodyGeo(), DOOR = doorGeo();
	const TYRE = new THREE.CylinderGeometry(WR, WR, 0.25, 30, 1); TYRE.rotateZ(Math.PI / 2);
	const SIDEWALL = new THREE.TorusGeometry(WR - 0.05, 0.05, 8, 30); SIDEWALL.rotateY(Math.PI / 2);
	const RIM = new THREE.CylinderGeometry(0.215, 0.215, 0.255, 24, 1); RIM.rotateZ(Math.PI / 2);
	const SPOKE = new THREE.BoxGeometry(0.04, 0.4, 0.06);

	function makeWheel(parent, x, z, side) {
		const pivot = group(parent, x, WR, z);         // turns (front wheels steer)
		const spin = group(pivot, 0, 0, 0);            // rolls
		add(spin, TYRE, rubber, 0, 0, 0);
		for (const sx of [-0.12, 0.12]) add(spin, SIDEWALL, rubber, sx, 0, 0, { cast: false });
		add(spin, RIM, chrome, 0, 0, 0, { cast: false });
		const face = group(spin, side * 0.13, 0, 0);
		for (let i = 0; i < 5; i++) { const sp = add(face, SPOKE, chrome, 0, 0, 0, { cast: false }); sp.rotation.x = i / 5 * Math.PI; }
		add(face, new THREE.CylinderGeometry(0.06, 0.07, 0.04, 16), darkM, 0, 0, 0, { rz: Math.PI / 2, cast: false });
		add(face, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), chrome, side * 0.015, 0, 0, { rz: Math.PI / 2, cast: false });
		return { pivot, spin };
	}

	function makeCar(def) {
		const root = group(g, def.x, 0, def.z, def.h);
		const body = group(root, 0, 0, 0);                         // tilts (pitch / roll) on its springs
		const paint = new THREE.MeshPhysicalMaterial({ color: def.paint, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.07 });
		const seatM = mat(def.seats, 0.55), trimM = mat(def.trim, 0.35, 0.6);
		add(body, BODY, paint, 0, 0, 0);
		for (const sx of [-1, 1]) add(body, DOOR, paint, sx * 0.84, 0, 0);
		// the cockpit: carpet, a dashboard with lit gauges, a centre console, seats, the wheel
		add(body, new THREE.BoxGeometry(1.56, 0.02, 1.62), carpet, 0, 0.69, -0.17, { cast: false });
		add(body, rbox(1.62, 0.2, 0.26, 0.06), darkM, 0, 0.86, 0.6);
		add(body, new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshBasicMaterial({ map: gaugeTex, toneMapped: false }), SEAT[0], 0.9, 0.465, { rx: -0.25, cast: false, receive: false });
		add(body, rbox(0.5, 0.06, 0.24, 0.02), trimM, -0.38, 0.97, 0.6, { cast: false });
		add(body, rbox(0.22, 0.16, 1.1, 0.05), darkM, 0, 0.75, -0.1, { cast: false });
		add(body, new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), chrome, 0, 0.88, 0.16, { rx: 0.3, cast: false });
		add(body, new THREE.SphereGeometry(0.04, 12, 10), darkM, 0, 0.96, 0.18, { cast: false });
		const seatBacks = [];
		for (const [sx, sz] of [SEAT, PSEAT]) {
			const sb = group(body, sx, 0, sz);
			add(sb, rbox(0.52, 0.16, 0.5, 0.07), seatM, 0, 0.42, 0.02, { cast: false });
			const back = group(sb, 0, 0.42, -0.24);
			back.rotation.x = -0.16;
			add(back, rbox(0.5, 0.66, 0.13, 0.06), seatM, 0, 0.33, 0);
			for (const bx of [-0.2, 0.2]) add(back, rbox(0.1, 0.62, 0.16, 0.05), seatM, bx, 0.33, 0.04, { cast: false });
			add(back, rbox(0.3, 0.2, 0.11, 0.05), seatM, 0, 0.78, -0.01, { cast: false });
			add(back, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), chrome, -0.08, 0.66, -0.01, { cast: false });
			add(back, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), chrome, 0.08, 0.66, -0.01, { cast: false });
			seatBacks.push(back);
		}
		// the steering wheel (in front of the driver, raked toward them)
		const wheelMount = group(body, SEAT[0], 0.92, SEAT[1] + 0.5);
		wheelMount.rotation.x = -0.55;
		add(wheelMount, new THREE.CylinderGeometry(0.03, 0.035, 0.32, 8), darkM, 0, -0.02, 0.17, { rx: Math.PI / 2, cast: false });
		const steerWheel = group(wheelMount, 0, 0, 0);
		add(steerWheel, new THREE.TorusGeometry(0.18, 0.022, 10, 32), darkM, 0, 0, 0, { cast: false });
		for (let i = 0; i < 3; i++) { const sp = add(steerWheel, new THREE.BoxGeometry(0.16, 0.025, 0.015), trimM, 0, 0, 0, { cast: false }); sp.rotation.z = Math.PI / 2 + i * Math.PI * 2 / 3; sp.position.set(Math.cos(Math.PI / 2 + i * Math.PI * 2 / 3) * 0.08, Math.sin(Math.PI / 2 + i * Math.PI * 2 / 3) * 0.08, 0); }
		add(steerWheel, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), trimM, 0, 0, 0, { rx: Math.PI / 2, cast: false });
		// speedster humps behind the seats, and a chrome strip along each side
		for (const sx of [SEAT[0], PSEAT[0]]) {
			const hump = add(body, new THREE.SphereGeometry(0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint, sx, 0.93, -1.3);
			hump.scale.set(1, 0.6, 2.0);
		}
		for (const sx of [-1, 1]) add(body, new THREE.BoxGeometry(0.02, 0.025, 3.2), chrome, sx * 0.965, 0.62, 0.05, { cast: false });
		// the windscreen: a chrome frame round raked glass
		const ws = group(body, 0, 0.92, 0.74);
		ws.rotation.x = -0.5;
		const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), glassM);
		gl.position.y = 0.21; ws.add(gl);
		add(ws, new THREE.BoxGeometry(1.56, 0.035, 0.035), chrome, 0, 0.42, 0, { cast: false });
		for (const sx of [-0.77, 0.77]) add(ws, new THREE.BoxGeometry(0.035, 0.44, 0.035), chrome, sx, 0.21, 0, { cast: false });
		add(ws, new THREE.BoxGeometry(0.06, 0.04, 0.12), darkM, 0, 0.36, -0.07, { cast: false });   // the mirror
		// the mirrors on the doors
		for (const sx of [-1, 1]) {
			add(body, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), chrome, sx * 0.92, 0.99, 0.55, { rz: sx * 0.6, cast: false });
			const m = add(body, new THREE.SphereGeometry(0.075, 14, 10), paint, sx * 0.98, 1.04, 0.55, { cast: false });
			m.scale.set(0.7, 0.6, 1);
		}
		// the nose: a grille, chrome bumper, headlights (with beams), indicators, a number plate
		add(body, rbox(0.82, 0.2, 0.08, 0.05), darkM, 0, 0.5, 2.21, { cast: false });
		for (let i = 0; i < 6; i++) add(body, new THREE.BoxGeometry(0.76, 0.012, 0.02), chrome, 0, 0.42 + i * 0.032, 2.25, { cast: false });
		add(body, rbox(0.86, 0.24, 0.05, 0.06), chrome, 0, 0.5, 2.23, { cast: false }).scale.set(1, 1, 0.4);
		add(body, rbox(1.9, 0.1, 0.16, 0.05), chrome, 0, 0.32, 2.2);
		add(body, rbox(1.9, 0.1, 0.16, 0.05), chrome, 0, 0.32, -2.22);
		const headM = new THREE.MeshStandardMaterial({ color: "#fffaf0", emissive: "#fff2d0", emissiveIntensity: 0.4, roughness: 0.1 });
		const tailM = new THREE.MeshStandardMaterial({ color: "#5a0a12", emissive: "#ff1a2e", emissiveIntensity: 0.5, roughness: 0.3 });
		const revM = new THREE.MeshStandardMaterial({ color: "#d8d8d8", emissive: "#ffffff", emissiveIntensity: 0, roughness: 0.3 });
		for (const sx of [-0.66, 0.66]) {
			add(body, new THREE.TorusGeometry(0.12, 0.02, 8, 24), chrome, sx, 0.66, 2.1, { rx: -0.3, cast: false });
			const hl = add(body, new THREE.SphereGeometry(0.115, 18, 12), headM, sx, 0.66, 2.1, { cast: false });
			hl.scale.set(1, 1, 0.55);
			add(body, new THREE.SphereGeometry(0.04, 10, 8), mat("#ffb347", 0.3, 0, { emissive: "#ff9e2a", emissiveIntensity: 0.3 }), sx * 1.15, 0.47, 2.14, { cast: false });
			add(body, rbox(0.3, 0.1, 0.06, 0.03), tailM, sx * 0.95, 0.72, -2.22, { cast: false });
			add(body, rbox(0.12, 0.08, 0.05, 0.02), revM, sx * 0.55, 0.72, -2.23, { cast: false });
			add(body, new THREE.CylinderGeometry(0.045, 0.05, 0.22, 12), chrome, sx * 0.6, 0.26, -2.24, { rx: Math.PI / 2, cast: false });
		}
		const plateM = new THREE.MeshBasicMaterial({ map: k.tex.text(def.plate, { w: 512, h: 128, color: "#1b1a1e", bg: "#f6f1e3", font: "900 84px Nunito, 'Segoe UI', sans-serif" }), toneMapped: false });
		add(body, new THREE.PlaneGeometry(0.5, 0.12), plateM, 0, 0.47, -2.255, { ry: Math.PI, cast: false, receive: false });
		add(body, new THREE.PlaneGeometry(0.5, 0.12), plateM, 0, 0.3, 2.29, { cast: false, receive: false });
		// light on the road ahead (a pool of light on the ground) while the engine runs
		const beamM = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
		const pool = add(root, new THREE.PlaneGeometry(3.4, 7.5), beamM, 0, PATH_Y + 0.03, 5.6, { rx: -Math.PI / 2, cast: false, receive: false });
		pool.renderOrder = 2;
		// a soft shadow under it (whether or not shadows are on)
		const blob = add(root, new THREE.PlaneGeometry(2.5, 5.0), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.85 }), 0, PATH_Y + 0.02, 0, { rx: -Math.PI / 2, cast: false, receive: false });
		blob.renderOrder = 1;
		const wheels = [makeWheel(root, TW, FZ, 1), makeWheel(root, -TW, FZ, -1), makeWheel(root, TW, RZ, 1), makeWheel(root, -TW, RZ, -1)];
		return {
			root, body, wheels, steerWheel,
			lights(on, brake, reverse) {
				headM.emissiveIntensity = on ? 2.4 : 0.35;
				tailM.emissiveIntensity = brake ? 3.2 : on ? 1.1 : 0.4;
				revM.emissiveIntensity = reverse ? 2.2 : 0;
				beamM.opacity = on ? 0.32 : 0;
				pool.visible = on;
			}
		};
	}

	// ================================================================ state
	const cars = CARS.map((def, i) => {
		const m = makeCar(def);
		m.lights(false, false, false);
		return Object.assign(m, { i, def, key: "car:" + def.id, x: def.x, z: def.z, h: def.h, v: 0, steer: 0, spinA: 0, pitch: 0, roll: 0, lastV: 0, lastH: def.h, track: null, brake: false });
	});
	const stateOf = c => { const s = ctx.get(c.key); return s && typeof s === "object" ? s : { d: "", p: "", x: c.def.x, z: c.def.z, h: c.def.h }; };
	const peerOf = id => (id ? ctx.peers().get(id) : null) || null;
	const present = id => !!id && (id === ctx.MY_ID || ctx.peers().has(id));
	function setState(c, patch) { ctx.setShared(c.key, Object.assign({}, stateOf(c), patch)); }
	// (x, z, h) where the car is right now (as drawn)
	const poseOf = c => [c.x, c.z, c.h];

	// can the car stand at (x, z) facing h? the grounds (ctx.canDrive) and the other car
	function fits(c, x, z, h) {
		for (const lz of HIT) {
			const [cx, cz] = toWorld(x, z, h, 0, lz);
			if (!ctx.canDrive(cx, cz, HIT_R)) return false;
			for (const o of cars) {
				if (o === c) continue;
				for (const oz of HIT) { const [ox, ozz] = toWorld(o.x, o.z, o.h, 0, oz); if (Math.hypot(cx - ox, cz - ozz) < HIT_R * 1.9) return false; }
			}
		}
		return true;
	}

	// ================================================================ the engine and the horn (WebAudio)
	let engine = null;
	function engineSound(on, v, thr) {
		const a = ctx.audio();
		if (!a || !a.ctx) return;
		if (!engine && on) {
			const ac = a.ctx;
			const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), gn = ac.createGain();
			o1.type = "sawtooth"; o2.type = "square";
			lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 2;
			gn.gain.value = 0;
			o1.connect(lp); o2.connect(lp); lp.connect(gn); gn.connect(a.master);
			o1.start(); o2.start();
			engine = { o1, o2, lp, gn, ac };
		}
		if (!engine) return;
		const t = engine.ac.currentTime, sp = Math.abs(v);
		// up through the gears: the revs climb, drop at each change, and climb again
		const gear = Math.min(4, Math.floor(sp / 5.5)), rpm = 0.22 + ((sp - gear * 5.5) / 5.5) * 0.7 * (gear < 4 ? 1 : 1.4) + (thr > 0.1 ? 0.08 : 0);
		const f = 34 + rpm * 62 + gear * 7;
		engine.o1.frequency.setTargetAtTime(f, t, 0.06);
		engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
		engine.lp.frequency.setTargetAtTime(380 + rpm * 900, t, 0.08);
		engine.gn.gain.setTargetAtTime(on ? (ctx.muted() ? 0 : 0.05 + rpm * 0.05) : 0, t, on ? 0.1 : 0.25);
	}
	function horn(vol) {
		const a = ctx.audio();
		if (!a || !a.ctx || ctx.muted()) return;
		const ac = a.ctx, t = ac.currentTime, gn = ac.createGain();
		gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.09 * vol, t + 0.02); gn.gain.setValueAtTime(0.09 * vol, t + 0.32); gn.gain.linearRampToValueAtTime(0, t + 0.4);
		const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
		lp.connect(gn); gn.connect(a.master);
		for (const f of [392, 494]) { const o = ac.createOscillator(); o.type = "square"; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 0.42); }
	}
	let hornT = 0;
	function honk(c) {
		if (hornT > 0) return;
		hornT = 0.5;
		horn(1);
		ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "horn", car: c.i });
	}

	// ================================================================ getting in and out
	let K = null;   // { c } while I drive
	let P = null;   // { c } while I ride in the passenger seat
	const mine = () => (K ? K.c : P ? P.c : null);
	function getIn(c, asPassenger) {
		const m = ctx.me();
		if (m.carrying || m.carriedBy) { ctx.notice("You can't get in while carrying someone (or being carried)!"); return; }
		if (K || P) leave(true);
		if (m.sit) ctx.standUp(true);
		const s = stateOf(c);
		m.target = null; if (m.path) m.path = [];
		m.anim = "sit"; m.sit = null; m.upperUntil = 0; m.speed = 0;
		if (asPassenger) {
			P = { c };
			m.upper = "carpass";
			setState(c, { p: ctx.MY_ID });
			const d = peerOf(s.d);
			ctx.notice(d ? `You hop in next to <b>${ctx.esc(d.look.name)}</b>. Enjoy the ride! <b>Esc</b> to get out.` : "You sit in the passenger seat. <b>Esc</b> to get out.");
		} else {
			K = { c, sendT: 0, saveT: 0 };
			c.v = 0; c.steer = 0;
			m.upper = "drive";
			setState(c, { d: ctx.MY_ID, x: c.x, z: c.z, h: c.h });
			ctx.notice(`You get behind the wheel of <b>${c.def.name}</b>. Drive anywhere - the ring road goes all the way round the grounds. <b>W/S</b> to drive, <b>A/D</b> to steer, <b>Shift</b> to go faster, <b>Space</b> handbrake, <b>R</b> horn, <b>Esc</b> to get out.`);
		}
		ctx.sfx("door", 0.45);
		place(c);
		ctx.sendPose(true);
	}
	// out of the car, beside your door (or wherever there's room)
	function leave(quiet) {
		const c = mine();
		if (!c) return;
		const m = ctx.me(), wasDriver = !!K;
		const s = stateOf(c);
		K = null; P = null;
		if (wasDriver) { c.v = 0; if (s.d === ctx.MY_ID) setState(c, { d: "", x: +c.x.toFixed(3), z: +c.z.toFixed(3), h: +c.h.toFixed(4) }); }
		else if (s.p === ctx.MY_ID) setState(c, { p: "" });
		const side = wasDriver ? 1 : -1;
		const tries = [[side * 1.45, -0.2], [-side * 1.45, -0.2], [0, 3.0], [0, -3.0], [side * 2.2, 1.2]];
		let spot = toWorld(c.x, c.z, c.h, side * 1.45, -0.2);
		for (const [lx, lz] of tries) { const p = toWorld(c.x, c.z, c.h, lx, lz); if (ctx.canDrive(p[0], p[1], 0.35)) { spot = p; break; } }
		m.x = spot[0]; m.z = spot[1]; m.h = c.h + side * Math.PI / 2;
		m.anim = "idle"; m.speed = 0;
		if (m.upper === "drive" || m.upper === "carpass") m.upper = null;
		ctx.sendPose(true);
		if (!quiet) ctx.sfx("door", 0.4);
	}
	// put my avatar in my seat
	function place(c) {
		const m = ctx.me(), seat = K ? SEAT : PSEAT;
		const [x, z] = toWorld(c.x, c.z, c.h, seat[0], seat[1]);
		m.x = x; m.z = z; m.h = c.h;
	}

	// ================================================================ driving (mine)
	function drive(dt, inp) {
		if (!K) return;
		const c = K.c, m = ctx.me();
		if (m.upper !== "drive" || m.sit || stateOf(c).d !== ctx.MY_ID) { leave(true); return; }
		dt = Math.min(0.05, dt);
		const keys = inp.keys || new Set();
		const thr = clamp(+inp.z || 0, -1, 1), st = clamp(+inp.x || 0, -1, 1);
		const turbo = keys.has("shift"), hand = keys.has(" ");
		if (keys.has("e") || keys.has("r")) honk(c);
		const top = turbo ? TURBO_V : MAX_V;
		let v = c.v;
		c.brake = hand;
		if (thr > 0.05) {
			if (v < -0.3) { v = Math.min(0, v + 13 * thr * dt); c.brake = true; }
			else v += (turbo ? 9 : 6.5) * thr * Math.max(0.15, 1 - v / top) * dt;
		} else if (thr < -0.05) {
			if (v > 0.3) { v = Math.max(0, v + 14 * thr * dt); c.brake = true; }
			else v = Math.max(-REV_V, v + 4.5 * thr * dt);
		} else {
			// rolling: a little drag, and it settles to a stop
			v -= Math.sign(v) * Math.min(Math.abs(v), (0.9 + 0.012 * v * v) * dt);
		}
		if (hand) v -= Math.sign(v) * Math.min(Math.abs(v), 15 * dt);
		if (v > top) v += (top - v) * Math.min(1, dt * 1.5);
		// steering: full lock when slow, gentler at speed (and the wheel eases there, it never snaps)
		const lock = 0.6 / (1 + Math.abs(v) * 0.075);
		c.steer += (-st * lock - c.steer) * Math.min(1, dt * 5);
		const nh = wrap(c.h + v / WB * Math.tan(c.steer) * dt);
		const nx = c.x + Math.sin(nh) * v * dt, nz = c.z + Math.cos(nh) * v * dt;
		if (fits(c, nx, nz, nh)) { c.x = nx; c.z = nz; c.h = nh; }
		else {
			// scrape along whatever's in the way (one axis at a time), or stop against it
			const hit = Math.abs(v);
			if (fits(c, nx, c.z, nh)) { c.x = nx; c.h = nh; v *= 0.8; }
			else if (fits(c, c.x, nz, nh)) { c.z = nz; c.h = nh; v *= 0.8; }
			else {
				if (fits(c, c.x, c.z, nh)) c.h = nh;
				if (hit > 2.5 && performance.now() / 1000 - (K.hitT || 0) > 0.4) { K.hitT = performance.now() / 1000; ctx.sfx("thunk", Math.min(0.8, 0.2 + hit * 0.05)); ctx.sfx("bump", Math.min(0.6, hit * 0.04)); }
				v = hit > 2.5 ? -v * 0.2 : 0;
			}
		}
		c.v = v;
		place(c);
		m.anim = "sit"; m.speed = 0;
		// a pose about 20 times a second (others predict between them), and where it is, every few seconds (for anyone
		// arriving, and so the car stays where it was if this tab goes away)
		K.sendT -= dt; K.saveT -= dt;
		if (K.sendT <= 0) { K.sendT = 0.05; ctx.sendPose(true); }
		if (K.saveT <= 0) { K.saveT = 3; setState(c, { d: ctx.MY_ID, x: +c.x.toFixed(3), z: +c.z.toFixed(3), h: +c.h.toFixed(4) }); }
	}
	const driver = {
		label: "Esc to get out",
		get cam() { return { dist: 6.6 + Math.min(3, Math.abs(K ? K.c.v : 0) * 0.13), pitch: 0.27 }; },
		drive,
		exit: () => leave(false)
	};
	const rider = {
		label: "Esc to get out",
		get cam() { return { dist: 6.2, pitch: 0.3 }; },
		drive() { if (!P) return; const m = ctx.me(), s = stateOf(P.c); if (m.upper !== "carpass" || m.sit || s.p !== ctx.MY_ID) leave(true); },
		exit: () => leave(false)
	};

	// ================================================================ where everyone else's cars are (predicted)
	// The driver's avatar arrives about 20 times a second; between updates the car carries on at the speed and turn
	// rate it had, and it's eased onto each new update (so it glides, without lagging behind or overshooting).
	function follow(c, p, dt) {
		const now = performance.now() / 1000;
		// the driver's avatar is in their seat: the car's middle is behind and beside it
		const th = p.th, [cx, cz] = toWorld(p.tx, p.tz, th, -SEAT[0], -SEAT[1]);
		let T = c.track;
		if (!T || T.who !== p) {
			T = c.track = { who: p, tx: cx, tz: cz, th, at: now, vx: 0, vz: 0, w: 0 };
			c.x = cx; c.z = cz; c.h = th;
		} else if (Math.abs(cx - T.tx) > 1e-4 || Math.abs(cz - T.tz) > 1e-4 || Math.abs(th - T.th) > 1e-4) {
			const el = Math.max(0.03, now - T.at);
			const ivx = (cx - T.tx) / el, ivz = (cz - T.tz) / el, iw = wrap(th - T.th) / el;
			T.vx += (clamp(ivx, -30, 30) - T.vx) * 0.6; T.vz += (clamp(ivz, -30, 30) - T.vz) * 0.6; T.w += (clamp(iw, -4, 4) - T.w) * 0.6;
			T.tx = cx; T.tz = cz; T.th = th; T.at = now;
		}
		const ahead = Math.min(0.2, now - T.at);
		const px = T.tx + T.vx * ahead, pz = T.tz + T.vz * ahead, ph = T.th + T.w * ahead;
		if (Math.hypot(px - c.x, pz - c.z) > 8) { c.x = px; c.z = pz; c.h = ph; }
		else { const kk = Math.min(1, dt * 9); c.x += (px - c.x) * kk; c.z += (pz - c.z) * kk; c.h = wrap(c.h + wrap(ph - c.h) * kk); }
		// speed along its nose (for the wheels and the lights)
		const fv = T.vx * Math.sin(c.h) + T.vz * Math.cos(c.h);
		c.v += (fv - c.v) * Math.min(1, dt * 6);
		c.steer += ((Math.abs(c.v) > 0.5 ? -Math.atan(T.w * WB / c.v) : 0) - c.steer) * Math.min(1, dt * 6);
		c.steer = clamp(c.steer, -0.6, 0.6);
		c.brake = false;
	}
	// glue someone to a seat of the car (their avatar, and where we think they are)
	function seatPeer(c, p, seat) {
		const [x, z] = toWorld(c.x, c.z, c.h, seat[0], seat[1]);
		p.x = x; p.z = z; p.h = c.h;
		p.avatar.root.position.set(x, floorAt(x, z), z);
		p.avatar.root.rotation.order = "XYZ";
		p.avatar.root.rotation.set(0, c.h, 0);
	}

	// ================================================================ every frame (after everyone's been placed)
	function lateUpdate(dt) {
		hornT -= dt;
		const me = ctx.me();
		for (const c of cars) {
			const s = stateOf(c);
			const mineNow = K && K.c === c;
			const dPeer = !mineNow && s.d && s.d !== ctx.MY_ID ? peerOf(s.d) : null;
			if (mineNow) { /* drive() moved it */ }
			else if (dPeer) follow(c, dPeer, dt);
			else {
				// parked: ease to where it was left (a car someone just got out of is already there)
				c.track = null;
				const px = isFinite(+s.x) ? +s.x : c.def.x, pz = isFinite(+s.z) ? +s.z : c.def.z, ph = isFinite(+s.h) ? +s.h : c.def.h;
				if (Math.hypot(px - c.x, pz - c.z) > 6) { c.x = px; c.z = pz; c.h = ph; }
				else { const kk = Math.min(1, dt * 4); c.x += (px - c.x) * kk; c.z += (pz - c.z) * kk; c.h = wrap(c.h + wrap(ph - c.h) * kk); }
				c.v += (0 - c.v) * Math.min(1, dt * 4); c.steer += (0 - c.steer) * Math.min(1, dt * 3);
			}
			const running = mineNow || !!dPeer;
			// the car itself
			c.root.position.set(c.x, floorAt(c.x, c.z), c.z);
			c.root.rotation.y = c.h;
			c.spinA += c.v / WR * dt;
			c.wheels.forEach((w, i) => { w.spin.rotation.x = c.spinA; if (i < 2) w.pivot.rotation.y = c.steer; });
			c.steerWheel.rotation.z = -c.steer * 3.2;
			// on its springs: the nose dips braking and lifts pulling away, it leans out of a corner
			const acc = dt > 0 ? (c.v - c.lastV) / dt : 0, yawRate = dt > 0 ? wrap(c.h - c.lastH) / dt : 0;
			c.lastV = c.v; c.lastH = c.h;
			c.pitch += (clamp(-acc * 0.006, -0.045, 0.045) - c.pitch) * Math.min(1, dt * 5);
			c.roll += (clamp(c.v * yawRate * 0.005, -0.06, 0.06) - c.roll) * Math.min(1, dt * 5);
			c.body.rotation.set(c.pitch, 0, c.roll);
			c.body.position.y = running ? Math.sin(performance.now() / 1000 * 31 + c.i) * 0.0025 * (1 + Math.min(1, Math.abs(c.v) / 6)) : 0;
			c.lights(running, running && (c.brake || acc < -3.5), running && c.v < -0.2);
			// who's in it
			if (dPeer) seatPeer(c, dPeer, SEAT);
			const pPeer = s.p && s.p !== ctx.MY_ID ? peerOf(s.p) : null;
			if (pPeer) seatPeer(c, pPeer, PSEAT);
			if ((K && K.c === c) || (P && P.c === c)) {
				place(c);
				const av = ctx.myAvatar();
				av.root.position.set(me.x, floorAt(me.x, me.z), me.z);
				av.root.rotation.order = "XYZ";
				av.root.rotation.set(0, me.h, 0);
			}
		}
		// my engine (the one I'm in, driving or riding)
		const c = mine(), s = c && stateOf(c);
		const on = !!c && (!!K || (s && present(s.d) && s.d !== ""));
		engineSound(on, c ? c.v : 0, K ? 1 : 0);
	}
	// stale states: I'm "driving" with no car, or my seat was taken
	function update(dt) {
		const m = ctx.me();
		if (!K && !P && (m.upper === "drive" || m.upper === "carpass")) { m.upper = null; if (m.anim === "sit" && !m.sit) m.anim = "idle"; ctx.sendPose(true); }
		if (P) { const s = stateOf(P.c); if (s.p !== ctx.MY_ID) leave(true); }
	}

	// ================================================================ the doors (click the car, or E beside it)
	cars.forEach(c => {
		const nm = c.def.name;
		const driverName = () => { const s = stateOf(c); const p = peerOf(s.d); return p ? p.look.name : "someone"; };
		k.interact("car:" + c.def.id + ":drive", {
			get stand() { return toWorld(c.x, c.z, c.h, 1.5, -0.1); },
			reach: 3.0,
			label: () => {
				const s = stateOf(c);
				if ((K && K.c === c) || (P && P.c === c)) return "Get out of " + nm;
				if (!present(s.d)) return "Drive " + nm;
				if (!present(s.p)) return "Ride with " + driverName();
				return nm + " is full";
			},
			use: () => {
				const s = stateOf(c);
				if ((K && K.c === c) || (P && P.c === c)) { leave(false); return; }
				if (!present(s.d)) getIn(c, false);
				else if (!present(s.p)) getIn(c, true);
				else ctx.notice(nm + " is full - two at a time!");
			}
		}, c.body);
		k.interact("car:" + c.def.id + ":ride", {
			get stand() { return toWorld(c.x, c.z, c.h, -1.5, -0.1); },
			reach: 3.0,
			label: () => {
				const s = stateOf(c);
				if (P && P.c === c) return "Get out of " + nm;
				if (present(s.p)) return nm + "'s passenger seat is taken";
				return present(s.d) ? "Ride with " + driverName() : "Sit in " + nm + "'s passenger seat";
			},
			use: () => {
				const s = stateOf(c);
				if (P && P.c === c) { leave(false); return; }
				if (!present(s.p)) getIn(c, true);
				else ctx.notice("Someone's already in that seat.");
			}
		});
	});

	return {
		update, lateUpdate,
		vehicle: () => (K ? driver : P ? rider : null),
		// people can't walk through a car (unless they're in it)
		solidAt(x, z, r) {
			for (const c of cars) {
				if (mine() === c) continue;
				const dx = x - c.x, dz = z - c.z, lx = dx * Math.cos(c.h) - dz * Math.sin(c.h), lz = dx * Math.sin(c.h) + dz * Math.cos(c.h);
				if (Math.abs(lx) < HALF.w + r && Math.abs(lz) < HALF.l + r) return true;
			}
			return false;
		},
		onLeave() { /* (you can drive from one part of the grounds into another: the car keeps going) */ },
		onFx(d) {
			if (d.what !== "horn") return;
			const c = cars[d.car | 0];
			if (!c) return;
			const m = ctx.me(), dist = Math.hypot(m.x - c.x, m.z - c.z);
			if (dist < 45) horn(Math.max(0.15, 1 - dist / 45));
		},
		promptOpts(opts) {
			const c = mine();
			if (!c) return;
			const free = key => !opts.some(o => o.k === key);
			if (K && free("R")) opts.push({ k: "R", label: "Horn", fn: () => honk(c) });
			if (free("Esc")) opts.push({ k: "Esc", label: "Get out of " + c.def.name, fn: () => leave(false) });
		},
	};
}
