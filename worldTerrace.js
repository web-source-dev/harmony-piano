/**
 * Harmony World — the terrace: at roof level, cantilevered out from the roof deck's south edge over the lawn, with
 * nothing under it but a slim slab and its steel beams.
 *
 * You walk onto it from the roof deck (worldRoof.js), through the gap in its north railing. Built with the same helpers
 * as the room (passed in as `h`) and returns handles for the things the world animates or reads: the swing, the fire,
 * the telescope and the painting easel.
 *
 * Built in its own coordinates, x -7..5.5, z -12..-6.2, into a group that worldRoom.js lifts up onto the roof; the
 * helpers move everything it registers onto its floor plan (TERRACE in worldRoom.js), and h.addLight its lights.
 */
import * as THREE from "three";
import { TSTAIR } from "./worldRoom.js";

export function buildTerrace(scene, h) {
	const { add, mat, group, rbox, canvasTex, interact, box, sitSpots, updaters, rng, lightWood, wood, darkWood, brass } = h;
	const R = rng(77);

	// ---------- deck
	const deckTex = canvasTex(1024, 1024, (g, w, ht) => {
		const tones = ["#8f6d55", "#9a7760", "#84634c", "#a17d64"];
		const rows = 14, ph = ht / rows;
		for (let i = 0; i < rows; i++) {
			g.fillStyle = tones[i % tones.length];
			g.fillRect(0, i * ph, w, ph);
			for (let k = 0; k < 10; k++) {
				g.strokeStyle = `rgba(50,30,20,${0.05 + R() * 0.1})`;
				g.lineWidth = 1 + R();
				g.beginPath(); const y = i * ph + R() * ph; g.moveTo(0, y); g.lineTo(w, y + (R() - 0.5) * 6); g.stroke();
			}
			g.fillStyle = "rgba(25,15,10,0.65)"; g.fillRect(0, i * ph + ph - 5, w, 5);
			for (let x = R() * 200; x < w; x += 260 + R() * 200) { g.fillStyle = "rgba(25,15,10,0.5)"; g.fillRect(x, i * ph, 4, ph); }
		}
	}, 12.5 / 3, 5.8 / 3);
	const deck = add(scene, new THREE.PlaneGeometry(12.5, 5.8), mat("#ffffff", 0.8, 0, { map: deckTex }), -0.75, 0.0, -9.1, { rx: -Math.PI / 2, cast: false });
	deck.userData.floor = true;
	// edge fascia so the deck looks like it has thickness
	add(scene, new THREE.BoxGeometry(12.6, 0.3, 0.1), mat("#5b4636", 0.8), -0.75, -0.15, -12.02);

	// ---------- glass railing with a wooden handrail
	const railM = mat("#6b4f3a", 0.5);
	const postM = mat("#3e3a3a", 0.4, 0.6);
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe7ff", transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
	const railRun = (x0, z0, x1, z1) => {
		const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
		const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
		const g = group(scene, cx, 0, cz, ang);
		add(g, new THREE.BoxGeometry(0.08, 0.06, len + 0.08), railM, 0, 1.05, 0);
		const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), glassM);
		gl.rotation.y = Math.PI / 2; gl.position.y = 0.55;
		g.add(gl);
		const n = Math.max(1, Math.round(len / 1.25));
		for (let i = 0; i <= n; i++) add(g, new THREE.BoxGeometry(0.06, 1.05, 0.06), postM, 0, 0.525, -len / 2 + (len * i) / n);
	};
	// glass railings all round (a gap in the north one: the way in from the roof deck)
	railRun(-6.95, -11.95, 5.45, -11.95);
	railRun(-6.95, -6.25, TSTAIR.x0, -6.25);
	railRun(TSTAIR.x1, -6.25, 5.45, -6.25);
	railRun(-6.95, -6.25, -6.95, -11.95);
	railRun(5.45, -6.25, 5.45, -11.95);
	box(-7.0, 5.5, -12.0, -11.9);
	box(-7.0, TSTAIR.x0, -6.3, -6.2);
	box(TSTAIR.x1, 5.5, -6.3, -6.2);
	box(-7.0, -6.9, -12.0, -6.2);
	box(5.4, 5.5, -12.0, -6.2);
	// the cantilever: a slim slab under the deck, steel beams running back into the roof, a lit edge
	{
		const slabM = mat("#e9e3d8", 0.8), steel = mat("#2e2a31", 0.45, 0.5);
		add(scene, new THREE.BoxGeometry(12.7, 0.32, 5.9), slabM, -0.75, -0.17, -9.1);
		for (const x of [-5.6, -2.4, 0.9, 4.1]) add(scene, new THREE.BoxGeometry(0.22, 0.3, 7.6), steel, x, -0.48, -8.3);
		add(scene, new THREE.BoxGeometry(12.72, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false }), -0.75, -0.33, -12.06, { cast: false });
	}
	{
		const sg = group(scene, TSTAIR.x1 + 0.45, 0, -6.6);
		add(sg, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), mat("#5b4636", 0.7), 0, 0.55, 0);
		add(sg, rbox(0.82, 0.22, 0.04, 0.02), mat("#8a5a3c", 0.6), 0, 1.15, 0);
		const c = canvasTex(512, 128, (g, w, h) => { g.fillStyle = "#f6ecd2"; g.font = "800 72px 'Caveat', 'Nunito', cursive"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Terrace", w / 2, h / 2 + 4); });
		add(sg, new THREE.PlaneGeometry(0.76, 0.16), new THREE.MeshBasicMaterial({ map: c, transparent: true, depthWrite: false }), 0, 1.15, 0.025, { cast: false, receive: false });
		box(TSTAIR.x1 + 0.38, TSTAIR.x1 + 0.52, -6.67, -6.53);
	}

	// ---------- string lights overhead
	const bulbs = [];
	const poleM = mat("#2e2b2b", 0.5, 0.5);
	const tops = [[-6.85, -11.85], [5.35, -11.85], [5.35, -6.4], [-6.85, -6.4]];
	tops.forEach(([x, z]) => add(scene, new THREE.CylinderGeometry(0.035, 0.045, 2.95, 10), poleM, x, 1.475, z));
	const strand = (a, b, sag) => {
		const pts = [];
		for (let i = 0; i <= 20; i++) {
			const u = i / 20;
			pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, 2.9 - Math.sin(u * Math.PI) * sag, a[1] + (b[1] - a[1]) * u));
		}
		const curve = new THREE.CatmullRomCurve3(pts);
		add(scene, new THREE.TubeGeometry(curve, 60, 0.005, 4), mat("#222", 0.6), 0, 0, 0, { cast: false });
		const n = Math.round(curve.getLength() / 0.55);
		for (let i = 1; i < n; i++) {
			const p = curve.getPoint(i / n);
			const bm = new THREE.MeshStandardMaterial({ color: "#ffd9a0", emissive: "#ffc26b", emissiveIntensity: 2.4 });
			const b = add(scene, new THREE.SphereGeometry(0.04, 10, 8), bm, p.x, p.y - 0.05, p.z, { cast: false });
			b.userData.ph = R() * 6;
			bulbs.push(b);
		}
	};
	strand(tops[0], tops[1], 0.35);
	strand(tops[3], tops[1], 0.5);
	strand(tops[2], tops[0], 0.5);
	strand(tops[3], tops[0], 0.3);
	const l1 = new THREE.PointLight("#ffcf8f", 5, 10, 1.8); l1.position.set(-3.2, 2.5, -9.2);
	const l2 = new THREE.PointLight("#ffcf8f", 4, 10, 1.8); l2.position.set(2.8, 2.5, -9.6);
	h.addLight(l1, l2);
	updaters.push((dt, t) => bulbs.forEach(b => { b.material.emissiveIntensity = 1.8 + Math.sin(t * 1.7 + b.userData.ph) * 0.6; }));

	// ---------- potted olive trees
	const tree = (x, z, s) => {
		const g = group(scene, x, 0, z);
		add(g, new THREE.CylinderGeometry(0.32 * s, 0.24 * s, 0.6 * s, 20), mat("#c9b8a5", 0.7), 0, 0.3 * s, 0);
		add(g, new THREE.CircleGeometry(0.3 * s, 18), mat("#3a2a1f", 1), 0, 0.59 * s, 0, { rx: -Math.PI / 2, cast: false });
		add(g, new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 1.3 * s, 8), mat("#6b5040", 0.8), 0, 1.2 * s, 0, { rz: 0.08 });
		for (let i = 0; i < 9; i++) {
			const a = i * 2.1, r = 0.25 + (i % 3) * 0.12;
			const f = add(g, new THREE.SphereGeometry(0.26 * s, 12, 10), mat(i % 2 ? "#7d9a62" : "#6a8a55", 0.75), Math.cos(a) * r * s, (1.75 + (i % 4) * 0.14) * s, Math.sin(a) * r * s);
			f.scale.set(1, 0.75, 1);
		}
		box(x - 0.35 * s, x + 0.35 * s, z - 0.35 * s, z + 0.35 * s);
	};
	tree(-6.45, -11.45, 1);
	tree(4.95, -6.8, 0.9);

	// ---------- swing bench on an A-frame (faces +x, along the terrace)
	const swingG = group(scene, -6.25, 0, -9.4, Math.PI / 2);
	const frameM = mat("#f4efe8", 0.6);
	for (const sx of [-1.15, 1.15]) {
		add(swingG, new THREE.BoxGeometry(0.08, 2.2, 0.08), frameM, sx, 1.05, -0.45, { rx: 0.2 });
		add(swingG, new THREE.BoxGeometry(0.08, 2.2, 0.08), frameM, sx, 1.05, 0.45, { rx: -0.2 });
	}
	add(swingG, new THREE.BoxGeometry(2.45, 0.1, 0.1), frameM, 0, 2.08, 0);
	const hang = group(swingG, 0, 2.05, 0);
	const SWING_L = 1.55;
	for (const sx of [-0.62, 0.62]) for (const sz of [-0.18, 0.18]) add(hang, new THREE.CylinderGeometry(0.008, 0.008, SWING_L, 6), mat("#9a9a9a", 0.3, 0.9), sx, -SWING_L / 2, sz, { cast: false });
	const seat = group(hang, 0, -SWING_L, 0);
	add(seat, rbox(1.35, 0.06, 0.48, 0.02), lightWood, 0, -0.02, 0);
	add(seat, rbox(1.35, 0.42, 0.05, 0.02), lightWood, 0, 0.22, -0.23, { rx: -0.12 });
	add(seat, rbox(1.25, 0.1, 0.42, 0.04), mat("#e8a1a8", 0.95), 0, 0.05, 0.01);
	add(seat, rbox(0.4, 0.34, 0.1, 0.04), mat("#a8c5e8", 0.95), -0.42, 0.25, -0.15, { rx: -0.2 });
	box(-6.75, -5.75, -10.7, -8.1);
	const swing = { angle: 0, occupied: false, vel: 0, L: SWING_L };
	updaters.push((dt, t) => {
		const target = swing.occupied ? Math.sin(t * 1.55) * 0.22 : 0;
		swing.angle += (target - swing.angle) * Math.min(1, dt * 2.5);
		hang.rotation.x = swing.angle;
	});
	// seat is 0.5m off the deck; swing local x runs along world -z
	sitSpots.push({ id: "swing0", x: -6.25 + 0.03, z: -9.4 + 0.32, h: Math.PI / 2, y: 0.02, swing: true });
	sitSpots.push({ id: "swing1", x: -6.25 + 0.03, z: -9.4 - 0.32, h: Math.PI / 2, y: 0.02, swing: true });
	interact("swing", { label: "Sit on the swing", stand: [-5.2, -9.4], sit: ["swing0", "swing1"] }, swingG);

	// ---------- bistro table for two
	const bis = group(scene, -2.6, 0, -10.8);
	const ironM = mat("#2b2b30", 0.35, 0.7);
	add(bis, new THREE.CylinderGeometry(0.38, 0.38, 0.03, 32), mat("#e9e3da", 0.3), 0, 0.74, 0);
	add(bis, new THREE.CylinderGeometry(0.025, 0.03, 0.72, 10), ironM, 0, 0.37, 0);
	add(bis, new THREE.CylinderGeometry(0.22, 0.25, 0.03, 20), ironM, 0, 0.015, 0);
	// lantern + two glasses
	add(bis, rbox(0.12, 0.18, 0.12, 0.02), mat("#1d1d22", 0.4, 0.5), 0, 0.85, 0);
	const lanFlame = add(bis, new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffcf6b", toneMapped: false }), 0, 0.84, 0, { cast: false });
	const lanLight = new THREE.PointLight("#ffb45e", 1.2, 3, 2); lanLight.position.set(-2.6, 1.0, -10.8);
	lanLight.userData.notInScene = true;   // (moved up with the rest, but never added: it only ever counted as a light slot)
	h.addLight(lanLight);
	updaters.push((dt, t) => { const f = 0.85 + Math.sin(t * 11) * 0.1 + Math.sin(t * 6.1) * 0.06; lanFlame.scale.set(1, 1.6 * f, 1); lanLight.intensity = 1.2 * f; });
	const wineM = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false });
	for (const sx of [-0.18, 0.18]) {
		add(bis, new THREE.CylinderGeometry(0.035, 0.02, 0.07, 14, 1, true), wineM, sx, 0.88, 0.12, { cast: false });
		add(bis, new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), wineM, sx, 0.8, 0.12, { cast: false });
		add(bis, new THREE.CylinderGeometry(0.03, 0.025, 0.03, 14), mat("#7a1d33", 0.2), sx, 0.865, 0.12, { cast: false });
	}
	const chair = (x, z, ry) => {
		const c = group(scene, x, 0, z, ry);
		add(c, new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24), ironM, 0, 0.46, 0);
		add(c, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), mat("#d9867a", 0.9), 0, 0.49, 0);
		for (const sx of [-0.15, 0.15]) for (const sz of [-0.15, 0.15]) add(c, new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6), ironM, sx, 0.23, sz);
		add(c, new THREE.TorusGeometry(0.2, 0.012, 6, 20, Math.PI), ironM, 0, 0.7, -0.17);
		for (const sx of [-0.19, 0.19]) add(c, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), ironM, sx, 0.6, -0.17);
		return c;
	};
	const c0 = chair(-3.27, -10.8, Math.PI / 2), c1 = chair(-1.93, -10.8, -Math.PI / 2);
	box(-3.05, -2.15, -11.2, -10.4);
	box(-3.5, -3.05, -11.05, -10.55); box(-2.15, -1.7, -11.05, -10.55);
	sitSpots.push({ id: "chair0", x: -3.27, z: -10.8, h: Math.PI / 2, y: 0.0 });
	sitSpots.push({ id: "chair1", x: -1.93, z: -10.8, h: -Math.PI / 2, y: 0.0 });
	interact("bistro", { label: "Sit at the little table", stand: [-2.6, -9.95], sit: ["chair0", "chair1"] }, bis, c0, c1);

	// ---------- fire pit with two bean bags
	const fx = 2.0, fz = -9.2;
	const pit = group(scene, fx, 0, fz);
	const stoneM = mat("#7b7470", 0.9);
	for (let i = 0; i < 12; i++) {
		const a = i / 12 * Math.PI * 2;
		add(pit, rbox(0.26, 0.2, 0.18, 0.05), stoneM, Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5, { ry: -a });
	}
	add(pit, new THREE.CircleGeometry(0.45, 20), mat("#2a2420", 1), 0, 0.02, 0, { rx: -Math.PI / 2, cast: false });
	for (let i = 0; i < 4; i++) add(pit, new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), mat("#4a3020", 0.9), 0, 0.08, 0, { rz: Math.PI / 2, ry: i * Math.PI / 4 });
	const flameMs = [];
	const flames = [];
	for (let i = 0; i < 7; i++) {
		const m = new THREE.MeshBasicMaterial({ color: i % 2 ? "#ffb347" : "#ff7a2f", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
		flameMs.push(m);
		const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 + R() * 0.05, 0.45, 10), m);
		f.position.set((R() - 0.5) * 0.25, 0.3, (R() - 0.5) * 0.25);
		f.userData.ph = R() * 6;
		pit.add(f);
		flames.push(f);
	}
	const fireLight = new THREE.PointLight("#ff8a3d", 5, 7, 2);
	fireLight.position.set(fx, 0.6, fz);
	h.addLight(fireLight);
	// a fixed pool of embers, reused (creating and disposing meshes every few frames churned the GPU and GC)
	const emberGeo = new THREE.SphereGeometry(0.01, 4, 3);
	const embers = Array.from({ length: 20 }, () => {
		const e = new THREE.Mesh(emberGeo, new THREE.MeshBasicMaterial({ color: "#ffb347", toneMapped: false, transparent: true }));
		e.visible = false;
		e.userData.v = new THREE.Vector3();
		e.userData.life = 0;
		scene.add(e);
		return e;
	});
	let fireOn = true;
	updaters.push((dt, t) => {
		flames.forEach((f, i) => {
			const k = 0.75 + Math.sin(t * 9 + f.userData.ph) * 0.2 + Math.sin(t * 15 + i) * 0.1;
			f.scale.set(1, k, 1);
			f.position.y = 0.12 + 0.225 * k;
			f.rotation.y += dt;
		});
		fireLight.intensity = fireOn ? 4.2 + Math.sin(t * 13) * 0.6 + Math.sin(t * 7.7) * 0.5 : 0;
		if (fireOn && Math.random() < dt * 8) {
			const e = embers.find(e => !e.visible);
			if (e) {
				e.position.set(fx + (Math.random() - 0.5) * 0.3, 0.4, fz + (Math.random() - 0.5) * 0.3);
				e.userData.v.set((Math.random() - 0.5) * 0.2, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.2);
				e.userData.life = 0;
				e.visible = true;
			}
		}
		for (const e of embers) {
			if (!e.visible) continue;
			e.userData.life += dt;
			e.position.addScaledVector(e.userData.v, dt);
			e.material.opacity = Math.max(0, 1 - e.userData.life / 1.8);
			if (e.userData.life > 1.8) e.visible = false;
		}
	});
	box(fx - 0.62, fx + 0.62, fz - 0.62, fz + 0.62);
	interact("fire", { label: "Warm your hands by the fire", stand: [fx, fz + 1.05], face: Math.PI }, pit);
	const beanM = [mat("#5e7d6f", 0.95), mat("#c4836a", 0.95)];
	[[fx - 1.05, fz - 0.8], [fx + 1.05, fz - 0.8]].forEach(([bx, bz], i) => {
		const face = Math.atan2(fx - bx, fz - bz);
		const bb = group(scene, bx, 0, bz, face);
		const body = add(bb, new THREE.SphereGeometry(0.42, 24, 16), beanM[i], 0, 0.22, 0);
		body.scale.set(1, 0.55, 1);
		const backRest = add(bb, new THREE.SphereGeometry(0.34, 20, 14), beanM[i], 0, 0.38, -0.22);
		backRest.scale.set(1.05, 0.9, 0.6);
		box(bx - 0.35, bx + 0.35, bz - 0.35, bz + 0.35);
		sitSpots.push({ id: "bean" + i, x: bx + Math.sin(face) * 0.05, z: bz + Math.cos(face) * 0.05, h: face, y: -0.13, low: true });
		interact("bean" + i, { label: "Sink into the bean bag", stand: [bx + Math.sin(face) * 0.75, bz + Math.cos(face) * 0.75], sit: ["bean" + i] }, bb);
	});

	// ---------- telescope pointed at the moon
	const MOON = h.moonDir.clone();
	const tx = 4.4, tz = -11.05, ty = 1.22;
	const scope = group(scene, tx, 0, tz);
	for (let i = 0; i < 3; i++) {
		const a = i / 3 * Math.PI * 2 + 0.4;
		const leg = add(scope, new THREE.CylinderGeometry(0.015, 0.012, 1.3, 8), mat("#c9c3bb", 0.4, 0.6), Math.cos(a) * 0.22, 0.6, Math.sin(a) * 0.22);
		leg.lookAt(scope.localToWorld(new THREE.Vector3(0, 1.3, 0)));
		leg.rotateX(Math.PI / 2);
	}
	const tube = new THREE.Group();
	tube.position.set(0, ty, 0);
	scope.add(tube);
	tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), MOON);
	add(tube, new THREE.CylinderGeometry(0.07, 0.055, 0.9, 20), mat("#f2efe9", 0.35, 0.2), 0, 0.15, 0);
	add(tube, new THREE.CylinderGeometry(0.075, 0.075, 0.08, 20), brass, 0, 0.6, 0);
	add(tube, new THREE.CylinderGeometry(0.02, 0.022, 0.12, 10), mat("#222", 0.4), 0, -0.36, 0);
	add(tube, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), mat("#333", 0.4), 0, -0.1, 0.06, { rx: Math.PI / 2 });
	const eyepiece = new THREE.Object3D();
	eyepiece.position.set(0, -0.44, 0);
	tube.add(eyepiece);
	const horiz = new THREE.Vector3(MOON.x, 0, MOON.z).normalize();
	box(tx - 0.3, tx + 0.3, tz - 0.3, tz + 0.3);
	const scopeStand = [tx - horiz.x * 0.72, tz - horiz.z * 0.72];
	interact("telescope", { label: "Look through the telescope", stand: scopeStand, face: Math.atan2(horiz.x, horiz.z) }, scope);

	// ---------- flower planters along the railing (pick one and give it to someone)
	const planterM = mat("#8a6a50", 0.7);
	const bloomCols = ["#ff6b8b", "#ffd166", "#f78fb3", "#c77dff", "#ff9f68", "#ffffff"];
	const planters = [];
	[-0.75, 0.6, 1.95].forEach((cx, pi) => {
		const p = group(scene, cx, 0, -11.62);
		planters.push(p);
		add(p, rbox(1.25, 0.45, 0.42, 0.03), planterM, 0, 0.225, 0);
		add(p, new THREE.PlaneGeometry(1.15, 0.34), mat("#3a2a1f", 1), 0, 0.44, 0, { rx: -Math.PI / 2, cast: false });
		for (let i = 0; i < 14; i++) {
			const x = -0.5 + (i % 7) * 0.165 + (R() - 0.5) * 0.04, z = (i < 7 ? -0.08 : 0.08), hgt = 0.22 + R() * 0.2;
			add(p, new THREE.CylinderGeometry(0.005, 0.006, hgt, 5), mat("#3d6b35", 0.6), x, 0.44 + hgt / 2, z, { cast: false });
			const col = bloomCols[(i + pi * 3) % bloomCols.length];
			for (let k = 0; k < 5; k++) {
				const pe = add(p, new THREE.SphereGeometry(0.025, 8, 6), mat(col, 0.5), x + Math.cos(k * 1.256) * 0.025, 0.44 + hgt, z + Math.sin(k * 1.256) * 0.025, { cast: false });
				pe.scale.set(1, 0.45, 1);
			}
			add(p, new THREE.SphereGeometry(0.014, 6, 5), mat("#ffd23f", 0.5), x, 0.452 + hgt, z, { cast: false });
		}
		box(cx - 0.65, cx + 0.65, -11.85, -11.4);
	});
	interact("flowers", { label: "Pick a flower", stand: [0.6, -10.9], face: Math.PI }, ...planters);

	// ---------- painting easel (two people can paint side by side)
	const ex = 0.1, ez = -8.35;
	const easel = group(scene, ex, 0, ez, 0);
	for (const sx of [-0.32, 0.32]) add(easel, new THREE.BoxGeometry(0.04, 1.75, 0.04), lightWood, sx, 0.86, 0.05, { rz: sx * -0.12, rx: -0.08 });
	add(easel, new THREE.BoxGeometry(0.04, 1.7, 0.04), lightWood, 0, 0.82, -0.38, { rx: 0.32 });
	add(easel, new THREE.BoxGeometry(0.9, 0.04, 0.1), lightWood, 0, 0.8, 0.1);
	const easelCanvas = document.createElement("canvas");
	easelCanvas.width = 640; easelCanvas.height = 480;
	const easelTex = new THREE.CanvasTexture(easelCanvas);
	easelTex.colorSpace = THREE.SRGBColorSpace;
	add(easel, new THREE.BoxGeometry(0.86, 0.66, 0.03), mat("#f5f0e6", 0.9), 0, 1.16, 0.085, { rx: -0.08 });
	const paper = add(easel, new THREE.PlaneGeometry(0.82, 0.615), new THREE.MeshStandardMaterial({ map: easelTex, roughness: 0.9 }), 0, 1.16, 0.102, { rx: -0.08, cast: false });
	add(easel, new THREE.CylinderGeometry(0.08, 0.08, 0.008, 20), lightWood, 0.3, 0.825, 0.12);
	["#e63946", "#457b9d", "#f1c453", "#2a9d8f"].forEach((c, i) => add(easel, new THREE.SphereGeometry(0.012, 8, 6), mat(c, 0.3), 0.3 + Math.cos(i * 1.4) * 0.05, 0.832, 0.12 + Math.sin(i * 1.4) * 0.05, { cast: false }));
	box(ex - 0.45, ex + 0.45, ez - 0.5, ez + 0.2);
	// painters stand just in front of the paper so the brush can reach it
	const easelStands = [[ex - 0.3, ez + 0.66], [ex + 0.3, ez + 0.66]];
	interact("easel", { label: "Paint together", stand: easelStands[0], stands: easelStands, face: Math.PI }, easel);
	const tmp = new THREE.Vector3();
	function easelPoint(u, v, out) {
		out = out || new THREE.Vector3();
		return paper.localToWorld(out.set((u - 0.5) * 0.82, (0.5 - v) * 0.615, 0.004));
	}
	void tmp;

	return {
		lights: [l1, l2, fireLight],
		minorLights: [lanLight],   // small accent lights the low graphics setting switches off
		swing, easel: { canvas: easelCanvas, tex: easelTex, point: easelPoint, stands: easelStands, face: Math.PI },
		telescope: { eyepiece, dir: MOON, stand: h.fp(scopeStand) },
		fire: { x: h.fp([fx, fz])[0], z: h.fp([fx, fz])[1] },
		// dim the light rather than hiding it: a hidden light changes the light count and recompiles every shader
		setFireOn: on => { fireOn = on; flames.forEach(f => { f.visible = on; }); }
	};
}
