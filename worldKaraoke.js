/**
 * Harmony World — the karaoke lounge, through the game room's west doors (worldGameRoom.js).
 *
 * Local coordinates (origin at world 4.85, 13.15): x -3.5..3.5, z -4.8..4.8, ceiling 3.6 m. The door is in
 * the east wall at z 3.2. The stage runs across the north end (z < -2.4, 35 cm up, steps in the middle).
 *
 *   sing at the mic: a spotlight follows you, and whatever you type in the chat comes up on the big screen as lyrics
 *   pick the song at the karaoke machine (the house's music - any YouTube song too - plays loud in here)
 *   play the drum kit (hit them, or a whole fill) and the guitar (strum chords, play a riff): everyone hears it
 *   cheer for whoever's on stage from the sofa
 */
import { TRACKS } from "./worldAudio.js";

const W = 7.0, D = 9.6, H = 3.6, HW = W / 2, HD = D / 2;
const STAGE = { z: -2.4, h: 0.35, step: 0.75 };
const MIC = { x: 0, z: -3.2 };
const DRUM = { x: -2.3, z: -3.45 };
const GTR = { x: 2.3, z: -3.6 };
const CHORDS = [{ n: "C", m: [48, 55, 60, 64, 67] }, { n: "G", m: [43, 50, 55, 59, 62] }, { n: "Am", m: [45, 52, 57, 60, 64] }, { n: "F", m: [41, 48, 53, 57, 60] }];

function floorY(x, z) {
	if (z < STAGE.z) return STAGE.h;
	if (z < STAGE.z + 0.3 && Math.abs(x) < STAGE.step) return STAGE.h / 2;
	return 0;
}

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng, tex } = k;
	const R = rng(5150);
	const onStage = (x, z) => { const lx = x - k.ox, lz = z - k.oz; return Math.abs(lx) < HW && lz < STAGE.z + 0.05 && lz > -HD; };

	// ---------------------------------------------------------------- the room
	k.shell({
		w: W, d: D, h: H,
		floor: mat("#ffffff", 0.95, 0, { map: tex.carpet("#2a1838", "#ff4fd8", W / 3, D / 3, false) }),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#24152f", "dots", "rgba(255,79,216,0.12)", W / 2, H / 2) }),
		ceil: mat("#120a18", 0.95),
		holes: [{ wall: "e", at: 3.2, w: 1.5, y1: 2.3 }]
	});
	k.floor(floorY);
	k.walk(-HW, HW, -HD, HD);
	k.walk(HW - 0.4, HW + 0.6, 2.5, 3.9);   // back to the game room
	k.cam = { minX: -HW + 0.2, maxX: HW - 0.2, minZ: -HD + 0.2, maxZ: HD - 0.2, maxY: H - 0.2 };
	k.lightSwitch(HW - 0.02, 1.25, 2.0, -Math.PI / 2);

	// ---------------------------------------------------------------- the stage
	const stageM = mat("#1a1222", 0.35, 0.2);
	add(g, new THREE.BoxGeometry(W, STAGE.h, HD + STAGE.z), stageM, 0, STAGE.h / 2, (-HD + STAGE.z) / 2).userData.floor = true;
	add(g, new THREE.BoxGeometry(STAGE.step * 2, STAGE.h / 2, 0.3), stageM, 0, STAGE.h / 4, STAGE.z + 0.15).userData.floor = true;
	const edgeLed = new THREE.MeshBasicMaterial({ color: "#ff4fd8", toneMapped: false });
	add(g, new THREE.BoxGeometry(W, 0.03, 0.03), edgeLed, 0, STAGE.h - 0.02, STAGE.z + 0.01, { cast: false, receive: false });
	k.box(-HW, -STAGE.step, STAGE.z - 0.12, STAGE.z + 0.02);
	k.box(STAGE.step, HW, STAGE.z - 0.12, STAGE.z + 0.02);
	// velvet curtains either side of the screen
	const cg = new THREE.PlaneGeometry(1.4, H - STAGE.h, 24, 1);
	{ const p = cg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * Math.PI * 7) * 0.05); cg.computeVertexNormals(); }
	const velvet = mat("#8b0f3a", 0.9, 0, { side: THREE.DoubleSide });
	for (const sx of [-1, 1]) add(g, cg, velvet, sx * (HW - 0.7), STAGE.h + (H - STAGE.h) / 2, -HD + 0.12, { cast: false });
	// the lyrics screen
	const scCanvas = document.createElement("canvas");
	scCanvas.width = 1024; scCanvas.height = 448;
	const scTex = new THREE.CanvasTexture(scCanvas);
	scTex.colorSpace = THREE.SRGBColorSpace;
	add(g, rbox(3.5, 1.65, 0.08, 0.02), mat("#0b0b0f", 0.4), 0, 2.2, -HD + 0.06);
	add(g, new THREE.PlaneGeometry(3.3, 1.44), new THREE.MeshBasicMaterial({ map: scTex, toneMapped: false }), 0, 2.2, -HD + 0.105, { cast: false, receive: false });
	const neon = tex.text("KARAOKE", { w: 1024, h: 256, color: "#ffe1f7", glow: "#ff4fd8", font: "900 150px 'Nunito', sans-serif" });
	add(g, new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }), 0, 3.25, -HD + 0.04, { cast: false, receive: false });
	// the mic on its stand
	const mic = group(g, MIC.x, STAGE.h, MIC.z);
	add(mic, new THREE.CylinderGeometry(0.16, 0.18, 0.03, 18), mat("#222", 0.3, 0.8), 0, 0.015, 0);
	add(mic, new THREE.CylinderGeometry(0.012, 0.012, 1.45, 8), mat("#bbb", 0.2, 0.9), 0, 0.73, 0);
	const micHead = add(mic, new THREE.SphereGeometry(0.035, 14, 10), mat("#cfcfcf", 0.25, 0.9), 0, 1.5, 0.05, { cast: false });
	add(mic, new THREE.CylinderGeometry(0.018, 0.012, 0.12, 10), mat("#111", 0.3), 0, 1.44, 0.03, { rx: 0.35, cast: false });
	k.box(MIC.x - 0.12, MIC.x + 0.12, MIC.z - 0.12, MIC.z + 0.12);
	// the speakers either side
	for (const sx of [-1, 1]) {
		const sp = group(g, sx * (HW - 0.45), STAGE.h, STAGE.z - 0.35);
		add(sp, rbox(0.55, 1.0, 0.45, 0.03), mat("#16161c", 0.5), 0, 0.5, 0);
		for (const [y, r] of [[0.68, 0.17], [0.3, 0.1]]) add(sp, new THREE.CylinderGeometry(r, r, 0.02, 20), mat("#333", 0.4, 0.4), 0, y, 0.23, { rx: Math.PI / 2, cast: false });
		k.box(sx * (HW - 0.45) - 0.3, sx * (HW - 0.45) + 0.3, STAGE.z - 0.6, STAGE.z - 0.1);
	}

	// ---------------------------------------------------------------- the drum kit (stage left) and its stool
	const kit = group(g, DRUM.x, STAGE.h, DRUM.z);
	const shellM = mat("#c1121f", 0.3, 0.3), headM = mat("#f5f0e6", 0.6), chrome = mat("#d9dde2", 0.15, 1), brassC = mat("#d4a017", 0.25, 0.9);
	const drums = [];
	const drum = (x, y, z, r, d, rx, sound) => {
		const dg = group(kit, x, y, z);
		dg.rotation.x = rx;
		add(dg, new THREE.CylinderGeometry(r, r, d, 22), shellM, 0, 0, 0, { cast: false });
		add(dg, new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.005, 22), headM, 0, d / 2 + 0.003, 0, { cast: false });
		drums.push({ m: dg, sound, k: 0, base: dg.scale.clone() });
	};
	drum(0, 0.28, 0.1, 0.27, 0.36, Math.PI / 2, "kick");      // bass drum, facing the audience
	drum(-0.38, 0.62, -0.12, 0.17, 0.14, -0.15, "snare");
	drum(-0.12, 0.82, 0.05, 0.13, 0.12, -0.35, "tom");
	drum(0.18, 0.82, 0.05, 0.14, 0.13, -0.35, "tom");
	drum(0.45, 0.5, -0.2, 0.2, 0.3, 0, "tom");               // floor tom
	const cymbal = (x, y, z, r, sound) => {
		add(kit, new THREE.CylinderGeometry(0.008, 0.008, y, 6), chrome, x, y / 2, z, { cast: false });
		const c = add(kit, new THREE.CylinderGeometry(r, r * 0.2, 0.012, 24), brassC, x, y, z, { rz: 0.15, cast: false });
		drums.push({ m: c, sound, k: 0, cym: true });
	};
	cymbal(-0.62, 0.95, -0.25, 0.17, "hat");
	cymbal(-0.35, 1.25, 0.25, 0.22, "crash");
	cymbal(0.55, 1.2, 0.2, 0.24, "crash");
	k.box(DRUM.x - 0.85, DRUM.x + 0.8, DRUM.z - 0.4, DRUM.z + 0.45);
	const stool = group(g, DRUM.x - 0.05, STAGE.h, DRUM.z - 0.7);
	add(stool, new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), mat("#111", 0.6), 0, 0.5, 0);
	add(stool, new THREE.CylinderGeometry(0.02, 0.03, 0.46, 8), chrome, 0, 0.23, 0);
	k.spot({ id: "drumStool", x: DRUM.x - 0.05, z: DRUM.z - 0.72, h: 0, y: STAGE.h + 0.05 });
	k.interact("karaoke:drums", { label: "Play the drums", stand: [DRUM.x + 0.95, DRUM.z - 0.75], sit: ["drumStool"] }, stool, kit);
	function hitDrum(i, local) {
		const d = drums[i % drums.length];
		d.k = 1;
		ctx.sfx(d.sound, d.sound === "kick" ? 0.9 : 0.6);
		if (local) ctx.send({ t: "fx", kind: "zfx", zone: "karaoke", what: "drum", i });
	}
	const FILL = [0, 1, 7, 1, 2, 3, 4, 6];
	function drumFill(local) { FILL.forEach((i, n) => setTimeout(() => hitDrum(i, false), n * 120)); if (local) ctx.send({ t: "fx", kind: "zfx", zone: "karaoke", what: "fill" }); }

	// ---------------------------------------------------------------- the guitar on its stand (stage right)
	const gtr = group(g, GTR.x, STAGE.h, GTR.z, -0.3);
	const bodyM = mat("#e76f51", 0.3, 0.1);
	add(gtr, new THREE.CylinderGeometry(0.03, 0.04, 0.5, 8), mat("#222", 0.4), 0, 0.25, -0.05, { cast: false });
	const gb = group(gtr, 0, 0.55, 0.03, 0);
	gb.rotation.x = -0.18;
	add(gb, new THREE.SphereGeometry(0.2, 18, 12), bodyM, 0, 0, 0, { cast: false }).scale.set(1, 1.15, 0.28);
	add(gb, new THREE.SphereGeometry(0.15, 18, 12), bodyM, 0, 0.24, 0, { cast: false }).scale.set(1, 1, 0.28);
	add(gb, new THREE.CylinderGeometry(0.05, 0.05, 0.01, 16), mat("#111", 0.5), 0, 0.12, 0.058, { rx: Math.PI / 2, cast: false });
	add(gb, new THREE.BoxGeometry(0.06, 0.62, 0.025), mat("#5a3826", 0.5), 0, 0.68, 0.01, { cast: false });
	add(gb, new THREE.BoxGeometry(0.08, 0.12, 0.03), mat("#3b2519", 0.5), 0, 1.04, 0.01, { cast: false });
	k.box(GTR.x - 0.3, GTR.x + 0.3, GTR.z - 0.25, GTR.z + 0.25);
	let chordI = 0, gtrK = 0;
	function strum(c, local) {
		const a = ctx.audio();
		gtrK = 1;
		if (a && !ctx.muted()) CHORDS[c].m.forEach((n, i) => setTimeout(() => a.pianoNote(n, 0.13), i * 28));
		if (local) ctx.send({ t: "fx", kind: "zfx", zone: "karaoke", what: "strum", c });
	}
	function riff(local) { [0, 0, 1, 1, 2, 2, 3, 3].forEach((c, n) => setTimeout(() => strum(c, false), n * 420)); if (local) ctx.send({ t: "fx", kind: "zfx", zone: "karaoke", what: "riff" }); }
	k.interact("karaoke:guitar", {
		label: () => "Strum the guitar (" + CHORDS[chordI].n + ")", stand: [GTR.x - 0.1, GTR.z + 0.75], face: Math.PI, reach: 2.0,
		use: () => { ctx.doUpper("clap", 500); strum(chordI, true); chordI = (chordI + 1) % CHORDS.length; }
	}, gtr);

	// ---------------------------------------------------------------- the karaoke machine (pick the song)
	const km = group(g, 2.55, 0, STAGE.z + 0.7, -0.5);
	add(km, rbox(0.7, 0.95, 0.5, 0.03), mat("#2b2140", 0.4), 0, 0.475, 0);
	const kmScreen = new THREE.MeshBasicMaterial({ color: "#3ff0ff", toneMapped: false });
	add(km, new THREE.PlaneGeometry(0.5, 0.28), kmScreen, 0, 0.78, 0.252, { cast: false });
	for (let i = 0; i < 6; i++) add(km, new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10), mat(["#ff4fd8", "#ffd166", "#06d6a0"][i % 3], 0.3), -0.18 + (i % 3) * 0.18, 0.5 - Math.floor(i / 3) * 0.12, 0.252, { rx: Math.PI / 2, cast: false });
	k.box(2.15, 2.95, STAGE.z + 0.35, STAGE.z + 1.05);
	k.interact("karaoke:machine", { label: "Pick a song", stand: [2.2, STAGE.z + 1.55], face: Math.PI - 0.5, use: () => ctx.openMusic() }, km);

	// ---------------------------------------------------------------- the audience: a sofa, a low table
	const sofaM = mat("#6a1b9a", 0.85), sofaD = mat("#4a1270", 0.85);
	const sofa = group(g, -0.4, 0, 1.9, Math.PI);
	add(sofa, rbox(2.8, 0.3, 0.92, 0.06), sofaD, 0, 0.27, 0);
	for (const sx of [-0.9, 0, 0.9]) { add(sofa, rbox(0.88, 0.18, 0.7, 0.08), sofaM, sx, 0.5, 0.06); add(sofa, rbox(0.86, 0.42, 0.16, 0.08), sofaM, sx, 0.76, -0.24, { rx: -0.12 }); }
	add(sofa, rbox(2.8, 0.6, 0.22, 0.08), sofaD, 0, 0.64, -0.36, { rx: -0.06 });
	for (const sx of [-1.4, 1.4]) add(sofa, rbox(0.18, 0.5, 0.92, 0.08), sofaD, sx, 0.45, 0);
	k.box(-1.9, 1.1, 1.44, 2.36);
	const seatIds = ["karaSofa0", "karaSofa1", "karaSofa2"];
	[-0.9, 0, 0.9].forEach((sx, i) => k.spot({ id: seatIds[i], x: -0.4 - sx, z: 1.9 - 0.06, h: Math.PI, y: 0.15 }));
	k.interact("karaoke:sofa", { label: "Sit and watch the show", stand: [0.9, 0.95], sit: seatIds }, sofa);
	const tb = group(g, -0.4, 0, 0.5);
	add(tb, new THREE.CylinderGeometry(0.45, 0.45, 0.05, 28), mat("#c9a05a", 0.3, 0.8), 0, 0.42, 0);
	add(tb, new THREE.CylinderGeometry(0.06, 0.12, 0.4, 12), mat("#c9a05a", 0.3, 0.8), 0, 0.2, 0);
	for (const [x, z, c] of [[-0.15, 0.05, "#ff4fd8"], [0.12, -0.08, "#3ff0ff"]]) add(tb, new THREE.CylinderGeometry(0.035, 0.025, 0.14, 12), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, toneMapped: false }), x, 0.52, z, { cast: false });
	k.box(-0.9, 0.1, 0.0, 1.0);
	const rug = add(g, new THREE.PlaneGeometry(4.0, 2.4), mat("#ffffff", 1, 0, { map: tex.carpet("#3b1f4f", "#ffd166") }), -0.4, 0.006, 1.2, { rx: -Math.PI / 2, cast: false });
	rug.userData.floor = true;

	// ---------------------------------------------------------------- stage lights: a truss, coloured beams, the spotlight
	add(g, new THREE.BoxGeometry(W - 0.4, 0.08, 0.08), mat("#333", 0.4, 0.7), 0, H - 0.25, STAGE.z + 0.2, { cast: false });
	const beamGeo = new THREE.ConeGeometry(0.55, H - 0.6, 24, 1, true);
	beamGeo.translate(0, -(H - 0.6) / 2, 0);
	const beams = [];
	for (let i = 0; i < 4; i++) {
		const m = new THREE.MeshBasicMaterial({ color: "#ff4fd8", transparent: true, opacity: 0.08, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
		const b = add(g, beamGeo, m, -2.4 + i * 1.6, H - 0.3, STAGE.z + 0.2, { cast: false, receive: false });
		b.userData.ph = i * 1.4;
		beams.push(b);
	}
	const spotM = new THREE.MeshBasicMaterial({ color: "#fff6dc", transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
	const spotGeo = new THREE.ConeGeometry(0.45, 1, 24, 1, true);
	spotGeo.translate(0, -0.5, 0);
	const spotBeam = add(g, spotGeo, spotM, 0, H - 0.3, 0, { cast: false, receive: false });
	const spotPool = add(g, new THREE.CircleGeometry(0.5, 28), new THREE.MeshBasicMaterial({ color: "#fff6dc", transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), 0, STAGE.h + 0.01, MIC.z, { rx: -Math.PI / 2, cast: false, receive: false });
	// music notes floating up from whoever's singing
	const noteTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = "#fff"; c.font = "900 52px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♪", w / 2, h / 2); });
	const notes = [];
	for (let i = 0; i < 10; i++) {
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, color: new THREE.Color().setHSL(i / 10, 0.9, 0.7), transparent: true, depthWrite: false, opacity: 0 }));
		s.scale.setScalar(0.22);
		s.userData = { ph: i / 10, dx: (R() - 0.5) * 0.6 };
		g.add(s);
		notes.push(s);
	}

	// ---------------------------------------------------------------- singing, lyrics, cheering
	const SK = "z:karaoke:singer";
	const lyrics = [];   // { name, text, at }
	function sing() {
		const me = ctx.me();
		me.h = 0;
		ctx.doUpper("dance", 20000);
		ctx.setShared(SK, { id: ctx.MY_ID, name: ctx.profile().name, at: Date.now() });
		ctx.sfx("applause", 0.25);
		const m = ctx.get("music");
		if (!m || !m.on) ctx.toast("Pick a song to sing along to", "Pick a song", () => ctx.openMusic(), 8000);
		ctx.notice("You're on stage! Type in the chat - your words come up on the big screen like lyrics.");
	}
	k.interact("karaoke:mic", { label: "Sing at the mic", stand: [MIC.x, MIC.z + 0.4], face: 0, use: sing }, mic);
	function cheer(to, name) {
		ctx.doUpper("clap", 2200);
		ctx.sfx("applause", 0.6);
		ctx.send({ t: "fx", kind: "zfx", zone: "karaoke", what: "cheer", to });
		ctx.notice(`You cheered for <b>${ctx.esc(name)}</b>!`);
	}
	// who's up on the stage (the one nearest the mic is the singer)
	function performer() {
		const me = ctx.me();
		let best = null, bd = 1e9;
		const consider = (id, x, z, name, av) => { if (!onStage(x, z)) return; const d = Math.hypot(x - (MIC.x + k.ox), z - (MIC.z + k.oz)); if (d < bd) { bd = d; best = { id, x, z, name, av }; } };
		consider(ctx.MY_ID, me.x, me.z, ctx.profile().name, ctx.myAvatar());
		ctx.peers().forEach((p, id) => consider(id, p.x, p.z, p.look.name, p.avatar));
		return best;
	}
	function songName() {
		const m = ctx.get("music");
		if (!m || !m.on) return "";
		return m.yt ? (m.title || "a song from YouTube") : TRACKS[m.track % TRACKS.length].name;
	}
	function drawScreen(t) {
		const c = scCanvas.getContext("2d"), w = 1024, h = 448;
		const gr = c.createLinearGradient(0, 0, w, h);
		gr.addColorStop(0, `hsl(${(t * 12) % 360},60%,14%)`); gr.addColorStop(1, `hsl(${(t * 12 + 120) % 360},60%,10%)`);
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(t * 2 + i)})`; c.beginPath(); c.arc((i * 151 + t * 30) % w, (i * 73) % h, 2 + (i % 3), 0, Math.PI * 2); c.fill(); }
		c.textAlign = "center"; c.textBaseline = "middle";
		const song = songName(), who = performer();
		c.fillStyle = "#ffd6f5"; c.font = "800 34px Nunito, sans-serif";
		c.fillText(song ? "♪  " + song.slice(0, 48) + "  ♪" : "Pick a song at the karaoke machine", w / 2, 46);
		c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "700 28px Nunito, sans-serif";
		c.fillText(who ? "On stage: " + who.name : "Step up to the mic and sing!", w / 2, 92);
		const lines = lyrics.slice(-3);
		lines.forEach((l, i) => {
			const last = i === lines.length - 1, y = 190 + (i - lines.length + 3) * 82 - 82;
			c.font = `900 ${last ? 56 : 40}px Nunito, sans-serif`;
			c.fillStyle = last ? "#ffffff" : "rgba(255,255,255,0.45)";
			let txt = l.text;
			while (c.measureText(txt).width > w - 80 && txt.length > 4) txt = txt.slice(0, -2);
			if (txt !== l.text) txt += "...";
			c.fillText(txt, w / 2, y);
			if (last) {
				// the bouncing ball runs along the line once
				const tw = c.measureText(txt).width, u = Math.min(1, (Date.now() - l.at) / Math.max(1500, txt.length * 120));
				const bx = w / 2 - tw / 2 + tw * u, by = y - 50 - Math.abs(Math.sin(u * Math.PI * Math.max(2, txt.split(" ").length))) * 26;
				c.fillStyle = "#ff4fd8"; c.beginPath(); c.arc(bx, by, 11, 0, Math.PI * 2); c.fill();
			}
		});
		if (!lines.length) { c.fillStyle = "rgba(255,255,255,0.35)"; c.font = "800 40px Nunito, sans-serif"; c.fillText("Your lyrics appear here", w / 2, 290); }
		scTex.needsUpdate = true;
	}
	drawScreen(0);

	// ---------------------------------------------------------------- light
	const L = {
		s0: k.light(-2.2, H - 0.5, STAGE.z - 0.8, "#ff4fd8", 3.0, 6),
		s1: k.light(0, H - 0.5, STAGE.z - 1.0, "#3ff0ff", 3.0, 6),
		s2: k.light(2.2, H - 0.5, STAGE.z - 0.8, "#ffd166", 3.0, 6),
		spot: k.light(0, 2.6, MIC.z, "#fff6dc", 0, 5),
		crowd: k.light(-0.4, 2.4, 1.2, "#b388ff", 1.8, 6),
		bar: k.light(2.5, 1.6, STAGE.z + 0.9, "#3ff0ff", 1.0, 3)
	};
	k.key.pos.copy(k.V(0, H - 0.15, 0)); k.key.target.copy(k.V(0, 0, -1.5));
	k.key.angle = 1.15; k.key.intensity = 7; k.key.distance = 12; k.key.color.set("#c9a6ff");
	k.fill.pos.copy(k.V(0, 2.2, 1.5)); k.fill.intensity = 2.2; k.fill.distance = 12; k.fill.color.set("#8a6cff");
	k.hemi = 0.18; k.env = 0.15; k.exposure = 1.1;

	// ---------------------------------------------------------------- every frame
	let scAcc = 0;
	const tv = new THREE.Vector3();
	function update(dt, t) {
		scAcc += dt;
		if (scAcc > 0.1) { scAcc = 0; drawScreen(t); }
		// the coloured lights sweep and change colour; the stage edge glows
		[L.s0, L.s1, L.s2].forEach((l, i) => { l.color.setHSL((t * 0.07 + i / 3) % 1, 1, 0.55); l.intensity = l.base * (0.6 + 0.4 * Math.max(0, Math.sin(t * 3 + i * 2))); });
		beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.9 + b.userData.ph) * 0.35; b.rotation.x = Math.cos(t * 0.7 + b.userData.ph) * 0.2; b.material.color.setHSL((t * 0.07 + i / 4) % 1, 1, 0.6); b.material.opacity = 0.06 + 0.04 * Math.max(0, Math.sin(t * 2.4 + i)); });
		edgeLed.color.setHSL((t * 0.1) % 1, 1, 0.6);
		kmScreen.color.setHSL((t * 0.05) % 1, 0.8, 0.6);
		// the spotlight follows whoever's on stage, with notes floating up
		const who = performer();
		const on = who ? 1 : 0;
		spotM.opacity += (on * 0.14 - spotM.opacity) * Math.min(1, dt * 4);
		spotPool.material.opacity = spotM.opacity * 2.2;
		L.spot.intensity = 3.2 * (spotM.opacity / 0.14);
		if (who) {
			const lx = who.x - k.ox, lz = who.z - k.oz;
			spotPool.position.set(lx, STAGE.h + 0.01, lz);
			const top = new THREE.Vector3(lx * 0.4, H - 0.3, STAGE.z + 0.6);
			spotBeam.position.copy(top);
			tv.set(lx, STAGE.h, lz).sub(top);
			spotBeam.scale.set(1, tv.length(), 1);
			spotBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tv.normalize());
			L.spot.pos.copy(k.V(lx, 2.6, lz + 0.3));
		}
		notes.forEach(s => {
			const u = s.userData, f = (t * 0.45 + u.ph) % 1;
			if (who) { const lx = who.x - k.ox, lz = who.z - k.oz; s.position.set(lx + u.dx + Math.sin(t * 2 + u.ph * 9) * 0.1, STAGE.h + 1.6 + f * 1.3, lz + 0.1); }
			s.material.opacity = who ? Math.sin(f * Math.PI) * 0.9 : 0;
		});
		micHead.scale.setScalar(1 + (who ? Math.abs(Math.sin(t * 9)) * 0.08 : 0));
		// the drums bounce when they're hit, the guitar shakes when it's strummed
		drums.forEach(d => {
			d.k = Math.max(0, d.k - dt * 6);
			if (d.cym) d.m.rotation.x = Math.sin(t * 40) * 0.12 * d.k;
			else d.m.scale.set(1 + d.k * 0.06, 1 - d.k * 0.04, 1 + d.k * 0.06);
		});
		gtrK = Math.max(0, gtrK - dt * 3);
		gb.rotation.z = Math.sin(t * 50) * 0.02 * gtrK;
	}

	return {
		update,
		musicAt() { return 1; },   // it's a karaoke bar: the music's loud in here
		onChat(id, who, text) {
			const me = ctx.me();
			const x = id === ctx.MY_ID ? me.x : who && who.x, z = id === ctx.MY_ID ? me.z : who && who.z;
			if (typeof x !== "number" || !onStage(x, z)) return;
			lyrics.push({ name: id === ctx.MY_ID ? ctx.profile().name : who.look.name, text: String(text).slice(0, 120), at: Date.now() });
			if (lyrics.length > 6) lyrics.shift();
		},
		applyKey(key, remote) {
			if (key === SK && remote) { const s = ctx.get(SK); if (s && Date.now() - s.at < 8000) ctx.notice(`<b>${ctx.esc(s.name)}</b> is singing in the karaoke lounge!`); }
		},
		onFx(d, p) {
			if (d.what === "drum") hitDrum(+d.i || 0, false);
			else if (d.what === "fill") drumFill(false);
			else if (d.what === "strum") strum(Math.abs(+d.c || 0) % CHORDS.length, false);
			else if (d.what === "riff") riff(false);
			else if (d.what === "cheer") {
				ctx.sfx("applause", 0.5);
				if (d.to === ctx.MY_ID) { ctx.notice(`<b>${ctx.esc(p ? p.look.name : "Someone")}</b> is cheering for you!`); ctx.heartsFx(ctx.myAvatar().root, 5, "#ffd166"); }
			}
		},
		promptOpts(opts) {
			const me = ctx.me();
			const free = key => !opts.some(o => o.k === key);
			// at the drums
			if (me.sit === "drumStool") {
				if (free("G")) opts.push({ k: "G", label: "Hit the drums", fn: () => { ctx.doUpper("clap", 300); hitDrum(Math.floor(Math.random() * drums.length), true); } });
				if (free("R")) opts.push({ k: "R", label: "Play a drum fill", fn: () => { ctx.doUpper("clap", 1000); drumFill(true); } });
				return;
			}
			if (me.sit && !seatIds.includes(me.sit)) return;
			// by the guitar: a whole riff
			if (!me.sit && Math.hypot(me.x - (GTR.x + k.ox), me.z - (GTR.z + k.oz)) < 1.6 && free("R")) opts.push({ k: "R", label: "Play a riff on the guitar", fn: () => { ctx.doUpper("clap", 3200); riff(true); } });
			// someone else up there singing: cheer them on
			const who = performer();
			if (who && who.id !== ctx.MY_ID && !onStage(me.x, me.z) && free("F")) opts.push({ k: "F", label: "Cheer for " + who.name, fn: () => cheer(who.id, who.name) });
			if (onStage(me.x, me.z) && !me.sit && me.upper !== "dance" && free("G")) opts.push({ k: "G", label: "Sing!", fn: sing });
		}
	};
}
