/**
 * Harmony World — the cinema: 20 recliners on stadium tiers, a giant screen.
 *
 * Local coordinates: screen wall at z = -9, back wall (entrance) at z = +6,
 * side walls at x = -5 / +5. You come in at the top, on the landing (1.8 m up),
 * and the seats step down toward the screen in four rows of five. Stairs run
 * down both sides. A YouTube video plays on the screen for everyone in the
 * room, in sync (shared key z:cinema:movie, same scheme as the living-room TV).
 */
import { CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";

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
	// outside walls in brick (the cinema stands beside the living room; you see it from the terrace)
	{
		const bm = (w, h) => mat("#ffffff", 0.95, 0, { map: k.brickTex(w / 2.4, h / 2.4) });
		const EH = H + 0.15;
		add(g, new THREE.PlaneGeometry(15.4, EH), bm(15.4, EH), 5.23, EH / 2, -1.5, { ry: Math.PI / 2, cast: false });
		add(g, new THREE.PlaneGeometry(10.4, EH), bm(10.4, EH), 0, EH / 2, -9.23, { ry: Math.PI, cast: false });
		for (const [x0, x1, y0, y1] of [[-5.2, -0.72, 0, EH], [0.72, 5.2, 0, EH], [-0.72, 0.72, LANDING_Y + 2.32, EH]]) add(g, new THREE.PlaneGeometry(x1 - x0, y1 - y0), bm(x1 - x0, y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2, 6.23, { cast: false });
	}

	k.floor(floorY);
	k.walk(-5, 5, -7.5, 6);
	// the main light switch beside the doors
	k.lightSwitch(1.05, LANDING_Y + 1.25, 5.97, Math.PI);
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
	const KEY = "z:cinema:movie", LKEY = "z:cinema:lights";
	const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;
	let here = false, yt = null, volAcc = 0, idleAcc = 0, lastShown = "";
	const movie = () => ctx.get(KEY) || { on: false, yt: "", at: 0, paused: false, pos: 0 };
	const elapsed = m => m.paused ? (m.pos || 0) : Math.max(0, (Date.now() - m.at) / 1000);
	const playing = () => { const m = movie(); return !!(m.on && m.yt); };
	function ytCmd(func, args) {
		if (!yt || !yt.iframe.contentWindow) return;
		try { yt.iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: args || [] }), "*"); } catch (e) { /* not ready yet */ }
	}
	function mount(m) {
		if (yt && yt.id === m.yt) return;
		unmount();
		const iframe = document.createElement("iframe");
		iframe.width = "1280"; iframe.height = "720";
		iframe.style.cssText = "width:1280px;height:720px;border:0;background:#000";
		iframe.allow = "autoplay; encrypted-media; picture-in-picture";
		iframe.src = `https://www.youtube.com/embed/${m.yt}?enablejsapi=1&autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&start=${Math.floor(elapsed(m))}&origin=${encodeURIComponent(location.origin)}`;
		const obj = new CSS3DObject(iframe);
		g.updateMatrixWorld(true);
		screen.getWorldPosition(obj.position);
		screen.getWorldQuaternion(obj.quaternion);
		obj.scale.setScalar(SCREEN.w / 1280);
		ctx.cssScene.add(obj);
		screen.material = HOLE;
		yt = { id: m.yt, obj, iframe };
		iframe.addEventListener("load", () => {
			try { iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*"); } catch (e) { /* cross-origin hiccup */ }
			setTimeout(() => sync(true), 800);
			setTimeout(() => sync(true), 2500);
		});
	}
	function unmount() {
		if (!yt) return;
		ctx.cssScene.remove(yt.obj);
		yt.iframe.src = "about:blank";
		yt.obj.element.remove();
		yt = null;
		screen.material = screenMat;
	}
	function sync(hard) {
		const m = movie();
		if (!yt) return;
		ytCmd("unMute");
		if (m.paused) { ytCmd("seekTo", [m.pos || 0, true]); ytCmd("pauseVideo"); }
		else { if (hard) ytCmd("seekTo", [elapsed(m), true]); ytCmd("playVideo"); }
	}
	function applyMovie() {
		const m = movie();
		if (here && m.on && m.yt) { const fresh = !yt || yt.id !== m.yt; mount(m); if (!fresh) sync(true); }
		else unmount();
		renderControls();
	}
	function setMovie(patch) { ctx.setShared(KEY, Object.assign({}, movie(), patch, { by: ctx.profile().name })); ctx.sfx("click"); }
	function startLink(url) {
		const mm = YT_RE.exec(String(url || "").trim());
		if (!mm) return false;
		setMovie({ on: true, yt: mm[1], at: Date.now(), paused: false, pos: 0 });
		ctx.send({ t: "fx", kind: "sys", text: ctx.profile().name + " started a movie in the Cinema" });
		return true;
	}

	// ---------------------------------------------------------------- controls panel
	let ctlOpen = false;
	function openControls() {
		const body = ctx.openModal("cinema", "Cinema Projector", `<div class="cin">
			<div class="cin-now" id="cin-now"></div>
			<div class="row" style="gap:8px;margin-top:12px"><input id="cin-url" class="input" style="flex:1;min-width:0" placeholder="Paste a YouTube link (movie, trailer, music video...)"><button class="btn primary" id="cin-play">Play</button></div>
			<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="cin-pause">Pause</button><button class="btn" id="cin-restart">Restart</button><button class="btn" id="cin-stop">Stop</button></div>
			<div class="row" style="gap:8px;margin-top:14px;align-items:center;flex-wrap:wrap"><span class="muted" style="min-width:92px">House lights</span><button class="btn" data-l="auto">Auto</button><button class="btn" data-l="on">On</button><button class="btn" data-l="off">Off</button></div>
			<p class="muted" style="margin:14px 0 0">The movie plays for everyone in the cinema, in sync. Sit in any seat and press <b>F</b> for movie view. Grab popcorn from the cart by the door.</p></div>`, 540, () => { ctlOpen = false; });
		ctlOpen = true;
		const inp = body.querySelector("#cin-url");
		const go = () => { if (!startLink(inp.value)) { inp.classList.add("bad"); setTimeout(() => inp.classList.remove("bad"), 900); return; } inp.value = ""; };
		body.querySelector("#cin-play").onclick = go;
		inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") go(); });
		body.querySelector("#cin-pause").onclick = () => {
			const m = movie();
			if (!m.on || !m.yt) return;
			if (m.paused) setMovie({ paused: false, at: Date.now() - (m.pos || 0) * 1000 });
			else setMovie({ paused: true, pos: elapsed(m) });
		};
		body.querySelector("#cin-restart").onclick = () => { const m = movie(); if (m.yt) setMovie({ on: true, at: Date.now(), paused: false, pos: 0 }); };
		body.querySelector("#cin-stop").onclick = () => setMovie({ on: false, paused: false, pos: 0 });
		body.querySelectorAll("[data-l]").forEach(b => b.onclick = () => ctx.setShared(LKEY, b.dataset.l));
		renderControls();
		if (innerWidth > 560) setTimeout(() => inp.focus(), 60);
	}
	function renderControls() {
		if (!ctlOpen || ctx.modalKind() !== "cinema") { ctlOpen = false; return; }
		const m = movie(), body = document.getElementById("mbody");
		const now = body.querySelector("#cin-now");
		if (now) now.innerHTML = m.on && m.yt
			? `<img src="https://img.youtube.com/vi/${m.yt}/mqdefault.jpg" alt=""><div><b>${m.paused ? "Paused" : "Now showing"}</b><span>${m.by ? "Started by " + ctx.esc(m.by) : ""}</span></div>`
			: `<div class="cin-off"><b>Nothing playing</b><span>Paste a link below to start a movie for everyone.</span></div>`;
		const pb = body.querySelector("#cin-pause");
		if (pb) { pb.textContent = m.paused ? "Resume" : "Pause"; pb.disabled = !(m.on && m.yt); }
		const lm = ctx.get(LKEY) || "auto";
		body.querySelectorAll("[data-l]").forEach(b => b.classList.toggle("primary", b.dataset.l === lm));
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
	function drawIdle(t) {
		const c = idleCanvas.getContext("2d"), w = 1024, h = 576;
		const gr = c.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h / 2, w * 0.7);
		gr.addColorStop(0, "#2a1530"); gr.addColorStop(1, "#06030a");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 40; i++) {
			const x = (i * 97 + t * 12) % w, y = (i * 53) % h;
			c.fillStyle = `rgba(255,220,240,${0.15 + 0.15 * Math.sin(t * 2 + i)})`;
			c.fillRect(x, y, 2, 2);
		}
		c.textAlign = "center";
		c.fillStyle = "#ffd38a"; c.font = "800 26px Nunito, sans-serif";
		c.fillText("WELCOME TO", w / 2, h * 0.32);
		c.save(); c.shadowColor = "#ff4d8a"; c.shadowBlur = 30; c.fillStyle = "#fff0f5";
		c.font = "900 92px Nunito, sans-serif"; c.fillText("Harmony Cinema", w / 2, h * 0.47); c.restore();
		const pulse = 0.6 + 0.4 * Math.sin(t * 2.5);
		c.fillStyle = `rgba(255,255,255,${pulse})`; c.font = "700 28px Nunito, sans-serif";
		c.fillText("Paste a YouTube link at the projector (by the door) to start a movie", w / 2, h * 0.66);
		c.fillStyle = "rgba(255,255,255,0.55)"; c.font = "600 22px Nunito, sans-serif";
		c.fillText("Pick any seat · press F for movie view · popcorn is free", w / 2, h * 0.74);
		idleTex.needsUpdate = true;
	}
	drawIdle(0);

	// ---------------------------------------------------------------- every frame (while you're in here)
	let dim = 0;   // 0 = house lights up .. 1 = dark for the movie
	let hint = false, lastSit = null;
	function update(dt, t) {
		const play = playing() && !movie().paused;
		const lm = ctx.get(LKEY) || "auto";
		const wantDim = lm === "off" ? 1 : lm === "on" ? 0 : play ? 1 : 0;
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
		// idle picture a few times a second
		if (!yt) { idleAcc += dt; if (idleAcc > 0.2) { idleAcc = 0; drawIdle(t); } }
		// keep the movie in step and at the right volume
		if (yt) {
			volAcc += dt;
			if (volAcc > 0.5) { volAcc = 0; ytCmd("setVolume", [ctx.muted() ? 0 : 100]); }
		}
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
		onLeave() { here = false; unmount(); if (ctlOpen) ctx.closeModal(); },
		applyKey(key, remote) {
			if (key === KEY) {
				const m = movie();
				applyMovie();
				if (remote && m.on && m.yt && m.yt !== lastShown && here) ctx.notice(`<b>${ctx.esc(m.by || "Someone")}</b> started a movie`);
				lastShown = m.on ? m.yt : "";
			}
			if (key === LKEY) renderControls();
		},
		cssActive: () => !!yt,
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
