/**
 * Harmony World — the Aquarium: a big blue building on the west avenue, at the west end of the cross walk (and across
 * the lawn from the garden's west wing gate). Indoors, dim and blue, lit mostly by the water.
 *
 * Local coordinates (origin at world -41.3, -21.5): x -11.7..11.7, z -6.0..4.7 (world x -53..-29.6, z -27.5..-16.8).
 * The way in is the doorway in the east wall (x 11.7) at z -0.75..0.75, at the west end of the cross walk.
 *
 *   the lobby (x 8..11.45): a ticket desk, a glass column of little fish, the show board, and the big button that
 *     starts a feeding show;
 *   the tunnel (x -6.5..8, along z = 0): an acrylic arch you walk through with the tank all round and over you:
 *     schools of fish, two sharks circling overhead, a manta ray, a sea turtle, glowing jellyfish, kelp swaying on
 *     the sand, corals, rocks, a treasure chest that opens now and then in a burst of bubbles, light rays from the
 *     surface and caustics rippling over everything;
 *   the gallery (x -11.45..-6.5): a whole wall of glass onto the tank, with benches for two.
 *
 * The feeding show runs on the wall clock (every 4 minutes, a minute long), the same for everyone: a diver swims
 * down and scatters food, the fish swarm to it and the sharks swing by. The lobby button starts one now for
 * everybody (shared key "aquarium:show" = the time it was pressed, in ms).
 */
const HB = 5.4;                                    // the building's walls (the roof sits on top)
const HC = 4.6;                                    // the lobby's and the gallery's ceilings
const TANK = { x0: -6.5, x1: 8.0, z0: -5.7, z1: 4.4, top: 4.9 };
const TR = 2.3;                                    // the tunnel's radius (its axis runs along x at z 0, on the floor)
const SHOW_EVERY = 240, SHOW_LEN = 60;
const FOOD = { x: 1.0, y: 2.7, z: -3.6 };          // where the fish crowd round at feeding time
const CHEST = { x: 2.8, z: -3.2 };
const TAU = Math.PI * 2;
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(5150);
	const Y = new THREE.Vector3(0, 1, 0);
	k.floor(() => 0);
	// (every walk rect reaches well into the next one: a body needs its radius clear inside one rect, so rects that
	// only touch leave a strip nobody can stand on - the doorway one runs on past the wall, out into the garden,
	// because the garden's own rect doesn't count on this side of x 11.7)
	k.walk(8.2, 11.45, -5.65, 4.35);                 // the lobby
	k.walk(10.4, 12.7, -0.75, 0.75);                 // out through the doorway onto the grounds
	k.walk(TANK.x0 - 1.0, TANK.x1 + 1.0, -1.5, 1.5); // the tunnel (on into the lobby and the gallery)
	k.walk(-11.45, TANK.x0, -5.65, 4.35);            // the gallery
	k.cam = { minX: -11.3, maxX: 11.3, minZ: -5.5, maxZ: 4.2, maxY: 3.6, minY: 0.2 };

	const glow = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, o || {}));
	const sign = (text, o) => new THREE.MeshBasicMaterial({ map: k.tex.text(text, Object.assign({ w: 1024, h: 256 }, o)), transparent: true, depthWrite: false, toneMapped: false });
	const dot = canvasTex(32, 32, (c, w, h) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
	// (several shapes in one geometry: one draw call for every fish of a kind)
	const merge = list => {
		const pos = [], nor = [];
		for (const gm of list) {
			const n = gm.index ? gm.toNonIndexed() : gm;
			n.computeVertexNormals();
			pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array);
		}
		const out = new THREE.BufferGeometry();
		out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
		return out;
	};
	const tri = (a, b, c) => { const gm = new THREE.BufferGeometry(); gm.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); return gm; };

	// ================================================================ the building: walls, roof, the facade
	const extTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#123b52"; c.fillRect(0, 0, w, h);
		const r = rng(9);
		for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${r() * 0.05})`; c.fillRect(r() * w, r() * h, 2, 2); }
		c.strokeStyle = "rgba(120,220,255,0.12)"; c.lineWidth = 6;
		for (let y = 40; y < h; y += 96) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x / w * TAU * 2) * 14); c.stroke(); }
	}, 4, 1);
	const intTex = canvasTex(512, 512, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0b2340"); gr.addColorStop(1, "#06172b"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
		c.strokeStyle = "rgba(90,200,255,0.10)"; c.lineWidth = 10;
		for (let y = 60; y < h; y += 120) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x / w * TAU * 3 + y) * 18); c.stroke(); }
	}, 3, 1);
	const extM = mat("#ffffff", 0.85, 0.05, { map: extTex }), intM = mat("#ffffff", 0.9, 0, { map: intTex });
	// a wall box with its inside face (+x, -x, +y, -y, +z, -z) in the inside material
	const wall = (x0, x1, y0, y1, z0, z1, inside) => {
		const ms = [extM, extM, extM, extM, extM, extM];
		ms[inside] = intM;
		return add(g, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), ms, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { cast: false });
	};
	wall(11.45, 11.7, 0, HB, -6.0, -0.75, 1);
	wall(11.45, 11.7, 0, HB, 0.75, 4.7, 1);
	wall(11.45, 11.7, 2.5, HB, -0.75, 0.75, 1);
	wall(-11.7, -11.45, 0, HB, -6.0, 4.7, 0);
	wall(-11.45, 11.45, 0, HB, -6.0, -5.75, 4);
	wall(-11.45, 11.45, 0, HB, 4.45, 4.7, 5);
	// solid to walk into and to the camera (inside and from the garden), with the doorway left open
	k.wall(11.45, 11.7, -6.0, -0.75, 0, HB);
	k.wall(11.45, 11.7, 0.75, 4.7, 0, HB);
	k.camWall(11.45, 11.7, -0.75, 0.75, 2.5, HB);
	k.wall(-11.7, -11.45, -6.0, 4.7, 0, HB);
	k.wall(-11.7, 11.7, -6.0, -5.75, 0, HB);
	k.wall(-11.7, 11.7, 4.45, 4.7, 0, HB);
	// the ceilings and the roof: one slab over everything
	k.camWall(-11.7, 11.7, -6.0, 4.7, HC, HB + 0.4);
	// the tank's water all round the tunnel (so the camera stays in the tunnel's walkway space), the wall between
	// the lobby and the tank, and the gallery's glass (both open only where the tunnel goes through)
	k.camWall(TANK.x0, TANK.x1, -5.75, -1.75, 0, HC);
	k.camWall(TANK.x0, TANK.x1, 1.75, 4.45, 0, HC);
	k.camWall(TANK.x0, TANK.x1, -1.75, 1.75, 2.25, HC);
	for (const x of [TANK.x1 + 0.08, TANK.x0 - 0.02]) {
		k.wall(x - 0.13, x + 0.13, -5.75, -2.35, 0, HC);
		k.wall(x - 0.13, x + 0.13, 2.35, 4.45, 0, HC);
		k.camWall(x - 0.13, x + 0.13, -2.35, 2.35, 2.3, HC);
	}
	add(g, new THREE.BoxGeometry(23.6, 0.25, 10.9), extM, 0, HB + 0.12, -0.65, { cast: false });
	const neonC = glow("#5fe1ff"), neonP = glow("#ff7ad9");
	// a glowing trim round the top of the walls
	for (const [x, z, w, d] of [[11.72, -0.65, 0.05, 10.8], [-11.72, -0.65, 0.05, 10.8], [0, -6.02, 23.5, 0.05], [0, 4.72, 23.5, 0.05]]) add(g, new THREE.BoxGeometry(w, 0.06, d), neonC, x, HB - 0.12, z, { cast: false, receive: false });
	// a glass dome over the middle of the tank
	add(g, new THREE.SphereGeometry(2.2, 28, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: "#8fdcff", transparent: true, opacity: 0.35, roughness: 0.1, emissive: "#1d6a9a", emissiveIntensity: 0.6, depthWrite: false }), 0.75, HB + 0.25, -0.6, { cast: false });
	// ---------------- the facade (east, toward the garden)
	{
		const fx = 11.72;
		const fg = group(g, fx, 0, 0, Math.PI / 2);   // (+z here is out into the garden; x runs north->south... see below)
		// in fg: local x = -world z (so +x is south), local z = out of the wall
		add(fg, new THREE.PlaneGeometry(6.4, 1.5), sign("AQUARIUM", { color: "#e6fbff", glow: "#3fd0ff", font: "900 168px Nunito, 'Segoe UI', sans-serif" }), 0, 3.7, 0.04, { cast: false, receive: false });
		add(fg, rbox(7.0, 1.8, 0.12, 0.06), mat("#0a2236", 0.5, 0.3), 0, 3.7, -0.05);
		// the door's glowing frame, and a wave canopy over it
		for (const [x, y, w, h] of [[-0.82, 1.25, 0.08, 2.5], [0.82, 1.25, 0.08, 2.5], [0, 2.54, 1.72, 0.08]]) add(fg, new THREE.BoxGeometry(w, h, 0.06), neonC, x, y, 0.03, { cast: false, receive: false });
		const wave = new THREE.Shape();
		wave.moveTo(-1.6, 0);
		for (let i = 0; i <= 32; i++) { const u = i / 32; wave.lineTo(-1.6 + 3.2 * u, 0.12 + Math.sin(u * TAU * 2) * 0.08); }
		wave.lineTo(1.6, 0); wave.lineTo(-1.6, 0);
		add(fg, new THREE.ExtrudeGeometry(wave, { depth: 0.9, bevelEnabled: false }), mat("#1aa3d6", 0.4, 0.2), 0, 2.62, 0.0, { cast: false });
		// round porthole windows full of fish
		const port = canvasTex(256, 256, (c, w, h) => {
			const gr = c.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, "#3fb8ff"); gr.addColorStop(1, "#06305a"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
			const r = rng(3);
			for (let i = 0; i < 7; i++) {
				const x = 40 + r() * 170, y = 50 + r() * 150, s = 10 + r() * 16;
				c.fillStyle = ["#ffd166", "#ff7a59", "#ffffff", "#7cf0ff"][i % 4];
				c.beginPath(); c.ellipse(x, y, s * 1.6, s, 0, 0, TAU); c.fill();
				c.beginPath(); c.moveTo(x - s * 1.4, y); c.lineTo(x - s * 2.6, y - s); c.lineTo(x - s * 2.6, y + s); c.fill();
			}
		});
		const portM = glow("#ffffff", { map: port });
		for (const x of [-4.4, -2.6, 2.6, 4.4]) {
			add(fg, new THREE.CircleGeometry(0.6, 32), portM, x, 1.9, 0.03, { cast: false, receive: false });
			add(fg, new THREE.TorusGeometry(0.62, 0.06, 8, 32), mat("#d9e6ee", 0.25, 0.9), x, 1.9, 0.04, { cast: false });
		}
		// neon fish either side of the sign, and waves along the bottom
		const neonFish = canvasTex(512, 256, (c, w, h) => {
			c.strokeStyle = "#ff8fe0"; c.lineWidth = 12; c.shadowColor = "#ff4fd0"; c.shadowBlur = 24; c.lineJoin = "round";
			c.beginPath(); c.ellipse(230, 128, 130, 70, 0, 0, TAU); c.stroke();
			c.beginPath(); c.moveTo(100, 128); c.lineTo(30, 70); c.lineTo(30, 186); c.closePath(); c.stroke();
			c.beginPath(); c.arc(300, 110, 12, 0, TAU); c.stroke();
			c.strokeStyle = "#7ff3ff"; c.shadowColor = "#3fd0ff";
			for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(420 + i * 14, 70 - i * 30, 10 + i * 4, 0, TAU); c.stroke(); }
		});
		const nfM = new THREE.MeshBasicMaterial({ map: neonFish, transparent: true, depthWrite: false, toneMapped: false });
		add(fg, new THREE.PlaneGeometry(1.6, 0.8), nfM, -4.0, 3.75, 0.05, { cast: false, receive: false });
		add(fg, new THREE.PlaneGeometry(1.6, 0.8), nfM, 4.0, 3.75, 0.05, { cast: false, receive: false }).scale.x = -1;   // (mirrored: swimming the other way)
		const waves = canvasTex(1024, 64, (c, w, h) => { c.strokeStyle = "#5fe1ff"; c.lineWidth = 6; c.shadowColor = "#3fd0ff"; c.shadowBlur = 14; c.beginPath(); for (let x = 0; x <= w; x += 6) c.lineTo(x, 32 + Math.sin(x / w * TAU * 8) * 16); c.stroke(); });
		add(fg, new THREE.PlaneGeometry(10.6, 0.3), new THREE.MeshBasicMaterial({ map: waves, transparent: true, depthWrite: false, toneMapped: false }), 0, 0.35, 0.03, { cast: false, receive: false });
		var facadeNeon = nfM;
	}

	// (everything so far is the outside of the building; the rest is only drawn while you're in or at the door)
	const shellKids = new Set(g.children);

	// ================================================================ the tank: sand, back walls, the surface, the tunnel
	const caustic = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#000000"; c.fillRect(0, 0, w, h);
		const r = rng(77);
		c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 3; c.lineCap = "round";
		// a net of wobbly cells (tiles seamlessly: drawn three times over)
		for (let i = 0; i < 46; i++) {
			const x = r() * w, y = r() * h, s = 14 + r() * 26;
			for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
				c.beginPath();
				for (let a = 0; a <= 7; a++) { const an = a / 7 * TAU, rr = s * (0.75 + 0.35 * Math.sin(an * 3 + i)); c.lineTo(x + ox + Math.cos(an) * rr, y + oy + Math.sin(an) * rr); }
				c.stroke();
			}
		}
	}, 3, 2);
	const sandTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#c8b48a"; c.fillRect(0, 0, w, h); const r = rng(12); for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "255,240,210" : "90,70,40"},${r() * 0.25})`; c.fillRect(r() * w, r() * h, 2, 2); } }, 4, 3);
	const sandM = mat("#ffffff", 0.95, 0, { map: sandTex, emissive: "#5ec8ff", emissiveMap: caustic, emissiveIntensity: 0.55 });
	add(g, new THREE.PlaneGeometry(TANK.x1 - TANK.x0, TANK.z1 - TANK.z0), sandM, (TANK.x0 + TANK.x1) / 2, 0.0, (TANK.z0 + TANK.z1) / 2, { rx: -Math.PI / 2, cast: false });
	// the far walls of the tank: deep blue fading up to the light
	const deep = canvasTex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#2a8fd0"); gr.addColorStop(0.45, "#0d4c86"); gr.addColorStop(1, "#05213f"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
	const deepM = new THREE.MeshBasicMaterial({ map: deep });
	const TW = TANK.x1 - TANK.x0, TX = (TANK.x0 + TANK.x1) / 2;
	add(g, new THREE.PlaneGeometry(TW, TANK.top), deepM, TX, TANK.top / 2, TANK.z0 + 0.02, { cast: false, receive: false });
	add(g, new THREE.PlaneGeometry(TW, TANK.top), deepM, TX, TANK.top / 2, TANK.z1 - 0.02, { ry: Math.PI, cast: false, receive: false });
	// (a veil of blue water in front of them, so the far side looks far away)
	const hazeM = new THREE.MeshBasicMaterial({ color: "#0a3a66", transparent: true, opacity: 0.32, depthWrite: false });
	add(g, new THREE.PlaneGeometry(TW, TANK.top), hazeM, TX, TANK.top / 2, TANK.z0 + 0.9, { cast: false, receive: false }).renderOrder = 1;
	add(g, new THREE.PlaneGeometry(TW, TANK.top), hazeM, TX, TANK.top / 2, TANK.z1 - 0.5, { ry: Math.PI, cast: false, receive: false }).renderOrder = 1;
	// the surface, seen from underneath
	const ripple = canvasTex(256, 256, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#68c8f0"); gr.addColorStop(1, "#3a9fd8"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
		const r = rng(31); c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 2;
		for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { c.beginPath(); c.ellipse(x + ox, y + oy, 8 + r() * 22, 4 + r() * 10, r() * 3, 0, TAU); c.stroke(); } }
	}, 4, 3);
	add(g, new THREE.PlaneGeometry(TW, TANK.z1 - TANK.z0), new THREE.MeshBasicMaterial({ map: ripple, transparent: true, opacity: 0.85, depthWrite: false }), TX, TANK.top, (TANK.z0 + TANK.z1) / 2, { rx: Math.PI / 2, cast: false, receive: false }).renderOrder = 1;
	// light rays down from the surface
	const rayTex = canvasTex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(200,240,255,0.55)"); gr.addColorStop(1, "rgba(200,240,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); const g2 = c.createLinearGradient(0, 0, w, 0); });
	const rays = [];
	for (let i = 0; i < 9; i++) {
		const m = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
		const side = i % 2 ? 1 : -1, z = side > 0 ? 2.9 + R() * 1.0 : -2.9 - R() * 2.2;
		const r = add(g, new THREE.PlaneGeometry(0.9 + R() * 0.8, 4.4), m, TANK.x0 + 0.8 + i * (TW - 1.6) / 8, 2.7, z, { ry: R() * 3, rz: (R() - 0.5) * 0.35, cast: false, receive: false });
		r.userData.ph = R() * 6; r.renderOrder = 2;
		rays.push(r);
	}
	// ---------------- the tunnel: an acrylic arch, steel ribs, a walkway with lights along it
	{
		const acrylic = new THREE.MeshPhysicalMaterial({ color: "#bfe9ff", transparent: true, opacity: 0.13, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
		add(g, new THREE.CylinderGeometry(TR, TR, TW, 48, 1, true, 0, Math.PI), acrylic, TX, 0, 0, { rz: Math.PI / 2, cast: false, receive: false }).renderOrder = 3;
		const ribM = mat("#c9d6df", 0.3, 0.8);
		for (let i = 0; i <= 7; i++) add(g, new THREE.TorusGeometry(TR + 0.03, 0.05, 6, 28, Math.PI), ribM, TANK.x0 + i * TW / 7, 0, 0, { ry: Math.PI / 2, cast: false });
		const walkTex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = "#14243a"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(255,255,255,0.05)"; for (let i = 0; i < w; i += 32) c.fillRect(i, 0, 2, h); }, TW / 2, 1);
		const walkF = add(g, new THREE.PlaneGeometry(TW, 3.5), mat("#ffffff", 0.6, 0.1, { map: walkTex }), TX, 0.02, 0, { rx: -Math.PI / 2, cast: false });
		walkF.userData.floor = true;
		for (const z of [-1.76, 1.76]) add(g, new THREE.BoxGeometry(TW, 0.03, 0.05), neonC, TX, 0.04, z, { cast: false, receive: false });
		// a low rail each side (between the walkway and the glass there's sand, shells and little lights)
		for (const z of [-1.85, 1.85]) {
			add(g, new THREE.CylinderGeometry(0.025, 0.025, TW, 8), ribM, TX, 0.85, z, { rz: Math.PI / 2, cast: false });
			for (let i = 0; i <= 10; i++) add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), ribM, TANK.x0 + i * TW / 10, 0.42, z, { cast: false });
		}
		for (let i = 0; i < 24; i++) add(g, new THREE.SphereGeometry(0.03, 6, 4), glow(i % 2 ? "#7ff3ff" : "#ffd6f5"), TANK.x0 + 0.3 + R() * (TW - 0.6), 0.04, (R() < 0.5 ? -1 : 1) * (1.95 + R() * 0.25), { cast: false, receive: false });
	}
	// ---------------- the wall between the lobby and the tank (an arch where the tunnel goes in), and the gallery's glass
	const archShape = () => {
		const s = new THREE.Shape();
		s.moveTo(TANK.z0 - 0.05, 0); s.lineTo(-TR - 0.05, 0);
		s.absarc(0, 0, TR + 0.05, Math.PI, 0, true);
		s.lineTo(TANK.z1 + 0.05, 0); s.lineTo(TANK.z1 + 0.05, HC); s.lineTo(TANK.z0 - 0.05, HC); s.lineTo(TANK.z0 - 0.05, 0);
		return s;
	};
	const muralTex = canvasTex(1024, 256, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0e3d6b"); gr.addColorStop(1, "#071c33"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
		const r = rng(44);
		for (let i = 0; i < 26; i++) {
			const x = r() * w, y = 30 + r() * (h - 60), s = 6 + r() * 14;
			c.fillStyle = `hsla(${180 + r() * 160},80%,65%,0.6)`;
			c.beginPath(); c.ellipse(x, y, s * 1.7, s, 0, 0, TAU); c.fill();
			c.beginPath(); c.moveTo(x - s * 1.5, y); c.lineTo(x - s * 2.7, y - s); c.lineTo(x - s * 2.7, y + s); c.fill();
		}
	});
	muralTex.repeat.set(1 / 10.2, 1 / HC); muralTex.offset.set(0.56, 0);
	add(g, new THREE.ExtrudeGeometry(archShape(), { depth: 0.25, bevelEnabled: false, curveSegments: 24 }), mat("#ffffff", 0.8, 0, { map: muralTex }), TANK.x1 + 0.2, 0, 0, { ry: -Math.PI / 2, cast: false });
	add(g, new THREE.BoxGeometry(0.25, HB - HC, TANK.z1 - TANK.z0 + 0.1), intM, TANK.x1 + 0.08, (HB + HC) / 2, (TANK.z0 + TANK.z1) / 2, { cast: false });
	add(g, new THREE.TorusGeometry(TR + 0.08, 0.07, 8, 32, Math.PI), neonC, TANK.x1 + 0.22, 0, 0, { ry: Math.PI / 2, cast: false, receive: false });
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#a8e0ff", transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
	add(g, new THREE.ShapeGeometry(archShape(), 24), glassM, TANK.x0, 0, 0, { ry: -Math.PI / 2, cast: false, receive: false }).renderOrder = 3;
	add(g, new THREE.BoxGeometry(0.25, HB - HC, TANK.z1 - TANK.z0 + 0.1), intM, TANK.x0 - 0.12, (HB + HC) / 2, (TANK.z0 + TANK.z1) / 2, { cast: false });
	{
		const frameM = mat("#22384c", 0.4, 0.6);
		for (const z of [-5.0, -3.6, 2.9, 3.9]) add(g, new THREE.BoxGeometry(0.1, HC, 0.1), frameM, TANK.x0, HC / 2, z, { cast: false });
		add(g, new THREE.BoxGeometry(0.12, 0.12, TANK.z1 - TANK.z0), frameM, TANK.x0, HC - 0.06, (TANK.z0 + TANK.z1) / 2, { cast: false });
		add(g, new THREE.TorusGeometry(TR + 0.06, 0.06, 8, 32, Math.PI), neonC, TANK.x0 - 0.04, 0, 0, { ry: Math.PI / 2, cast: false, receive: false });
	}
	// ---------------- the lobby and the gallery: floors, ceilings with little glowing "plankton" dots
	const floorTex = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#0d2238"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "rgba(255,255,255,0.06)"; c.lineWidth = 2;
		for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); }
		c.strokeStyle = "rgba(95,225,255,0.18)"; c.lineWidth = 4;
		c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, 128 + Math.sin(x / w * TAU) * 30); c.stroke();
	}, 2, 3);
	const floorM = mat("#ffffff", 0.35, 0.15, { map: floorTex });
	const plankton = canvasTex(512, 512, (c, w, h) => { c.fillStyle = "#06152a"; c.fillRect(0, 0, w, h); const r = rng(8); for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "120,240,255" : "255,170,240"},${0.3 + r() * 0.6})`; c.beginPath(); c.arc(r() * w, r() * h, 1 + r() * 2.5, 0, TAU); c.fill(); } }, 2, 2);
	const ceilM = glow("#ffffff", { map: plankton });
	for (const [x0, x1] of [[TANK.x1 + 0.2, 11.45], [-11.45, TANK.x0]]) {
		const f = add(g, new THREE.PlaneGeometry(x1 - x0, 10.2), floorM, (x0 + x1) / 2, 0.0, -0.65, { rx: -Math.PI / 2, cast: false });
		f.userData.floor = true;
		add(g, new THREE.PlaneGeometry(x1 - x0, 10.2), ceilM, (x0 + x1) / 2, HC, -0.65, { rx: Math.PI / 2, cast: false, receive: false });
	}

	// ================================================================ the lobby: desk, fish column, show board and button
	{
		// the ticket desk (curved front, a glowing top edge)
		const desk = group(g, 10.2, 0, 3.3);
		add(desk, rbox(2.2, 1.05, 0.7, 0.08), mat("#0f4f78", 0.4, 0.3), 0, 0.52, 0);
		add(desk, rbox(2.3, 0.06, 0.8, 0.02), mat("#d9e6ee", 0.3, 0.6), 0, 1.07, 0);
		add(desk, new THREE.BoxGeometry(2.2, 0.04, 0.02), neonC, 0, 0.95, -0.36, { cast: false, receive: false });
		add(desk, new THREE.PlaneGeometry(1.6, 0.4), sign("Tickets", { w: 512, h: 128, color: "#ffffff", glow: "#3fd0ff", font: "800 96px 'Caveat', 'Nunito', cursive" }), 0, 0.6, -0.36, { ry: Math.PI, cast: false, receive: false });
		k.box(9.05, 11.35, 2.9, 3.7);
		// a glass column of little fish by the door
		const col = group(g, 10.6, 0, -4.4);
		add(col, new THREE.CylinderGeometry(0.55, 0.6, 0.35, 24), mat("#22384c", 0.4, 0.6), 0, 0.17, 0);
		add(col, new THREE.CylinderGeometry(0.55, 0.55, 0.3, 24), mat("#22384c", 0.4, 0.6), 0, 3.0, 0);
		add(col, new THREE.CylinderGeometry(0.5, 0.5, 2.5, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: "#7fd8ff", transparent: true, opacity: 0.35, roughness: 0.05, emissive: "#0f5a8a", emissiveIntensity: 0.8, depthWrite: false, side: THREE.DoubleSide }), 0, 1.6, 0, { cast: false, receive: false });
		var colFish = [];
		for (let i = 0; i < 6; i++) { const f = add(col, new THREE.SphereGeometry(0.06, 8, 6), glow(["#ffd166", "#ff7a59", "#7cf0ff"][i % 3]), 0, 1, 0, { cast: false, receive: false }); f.scale.set(1, 0.6, 1.8); colFish.push(f); }
		k.box(10.0, 11.2, -5.0, -3.8);
		// the show board (countdown) on the wall by the tunnel
		const boardC = document.createElement("canvas"); boardC.width = 512; boardC.height = 256;
		var boardTex = new THREE.CanvasTexture(boardC); boardTex.colorSpace = THREE.SRGBColorSpace;
		add(g, rbox(0.06, 1.05, 2.0, 0.03), mat("#0a1626", 0.5, 0.3), TANK.x1 + 0.26, 2.3, -3.5);
		add(g, new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }), TANK.x1 + 0.31, 2.3, -3.5, { ry: Math.PI / 2, cast: false, receive: false });
		var drawBoard = (a, b) => {
			const c = boardC.getContext("2d");
			if (!c) return;
			c.fillStyle = "#06152a"; c.fillRect(0, 0, 512, 256);
			c.textAlign = "center"; c.textBaseline = "middle";
			c.fillStyle = "#7ff3ff"; c.font = "800 44px Nunito, 'Segoe UI', sans-serif"; c.fillText("Feeding show", 256, 64);
			c.fillStyle = "#ffd166"; c.font = "900 76px Nunito, 'Segoe UI', sans-serif"; c.fillText(a, 256, 140);
			c.fillStyle = "#9bb8d3"; c.font = "700 30px Nunito, 'Segoe UI', sans-serif"; c.fillText(b, 256, 212);
			boardTex.needsUpdate = true;
		};
		// the big button
		const ped = group(g, 9.3, 0, -2.4);
		add(ped, rbox(0.5, 1.0, 0.5, 0.06), mat("#0f4f78", 0.4, 0.3), 0, 0.5, 0);
		add(ped, new THREE.CylinderGeometry(0.2, 0.22, 0.06, 24), mat("#d9e6ee", 0.3, 0.7), 0, 1.03, 0);
		var showBtn = add(ped, new THREE.CylinderGeometry(0.15, 0.15, 0.08, 24), new THREE.MeshStandardMaterial({ color: "#ffd166", emissive: "#ff9e2a", emissiveIntensity: 1.2 }), 0, 1.08, 0, { cast: false });
		add(ped, new THREE.PlaneGeometry(0.6, 0.15), sign("FEED THE FISH", { w: 1024, h: 256, color: "#ffffff", font: "900 130px Nunito, 'Segoe UI', sans-serif" }), 0, 0.82, 0.26, { cast: false, receive: false });
		k.box(9.0, 9.6, -2.7, -2.1);
		k.interact("aquarium:show", {
			label: () => { const S = showNow(); return S.on ? `The feeding show is on! (${Math.ceil(SHOW_LEN - S.u)}s left)` : `Start the feeding show (next one in ${mmss(S.next)})`; },
			stand: [9.3, -1.5], face: Math.PI, reach: 2.2,
			use: () => {
				const S = showNow();
				if (S.on) { ctx.notice("The feeding show is on right now - go and watch in the tunnel!"); return; }
				ctx.setShared("aquarium:show", Date.now());
				ctx.sfx("chime", 0.6);
			}
		}, ped);
	}

	// ================================================================ the gallery: benches facing the glass
	const benchWood = mat("#2f6f9a", 0.5, 0.1), benchIron = mat("#1b2a3a", 0.5, 0.5);
	[[-8.6, -3.7], [-8.6, 2.6], [-10.4, -3.7], [-10.4, 2.6]].forEach(([x, z], n) => {
		const h = Math.PI / 2;
		const b = group(g, x, 0, z, h);
		add(b, rbox(1.5, 0.07, 0.45, 0.02), benchWood, 0, 0.42, 0);
		add(b, rbox(1.5, 0.45, 0.06, 0.02), benchWood, 0, 0.72, -0.22, { rx: -0.12 });
		for (const sx of [-0.68, 0.68]) add(b, rbox(0.06, 0.42, 0.42, 0.02), benchIron, sx, 0.21, 0);
		const fx = Math.sin(h), fz = Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);
		const ids = [0, 1].map(i => { const id = "aqBench" + n + i, o = i ? 0.35 : -0.35; k.spot({ id, x: x + sx * o + fx * 0.05, z: z + sz * o + fz * 0.05, h, y: 0, stand: [x + sx * o + fx * 0.8, z + sz * o + fz * 0.8] }); return id; });
		k.box(x - 0.3, x + 0.3, z - 0.8, z + 0.8);
		k.interact("aquarium:bench" + n, { label: "Sit and watch the fish", stand: [x + fx * 0.75, z + fz * 0.75], sit: ids }, b);
	});
	// a little sign over the gallery
	add(g, new THREE.PlaneGeometry(3.2, 0.8), sign("The Deep", { color: "#bff6ff", glow: "#3fd0ff", font: "800 150px 'Caveat', 'Nunito', cursive" }), -11.42, 3.6, -0.6, { ry: Math.PI / 2, cast: false, receive: false });

	// ================================================================ the sea bed: rocks, corals, kelp, the treasure chest
	const inTank = (x, z) => x > TANK.x0 + 0.3 && x < TANK.x1 - 0.3 && z > TANK.z0 + 0.3 && z < TANK.z1 - 0.3 && Math.abs(z) > TR + 0.25;
	const bedSpot = () => { for (let n = 0; n < 40; n++) { const x = TANK.x0 + 0.4 + R() * (TW - 0.8), z = R() < 0.6 ? -(TR + 0.3 + R() * 3.0) : TR + 0.3 + R() * 1.7; if (inTank(x, z)) return [x, z]; } return [0, -4]; };
	{
		const rockM = mat("#4b5d70", 0.95, 0.05, { emissive: "#0b2a44", emissiveIntensity: 0.4 });
		for (let i = 0; i < 18; i++) { const [x, z] = bedSpot(), s = 0.25 + R() * 0.6; const r = add(g, new THREE.DodecahedronGeometry(s, 0), rockM, x, s * 0.4, z, { cast: false }); r.scale.set(1 + R() * 0.6, 0.6 + R() * 0.5, 1 + R() * 0.5); r.rotation.set(R(), R() * 3, R()); }
		const coralCols = ["#ff6f91", "#ffb347", "#c77dff", "#ff4d6d", "#7cf0ff", "#ffd166"];
		for (let i = 0; i < 22; i++) {
			const [x, z] = bedSpot(), c = coralCols[i % coralCols.length], kind = i % 4;
			const cm = mat(c, 0.7, 0, { emissive: c, emissiveIntensity: 0.25 });
			const cg = group(g, x, 0, z, R() * TAU);
			if (kind === 0) {           // branching coral
				for (let j = 0; j < 5; j++) add(cg, new THREE.CylinderGeometry(0.03, 0.06, 0.5 + R() * 0.4, 6), cm, (R() - 0.5) * 0.25, 0.3, (R() - 0.5) * 0.25, { rx: (R() - 0.5) * 0.9, rz: (R() - 0.5) * 0.9, cast: false });
			} else if (kind === 1) {    // brain coral
				add(cg, new THREE.SphereGeometry(0.28 + R() * 0.15, 14, 10, 0, TAU, 0, Math.PI / 2), cm, 0, 0, 0, { cast: false });
			} else if (kind === 2) {    // a sea fan
				add(cg, new THREE.CircleGeometry(0.45 + R() * 0.25, 18, 0, Math.PI), mat(c, 0.8, 0, { emissive: c, emissiveIntensity: 0.3, side: THREE.DoubleSide }), 0, 0.05, 0, { cast: false });
			} else {                     // an anemone
				add(cg, new THREE.CylinderGeometry(0.12, 0.16, 0.16, 12), cm, 0, 0.08, 0, { cast: false });
				for (let j = 0; j < 10; j++) { const a = j / 10 * TAU; add(cg, new THREE.CylinderGeometry(0.012, 0.02, 0.26, 4), cm, Math.sin(a) * 0.09, 0.27, Math.cos(a) * 0.09, { rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5, cast: false }); }
			}
		}
		// shells and starfish along the sand inside the tunnel's glass
		for (let i = 0; i < 10; i++) {
			const sf = new THREE.Shape();
			for (let j = 0; j <= 10; j++) { const a = j / 10 * TAU, r = j % 2 ? 0.05 : 0.12; sf[j ? "lineTo" : "moveTo"](Math.sin(a) * r, Math.cos(a) * r); }
			add(g, new THREE.ShapeGeometry(sf), mat(["#ff7a59", "#ffd166", "#ff9ebb"][i % 3], 0.8), TANK.x0 + 0.5 + R() * (TW - 1), 0.03, (R() < 0.5 ? -1 : 1) * (2.0 + R() * 0.2), { rx: -Math.PI / 2, cast: false, receive: false });
		}
	}
	// kelp: chains of segments, each bending a little more than the one below
	const kelp = [];
	{
		const km = mat("#3f8f4a", 0.8, 0, { emissive: "#1b5a2a", emissiveIntensity: 0.35, side: THREE.DoubleSide });
		for (let i = 0; i < 16; i++) {
			const [x, z] = bedSpot();
			let parent = group(g, x, 0, z, R() * TAU);
			const segs = [];
			const n = 4 + Math.floor(R() * 3), len = 0.55 + R() * 0.25;
			for (let j = 0; j < n; j++) {
				const s = group(parent, 0, j ? len : 0, 0);
				add(s, new THREE.CylinderGeometry(0.02, 0.03, len, 5), km, 0, len / 2, 0, { cast: false });
				add(s, new THREE.PlaneGeometry(0.18, len * 0.8), km, 0.09, len / 2, 0, { rz: -0.3, cast: false, receive: false });
				segs.push(s); parent = s;
			}
			kelp.push({ segs, ph: R() * 6 });
		}
	}
	// the treasure chest: it creaks open every now and then, glowing gold, in a rush of bubbles
	const chestG = group(g, CHEST.x, 0, CHEST.z, 0.4);
	let chestLid;
	{
		const woodM = mat("#6b3f22", 0.8), goldM = mat("#e0b85a", 0.3, 0.8, { emissive: "#7a5a10", emissiveIntensity: 0.4 });
		add(chestG, rbox(0.9, 0.45, 0.55, 0.03), woodM, 0, 0.23, 0);
		for (const x of [-0.3, 0.3]) add(chestG, new THREE.BoxGeometry(0.06, 0.47, 0.57), goldM, x, 0.23, 0, { cast: false });
		add(chestG, new THREE.BoxGeometry(0.8, 0.06, 0.45), glow("#ffd76a"), 0, 0.44, 0, { cast: false, receive: false });
		for (let i = 0; i < 8; i++) add(chestG, new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10), goldM, (R() - 0.5) * 0.7, 0.47 + R() * 0.04, (R() - 0.5) * 0.35, { rx: R(), cast: false });
		chestLid = group(chestG, 0, 0.45, -0.27);
		add(chestLid, new THREE.CylinderGeometry(0.275, 0.275, 0.9, 16, 1, false, 0, Math.PI), woodM, 0, 0, 0.275, { rz: Math.PI / 2, cast: false });
		for (const x of [-0.3, 0.3]) add(chestLid, new THREE.CylinderGeometry(0.285, 0.285, 0.06, 16, 1, false, 0, Math.PI), goldM, x, 0, 0.275, { rz: Math.PI / 2, cast: false });
	}
	const chestOpen = t => { const u = t % 22; return u < 1.2 ? smooth(u / 1.2) : u < 5 ? 1 : u < 6.2 ? 1 - smooth((u - 5) / 1.2) : 0; };

	// ================================================================ the fish: four kinds, in schools
	const fishGeo = (len, h, w) => {
		const body = new THREE.SphereGeometry(1, 10, 7); body.scale(w, h, len * 0.5);
		const tail = tri([0, 0, -len * 0.42], [0, h * 1.1, -len * 0.78], [0, -h * 1.1, -len * 0.78]);
		const fin = tri([0, h * 0.8, len * 0.1], [0, h * 1.5, -len * 0.15], [0, h * 0.8, -len * 0.3]);
		return merge([body, tail, fin]);
	};
	const KINDS = [
		{ geo: fishGeo(0.34, 0.12, 0.06), cols: ["#2f7bff", "#3f9bff", "#ffd23a"], n: 3, each: 9 },    // blue tangs
		{ geo: fishGeo(0.2, 0.07, 0.045), cols: ["#ff7a1a", "#ff8c2a"], n: 4, each: 6 },               // clownfish
		{ geo: fishGeo(0.24, 0.13, 0.03), cols: ["#ffe14a", "#fff07a"], n: 3, each: 7 },               // butterflyfish
		{ geo: fishGeo(0.15, 0.035, 0.025), cols: ["#c9d9e8", "#e8f3ff", "#a9c4dc"], n: 2, each: 26 } // sardines
	];
	const schools = [];
	const fishMeshes = [];
	KINDS.forEach((K, ki) => {
		const total = K.n * K.each;
		const im = new THREE.InstancedMesh(K.geo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.45, metalness: ki === 3 ? 0.7 : 0.1, emissive: "#0b2238", side: THREE.DoubleSide }), total);
		im.castShadow = false; im.frustumCulled = false;
		const col = new THREE.Color();
		for (let i = 0; i < total; i++) im.setColorAt(i, col.set(K.cols[i % K.cols.length]));
		g.add(im);
		fishMeshes.push(im);
		for (let s = 0; s < K.n; s++) {
			const offs = [];
			const spread = ki === 3 ? 0.55 : 0.4;
			for (let i = 0; i < K.each; i++) offs.push([(R() - 0.5) * spread * 2.2, (R() - 0.5) * spread, (R() - 0.5) * spread, R() * 6]);
			schools.push({
				im, base: s * K.each, offs,
				xc: 0.75, ax: 4.6 + R() * 0.9, w: (0.09 + R() * 0.07) * (R() < 0.5 ? 1 : -1), ph: R() * TAU,
				phc: 0.4 + R() * 2.3, pha: 0.15 + R() * 0.35, rr: 3.3 + R() * 0.35, q: R() * 6,
				ctr: new THREE.Vector3(), nxt: new THREE.Vector3(), quat: new THREE.Quaternion()
			});
		}
	});
	// where a school is: cruising up and down the tank and round over the tunnel (or crowding round the food)
	const _o3 = new THREE.Object3D(), _tmp = new THREE.Vector3();
	function schoolAt(S, t, f, out) {
		const s = S.w * t + S.ph;
		const x = S.xc + S.ax * Math.sin(s);
		const phi = Math.max(0.35, Math.min(2.8, S.phc + S.pha * Math.sin(s * 0.7 + S.q)));
		const r = S.rr + 0.2 * Math.sin(s * 1.3 + S.q);
		out.set(x, r * Math.sin(phi), r * Math.cos(phi));
		if (f > 0) {
			const a = t * 1.4 + S.q;
			_tmp.set(FOOD.x + Math.cos(a) * 0.9, FOOD.y + Math.sin(a * 0.7) * 0.3, FOOD.z + Math.sin(a) * 0.6);
			out.lerp(_tmp, f);
		}
		return out;
	}

	// ================================================================ the big swimmers: sharks, a manta, a turtle, jellyfish
	function makeShark() {
		const sg = group(g, 0, 2, -3);
		const skin = mat("#6f8597", 0.55, 0.15, { emissive: "#0d2033", emissiveIntensity: 0.5 }), belly = mat("#d9e2ea", 0.6);
		const body = add(sg, new THREE.SphereGeometry(1, 18, 12), skin, 0, 0, 0, { cast: false }); body.scale.set(0.3, 0.33, 1.25);
		const bel = add(sg, new THREE.SphereGeometry(1, 14, 8), belly, 0, -0.07, 0.05, { cast: false }); bel.scale.set(0.26, 0.24, 1.1);
		const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-0.3, 0.55); fin.lineTo(-0.45, 0); fin.lineTo(0, 0);
		add(sg, new THREE.ExtrudeGeometry(fin, { depth: 0.04, bevelEnabled: false }), skin, -0.02, 0.27, 0.15, { ry: -Math.PI / 2, cast: false });
		for (const sx of [-1, 1]) { const p = add(sg, new THREE.ConeGeometry(0.14, 0.6, 4), skin, sx * 0.33, -0.12, 0.25, { cast: false }); p.rotation.set(0.9, 0, sx * 1.25); p.scale.set(1, 1, 0.25); }
		for (const sx of [-1, 1]) add(sg, new THREE.SphereGeometry(0.035, 8, 6), glow("#050505"), sx * 0.17, 0.08, 0.95, { cast: false, receive: false });
		const tail = group(sg, 0, 0, -1.15);
		const tf = new THREE.Shape(); tf.moveTo(0, 0); tf.lineTo(-0.5, 0.55); tf.lineTo(-0.38, 0); tf.lineTo(-0.35, -0.3); tf.lineTo(0, 0);
		add(tail, new THREE.ExtrudeGeometry(tf, { depth: 0.04, bevelEnabled: false }), skin, -0.02, 0, 0.05, { ry: -Math.PI / 2, cast: false });
		const st = add(tail, new THREE.ConeGeometry(0.12, 0.5, 8), skin, 0, 0, 0.2, { rx: -Math.PI / 2, cast: false });
		return { g: sg, tail };
	}
	const sharks = [makeShark(), makeShark()];
	sharks[0].w = 0.085; sharks[0].R = 3.55; sharks[0].ph = 0;
	sharks[1].w = -0.07; sharks[1].R = 3.85; sharks[1].ph = 2.4;
	const sharkAt = (S, t, f, out) => {
		const th = S.w * t + S.ph;
		const phi = Math.PI / 2 + 1.12 * Math.sin(th) + 0.5 * f;
		return out.set(0.75 + 5.6 * Math.cos(th), S.R * Math.sin(Math.min(2.75, phi)), S.R * Math.cos(Math.min(2.75, phi)));
	};
	// the manta: a flat diamond with two wings that beat slowly
	const manta = group(g, 0, 3.6, 0);
	const mantaWings = [];
	{
		const mm = mat("#2c3e57", 0.6, 0.1, { emissive: "#0c1f33", emissiveIntensity: 0.5, side: THREE.DoubleSide });
		add(manta, new THREE.SphereGeometry(1, 14, 8), mm, 0, 0, 0, { cast: false }).scale.set(0.3, 0.09, 0.6);
		for (const sx of [-1, 1]) {
			const wg = group(manta, sx * 0.2, 0, 0);
			const s = new THREE.Shape(); s.moveTo(0, 0.5); s.lineTo(sx * 1.25, -0.05); s.lineTo(0, -0.5); s.lineTo(0, 0.5);
			add(wg, new THREE.ShapeGeometry(s), mm, 0, 0, 0, { rx: -Math.PI / 2, cast: false });
			mantaWings.push({ wg, sx });
		}
		add(manta, new THREE.CylinderGeometry(0.01, 0.025, 1.1, 5), mm, 0, 0, -0.95, { rx: Math.PI / 2, cast: false });
		for (const sx of [-0.15, 0.15]) add(manta, new THREE.ConeGeometry(0.05, 0.22, 5), mm, sx, 0, 0.62, { rx: Math.PI / 2, cast: false });
	}
	const mantaAt = (t, out) => { const th = t * 0.06 + 1; const phi = Math.PI / 2 + 0.5 * Math.cos(th * 1.5); return out.set(0.75 + 5.2 * Math.sin(th), 4.05 * Math.sin(phi), 4.05 * Math.cos(phi) - 0.2); };
	// the turtle
	const turtle = group(g, 0, 1.2, -4.2);
	const flippers = [];
	{
		const shellM = mat("#5c7a3a", 0.7, 0, { emissive: "#1f3311", emissiveIntensity: 0.4 }), skinM = mat("#9ab27a", 0.7);
		add(turtle, new THREE.SphereGeometry(1, 16, 10), shellM, 0, 0, 0, { cast: false }).scale.set(0.42, 0.16, 0.5);
		add(turtle, new THREE.SphereGeometry(0.11, 12, 8), skinM, 0, 0.02, 0.56, { cast: false });
		for (const [sx, sz, big] of [[-1, 0.25, 1], [1, 0.25, 1], [-1, -0.32, 0], [1, -0.32, 0]]) {
			const fg = group(turtle, sx * 0.36, 0, sz);
			const f = add(fg, new THREE.SphereGeometry(1, 10, 6), skinM, sx * (big ? 0.2 : 0.1), 0, 0, { cast: false });
			f.scale.set(big ? 0.25 : 0.12, 0.03, big ? 0.09 : 0.07);
			flippers.push({ fg, sx, big });
		}
	}
	const turtleAt = (t, out) => { const th = t * 0.045; return out.set(0.75 + 5.0 * Math.sin(th), 1.25 + 0.55 * Math.sin(th * 2.3), -4.1 + 0.45 * Math.cos(th * 2)); };
	// jellyfish: soft glowing bells that pulse, with tentacles trailing
	const jellies = [];
	{
		const jc = ["#ff8fe0", "#9f8bff", "#7ff3ff", "#ffb3d1", "#bfa8ff", "#8ff7d6", "#ff9ebb"];
		const spots = [[-5.4, -4.4], [-3.6, -3.6], [-1.2, -4.8], [3.9, -4.6], [6.4, -3.7], [-4.3, 3.5], [5.2, 3.4]];
		spots.forEach(([x, z], i) => {
			const jg = group(g, x, 2.5, z);
			const bellM = new THREE.MeshStandardMaterial({ color: jc[i], emissive: jc[i], emissiveIntensity: 1.1, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
			const bell = add(jg, new THREE.SphereGeometry(0.26, 18, 10, 0, TAU, 0, Math.PI / 2), bellM, 0, 0, 0, { cast: false, receive: false });
			bell.renderOrder = 2;
			add(jg, new THREE.SphereGeometry(0.09, 10, 8), glow(jc[i]), 0, 0.06, 0, { cast: false, receive: false });
			const tents = [];
			const tm = new THREE.MeshBasicMaterial({ color: jc[i], transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
			for (let j = 0; j < 7; j++) { const a = j / 7 * TAU; const tg = group(jg, Math.sin(a) * 0.17, 0, Math.cos(a) * 0.17); add(tg, new THREE.CylinderGeometry(0.006, 0.012, 0.9 + R() * 0.5, 4), tm, 0, -0.5, 0, { cast: false, receive: false }); tents.push(tg); }
			jellies.push({ jg, bell, tents, y0: 1.6 + R() * 1.8, ph: R() * 6, x, z });
		});
	}

	// ================================================================ the feeding show: a diver, and food drifting down
	const diver = group(g, FOOD.x, 6, FOOD.z - 0.8);
	diver.visible = false;
	const diverFlip = [];
	let diverArm;
	{
		const suit = mat("#14161c", 0.6, 0.1), tankM = mat("#ffd166", 0.35, 0.6), maskM = new THREE.MeshPhysicalMaterial({ color: "#a8e0ff", transparent: true, opacity: 0.5, roughness: 0.05 });
		const body = group(diver, 0, 0, 0);
		add(body, new THREE.CapsuleGeometry(0.17, 0.75, 6, 12), suit, 0, 0, 0, { rx: Math.PI / 2, cast: false });
		add(body, new THREE.SphereGeometry(0.15, 14, 10), suit, 0, 0.05, 0.62, { cast: false });
		add(body, new THREE.BoxGeometry(0.2, 0.1, 0.06), maskM, 0, 0.06, 0.76, { cast: false });
		add(body, new THREE.CylinderGeometry(0.1, 0.1, 0.55, 12), tankM, 0, 0.22, -0.05, { rx: Math.PI / 2, cast: false });
		for (const sx of [-0.09, 0.09]) {
			const fg = group(body, sx, 0, -0.55);
			add(fg, new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), suit, 0, 0, -0.2, { rx: Math.PI / 2, cast: false });
			add(fg, new THREE.BoxGeometry(0.16, 0.02, 0.32), mat("#ff7a1a", 0.6), 0, 0, -0.55, { cast: false });
			diverFlip.push(fg);
		}
		diverArm = group(body, 0.2, 0, 0.35);
		add(diverArm, new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), suit, 0, -0.2, 0, { cast: false });
		add(diverArm, new THREE.CylinderGeometry(0.07, 0.06, 0.12, 10), mat("#e6f0f5", 0.5), 0, -0.45, 0, { cast: false });
	}
	// the show's schedule: every SHOW_EVERY seconds on the clock, or started now from the lobby button (shared)
	function showNow() {
		const now = Date.now() / 1000;
		const sched = Math.floor(now / SHOW_EVERY) * SHOW_EVERY;
		const pk = ctx.get("aquarium:show"), pressed = typeof pk === "number" && isFinite(pk) && pk / 1000 <= now + 2 ? pk / 1000 : -1e12;
		// (a show started from the button runs its whole minute: a slot on the clock that comes up meanwhile is skipped)
		const start = now - pressed < SHOW_LEN ? pressed : Math.max(sched, pressed);
		const u = now - start;
		const on = u >= 0 && u < SHOW_LEN;
		const next = on ? 0 : sched + SHOW_EVERY - now;
		return { on, u, next };
	}
	const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

	// ================================================================ bubbles (vents, the chest, the diver) and fish food
	const NB = 240, NBV = 160, NBC = 50;   // (vent bubbles, then the chest's, then the diver's)
	const VENTS = [[-5.2, -4.8], [-2.0, 3.2], [0.4, -5.1], [4.6, 3.4], [6.8, -2.9]];
	const bubGeo = new THREE.BufferGeometry();
	const bubPos = new Float32Array(NB * 3), bub = [];
	for (let i = 0; i < NB; i++) { bub.push({ y: R() * TANK.top, v: 0.35 + R() * 0.5, ph: R() * 6, vent: i % VENTS.length, ox: (R() - 0.5) * 0.25, oz: (R() - 0.5) * 0.25 }); }
	bubGeo.setAttribute("position", new THREE.BufferAttribute(bubPos, 3));
	const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ size: 0.07, map: dot, color: "#d8f6ff", transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
	bubbles.frustumCulled = false; bubbles.renderOrder = 2;
	g.add(bubbles);
	const NF = 60;
	const foodGeo = new THREE.BufferGeometry(), foodPos = new Float32Array(NF * 3), food = [];
	for (let i = 0; i < NF; i++) food.push({ age: R() * 6, dx: (R() - 0.5) * 1.6, dz: (R() - 0.5) * 1.0 });
	foodGeo.setAttribute("position", new THREE.BufferAttribute(foodPos, 3));
	const foodPts = new THREE.Points(foodGeo, new THREE.PointsMaterial({ size: 0.05, map: dot, color: "#ffcf8a", transparent: true, depthWrite: false, toneMapped: false }));
	foodPts.frustumCulled = false; foodPts.visible = false; foodPts.renderOrder = 2;
	g.add(foodPts);

	// ================================================================ lights: blue from the water, a little warmth in the lobby
	const L = {
		lobby: k.light(9.9, 3.9, 0.2, "#bfe6ff", 4.5, 8),
		desk: k.light(10.2, 2.6, 2.6, "#ffd9b0", 1.8, 4),
		t1: k.light(5.2, 1.8, 0, "#4fb3ff", 3.2, 6),
		t2: k.light(-0.2, 1.8, 0, "#4fb3ff", 3.2, 6),
		t3: k.light(-4.6, 1.8, 0, "#5fc8ff", 3.0, 6),
		deep: k.light(1.0, 4.3, -3.8, "#7fe0ff", 4.0, 9),
		gallery: k.light(-9.3, 3.6, -0.6, "#6fc3ff", 3.6, 8)
	};
	k.key.pos.copy(k.V(0.75, TANK.top - 0.1, -0.6)); k.key.target.copy(k.V(0.75, 0, -0.6));
	k.key.angle = 1.25; k.key.distance = 16; k.key.intensity = 16; k.key.color.set("#9fdcff"); k.key.penumbra = 0.9;
	k.fill.pos.copy(k.V(0, 3.5, 0)); k.fill.intensity = 3; k.fill.distance = 22; k.fill.color.set("#6fb8ff");
	k.hemi = 0.25; k.env = 0.15; k.exposure = 1.0;

	// ================================================================ every frame
	const inside = () => { const m = ctx.me(); return m.x > -31 && m.x < -7.6 && m.z > -19.6 && m.z < -8.9; };
	const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _w = new THREE.Quaternion(), _wq = new THREE.Quaternion();
	const inner = new THREE.Group();
	g.add(inner);
	[...g.children].forEach(c => { if (!shellKids.has(c) && c !== inner) inner.add(c); });
	// (me: world coordinates; the door is at world (-7.6, -13.6)) - and wherever the camera is looking in from
	const near = () => {
		const m = ctx.me(), c = ctx.camera && ctx.camera.position;
		if (inside() || Math.hypot(m.x + 7.6, m.z + 13.6) < 10) return true;
		return !!c && c.x > -31.5 && c.x < -4 && c.z > -20 && c.z < -8.5 && c.y < HB;
	};
	let boardT = 9, sfxT = 3, wasOn = null, prevChest = 0;
	function update(dt, t) {
		const now = Date.now() / 1000, tt = now % 100000;   // (the clock, kept small; everyone's fish are in the same place)
		const S = showNow();
		facadeNeon.opacity = 0.75 + 0.25 * Math.sin(t * 2.3);
		inner.visible = near();
		if (!inner.visible) { wasOn = S.on; return; }
		const f = S.on ? smooth(S.u / 6) * (1 - smooth((S.u - SHOW_LEN + 9) / 8)) : 0;
		// the caustics, the surface and the light rays shimmer
		caustic.offset.set((tt * 0.021) % 1, (tt * 0.013) % 1);
		ripple.offset.set((tt * 0.01) % 1, (-tt * 0.007) % 1);
		rays.forEach(r => { r.material.opacity = 0.22 + 0.18 * Math.sin(tt * 0.6 + r.userData.ph); });
		L.deep.intensity = L.deep.base * (0.85 + 0.15 * Math.sin(tt * 1.7));
		L.t2.intensity = L.t2.base * (0.9 + 0.1 * Math.sin(tt * 1.3 + 1));
		// fish
		for (const Sc of schools) {
			schoolAt(Sc, tt, f, Sc.ctr);
			schoolAt(Sc, tt + 0.15, f, Sc.nxt);
			_o3.position.copy(Sc.ctr); _o3.lookAt(Sc.nxt); Sc.quat.copy(_o3.quaternion);
			for (let i = 0; i < Sc.offs.length; i++) {
				const o = Sc.offs[i];
				_p.set(o[0] + Math.sin(tt * 1.1 + o[3]) * 0.08, o[1] + Math.sin(tt * 1.7 + o[3]) * 0.05, o[2] + Math.cos(tt * 1.3 + o[3]) * 0.08).applyQuaternion(Sc.quat);
				_o3.position.copy(Sc.ctr).add(_p);
				_o3.quaternion.copy(Sc.quat);
				_o3.rotateY(Math.sin(tt * 9 + o[3]) * 0.18);   // (the tail flick, as a wiggle)
				_o3.updateMatrix();
				Sc.im.setMatrixAt(Sc.base + i, _o3.matrix);
			}
		}
		fishMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
		// sharks, manta, turtle
		for (const sh of sharks) {
			sharkAt(sh, tt, f, _p); sharkAt(sh, tt + 0.3, f, _q);
			sh.g.position.copy(_p); sh.g.lookAt(g.localToWorld(_q));
			sh.tail.rotation.y = Math.sin(tt * 2.6 + sh.ph) * 0.35;
		}
		mantaAt(tt, _p); mantaAt(tt + 0.3, _q);
		manta.position.copy(_p); manta.lookAt(g.localToWorld(_q));
		mantaWings.forEach(w => { w.wg.rotation.z = w.sx * Math.sin(tt * 1.3) * 0.35; });
		turtleAt(tt, _p); turtleAt(tt + 0.3, _q);
		turtle.position.copy(_p); turtle.lookAt(g.localToWorld(_q));
		flippers.forEach(fl => { fl.fg.rotation.z = fl.sx * Math.sin(tt * (fl.big ? 1.6 : 1.6) + (fl.big ? 0 : 1)) * (fl.big ? 0.5 : 0.3); });
		// jellyfish
		jellies.forEach((j, i) => {
			const p = Math.sin(tt * 2.2 + j.ph);
			j.jg.position.set(j.x + Math.sin(tt * 0.13 + j.ph) * 0.4, j.y0 + Math.sin(tt * 0.35 + j.ph) * 0.45 + p * 0.04, j.z);
			j.bell.scale.set(1 - p * 0.12, 1 + p * 0.2, 1 - p * 0.12);
			j.tents.forEach((tg, n) => { tg.rotation.x = Math.sin(tt * 1.4 + n + j.ph) * 0.18; tg.rotation.z = Math.cos(tt * 1.1 + n) * 0.15; });
		});
		// kelp sways
		kelp.forEach(kp => kp.segs.forEach((s, j) => { s.rotation.z = Math.sin(tt * 0.8 + kp.ph + j * 0.6) * 0.09; s.rotation.x = Math.cos(tt * 0.6 + kp.ph + j * 0.5) * 0.06; }));
		// the little fish in the lobby column
		colFish.forEach((fi, i) => { const a = tt * (0.5 + i * 0.08) + i; fi.position.set(Math.sin(a) * 0.3, 0.7 + ((i * 0.37 + Math.sin(tt * 0.3 + i) * 0.2 + 2) % 1) * 1.8, Math.cos(a) * 0.3); fi.rotation.y = a + Math.PI / 2; });
		// the chest
		const co = chestOpen(tt);
		chestLid.rotation.x = -co * 1.1;
		// bubbles
		for (let i = 0; i < NB; i++) {
			const b = bub[i];
			let ex, ez, ey0 = 0.15, on = true;
			if (i < NBV) { ex = VENTS[b.vent][0]; ez = VENTS[b.vent][1]; }
			else if (i < NBV + NBC) { ex = CHEST.x; ez = CHEST.z; ey0 = 0.5; on = co > 0.3; }
			else { ex = diver.position.x; ez = diver.position.z + 0.6; ey0 = diver.position.y + 0.1; on = diver.visible; }
			if (!on) b.y = -9;
			else {
				if (b.y < ey0 - 0.5) b.y = ey0 + Math.random() * 0.4;
				b.y += b.v * dt;
				if (b.y > TANK.top - 0.05) b.y = ey0 + Math.random() * 0.2;
			}
			bubPos[i * 3] = ex + b.ox + Math.sin(tt * 2.1 + b.ph) * 0.06;
			bubPos[i * 3 + 1] = b.y;
			bubPos[i * 3 + 2] = ez + b.oz + Math.cos(tt * 1.7 + b.ph) * 0.06;
		}
		bubGeo.attributes.position.needsUpdate = true;
		// the diver and the food
		diver.visible = S.on;
		foodPts.visible = S.on && S.u > 7 && S.u < SHOW_LEN - 6;
		if (S.on) {
			const u = S.u, down = smooth(u / 8) * (1 - smooth((u - SHOW_LEN + 9) / 8));
			diver.position.set(FOOD.x + Math.sin(u * 0.3) * 0.4, TANK.top + 1.0 - (TANK.top + 1.0 - 3.1) * down, FOOD.z - 0.9);
			diver.rotation.set(-0.5 * (1 - down) - 0.15, Math.PI * 0.5 + Math.sin(u * 0.2) * 0.3, 0);
			diverFlip.forEach((fl, i) => { fl.rotation.x = Math.sin(u * 5 + i * Math.PI) * 0.35; });
			diverArm.rotation.x = Math.sin(u * 3) * 0.5;
			if (foodPts.visible) {
				for (let i = 0; i < NF; i++) {
					const fd = food[i];
					fd.age += dt * 0.8;
					if (fd.age > 4) { fd.age = 0; fd.dx = (Math.random() - 0.5) * 1.6; fd.dz = (Math.random() - 0.5) * 1.0; }
					foodPos[i * 3] = diver.position.x + fd.dx * fd.age * 0.3;
					foodPos[i * 3 + 1] = diver.position.y - 0.2 - fd.age * 0.25;
					foodPos[i * 3 + 2] = diver.position.z + 0.6 + fd.dz * fd.age * 0.3;
				}
				foodGeo.attributes.position.needsUpdate = true;
			}
		}
		showBtn.material.emissiveIntensity = S.on ? 0.3 : 0.9 + 0.6 * Math.sin(t * 4);
		// the board, a few times a second
		boardT += dt;
		if (boardT > 0.5) {
			boardT = 0;
			if (S.on) drawBoard("ON NOW!", `${Math.ceil(SHOW_LEN - S.u)}s left - in the tunnel`);
			else drawBoard(mmss(S.next), "or press the button to feed them now");
		}
		// sounds and news, while you're in here
		const inn = inside();
		if (wasOn !== null && S.on && !wasOn && inn) { ctx.notice("The feeding show is starting! The diver is going in - watch from the tunnel."); ctx.sfx("splash", 0.5); ctx.sfx("chime", 0.5); }
		if (wasOn && !S.on && inn) ctx.sfx("applause", 0.35);
		wasOn = S.on;
		if (inn) {
			sfxT -= dt;
			if (sfxT <= 0) { ctx.sfx("bubble", 0.12); sfxT = 3 + Math.random() * 4; }
			if (co > 0.05 && prevChest <= 0.05) { ctx.sfx("creak", 0.3); ctx.sfx("bubble", 0.3); }
		}
		prevChest = co;
	}

	return {
		update,
		onEnter() {
			const S = showNow();
			ctx.notice(S.on ? "Welcome to the Aquarium! The feeding show is on right now - into the tunnel!" : `Welcome to the Aquarium! The next feeding show is in <b>${mmss(S.next)}</b> (or press the button in the lobby).`);
		}
	};
}
