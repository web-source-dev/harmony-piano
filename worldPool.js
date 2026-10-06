/**
 * Harmony World — the pool deck: outdoors behind the house, under the night sky.
 *
 * A big rooftop deck that wraps round the back of the house: in from the
 * terrace (the gap in its east railing), along the back of the lounge (its
 * glass doors open onto it) and round to the bedroom (its whole north wall is
 * sliding glass). Open on every outer side behind glass railings.
 *
 * Local coordinates (origin at world 19.55, -12.1):
 *   the long part   x -14.05..3.65,  z -5.9..5.85   (world x 5.5..23.2, z -18..-6.25)
 *   by the bedroom  x  3.65..14.05,  z -5.9..3.4    (world x 23.2..33.6, z -18..-8.7)
 * The pool is 8 m by 4.9 m, 1.3 m deep, steps at the terrace end, a diving
 * board at the other. A hot tub for two by the bedroom, and beside it a canopy
 * swing, a flower arch (kiss under it) and a little smoothie bar. Loungers, an umbrella,
 * palms, floating rings, ripples and splashes, string lights.
 *
 * Swim: walk in (or dive) and you float with your head above the water, arms
 * doing breaststroke; moving, you stretch out flat and swim. Together in the
 * water you can kiss, or take each other's hand and swim side by side.
 * The loungers come in pairs: lie back, and hold hands with whoever's next to you.
 */
const P = { x0: -6.0, x1: 2.0, z0: -2.9, z1: 2.0, depth: 1.3, surf: -0.12 };

function floorY(x, z) {
	if (x <= P.x0 || x >= P.x1 || z <= P.z0 || z >= P.z1) return 0;
	// three steps down at the terrace end
	if (x < P.x0 + 0.4) return -0.33;
	if (x < P.x0 + 0.8) return -0.66;
	if (x < P.x0 + 1.2) return -1.0;
	return -P.depth;
}
const inPool = (x, z) => x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1;

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(88);
	const XA0 = -14.05, XA1 = 3.65, XB1 = 14.05, ZN = -5.9, ZA1 = 5.85, ZB1 = 3.4;
	k.floor(floorY);
	k.walk(XA0, 4.3, ZN, ZA1);
	k.walk(3.0, XB1, ZN, 4.0);
	k.box(-3.0, -2.5, 4.85, 5.35);   // the zipline's pole from the treehouse (drawn by worldTree.js, at world 16.8, -7.0)
	k.walk(1.5, 3.0, 4.0, 6.7);   // to the lounge's glass doors
	k.cam = { minX: XA0 - 3, maxX: XB1, minZ: ZN - 1.5, maxZ: ZA1 + 0.2, maxY: 9, minY: 0.2 };

	// ---------------------------------------------------------------- deck
	const deckTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#b9ad9c"; c.fillRect(0, 0, w, h);
		const r = rng(9);
		for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
			const t = 214 + r() * 18;
			c.fillStyle = `rgb(${t},${t - 8},${t - 22})`;
			c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
			for (let n = 0; n < 300; n++) { c.fillStyle = `rgba(150,130,100,${r() * 0.12})`; c.fillRect(i * 128 + 3 + r() * 120, j * 128 + 3 + r() * 120, 2, 2); }
		}
	});
	const deckPiece = (x0, x1, z0, z1) => {
		const t = deckTex.clone(); t.needsUpdate = true;
		t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((x1 - x0) / 2, (z1 - z0) / 2);
		const m = add(g, new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat("#ffffff", 0.75, 0, { map: t }), (x0 + x1) / 2, 0, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false });
		m.userData.floor = true;
	};
	deckPiece(XA0, XA1, ZN, P.z0);
	deckPiece(XA0, XA1, P.z1, ZA1);
	deckPiece(XA0, P.x0, P.z0, P.z1);
	deckPiece(P.x1, XA1, P.z0, P.z1);
	deckPiece(XA1, XB1, ZN, ZB1);
	// the deck's thickness at its outer edges (it's up on the roof, like the terrace)
	const edgeM = mat("#5b4636", 0.8);
	add(g, new THREE.BoxGeometry(XB1 - XA0, 0.3, 0.1), edgeM, (XA0 + XB1) / 2, -0.15, ZN - 0.02);
	add(g, new THREE.BoxGeometry(0.1, 0.3, ZB1 - ZN), edgeM, XB1 + 0.02, -0.15, (ZN + ZB1) / 2);
	const coping = mat("#f7f3ec", 0.5), cw = 0.26;
	add(g, new THREE.BoxGeometry(P.x1 - P.x0 + cw * 2, 0.06, cw), coping, (P.x0 + P.x1) / 2, 0.03, P.z0 - cw / 2);
	add(g, new THREE.BoxGeometry(P.x1 - P.x0 + cw * 2, 0.06, cw), coping, (P.x0 + P.x1) / 2, 0.03, P.z1 + cw / 2);
	add(g, new THREE.BoxGeometry(cw, 0.06, P.z1 - P.z0), coping, P.x0 - cw / 2, 0.03, (P.z0 + P.z1) / 2);
	add(g, new THREE.BoxGeometry(cw, 0.06, P.z1 - P.z0), coping, P.x1 + cw / 2, 0.03, (P.z0 + P.z1) / 2);

	// ---------------------------------------------------------------- glass railings on every open side
	const railM = mat("#6b4f3a", 0.5), postM = mat("#3e3a3a", 0.4, 0.6);
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe7ff", transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
	const railRun = (x0, z0, x1, z1) => {
		const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
		const rg = group(g, (x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
		add(rg, new THREE.BoxGeometry(0.08, 0.06, len + 0.08), railM, 0, 1.05, 0);
		const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), glassM);
		gl.rotation.y = Math.PI / 2; gl.position.y = 0.55;
		rg.add(gl);
		const n = Math.max(1, Math.round(len / 1.25));
		for (let i = 0; i <= n; i++) add(rg, new THREE.BoxGeometry(0.06, 1.05, 0.06), postM, 0, 0.525, -len / 2 + (len * i) / n);
	};
	// (with a gap in the south side: the way through to the garden, worldGarden.js)
	const GG0 = -8.95, GG1 = -7.55;
	railRun(XA0 + 0.05, ZN + 0.05, GG0, ZN + 0.05);
	railRun(GG1, ZN + 0.05, XB1 - 0.05, ZN + 0.05);
	railRun(XB1 - 0.05, ZN + 0.05, XB1 - 0.05, ZB1 - 0.05);
	railRun(XA0 + 0.05, ZN + 0.05, XA0 + 0.05, 0.1);
	k.box(XA0, GG0, ZN, ZN + 0.12);
	k.box(GG1, XB1, ZN, ZN + 0.12);
	k.walk(GG0, GG1, ZN - 0.6, ZN + 1.2);
	// a little sign by the gap
	{
		const sg = group(g, GG0 - 0.35, 0, ZN + 0.3);
		add(sg, new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), mat("#5b4636", 0.7), 0, 0.55, 0);
		add(sg, rbox(0.62, 0.22, 0.04, 0.02), mat("#8a5a3c", 0.6), 0, 1.15, 0);
		add(sg, new THREE.PlaneGeometry(0.56, 0.16), new THREE.MeshBasicMaterial({ map: k.tex.text("Garden", { w: 512, h: 128, color: "#f6ecd2", font: "800 84px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false }), 0, 1.15, 0.025, { cast: false, receive: false });
		k.box(GG0 - 0.42, GG0 - 0.28, ZN + 0.23, ZN + 0.37);
	}
	k.box(XB1 - 0.12, XB1, ZN, ZB1);
	k.box(XA0, XA0 + 0.12, ZN, 0.1);

	// ---------------------------------------------------------------- the back of the lounge, in white render like the rest of the house (with its windows and glass doors)
	const brick = (w, h) => mat("#ffffff", 0.88, 0, { map: k.renderTex(w / 2.4, h / 2.4) });
	const FZ = 5.93, FH = 7.3;
	// holes in that wall, in pool coordinates: [x0, x1, y0, y1]
	const holes = [[-8.15, -4.55, 4.4, 6.4], [-2.25, 0.75, 4.2, 6.5], [1.5, 3.0, 0, 2.35]];
	let x = -12.3;
	const strip = (x0, x1, y0, y1) => { if (x1 - x0 > 0.01 && y1 - y0 > 0.01) add(g, new THREE.PlaneGeometry(x1 - x0, y1 - y0), brick(x1 - x0, y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2, FZ, { ry: Math.PI, cast: false }); };
	for (const [h0, h1, y0, y1] of holes) { strip(x, h0, 0, FH); strip(h0, h1, 0, y0); strip(h0, h1, y1, FH); x = h1; }
	strip(x, XA1 - 0.05, 0, FH);
	add(g, new THREE.BoxGeometry(XA1 + 12.3, 0.35, 0.2), mat("#d8cfc4", 0.8), (XA1 - 12.3) / 2, FH + 0.05, FZ);
	// warm light spilling out of the lounge's windows
	for (const [h0, h1, y0, y1] of holes.slice(0, 2)) add(g, new THREE.PlaneGeometry(h1 - h0, y1 - y0), new THREE.MeshBasicMaterial({ color: "#ffcf8a", transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }), (h0 + h1) / 2, (y0 + y1) / 2, FZ - 0.02, { ry: Math.PI, cast: false, receive: false });

	// ---------------------------------------------------------------- the pool
	const tileTex = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#4fa4c8"; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 3 ? "#7cc6e6" : "#68b8dc"; c.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29); }
		c.fillStyle = "#2a6f99"; c.fillRect(0, h / 2 - 4, w, 8);
	}, (P.x1 - P.x0) / 1.2, (P.z1 - P.z0) / 1.2);
	const causticTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 3;
		const r = rng(12);
		for (let i = 0; i < 80; i++) {
			c.beginPath();
			let px = r() * w, py = r() * h;
			c.moveTo(px, py);
			for (let s = 0; s < 5; s++) { px += (r() - 0.5) * 120; py += (r() - 0.5) * 120; c.quadraticCurveTo(px + (r() - 0.5) * 60, py + (r() - 0.5) * 60, px, py); }
			c.stroke();
		}
	}, 3, 2);
	const basinM = mat("#ffffff", 0.35, 0, { map: tileTex, emissive: "#9fe8ff", emissiveMap: causticTex, emissiveIntensity: 0.55 });
	const D = P.depth, PW = P.x1 - P.x0, PL = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
	add(g, new THREE.PlaneGeometry(PW, PL), basinM, cx, -D, cz, { rx: -Math.PI / 2, cast: false });
	const wallTex = tileTex.clone(); wallTex.needsUpdate = true; wallTex.repeat.set(PW / 1.2, D / 1.2);
	const sideTex = tileTex.clone(); sideTex.needsUpdate = true; sideTex.repeat.set(PL / 1.2, D / 1.2);
	const wM = mat("#ffffff", 0.35, 0, { map: wallTex, emissive: "#3fb7e0", emissiveIntensity: 0.25 }), sM = mat("#ffffff", 0.35, 0, { map: sideTex, emissive: "#3fb7e0", emissiveIntensity: 0.25 });
	add(g, new THREE.PlaneGeometry(PW, D), wM, cx, -D / 2, P.z0, { cast: false });
	add(g, new THREE.PlaneGeometry(PW, D), wM, cx, -D / 2, P.z1, { ry: Math.PI, cast: false });
	add(g, new THREE.PlaneGeometry(PL, D), sM, P.x0, -D / 2, cz, { ry: Math.PI / 2, cast: false });
	add(g, new THREE.PlaneGeometry(PL, D), sM, P.x1, -D / 2, cz, { ry: -Math.PI / 2, cast: false });
	for (const [dx, top] of [[0.4, -0.33], [0.8, -0.66], [1.2, -1.0]]) add(g, new THREE.BoxGeometry(dx, D + top, PL), mat("#f2f6f7", 0.35), P.x0 + dx / 2, (-D + top) / 2, cz, { cast: false });
	const chrome = mat("#e3e7ea", 0.12, 1);
	const ladder = group(g, 0, 0, 0);
	for (const z of [P.z0 + 0.4, P.z1 - 0.4]) {
		const pts = [new THREE.Vector3(P.x0 - 0.4, 0.0, z), new THREE.Vector3(P.x0 - 0.4, 0.9, z), new THREE.Vector3(P.x0 - 0.1, 1.0, z), new THREE.Vector3(P.x0 + 0.3, 0.6, z), new THREE.Vector3(P.x0 + 0.7, -0.2, z)];
		add(ladder, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.025, 8), chrome, 0, 0, 0, { cast: false });
	}
	// underwater lights along the sides
	const uwM = new THREE.MeshBasicMaterial({ color: "#c8f6ff", toneMapped: false });
	for (const xx of [-4.0, -1.5, 1.0]) for (const zz of [P.z0 + 0.01, P.z1 - 0.01]) add(g, new THREE.CircleGeometry(0.13, 20), uwM, xx, -0.7, zz, { ry: zz < 0 ? 0 : Math.PI, cast: false, receive: false });
	// the water: a moving sheet, a soft glow just under it, and a lighter band at the edges
	const waterGeo = new THREE.PlaneGeometry(PW, PL, 64, 40);
	waterGeo.rotateX(-Math.PI / 2);
	const waterM = new THREE.MeshPhysicalMaterial({ color: "#2fa9d6", transparent: true, opacity: 0.62, roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, depthWrite: false, side: THREE.DoubleSide, emissive: "#0d6e93", emissiveIntensity: 0.5 });
	const water = add(g, waterGeo, waterM, cx, P.surf, cz, { cast: false, receive: false });
	water.renderOrder = 2;
	const glowM = new THREE.MeshBasicMaterial({ color: "#58d0ff", transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false });
	add(g, new THREE.PlaneGeometry(PW - 0.1, PL - 0.1), glowM, cx, P.surf - 0.18, cz, { rx: -Math.PI / 2, cast: false, receive: false }).renderOrder = 1;
	const wpos = waterGeo.attributes.position;
	const wbase = Float32Array.from(wpos.array);
	k.interact("pool:steps", { label: "Get in the pool", stand: [P.x0 - 0.9, cz], face: Math.PI / 2, use: () => ctx.walkTo(P.x0 + 2.6 + k.ox, cz + (Math.random() - 0.5) * 2 + k.oz, () => { ctx.me().h = Math.PI / 2; }) }, ladder);

	// ---------------------------------------------------------------- diving board (the far end)
	const BZ = -0.45;
	const board = group(g, P.x1 + 0.75, 0, BZ);
	add(board, rbox(0.6, 0.5, 0.7, 0.04), mat("#d8cfc4", 0.6), 0, 0.25, 0);
	add(board, rbox(2.1, 0.06, 0.5, 0.02), mat("#2a9d8f", 0.4), -0.85, 0.56, 0);
	add(board, rbox(2.1, 0.01, 0.46, 0.01), mat("#bfe7df", 0.9), -0.85, 0.595, 0, { cast: false });
	k.box(P.x1 + 0.45, P.x1 + 1.05, BZ - 0.35, BZ + 0.35);
	let dive = null;
	k.interact("pool:dive", { label: "Dive in!", stand: [P.x1 + 1.5, BZ], face: -Math.PI / 2, use: () => { const me = ctx.me(); if (me.sit) ctx.standUp(true); dive = { t0: performance.now() / 1000 }; ctx.doUpper("jump", 1700); ctx.sfx("whoosh", 0.4); } }, board);

	// ---------------------------------------------------------------- hot tub for two, by the bedroom
	const HT = { x: 7.95, z: -0.4 };
	const tub = group(g, HT.x, 0, HT.z);
	add(tub, new THREE.CylinderGeometry(1.15, 1.2, 0.55, 40), mat("#8b6b4a", 0.7), 0, 0.275, 0);
	for (let i = 0; i < 24; i++) add(tub, new THREE.BoxGeometry(0.06, 0.56, 0.3), mat("#6e4a33", 0.7), Math.cos(i / 24 * Math.PI * 2) * 1.19, 0.28, Math.sin(i / 24 * Math.PI * 2) * 1.19, { ry: -i / 24 * Math.PI * 2, cast: false });
	add(tub, new THREE.TorusGeometry(1.1, 0.07, 10, 40), mat("#f2ede4", 0.5), 0, 0.56, 0, { rx: Math.PI / 2 });
	const tubWaterM = new THREE.MeshPhysicalMaterial({ color: "#5fd0f0", transparent: true, opacity: 0.7, roughness: 0.05, emissive: "#1aa0d0", emissiveIntensity: 0.6, depthWrite: false });
	const tubWater = add(tub, new THREE.CircleGeometry(1.05, 40), tubWaterM, 0, 0.47, 0, { rx: -Math.PI / 2, cast: false, receive: false });
	const tubBubbles = [];
	for (let i = 0; i < 30; i++) { const b = add(tub, new THREE.SphereGeometry(0.02 + R() * 0.025, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, toneMapped: false }), 0, 0.48, 0, { cast: false, receive: false }); b.userData = { a: R() * 6.28, r: R() * 0.95, ph: R() }; tubBubbles.push(b); }
	k.box(HT.x - 1.25, HT.x + 1.25, HT.z - 1.25, HT.z + 1.25);
	k.spot({ id: "hottub0", x: HT.x - 0.55, z: HT.z, h: Math.PI / 2, y: -0.05 });
	k.spot({ id: "hottub1", x: HT.x + 0.55, z: HT.z, h: -Math.PI / 2, y: -0.05 });
	k.interact("pool:hottub", { label: "Get in the hot tub", stand: [HT.x, HT.z + 1.75], sit: ["hottub0", "hottub1"] }, tub);

	// ---------------------------------------------------------------- beside the hot tub: a canopy swing, a flower arch, a smoothie bar
	// a swing for two under a striped canopy, looking back over the hot tub to the pool (it rocks while someone's on it)
	const SW = { x: 10.75, z: -0.6 };
	const swingG = group(g, SW.x, 0, SW.z, -Math.PI / 2);   // its front (local +z) faces -x
	const swFrame = mat("#f4efe8", 0.55);
	for (const sx of [-1.15, 1.15]) {
		add(swingG, new THREE.BoxGeometry(0.08, 2.2, 0.08), swFrame, sx, 1.05, -0.45, { rx: 0.2 });
		add(swingG, new THREE.BoxGeometry(0.08, 2.2, 0.08), swFrame, sx, 1.05, 0.45, { rx: -0.2 });
	}
	add(swingG, new THREE.BoxGeometry(2.45, 0.1, 0.1), swFrame, 0, 2.08, 0);
	// the canopy: a striped awning over the top bar
	const awning = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#fff6ea" : "#ff9eb5"; c.fillRect(i * w / 8, 0, w / 8 + 1, h); } c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(0, h - 6, w, 6); });
	const awnM = mat("#ffffff", 0.9, 0, { map: awning, side: THREE.DoubleSide });
	// (two sloping halves meeting in a ridge over the bar)
	for (const sz of [-1, 1]) add(swingG, new THREE.PlaneGeometry(2.6, 0.6), awnM, 0, 2.25, sz * 0.25, { rx: -Math.PI / 2 + sz * 0.56, cast: false });
	const fringe = canvasTex(256, 32, (c, w, h) => { c.clearRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { c.fillStyle = (x / 16) % 2 ? "#ff9eb5" : "#fff6ea"; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 16, 0); c.lineTo(x + 8, h); c.closePath(); c.fill(); } });
	for (const sz of [-1, 1]) add(swingG, new THREE.PlaneGeometry(2.6, 0.12), mat("#ffffff", 0.9, 0, { map: fringe, transparent: true, side: THREE.DoubleSide, alphaTest: 0.4 }), 0, 2.03, sz * 0.52, { cast: false });
	const swHang = group(swingG, 0, 2.05, 0);
	const SW_L = 1.55;
	for (const sx of [-0.62, 0.62]) for (const sz of [-0.18, 0.18]) add(swHang, new THREE.CylinderGeometry(0.008, 0.008, SW_L, 6), mat("#d8c39a", 0.6), sx, -SW_L / 2, sz, { cast: false });
	const swSeat = group(swHang, 0, -SW_L, 0);
	const rattan = mat("#c89a6a", 0.7);
	add(swSeat, rbox(1.35, 0.06, 0.5, 0.02), rattan, 0, -0.02, 0);
	add(swSeat, rbox(1.35, 0.44, 0.05, 0.02), rattan, 0, 0.22, -0.23, { rx: -0.12 });
	for (const sx of [-0.7, 0.7]) add(swSeat, rbox(0.05, 0.22, 0.48, 0.02), rattan, sx, 0.1, 0);
	add(swSeat, rbox(1.26, 0.1, 0.44, 0.04), mat("#fff1e6", 0.95), 0, 0.05, 0.01);
	add(swSeat, rbox(0.4, 0.34, 0.1, 0.04), mat("#ffc8d6", 0.95), -0.42, 0.26, -0.15, { rx: -0.2 });
	add(swSeat, rbox(0.38, 0.32, 0.1, 0.04), mat("#bde0fe", 0.95), 0.44, 0.26, -0.15, { rx: -0.2, rz: 0.08 });
	// fairy lights along the top bar
	const swBulbs = [];
	for (let i = 0; i <= 12; i++) {
		const u = i / 12, x = -1.2 + u * 2.4;
		swBulbs.push(add(swingG, new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshStandardMaterial({ color: "#fff1d0", emissive: i % 2 ? "#ffd59a" : "#ffb3c6", emissiveIntensity: 2 }), x, 2.0 - Math.sin(u * Math.PI) * 0.06, 0.07, { cast: false }));
	}
	k.box(SW.x - 0.45, SW.x + 0.7, SW.z - 1.25, SW.z + 1.25);
	const poolSwing = { angle: 0, occupied: false, L: SW_L };
	const SWING_IDS = ["poolSwing0", "poolSwing1"];
	// (the seat is half a metre off the deck; its local x runs along world +z)
	k.spot({ id: "poolSwing0", x: SW.x - 0.03, z: SW.z + 0.32, h: -Math.PI / 2, y: 0.02, swing: true, swingRef: poolSwing });
	k.spot({ id: "poolSwing1", x: SW.x - 0.03, z: SW.z - 0.32, h: -Math.PI / 2, y: 0.02, swing: true, swingRef: poolSwing });
	k.interact("pool:swing", { label: "Sit on the swing", stand: [SW.x - 1.05, SW.z], sit: SWING_IDS }, swingG);

	// a flower arch by the railing, roses and fairy lights all over it, petals drifting down (kiss under it)
	const AR = { x: 13.3, z: -0.6, r: 0.9, post: 1.45 };
	const arch = group(g, AR.x, 0, AR.z);
	const archM = mat("#f7f3ec", 0.5);
	for (const dx of [-0.22, 0.22]) {
		for (const sz of [-1, 1]) add(arch, new THREE.CylinderGeometry(0.045, 0.05, AR.post, 10), archM, dx, AR.post / 2, sz * AR.r);
		add(arch, new THREE.TorusGeometry(AR.r, 0.045, 8, 40, Math.PI), archM, dx, AR.post, 0, { ry: Math.PI / 2, cast: false });
	}
	for (let i = 0; i <= 10; i++) {
		const a = i / 10 * Math.PI;
		add(arch, new THREE.BoxGeometry(0.5, 0.03, 0.05), archM, 0, AR.post + Math.sin(a) * AR.r, Math.cos(a) * AR.r, { rx: a, cast: false });
	}
	for (const sz of [-1, 1]) for (let y = 0.3; y < AR.post; y += 0.35) add(arch, new THREE.BoxGeometry(0.5, 0.03, 0.04), archM, 0, y, sz * AR.r, { cast: false });
	// the flowers and leaves: one instanced mesh each, a few hundred of them wound round the arch
	const along = [];   // points on the arch: up one post, over, down the other
	for (let i = 0; i <= 60; i++) {
		const u = i / 60;
		let y, z;
		if (u < 0.25) { y = u / 0.25 * AR.post; z = -AR.r; }
		else if (u > 0.75) { y = (1 - u) / 0.25 * AR.post; z = AR.r; }
		else { const a = Math.PI - (u - 0.25) / 0.5 * Math.PI; y = AR.post + Math.sin(a) * AR.r; z = Math.cos(a) * AR.r; }
		along.push([y, z]);
	}
	const dummy = new THREE.Object3D(), tint = new THREE.Color();
	const blooms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 1), mat("#ffffff", 0.6), along.length * 3);
	const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), mat("#ffffff", 0.7), along.length * 3);
	const bloomCols = ["#ff5d8f", "#ff9ebb", "#ffffff", "#ffc2d1", "#e0aaff", "#ff7096"];
	let nb = 0, nl = 0;
	along.forEach(([y, z], i) => {
		for (let j = 0; j < 3; j++) {
			const dx = (R() - 0.5) * 0.55, dy = (R() - 0.5) * 0.12, dz = (R() - 0.5) * 0.12;
			if ((i + j) % 2 === 0 || R() < 0.35) {
				dummy.position.set(dx, y + dy, z + dz); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.setScalar(0.7 + R() * 0.7); dummy.updateMatrix();
				blooms.setMatrixAt(nb, dummy.matrix); blooms.setColorAt(nb, tint.set(bloomCols[Math.floor(R() * bloomCols.length)])); nb++;
			}
			dummy.position.set(dx * 1.1, y + dy * 1.4, z + dz * 1.4); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.set(1, 0.35, 0.7); dummy.updateMatrix();
			leaves.setMatrixAt(nl, dummy.matrix); leaves.setColorAt(nl, tint.set(R() < 0.5 ? "#3f8a4a" : "#5aa864")); nl++;
		}
	});
	blooms.count = nb; leaves.count = nl;
	for (const im of [blooms, leaves]) { im.castShadow = false; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; arch.add(im); }
	// twinkling fairy lights (two sets, out of step with each other)
	const twinkle = [0, 1].map(i => new THREE.MeshStandardMaterial({ color: "#fff4d6", emissive: i ? "#ffd59a" : "#ffe9f0", emissiveIntensity: 2 }));
	for (let i = 0; i < along.length; i += 2) {
		const [y, z] = along[i];
		for (const dx of [-0.27, 0.27]) add(arch, new THREE.SphereGeometry(0.022, 8, 6), twinkle[(i / 2 + (dx > 0 ? 1 : 0)) % 2], dx, y + 0.04, z, { cast: false });
	}
	// a heart lantern hanging from the top
	const heartLamp = add(arch, new THREE.ExtrudeGeometry(k.heartShape(0.11), { depth: 0.04, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: "#ff8fab", emissive: "#ff4d6d", emissiveIntensity: 1.6 }), 0, AR.post + AR.r - 0.42, -0.02, { cast: false });
	heartLamp.geometry.center();
	heartLamp.rotation.y = Math.PI / 2;
	add(arch, new THREE.CylinderGeometry(0.004, 0.004, 0.28, 4), mat("#bbb"), 0, AR.post + AR.r - 0.2, 0, { cast: false });
	for (const sz of [-1, 1]) {
		k.box(AR.x - 0.3, AR.x + 0.3, AR.z + sz * AR.r - 0.12, AR.z + sz * AR.r + 0.12);
		// a pot of flowers at the foot of each side
		const pot = group(g, AR.x + 0.55, 0, AR.z + sz * (AR.r + 0.1));
		add(pot, new THREE.CylinderGeometry(0.2, 0.15, 0.32, 16), mat("#c86b4a", 0.7), 0, 0.16, 0);
		for (let i = 0; i < 9; i++) add(pot, new THREE.SphereGeometry(0.06, 8, 6), mat(bloomCols[i % bloomCols.length], 0.6), Math.cos(i * 0.7) * 0.11, 0.36 + (i % 3) * 0.04, Math.sin(i * 0.7) * 0.11, { cast: false });
		k.box(AR.x + 0.33, AR.x + 0.77, AR.z + sz * (AR.r + 0.1) - 0.22, AR.z + sz * (AR.r + 0.1) + 0.22);
	}
	// petals drifting down under it, all the time (and a shower of them for a kiss)
	const petalGeo = new THREE.PlaneGeometry(0.045, 0.035);
	const petalM = new THREE.MeshStandardMaterial({ color: "#ff9ebb", side: THREE.DoubleSide, roughness: 0.8 });
	const petals = [];
	for (let i = 0; i < 16; i++) { const p = add(arch, petalGeo, petalM, 0, -5, 0, { cast: false, receive: false }); p.userData = { ph: R(), x: (R() - 0.5) * 0.7, z: (R() - 0.5) * 1.6, sp: 0.18 + R() * 0.12 }; petals.push(p); }
	const shower = [];
	function petalShower() {
		for (let i = 0; i < 26; i++) {
			const p = add(arch, petalGeo, petalM, (R() - 0.5) * 0.4, AR.post + AR.r - 0.1, (R() - 0.5) * 1.2, { cast: false, receive: false });
			p.userData = { vx: (R() - 0.5) * 0.9, vz: (R() - 0.5) * 1.4, vy: 0.4 + R() * 0.8, life: 0, spin: R() * 6 };
			shower.push(p);
		}
		ctx.sfx("love", 0.35);
	}
	const nearPeer = () => {
		const me = ctx.me();
		let near = null, nd = 2.2;
		ctx.peers().forEach((p, id) => { const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < nd && !p.sit) { nd = d; near = id; } });
		return near;
	};
	k.interact("pool:arch", {
		label: () => { const id = nearPeer(), q = id && ctx.peers().get(id); return q ? "Kiss " + q.look.name + " under the flower arch" : "Stand under the flower arch"; },
		stand: [AR.x, AR.z], face: -Math.PI / 2,
		use: () => {
			petalShower();
			ctx.send({ t: "fx", kind: "zfx", zone: "pool", what: "petals" });
			if (nearPeer()) ctx.loveAct("smooch"); else ctx.doUpper("heartarms", 1800);
		}
	}, arch);

	// a little tiki smoothie bar against the railing, with two stools: take a smoothie, a juice, strawberries...
	const BAR = { x: 8.3, z: -5.05 };
	const bar = group(g, BAR.x, 0, BAR.z);
	const bamboo = canvasTex(512, 128, (c, w, h) => {
		c.fillStyle = "#c9a26b"; c.fillRect(0, 0, w, h);
		for (let x = 0; x < w; x += 22) {
			const gr = c.createLinearGradient(x, 0, x + 20, 0); gr.addColorStop(0, "#a8834f"); gr.addColorStop(0.5, "#e2c48f"); gr.addColorStop(1, "#a8834f");
			c.fillStyle = gr; c.fillRect(x + 1, 0, 20, h);
			c.fillStyle = "rgba(90,60,30,0.5)"; for (let y = 18 + (x % 3) * 9; y < h; y += 46) c.fillRect(x + 1, y, 20, 3);
		}
	});
	add(bar, rbox(2.2, 0.98, 0.62, 0.02), mat("#ffffff", 0.75, 0, { map: bamboo }), 0, 0.49, 0);
	add(bar, rbox(2.36, 0.06, 0.78, 0.015), mat("#7a4e34", 0.4), 0, 1.0, 0.04);
	// the roof: four bamboo posts and a straw thatch, a glowing sign on the front
	const bambooM = mat("#b88b55", 0.7);
	for (const sx of [-1.08, 1.08]) for (const sz of [-0.3, 0.3]) add(bar, new THREE.CylinderGeometry(0.045, 0.05, 2.25, 8), bambooM, sx, 1.125, sz);
	const straw = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#d8b56a"; c.fillRect(0, 0, w, h); const r = rng(17); for (let i = 0; i < 900; i++) { c.strokeStyle = `rgba(${120 + r() * 80},${90 + r() * 60},${30 + r() * 30},0.6)`; c.lineWidth = 1 + r() * 1.5; const x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 6, y + 18 + r() * 14); c.stroke(); } }, 3, 1);
	const thatch = add(bar, new THREE.ConeGeometry(1.75, 0.62, 4, 1, true), mat("#ffffff", 0.95, 0, { map: straw, side: THREE.DoubleSide }), 0, 2.53, 0, { ry: Math.PI / 4 });
	thatch.scale.set(1, 1, 0.55);
	const signTex = k.tex.text("Smoothies", { w: 512, h: 128, color: "#fff4d6", glow: "#ff7aa2", font: "800 76px 'Caveat', 'Nunito', cursive" });
	add(bar, new THREE.PlaneGeometry(1.1, 0.28), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false }), 0, 2.08, 0.36, { cast: false, receive: false });
	// party bulbs round the edge of the roof
	const barBulbs = [];
	const bulbCols = ["#ff5d8f", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff"];
	for (let i = 0; i < 14; i++) {
		const x = -1.15 + i / 13 * 2.3;
		barBulbs.push(add(bar, new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: bulbCols[i % 5], emissive: bulbCols[i % 5], emissiveIntensity: 1.6 }), x, 2.22 - Math.sin(i / 13 * Math.PI) * 0.06, 0.4, { cast: false }));
	}
	// on the counter: a blender, a bowl of fruit, three smoothies with straws
	const cupGlass = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
	add(bar, new THREE.CylinderGeometry(0.09, 0.08, 0.1, 16), mat("#2b2d42", 0.4), -0.75, 1.08, -0.05);
	add(bar, new THREE.CylinderGeometry(0.08, 0.06, 0.26, 16), cupGlass, -0.75, 1.26, -0.05, { cast: false });
	add(bar, new THREE.CylinderGeometry(0.068, 0.055, 0.16, 16), mat("#ff8fab", 0.4), -0.75, 1.21, -0.05, { cast: false });
	add(bar, new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#f2ede4", 0.4, 0, { side: THREE.DoubleSide }), 0.7, 1.2, -0.08);
	for (let i = 0; i < 7; i++) add(bar, new THREE.SphereGeometry(0.055, 12, 10), mat(["#ffa62b", "#ffe066", "#e63946", "#8ac926"][i % 4], 0.45), 0.7 + Math.cos(i) * 0.08, 1.1 + (i % 2) * 0.04, -0.08 + Math.sin(i) * 0.08, { cast: false });
	[["#ff8fab", -0.25], ["#ffd166", 0.0], ["#9be7a6", 0.25]].forEach(([c, x]) => {
		add(bar, new THREE.CylinderGeometry(0.04, 0.03, 0.15, 14), cupGlass, x, 1.105, 0.18, { cast: false });
		add(bar, new THREE.CylinderGeometry(0.035, 0.026, 0.12, 14), mat(c, 0.5), x, 1.095, 0.18, { cast: false });
		add(bar, new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6), mat("#ff4d6d", 0.4), x + 0.02, 1.2, 0.18, { rz: 0.25, cast: false });
	});
	// bottles on a shelf at the back
	add(bar, rbox(2.0, 0.04, 0.16, 0.01), mat("#7a4e34", 0.4), 0, 1.45, -0.26);
	for (let i = 0; i < 7; i++) add(bar, new THREE.CylinderGeometry(0.035, 0.04, 0.22, 12), new THREE.MeshPhysicalMaterial({ color: ["#ff7aa2", "#ffd166", "#7bdff2", "#b2f7ef", "#f7aef8"][i % 5], transparent: true, opacity: 0.8, roughness: 0.1 }), -0.85 + i * 0.28, 1.58, -0.26, { cast: false });
	k.box(BAR.x - 1.18, BAR.x + 1.18, BAR.z - 0.48, BAR.z + 0.42);
	for (let i = 0; i < 2; i++) {
		const sx = BAR.x - 0.55 + i * 1.1, sz = BAR.z + 0.85;
		const st = group(g, sx, 0, sz);
		add(st, new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20), mat(i ? "#4cc9f0" : "#ff8fab", 0.6), 0, 0.72, 0);
		add(st, new THREE.CylinderGeometry(0.025, 0.03, 0.7, 8), mat("#b88b55", 0.6), 0, 0.35, 0);
		add(st, new THREE.TorusGeometry(0.15, 0.012, 6, 20), mat("#b88b55", 0.6), 0, 0.3, 0, { rx: Math.PI / 2 });
		add(st, new THREE.CylinderGeometry(0.17, 0.2, 0.02, 20), mat("#b88b55", 0.6), 0, 0.01, 0);
		k.spot({ id: "barStool" + i, x: sx, z: sz, h: Math.PI, y: 0.31 });
		k.interact("pool:barstool" + i, { label: "Sit at the smoothie bar", stand: [sx, sz + 0.6], sit: ["barStool" + i] }, st);
	}
	k.interact("pool:bar", { label: "Get a smoothie", stand: [BAR.x, BAR.z + 1.05], face: Math.PI, reach: 2.2, use: () => ctx.foodMenu("Smoothie bar", ["smoothie", "juice", "strawberry", "icecream"]) }, bar);

	// ---------------------------------------------------------------- loungers, an umbrella, palms, floats
	const towelCols = ["#ff8fab", "#4cc9f0", "#ffd166", "#06d6a0", "#bdb2ff", "#ffb703"];
	const lounger = (i, x, z, h) => {
		const lg = group(g, x, 0, z, h);
		const wood = mat("#f2ede4", 0.5);
		add(lg, rbox(0.7, 0.08, 1.9, 0.03), wood, 0, 0.32, 0.05);
		add(lg, rbox(0.7, 0.08, 0.75, 0.03), wood, 0, 0.62, -0.75, { rx: 0.75 });
		for (const sx of [-0.3, 0.3]) for (const sz of [-0.7, 0.85]) add(lg, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), chrome, sx, 0.15, sz);
		add(lg, rbox(0.62, 0.04, 1.5, 0.02), mat(towelCols[i % towelCols.length], 0.95), 0, 0.38, 0.2);
		const along = Math.abs(Math.sin(h)) > 0.5;
		k.box(x - (along ? 1.05 : 0.4), x + (along ? 1.05 : 0.4), z - (along ? 0.4 : 1.05), z + (along ? 0.4 : 1.05));
		const fwd = [Math.sin(h), Math.cos(h)];
		// hips well back on the seat so you lie back against the backrest, legs stretched out along it
		// (recline: its own pose; hands: next to someone, a cuddle is holding hands across the gap)
		k.spot({ id: "lounger" + i, x: x - fwd[0] * 0.42, z: z - fwd[1] * 0.42, h, y: 0.0, recline: true, hands: true });
		k.interact("pool:lounger" + i, { label: "Relax on the lounger", stand: [x + fwd[0] * 1.45, z + fwd[1] * 1.45], sit: ["lounger" + i] }, lg);
	};
	// in pairs, side by side and close enough to hold hands
	[-4.4, -3.4, -1.1, -0.1].forEach((lx, i) => lounger(i, lx, -4.85, 0));
	lounger(4, -10.0, -2.25, Math.PI / 2);
	lounger(5, -10.0, -1.25, Math.PI / 2);
	const umb = group(g, -9.55, 0, -3.2);
	add(umb, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), chrome, 0, 1.2, 0);
	add(umb, new THREE.ConeGeometry(1.4, 0.5, 12, 1, true), mat("#e76f51", 0.8, 0, { side: THREE.DoubleSide }), 0, 2.35, 0);
	add(umb, new THREE.CylinderGeometry(0.25, 0.3, 0.12, 16), mat("#3e3a3a", 0.5), 0, 0.06, 0);
	k.box(-9.75, -9.35, -3.4, -3.0);
	const palms = [];
	for (const [px, pz] of [[-13.45, -5.3], [-6.9, -5.35], [13.45, -5.3], [13.45, 2.8], [4.3, -5.3]]) {
		const p = group(g, px, 0, pz);
		add(p, new THREE.CylinderGeometry(0.38, 0.3, 0.6, 20), mat("#d8cfc4", 0.7), 0, 0.3, 0);
		let y = 0.55;
		for (let i = 0; i < 9; i++) { add(p, new THREE.CylinderGeometry(0.07 - i * 0.003, 0.08 - i * 0.003, 0.28, 10), mat(i % 2 ? "#8b6b4a" : "#7a5c3e", 0.9), Math.sin(i * 0.4) * 0.05, y + 0.14, 0); y += 0.27; }
		const crown = group(p, 0.05, y, 0);
		for (let i = 0; i < 8; i++) {
			const fr = group(crown, 0, 0, 0, i / 8 * Math.PI * 2);
			add(fr, new THREE.SphereGeometry(0.5, 12, 8), mat(i % 2 ? "#3f8a4a" : "#2f7a3e", 0.6, 0, { side: THREE.DoubleSide }), 0, -0.15, 0.55, { rx: 0.55 }).scale.set(0.28, 0.06, 1.0);
		}
		palms.push(crown);
		k.box(px - 0.42, px + 0.42, pz - 0.42, pz + 0.42);
	}
	const floats = [];
	const ringTex = col => canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : col; c.fillRect(i * w / 8, 0, w / 8 + 1, h); } });
	for (const [col, ph] of [["#ff6b9d", 0], ["#ffc93c", 2.5]]) {
		const r = add(g, new THREE.TorusGeometry(0.38, 0.15, 14, 32), mat("#ffffff", 0.3, 0, { map: ringTex(col) }), cx, P.surf + 0.05, cz, { rx: Math.PI / 2 });
		r.userData.ph = ph;
		floats.push(r);
	}
	// string lights from the house wall out to poles on the railing, and lanterns on the deck
	const bulbs = [];
	const poleM = mat("#2e2b2b", 0.5, 0.5);
	const poles = [[-12.5, ZN + 0.15], [-5.0, ZN + 0.15], [3.0, ZN + 0.15], [12.0, ZN + 0.15]];
	poles.forEach(([px, pz]) => add(g, new THREE.CylinderGeometry(0.035, 0.045, 2.95, 10), poleM, px, 1.475, pz));
	const strand = (a, b, sag) => {
		const pts = [];
		for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[2] + (b[2] - a[2]) * u - Math.sin(u * Math.PI) * sag, a[1] + (b[1] - a[1]) * u)); }
		const curve = new THREE.CatmullRomCurve3(pts);
		add(g, new THREE.TubeGeometry(curve, 60, 0.005, 4), mat("#222", 0.6), 0, 0, 0, { cast: false });
		const n = Math.round(curve.getLength() / 0.55);
		for (let i = 1; i < n; i++) {
			const p = curve.getPoint(i / n);
			const b = add(g, new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: "#ffd9a0", emissive: "#ffc26b", emissiveIntensity: 2.4 }), p.x, p.y - 0.05, p.z, { cast: false });
			b.userData.ph = R() * 6;
			bulbs.push(b);
		}
	};
	strand([-12.5, ZN + 0.15, 2.9], [-9.0, ZA1, 3.8], 0.5);
	strand([-5.0, ZN + 0.15, 2.9], [-3.5, ZA1, 3.8], 0.5);
	strand([3.0, ZN + 0.15, 2.9], [1.0, ZA1, 3.8], 0.5);
	strand([-12.5, ZN + 0.15, 2.9], [12.0, ZN + 0.15, 2.9], 0.7);
	const lanternM = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffb35a", emissiveIntensity: 1.8 });
	for (const [lx, lz] of [[-12.0, 4.6], [-7.0, 4.6], [5.0, 2.6], [11.0, 2.6], [12.8, -3.0]]) {
		const l = group(g, lx, 0, lz);
		add(l, rbox(0.22, 0.36, 0.22, 0.03), mat("#2e2b2b", 0.5, 0.4), 0, 0.18, 0);
		add(l, new THREE.BoxGeometry(0.16, 0.24, 0.16), lanternM, 0, 0.2, 0, { cast: false });
	}

	// ---------------------------------------------------------------- every frame
	const ripples = [], splashes = [];
	const rippleM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
	const rippleGeo = new THREE.RingGeometry(0.16, 0.21, 28);
	rippleGeo.rotateX(-Math.PI / 2);
	const dropGeo = new THREE.SphereGeometry(0.04, 8, 6);
	const dropM = new THREE.MeshBasicMaterial({ color: "#e8f8ff", transparent: true, opacity: 0.85 });
	// a little foam trail behind a swimmer
	const foamGeo = new THREE.CircleGeometry(0.12, 12);
	foamGeo.rotateX(-Math.PI / 2);
	function ripple(x, z, big) {
		const r = new THREE.Mesh(rippleGeo, rippleM.clone());
		r.position.set(x, P.surf + 0.02, z);
		r.userData = { life: 0, big };
		g.add(r);
		ripples.push(r);
	}
	function splash(x, z, n) {
		for (let i = 0; i < n; i++) {
			const d = new THREE.Mesh(dropGeo, dropM);
			const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.4;
			d.position.set(x, P.surf + 0.05, z);
			d.userData = { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + Math.random() * 2.5 };
			g.add(d);
			splashes.push(d);
		}
		ripple(x, z, true);
		ctx.sfx("water", 0.5);
	}
	function foam(x, z) {
		const f = new THREE.Mesh(foamGeo, rippleM.clone());
		f.material.opacity = 0.55;
		f.position.set(x + (Math.random() - 0.5) * 0.2, P.surf + 0.025, z + (Math.random() - 0.5) * 0.2);
		f.userData = { life: 0, foam: true };
		g.add(f);
		ripples.push(f);
	}
	const wasIn = new Map();
	let rippleT = 0;
	function update(dt, t) {
		for (let i = 0; i < wpos.count; i++) {
			const wx = wbase[i * 3], wz = wbase[i * 3 + 2];
			wpos.setY(i, Math.sin(wx * 1.3 + t * 1.6) * 0.02 + Math.cos(wz * 1.7 + t * 1.2) * 0.015 + Math.sin((wx + wz) * 2.2 + t * 2.4) * 0.008);
		}
		wpos.needsUpdate = true;
		waterGeo.computeVertexNormals();
		causticTex.offset.set(Math.sin(t * 0.13) * 0.3, t * 0.025);
		glowM.opacity = 0.14 + Math.sin(t * 0.8) * 0.03;
		floats.forEach((f, i) => {
			const a = t * 0.06 + f.userData.ph;
			f.position.set(cx + Math.sin(a) * 3.0, P.surf + 0.04 + Math.sin(t * 1.4 + i) * 0.02, cz + Math.sin(a * 1.7) * 1.5);
			f.rotation.z = t * 0.1 + i;
		});
		palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.5 + i) * 0.03; });
		bulbs.forEach(b => { b.material.emissiveIntensity = 1.8 + Math.sin(t * 1.7 + b.userData.ph) * 0.6; });
		tubBubbles.forEach(b => { const u = b.userData, p2 = (t * 0.8 + u.ph) % 1; b.position.set(Math.cos(u.a + t * 0.3) * u.r, 0.47 + p2 * 0.04, Math.sin(u.a + t * 0.3) * u.r); b.scale.setScalar(0.6 + p2); });
		tubWater.position.y = 0.47 + Math.sin(t * 6) * 0.004;
		// the swing rocks gently while someone's on it
		const meSit = ctx.me().sit;
		poolSwing.occupied = SWING_IDS.includes(meSit) || [...ctx.peers().values()].some(p => SWING_IDS.includes(p.sit));
		poolSwing.angle += ((poolSwing.occupied ? Math.sin(t * 1.55) * 0.22 : 0) - poolSwing.angle) * Math.min(1, dt * 2.5);
		swHang.rotation.x = poolSwing.angle;
		swBulbs.forEach((b, i) => { b.material.emissiveIntensity = 1.5 + Math.sin(t * 2.2 + i * 0.9) * 0.6; });
		barBulbs.forEach((b, i) => { b.material.emissiveIntensity = 1.2 + 0.8 * Math.max(0, Math.sin(t * 3 - i * 0.7)); });
		// the arch: fairy lights twinkle, the heart lantern sways, petals drift down
		twinkle[0].emissiveIntensity = 1.4 + Math.sin(t * 2.6) * 0.9;
		twinkle[1].emissiveIntensity = 1.4 + Math.sin(t * 2.6 + Math.PI) * 0.9;
		heartLamp.rotation.z = Math.sin(t * 1.3) * 0.12;
		heartLamp.material.emissiveIntensity = 1.4 + Math.sin(t * 2) * 0.4;
		petals.forEach(p => {
			const u = p.userData, f = (t * u.sp + u.ph) % 1;
			p.position.set(u.x + Math.sin(t * 1.1 + u.ph * 9) * 0.12, (AR.post + AR.r - 0.15) * (1 - f), u.z + Math.cos(t * 0.9 + u.ph * 7) * 0.1);
			p.rotation.set(t * 1.7 + u.ph * 6, t * 1.3, u.ph * 3);
		});
		for (let i = shower.length - 1; i >= 0; i--) {
			const p = shower[i], u = p.userData;
			u.life += dt; u.vy -= 1.1 * dt;
			u.vx *= 1 - dt * 0.8; u.vz *= 1 - dt * 0.8;
			p.position.x += u.vx * dt; p.position.y = Math.max(0.01, p.position.y + u.vy * dt); p.position.z += u.vz * dt;
			p.rotation.set(u.spin + u.life * 4, u.life * 3, 0);
			if (u.life > 4.5) { arch.remove(p); shower.splice(i, 1); }
		}
		// the dive: along the board, spring, fly, splash
		const me = ctx.me();
		if (dive) {
			const u = performance.now() / 1000 - dive.t0;
			const bx = P.x1 + 1.5 + k.ox, bz = BZ + k.oz;
			if (u < 0.5) { me.x = bx - u * 2.4; me.z = bz; me.h = -Math.PI / 2; }
			else if (u < 1.2) { me.x = bx - 1.2 - (u - 0.5) / 0.7 * 2.4; me.z = bz; me.h = -Math.PI / 2; }
			else { dive = null; me.target = null; me.path = []; }
		}
		// who's in the water: a splash on the way in, ripples and a foam trail while swimming
		const avs = [[ctx.myAvatar(), me.x, me.z, me.speed]];
		ctx.peers().forEach(p => { if (p.avatar.root.visible) avs.push([p.avatar, p.x, p.z, p.speed]); });
		rippleT += dt;
		const doRipple = rippleT > 0.3;
		if (doRipple) rippleT = 0;
		for (const [av, ax, az, speed] of avs) {
			const lx = ax - k.ox, lz = az - k.oz;
			const deep = inPool(lx, lz) && floorY(lx, lz) < -0.5;
			if (deep && wasIn.get(av) === false) splash(lx, lz, 16);
			wasIn.set(av, deep);
			if (!inPool(lx, lz)) continue;
			if (doRipple) ripple(lx, lz, false);
			if (deep && speed > 0.2 && Math.random() < dt * 14) foam(lx, lz);
		}
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.userData.life += dt;
			if (r.userData.foam) {
				r.scale.setScalar(1 + r.userData.life * 1.5);
				r.material.opacity = Math.max(0, 0.55 - r.userData.life * 0.5);
			} else {
				const s = 1 + r.userData.life * (r.userData.big ? 6 : 3.5);
				r.scale.set(s, 1, s);
				r.material.opacity = Math.max(0, (r.userData.big ? 0.7 : 0.45) - r.userData.life * 0.4);
			}
			if (r.material.opacity <= 0) { g.remove(r); r.material.dispose(); ripples.splice(i, 1); }
		}
		for (let i = splashes.length - 1; i >= 0; i--) {
			const d = splashes[i], u = d.userData;
			u.vy -= 9.8 * dt;
			d.position.x += u.vx * dt; d.position.z += u.vz * dt; d.position.y += u.vy * dt;
			if (d.position.y < P.surf) { g.remove(d); splashes.splice(i, 1); }
		}
	}
	return {
		update,
		onLeave() { dive = null; },
		onFx(d, p) {
			if (d.what === "petals") { petalShower(); return; }
			if (d.what !== "splash") return;
			splash(d.x - k.ox, d.z - k.oz, 10);
			if (d.to === ctx.MY_ID) { ctx.doUpper("laugh", 2400); ctx.notice(`<b>${ctx.esc(p ? p.look.name : "Someone")}</b> splashed you!`); }
		},
		promptOpts(opts) {
			const me = ctx.me();
			if (dive) return;
			const free = key => !opts.some(o => o.k === key);
			// side by side on the loungers: hold hands across the gap, or lean over for a kiss
			if (me.sit && /^lounger/.test(me.sit)) {
				const nb = ctx.seatNeighbor(), q = nb && ctx.peers().get(nb);
				if (!q) return;
				const holding = me.upper === "cuddle" && me.partner === nb;
				if (free("R")) opts.push({ k: "R", label: holding ? "Let go of " + q.look.name + "'s hand" : "Hold " + q.look.name + "'s hand", fn: () => ctx.loveAct("cuddle") });
				if (free("G")) opts.push({ k: "G", label: "Kiss " + q.look.name, fn: () => ctx.loveAct("smooch") });
				return;
			}
			if (me.sit) return;
			const lx = me.x - k.ox, lz = me.z - k.oz;
			if (!inPool(lx, lz)) return;
			let near = null, nd = 3;
			ctx.peers().forEach((p, id) => { const dd = Math.hypot(p.x - me.x, p.z - me.z); if (dd < nd && inPool(p.x - k.ox, p.z - k.oz)) { nd = dd; near = id; } });
			// in the water together: kiss, swim hand in hand
			if (near) {
				const q = ctx.peers().get(near);
				if (free("E")) opts.push({ k: "E", label: "Kiss " + q.look.name, fn: () => ctx.loveAct("smooch") });
				const holding = me.upper === "handhold" && me.partner === near;
				if (free("R")) opts.push({ k: "R", label: holding ? "Let go of " + q.look.name + "'s hand" : "Swim hand in hand with " + q.look.name, fn: () => ctx.holdHands(near) });
			}
			if (near && free("F")) {
				const q = ctx.peers().get(near);
				opts.push({ k: "F", label: "Splash " + q.look.name, fn: () => {
					me.h = Math.atan2(q.x - me.x, q.z - me.z);
					ctx.doUpper("laugh", 1600);
					const sx = (me.x + q.x) / 2, sz = (me.z + q.z) / 2;
					splash(sx - k.ox, sz - k.oz, 12);
					ctx.send({ t: "fx", kind: "zfx", zone: "pool", what: "splash", x: sx, z: sz, to: near });
				} });
			}
			if (free("G") && lx > P.x0 + 1.2) opts.push({ k: "G", label: "Swim to the steps", fn: () => ctx.walkTo(P.x0 - 0.7 + k.ox, me.z, null) });
		}
	};
}
