/**
 * Harmony World — the music room: the house's north-east corner, off the Gallery (the door in its south wall).
 *
 * World coordinates: inside x 23.35..33.4, z 12.42..24.4, 3.4 m high. Windows on the north and east walls.
 * Photo frames 79..82 (your own photos).
 *   a little stage in the corner with a microphone under a spotlight, a drum kit and a guitar amp, a black grand piano,
 *   guitars on stands, a DJ booth whose records spin and whose lights dance while someone's at it, a sofa for two,
 *   acoustic panels on the walls, a neon sign
 */
import { WING, HALL_DOORS, windowsOf } from "./worldEstate.js";

const [X0, X1, Z0, Z1] = WING.music;
const H = 3.4;
const DOOR = HALL_DOORS.music;   // (x: in its low-z wall, onto the Gallery)
const STAGE = { x0: X1 - 4.2, x1: X1, z0: Z1 - 3.4, z1: Z1, h: 0.3 };

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, tex, canvasTex, rng } = k;
	const R = rng(6161);
	k.room({
		x0: X0, x1: X1, z0: Z0, z1: Z1, h: H,
		floor: mat("#ffffff", 0.5, 0, { map: tex.wood(["#3b2a22", "#45322a", "#33241d", "#4b382e"], 1, 1, 51) }),
		ceil: mat("#22202a", 0.95),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#2d2a3a", "panel", "rgba(199,125,255,0.08)", 1, 1) }),
		trim: mat("#c77dff", 0.5),
		depth: { n: 0.22, s: 0.3, w: 0.4, e: 0.3 },
		holes: [{ wall: "n", a: DOOR[0], b: DOOR[1], y1: 2.4 }].concat(windowsOf(WING.music))
	});
	// the stage is a step up
	k.floor((x, z) => (x > STAGE.x0 && z > STAGE.z0 ? STAGE.h : 0));
	k.walk(X0, X1, Z0, Z1);
	k.walk(DOOR[0], DOOR[1], Z0 - 1.0, Z0 + 1.0);
	k.cam = { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2, maxY: H - 0.25 };
	// French doors onto the Gallery, the curtains on the room's side
	const DM = (DOOR[0] + DOOR[1]) / 2;
	k.frenchDoor("musicDoor", { x: DM, z: Z0 - 0.11, ry: Math.PI, w: DOOR[1] - DOOR[0] - 0.04, h: 2.4, depth: 0.3, side: -1, curtain: "#5a3d7a" }, [DOOR[0], DOOR[1], Z0 - 0.22, Z0], [[DM, Z0 + 0.9], [DM, Z0 - 1.2]]);

	const black = new THREE.MeshPhysicalMaterial({ color: "#0e0e10", roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
	const chrome = mat("#d9dde2", 0.18, 1), dark = mat("#1d1b22", 0.6);
	// ---------------------------------------------------------------- the stage: a mic under a spotlight, drums, an amp
	{
		add(g, new THREE.BoxGeometry(STAGE.x1 - STAGE.x0, STAGE.h, STAGE.z1 - STAGE.z0), mat("#3a2f4a", 0.7), (STAGE.x0 + STAGE.x1) / 2, STAGE.h / 2, (STAGE.z0 + STAGE.z1) / 2, { cast: false }).userData.floor = true;
		add(g, new THREE.BoxGeometry(STAGE.x1 - STAGE.x0, 0.04, 0.06), mat("#c77dff", 0.4, 0, { emissive: "#c77dff", emissiveIntensity: 0.8 }), (STAGE.x0 + STAGE.x1) / 2, STAGE.h, STAGE.z0 + 0.03, { cast: false });
		const mic = group(g, STAGE.x0 + 1.6, STAGE.h, STAGE.z0 + 1.1);
		add(mic, new THREE.CylinderGeometry(0.15, 0.17, 0.03, 20), dark, 0, 0.015, 0);
		add(mic, new THREE.CylinderGeometry(0.012, 0.012, 1.45, 8), chrome, 0, 0.74, 0);
		add(mic, new THREE.SphereGeometry(0.04, 12, 10), mat("#9a9a9a", 0.3, 0.8), 0, 1.5, -0.05, { cast: false });
		k.interact("music:mic", { label: "Sing into the microphone", stand: [STAGE.x0 + 1.6, STAGE.z0 + 1.55], face: Math.PI, use: () => { ctx.doUpper("cheer", 2500); ctx.sfx("switch", 0.4); } }, mic);
		// the drum kit
		const dk = group(g, STAGE.x0 + 2.9, STAGE.h, Z1 - 1.4, Math.PI);
		const shell = mat("#b5172e", 0.3, 0.3), skin = mat("#f4efe6", 0.6);
		add(dk, new THREE.CylinderGeometry(0.28, 0.28, 0.4, 24), shell, 0, 0.3, 0.35, { rx: Math.PI / 2 });
		add(dk, new THREE.CircleGeometry(0.27, 24), skin, 0, 0.3, 0.56, { cast: false });
		for (const [x, y, r] of [[-0.35, 0.65, 0.16], [0.35, 0.65, 0.16], [0.55, 0.45, 0.2]]) { add(dk, new THREE.CylinderGeometry(r, r, 0.2, 20), shell, x, y, 0.1); add(dk, new THREE.CylinderGeometry(r - 0.01, r - 0.01, 0.01, 20), skin, x, y + 0.105, 0.1, { cast: false }); }
		for (const [x, y] of [[-0.65, 1.0], [0.75, 1.05]]) { add(dk, new THREE.CylinderGeometry(0.01, 0.01, y, 6), chrome, x, y / 2, -0.1, { cast: false }); add(dk, new THREE.CylinderGeometry(0.22, 0.22, 0.01, 24), mat("#d4a84b", 0.25, 0.9), x, y, -0.1, { rz: 0.15, cast: false }); }
		add(dk, rbox(0.34, 0.08, 0.3, 0.03), dark, 0, 0.5, -0.45);
		k.spot({ id: "musicDrums", x: STAGE.x0 + 2.9, z: Z1 - 0.95, h: Math.PI, y: STAGE.h + 0.02 });
		k.interact("music:drums", { label: "Play the drums", stand: [STAGE.x0 + 2.4, Z1 - 0.95], sit: ["musicDrums"] }, dk);
		k.box(STAGE.x0 + 2.2, STAGE.x0 + 3.6, Z1 - 2.1, Z1 - 1.0);
		const amp = group(g, X1 - 0.45, STAGE.h, STAGE.z0 + 0.6, -Math.PI / 2);
		add(amp, rbox(0.7, 0.75, 0.35, 0.03), dark, 0, 0.375, 0);
		add(amp, new THREE.PlaneGeometry(0.6, 0.5), mat("#3a3530", 0.9), 0, 0.33, 0.18, { cast: false });
		k.box(X1 - 0.65, X1, STAGE.z0 + 0.2, STAGE.z0 + 1.0);
	}

	// ---------------------------------------------------------------- the grand piano
	{
		const p = group(g, X0 + 2.2, 0, Z1 - 2.3, Math.PI * 0.85);
		const shape = new THREE.Shape();
		shape.moveTo(-0.75, 0); shape.lineTo(0.75, 0); shape.lineTo(0.75, -0.9); shape.bezierCurveTo(0.75, -1.8, 0.1, -1.4, -0.2, -2.0); shape.lineTo(-0.75, -2.0); shape.closePath();
		const body = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
		body.rotateX(Math.PI / 2);
		add(p, body, black, 0, 1.0, 0);
		add(p, rbox(1.5, 0.04, 0.3, 0.01), mat("#f8f6f0", 0.3), 0, 0.75, 0.12, { cast: false });
		for (let i = 0; i < 18; i++) add(p, new THREE.BoxGeometry(0.03, 0.02, 0.16), black, -0.65 + i * 0.077, 0.78, 0.08, { cast: false });
		for (const [x, z] of [[-0.6, -0.15], [0.6, -0.15], [-0.3, -1.8]]) add(p, new THREE.CylinderGeometry(0.05, 0.04, 0.72, 10), black, x, 0.36, z);
		const lid = add(p, new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }), black, 0.75, 1.02, 0, { rz: 0.6, cast: false });
		lid.rotation.set(Math.PI / 2, 0, 0); lid.rotateY(0.55); lid.position.set(0.75, 1.0, 0);
		add(p, rbox(0.7, 0.06, 0.35, 0.02), black, 0, 0.5, 0.65);
		k.spot({ id: "musicPiano", x: X0 + 2.2 + Math.sin(Math.PI * 0.85) * 0.68, z: Z1 - 2.3 + Math.cos(Math.PI * 0.85) * 0.68, h: Math.PI * 0.85 + Math.PI, y: 0.02 });
		k.interact("music:piano", { label: "Sit at the grand piano", stand: [X0 + 2.2 + Math.sin(Math.PI * 0.85) * 1.3, Z1 - 2.3 + Math.cos(Math.PI * 0.85) * 1.3], sit: ["musicPiano"] }, p);
		k.box(X0 + 1.1, X0 + 3.3, Z1 - 2.6, Z1 - 0.2);
	}

	// ---------------------------------------------------------------- guitars on stands, the DJ booth, the sofa
	const records = [], bars = [];
	{
		const woods = ["#c8823a", "#7a1d33", "#2b4c7e"];
		woods.forEach((c, i) => {
			const gt = group(g, X0 + 0.5, 0, Z0 + 1.8 + i * 0.7, Math.PI / 2);
			add(gt, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), dark, 0, 0.25, 0, { cast: false });
			const b1 = add(gt, new THREE.SphereGeometry(0.22, 16, 12), mat(c, 0.35), 0, 0.55, 0.06); b1.scale.set(1, 1.15, 0.35);
			const b2 = add(gt, new THREE.SphereGeometry(0.17, 16, 12), mat(c, 0.35), 0, 0.85, 0.06); b2.scale.set(1, 1, 0.35);
			add(gt, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), dark, 0, 0.62, 0.14, { rx: Math.PI / 2, cast: false });
			add(gt, rbox(0.06, 0.6, 0.03, 0.01), mat("#3b2a1e", 0.5), 0, 1.3, 0.06, { cast: false });
			k.box(X0 + 0.25, X0 + 0.75, Z0 + 1.55 + i * 0.7, Z0 + 2.05 + i * 0.7);
			k.interact("music:guitar" + i, { label: "Play a riff on the guitar", stand: [X0 + 1.35, Z0 + 1.8 + i * 0.7], face: -Math.PI / 2, use: () => { ctx.doUpper("cheer", 2500); ctx.sfx("pop", 0.3); } }, gt);
		});
		// the DJ booth by the east windows
		const dj = group(g, X1 - 0.8, 0, Z0 + 1.85, -Math.PI / 2);
		add(dj, rbox(1.8, 1.0, 0.7, 0.04), dark, 0, 0.5, 0);
		add(dj, new THREE.PlaneGeometry(1.7, 0.5), mat("#ffffff", 0.6, 0, { map: canvasTex(512, 160, (c, w, h) => { c.fillStyle = "#14121a"; c.fillRect(0, 0, w, h); c.font = "900 90px 'Nunito', sans-serif"; c.fillStyle = "#c77dff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("DJ", w / 2, h / 2 + 4); }) }), 0, 0.55, 0.355, { cast: false });
		for (const sx of [-0.5, 0.5]) {
			add(dj, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), mat("#2b2b33", 0.4, 0.6), sx, 1.02, -0.02, { cast: false });
			const rec = add(dj, new THREE.CylinderGeometry(0.17, 0.17, 0.008, 24), mat("#111", 0.3, 0, { map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = "#111"; c.fillRect(0, 0, w, h); c.strokeStyle = "#333"; for (let r = 10; r < 64; r += 5) { c.beginPath(); c.arc(64, 64, r, 0, 6.3); c.stroke(); } c.fillStyle = "#e63946"; c.beginPath(); c.arc(64, 64, 16, 0, 6.3); c.fill(); }) }), sx, 1.05, -0.02, { cast: false });
			records.push(rec);
		}
		for (let i = 0; i < 8; i++) { const b = add(dj, new THREE.BoxGeometry(0.07, 0.3, 0.02), new THREE.MeshBasicMaterial({ color: ["#06d6a0", "#ffd166", "#ff4d6d", "#4cc9f0"][i % 4], toneMapped: false }), -0.35 + i * 0.1, 0.55, 0.37, { cast: false }); b.position.y = 0.3; bars.push(b); }
		k.spot({ id: "musicDJ", x: X1 - 1.5, z: Z0 + 1.85, h: Math.PI / 2, y: 0.0, ridePose: () => "walk" });
		k.interact("music:dj", { label: "Spin some records", stand: [X1 - 1.9, Z0 + 1.85], sit: ["musicDJ"] }, dj);
		k.box(X1 - 1.15, X1, Z0 + 0.95, Z0 + 2.75);
		// a sofa facing the stage
		const sofaM = mat("#5a2a5e", 0.85);
		const sf = group(g, 27.4, 0, 16.0, Math.PI * 0.25);
		add(sf, rbox(2.0, 0.42, 0.85, 0.08), sofaM, 0, 0.24, 0);
		add(sf, rbox(2.0, 0.5, 0.2, 0.08), sofaM, 0, 0.66, -0.36);
		for (const sx of [-0.95, 0.95]) add(sf, rbox(0.18, 0.55, 0.85, 0.06), sofaM, sx, 0.4, 0);
		const c = Math.cos(Math.PI * 0.25), s2 = Math.sin(Math.PI * 0.25), W = (lx, lz) => [27.4 + lx * c + lz * s2, 16.0 - lx * s2 + lz * c];
		["musicSofa0", "musicSofa1"].forEach((id, j) => { const p = W(j ? 0.42 : -0.42, 0.05); k.spot({ id, x: p[0], z: p[1], h: Math.PI * 0.25, y: 0.04 }); });
		k.interact("music:sofa", { label: "Sit and listen", stand: W(0, 1.05), sit: ["musicSofa0", "musicSofa1"] }, sf);
		// (it stands at an angle: three boxes along it, not one big square that swallows the floor in front of it)
		for (const lx of [-0.65, 0, 0.65]) { const p = W(lx, -0.1); k.box(p[0] - 0.36, p[0] + 0.36, p[1] - 0.36, p[1] + 0.36); }
		const rug = add(g, new THREE.CircleGeometry(2.2, 40), mat("#ffffff", 1, 0, { map: tex.carpet("#2b2140", "#c77dff") }), 28.6, 0.006, 17.4, { rx: -Math.PI / 2, cast: false });
		rug.userData.floor = true;
	}

	// ---------------------------------------------------------------- acoustic panels, a neon sign, the door's sign
	{
		const cols = ["#3d348b", "#7678ed", "#c77dff", "#2b2d42"];
		for (let i = 0; i < 10; i++) add(g, rbox(0.6, 0.6, 0.06, 0.02), mat(cols[i % 4], 0.95), X0 + 0.05, 1.3 + (i % 2) * 0.7, Z0 + 4.4 + Math.floor(i / 2) * 0.7, { ry: Math.PI / 2, cast: false });
		const neon = tex.text("PLAY IT LOUD", { w: 1024, h: 256, color: "#f6e8ff", glow: "#c77dff", font: "900 120px 'Nunito', sans-serif" });
		add(g, new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }), (STAGE.x0 + STAGE.x1) / 2, 2.6, Z1 - 0.04, { ry: Math.PI, cast: false, receive: false });
		k.photo(79, X0 + 0.03, 1.8, 21.2, Math.PI / 2, { w: 0.9, h: 0.7, frame: "#c9a05a", metal: 0.7 });
		k.photo(80, X0 + 0.03, 1.8, 22.9, Math.PI / 2, { w: 0.9, h: 0.7, frame: "#c9a05a", metal: 0.7 });
		k.photo(81, 25.2, 1.75, Z0 + 0.03, 0, { w: 1.0, h: 0.75, frame: "#1d1b22" });
		k.photo(82, 31.4, 1.75, Z0 + 0.03, 0, { w: 1.0, h: 0.75, frame: "#1d1b22" });
		const st = tex.sign("Gallery", "home");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), (DOOR[0] + DOOR[1]) / 2, 2.75, Z0 + 0.04, { cast: false });
	}
	k.lightSwitch(DOOR[0] - 0.45, 1.25, Z0 + 0.02, 0);

	// ---------------------------------------------------------------- light
	const spot = k.light(STAGE.x0 + 1.6, 3.0, STAGE.z0 + 1.1, "#e8d6ff", 6, 6);
	const djL = k.light(X1 - 1.0, 1.8, Z0 + 1.85, "#c77dff", 2.5, 5);
	k.light(27.0, 2.9, 14.0, "#ffd9b8", 3, 8);
	k.light(X0 + 2.2, 2.6, Z1 - 2.3, "#ffe6c8", 2.5, 6);
	k.key.pos.copy(k.V(28.4, H - 0.15, 16.4)); k.key.target.copy(k.V(28.4, 0, 16.4));
	k.key.angle = 1.2; k.key.intensity = 10; k.key.distance = 12; k.key.color.set("#e9dcff");
	k.fill.pos.copy(k.V(28.4, 2.4, 16.4)); k.fill.intensity = 3; k.fill.distance = 14;
	k.hemi = 0.35; k.env = 0.25; k.exposure = 1.05;

	function update(dt, t) {
		const on = !!ctx.whoSits("musicDJ");
		records.forEach(r => { if (on) r.rotation.y += dt * 3.5; });
		bars.forEach((b, i) => { const v = on ? 0.3 + Math.abs(Math.sin(t * (4 + i) + i)) * 0.9 : 0.25; b.scale.y = v; b.position.y = 0.3 + 0.15 * v; });
		djL.intensity = djL.base * (on ? 1 + Math.sin(t * 6) * 0.5 : 0.4);
		spot.intensity = spot.base * (0.9 + Math.sin(t * 1.3) * 0.1);
	}
	return { update };
}
