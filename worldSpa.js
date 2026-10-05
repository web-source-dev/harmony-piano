/**
 * Harmony World — the spa, off the hallway behind the lounge (worldHall.js; the game room is across it).
 *
 * Local coordinates (origin at world 18.75, 11.15): x -4..4, z -2.7..2.7, ceiling 3.2 m. The door is in the
 * west wall (x -4) at z 0, out to the hallway.
 *
 *   a wooden sauna for two (pour water on the stones: a cloud of steam for everyone in there)
 *   two massage tables: lie face down (head in the face cradle), and whoever's beside you can give you a massage
 *   two spa recliners side by side (hold hands), a treatment mirror (face masks and a glow-up),
 *   herbal tea and fruit, a zen water wall, candles and plants.
 */
const W = 8.0, D = 5.4, H = 3.2, HW = W / 2, HD = D / 2;
const SAUNA = { x0: 1.6, x1: HW, z0: 0.4, z1: HD, h: 2.3, door0: 1.0, door1: 1.9 };
const TABLES = [{ id: "massage0", x: 0.6, z: -1.5 }, { id: "massage1", x: 2.9, z: -1.5 }];

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng, tex } = k;
	const R = rng(777);

	// ---------------------------------------------------------------- the room
	k.shell({
		w: W, d: D, h: H,
		floor: mat("#ffffff", 0.35, 0, { map: tex.tiles("#e9e1d3", "#e1d8c8", "#cbbfac", W / 1.2, D / 1.2, 4) }),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#eadccb", "panel", "rgba(150,120,90,0.10)", W / 2, H / 2) }),
		ceil: mat("#f3ebe0", 0.95),
		holes: [{ wall: "w", at: 0, w: 1.5, y1: 2.3 }]
	});
	k.floor(() => 0);
	k.walk(-HW, HW, -HD, HD);
	k.walk(-HW - 0.9, -HW + 1.0, -0.7, 0.7);     // out to the hallway
	k.frenchDoor("spahall", { x: -HW - 0.13, z: 0, ry: -Math.PI / 2, w: 1.46, h: 2.3, depth: 0.45, side: 1, curtain: "#5f8f8a" }, [-HW - 0.3, -HW, -0.75, 0.75], [[-HW + 1.0, 0], [-HW - 1.3, 0]]);
	{
		const st = tex.sign("Hallway", "home");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), -HW + 0.04, 2.62, 0, { ry: Math.PI / 2, cast: false });
	}
	k.cam = { minX: -HW + 0.2, maxX: HW - 0.2, minZ: -HD + 0.2, maxZ: HD - 0.2, maxY: H - 0.2 };
	k.lightSwitch(-1.95, 1.25, -HD + 0.02, 0);
	const wood = mat("#c8955f", 0.7), woodD = mat("#9c6b3f", 0.7), stone = mat("#8f8a84", 0.9);

	// ---------------------------------------------------------------- the sauna
	const S = SAUNA, cab = group(g, 0, 0, 0);
	const plank = canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#c8955f" : "#bd8a55"; c.fillRect(0, i * 32, w, 32); c.fillStyle = "rgba(60,30,10,0.35)"; c.fillRect(0, i * 32, w, 2); } }, 2, 1);
	const plankM = mat("#ffffff", 0.75, 0, { map: plank });
	add(cab, new THREE.BoxGeometry(S.x1 - S.x0, S.h, 0.1), plankM, (S.x0 + S.x1) / 2, S.h / 2, S.z0);
	add(cab, new THREE.BoxGeometry(0.1, S.h, S.door0 - S.z0), plankM, S.x0, S.h / 2, (S.z0 + S.door0) / 2);
	add(cab, new THREE.BoxGeometry(0.1, S.h, S.z1 - S.door1), plankM, S.x0, S.h / 2, (S.door1 + S.z1) / 2);
	add(cab, new THREE.BoxGeometry(0.1, S.h - 2.05, S.door1 - S.door0), plankM, S.x0, 2.05 + (S.h - 2.05) / 2, (S.door0 + S.door1) / 2);
	add(cab, new THREE.BoxGeometry(S.x1 - S.x0 + 0.1, 0.1, S.z1 - S.z0 + 0.1), woodD, (S.x0 + S.x1) / 2, S.h, (S.z0 + S.z1) / 2);
	// a little window in the door frame and a sign
	add(cab, new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshBasicMaterial({ map: tex.text("SAUNA", { w: 512, h: 160, color: "#fff4d6", glow: "#ff9e4a", font: "900 110px Nunito, sans-serif" }), transparent: true, toneMapped: false, depthWrite: false }), S.x0 - 0.06, 2.17, (S.door0 + S.door1) / 2, { ry: -Math.PI / 2, cast: false, receive: false });
	// inside: the bench along the far wall, a stove of hot stones in the corner
	const benchG = group(cab, 0, 0, 0);
	add(benchG, rbox(0.55, 0.08, S.z1 - S.z0 - 0.3, 0.02), wood, S.x1 - 0.3, 0.45, (S.z0 + S.z1) / 2);
	add(benchG, rbox(0.5, 0.42, S.z1 - S.z0 - 0.3, 0.02), woodD, S.x1 - 0.3, 0.21, (S.z0 + S.z1) / 2);
	add(benchG, rbox(0.12, 0.6, S.z1 - S.z0 - 0.3, 0.02), wood, S.x1 - 0.06, 0.85, (S.z0 + S.z1) / 2);
	const HX = 1.98, HZ = 2.6;
	add(cab, rbox(0.42, 0.55, 0.42, 0.03), mat("#2e2b2b", 0.5, 0.6), HX, 0.28, HZ);
	const stoneGlow = new THREE.MeshStandardMaterial({ color: "#6e625a", roughness: 0.9, emissive: "#ff5a1f", emissiveIntensity: 0.35 });
	for (let i = 0; i < 9; i++) add(cab, new THREE.DodecahedronGeometry(0.07 + R() * 0.03, 0), stoneGlow, HX + (R() - 0.5) * 0.28, 0.6 + R() * 0.06, HZ + (R() - 0.5) * 0.28, { cast: false });
	const bucket = group(cab, HX + 0.45, 0, HZ + 0.1);
	add(bucket, new THREE.CylinderGeometry(0.1, 0.08, 0.16, 14, 1, true), woodD, 0, 0.08, 0, { cast: false });
	add(bucket, new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), wood, 0.05, 0.25, 0, { rz: -0.4, cast: false });
	k.box(S.x0 - 0.05, S.x1, S.z0 - 0.07, S.z0 + 0.07);
	k.box(S.x0 - 0.07, S.x0 + 0.07, S.z0, S.door0);
	k.box(S.x0 - 0.07, S.x0 + 0.07, S.door1, S.z1);
	k.box(S.x1 - 0.6, S.x1, S.z0 + 0.15, S.z1 - 0.15);
	k.box(HX - 0.24, HX + 0.24, HZ - 0.24, HZ + 0.24);
	k.spot({ id: "sauna0", x: S.x1 - 0.32, z: 1.15, h: -Math.PI / 2, y: 0.01 });
	k.spot({ id: "sauna1", x: S.x1 - 0.32, z: 2.1, h: -Math.PI / 2, y: 0.01 });
	k.interact("spa:saunabench", { label: "Sit in the sauna", stand: [2.6, 1.5], sit: ["sauna0", "sauna1"] }, benchG);
	const STEAM = "z:spa:steam";
	const steamy = () => { const s = ctx.get(STEAM); return s ? Math.max(0, 1 - (Date.now() - s.at) / 25000) : 0; };
	k.interact("spa:stones", {
		label: "Pour water on the hot stones", stand: [2.55, 2.2], face: Math.PI / 2 + 0.6, reach: 2.4,
		use: () => { ctx.setShared(STEAM, { at: Date.now(), by: ctx.profile().name }); ctx.doUpper("give", 1200); ctx.sfx("steam", 0.7); ctx.notice("Sssss... the sauna fills with steam."); }
	}, bucket);
	const puffs = [];
	const puffM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.0, depthWrite: false });
	for (let i = 0; i < 26; i++) { const p = add(cab, new THREE.SphereGeometry(0.14 + R() * 0.12, 8, 6), puffM.clone(), 0, -5, 0, { cast: false, receive: false }); p.userData = { ph: R(), x: S.x0 + 0.3 + R() * (S.x1 - S.x0 - 0.5), z: S.z0 + 0.25 + R() * (S.z1 - S.z0 - 0.4), sp: 0.12 + R() * 0.1 }; puffs.push(p); }

	// ---------------------------------------------------------------- massage tables
	const towelM = mat("#ffffff", 0.95), padM = mat("#e9dccb", 0.8);
	const tableObjs = TABLES.map((T, i) => {
		const t = group(g, T.x, 0, T.z);
		add(t, rbox(1.9, 0.12, 0.72, 0.05), padM, 0, 0.68, 0);
		add(t, rbox(1.86, 0.03, 0.7, 0.02), towelM, 0.05, 0.75, 0, { cast: false });
		add(t, new THREE.TorusGeometry(0.1, 0.04, 8, 18), padM, -0.92, 0.7, 0, { ry: Math.PI / 2, cast: false });   // the face cradle
		for (const sx of [-0.8, 0.8]) for (const sz of [-0.28, 0.28]) add(t, new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), woodD, sx, 0.31, sz);
		// a rolled towel and a little dish of oils on a stool beside it
		add(t, new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12), mat(i ? "#bde0fe" : "#ffc8d6", 0.95), 0.6, 0.8, 0, { rx: Math.PI / 2, cast: false });
		const st = group(g, T.x + 0.4, 0, T.z + 0.7);
		add(st, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), woodD, 0, 0.5, 0);
		add(st, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), woodD, 0, 0.25, 0);
		for (let j = 0; j < 3; j++) add(st, new THREE.CylinderGeometry(0.02, 0.025, 0.1, 10), new THREE.MeshPhysicalMaterial({ color: ["#ffd166", "#c77dff", "#7bdff2"][j], transparent: true, opacity: 0.8, roughness: 0.1 }), -0.07 + j * 0.07, 0.57, 0, { cast: false });
		k.box(T.x - 0.98, T.x + 0.98, T.z - 0.4, T.z + 0.4);
		// lying face down along the table: feet at the +x end, face in the cradle at the -x end
		// (a lying spot is where the feet are, and the body runs away from h)
		k.spot({ id: T.id, x: T.x + 0.84, z: T.z, h: Math.PI / 2, y: 0.86, lie: true, prone: true, awake: true });
		k.interact("spa:" + T.id, { label: "Lie down for a massage", stand: [T.x, T.z + 0.85], sit: [T.id] }, t);
		return t;
	});
	// someone's lying on a table and you're beside it: give them a massage (they feel it on their screen)
	function massage(T, id) {
		const q = ctx.peers().get(id);
		if (!q) return;
		const stand = [T.x + k.ox, T.z + k.oz - 0.75];
		ctx.walkTo(stand[0], stand[1], () => {
			const me = ctx.me();
			me.h = 0;
			ctx.doUpper("pet", 6000);
			ctx.send({ t: "fx", kind: "zfx", zone: "spa", what: "massage", to: id });
			ctx.sfx("love", 0.35);
			[700, 2400, 4200].forEach(ms => setTimeout(() => ctx.heartsFx({ position: new THREE.Vector3(T.x + k.ox, 0, T.z + k.oz) }, 3, "#ffb3c6", 1.15), ms));
			ctx.notice(`You're giving <b>${ctx.esc(q.look.name)}</b> a relaxing massage`);
		});
	}

	// ---------------------------------------------------------------- two recliners side by side (hold hands)
	const recliner = (i, x, z) => {
		const lg = group(g, x, 0, z, Math.PI / 2);
		add(lg, rbox(0.7, 0.1, 1.9, 0.04), mat("#f2ede4", 0.6), 0, 0.34, 0.05);
		add(lg, rbox(0.7, 0.1, 0.75, 0.04), mat("#f2ede4", 0.6), 0, 0.64, -0.75, { rx: 0.75 });
		add(lg, rbox(0.62, 0.06, 1.5, 0.03), mat(i ? "#a8dadc" : "#ffcad4", 0.95), 0, 0.42, 0.2);
		for (const sx of [-0.3, 0.3]) for (const sz of [-0.7, 0.85]) add(lg, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), woodD, sx, 0.15, sz);
		k.box(x - 1.05, x + 1.05, z - 0.4, z + 0.4);
		k.spot({ id: "spaRecliner" + i, x: x - 0.42, z, h: Math.PI / 2, y: 0.0, recline: true, hands: true });
		k.interact("spa:recliner" + i, { label: "Relax on the recliner", stand: [x + 1.45, z], sit: ["spaRecliner" + i] }, lg);
	};
	recliner(0, -3.0, -2.2);
	recliner(1, -3.0, -1.2);

	// ---------------------------------------------------------------- the treatment mirror (west wall)
	const VZ = 1.8;
	const van = group(g, -HW + 0.25, 0, VZ, Math.PI / 2);
	add(van, rbox(1.3, 0.08, 0.5, 0.02), mat("#f7f3ec", 0.4), 0, 0.82, 0);
	add(van, rbox(1.2, 0.78, 0.46, 0.02), wood, 0, 0.4, 0);
	add(van, new THREE.CircleGeometry(0.42, 40), new THREE.MeshStandardMaterial({ color: "#dfe9f2", metalness: 0.9, roughness: 0.06 }), 0, 1.6, -0.2, { cast: false });
	const vBulbs = [];
	for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; vBulbs.push(add(van, new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshStandardMaterial({ color: "#fff4d6", emissive: "#ffe0b0", emissiveIntensity: 1.6 }), Math.cos(a) * 0.5, 1.6 + Math.sin(a) * 0.5, -0.18, { cast: false })); }
	for (let i = 0; i < 5; i++) add(van, new THREE.CylinderGeometry(0.03, 0.035, 0.1 + R() * 0.08, 12), mat(["#ffc8dd", "#bde0fe", "#cdeac0", "#fff1e6", "#e0aaff"][i], 0.3), -0.45 + i * 0.2, 0.92, 0.05, { cast: false });
	k.box(-HW, -HW + 0.5, VZ - 0.68, VZ + 0.68);
	const TREAT = ["A cucumber face mask... so refreshing!", "A honey and oat mask - your skin is glowing!", "Rose water mist and a little moisturiser. Glowing!", "A clay mask and a cosy wait... silky smooth!", "Eye patches on. You look ten years younger!"];
	k.interact("spa:vanity", {
		label: "Have a spa treatment", stand: [-HW + 1.1, VZ], face: -Math.PI / 2,
		use: () => {
			ctx.doUpper("wash", 3600);
			ctx.sfx("pour", 0.3);
			setTimeout(() => { ctx.notice(TREAT[Math.floor(Math.random() * TREAT.length)]); ctx.heartsFx(ctx.myAvatar().root, 5, "#bde0fe"); ctx.sfx("chime", 0.4); }, 3000);
		}
	}, van);

	// ---------------------------------------------------------------- tea and fruit
	const cart = group(g, -1.6, 0, HD - 0.6);
	add(cart, rbox(0.9, 0.05, 0.5, 0.02), wood, 0, 0.78, 0);
	add(cart, rbox(0.9, 0.04, 0.5, 0.02), wood, 0, 0.32, 0);
	for (const sx of [-0.4, 0.4]) for (const sz of [-0.2, 0.2]) add(cart, new THREE.CylinderGeometry(0.02, 0.02, 0.78, 6), woodD, sx, 0.39, sz);
	add(cart, new THREE.SphereGeometry(0.11, 16, 12), mat("#f2ede4", 0.3), -0.2, 0.9, 0, { cast: false }).scale.set(1, 0.8, 1);
	add(cart, new THREE.CylinderGeometry(0.012, 0.02, 0.12, 6), mat("#f2ede4", 0.3), -0.08, 0.93, 0, { rz: -0.9, cast: false });
	for (let i = 0; i < 2; i++) add(cart, new THREE.CylinderGeometry(0.04, 0.03, 0.06, 12), mat("#f2ede4", 0.3), 0.05 + i * 0.12, 0.83, 0.12, { cast: false });
	for (let i = 0; i < 6; i++) add(cart, new THREE.SphereGeometry(0.04, 10, 8), mat(["#e63946", "#8ac926", "#ffd166"][i % 3], 0.45), 0.25 + Math.cos(i) * 0.08, 0.83, -0.08 + Math.sin(i) * 0.08, { cast: false });
	k.box(-2.1, -1.1, HD - 0.88, HD - 0.32);
	k.interact("spa:tea", { label: "Have some tea and fruit", stand: [-1.6, HD - 1.3], face: 0, use: () => ctx.foodMenu("Tea and fruit", ["juice", "strawberry", "apple", "cookie"]) }, cart);

	// ---------------------------------------------------------------- the zen water wall (south wall), bamboo, candles
	const flowTex = canvasTex(128, 512, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#5e8f9a"); gr.addColorStop(0.5, "#a7d3dc"); gr.addColorStop(1, "#5e8f9a");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		const r = rng(4);
		for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`; c.lineWidth = 1 + r() * 2; const x = r() * w; c.beginPath(); c.moveTo(x, r() * h); c.lineTo(x + (r() - 0.5) * 4, r() * h); c.stroke(); }
	}, 1, 2);
	const FX = 0.0;
	add(g, rbox(1.3, 2.2, 0.12, 0.03), stone, FX, 1.1, HD - 0.08);
	const flowM = new THREE.MeshStandardMaterial({ map: flowTex, transparent: true, opacity: 0.85, roughness: 0.05, emissive: "#3a7f8c", emissiveIntensity: 0.25 });
	add(g, new THREE.PlaneGeometry(1.0, 1.9), flowM, FX, 1.2, HD - 0.15, { ry: Math.PI, cast: false });
	add(g, rbox(1.5, 0.3, 0.45, 0.04), stone, FX, 0.15, HD - 0.3);
	add(g, new THREE.PlaneGeometry(1.35, 0.32), new THREE.MeshPhysicalMaterial({ color: "#7bc6d4", transparent: true, opacity: 0.6, roughness: 0.05, depthWrite: false }), FX, 0.301, HD - 0.3, { rx: -Math.PI / 2, cast: false, receive: false });
	k.box(FX - 0.78, FX + 0.78, HD - 0.55, HD);
	const bamboo = (x, z) => {
		const b = group(g, x, 0, z);
		add(b, new THREE.CylinderGeometry(0.22, 0.18, 0.4, 14), mat("#d8cfc4", 0.7), 0, 0.2, 0);
		for (let i = 0; i < 5; i++) {
			const hh = 1.4 + R() * 0.8, a = i / 5 * Math.PI * 2;
			add(b, new THREE.CylinderGeometry(0.02, 0.025, hh, 6), mat("#7fa650", 0.6), Math.cos(a) * 0.08, 0.4 + hh / 2, Math.sin(a) * 0.08, { cast: false });
			for (let j = 0; j < 4; j++) add(b, new THREE.SphereGeometry(0.07, 6, 5), mat("#5aa864", 0.7), Math.cos(a) * 0.08 + (R() - 0.5) * 0.25, 0.9 + hh * (0.4 + j * 0.15), Math.sin(a) * 0.08 + (R() - 0.5) * 0.25, { cast: false }).scale.set(1.6, 0.3, 0.6);
		}
		k.box(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
	};
	bamboo(-1.0, HD - 0.35);
	bamboo(1.05, HD - 0.35);
	bamboo(HW - 0.35, -HD + 0.35);
	const candleFl = [];
	for (const [x, z] of [[-0.6, HD - 0.3], [0.6, HD - 0.3], [-HW + 0.3, VZ - 0.5], [-HW + 0.3, VZ + 0.5]]) {
		add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12), mat("#fff8ec", 0.5), x, 0.36, z, { cast: false });
		candleFl.push(add(g, new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffd27a", toneMapped: false }), x, 0.44, z, { cast: false }));
	}
	// pebbles and a soft rug in the middle
	const rug = add(g, new THREE.PlaneGeometry(3.0, 1.6), mat("#ffffff", 1, 0, { map: tex.carpet("#d8c7b5", "#a3b18a") }), -0.6, 0.006, 1.2, { rx: -Math.PI / 2, cast: false });
	rug.userData.floor = true;

	// ---------------------------------------------------------------- light
	const L = {
		sauna: k.light((S.x0 + S.x1) / 2, 1.9, (S.z0 + S.z1) / 2, "#ff9e4a", 2.6, 3.5),
		t0: k.light(TABLES[0].x, 2.4, TABLES[0].z, "#ffe2c0", 2.4, 4.5),
		t1: k.light(TABLES[1].x, 2.4, TABLES[1].z, "#ffe2c0", 2.4, 4.5),
		vanity: k.light(-HW + 0.9, 1.7, VZ, "#fff0dc", 1.8, 3.5),
		water: k.light(FX, 1.2, HD - 0.8, "#8fd3ff", 1.2, 3.5),
		rec: k.light(-3.0, 2.4, -1.7, "#ffd9b0", 1.6, 4)
	};
	void L;   // (the house moves its light pool onto these while you're in here)
	k.key.pos.copy(k.V(0, H - 0.15, 0)); k.key.target.copy(k.V(0, 0, 0.2));
	k.key.angle = 1.2; k.key.intensity = 14; k.key.distance = 12; k.key.color.set("#ffe6cc");
	k.fill.pos.copy(k.V(0, 2.3, 0)); k.fill.intensity = 3.5; k.fill.distance = 14;
	k.hemi = 0.4; k.env = 0.25; k.exposure = 1.0;

	// ---------------------------------------------------------------- every frame
	function update(dt, t) {
		const st = steamy();
		stoneGlow.emissiveIntensity = 0.35 + st * 0.6 + Math.sin(t * 2) * 0.05;
		puffs.forEach(p => {
			const u = p.userData, f = (t * u.sp + u.ph) % 1;
			p.position.set(u.x + Math.sin(t * 0.7 + u.ph * 6) * 0.15, 0.5 + f * 1.7, u.z + Math.cos(t * 0.6 + u.ph * 5) * 0.12);
			p.scale.setScalar(0.6 + f * 1.2);
			p.material.opacity = (0.05 + st * 0.3) * Math.sin(f * Math.PI);
		});
		flowTex.offset.y = -t * 0.35;
		candleFl.forEach((c, i) => { c.scale.y = 1 + Math.sin(t * 14 + i * 2) * 0.25; });
		vBulbs.forEach((b, i) => { b.material.emissiveIntensity = 1.4 + Math.sin(t * 1.3 + i * 0.5) * 0.2; });
	}

	return {
		update,
		onFx(d, p) {
			if (d.what === "massage" && d.to === ctx.MY_ID) {
				ctx.notice(`<b>${ctx.esc(p ? p.look.name : "Someone")}</b> is giving you a lovely massage... mmm`);
				ctx.sfx("love", 0.45);
				[400, 2200, 4000].forEach(ms => setTimeout(() => ctx.heartsFx(ctx.myAvatar().root, 4, "#ffb3c6", 0.9), ms));
			}
		},
		applyKey(key, remote) {
			if (key === STEAM && remote) { const s = ctx.get(STEAM); const me = ctx.me(); if (s && Math.hypot(me.x - (k.ox + 2.8), me.z - (k.oz + 1.7)) < 2.4) ctx.sfx("steam", 0.5); }
		},
		promptOpts(opts) {
			const me = ctx.me();
			if (me.sit) return;
			const free = key => !opts.some(o => o.k === key);
			// next to a massage table with someone lying on it
			for (const T of TABLES) {
				if (Math.hypot(me.x - (T.x + k.ox), me.z - (T.z + k.oz)) > 2.0) continue;
				const who = [...ctx.peers().entries()].find(([, q]) => q.sit === T.id);
				if (who && free("R")) { opts.push({ k: "R", label: "Give " + who[1].look.name + " a massage", fn: () => massage(T, who[0]) }); break; }
			}
		}
	};
}
