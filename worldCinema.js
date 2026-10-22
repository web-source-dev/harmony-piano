/**
 * Harmony World — the cinema: 20 recliners on stadium tiers, a giant screen.
 *
 * Local coordinates: screen wall at z = -9, back wall (entrance) at z = +6,
 * side walls at x = -5 / +5. You come in at the top, on the landing (1.8 m up),
 * and the seats step down toward the screen in four rows of five. Stairs run
 * down both sides. A movie plays on the screen for everyone in the room, in sync
 * (shared key z:cinema:movie, same scheme as the living-room TV): YouTube, a video
 * file, another site's player, or someone's shared tab / movie file (worldScreen.js).
 */
import { CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { ytKey, ytEmbedSrc, ytThumb, followPlaylist, playlistStep } from "./worldYT.js";
import { parseSource, probe, libraryVideos, sourceTitle, loadHls, isHls, canShareTab, canShareFile, createStreamer, serverNow, startClock, uploadMovie, deleteMovie } from "./worldScreen.js";

const ROWS = 4, COLS = 5;
const ROW_Z = [-3.0, -1.1, 0.8, 2.7];   // middle of each row's legroom/seat platform
const TIER = 0.45, PITCH = 1.9;
const BLOCK = 2.75;                     // seats are between x = -2.75 and +2.75; stairs outside that
const LANDING_Z = 3.65, LANDING_Y = 1.8;
const STEP_D = 0.475, STEP_H = 0.1125;  // aisle stairs: 16 steps from the front floor up to the landing
const SCREEN = { w: 8, h: 4.5, y: 3.45, z: -8.82 };
const ROW_NAMES = "ABCD";

// height of the floor at local (x, z)
function floorY(x, z) {
	if (z >= LANDING_Z) return LANDING_Y;
	if (Math.abs(x) >= BLOCK) return Math.max(0, Math.min(16, Math.floor((z + 3.95) / STEP_D))) * STEP_H;
	if (z < -2.05) return 0;
	return Math.min(4, Math.floor((z + 2.05) / PITCH) + 1) * TIER;
}

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, ctx, canvasTex, rng } = k;
	const H = 6.5;

	// ---------------------------------------------------------------- room
	const carpetTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#3a1220"; c.fillRect(0, 0, w, h);
		const r = rng(5);
		for (let i = 0; i < 18000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,180,200"},${r() * 0.06})`; c.fillRect(r() * w, r() * h, 2, 2); }
		// little gold and teal confetti pattern, like a real cinema carpet
		for (let i = 0; i < 70; i++) {
			c.save(); c.translate(r() * w, r() * h); c.rotate(r() * 6);
			c.fillStyle = ["#c9a05a", "#2a9d8f", "#e76f51"][i % 3];
			c.globalAlpha = 0.5;
			c.fillRect(-7, -2, 14, 4);
			c.restore();
		}
	}, 6, 7);
	const carpet = mat("#ffffff", 0.95, 0, { map: carpetTex });
	const quiltTex = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#2b1520"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = 3;
		for (let i = -w; i < w * 2; i += 42) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); }
		c.fillStyle = "rgba(255,200,150,0.18)";
		for (let y = 0; y <= h; y += 42) for (let x = (y / 42) % 2 ? 21 : 0; x <= w; x += 42) { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
	}, 4, 3);
	const wallM = mat("#ffffff", 0.95, 0, { map: quiltTex });
	// star ceiling (fibre-optic stars)
	const starTex = canvasTex(2048, 1024, (c, w, h) => {
		c.fillStyle = "#06061a"; c.fillRect(0, 0, w, h);
		const r = rng(77);
		for (let i = 0; i < 1400; i++) {
			const s = r() < 0.92 ? 1.2 : 2.6;
			c.fillStyle = `rgba(${200 + r() * 55},${210 + r() * 45},255,${0.4 + r() * 0.6})`;
			c.beginPath(); c.arc(r() * w, r() * h, s, 0, Math.PI * 2); c.fill();
		}
	});
	const ceilM = new THREE.MeshStandardMaterial({ color: "#0b0b22", roughness: 1, emissive: "#ffffff", emissiveMap: starTex, emissiveIntensity: 0.9 });
	k.shell({
		w: 10, d: 15, h: H,
		floor: carpet, wall: wallM, ceil: ceilM, trim: mat("#1a0d12", 0.6),
		holes: [{ wall: "s", at: 0, w: 1.42, y0: LANDING_Y, y1: LANDING_Y + 2.3 }]
	});
	// the shell is centred on z = 0; this room runs from z = -9 to +6, so slide everything built so far
	g.children.forEach(o => { o.position.z -= 1.5; });
	// outside walls in white render, like the rest of the house (the cinema stands beside the living room; you see it from the terrace)
	{
		const bm = (w, h) => mat("#ffffff", 0.88, 0, { map: k.renderTex(w / 2.4, h / 2.4) });
		const EH = H + 0.15;
		add(g, new THREE.PlaneGeometry(15.4, EH), bm(15.4, EH), 5.23, EH / 2, -1.5, { ry: Math.PI / 2, cast: false });
		add(g, new THREE.PlaneGeometry(10.4, EH), bm(10.4, EH), 0, EH / 2, -9.23, { ry: Math.PI, cast: false });
		for (const [x0, x1, y0, y1] of [[-5.2, -0.72, 0, EH], [0.72, 5.2, 0, EH], [-0.72, 0.72, LANDING_Y + 2.32, EH]]) add(g, new THREE.PlaneGeometry(x1 - x0, y1 - y0), bm(x1 - x0, y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2, 6.23, { cast: false });
	}

	k.floor(floorY);
	k.walk(-5, 5, -7.5, 6);
	// the main light switch beside the doors
	// (flipping it also takes the projector's house-lights setting back to auto, so the switch always does what it says)
	const wallSwitch = k.lightSwitch(1.05, LANDING_Y + 1.25, 5.97, Math.PI);
	{ const flip = wallSwitch.use; wallSwitch.use = () => { flip(); ctx.setShared(LKEY, "auto"); }; }
	// photo frames on the landing as you come in (2 of the house's 50)
	k.photo(45, -4.96, 3.4, 4.1, Math.PI / 2, { w: 0.6, h: 0.45, frame: "#c9a05a", metal: 0.7 });
	k.photo(46, 4.96, 3.4, 4.1, -Math.PI / 2, { w: 0.6, h: 0.45, frame: "#c9a05a", metal: 0.7 });
	k.cam = { minX: -4.75, maxX: 4.75, minZ: -7.3, maxZ: 5.78, maxY: H - 0.25 };

	// ---------------------------------------------------------------- tiers + stairs
	const riserM = mat("#24101a", 0.9);
	const tierMats = [riserM, riserM, carpet, riserM, riserM, riserM];
	for (let i = 1; i <= 4; i++) {
		const z0 = i < 4 ? ROW_Z[i] - 0.95 : LANDING_Z, z1 = 6;
		const hgt = i * TIER;
		const w = i < 4 ? BLOCK * 2 : 10;
		add(g, new THREE.BoxGeometry(w, hgt, z1 - z0), tierMats, 0, hgt / 2, (z0 + z1) / 2, { cast: false });
	}
	// aisle stairs with a strip of light on every step's edge
	const ledM = new THREE.MeshBasicMaterial({ color: "#ffb36b", toneMapped: false });
	const leds = [];
	for (const side of [-1, 1]) {
		const xc = side * (BLOCK + 5) / 2, sw = 5 - BLOCK;
		for (let n = 1; n <= 16; n++) {
			const z0 = -3.95 + n * STEP_D, hgt = n * STEP_H;
			if (z0 >= LANDING_Z) break;
			add(g, new THREE.BoxGeometry(sw, hgt, LANDING_Z - z0), tierMats, xc, hgt / 2, (z0 + LANDING_Z) / 2, { cast: false });
			leds.push(add(g, new THREE.BoxGeometry(sw - 0.1, 0.015, 0.02), ledM, xc, hgt - 0.01, z0 - 0.005, { cast: false, receive: false }));
		}
	}
	// brass handrail along the inner edge of each aisle
	const brass = mat("#c9a05a", 0.3, 0.9);
	for (const side of [-1, 1]) {
		const x = side * (BLOCK + 0.04);
		const pts = [];
		// the rail follows the slope of the stairs (a straight line from the front floor to the landing)
		const railY = z => Math.max(0, Math.min(1, (z + 3.95) / (LANDING_Z + 3.95))) * LANDING_Y + 0.9;
		pts.push(new THREE.Vector3(x, 0.9, -4.3), new THREE.Vector3(x, railY(-3.95), -3.95), new THREE.Vector3(x, railY(LANDING_Z), LANDING_Z), new THREE.Vector3(x, railY(LANDING_Z), LANDING_Z + 0.25));
		add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1), 60, 0.025, 8), brass, 0, 0, 0, { cast: false });
		for (let z = -4.2; z < LANDING_Z; z += 1.55) { const fy = floorY(x + side * 0.1, z), top = railY(Math.max(-3.95, z)); add(g, new THREE.CylinderGeometry(0.02, 0.02, top - fy, 8), brass, x, (fy + top) / 2, z, { cast: false }); }
	}
	// glass balustrade along the front of the landing (over the back row)
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe3ff", transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
	add(g, new THREE.BoxGeometry(BLOCK * 2, 0.75, 0.02), glassM, 0, LANDING_Y + 0.38, LANDING_Z + 0.04, { cast: false });
	add(g, new THREE.BoxGeometry(BLOCK * 2, 0.04, 0.06), brass, 0, LANDING_Y + 0.78, LANDING_Z + 0.04, { cast: false });
	k.box(-BLOCK, BLOCK, LANDING_Z - 0.05, LANDING_Z + 0.12);

	// ---------------------------------------------------------------- stage, screen, curtains, speakers
	const stageM = mat("#160b10", 0.7);
	add(g, new THREE.BoxGeometry(10, 0.5, 1.5), stageM, 0, 0.25, -8.25, { cast: false });
	add(g, new THREE.BoxGeometry(10, 0.02, 0.03), ledM, 0, 0.49, -7.5, { cast: false, receive: false });
	k.box(-5, 5, -9, -7.5);
	// screen: a frame, the white screen (idle picture), and the movie on top of it when one plays
	add(g, new THREE.BoxGeometry(SCREEN.w + 0.5, SCREEN.h + 0.5, 0.1), mat("#050505", 0.9), 0, SCREEN.y, SCREEN.z - 0.07, { cast: false });
	const idleCanvas = document.createElement("canvas");
	idleCanvas.width = 1024; idleCanvas.height = 576;
	const idleTex = new THREE.CanvasTexture(idleCanvas);
	idleTex.colorSpace = THREE.SRGBColorSpace;
	const screenMat = new THREE.MeshBasicMaterial({ map: idleTex, toneMapped: false });
	const screen = add(g, new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat, 0, SCREEN.y, SCREEN.z, { cast: false, receive: false });
	const HOLE = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false });
	// red velvet curtains that part when a movie starts
	const curtainGeo = new THREE.PlaneGeometry(1, H - 0.6, 40, 1);
	{
		const p = curtainGeo.attributes.position;
		for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * Math.PI * 12) * 0.05); }
		curtainGeo.translate(0.5, 0, 0);
		curtainGeo.computeVertexNormals();
	}
	const curtainM = mat("#8d1426", 0.85, 0, { side: THREE.DoubleSide });
	const cy = 0.5 + (H - 0.6) / 2;
	const curtL = add(g, curtainGeo, curtainM, -5, cy, -8.6, { cast: false });
	const curtR = add(g, curtainGeo, curtainM, 5, cy, -8.6, { cast: false });
	curtR.scale.x = -1;
	add(g, new THREE.BoxGeometry(10, 0.7, 0.3), curtainM, 0, H - 0.4, -8.6, { cast: false });   // valance
	add(g, new THREE.BoxGeometry(10, 0.06, 0.32), brass, 0, H - 0.78, -8.6, { cast: false });
	const curtains = { open: 0.92 };   // 0 closed .. 1 fully open
	// speaker towers on the stage
	for (const side of [-1, 1]) {
		const sp = group(g, side * 4.55, 0.5, -8.2);
		add(sp, rbox(0.7, 2.6, 0.6, 0.04), mat("#101012", 0.6), 0, 1.3, 0);
		for (const [y, r] of [[2.2, 0.17], [1.55, 0.24], [0.75, 0.24]]) {
			add(sp, new THREE.CylinderGeometry(r, r, 0.04, 28), mat("#2a2a2e", 0.5), 0, y, 0.31, { rx: Math.PI / 2 });
			add(sp, new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.05, 18), mat("#4a4a52", 0.4, 0.5), 0, y, 0.32, { rx: Math.PI / 2 });
		}
	}

	// ---------------------------------------------------------------- 20 recliners
	const velvet = mat("#9b1b30", 0.75);
	const velvetD = mat("#5e0f1d", 0.8);
	const blackM = mat("#151214", 0.6);
	const geo = {
		base: rbox(0.86, 0.3, 0.78, 0.05),
		cushion: rbox(0.66, 0.14, 0.62, 0.06),
		back: rbox(0.7, 0.8, 0.18, 0.08),
		head: rbox(0.5, 0.2, 0.14, 0.06),
		foot: rbox(0.62, 0.12, 0.16, 0.05),
		arm: rbox(0.16, 0.2, 0.74, 0.05),
		cup: new THREE.CylinderGeometry(0.04, 0.032, 0.15, 14),
		ring: new THREE.TorusGeometry(0.045, 0.01, 6, 16)
	};
	const cupMs = [mat("#d62839", 0.5), mat("#1d3557", 0.5), mat("#f4a261", 0.5)];
	const r0 = rng(12);
	const seatIds = new Set();
	const rowLabelTex = ROW_NAMES.split("").map(L => tex.text(L, { w: 128, h: 128, color: "#ffd38a", font: "900 96px Nunito, sans-serif" }));
	for (let r = 0; r < ROWS; r++) {
		const ty = r * TIER, z = ROW_Z[r];
		for (let c = 0; c < COLS; c++) {
			const x = (c - 2) * 1.05;
			const s = group(g, x, ty, z + 0.42);
			add(s, geo.base, velvetD, 0, 0.17, 0.02);
			add(s, geo.cushion, velvet, 0, 0.42, -0.04);
			add(s, geo.back, velvet, 0, 0.86, 0.32, { rx: 0.16 });
			add(s, geo.head, velvetD, 0, 1.2, 0.36, { rx: 0.16 });
			add(s, geo.foot, velvetD, 0, 0.2, -0.42);
			const id = `cin${r}${c}`;
			seatIds.add(id);
			k.spot({ id, x, z: z + 0.32, h: Math.PI, y: ty + 0.04 });
			k.interact("cinema:" + id, { label: `Sit in row ${ROW_NAMES[r]}, seat ${c + 1}`, stand: [x, z - 0.52], sit: [id] }, s);
		}
		// armrests (shared between neighbours) with cup holders
		for (let a = 0; a <= COLS; a++) {
			const x = (a - 2.5) * 1.05;
			add(g, geo.arm, blackM, x, ty + 0.58, z + 0.42);
			add(g, geo.ring, mat("#2a2a2e", 0.4, 0.6), x, ty + 0.69, z + 0.12, { rx: Math.PI / 2, cast: false });
			if (r0() < 0.35) {
				const cupM = cupMs[Math.floor(r0() * 3)];
				add(g, geo.cup, cupM, x, ty + 0.75, z + 0.12, { cast: false });
				add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.14, 5), mat("#ffffff", 0.5), x + 0.01, ty + 0.86, z + 0.12, { rz: 0.2, cast: false });
			}
		}
		// row letter on the aisle ends
		for (const side of [-1, 1]) add(g, new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: rowLabelTex[r], transparent: true, toneMapped: false }), side * (2.5 * 1.05 + 0.081), ty + 0.6, z + 0.6, { ry: side * Math.PI / 2, cast: false });
		k.box(-BLOCK, BLOCK, z - 0.02, z + 0.95);
	}

	// ---------------------------------------------------------------- landing: popcorn, candy bar, projector controls
	// popcorn cart
	const pop = group(g, -4.1, LANDING_Y, 5.1, Math.PI / 2);
	const redM = mat("#c1121f", 0.45);
	add(pop, rbox(0.9, 0.8, 0.6, 0.04), redM, 0, 0.55, 0);
	for (const sx of [-0.35, 0.35]) add(pop, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), mat("#f1c453", 0.4, 0.5), sx, 0.14, 0.31, { rx: Math.PI / 2 });
	const popGlass = new THREE.MeshPhysicalMaterial({ color: "#fff6e0", transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
	add(pop, new THREE.BoxGeometry(0.84, 0.66, 0.54), popGlass, 0, 1.28, 0, { cast: false });
	add(pop, rbox(0.92, 0.1, 0.62, 0.03), redM, 0, 1.66, 0);
	for (const sx of [-0.43, 0.43]) for (const sz of [-0.28, 0.28]) add(pop, new THREE.BoxGeometry(0.03, 0.66, 0.03), mat("#f1c453", 0.3, 0.7), sx, 1.28, sz, { cast: false });
	const kernelM = mat("#fff0b8", 0.8, 0, { emissive: "#ffcf7a", emissiveIntensity: 0.25 });
	const kernelGeo = new THREE.IcosahedronGeometry(0.025, 0);
	for (let i = 0; i < 140; i++) {
		const kx = (r0() - 0.5) * 0.74, kz = (r0() - 0.5) * 0.44;
		add(pop, kernelGeo, kernelM, kx, 0.98 + r0() * 0.16 * (1 - Math.abs(kx)), kz, { cast: false, receive: false });
	}
	const kettle = add(pop, new THREE.CylinderGeometry(0.13, 0.1, 0.14, 16), mat("#d9dde2", 0.25, 0.9), 0, 1.5, 0, { cast: false });
	const popSign = tex.text("POPCORN", { w: 512, h: 128, color: "#fff4d6", bg: "#c1121f", font: "900 92px Nunito, sans-serif" });
	add(pop, new THREE.PlaneGeometry(0.84, 0.21), new THREE.MeshBasicMaterial({ map: popSign, toneMapped: false }), 0, 1.86, 0, { cast: false });
	add(pop, new THREE.BoxGeometry(0.88, 0.25, 0.04), redM, 0, 1.86, -0.03);
	// the kernels that pop up inside the glass
	const popping = [];
	for (let i = 0; i < 10; i++) { const m = add(pop, kernelGeo, kernelM, 0, 1.45, 0, { cast: false, receive: false }); m.visible = false; m.userData.t = -1; popping.push(m); }
	k.box(-4.45, -3.75, 4.6, 5.6);
	k.interact("cinema:popcorn", { label: () => ctx.me().holding === "popcorn" ? "Get a fresh bucket of popcorn" : "Get some popcorn", stand: [-3.35, 5.1], face: -Math.PI / 2, use: getPopcorn }, pop);
	// candy bar with a glowing menu board
	const candy = group(g, 4.1, LANDING_Y, 5.1, -Math.PI / 2);
	add(candy, rbox(1.0, 0.95, 0.55, 0.03), mat("#1d1418", 0.5), 0, 0.48, 0);
	add(candy, rbox(1.06, 0.05, 0.6, 0.02), brass, 0, 0.97, 0);
	const candyCols = ["#ff4d6d", "#ffd166", "#06d6a0", "#118ab2", "#f78c6b", "#c77dff"];
	for (let i = 0; i < 6; i++) {
		const jar = group(candy, -0.38 + i * 0.15, 1.0, 0.05);
		add(jar, new THREE.CylinderGeometry(0.06, 0.06, 0.2, 14), popGlass, 0, 0.1, 0, { cast: false });
		for (let j = 0; j < 6; j++) add(jar, new THREE.SphereGeometry(0.022, 8, 6), mat(candyCols[(i + j) % 6], 0.4), (r0() - 0.5) * 0.06, 0.03 + j * 0.022, (r0() - 0.5) * 0.06, { cast: false });
	}
	const menuTex = canvasTex(512, 256, (c, w, h) => {
		c.fillStyle = "#120a10"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "#ff4d8a"; c.lineWidth = 6; c.shadowColor = "#ff4d8a"; c.shadowBlur = 16; c.strokeRect(14, 14, w - 28, h - 28);
		c.shadowBlur = 0; c.fillStyle = "#ffe3ee"; c.font = "900 46px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("SNACKS", w / 2, 72);
		c.font = "700 28px Nunito, sans-serif"; c.fillStyle = "#ffd38a";
		["Popcorn ........ free", "Candy ............ free", "Hugs .......... always"].forEach((t, i) => c.fillText(t, w / 2, 122 + i * 40));
	});
	add(candy, new THREE.PlaneGeometry(0.95, 0.475), new THREE.MeshBasicMaterial({ map: menuTex, toneMapped: false }), 0, 1.65, -0.2, { cast: false });
	k.box(3.75, 4.45, 4.6, 5.6);
	// projector controls on a little podium by the door
	const pod = group(g, 1.7, LANDING_Y, 5.25, Math.PI);
	add(pod, rbox(0.42, 1.0, 0.34, 0.03), mat("#1d1418", 0.5), 0, 0.5, 0);
	add(pod, rbox(0.5, 0.05, 0.42, 0.02), brass, 0, 1.02, 0, { rx: -0.25 });
	const podScreen = canvasTex(256, 192, (c, w, h) => {
		c.fillStyle = "#0a1020"; c.fillRect(0, 0, w, h);
		c.fillStyle = "#41e0ff"; c.font = "800 30px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("PROJECTOR", w / 2, 50);
		c.beginPath(); c.moveTo(w / 2 - 22, 80); c.lineTo(w / 2 + 28, 110); c.lineTo(w / 2 - 22, 140); c.closePath(); c.fill();
	});
	add(pod, new THREE.PlaneGeometry(0.38, 0.28), new THREE.MeshBasicMaterial({ map: podScreen, toneMapped: false }), 0, 1.05, -0.02, { rx: -Math.PI / 2 + 0.25, cast: false });
	k.box(1.45, 1.95, 5.05, 5.45);
	k.interact("cinema:projector", { label: "Movie controls", stand: [1.7, 4.65], face: 0, use: openControls }, pod);
	// projector booth window above the door, and the beam of light when a movie plays
	add(g, new THREE.BoxGeometry(0.9, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: "#fff3d6", toneMapped: false }), 0, 4.9, 5.97, { cast: false });
	add(g, new THREE.BoxGeometry(1.0, 0.6, 0.08), mat("#1a0d12", 0.6), 0, 4.9, 5.99, { cast: false });
	const beamLen = Math.hypot(5.95 - SCREEN.z, 4.9 - SCREEN.y);
	const beamGeo = new THREE.CylinderGeometry(0.12, 3.0, beamLen, 24, 1, true);
	const beamM = new THREE.MeshBasicMaterial({ color: "#cfe2ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
	const beam = new THREE.Mesh(beamGeo, beamM);
	// narrow end at the booth window, wide end on the screen
	beam.position.set(0, (4.9 + SCREEN.y) / 2, (5.95 + SCREEN.z) / 2);
	beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 4.9 - SCREEN.y, 5.95 - SCREEN.z).normalize());
	beam.renderOrder = 5;
	g.add(beam);

	// the doors out to the lounge's balcony are the lounge's (French doors with curtains)
	k.walk(-0.7, 0.7, 5.0, 6.7);

	// side-wall sconces
	const sconceM = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffb46b", emissiveIntensity: 1.4, side: THREE.DoubleSide });
	const sconces = [];
	for (const side of [-1, 1]) for (const [z, y] of [[-5.5, 2.4], [-1.5, 2.9], [2.5, 3.7]]) {
		const sc = group(g, side * 4.95, y, z, -side * Math.PI / 2);
		add(sc, new THREE.CylinderGeometry(0.16, 0.06, 0.3, 18, 1, true), sconceM, 0, 0, 0.12, { cast: false });
		add(sc, new THREE.BoxGeometry(0.06, 0.06, 0.12), brass, 0, -0.12, 0.06, { cast: false });
		sconces.push(sc);
	}

	// ---------------------------------------------------------------- light
	const L = {
		sc: [k.light(-4.5, 2.6, -5.5, "#ffb46b", 3, 6), k.light(4.5, 2.6, -5.5, "#ffb46b", 3, 6), k.light(-4.5, 3.9, 2.5, "#ffb46b", 3, 6), k.light(4.5, 3.9, 2.5, "#ffb46b", 3, 6)],
		screen: k.light(0, SCREEN.y, -7.4, "#cfd8ff", 0.8, 14, 1.5),
		landing: k.light(0, LANDING_Y + 2.4, 4.8, "#ffd9a8", 3, 6),
		pop: k.light(-4.1, LANDING_Y + 1.4, 4.7, "#ffb35a", 2.2, 3.5)
	};
	k.key.pos.copy(k.V(0, H - 0.2, 0.5)); k.key.target.copy(k.V(0, 0.6, -0.5));
	k.key.angle = 1.15; k.key.distance = 16; k.key.intensity = 30; k.key.color.set("#ffe2c0");
	k.fill.pos.copy(k.V(0, 4.5, 1)); k.fill.intensity = 4; k.fill.distance = 22;
	k.hemi = 0.35; k.env = 0.2; k.exposure = 1.0;

	// ---------------------------------------------------------------- movie playback
	// LKEY: the house-lights mode from the projector (auto / on / off). (It used to share its key with the wall switch,
	// which stores true / false there - each undid the other, so neither worked.) SWKEY: the wall switch.
	// The movie is { on, kind, at, go, paused, pos, by, title } plus, by kind (see worldScreen.js):
	//   yt: yt, list, idx    video / embed: url    share: sharer, sid, src ("tab" | "file"), jog (a skip on the file)
	// Times are on the server's clock (serverNow), so a phone and a computer agree to the frame. at: when second 0 of
	// the video was (or would have been); go: playing starts / resumes at this moment - until then everyone holds still
	// at the same picture, so a resume (or a skip) starts on both screens at once, whoever's player is quicker.
	const KEY = "z:cinema:movie", LKEY = "z:cinema:lightmode", SWKEY = "z:cinema:lights";
	const LEAD = 700, START_LEAD = 1500;
	const esc = ctx.esc, now = serverNow;
	startClock();
	let here = false, cur = null, volAcc = 0, barAcc = 0, tick = 0, lastShown = "", starting = false, soundAsk = false, lastJog = null, holdT = 0, ytSeekAt = 0, upload = null;
	const movie = () => ctx.get(KEY) || { on: false, yt: "", at: 0, paused: false, pos: 0 };
	const kindOf = m => m.kind || (m.yt ? "yt" : "");
	const elapsed = m => m.paused ? (m.pos || 0) : Math.max(0, (Math.max(now(), m.go || 0) - m.at) / 1000);
	const holding = m => !m.paused && !!m.go && now() < m.go;
	// where my screen really is (pausing stops everyone on the picture the person pressing it is looking at)
	function realPos(m) {
		if (cur && cur.kind === "video" && cur.video.readyState >= 1) return cur.video.currentTime;
		if (cur && cur.kind === "yt" && cur.pl && cur.pl.time() != null && (!m.list || cur.pl.index() === m.idx)) return cur.pl.time();
		return elapsed(m);
	}
	// play from `pos` seconds, starting a moment from now on every screen together
	const playFrom = (pos, lead) => { const t = now() + (lead || LEAD); return { paused: false, pos, go: t, at: t - pos * 1000 }; };
	const playing = () => { const m = movie(), kd = kindOf(m); return !!(m.on && (kd === "yt" ? m.yt : kd === "share" ? m.sid : m.url)); };
	const keyOf = m => { const kd = kindOf(m); return kd + "|" + (kd === "yt" ? ytKey(m) : kd === "share" ? m.sid : kd === "embed" ? m.url + "|" + m.at : m.url); };
	const streamer = createStreamer(ctx, () => applyMovie(), () => { const m = movie(); if (kindOf(m) === "share" && m.sharer === ctx.MY_ID) ctx.setShared(KEY, Object.assign({}, m, { on: false })); }, onAsk);
	// someone watching my shared tab wants it paused / played: only I can, and I'm probably in that other tab -
	// so a notification and a sound as well as the toast
	function onAsk(from, what) {
		const p = ctx.peers().get(from), name = p ? p.look.name : "Someone", verb = what === "pause" ? "pause" : "play";
		ctx.toast(`<b>${esc(name)}</b> asks you to <b>${verb}</b> the movie (in the tab you're sharing)`, null, null, 9000);
		ctx.sfx("pop", 0.9);
		try { if (document.hidden && window.Notification && Notification.permission === "granted") new Notification("Harmony Cinema", { body: name + " asks you to " + verb + " the movie", tag: "cinema-ask" }); } catch (e) { /* not on this device */ }
	}
	function ytCmd(func, args) {
		if (!cur || !cur.iframe || cur.kind !== "yt" || !cur.iframe.contentWindow) return;
		try { cur.iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: args || [] }), "*"); } catch (e) { /* not ready yet */ }
	}
	// put a player on the screen for this movie (false: the right one's there already)
	function mount(m) {
		const key = keyOf(m);
		if (cur && cur.key === key) return false;
		unmount();
		const kind = kindOf(m);
		let el, iframe = null, video = null;
		if (kind === "yt" || kind === "embed") {
			el = iframe = document.createElement("iframe");
			iframe.width = "1280"; iframe.height = "720";
			iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
			iframe.allowFullscreen = true;
			// (another site's player: you may have to click its play button - in full screen, G, you can)
			if (kind === "embed") iframe.className = "cin-click";
			iframe.src = kind === "yt" ? ytEmbedSrc(m, elapsed(m)) : m.url;
		} else {
			el = video = document.createElement("video");
			video.playsInline = true;
			video.preload = "auto";
		}
		el.style.cssText = "width:1280px;height:720px;border:0;background:#000;object-fit:contain";
		const obj = new CSS3DObject(el);
		g.updateMatrixWorld(true);
		screen.getWorldPosition(obj.position);
		screen.getWorldQuaternion(obj.quaternion);
		obj.scale.setScalar(SCREEN.w / 1280);
		ctx.cssScene.add(obj);
		screen.material = HOLE;
		const mine = cur = { key, kind, obj, el, iframe, video, pl: null, hls: null, failed: false };
		if (kind === "yt") iframe.addEventListener("load", () => {
			if (cur !== mine) return;
			if (!mine.pl && iframe.contentWindow) mine.pl = followPlaylist(iframe, movie, p => ctx.setShared(KEY, Object.assign({}, movie(), p)), ytCmd, elapsed, now);
			try { iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*"); } catch (e) { /* cross-origin hiccup */ }
			setTimeout(() => sync(true), 800);
			setTimeout(() => sync(true), 2500);
		});
		if (kind === "video") loadVideo(mine, m.url, m.hls);
		return true;
	}
	function loadVideo(c, url, hls) {
		const v = c.video;
		v.addEventListener("loadedmetadata", () => { if (cur === c) vidSync(true); });
		v.addEventListener("error", () => {
			if (cur !== c || c.failed) return;
			c.failed = true;
			ctx.notice("That video wouldn't load here (the site may not allow it). Try <b>Share a tab</b> at the projector instead.");
		});
		if ((hls || isHls(url)) && !v.canPlayType("application/vnd.apple.mpegurl")) {
			loadHls().then(Hls => {
				if (cur !== c) return;
				if (!Hls.isSupported()) { ctx.notice("This browser can't play that stream."); return; }
				c.hls = new Hls();
				c.hls.loadSource(url);
				c.hls.attachMedia(v);
			}).catch(() => ctx.notice("Couldn't load the stream player - check the internet connection."));
		} else v.src = url;
	}
	function unmount() {
		if (!cur) return;
		const c = cur;
		cur = null;
		if (c.pl) c.pl.stop();
		if (c.hls) c.hls.destroy();
		ctx.cssScene.remove(c.obj);
		if (c.iframe) c.iframe.src = "about:blank";
		if (c.video) { c.video.pause(); c.video.srcObject = null; c.video.removeAttribute("src"); c.video.load(); }
		c.obj.element.remove();
		screen.material = screenMat;
	}
	// play, and if the browser won't with sound, play muted and offer a button to turn it up
	function playV(v) {
		const p = v.play();
		if (p && p.catch) p.catch(() => {
			if (v.muted) return;
			v.muted = true;
			v.play().catch(() => {});
			if (soundAsk) return;
			soundAsk = true;
			ctx.toast("The browser started the movie without sound", "Sound on", () => { soundAsk = false; if (cur && cur.video === v) { v.muted = false; v.play().catch(() => {}); } }, 15000);
		});
	}
	// hold still until the shared "go" moment, then sync again
	function holdUntilGo(m) { clearTimeout(holdT); if (holding(m)) holdT = setTimeout(() => sync(true), Math.max(0, m.go - now()) + 5); }
	function sync(hard) {
		const m = movie();
		if (!cur) return;
		if (cur.kind === "video") { vidSync(hard); return; }
		if (cur.kind !== "yt") return;
		ytCmd("unMute");
		if (m.paused || holding(m)) { ytCmd("seekTo", [elapsed(m), true]); ytCmd("pauseVideo"); holdUntilGo(m); }
		else { if (hard) { ytCmd("seekTo", [elapsed(m), true]); ytSeekAt = performance.now(); } ytCmd("playVideo"); }
		if (cur.pl) cur.pl.sync();
	}
	// YouTube drifting (it buffered, or the phone is slow): back to where everyone is
	function ytDrift() {
		const m = movie();
		if (!cur || cur.kind !== "yt" || !cur.pl || m.paused || holding(m) || performance.now() - ytSeekAt < 4000) return;
		if (m.list && cur.pl.index() !== m.idx) return;
		const t = cur.pl.time(), want = elapsed(m);
		if (t != null && Math.abs(t - want) > 1) { ytCmd("seekTo", [want, true]); ytSeekAt = performance.now(); }
	}
	// a video file: everyone on the same frame. Small differences are evened out by playing a touch faster or slower
	// (you can't see it); big ones (it buffered) with a jump. A live stream has no length: just play it.
	function vidSync(hard) {
		const m = movie(), v = cur && cur.kind === "video" ? cur.video : null;
		if (!v || v.readyState < 1) return;
		const live = !isFinite(v.duration);
		if (m.paused || holding(m)) {
			if (!v.paused) v.pause();
			v.playbackRate = 1;
			const p = elapsed(m);
			if (!live && Math.abs(v.currentTime - p) > 0.04) v.currentTime = p;
			holdUntilGo(m);
			return;
		}
		if (!live) {
			const want = elapsed(m);
			if (want >= v.duration - 0.3) { v.playbackRate = 1; if (!v.ended && Math.abs(v.currentTime - want) > 1.5) v.currentTime = Math.max(0, v.duration - 0.3); return; }   // it's over: the last picture
			const diff = v.currentTime - want;   // > 0: ahead of everyone
			if (Math.abs(diff) > 0.5 || (hard && Math.abs(diff) > 0.25)) { v.playbackRate = 1; v.currentTime = want + (v.paused ? 0 : 0.1); }
			else v.playbackRate = Math.abs(diff) < 0.05 ? 1 : 1 - Math.max(-0.1, Math.min(0.1, diff * 0.5));
		}
		if (v.paused) playV(v);
	}
	// a live share on the screen: my own (no sound - I hear it already) or the one coming in
	function attachShare() {
		if (!cur || cur.kind !== "share") return;
		const m = movie(), mine = streamer.sharing(m.sid) ? streamer.mine() : null;
		const s = mine ? new MediaStream(mine.stream.getVideoTracks()) : streamer.incoming();
		const v = cur.video;
		const same = mine ? v.srcObject && v.srcObject.getVideoTracks()[0] === s.getVideoTracks()[0] : v.srcObject === s;
		v.muted = !!mine;
		if (!same) { v.srcObject = s || null; if (s) playV(v); }
	}
	function applyMovie() {
		const m = movie(), kind = kindOf(m), on = playing();
		// my live share stays up only while it's what's on the screen (someone pressed Stop, or put on something else)
		if (streamer.mine() && !starting && !(on && kind === "share" && streamer.sharing(m.sid))) streamer.stop();
		// it says I'm sharing, but I'm not (I reloaded the page): take it down
		if (on && kind === "share" && m.sharer === ctx.MY_ID && !streamer.sharing(m.sid) && !starting) { ctx.setShared(KEY, Object.assign({}, m, { on: false })); return; }
		// the file I'm sharing follows the projector's pause / skip buttons, whoever presses them
		const f = on && kind === "share" ? streamer.file() : null;
		if (f) {
			if (m.jog && m.jog.n !== lastJog) { lastJog = m.jog.n; if (isFinite(f.duration)) f.currentTime = Math.max(0, Math.min(f.duration - 0.5, m.jog.d === 0 ? 0 : f.currentTime + m.jog.d)); }
			if (m.paused && !f.paused) f.pause();
			else if (!m.paused && f.paused && !f.ended) f.play().catch(() => {});
		}
		if (on && kind === "share" && m.sharer !== ctx.MY_ID && here) streamer.watch(m.sharer, m.sid);
		else streamer.unwatch();
		if (here && on && (kind !== "share" || streamer.sharing(m.sid) || streamer.incoming())) {
			const fresh = mount(m);
			if (kind === "share") attachShare();
			else if (!fresh) sync(true);
			drawIdle();
		} else {
			unmount();
			drawIdle(on && kind === "share" ? (ctx.peers().has(m.sharer) ? `Connecting to ${m.by || "their"}'s screen...` : `Waiting for ${m.by || "the person sharing"} to come back...`) : "");
		}
		renderControls();
	}
	function setMovie(patch) { ctx.setShared(KEY, Object.assign({}, movie(), patch, { by: ctx.profile().name })); ctx.sfx("click"); }
	// something new on the screen (a fresh state, so nothing of the last one hangs on)
	function newMovie(o, what) {
		ctx.setShared(KEY, Object.assign({ on: true, by: ctx.profile().name }, playFrom(0, START_LEAD), o));
		ctx.sfx("click");
		ctx.send({ t: "fx", kind: "sys", text: ctx.profile().name + " " + what + " in the Cinema" });
	}
	// a pasted link -> on the screen (false: it couldn't be; say() has told them why)
	async function startLink(text) {
		let s = parseSource(text);
		if (!s) { say("That doesn't look like a link. Copy the address from the video's page (or its embed code) and paste it here.", true); return false; }
		if (s.kind === "page") {
			say("Checking that link...");
			const r = await probe(s.url);
			const host = esc(sourceTitle(s.url));
			if (r && r.video) s = { kind: "video", url: s.url, hls: r.hls };
			else if (r && r.frameable === false) {
				say(`<b>${host}</b> doesn't allow its videos to play inside other pages. Open the movie there in another tab, then press <b>Share a tab</b> below and pick that tab (tick <b>Share tab audio</b>).`, true);
				return false;
			} else s = { kind: "embed", url: s.url, unsure: true };
		}
		if (s.kind === "yt") newMovie({ kind: "yt", yt: s.yt, list: s.list, idx: s.idx }, s.list ? "started a playlist" : "started a movie");
		else newMovie({ kind: s.kind, url: s.url, hls: !!s.hls, title: sourceTitle(s.url) }, "started a movie");
		say(s.unsure ? "If the screen stays blank or shows an error, that site blocks being shown here: use <b>Share a tab</b> instead." : "");
		return true;
	}
	async function startShare(kind, file) {
		starting = true;
		say(kind === "tab" ? "Pick the tab with the movie, and tick <b>Share tab audio</b>..." : "Opening the file...");
		try {
			const s = kind === "tab" ? await streamer.shareTab() : await streamer.shareFile(file);
			lastJog = null;
			if (kind === "tab" && window.Notification && Notification.permission === "default") Notification.requestPermission().catch(() => {});
			newMovie({ kind: "share", sid: s.sid, sharer: ctx.MY_ID, src: s.src, title: s.title, jog: null }, kind === "tab" ? "is sharing a tab" : "started a movie");
			say(kind === "tab" && !s.audio
				? "Sharing, but <b>no sound</b> came with it - press Stop, share again and tick <b>Share tab audio</b> (only Chrome / Edge can share a tab's sound)."
				: kind === "tab" ? "Sharing! Play the movie in that tab. Tip: drag that tab into its own window so you can come back to the cinema while it plays." : "");
		} catch (e) {
			const n = e && e.name;
			say(n === "NotAllowedError" || n === "AbortError" ? "" : esc((e && e.message) || "Couldn't start sharing."), n !== "NotAllowedError" && n !== "AbortError");
		} finally {
			starting = false;
			applyMovie();
		}
	}

	// ---------------------------------------------------------------- transport (the panel, the bar and the keys all use these)
	function togglePause() {
		const m = movie();
		if (!playing()) return;
		// someone else's shared tab: only they can pause it - ask them
		if (kindOf(m) === "share" && m.src === "tab") {
			if (streamer.sharing(m.sid)) { osd("Pause it in the tab you're sharing"); return; }
			const what = m.asked === "pause" ? "play" : "pause";
			streamer.ask(what);
			osd(`Asked ${esc(m.by || "them")} to ${what}`);
			ctx.setShared(KEY, Object.assign({}, m, { asked: what }));
			return;
		}
		if (kindOf(m) === "embed") { osd("Use the player's own buttons for this one (full screen: G, then click it)"); return; }
		if (m.paused) { setMovie(playFrom(m.pos || 0)); osd("Play"); }
		else { setMovie({ paused: true, pos: realPos(m), go: 0 }); osd("Paused"); }
	}
	function skip(d) {
		const m = movie();
		if (!playing() || !canSkip(m)) return;
		if (kindOf(m) === "share") setMovie({ jog: { d, n: Math.random() } });
		else if (m.paused) setMovie({ pos: Math.max(0, (m.pos || 0) + d) });
		else setMovie(playFrom(Math.max(0, realPos(m) + d)));
		osd((d < 0 ? "Back " : "Forward ") + (Math.abs(d) >= 60 ? Math.abs(d) / 60 + " min" : Math.abs(d) + " s"));
	}
	function step(dir) {
		const p = playlistStep(movie(), dir, cur && cur.pl ? cur.pl.index() : -1, now());
		if (p) { setMovie(p); osd(dir > 0 ? "Next video" : "Previous video"); }
	}
	function restart() {
		const m = movie();
		if (!playing()) return;
		if (kindOf(m) === "share") setMovie({ jog: { d: 0, n: Math.random() }, paused: false });
		else setMovie(Object.assign({ on: true }, playFrom(0, START_LEAD)));
		osd("From the start");
	}
	function stopMovie() { setMovie({ on: false, paused: false, pos: 0 }); osd("Stopped"); }
	const canSkip = m => { const kd = kindOf(m); return kd === "yt" || kd === "video" || (kd === "share" && m.src === "file"); };
	// why this device can't share (null: it can)
	function shareBlock(kind) {
		if (!window.isSecureContext) return `Your browser only allows sharing on a secure page. This one was opened over <b>http://</b>, so it's blocked. Open the world over <b>https://</b> (your site's address with a padlock), or on the server computer itself at <b>http://localhost:8550</b>. Uploading a movie and pasting links work fine as it is.`;
		if (kind === "tab" && !canShareTab()) return "Phones and tablets can't share a tab - do it from the computer (Chrome or Edge), and it shows up here. On this device, <b>Upload a movie</b> or paste a link instead.";
		if (kind === "file" && !canShareFile()) return "This browser can't stream a file live. Use <b>Upload a movie</b> instead - it plays in sync on every device.";
		return null;
	}

	// ---------------------------------------------------------------- a little message on screen ("Paused", "Mrt skipped ahead")
	let osdEl = null, osdT = 0;
	function osd(text) {
		if (!osdEl) { osdEl = document.createElement("div"); osdEl.id = "cin-osd"; document.body.appendChild(osdEl); }
		osdEl.innerHTML = text;
		osdEl.classList.add("on");
		clearTimeout(osdT);
		osdT = setTimeout(() => osdEl.classList.remove("on"), 1600);
	}

	// ---------------------------------------------------------------- the control bar while you're sitting watching (touch friendly)
	let bar = null;
	function makeBar() {
		bar = document.createElement("div");
		bar.id = "cin-bar";
		bar.innerHTML = `<button data-b="back">-10s</button><button data-b="pause" class="main">Pause</button><button data-b="fwd">+10s</button><button data-b="next">Next</button><span class="t"></span><button data-b="menu">Controls</button>`;
		bar.addEventListener("pointerdown", e => e.stopPropagation());
		bar.querySelectorAll("[data-b]").forEach(b => b.onclick = e => {
			e.stopPropagation();
			({ back: () => skip(-10), fwd: () => skip(10), pause: togglePause, next: () => step(1), menu: openControls })[b.dataset.b]();
			b.blur();
		});
		document.body.appendChild(bar);
	}
	const seated = () => { const me = ctx.me(); return !!(me.sit && seatIds.has(me.sit)); };
	function renderBar() {
		const m = movie(), want = here && playing() && (seated() || ctx.tvMode());
		if (!want) { if (bar) bar.classList.remove("on"); return; }
		if (!bar) makeBar();
		const kd = kindOf(m), tabViewer = kd === "share" && m.src === "tab" && !streamer.sharing(m.sid);
		bar.classList.add("on");
		const pb = bar.querySelector('[data-b="pause"]');
		pb.textContent = tabViewer ? (m.asked === "pause" ? "Ask to play" : "Ask to pause") : m.paused ? "Play" : "Pause";
		pb.classList.toggle("hidden", !(canSkip(m) || kd === "yt" || tabViewer));
		bar.querySelector('[data-b="back"]').classList.toggle("hidden", !canSkip(m));
		bar.querySelector('[data-b="fwd"]').classList.toggle("hidden", !canSkip(m));
		bar.querySelector('[data-b="next"]').classList.toggle("hidden", !(kd === "yt" && m.list));
		bar.querySelector(".t").textContent = timeText();
	}

	// ---------------------------------------------------------------- keys (anywhere in the cinema, not while typing)
	//   K (or Space / Enter while seated): play / pause     J / L (or arrows while seated): back / forward 10 s
	//   Shift + J / L / arrows: a minute     N / B: next / previous in a playlist     O: the projector controls
	function onKey(k, e) {
		if (!here || (ctx.modalKind() && ctx.modalKind() !== "cinema")) return false;
		const sit = seated() || ctx.tvMode(), big = e.shiftKey ? 60 : 10;
		const act = k === "k" || (sit && k === " ") ? togglePause
			: k === "j" || (sit && k === "arrowleft") ? () => skip(-big)
			: k === "l" || (sit && k === "arrowright") ? () => skip(big)
			: k === "n" ? () => step(1) : k === "b" ? () => step(-1)
			: k === "o" ? () => (ctlOpen ? ctx.closeModal() : openControls())
			: null;
		if (!act || (k !== "o" && !playing())) return false;
		e.preventDefault();
		if (!e.repeat) act();
		return true;
	}

	// ---------------------------------------------------------------- controls panel
	let ctlOpen = false, prevM = null;
	function say(html, bad) {
		const el = ctlOpen && document.getElementById("cin-msg");
		if (!el) { if (html && bad) ctx.notice(html); return; }
		el.innerHTML = html || "";
		el.classList.toggle("bad", !!bad);
	}
	function openControls() {
		const body = ctx.openModal("cinema", "Cinema Projector", `<div class="cin">
			<div class="cin-now" id="cin-now"></div>
			<div class="row" style="gap:8px;margin-top:12px"><input id="cin-url" class="input" style="flex:1;min-width:0" placeholder="Paste any video link or embed code"><button class="btn primary" id="cin-play">Play</button></div>
			<p class="muted cin-small">YouTube (videos and playlists), Vimeo, Dailymotion, Twitch, Google Drive, Streamable, archive.org, a video file (.mp4, .webm, .m3u8...), or any page that allows it.</p>
			<div class="row cin-src" style="gap:8px;margin-top:10px;flex-wrap:wrap">
				<button class="btn" id="cin-up" title="Puts the movie on the server: it plays on every device in perfect sync, pause and skip from anyone">Upload a movie</button>
				<button class="btn" id="cin-tab" title="For sites that don't give you a link: share the browser tab the movie plays in">Share a tab</button>
				<button class="btn" id="cin-file" title="Streams a movie file from this computer live - no upload, but this computer has to stay on">Stream a file live</button>
				<input type="file" id="cin-pick" accept="video/*,.mkv,.mov,.m4v" hidden>
				<input type="file" id="cin-uppick" accept="video/*,.mkv,.mov,.m4v" hidden>
			</div>
			<div class="cin-msg" id="cin-msg"></div>
			<div class="cin-lib hidden" id="cin-lib"><span class="muted">From the media library</span><div id="cin-libl"></div></div>
			<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="cin-prev">Prev</button><button class="btn" id="cin-back">-10s</button><button class="btn" id="cin-pause">Pause</button><button class="btn" id="cin-fwd">+10s</button><button class="btn" id="cin-next">Next</button><button class="btn" id="cin-restart">Restart</button><button class="btn" id="cin-stop">Stop</button><span class="muted" id="cin-time" style="margin-left:auto;align-self:center"></span></div>
			<div class="row" style="gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap"><span class="muted" style="min-width:92px">House lights</span><button class="btn" data-l="auto">Auto</button><button class="btn" data-l="on">On</button><button class="btn" data-l="off">Off</button></div>
			<p class="muted" id="cin-hint" style="margin:14px 0 0"></p>
			<p class="muted cin-keys"><b>Keys</b> (anywhere in the cinema): <kbd>K</kbd> play / pause, <kbd>J</kbd> <kbd>L</kbd> back / forward 10 s (with <kbd>Shift</kbd>: 1 min), <kbd>N</kbd> <kbd>B</kbd> next / previous, <kbd>O</kbd> this panel. Sitting down: <kbd>Space</kbd> and the arrow keys too.</p></div>`, 560, () => { ctlOpen = false; });
		ctlOpen = true;
		const inp = body.querySelector("#cin-url"), playBtn = body.querySelector("#cin-play");
		const go = async () => {
			if (playBtn.disabled) return;
			playBtn.disabled = true;
			const ok = await startLink(inp.value).catch(() => false);
			playBtn.disabled = false;
			if (!ok) { inp.classList.add("bad"); setTimeout(() => inp.classList.remove("bad"), 900); return; }
			inp.value = "";
		};
		playBtn.onclick = go;
		inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") go(); });
		const tabBtn = body.querySelector("#cin-tab"), fileBtn = body.querySelector("#cin-file"), pick = body.querySelector("#cin-pick");
		// (always shown: if this device can't, the button says why instead of just not being there)
		tabBtn.onclick = () => { const why = shareBlock("tab"); if (why) say(why, true); else startShare("tab"); };
		fileBtn.onclick = () => { const why = shareBlock("file"); if (why) say(why, true); else pick.click(); };
		pick.onchange = () => { const f = pick.files && pick.files[0]; pick.value = ""; if (f) startShare("file", f); };
		const upPick = body.querySelector("#cin-uppick");
		body.querySelector("#cin-up").onclick = () => { if (upload) { upload.abort(); return; } upPick.click(); };
		upPick.onchange = () => { const f = upPick.files && upPick.files[0]; upPick.value = ""; if (f) startUpload(f); };
		if (upload) say(upload.msg);
		body.querySelector("#cin-pause").onclick = togglePause;
		body.querySelector("#cin-back").onclick = () => skip(-10);
		body.querySelector("#cin-fwd").onclick = () => skip(10);
		body.querySelector("#cin-prev").onclick = () => step(-1);
		body.querySelector("#cin-next").onclick = () => step(1);
		body.querySelector("#cin-restart").onclick = restart;
		body.querySelector("#cin-stop").onclick = stopMovie;
		// ("On" also flips the wall switch back on, or the room would stay dark)
		body.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { ctx.setShared(LKEY, b.dataset.l); if (b.dataset.l !== "off" && ctx.get(SWKEY) === false) ctx.setShared(SWKEY, true); });
		// the movies in the media library (anything dropped into media-library/ on the server shows up here)
		renderLibrary();
		renderControls();
		if (innerWidth > 560) setTimeout(() => inp.focus(), 60);
	}
	// the movies on the server (uploaded here, or dropped into media-library/): one click plays one for everyone
	function renderLibrary() {
		libraryVideos().then(list => {
			const body = ctlOpen && document.getElementById("mbody");
			const wrap = body && body.querySelector("#cin-lib"), l = body && body.querySelector("#cin-libl");
			if (!wrap) return;
			wrap.classList.toggle("hidden", !list.length);
			const name = v => v.title.replace(/\.[^.]+$/, "").replace(/_+/g, " ");
			l.innerHTML = list.slice(0, 60).map((v, i) => `<span class="cin-item"><button class="btn" data-v="${i}" title="${esc(name(v))}">${esc(name(v))}</button>${v.mine ? `<button class="btn cin-del" data-d="${i}" title="Delete this movie from the server">Delete</button>` : ""}</span>`).join("");
			l.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { const v = list[+b.dataset.v]; newMovie({ kind: "video", url: v.url, title: name(v) }, "started a movie"); say(""); });
			l.querySelectorAll("[data-d]").forEach(b => b.onclick = () => {
				const v = list[+b.dataset.d];
				if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sure?"; setTimeout(() => { b.dataset.sure = ""; b.textContent = "Delete"; }, 3000); return; }
				const m = movie();
				if (m.on && kindOf(m) === "video" && m.url === v.url) setMovie({ on: false });
				deleteMovie(v.url).then(ok => { say(ok ? "Deleted " + esc(name(v)) + "." : "Couldn't delete that.", !ok); renderLibrary(); });
			});
		});
	}
	// upload a movie to the server, then put it on for everyone
	function startUpload(file) {
		if (/\.mkv$/i.test(file.name)) ctx.notice("Heads up: iPhones and iPads can't play <b>.mkv</b> files - for a phone or tablet, an <b>.mp4</b> works everywhere.");
		const mb = file.size / 1048576;
		const sizeTxt = mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB";
		const t0 = performance.now();
		const job = uploadMovie(file, f => {
			const secs = (performance.now() - t0) / 1000, left = f > 0.02 ? secs / f - secs : 0;
			upload.msg = `Uploading <b>${esc(file.name)}</b> (${sizeTxt}): <b>${Math.floor(f * 100)}%</b>${left > 5 ? " - about " + (left > 90 ? Math.round(left / 60) + " min" : Math.round(left) + " s") + " left" : ""}. You can close this panel; press Upload again to cancel.`;
			say(upload.msg);
		});
		upload = { abort: () => job.abort(), msg: "Starting the upload..." };
		say(upload.msg);
		renderControls();
		job.then(r => {
			upload = null;
			newMovie({ kind: "video", url: r.url, title: r.title }, "started a movie");
			say("Uploaded! It's playing for everyone - pause and skip work from any device.");
			if (!ctlOpen) ctx.notice("Your movie finished uploading and is playing in the cinema.");
			renderLibrary();
		}).catch(e => {
			upload = null;
			say(e && e.name === "AbortError" ? "Upload cancelled." : esc((e && e.message) || "Upload failed."), !(e && e.name === "AbortError"));
		}).then(() => renderControls());
	}
	const fmt = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return (h ? h + ":" + String(mm).padStart(2, "0") : mm) + ":" + String(ss).padStart(2, "0"); };
	function timeText() {
		const m = movie(), kd = kindOf(m);
		const v = kd === "video" && cur ? cur.video : kd === "share" ? streamer.file() : null;
		return !playing() ? "" : v && v.readyState >= 1 ? fmt(v.currentTime) + (isFinite(v.duration) ? " / " + fmt(v.duration) : " live") : kd === "yt" ? fmt(realPos(m)) : "";
	}
	function renderTime() {
		const el = ctlOpen && document.getElementById("cin-time");
		if (el) el.textContent = timeText();
	}
	function renderControls() {
		renderBar();
		if (!ctlOpen || ctx.modalKind() !== "cinema") { ctlOpen = false; return; }
		const m = movie(), body = document.getElementById("mbody"), kd = kindOf(m), on = playing();
		const now = body.querySelector("#cin-now");
		const what = kd === "share" ? (m.src === "file" ? "a movie from " + ctx.esc(m.by || "their") + "'s computer" : ctx.esc(m.by || "Someone") + "'s shared tab") : "";
		if (now) now.innerHTML = on
			? `${kd === "yt" && ytThumb(m) ? `<img src="${ytThumb(m)}" alt="">` : ""}<div><b>${m.paused ? "Paused" : "Now showing"}${m.list ? " - playlist" + (m.idx >= 0 ? ", video " + (m.idx + 1) : "") : ""}${m.title ? ": " + ctx.esc(m.title) : ""}</b><span>${what ? "Live: " + what : m.by ? "Started by " + ctx.esc(m.by) : ""}${kd === "share" && streamer.sharing(m.sid) ? " - " + streamer.viewers() + " watching" : ""}</span></div>`
			: `<div class="cin-off"><b>Nothing playing</b><span>Paste a link below, upload a movie, or share a tab from a computer.</span></div>`;
		const canPause = on && canSkip(m);
		const tabViewer = on && kd === "share" && m.src === "tab" && !streamer.sharing(m.sid);
		const show = (id, yes) => { const b = body.querySelector(id); if (b) b.classList.toggle("hidden", !yes); };
		const pb = body.querySelector("#cin-pause");
		if (pb) pb.textContent = tabViewer ? (m.asked === "pause" ? "Ask to play" : "Ask to pause") : m.paused ? "Resume" : "Pause";
		show("#cin-pause", canPause || tabViewer);
		show("#cin-back", canPause); show("#cin-fwd", canPause);
		show("#cin-prev", on && kd === "yt" && !!m.list); show("#cin-next", on && kd === "yt" && !!m.list);
		show("#cin-restart", on && kd !== "share" || canPause);
		show("#cin-stop", on);
		const tb = body.querySelector("#cin-tab");
		if (tb) tb.textContent = kd === "share" && streamer.sharing(m.sid) && m.src === "tab" ? "Share a different tab" : "Share a tab";
		const ub = body.querySelector("#cin-up");
		if (ub) ub.textContent = upload ? "Cancel upload" : "Upload a movie";
		const hint = body.querySelector("#cin-hint");
		if (hint) hint.innerHTML = (kd === "embed" && on
			? "Another site's player: if it doesn't start by itself, sit down, press <b>F</b> then <b>G</b> for full screen, and click its play button. Each of you presses play at the same time - its pause and skip buttons are on the player itself. "
			: kd === "share" && m.src === "tab" && on ? (streamer.sharing(m.sid) ? "Pause and skip in the tab you're sharing - everyone sees exactly what it shows. " : "You see exactly what " + esc(m.by || "they") + " sees, live. Only they can pause it: <b>Ask to pause</b> pings them. ")
			: on ? "It plays for everyone in the cinema in sync - pause, skip and restart from any device. "
			: "<b>Best sync on a phone or tablet too:</b> upload the movie file, or paste a direct video / YouTube link. For a site with no link, share its tab from a computer. ")
			+ "Sit in any seat and press <b>F</b> for movie view, <b>G</b> for full screen - a control bar shows while you sit. Grab popcorn from the cart by the door.";
		const lm = ctx.get(LKEY) || "auto";
		body.querySelectorAll("[data-l]").forEach(b => b.classList.toggle("primary", b.dataset.l === lm));
		renderTime();
	}

	// ---------------------------------------------------------------- popcorn
	function getPopcorn() {
		const me = ctx.me();
		if (me.holding === "mug" || me.holding === "flower") { ctx.notice("Your hands are full - put that down first."); return; }
		me.holding = "popcorn"; me.sips = 6;
		ctx.doUpper("give", 900);
		ctx.updateProps(); ctx.sendPose(true);
		ctx.sfx("pop", 0.6);
		ctx.notice("You got a bucket of popcorn. <b>G</b> to eat some, or click someone to share it.");
	}
	let popT = 0;

	// ---------------------------------------------------------------- the idle screen picture
	// a plain blank screen while nothing's playing (soft light from the projector, a little darker at the edges),
	// with a line of text on it while a shared screen is on its way
	let idleText = null;
	function drawIdle(text) {
		text = text || "";
		if (text === idleText) return;
		idleText = text;
		const c = idleCanvas.getContext("2d"), w = 1024, h = 576;
		const gr = c.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, w * 0.62);
		gr.addColorStop(0, "#d8d6de"); gr.addColorStop(1, "#9c99a6");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		if (text) {
			c.fillStyle = "#2a2433"; c.font = "800 38px Nunito, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
			c.fillText(text, w / 2, h / 2, w - 80);
		}
		idleTex.needsUpdate = true;
	}
	drawIdle();

	// ---------------------------------------------------------------- every frame (while you're in here)
	let dim = 0;   // 0 = house lights up .. 1 = dark for the movie
	let hint = false, lastSit = null;
	function update(dt, t) {
		const play = playing() && !movie().paused;
		const lm = ctx.get(LKEY) || "auto";
		const wantDim = ctx.get(SWKEY) === false || lm === "off" ? 1 : lm === "on" ? 0 : play ? 1 : 0;
		dim += (wantDim - dim) * Math.min(1, dt * 1.2);
		curtains.open += ((playing() ? 1.06 : 0.92) - curtains.open) * Math.min(1, dt * 1.0);
		const cw = 5 - SCREEN.w / 2 * curtains.open - 0.2;
		curtL.scale.x = Math.max(0.6, cw); curtR.scale.x = -Math.max(0.6, cw);
		// lights
		const up = 1 - dim * 0.88;
		L.sc.forEach(l => { l.intensity = l.base * up; });
		L.landing.intensity = L.landing.base * (1 - dim * 0.7);
		L.pop.intensity = L.pop.base * (1 - dim * 0.4);
		sconceM.emissiveIntensity = 1.4 * up + 0.1;
		k.key.intensity = 30 * (1 - dim * 0.93);
		k.fill.intensity = 4 * (1 - dim * 0.8);
		k.hemi = 0.35 * (1 - dim * 0.75);
		ceilM.emissiveIntensity = 0.6 + dim * 0.5 + Math.sin(t * 0.7) * 0.08;
		ledM.color.setHSL(0.08, 1, 0.55 + dim * 0.1);
		// the screen lights the room while a movie plays (a soft flicker of colour)
		if (playing()) {
			const f = 0.75 + 0.25 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1);
			L.screen.intensity = 3.2 * f;
			L.screen.color.setHSL(0.6 + 0.08 * Math.sin(t * 0.4), 0.35, 0.75);
		} else {
			L.screen.intensity = 0.9;
			L.screen.color.set("#e8d0ff");
		}
		beamM.opacity = playing() ? 0.05 + dim * 0.03 + Math.sin(t * 9) * 0.004 : 0;
		// keep the movie in step and at the right volume
		volAcc += dt;
		if (volAcc > 0.5 && (cur || streamer.mine())) {
			volAcc = 0;
			const vol = ctx.muted() ? 0 : 1;
			if (cur && cur.kind === "yt") ytCmd("setVolume", [vol * 100]);
			if (cur && cur.video) cur.video.volume = vol;
			streamer.setVolume(vol);
			if (++tick % 2 === 0 && cur) { if (cur.kind === "video") vidSync(false); else if (cur.kind === "yt") ytDrift(); }
			if (ctlOpen) renderTime();
		}
		// sat down / stood up / movie view: the control bar comes and goes (and its clock ticks)
		barAcc += dt;
		if (barAcc > 0.25) { barAcc = 0; renderBar(); }
		// popcorn kernels popping in the cart
		popT += dt;
		popping.forEach((m, i) => {
			if (m.userData.t < 0) { if (Math.random() < dt * 1.5) { m.userData.t = 0; m.userData.vx = (Math.random() - 0.5) * 0.6; m.userData.vz = (Math.random() - 0.5) * 0.4; m.position.set(0, 1.45, 0); m.visible = true; } return; }
			m.userData.t += dt;
			const tt = m.userData.t;
			m.position.set(m.userData.vx * tt, 1.45 + 1.6 * tt - 4.9 * tt * tt, m.userData.vz * tt);
			if (m.position.y < 1.0) { m.visible = false; m.userData.t = -1; }
		});
		kettle.rotation.z = Math.sin(t * 3) * 0.05;
		// just sat down while a movie's on: offer the view from your own seat
		const sit = ctx.me().sit;
		if (sit !== lastSit) { lastSit = sit; if (sit && seatIds.has(sit) && playing() && !ctx.tvMode()) ctx.toast("Watch it through your own eyes, nothing in the way", "Movie view", ctx.enterTV, 7000); }
		if (!hint && here) {
			hint = true;
			if (!playing()) ctx.toast("Welcome to the cinema! Pick a seat, and start a movie at the projector by the doors.", "Movie controls", openControls, 9000);
		}
	}

	return {
		update,
		onEnter() { here = true; applyMovie(); },
		onLeave() { here = false; applyMovie(); renderBar(); if (ctlOpen) ctx.closeModal(); },
		onRtc: d => streamer.onRtc(d),
		applyKey(key, remote) {
			if (key === KEY) {
				const m = movie();
				applyMovie();
				const shown = playing() ? keyOf(m) : "";
				if (remote && here && shown && shown === lastShown && prevM) {
					const who = esc(m.by || "Someone");
					if (m.paused && !prevM.paused) osd(who + " paused");
					else if (!m.paused && prevM.paused) osd(who + " pressed play");
					else if (m.jog && (!prevM.jog || m.jog.n !== prevM.jog.n) || (!m.paused && m.go && m.go !== prevM.go)) osd(who + " skipped");
				}
				if (remote && here && !playing() && prevM && prevM.on) osd(esc(m.by || "Someone") + " stopped the movie");
				prevM = m;
				if (remote && shown && shown !== lastShown && here) ctx.notice(`<b>${ctx.esc(m.by || "Someone")}</b> ${kindOf(m) === "share" && m.src === "tab" ? "is sharing a tab" : "started a movie"}`);
				lastShown = shown;
			}
			if (key === LKEY || key === SWKEY) renderControls();
		},
		cssActive: () => !!cur,
		onKey,
		screenFor: id => (seatIds.has(id) ? screen : null),
		promptOpts(opts) {
			const me = ctx.me();
			const free = key => !opts.some(o => o.k === key);
			if (me.sit && seatIds.has(me.sit) && !ctx.tvMode() && free("E")) opts.unshift({ k: "E", label: playing() ? "Movie controls" : "Start a movie", fn: openControls });
			if (me.holding === "popcorn") {
				if (free("G") && me.upper !== "drink") opts.push({ k: "G", label: "Eat some popcorn", fn: eatPopcorn });
			}
		}
	};

	function eatPopcorn() {
		const me = ctx.me();
		if (me.holding !== "popcorn" || me.upper === "drink") return;
		me.sips = (me.sips || 1) - 1;
		ctx.doUpper("drink", 2600);
		ctx.sfx("pop", 0.25);
		setTimeout(() => {
			if (me.holding !== "popcorn" || me.sips > 0) return;
			me.holding = null; ctx.updateProps(); ctx.sendPose(true);
			ctx.notice("All gone! Get more from the popcorn cart.");
		}, 2600);
	}
}
