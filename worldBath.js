/**
 * Harmony World — the bathroom.
 *
 * Local coordinates: x -4..4, z -3.5..3.5. A clawfoot tub big enough for two
 * (run a bubble bath: shared key z:bath:tub), a glass rain shower in the corner
 * (z:bath:shower), a double vanity under a real mirror (on the higher graphics
 * settings it actually reflects the room), a towel rail, a round window.
 */
import { Reflector } from "three/addons/objects/Reflector.js";

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, ctx, canvasTex, rng } = k;
	const H = 3.0;
	const R = rng(71);

	// ---------------------------------------------------------------- room
	const hexTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#b8bfc4"; c.fillRect(0, 0, w, h);
		const s = 32, hh = Math.sqrt(3) * s;
		const r = rng(5);
		for (let row = -1; row < h / hh + 1; row++) for (let col = -1; col < w / (s * 1.5) + 1; col++) {
			const x = col * s * 1.5, y = row * hh + (col % 2 ? hh / 2 : 0);
			const t = 238 - r() * 14;
			c.fillStyle = r() < 0.08 ? "#7f8c8d" : `rgb(${t},${t},${t + 2})`;
			c.beginPath();
			for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(x + Math.cos(a) * (s - 2), y + Math.sin(a) * (s - 2)); }
			c.closePath(); c.fill();
		}
	}, 8 / 1.6, 7 / 1.6);
	// walls: white subway tile to shoulder height, soft sage paint above
	const wallTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#c9d6c8"; c.fillRect(0, 0, w, h);
		const split = h * 0.55;
		c.fillStyle = "#cfd6d3"; c.fillRect(0, split, w, h - split);
		for (let row = 0; row < 14; row++) for (let col = -1; col < 9; col++) {
			const x = col * 64 + (row % 2) * 32, y = split + row * 17;
			if (y > h) break;
			c.fillStyle = "#f4f7f6"; c.fillRect(x + 1.5, y + 1.5, 61, 14);
			c.fillStyle = "rgba(255,255,255,0.6)"; c.fillRect(x + 3, y + 3, 57, 3);
		}
		c.fillStyle = "#e9eeec"; c.fillRect(0, split - 8, w, 8);
	}, 8 / 2.2, 1);
	k.shell({
		w: 8, d: 7, h: H,
		floor: mat("#ffffff", 0.35, 0, { map: hexTex }),
		wall: mat("#ffffff", 0.6, 0, { map: wallTex }),
		ceil: mat("#f4f2ee", 0.95),
		holes: [
			{ wall: "w", at: 0, w: 1.5, y1: 2.3 },   // French doors from the lounge
			{ wall: "s", at: -1.0, w: 0.9, y0: 1.55, y1: 2.45 }
		]
	});
	k.walk(-4, 4, -3.5, 3.5);
	k.walk(-4.6, -3.0, -0.75, 0.75);   // through the doors to the lounge
	k.cam = { minX: -3.75, maxX: 3.75, minZ: -3.25, maxZ: 3.25, maxY: H - 0.15 };
	const chrome = mat("#e3e7ea", 0.12, 1);
	const brass = mat("#c9a05a", 0.3, 0.9);
	const white = mat("#fbfbf9", 0.25);
	// round-ish window over the tub
	{
		const wg = group(g, -1.0, 0, 3.5, Math.PI);
		add(wg, new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: tex.view(33), toneMapped: false }), 0, 2.0, -0.45, { cast: false, receive: false });
		add(wg, new THREE.TorusGeometry(0.47, 0.05, 10, 40), white, 0, 2.0, 0.02, { cast: false });
		add(wg, new THREE.BoxGeometry(0.9, 0.05, 0.24), white, 0, 1.53, 0.02);
		add(wg, new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshPhysicalMaterial({ color: "#e8f4ff", transparent: true, opacity: 0.18, roughness: 0.3, depthWrite: false }), 0, 2.0, -0.04, { cast: false });
	}
	// light switch by the doors from the lounge
	const sw = group(g, -3.98, 1.25, -1.1, Math.PI / 2);
	add(sw, rbox(0.09, 0.13, 0.015, 0.005), mat("#f5f1ea", 0.6), 0, 0, 0);
	add(sw, new THREE.BoxGeometry(0.025, 0.045, 0.015), mat("#ece6dc", 0.4), 0, 0, 0.012);

	// ---------------------------------------------------------------- clawfoot bathtub for two
	const TX = -1.0, TZ = 2.55, TL = 1.85, TW = 0.9;
	const tub = group(g, TX, 0, TZ);
	const tubShape = new THREE.Shape();
	tubShape.absarc(0, 0, 1, 0, Math.PI * 2, false);
	const tubOuter = add(tub, new THREE.CylinderGeometry(1, 0.86, 0.5, 40, 1, true), mat("#fdfcf8", 0.25, 0, { side: THREE.DoubleSide }), 0, 0.42, 0);
	tubOuter.scale.set(TL / 2, 1, TW / 2);
	const rim = add(tub, new THREE.TorusGeometry(1, 0.06, 10, 48), white, 0, 0.67, 0, { rx: Math.PI / 2 });
	rim.scale.set(TL / 2, TW / 2, 1);
	const inner = add(tub, new THREE.CylinderGeometry(0.94, 0.8, 0.02, 40), mat("#f1f3f2", 0.3), 0, 0.17, 0);
	inner.scale.set(TL / 2, 1, TW / 2);
	add(tub, new THREE.CylinderGeometry(0.8, 0.8, 0.02, 40), mat("#fdfcf8", 0.3), 0, 0.17, 0).scale.set(TL / 2, 1, TW / 2);
	// gold clawed feet
	for (const sx of [-0.7, 0.7]) for (const sz of [-0.3, 0.3]) {
		add(tub, new THREE.SphereGeometry(0.06, 10, 8), brass, sx, 0.08, sz);
		add(tub, new THREE.CylinderGeometry(0.035, 0.05, 0.12, 8), brass, sx, 0.15, sz);
	}
	// tap at the wall end
	const tubTap = group(tub, TL / 2 - 0.02, 0.67, 0);
	add(tubTap, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), brass, 0, 0.15, 0);
	add(tubTap, new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI), brass, -0.08, 0.3, 0, { rz: Math.PI });
	// the water: rises when you run a bath, foam on top, a rubber duck
	const waterM = new THREE.MeshPhysicalMaterial({ color: "#9bd8f5", transparent: true, opacity: 0.55, roughness: 0.05, depthWrite: false });
	const water = add(tub, new THREE.CircleGeometry(1, 40), waterM, 0, 0.2, 0, { rx: -Math.PI / 2, cast: false });
	water.scale.set(TL / 2 - 0.05, TW / 2 - 0.04, 1);
	const foam = [];
	const foamM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, transparent: true, opacity: 0.92 });
	for (let i = 0; i < 46; i++) {
		const a = R() * Math.PI * 2, rr = Math.sqrt(R());
		const f = add(tub, new THREE.SphereGeometry(0.05 + R() * 0.06, 10, 8), foamM, Math.cos(a) * rr * (TL / 2 - 0.12), 0.2, Math.sin(a) * rr * (TW / 2 - 0.1), { cast: false });
		f.userData.ph = R() * 6; f.userData.base = f.position.clone();
		f.visible = false;
		foam.push(f);
	}
	const duck = group(tub, 0.2, 0.2, 0.1);
	add(duck, new THREE.SphereGeometry(0.06, 12, 10), mat("#ffd23f", 0.4), 0, 0.03, 0).scale.set(1.2, 0.85, 1);
	add(duck, new THREE.SphereGeometry(0.04, 12, 10), mat("#ffd23f", 0.4), 0.05, 0.09, 0);
	add(duck, new THREE.ConeGeometry(0.018, 0.04, 8), mat("#f3722c", 0.4), 0.095, 0.085, 0, { rz: -Math.PI / 2 });
	for (const sz of [-0.02, 0.02]) add(duck, new THREE.SphereGeometry(0.007, 6, 6), mat("#111", 0.3), 0.08, 0.105, sz, { cast: false });
	duck.visible = false;
	k.box(TX - TL / 2 - 0.02, TX + TL / 2 + 0.02, TZ - TW / 2 - 0.02, 3.5);
	// two of you in the bath, facing each other
	k.spot({ id: "tubA", x: TX - 0.5, z: TZ, h: Math.PI / 2, y: -0.28 });
	k.spot({ id: "tubB", x: TX + 0.5, z: TZ, h: -Math.PI / 2, y: -0.28 });
	const TKEY = "z:bath:tub", SKEY = "z:bath:shower";
	const tubState = () => ctx.get(TKEY) || { on: false, at: 0 };
	k.interact("bath:tub", {
		label: () => !tubState().on ? "Run a bubble bath" : "Get in the bath",
		stand: [TX, TZ - 0.95],
		get sit() { return tubState().on ? ["tubA", "tubB"] : null; },
		use: () => {
			if (!tubState().on) { ctx.setShared(TKEY, { on: true, at: Date.now() }); ctx.doUpper("give", 1200); ctx.sfx("water", 0.7); ctx.notice("The bath is filling up with bubbles..."); return; }
			const s = ctx.sitOn(["tubA", "tubB"]);
			if (s) { ctx.sfx("water", 0.4); setTimeout(() => ctx.heartsFx(ctx.myAvatar().root, 3, "#bfe9ff", 1.1), 300); }
		}
	}, tub);
	// candles + a little stool with towels and a plant by the tub
	const candleFl = [];
	const st = group(g, TX + 1.35, 0, 2.9);
	add(st, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20), mat("#c89a6a", 0.6), 0, 0.5, 0);
	for (let i = 0; i < 3; i++) add(st, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), mat("#c89a6a", 0.6), Math.cos(i * 2.1) * 0.14, 0.25, Math.sin(i * 2.1) * 0.14);
	for (const [x, z, h2] of [[-0.08, 0.05, 0.14], [0.06, -0.06, 0.1], [0.09, 0.08, 0.07]]) {
		add(st, new THREE.CylinderGeometry(0.035, 0.035, h2, 12), mat("#fff8ec", 0.5), x, 0.52 + h2 / 2, z);
		candleFl.push(add(st, new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffd27a", toneMapped: false }), x, 0.535 + h2, z, { cast: false }));
	}
	k.box(TX + 1.1, TX + 1.6, 2.65, 3.15);
	const bathMat = add(g, new THREE.PlaneGeometry(1.2, 0.6), mat("#ffffff", 1, 0, { map: tex.carpet("#e9b4c8", "#ffffff", 1, 1, true) }), TX, 0.006, TZ - 0.95, { rx: -Math.PI / 2, cast: false });
	bathMat.userData.floor = true;

	// ---------------------------------------------------------------- rain shower (north-west corner)
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#dff1ff", transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
	const sg = group(g, 0, 0, 0);
	add(sg, new THREE.BoxGeometry(1.4, 0.06, 1.4), mat("#e9eeec", 0.3), -3.3, 0.03, -2.8, { cast: false });
	add(sg, new THREE.BoxGeometry(0.02, 2.1, 0.75), glassM, -2.6, 1.05, -3.12, { cast: false });
	add(sg, new THREE.BoxGeometry(0.75, 2.1, 0.02), glassM, -3.62, 1.05, -2.1, { cast: false });
	for (const [x, z, sx, sz] of [[-2.6, -2.75, 0.03, 0.03], [-3.25, -2.1, 0.03, 0.03]]) add(sg, new THREE.BoxGeometry(sx, 2.1, sz), chrome, x, 1.05, z);
	add(sg, new THREE.CylinderGeometry(0.012, 0.012, 2.3, 8), chrome, -3.95, 1.15, -3.45);
	add(sg, new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8), chrome, -3.65, 2.3, -3.2, { rx: Math.PI / 2, rz: 0.8 });
	add(sg, new THREE.CylinderGeometry(0.2, 0.2, 0.025, 28), chrome, -3.3, 2.28, -2.85);
	k.box(-2.65, -2.55, -3.5, -2.75);
	k.box(-4, -3.25, -2.15, -2.05);
	const streaks = [];
	const streakM = new THREE.MeshBasicMaterial({ color: "#d6f0ff", transparent: true, opacity: 0.55, depthWrite: false });
	const streakGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.35, 4);
	for (let i = 0; i < 46; i++) {
		const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.19;
		const s = add(g, streakGeo, streakM, -3.3 + Math.cos(a) * rr, 1.2, -2.85 + Math.sin(a) * rr, { cast: false, receive: false });
		s.userData.ph = R(); s.visible = false;
		streaks.push(s);
	}
	const showerOn = () => !!(ctx.get(SKEY) || {}).on;
	k.interact("bath:shower", {
		label: () => showerOn() ? "Turn the shower off" : "Turn on the rain shower",
		stand: [-3.25, -2.8], face: Math.PI,
		use: () => { const on = !showerOn(); ctx.setShared(SKEY, { on, by: ctx.profile().name }); ctx.sfx(on ? "water" : "click", 0.6); if (on) { ctx.doUpper("wash", 4000); ctx.updateProps(); } }
	}, sg);

	// ---------------------------------------------------------------- double vanity + mirror (east wall)
	const vz = -0.3;
	const vn = group(g, 3.68, 0, vz, -Math.PI / 2);
	add(vn, rbox(2.2, 0.8, 0.56, 0.02), mat("#4f6d7a", 0.5), 0, 0.4, 0);
	for (const sx of [-0.55, 0.55]) { add(vn, rbox(0.95, 0.62, 0.02, 0.01), mat("#587a88", 0.5), sx, 0.4, 0.285); add(vn, rbox(0.2, 0.02, 0.025, 0.006), brass, sx, 0.66, 0.3); }
	add(vn, rbox(2.26, 0.05, 0.6, 0.01), mat("#ffffff", 0.2, 0, { map: k.marbleTex() }), 0, 0.825, 0);
	const sinkTaps = [];
	for (const sx of [-0.55, 0.55]) {
		const b = add(vn, new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("#fdfcf8", 0.2, 0, { side: THREE.DoubleSide }), sx, 0.95, 0.02, { rx: Math.PI });
		b.scale.set(1, 0.5, 0.75);
		const tp = group(vn, sx, 0.85, -0.18);
		add(tp, new THREE.CylinderGeometry(0.018, 0.022, 0.26, 10), brass, 0, 0.13, 0);
		add(tp, new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8), brass, 0, 0.25, 0.07, { rx: Math.PI / 2 });
		const stream = add(tp, new THREE.CylinderGeometry(0.008, 0.012, 0.18, 8), new THREE.MeshStandardMaterial({ color: "#bfe6ff", transparent: true, opacity: 0.6 }), 0, 0.16, 0.14, { cast: false });
		stream.visible = false;
		sinkTaps.push(stream);
	}
	// soap, toothbrush cup, a little plant
	add(vn, rbox(0.08, 0.14, 0.08, 0.02), mat("#ffb3c6", 0.3), 0, 0.92, -0.15);
	add(vn, new THREE.CylinderGeometry(0.035, 0.03, 0.1, 12), mat("#e8f1f5", 0.2), 0.95, 0.9, -0.12);
	for (const [dx, c] of [[-0.01, "#ff6b81"], [0.012, "#4cc9f0"]]) add(vn, new THREE.CylinderGeometry(0.005, 0.005, 0.17, 6), mat(c, 0.4), 0.95 + dx, 0.98, -0.12, { rz: dx * 8, cast: false });
	add(vn, new THREE.CylinderGeometry(0.06, 0.05, 0.1, 12), mat("#e6dccf", 0.6), -0.95, 0.9, -0.12);
	for (let i = 0; i < 6; i++) add(vn, new THREE.SphereGeometry(0.04, 8, 6), mat("#4f8a57", 0.6), -0.95 + Math.cos(i) * 0.03, 0.98 + (i % 2) * 0.04, -0.12 + Math.sin(i) * 0.03, { cast: false });
	k.box(3.38, 4, vz - 1.15, vz + 1.15);
	// mirror: a real reflection on medium / high graphics, polished metal on low
	const MW = 2.0, MH = 1.0, MY = 1.75;
	add(vn, rbox(MW + 0.1, MH + 0.1, 0.03, 0.01), brass, 0, MY, -0.27);
	let mirror;
	if (ctx.gfxTier() >= 1) {
		mirror = new Reflector(new THREE.PlaneGeometry(MW, MH), { textureWidth: 768, textureHeight: 384, color: "#cdd5da", clipBias: 0.003 });
		mirror.position.set(0, MY, -0.25);
		vn.add(mirror);
	} else {
		add(vn, new THREE.PlaneGeometry(MW, MH), new THREE.MeshStandardMaterial({ color: "#d9e4ea", roughness: 0.04, metalness: 1 }), 0, MY, -0.25, { cast: false });
	}
	const barM = new THREE.MeshBasicMaterial({ color: "#fff4de", toneMapped: false });
	const bar = add(vn, rbox(1.6, 0.05, 0.08, 0.02), barM, 0, MY + MH / 2 + 0.14, -0.22, { cast: false });
	k.interact("bath:sink", { label: "Wash your hands", stand: [3.0, vz], face: Math.PI / 2, use: () => { ctx.doUpper("wash", 2600); ctx.updateProps(); ctx.sfx("water", 0.5); sinkRun = 2.6; ctx.send({ t: "fx", kind: "zfx", zone: "bath", what: "sink" }); } }, vn);
	let sinkRun = 0;

	// ---------------------------------------------------------------- toilet, towel rail, laundry basket, plants
	const wc = group(g, 3.55, 0, 2.55, -Math.PI / 2);
	add(wc, rbox(0.4, 0.4, 0.5, 0.12), white, 0, 0.2, 0.05);
	const bowlTop = add(wc, new THREE.CylinderGeometry(0.22, 0.2, 0.06, 24), white, 0, 0.43, 0.1);
	bowlTop.scale.set(0.9, 1, 1.15);
	add(wc, rbox(0.46, 0.04, 0.5, 0.15), mat("#f2f2ef", 0.3), 0, 0.47, 0.1);
	add(wc, rbox(0.46, 0.4, 0.18, 0.04), white, 0, 0.66, -0.22);
	add(wc, new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), chrome, 0, 0.87, -0.22);
	k.box(3.2, 4, 2.25, 2.85);
	k.spot({ id: "wcSeat", x: 3.42, z: 2.55, h: -Math.PI / 2, y: 0.03 });
	k.interact("bath:toilet", { label: "Use the toilet", stand: [2.75, 2.55], sit: ["wcSeat"] }, wc);
	const rail = group(g, 1.0, 0, 3.42, Math.PI);
	for (const sx of [-0.4, 0.4]) add(rail, new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), chrome, sx, 0.9, 0);
	for (let i = 0; i < 6; i++) add(rail, new THREE.CylinderGeometry(0.012, 0.012, 0.8, 8), chrome, 0, 0.45 + i * 0.15, 0.04, { rz: Math.PI / 2 });
	add(rail, rbox(0.62, 0.55, 0.06, 0.03), mat("#ffb3c6", 0.95), -0.05, 1.05, 0.08);
	add(rail, rbox(0.5, 0.4, 0.06, 0.03), mat("#a8dadc", 0.95), 0.08, 0.72, 0.1);
	k.box(0.5, 1.5, 3.25, 3.5);
	const basket = group(g, 3.5, 0, -2.9);
	add(basket, new THREE.CylinderGeometry(0.22, 0.18, 0.5, 18, 1, true), mat("#c8a67a", 0.9, 0, { side: THREE.DoubleSide }), 0, 0.25, 0);
	add(basket, new THREE.SphereGeometry(0.17, 12, 8), mat("#e9c46a", 0.95), 0, 0.48, 0).scale.set(1, 0.4, 1);
	k.box(3.25, 3.75, -3.15, -2.65);
	for (const [x, z] of [[-3.6, 3.1], [1.8, 3.15]]) {
		const p = group(g, x, 0, z);
		add(p, new THREE.CylinderGeometry(0.17, 0.13, 0.36, 16), white, 0, 0.18, 0);
		for (let i = 0; i < 9; i++) {
			const a = i / 9 * Math.PI * 2;
			const leaf = add(p, new THREE.SphereGeometry(0.13, 10, 8), mat(i % 2 ? "#4f8a57" : "#3f7a4a", 0.65), Math.cos(a) * 0.1, 0.55 + (i % 3) * 0.16, Math.sin(a) * 0.1);
			leaf.scale.set(0.5, 1.5, 0.5); leaf.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
		}
		k.box(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
	}
	// recessed lights
	const dlM = new THREE.MeshBasicMaterial({ color: "#fff6e2", toneMapped: false });
	for (const [x, z] of [[-1.5, -1.0], [1.5, -1.0], [-1.0, 1.5], [1.5, 1.5]]) add(g, new THREE.CircleGeometry(0.08, 18), dlM, x, H - 0.005, z, { rx: Math.PI / 2, cast: false, receive: false });

	// ---------------------------------------------------------------- light
	const L = {
		mirrorA: k.light(3.3, 2.3, vz - 0.6, "#fff1d6", 2.2, 4.5),
		mirrorB: k.light(3.3, 2.3, vz + 0.6, "#fff1d6", 2.2, 4.5),
		candles: k.light(TX + 1.2, 0.9, 2.7, "#ffb35a", 1.6, 3.2),
		shower: k.light(-3.3, 2.1, -2.85, "#dff1ff", 1.2, 3.5),
		window: k.light(-1.0, 2.1, 3.1, "#a9b8ff", 1.2, 3.5),
		ceilA: k.light(-1.5, 2.8, -1.0, "#ffe9cf", 1.8, 5),
		ceilB: k.light(1.0, 2.8, 1.5, "#ffe9cf", 1.8, 5)
	};
	// switches: the ceiling lights (by the door), the mirror light, the candles by the tub
	const ceil = k.lamp("ceiling", L.ceilA, [dlM], [sw], [-3.35, -1.1], "ceiling lights");
	const mirLamp = k.lamp("mirror", L.mirrorA, [barM], [bar], [3.0, vz + 0.95], "mirror light");
	const candleLamp = k.lamp("candles", null, [], [st], [TX + 1.35, 2.1], "candles");
	k.key.pos.copy(k.V(0, H - 0.08, 0)); k.key.target.copy(k.V(-0.3, 0, 0.6));
	k.key.angle = 1.3; k.key.intensity = 18; k.key.distance = 11;
	k.fill.pos.copy(k.V(0, 2.6, 0)); k.fill.intensity = 5; k.fill.distance = 16;
	k.hemi = 0.5; k.env = 0.36; k.exposure = 1.04;

	// ---------------------------------------------------------------- every frame (while you're here)
	let level = 0, steamT = 0, lastSit = null;
	const steam = [];
	const steamM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.18, depthWrite: false });
	function puff(x, y, z, size) {
		const s = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), steamM.clone());
		s.position.set(x, y, z);
		s.userData.life = 0;
		g.add(s);
		steam.push(s);
	}
	function update(dt, t) {
		const ts = tubState();
		// fills over ~5 seconds after someone runs it
		const want = ts.on ? Math.min(1, (Date.now() - ts.at) / 5000) : 0;
		level += (want - level) * Math.min(1, dt * 3);
		const wy = 0.2 + level * 0.32;
		water.position.y = wy;
		water.visible = level > 0.02;
		foam.forEach(f => { f.visible = level > 0.35; f.position.y = wy + 0.02 + Math.sin(t * 1.4 + f.userData.ph) * 0.01; f.scale.setScalar(Math.min(1, (level - 0.35) * 2)); });
		duck.visible = level > 0.5;
		duck.position.set(0.2 + Math.sin(t * 0.4) * 0.35, wy - 0.01 + Math.sin(t * 2) * 0.006, Math.cos(t * 0.33) * 0.18);
		duck.rotation.y = t * 0.4;
		const sh = showerOn();
		streaks.forEach(s => {
			s.visible = sh;
			if (!sh) return;
			const p = (t * 2.8 + s.userData.ph) % 1;
			s.position.y = 2.2 - p * 2.1;
		});
		L.shower.intensity = sh ? 1.8 : 0.6;
		sinkRun = Math.max(0, sinkRun - dt);
		sinkTaps.forEach(s => { s.visible = sinkRun > 0; });
		// steam from a hot bath / the shower
		steamT += dt;
		if (steamT > 0.25) {
			steamT = 0;
			if (level > 0.5) puff(TX + (Math.random() - 0.5) * 1.2, wy + 0.1, TZ + (Math.random() - 0.5) * 0.5, 0.08 + Math.random() * 0.06);
			if (sh) puff(-3.3 + (Math.random() - 0.5) * 0.5, 1.6 + Math.random() * 0.5, -2.85 + (Math.random() - 0.5) * 0.5, 0.1 + Math.random() * 0.08);
		}
		for (let i = steam.length - 1; i >= 0; i--) {
			const s = steam[i];
			s.userData.life += dt;
			s.position.y += dt * 0.25;
			s.scale.setScalar(1 + s.userData.life * 1.5);
			s.material.opacity = Math.max(0, 0.18 - s.userData.life * 0.05);
			if (s.material.opacity <= 0) { g.remove(s); s.geometry.dispose(); s.material.dispose(); steam.splice(i, 1); }
		}
		const cOn = candleLamp.on();
		candleFl.forEach((c, i) => { c.visible = cOn; c.scale.y = 1 + Math.sin(t * 14 + i * 2) * 0.25; });
		L.candles.intensity = cOn ? 1.5 + Math.sin(t * 11) * 0.2 : 0;
		// the second ceiling light and the second mirror light follow their switches; the big light dims with the ceiling
		const cK = L.ceilA.intensity / L.ceilA.base, mK = L.mirrorA.intensity / L.mirrorA.base;
		L.ceilB.intensity = L.ceilB.base * cK;
		L.mirrorB.intensity = L.mirrorB.base * mK;
		k.key.intensity = 18 * (0.08 + 0.92 * cK);
		k.hemi = 0.18 + 0.32 * Math.max(cK, mK * 0.6);
		// flushing as you get up
		const s2 = ctx.me().sit;
		if (lastSit === "wcSeat" && s2 !== "wcSeat") ctx.sfx("water", 0.7);
		lastSit = s2;
		void ceil; void mirLamp;
	}

	return {
		update,
		onFx(d) { if (d.what === "sink") sinkRun = 2.6; },
		applyKey(key, remote) {
			if (!remote) return;
			if (key === TKEY && tubState().on) ctx.notice("Someone ran a bubble bath");
		},
		promptOpts(opts) {
			const me = ctx.me();
			const free = key => !opts.some(o => o.k === key);
			// drain it when nobody's in it
			if (!me.sit && tubState().on && Math.hypot(me.x - (TX + k.ox), me.z - (TZ + k.oz)) < 1.8 && !ctx.whoSits("tubA") && !ctx.whoSits("tubB") && free("R")) opts.push({ k: "R", label: "Drain the bath", fn: () => { ctx.setShared(TKEY, { on: false, at: 0 }); ctx.sfx("water", 0.4); } });
			// the mirror: change how you look
			if (!me.sit && Math.hypot(me.x - (3.0 + k.ox), me.z - (vz + k.oz)) < 1.3 && free("F")) opts.push({ k: "F", label: "Change your look", fn: () => ctx.showLook() });
		}
	};
}
