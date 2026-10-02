/**
 * Harmony World — the shared living room.
 *
 * Everything is built from geometry + procedurally painted canvas textures so
 * the page loads instantly with nothing to download besides three.js.
 * buildRoom() returns handles for every object the world can change (TV,
 * arcade screen, easel, photos, plant, lights, curtains, coffee, ...).
 *
 * Room: x -7..7, z -6..6, ceiling at H. Back wall (window) is z = -6,
 * front wall (door, piano) is z = +6.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { roundRect } from "./worldAvatar.js";

export const ROOM = { minX: -7, maxX: 7, minZ: -6, maxZ: 6, H: 3.4 };

// deterministic random so the room looks identical for everyone
function rng(seed) {
	let s = seed >>> 0;
	return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function mat(color, rough = 0.7, metal = 0, extra = {}) {
	return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
}
function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
	const c = document.createElement("canvas");
	c.width = w; c.height = h;
	draw(c.getContext("2d"), w, h);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	if (repeatX !== 1 || repeatY !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY); }
	return t;
}
function rbox(w, h, d, r = 0.03, seg = 3) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)); }

function add(parent, geo, material, x = 0, y = 0, z = 0, opt = {}) {
	const m = new THREE.Mesh(geo, material);
	m.position.set(x, y, z);
	m.castShadow = opt.cast !== false;
	m.receiveShadow = opt.receive !== false;
	if (opt.rx) m.rotation.x = opt.rx;
	if (opt.ry) m.rotation.y = opt.ry;
	if (opt.rz) m.rotation.z = opt.rz;
	parent.add(m);
	return m;
}
function group(parent, x = 0, y = 0, z = 0, ry = 0) {
	const g = new THREE.Group();
	g.position.set(x, y, z);
	g.rotation.y = ry;
	parent.add(g);
	return g;
}

// ---------- procedural textures ----------
function woodFloorTex() {
	return canvasTex(1024, 1024, (g, w, h) => {
		const r = rng(7);
		const tones = ["#a8744a", "#b4804f", "#9a683f", "#ae7a4a", "#bf8b57", "#a06e45"];
		const rows = 16, ph = h / rows;
		for (let i = 0; i < rows; i++) {
			let x = -r() * 400;
			while (x < w) {
				const len = 300 + r() * 420;
				g.fillStyle = tones[Math.floor(r() * tones.length)];
				g.fillRect(x, i * ph, len, ph);
				// grain
				for (let k = 0; k < 14; k++) {
					g.strokeStyle = `rgba(${60 + r() * 30},${30 + r() * 20},10,${0.05 + r() * 0.12})`;
					g.lineWidth = 0.6 + r() * 1.6;
					g.beginPath();
					const y0 = i * ph + r() * ph;
					g.moveTo(x, y0);
					for (let s = 0; s <= 8; s++) g.lineTo(x + (len * s) / 8, y0 + Math.sin(s * 0.9 + r() * 2) * 2.2);
					g.stroke();
				}
				if (r() < 0.35) { // knot
					g.fillStyle = "rgba(70,40,20,0.25)";
					g.beginPath(); g.ellipse(x + r() * len, i * ph + ph / 2, 7 + r() * 6, 3 + r() * 2, 0, 0, Math.PI * 2); g.fill();
				}
				g.fillStyle = "rgba(40,22,10,0.55)";
				g.fillRect(x, i * ph, 2, ph);
				x += len;
			}
			g.fillStyle = "rgba(40,22,10,0.5)";
			g.fillRect(0, i * ph, w, 2);
		}
	}, ROOM.maxX * 2 / 3, ROOM.maxZ * 2 / 3);
}

function wallpaperTex(rx, ry) {
	return canvasTex(512, 512, (g, w, h) => {
		g.fillStyle = "#e9dccb"; g.fillRect(0, 0, w, h);
		for (let x = 0; x < w; x += 64) {
			g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x, 0, 28, h);
			g.fillStyle = "rgba(150,110,80,0.06)"; g.fillRect(x + 30, 0, 2, h);
		}
		// tiny leaf motif
		g.fillStyle = "rgba(160,120,90,0.12)";
		for (let y = 32; y < h; y += 64) for (let x = 46; x < w; x += 64) {
			g.beginPath(); g.ellipse(x, y + ((x / 64) % 2) * 32, 4, 9, 0.5, 0, Math.PI * 2); g.fill();
		}
	}, rx, ry);
}

function rugTex() {
	return canvasTex(1024, 768, (g, w, h) => {
		g.fillStyle = "#7a2f3a"; g.fillRect(0, 0, w, h);
		const band = (inset, color, wdt) => { g.strokeStyle = color; g.lineWidth = wdt; g.strokeRect(inset, inset, w - inset * 2, h - inset * 2); };
		band(20, "#e8c99a", 18); band(52, "#2f3e5c", 26); band(84, "#e8c99a", 6);
		// diamond pattern in border
		g.fillStyle = "#d9a65f";
		for (let x = 70; x < w - 60; x += 40) { diamond(g, x, 52, 9); diamond(g, x, h - 52, 9); }
		for (let y = 70; y < h - 60; y += 40) { diamond(g, 52, y, 9); diamond(g, w - 52, y, 9); }
		// medallion
		const cx = w / 2, cy = h / 2;
		for (let i = 6; i > 0; i--) {
			g.fillStyle = ["#2f3e5c", "#e8c99a", "#9b3d48", "#d9a65f", "#2f3e5c", "#f2e3c6"][i - 1];
			g.beginPath(); g.ellipse(cx, cy, i * 48, i * 34, 0, 0, Math.PI * 2); g.fill();
		}
		g.strokeStyle = "rgba(242,227,198,0.4)"; g.lineWidth = 3;
		for (let a = 0; a < 16; a++) {
			g.beginPath(); g.moveTo(cx, cy);
			g.lineTo(cx + Math.cos(a / 16 * Math.PI * 2) * 330, cy + Math.sin(a / 16 * Math.PI * 2) * 230); g.stroke();
		}
		// fabric noise
		const r = rng(3);
		for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2, 2); }
	});
}
function diamond(g, x, y, s) { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath(); g.fill(); }

function skyTex() {
	return canvasTex(2048, 1024, (g, w, h) => {
		const grad = g.createLinearGradient(0, 0, 0, h);
		grad.addColorStop(0, "#070b1f"); grad.addColorStop(0.55, "#1b1f4a"); grad.addColorStop(0.85, "#4b2d5e"); grad.addColorStop(1, "#8a4a6a");
		g.fillStyle = grad; g.fillRect(0, 0, w, h);
		const r = rng(11);
		for (let i = 0; i < 900; i++) {
			const s = r() * 1.8 + 0.3;
			g.fillStyle = `rgba(255,255,${220 + r() * 35},${0.3 + r() * 0.7})`;
			g.beginPath(); g.arc(r() * w, r() * h * 0.75, s, 0, Math.PI * 2); g.fill();
		}
		// moon with glow and craters
		const mx = w * 0.62, my = h * 0.26;
		const glow = g.createRadialGradient(mx, my, 40, mx, my, 260);
		glow.addColorStop(0, "rgba(255,244,214,0.55)"); glow.addColorStop(1, "rgba(255,244,214,0)");
		g.fillStyle = glow; g.fillRect(0, 0, w, h);
		g.fillStyle = "#fff6dc"; g.beginPath(); g.arc(mx, my, 70, 0, Math.PI * 2); g.fill();
		g.fillStyle = "rgba(200,190,160,0.45)";
		[[-20, -15, 14], [22, 10, 10], [-5, 28, 8], [30, -25, 6]].forEach(c => { g.beginPath(); g.arc(mx + c[0], my + c[1], c[2], 0, Math.PI * 2); g.fill(); });
		// distant city skyline with lit windows
		let x = 0;
		while (x < w) {
			const bw = 50 + r() * 120, bh = 120 + r() * 260;
			g.fillStyle = `rgb(${14 + r() * 10},${14 + r() * 10},${32 + r() * 16})`;
			g.fillRect(x, h - bh, bw, bh);
			for (let wy = h - bh + 12; wy < h - 10; wy += 18) for (let wx = x + 8; wx < x + bw - 8; wx += 14) {
				if (r() < 0.32) { g.fillStyle = r() < 0.8 ? "rgba(255,210,130,0.85)" : "rgba(160,200,255,0.8)"; g.fillRect(wx, wy, 6, 9); }
			}
			x += bw + r() * 12;
		}
	});
}

function marbleTex() {
	return canvasTex(512, 512, (g, w, h) => {
		g.fillStyle = "#f1eee9"; g.fillRect(0, 0, w, h);
		const r = rng(5);
		for (let i = 0; i < 18; i++) {
			g.strokeStyle = `rgba(120,115,120,${0.08 + r() * 0.18})`;
			g.lineWidth = 0.6 + r() * 2;
			g.beginPath();
			let x = r() * w, y = 0;
			g.moveTo(x, y);
			while (y < h) { x += (r() - 0.5) * 40; y += 20 + r() * 30; g.lineTo(x, y); }
			g.stroke();
		}
	});
}
function tileTex(rx, ry) {
	return canvasTex(256, 256, (g, w, h) => {
		g.fillStyle = "#cdd8d3"; g.fillRect(0, 0, w, h);
		for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
			const x = col * 64 + (row % 2) * 32, y = row * 32;
			g.fillStyle = row % 3 ? "#eef3f1" : "#e7efec";
			g.fillRect(x + 2, y + 2, 60, 28);
			g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x + 4, y + 4, 56, 4);
		}
	}, rx, ry);
}

export function placeholderPhoto(i) {
	const hues = [[255, 179, 167], [167, 199, 231], [193, 225, 193]];
	const [r, gg, b] = hues[i % 3];
	return canvasTex(512, 400, (g, w, h) => {
		const grad = g.createLinearGradient(0, 0, w, h);
		grad.addColorStop(0, `rgb(${r},${gg},${b})`); grad.addColorStop(1, "#fdf6ec");
		g.fillStyle = grad; g.fillRect(0, 0, w, h);
		// hills + sun scene
		g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.arc(w * 0.72, h * 0.32, 42, 0, Math.PI * 2); g.fill();
		g.fillStyle = "rgba(90,120,100,0.35)";
		g.beginPath(); g.moveTo(0, h * 0.75); g.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.72); g.quadraticCurveTo(w * 0.8, h * 0.6, w, h * 0.7); g.lineTo(w, h); g.lineTo(0, h); g.fill();
		g.fillStyle = "rgba(60,50,70,0.75)";
		g.font = "700 30px 'Nunito', 'Segoe UI', sans-serif"; g.textAlign = "center";
		g.fillText("Add a memory", w / 2, h * 0.9);
	});
}

function heartShape(s = 1) {
	const sh = new THREE.Shape();
	sh.moveTo(0, -0.35 * s);
	sh.bezierCurveTo(-0.05 * s, -0.25 * s, -0.5 * s, -0.05 * s, -0.5 * s, 0.18 * s);
	sh.bezierCurveTo(-0.5 * s, 0.42 * s, -0.2 * s, 0.5 * s, 0, 0.3 * s);
	sh.bezierCurveTo(0.2 * s, 0.5 * s, 0.5 * s, 0.42 * s, 0.5 * s, 0.18 * s);
	sh.bezierCurveTo(0.5 * s, -0.05 * s, 0.05 * s, -0.25 * s, 0, -0.35 * s);
	return sh;
}
export function heartMesh(size, color) {
	const geo = new THREE.ExtrudeGeometry(heartShape(size), { depth: size * 0.25, bevelEnabled: true, bevelSize: size * 0.06, bevelThickness: size * 0.06, bevelSegments: 3, curveSegments: 16 });
	geo.center();
	return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color || "#ff4d6d", roughness: 0.35, emissive: color || "#ff4d6d", emissiveIntensity: 0.35 }));
}

// ---------- the room ----------
export function buildRoom(scene) {
	const R = rng(42);
	const colliders = [];   // {minX,maxX,minZ,maxZ}
	const interactables = {};
	const updaters = [];
	const box = (x0, x1, z0, z1) => colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
	const interact = (id, def, ...objs) => {
		def.id = id;
		def.objects = objs;
		objs.forEach(o => o.traverse(c => { c.userData.interact = id; }));
		interactables[id] = def;
		return def;
	};

	const H = ROOM.H;
	const wood = mat("#8b5a3c", 0.55);
	const darkWood = mat("#4a2f22", 0.5);
	const lightWood = mat("#c89a6a", 0.6);
	const white = mat("#f5f1ea", 0.6);
	const brass = mat("#c9a05a", 0.3, 0.9);
	const chrome = mat("#d9dde2", 0.18, 1);
	const blackGloss = new THREE.MeshPhysicalMaterial({ color: "#0e0e10", roughness: 0.18, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });

	// Floor
	const floorTex = woodFloorTex();
	const floor = add(scene, new THREE.PlaneGeometry(14, 12), mat("#ffffff", 0.62, 0, { map: floorTex }), 0, 0, 0, { rx: -Math.PI / 2, cast: false });
	floor.userData.floor = true;
	// Ceiling
	add(scene, new THREE.PlaneGeometry(14, 12), mat("#f3ece2", 0.95), 0, H, 0, { rx: Math.PI / 2, cast: false });

	// Walls (back wall has a real opening so moonlight comes through the window)
	const wallSeg = (w, h, x, y, z, ry) => {
		const t = wallpaperTex(w / 1.6, h / 1.6);
		const m = add(scene, new THREE.BoxGeometry(w, h, 0.2), mat("#ffffff", 0.9, 0, { map: t }), x, y, z, { ry });
		return m;
	};
	const win = { x0: 1.7, x1: 4.3, y0: 0.9, y1: 2.7 };
	wallSeg(win.x0 + 7, H, (-7 + win.x0) / 2, H / 2, -6.1, 0);
	wallSeg(7 - win.x1, H, (7 + win.x1) / 2, H / 2, -6.1, 0);
	wallSeg(win.x1 - win.x0, win.y0, (win.x0 + win.x1) / 2, win.y0 / 2, -6.1, 0);
	wallSeg(win.x1 - win.x0, H - win.y1, (win.x0 + win.x1) / 2, (H + win.y1) / 2, -6.1, 0);
	wallSeg(14, H, 0, H / 2, 6.1, Math.PI);
	wallSeg(12.4, H, -7.1, H / 2, 0, Math.PI / 2);
	wallSeg(12.4, H, 7.1, H / 2, 0, -Math.PI / 2);
	// skirting + crown moulding
	const trim = mat("#fbf7f0", 0.5);
	[[0, -5.99, 14, 0], [0, 5.99, 14, 0], [-6.99, 0, 12, 1], [6.99, 0, 12, 1]].forEach(([x, z, len, side]) => {
		add(scene, new THREE.BoxGeometry(side ? 0.03 : len, 0.12, side ? len : 0.03), trim, x, 0.06, z);
		add(scene, new THREE.BoxGeometry(side ? 0.06 : len, 0.08, side ? len : 0.06), trim, x, H - 0.04, z);
	});

	// Night sky + window
	const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false }));
	sky.position.set(3, 1.8, -9);
	scene.add(sky);
	const frameM = mat("#fbf8f2", 0.45);
	const wcx = (win.x0 + win.x1) / 2, wcy = (win.y0 + win.y1) / 2, ww = win.x1 - win.x0, wh = win.y1 - win.y0;
	add(scene, new THREE.BoxGeometry(ww + 0.16, 0.08, 0.26), frameM, wcx, win.y1 + 0.04, -6.05);
	add(scene, new THREE.BoxGeometry(ww + 0.36, 0.06, 0.36), frameM, wcx, win.y0 - 0.01, -5.95);
	add(scene, new THREE.BoxGeometry(0.08, wh, 0.26), frameM, win.x0 - 0.04, wcy, -6.05);
	add(scene, new THREE.BoxGeometry(0.08, wh, 0.26), frameM, win.x1 + 0.04, wcy, -6.05);
	add(scene, new THREE.BoxGeometry(0.05, wh, 0.06), frameM, wcx, wcy, -6.1);
	add(scene, new THREE.BoxGeometry(ww, 0.05, 0.06), frameM, wcx, wcy + 0.2, -6.1);
	const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshPhysicalMaterial({ color: "#cfe3ff", transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, depthWrite: false }));
	glass.position.set(wcx, wcy, -6.12);
	scene.add(glass);
	// little succulents on the sill
	for (let i = 0; i < 3; i++) {
		const px = win.x0 + 0.5 + i * 0.8;
		add(scene, new THREE.CylinderGeometry(0.06, 0.045, 0.09, 14), mat(["#c86b4a", "#e6dccf", "#6f8fa3"][i], 0.7), px, win.y0 + 0.07, -5.92);
		for (let k = 0; k < 6; k++) {
			const leaf = add(scene, new THREE.SphereGeometry(0.03, 8, 6), mat("#5f9a6a", 0.6), px + Math.cos(k) * 0.025, win.y0 + 0.13 + (k % 2) * 0.02, -5.92 + Math.sin(k) * 0.025);
			leaf.scale.set(0.6, 1.4, 0.6);
		}
	}

	// Curtains on a brass rod (animated open/closed)
	add(scene, new THREE.CylinderGeometry(0.018, 0.018, ww + 1.4, 10), brass, wcx, win.y1 + 0.22, -5.86, { rz: Math.PI / 2 });
	const curtainGeo = new THREE.PlaneGeometry(1, 2.35, 48, 1);
	{
		const p = curtainGeo.attributes.position;
		for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * Math.PI * 9) * 0.035); }
		curtainGeo.translate(0.5, 0, 0);
		curtainGeo.computeVertexNormals();
	}
	const curtainM = mat("#b5677a", 0.95, 0, { side: THREE.DoubleSide });
	const curtL = new THREE.Mesh(curtainGeo, curtainM);
	curtL.position.set(win.x0 - 0.55, win.y1 + 0.2 - 1.175, -5.84);
	curtL.castShadow = true;
	const curtR = new THREE.Mesh(curtainGeo, curtainM);
	curtR.position.set(win.x1 + 0.55, curtL.position.y, -5.84);
	curtR.scale.x = -1;
	curtR.castShadow = true;
	scene.add(curtL, curtR);
	const curtains = { open: true, k: 1 };
	updaters.push(dt => {
		curtains.k += ((curtains.open ? 1 : 0) - curtains.k) * Math.min(1, dt * 3);
		const s = 0.5 + (1 - curtains.k) * 1.38;
		curtL.scale.x = s; curtR.scale.x = -s;
	});
	interact("curtains", { label: () => curtains.open ? "Close the curtains" : "Open the curtains", stand: [3, -4.9] }, curtL, curtR, glass);

	// Fairy string lights across the back wall
	const bulbs = [];
	{
		const pts = [];
		for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector3(-0.6 + u * 6.6, 3.1 - Math.sin(u * Math.PI * 3) ** 2 * 0.22, -5.95)); }
		const curve = new THREE.CatmullRomCurve3(pts);
		add(scene, new THREE.TubeGeometry(curve, 80, 0.004, 4), mat("#2d3a2d", 0.6), 0, 0, 0, { cast: false });
		const cols = ["#ffd27a", "#ff9fb2", "#a6e3ff", "#ffe6a8", "#c7f0b0"];
		for (let i = 0; i < 30; i++) {
			const p = curve.getPoint(i / 29);
			const c = cols[i % cols.length];
			const b = add(scene, new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2 }), p.x, p.y - 0.03, p.z + 0.02, { cast: false });
			b.userData.ph = R() * 6;
			bulbs.push(b);
		}
	}
	const fairyLight = new THREE.PointLight("#ffc98a", 1.5, 6, 2);
	fairyLight.position.set(2.5, 2.8, -5.5);
	scene.add(fairyLight);
	updaters.push((dt, t) => bulbs.forEach(b => { b.material.emissiveIntensity = (1.4 + Math.sin(t * 2 + b.userData.ph) * 0.9) * (b.userData.k || 1); }));

	// Wall clock (shows the real time)
	const clock = group(scene, 0.4, 2.45, -5.97);
	add(clock, new THREE.CylinderGeometry(0.28, 0.28, 0.04, 40), mat("#fdfaf3", 0.4), 0, 0, 0.02, { rx: Math.PI / 2 });
	add(clock, new THREE.TorusGeometry(0.28, 0.025, 10, 40), brass, 0, 0, 0.04);
	for (let i = 0; i < 12; i++) {
		const a = i / 12 * Math.PI * 2;
		add(clock, new THREE.BoxGeometry(0.012, i % 3 ? 0.03 : 0.055, 0.005), mat("#2a2225"), Math.sin(a) * 0.235, Math.cos(a) * 0.235, 0.045, { rz: -a, cast: false });
	}
	const hand = (len, w, z, c) => { const g = group(clock, 0, 0, z); add(g, new THREE.BoxGeometry(w, len, 0.004), mat(c, 0.4), 0, len / 2 - 0.02, 0, { cast: false }); return g; };
	const hH = hand(0.15, 0.018, 0.048, "#2a2225"), hM = hand(0.21, 0.012, 0.052, "#2a2225"), hS = hand(0.22, 0.004, 0.056, "#c0392b");
	updaters.push(() => {
		const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
		hS.rotation.z = -s / 60 * Math.PI * 2; hM.rotation.z = -m / 60 * Math.PI * 2; hH.rotation.z = -h / 12 * Math.PI * 2;
	});

	// ------------------------------------------------------------ living area
	const rug = add(scene, new THREE.PlaneGeometry(4.6, 3.4), mat("#ffffff", 0.95, 0, { map: rugTex() }), -2.6, 0.008, -3.3, { rx: -Math.PI / 2, cast: false });
	rug.userData.floor = true;

	// TV stand + TV
	const tvg = group(scene, -2.6, 0, -5.72);
	add(tvg, rbox(2.2, 0.5, 0.44, 0.02), wood, 0, 0.3, 0);
	for (const sx of [-0.55, 0.55]) {
		add(tvg, rbox(1.0, 0.36, 0.02, 0.008), lightWood, sx, 0.3, 0.225);
		add(tvg, new THREE.BoxGeometry(0.18, 0.012, 0.012), brass, sx, 0.42, 0.24);
	}
	for (const sx of [-1.02, 1.02]) add(tvg, new THREE.CylinderGeometry(0.02, 0.015, 0.06, 8), darkWood, sx, 0.03, 0);
	add(tvg, rbox(1.95, 1.12, 0.06, 0.012), mat("#141416", 0.35, 0.3), 0, 1.3, 0.05);
	add(tvg, new THREE.BoxGeometry(0.3, 0.04, 0.2), mat("#1b1b1e", 0.4), 0, 0.57, 0);
	add(tvg, new THREE.BoxGeometry(0.05, 0.2, 0.04), mat("#1b1b1e", 0.4), 0, 0.66, 0.02);
	const tvCanvas = document.createElement("canvas");
	tvCanvas.width = 640; tvCanvas.height = 360;
	const tvTex = new THREE.CanvasTexture(tvCanvas);
	tvTex.colorSpace = THREE.SRGBColorSpace;
	const tvScreenMat = new THREE.MeshBasicMaterial({ color: "#ffffff", map: tvTex, toneMapped: false });
	const tvScreen = add(tvg, new THREE.PlaneGeometry(1.86, 1.04), tvScreenMat, 0, 1.3, 0.082, { cast: false });
	const tvLight = new THREE.PointLight("#6aa8ff", 0, 5, 2);
	tvLight.position.set(-2.6, 1.3, -5.0);
	scene.add(tvLight);
	// small speaker soundbar + decor
	add(tvg, rbox(0.9, 0.08, 0.1, 0.02), mat("#202024", 0.6), 0, 0.6, 0.12);
	add(tvg, new THREE.CylinderGeometry(0.07, 0.09, 0.22, 16), mat("#d7c9b4", 0.5), 0.85, 0.66, 0);
	add(tvg, new THREE.SphereGeometry(0.12, 12, 10), mat("#5e8f5a", 0.7), 0.85, 0.86, 0);
	box(-3.75, -1.45, -6, -5.45);
	interact("tv", { label: "Watch TV", stand: [-2.6, -3.0], face: Math.PI }, tvg);

	// Sofa (faces the TV)
	const velvet = mat("#2f5d62", 0.88);
	const velvetD = mat("#244a4e", 0.9);
	const sofa = group(scene, -2.6, 0, -1.55, Math.PI);
	add(sofa, rbox(2.4, 0.3, 0.92, 0.06), velvetD, 0, 0.27, 0);
	for (let i = -1; i <= 1; i++) add(sofa, rbox(0.76, 0.16, 0.74, 0.07), velvet, i * 0.77, 0.5, 0.06);
	add(sofa, rbox(2.4, 0.56, 0.24, 0.08), velvetD, 0, 0.62, -0.36, { rx: -0.08 });
	for (let i = -1; i <= 1; i++) add(sofa, rbox(0.74, 0.42, 0.16, 0.07), velvet, i * 0.77, 0.74, -0.22, { rx: -0.14 });
	for (const sx of [-1.12, 1.12]) add(sofa, rbox(0.2, 0.5, 0.92, 0.07), velvetD, sx, 0.45, 0);
	for (const sx of [-1.05, 1.05]) for (const sz of [-0.38, 0.38]) add(sofa, new THREE.CylinderGeometry(0.025, 0.018, 0.12, 8), brass, sx, 0.06, sz);
	const pillow1 = add(sofa, rbox(0.4, 0.38, 0.12, 0.06), mat("#e9b44c", 0.85), -0.82, 0.74, -0.08, { rx: -0.25, rz: 0.15 });
	const pillow2 = add(sofa, rbox(0.38, 0.36, 0.12, 0.06), mat("#d9867a", 0.85), 0.84, 0.74, -0.08, { rx: -0.25, rz: -0.12 });
	// knitted throw blanket draped over one arm
	add(sofa, rbox(0.5, 0.04, 0.95, 0.02), mat("#efe6d8", 1), 1.0, 0.62, 0.05, { rz: 0.35 });
	box(-3.85, -1.35, -2.05, -1.05);
	const sitSpots = [
		{ id: "sofa0", x: -3.37, z: -1.62, h: Math.PI, y: 0.15 },
		{ id: "sofa1", x: -2.6, z: -1.62, h: Math.PI, y: 0.15 },
		{ id: "sofa2", x: -1.83, z: -1.62, h: Math.PI, y: 0.15 }
	];
	interact("sofa", { label: "Sit on the sofa", stand: [-2.6, -2.4], sit: ["sofa0", "sofa1", "sofa2"] }, sofa);

	// Coffee table with the shared notebook
	const ct = group(scene, -2.6, 0, -3.5);
	add(ct, rbox(1.3, 0.06, 0.7, 0.02), lightWood, 0, 0.42, 0);
	add(ct, rbox(1.18, 0.03, 0.58, 0.01), lightWood, 0, 0.14, 0);
	for (const sx of [-0.58, 0.58]) for (const sz of [-0.28, 0.28]) add(ct, new THREE.CylinderGeometry(0.025, 0.02, 0.42, 10), darkWood, sx, 0.21, sz);
	// magazines on the lower shelf
	add(ct, new THREE.BoxGeometry(0.3, 0.02, 0.22), mat("#d44c4c", 0.6), -0.3, 0.165, 0.05, { ry: 0.2 });
	add(ct, new THREE.BoxGeometry(0.3, 0.02, 0.22), mat("#3d6fa8", 0.6), -0.28, 0.185, 0.02, { ry: -0.1 });
	const book = group(ct, 0.25, 0.455, 0.05, -0.25);
	add(book, rbox(0.34, 0.035, 0.26, 0.006), mat("#7b3f61", 0.6), 0, 0.0, 0);
	add(book, new THREE.BoxGeometry(0.32, 0.026, 0.245), mat("#fffaf0", 0.9), 0.008, 0.002, 0);
	add(book, new THREE.BoxGeometry(0.02, 0.04, 0.27), brass, -0.16, 0.0, 0);
	// TV remote (someone can pick it up; it then rides in their hand)
	const remote = group(ct, 0.45, 0.462, 0.17, 0.4);
	add(remote, rbox(0.05, 0.022, 0.16, 0.01), mat("#1d1d22", 0.45), 0, 0, 0);
	add(remote, new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), mat("#e63946", 0.3, 0, { emissive: "#e63946", emissiveIntensity: 0.4 }), 0, 0.012, -0.06, { cast: false });
	for (let i = 0; i < 6; i++) add(remote, new THREE.BoxGeometry(0.01, 0.004, 0.008), mat("#9aa0a6"), (i % 2 ? 0.01 : -0.01), 0.012, -0.02 + Math.floor(i / 2) * 0.022, { cast: false });
	interact("remote", { label: "Pick up the TV remote", stand: [-1.55, -3.3] }, remote);
	const pen = add(ct, new THREE.CylinderGeometry(0.006, 0.006, 0.15, 8), mat("#1f2d4d", 0.3, 0.4), 0.48, 0.457, -0.12, { rz: Math.PI / 2, ry: 0.6 });
	// candle on a dish
	add(ct, new THREE.CylinderGeometry(0.08, 0.07, 0.015, 20), mat("#e9e4dc", 0.3), -0.35, 0.458, -0.15);
	add(ct, new THREE.CylinderGeometry(0.045, 0.045, 0.1, 20), mat("#f6efe2", 0.6), -0.35, 0.515, -0.15);
	const flame = add(ct, new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: "#ffcf6b", toneMapped: false }), -0.35, 0.585, -0.15, { cast: false });
	flame.scale.y = 2;
	const candleLight = new THREE.PointLight("#ffb45e", 0.6, 2.5, 2);
	candleLight.position.set(-2.95, 0.7, -3.65);
	scene.add(candleLight);
	updaters.push((dt, t) => { const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07; flame.scale.set(1, 2 * f, 1); candleLight.intensity = 0.6 * f; });
	box(-3.3, -1.9, -3.88, -3.12);
	interact("notes", { label: "Open our shared notebook", stand: [-1.55, -3.5] }, book);
	// mugs from the coffee machine appear here
	const mugSpots = [[-0.05, -0.18], [0.18, -0.22], [-0.15, 0.2]];

	// Floor lamp
	const lamp = group(scene, -4.35, 0, -0.95);
	add(lamp, new THREE.CylinderGeometry(0.18, 0.2, 0.03, 24), mat("#2a2a2e", 0.3, 0.8), 0, 0.015, 0);
	add(lamp, new THREE.CylinderGeometry(0.012, 0.012, 1.55, 10), brass, 0, 0.8, 0);
	const shadeM = new THREE.MeshStandardMaterial({ color: "#f3e3c3", roughness: 0.9, side: THREE.DoubleSide, emissive: "#ffcf8a", emissiveIntensity: 0.9 });
	add(lamp, new THREE.CylinderGeometry(0.17, 0.26, 0.34, 28, 1, true), shadeM, 0, 1.62, 0, { cast: false });
	const lampBulb = add(lamp, new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({ color: "#fff1cf" }), 0, 1.55, 0, { cast: false });
	const lampLight = new THREE.PointLight("#ffc67a", 5, 7, 2);
	lampLight.position.set(-4.35, 1.5, -0.95);
	lampLight.castShadow = false;
	scene.add(lampLight);
	box(-4.6, -4.1, -1.2, -0.7);
	const lampState = { on: true };
	const setLamp = on => {
		lampState.on = on;
		lampLight.intensity = on ? 5 : 0;
		shadeM.emissiveIntensity = on ? 0.9 : 0;
		lampBulb.material.color.set(on ? "#fff1cf" : "#666");
	};
	interact("lamp", { label: () => lampState.on ? "Turn the lamp off" : "Turn the lamp on", stand: [-4.0, -0.2] }, lamp);

	// Armchair by the window
	const chairM = mat("#c7834f", 0.75);
	const arm = group(scene, 0.4, 0, -4.1, -Math.PI / 2 - 0.55);
	add(arm, rbox(0.9, 0.28, 0.85, 0.06), chairM, 0, 0.3, 0);
	add(arm, rbox(0.7, 0.14, 0.66, 0.06), mat("#d99a63", 0.8), 0, 0.5, 0.06);
	add(arm, rbox(0.9, 0.6, 0.18, 0.08), chairM, 0, 0.72, -0.34, { rx: -0.12 });
	for (const sx of [-0.4, 0.4]) add(arm, rbox(0.14, 0.42, 0.85, 0.06), chairM, sx, 0.48, 0);
	for (const sx of [-0.38, 0.38]) for (const sz of [-0.36, 0.36]) add(arm, new THREE.CylinderGeometry(0.02, 0.015, 0.16, 8), darkWood, sx, 0.08, sz);
	box(-0.05, 0.85, -4.55, -3.65);
	sitSpots.push({ id: "armchair", x: 0.4 + Math.sin(-Math.PI / 2 - 0.55) * 0.08, z: -4.1 + Math.cos(-Math.PI / 2 - 0.55) * 0.08, h: -Math.PI / 2 - 0.55, y: 0.13 });
	interact("armchair", { label: "Sit in the armchair", stand: [-0.4, -3.6], sit: ["armchair"] }, arm);

	// Ceiling pendant light (main light)
	const pend = group(scene, -1.2, 0, -2.6);
	add(pend, new THREE.CylinderGeometry(0.006, 0.006, 0.8, 6), mat("#222"), 0, H - 0.4, 0, { cast: false });
	add(pend, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), brass, 0, H - 0.02, 0, { cast: false });
	add(pend, new THREE.SphereGeometry(0.34, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: "#2e4a40", roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }), 0, H - 0.8, 0, { cast: false });
	const pendBulb = add(pend, new THREE.SphereGeometry(0.07, 14, 12), new THREE.MeshBasicMaterial({ color: "#fff3d6" }), 0, H - 0.86, 0, { cast: false });
	const mainLight = new THREE.SpotLight("#ffd9a3", 40, 14, 1.25, 0.7, 2);
	mainLight.position.set(-1.2, H - 0.9, -2.6);
	mainLight.target.position.set(-1.0, 0, -2.0);
	mainLight.castShadow = true;
	mainLight.shadow.mapSize.set(2048, 2048);
	mainLight.shadow.bias = -0.0004;
	mainLight.shadow.normalBias = 0.02;
	scene.add(mainLight, mainLight.target);
	const fill = new THREE.PointLight("#ffe2bd", 7, 16, 1.6);
	fill.position.set(1.5, H - 0.4, 1.5);
	scene.add(fill);
	const mainState = { on: true };
	const setMain = on => {
		mainState.on = on;
		mainLight.intensity = on ? 40 : 0;
		fill.intensity = on ? 7 : 0.6;
		pendBulb.material.color.set(on ? "#fff3d6" : "#555");
	};

	// ------------------------------------------------------------ right wall
	// Bookshelf
	const shelf = group(scene, 6.78, 0, -3.4, -Math.PI / 2);
	const sw = 1.6, sh = 2.1, sd = 0.38;
	add(shelf, new THREE.BoxGeometry(0.04, sh, sd), wood, -sw / 2, sh / 2, 0);
	add(shelf, new THREE.BoxGeometry(0.04, sh, sd), wood, sw / 2, sh / 2, 0);
	add(shelf, new THREE.BoxGeometry(sw, 0.02, sd), darkWood, 0, sh / 2, -sd / 2 + 0.01, { rx: Math.PI / 2 });
	const back = add(shelf, new THREE.BoxGeometry(sw, sh, 0.02), darkWood, 0, sh / 2, -sd / 2);
	back.receiveShadow = true;
	const bookCols = ["#8e3b46", "#3d5a80", "#e0a458", "#4f7c5b", "#6c4f8c", "#d9d0c1", "#c25b3b", "#2e3a4a", "#b88b4a"];
	for (let s = 0; s < 5; s++) {
		const y = 0.06 + s * 0.48;
		add(shelf, new THREE.BoxGeometry(sw, 0.03, sd), wood, 0, y, 0);
		if (s === 4) continue;
		let x = -sw / 2 + 0.05;
		while (x < sw / 2 - 0.1) {
			if (R() < 0.08 && s !== 0) { // a gap with an ornament
				add(shelf, new THREE.SphereGeometry(0.06, 14, 10), mat(R() < 0.5 ? "#e4c9a8" : "#7aa6a1", 0.3, 0.2), x + 0.08, y + 0.075, 0);
				x += 0.2; continue;
			}
			const bw = 0.03 + R() * 0.035, bh = 0.2 + R() * 0.16, bd = 0.2 + R() * 0.08;
			const bk = add(shelf, new THREE.BoxGeometry(bw, bh, bd), mat(bookCols[Math.floor(R() * bookCols.length)], 0.7), x + bw / 2, y + 0.015 + bh / 2, 0.02);
			if (R() < 0.08) { bk.rotation.z = -0.25; bk.position.x += 0.03; x += 0.05; }
			x += bw + 0.004;
		}
	}
	// small potted plant on top
	add(shelf, new THREE.CylinderGeometry(0.09, 0.07, 0.14, 16), mat("#e8e1d6", 0.6), 0.5, sh + 0.08, 0);
	for (let i = 0; i < 9; i++) {
		const lf = add(shelf, new THREE.SphereGeometry(0.05, 8, 6), mat("#4f8a57", 0.6), 0.5 + Math.cos(i * 0.7) * 0.06, sh + 0.2 + Math.sin(i * 1.3) * 0.04, Math.sin(i * 0.7) * 0.06);
		lf.scale.set(0.6, 1.5, 0.4); lf.rotation.z = Math.cos(i) * 0.8;
	}
	box(6.5, 7, -4.25, -2.55);

	// Sideboard with the record player and speakers
	const sb = group(scene, 6.72, 0, -0.9, -Math.PI / 2);
	add(sb, rbox(1.6, 0.62, 0.48, 0.02), lightWood, 0, 0.42, 0);
	for (let i = 0; i < 3; i++) {
		add(sb, rbox(0.5, 0.5, 0.02, 0.008), wood, -0.53 + i * 0.53, 0.42, 0.245);
		add(sb, new THREE.SphereGeometry(0.018, 10, 8), brass, -0.53 + i * 0.53 + 0.18, 0.45, 0.26);
	}
	for (const sx of [-0.72, 0.72]) for (const sz of [-0.18, 0.18]) add(sb, new THREE.CylinderGeometry(0.02, 0.012, 0.11, 8), darkWood, sx, 0.055, sz);
	const tt = group(sb, 0, 0.73, 0.02);
	add(tt, rbox(0.46, 0.09, 0.36, 0.015), wood, 0, 0.045, 0);
	add(tt, new THREE.CylinderGeometry(0.15, 0.15, 0.02, 40), chrome, -0.04, 0.1, 0);
	const vinylLabel = canvasTex(256, 256, (g) => {
		g.fillStyle = "#111"; g.fillRect(0, 0, 256, 256);
		for (let r = 60; r < 128; r += 3) { g.strokeStyle = `rgba(255,255,255,${0.03 + (r % 2) * 0.03})`; g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
		g.fillStyle = "#d1495b"; g.beginPath(); g.arc(128, 128, 46, 0, Math.PI * 2); g.fill();
		g.fillStyle = "#f8e9d2"; g.font = "700 15px sans-serif"; g.textAlign = "center"; g.fillText("HARMONY", 128, 124); g.fillText("RECORDS", 128, 142);
		g.fillStyle = "#111"; g.beginPath(); g.arc(128, 128, 4, 0, Math.PI * 2); g.fill();
	});
	const vinyl = add(tt, new THREE.CylinderGeometry(0.14, 0.14, 0.006, 48), [mat("#111", 0.3), mat("#fff", 0.35, 0, { map: vinylLabel }), mat("#fff", 0.35, 0, { map: vinylLabel })], -0.04, 0.114, 0);
	const toneArm = group(tt, 0.16, 0.12, -0.12);
	add(toneArm, new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16), chrome, 0, 0, 0);
	add(toneArm, new THREE.CylinderGeometry(0.005, 0.005, 0.22, 8), chrome, -0.04, 0.02, 0.1, { rx: Math.PI / 2, rz: 0.4 });
	add(toneArm, new THREE.BoxGeometry(0.02, 0.012, 0.04), mat("#222"), -0.085, 0.01, 0.2);
	for (const sx of [-0.62, 0.62]) {
		const sp = group(sb, sx, 0.73, 0);
		add(sp, rbox(0.26, 0.42, 0.26, 0.02), mat("#5a3d2b", 0.55), 0, 0.21, 0);
		add(sp, new THREE.CylinderGeometry(0.08, 0.08, 0.01, 24), mat("#1e1e22", 0.8), 0, 0.15, 0.131, { rx: Math.PI / 2, cast: false });
		add(sp, new THREE.SphereGeometry(0.03, 12, 8), mat("#333", 0.3), 0, 0.15, 0.13, { cast: false });
		add(sp, new THREE.CylinderGeometry(0.035, 0.035, 0.01, 20), mat("#1e1e22", 0.8), 0, 0.32, 0.131, { rx: Math.PI / 2, cast: false });
	}
	const record = { playing: false, toneK: 0 };
	updaters.push(dt => {
		if (record.playing) vinyl.rotation.y -= dt * 3.5;
		record.toneK += ((record.playing ? 1 : 0) - record.toneK) * Math.min(1, dt * 3);
		toneArm.rotation.y = record.toneK * 0.45;
	});
	box(6.4, 7, -1.75, -0.05);
	interact("records", { label: () => record.playing ? "Change the music" : "Play a record", stand: [5.75, -0.9], face: -Math.PI / 2 }, sb);
	// framed poster above
	const art = canvasTex(400, 520, (g, w, h) => {
		const gr = g.createLinearGradient(0, 0, 0, h);
		gr.addColorStop(0, "#f7d6bf"); gr.addColorStop(1, "#e88f7a");
		g.fillStyle = gr; g.fillRect(0, 0, w, h);
		g.fillStyle = "#fff4e0"; g.beginPath(); g.arc(w * 0.5, h * 0.38, 80, 0, Math.PI * 2); g.fill();
		g.fillStyle = "#c4515f"; g.beginPath(); g.moveTo(0, h * 0.7); g.lineTo(w * 0.35, h * 0.45); g.lineTo(w * 0.62, h * 0.7); g.fill();
		g.fillStyle = "#7a2f4a"; g.beginPath(); g.moveTo(w * 0.3, h); g.lineTo(w * 0.7, h * 0.5); g.lineTo(w, h * 0.8); g.lineTo(w, h); g.fill();
		g.fillStyle = "#3b1f33"; g.font = "700 30px serif"; g.textAlign = "center"; g.fillText("together", w / 2, h - 30);
	});
	const poster = group(scene, 6.97, 2.0, -0.9, -Math.PI / 2);
	add(poster, new THREE.BoxGeometry(0.84, 1.08, 0.04), darkWood, 0, 0, 0);
	add(poster, new THREE.PlaneGeometry(0.74, 0.98), mat("#fff", 0.8, 0, { map: art }), 0, 0, 0.021, { cast: false });

	// Arcade cabinet
	const arcade = group(scene, 6.45, 0, 1.9, -Math.PI / 2);
	{
		const prof = new THREE.Shape();
		prof.moveTo(-0.4, 0); prof.lineTo(0.38, 0); prof.lineTo(0.38, 0.92); prof.lineTo(0.5, 1.0); prof.lineTo(0.48, 1.06);
		prof.lineTo(0.32, 1.08); prof.lineTo(0.2, 1.56); prof.lineTo(0.32, 1.62); prof.lineTo(0.32, 1.88); prof.lineTo(-0.4, 1.88); prof.closePath();
		const geo = new THREE.ExtrudeGeometry(prof, { depth: 0.74, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
		geo.translate(0, 0, -0.37);
		geo.rotateY(-Math.PI / 2);
		// profile x -> local +z (front), extrusion -> local x (width)
		add(arcade, geo, new THREE.MeshPhysicalMaterial({ color: "#3b1d6e", roughness: 0.35, clearcoat: 0.6 }), 0, 0, 0);
	}
	// side art stripes
	for (const sx of [-0.385, 0.385]) {
		add(arcade, new THREE.BoxGeometry(0.004, 1.5, 0.05), mat("#ff4fa3", 0.4, 0, { emissive: "#ff4fa3", emissiveIntensity: 0.6 }), sx, 0.9, 0.2, { rx: 0.15, cast: false });
		add(arcade, new THREE.BoxGeometry(0.004, 1.5, 0.05), mat("#41e0ff", 0.4, 0, { emissive: "#41e0ff", emissiveIntensity: 0.6 }), sx, 0.9, 0.05, { rx: 0.15, cast: false });
	}
	const arcCanvas = document.createElement("canvas");
	arcCanvas.width = 384; arcCanvas.height = 288;
	const arcTex = new THREE.CanvasTexture(arcCanvas);
	arcTex.colorSpace = THREE.SRGBColorSpace;
	const arcScreen = add(arcade, new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ map: arcTex, toneMapped: false }), 0, 1.32, 0.276, { rx: -0.245, cast: false });
	add(arcade, new THREE.BoxGeometry(0.68, 0.52, 0.02), mat("#0a0a0c", 0.3), 0, 1.32, 0.264, { rx: -0.245 });
	const marquee = canvasTex(512, 128, (g, w, h) => {
		const gr = g.createLinearGradient(0, 0, w, 0);
		gr.addColorStop(0, "#ff4fa3"); gr.addColorStop(0.5, "#ffd34f"); gr.addColorStop(1, "#41e0ff");
		g.fillStyle = "#14082a"; g.fillRect(0, 0, w, h);
		g.fillStyle = gr; g.font = "900 64px 'Trebuchet MS', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
		g.fillText("ARCADE", w / 2, h / 2 + 4);
	});
	add(arcade, new THREE.PlaneGeometry(0.7, 0.22), new THREE.MeshBasicMaterial({ map: marquee, toneMapped: false }), 0, 1.75, 0.325, { cast: false });
	// control panel
	add(arcade, new THREE.BoxGeometry(0.72, 0.03, 0.18), mat("#1a1a1f", 0.4), 0, 1.06, 0.4, { rx: 0.12 });
	add(arcade, new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), chrome, -0.18, 1.1, 0.4);
	add(arcade, new THREE.SphereGeometry(0.025, 14, 10), mat("#e63946", 0.3), -0.18, 1.14, 0.4);
	["#ffd34f", "#41e0ff", "#ff4fa3", "#7ae582"].forEach((c, i) => add(arcade, new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16), mat(c, 0.3, 0, { emissive: c, emissiveIntensity: 0.4 }), 0.02 + (i % 2) * 0.08 + Math.floor(i / 2) * 0.04, 1.085, 0.37 + Math.floor(i / 2) * 0.05));
	add(arcade, new THREE.BoxGeometry(0.12, 0.08, 0.01), mat("#222", 0.5), 0, 0.5, 0.385);
	const arcadeLight = new THREE.PointLight("#9a6bff", 2.5, 3, 2);
	arcadeLight.position.set(5.8, 1.4, 1.9);
	scene.add(arcadeLight);
	box(6.0, 7, 1.45, 2.35);
	interact("arcade", { label: "Play arcade games", stand: [5.45, 1.9], face: -Math.PI / 2 }, arcade);

	// ------------------------------------------------------------ front wall
	// Upright piano + bench
	const piano = group(scene, 0.2, 0, 5.62, Math.PI);
	add(piano, rbox(1.52, 1.25, 0.34, 0.02), blackGloss, 0, 0.625, -0.12);
	add(piano, rbox(1.52, 0.08, 0.3, 0.01), blackGloss, 0, 0.72, 0.17);
	add(piano, rbox(1.52, 0.04, 0.32, 0.01), blackGloss, 0, 1.27, -0.1);
	for (const sx of [-0.72, 0.72]) {
		add(piano, rbox(0.08, 0.42, 0.34, 0.01), blackGloss, sx, 0.9, 0.18);
		add(piano, new THREE.BoxGeometry(0.07, 0.62, 0.06), blackGloss, sx, 0.31, 0.24);
		add(piano, new THREE.BoxGeometry(0.08, 0.04, 0.42), blackGloss, sx, 0.02, 0.15);
	}
	// 26 white keys from C3 (MIDI 48); each key knows its note so it can be
	// clicked and pressed down when anyone plays it
	const keyW = 1.36 / 26;
	const pianoKeys = new Map();
	const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
	const whiteNote = i => 48 + WHITE_STEPS[i % 7] + 12 * Math.floor(i / 7);
	const whiteKeyM = mat("#fbfaf6", 0.25), blackKeyM = mat("#111", 0.3);
	for (let i = 0; i < 26; i++) {
		const k = add(piano, new THREE.BoxGeometry(keyW * 0.94, 0.02, 0.15), whiteKeyM.clone(), -0.68 + keyW * (i + 0.5), 0.775, 0.24, { cast: false });
		k.userData.note = whiteNote(i); k.userData.baseY = k.position.y; k.userData.white = true;
		pianoKeys.set(k.userData.note, k);
	}
	for (let i = 0; i < 25; i++) {
		if ([2, 6].includes(i % 7)) continue;
		const k = add(piano, new THREE.BoxGeometry(keyW * 0.55, 0.03, 0.09), blackKeyM.clone(), -0.68 + keyW * (i + 1), 0.795, 0.205, { cast: false });
		k.userData.note = whiteNote(i) + 1; k.userData.baseY = k.position.y;
		pianoKeys.set(k.userData.note, k);
	}
	const keyDown = new Map(); // note -> seconds left pressed
	function pressKey(note, mine) {
		const k = pianoKeys.get(note);
		if (!k) return;
		keyDown.set(note, 0.22);
		k.material.color.set(mine ? "#ff9fbe" : "#9fd8ff");
		if (!k.userData.white) k.material.color.multiplyScalar(0.6);
	}
	updaters.push(dt => {
		keyDown.forEach((left, note) => {
			const k = pianoKeys.get(note);
			left -= dt;
			if (left <= 0) {
				keyDown.delete(note);
				k.position.y = k.userData.baseY; k.rotation.x = 0;
				k.material.color.set(k.userData.white ? "#fbfaf6" : "#111");
			} else {
				keyDown.set(note, left);
				k.position.y = k.userData.baseY - 0.009; k.rotation.x = -0.06;
			}
		});
	});
	// music stand with a sheet
	add(piano, new THREE.BoxGeometry(0.6, 0.3, 0.015), blackGloss, 0, 1.0, 0.03, { rx: -0.2 });
	const sheet = canvasTex(256, 192, (g, w, h) => {
		g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, w, h);
		g.strokeStyle = "#555"; g.lineWidth = 1;
		for (let s = 0; s < 3; s++) for (let l = 0; l < 5; l++) { const y = 30 + s * 55 + l * 6; g.beginPath(); g.moveTo(12, y); g.lineTo(w - 12, y); g.stroke(); }
		g.fillStyle = "#333";
		const r = rng(9);
		for (let s = 0; s < 3; s++) for (let n = 0; n < 12; n++) { g.beginPath(); g.ellipse(26 + n * 18, 30 + s * 55 + Math.floor(r() * 9) * 3, 4, 3, -0.3, 0, Math.PI * 2); g.fill(); }
	});
	add(piano, new THREE.PlaneGeometry(0.4, 0.28), mat("#fff", 0.9, 0, { map: sheet }), 0, 1.01, 0.04, { rx: -0.2, cast: false });
	for (let i = -1; i <= 1; i++) add(piano, new THREE.BoxGeometry(0.035, 0.012, 0.08), brass, i * 0.08, 0.04, 0.26);
	add(piano, new THREE.CylinderGeometry(0.035, 0.03, 0.03, 12), brass, 0.55, 1.3, -0.1);
	const bench = group(scene, 0.2, 0, 4.95, Math.PI);
	add(bench, rbox(0.9, 0.08, 0.36, 0.03), mat("#1d1a1c", 0.55), 0, 0.48, 0);
	for (const sx of [-0.4, 0.4]) for (const sz of [-0.14, 0.14]) add(bench, new THREE.BoxGeometry(0.04, 0.44, 0.04), blackGloss, sx, 0.22, sz);
	box(-0.6, 1.0, 5.25, 6);
	box(-0.27, 0.67, 4.78, 5.12);
	sitSpots.push({ id: "bench", x: 0.2, z: 4.9, h: 0, y: 0.06 });
	interact("piano", { label: "Play the piano", stand: [0.2, 4.4], sit: ["bench"] }, piano, bench);

	// Door + light switch
	const door = group(scene, 3.6, 0, 5.97, Math.PI);
	const doorM = mat("#7a4e34", 0.5);
	add(door, new THREE.BoxGeometry(1.14, 0.08, 0.1), trim, 0, 2.2, 0);
	for (const sx of [-0.55, 0.55]) add(door, new THREE.BoxGeometry(0.06, 2.2, 0.1), trim, sx, 1.1, 0);
	const panel = add(door, rbox(1.0, 2.14, 0.05, 0.01), doorM, 0, 1.08, 0.0);
	for (const [y, hgt] of [[1.6, 0.7], [0.62, 0.8]]) add(door, rbox(0.72, hgt, 0.03, 0.01), mat("#8a5a3e", 0.5), 0, y, 0.03);
	add(door, new THREE.SphereGeometry(0.04, 16, 12), brass, 0.38, 1.02, 0.07);
	add(door, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), brass, 0.38, 1.02, 0.04, { rx: Math.PI / 2 });
	// doormat
	const matTex = canvasTex(512, 256, (g, w, h) => {
		g.fillStyle = "#6b4a2f"; g.fillRect(0, 0, w, h);
		g.strokeStyle = "#3b2818"; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
		g.fillStyle = "#e9d7b9"; g.font = "800 72px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
		g.fillText("PIANO", w / 2, h / 2 + 6);
	});
	const dm = add(scene, new THREE.PlaneGeometry(1.1, 0.55), mat("#fff", 1, 0, { map: matTex }), 3.6, 0.01, 5.4, { rx: -Math.PI / 2, cast: false });
	dm.rotation.z = Math.PI;
	interact("door", { label: "Go back to the piano", stand: [3.6, 5.0], face: 0 }, door);
	const sw0 = group(scene, 2.75, 1.25, 5.98, Math.PI);
	add(sw0, rbox(0.09, 0.13, 0.015, 0.005), white, 0, 0, 0);
	const toggle = add(sw0, new THREE.BoxGeometry(0.025, 0.045, 0.015), mat("#ece6dc", 0.4), 0, 0, 0.012);
	interact("switch", { label: () => mainState.on ? "Turn the ceiling light off" : "Turn the ceiling light on", stand: [2.75, 5.0], face: 0 }, sw0);

	// Writing desk with the love-letter box
	const desk = group(scene, 5.6, 0, 5.55, Math.PI);
	add(desk, rbox(1.3, 0.05, 0.62, 0.01), wood, 0, 0.76, 0);
	for (const sx of [-0.6, 0.6]) for (const sz of [-0.26, 0.26]) add(desk, new THREE.CylinderGeometry(0.025, 0.018, 0.74, 10), wood, sx, 0.37, sz);
	add(desk, rbox(0.6, 0.12, 0.5, 0.01), lightWood, 0.2, 0.67, 0);
	add(desk, new THREE.SphereGeometry(0.018, 10, 8), brass, 0.2, 0.67, 0.26);
	const lb = group(desk, -0.35, 0.785, -0.08);
	add(lb, rbox(0.3, 0.24, 0.2, 0.015), mat("#b5413f", 0.45), 0, 0.12, 0);
	add(lb, new THREE.BoxGeometry(0.16, 0.012, 0.01), mat("#2b0f10"), 0, 0.19, 0.101);
	const h0 = heartMesh(0.12, "#ffd6de");
	h0.position.set(0, 0.09, 0.105);
	h0.scale.z = 0.25;
	lb.add(h0);
	const envM = mat("#f8efe1", 0.85);
	const envs = [];
	for (let i = 0; i < 4; i++) {
		const e = group(desk, 0.15 + i * 0.03, 0.79 + i * 0.008, 0.05 + i * 0.01, (i - 1.5) * 0.18);
		add(e, new THREE.BoxGeometry(0.22, 0.006, 0.15), envM, 0, 0, 0);
		add(e, new THREE.CylinderGeometry(0.018, 0.018, 0.006, 14), mat("#a4161a", 0.4), 0, 0.005, 0.02);
		envs.push(e);
	}
	// rose in a bud vase
	add(desk, new THREE.CylinderGeometry(0.03, 0.04, 0.16, 16), new THREE.MeshPhysicalMaterial({ color: "#bfe3e0", transmission: 0.6, roughness: 0.1, thickness: 0.02 }), 0.52, 0.86, -0.15);
	add(desk, new THREE.CylinderGeometry(0.004, 0.004, 0.22, 6), mat("#3d6b35"), 0.52, 1.0, -0.15);
	for (let i = 0; i < 7; i++) {
		const pe = add(desk, new THREE.SphereGeometry(0.03, 10, 8), mat("#c1121f", 0.5), 0.52 + Math.cos(i) * 0.012, 1.12 + (i % 3) * 0.008, -0.15 + Math.sin(i) * 0.012);
		pe.scale.set(0.8, 1, 0.8);
	}
	const chair = group(scene, 5.6, 0, 4.95, 0);
	add(chair, rbox(0.46, 0.05, 0.44, 0.02), wood, 0, 0.47, 0);
	for (const sx of [-0.2, 0.2]) for (const sz of [-0.19, 0.19]) add(chair, new THREE.CylinderGeometry(0.018, 0.016, 0.47, 8), wood, sx, 0.235, sz);
	for (const sx of [-0.2, 0.2]) add(chair, new THREE.CylinderGeometry(0.016, 0.016, 0.5, 8), wood, sx, 0.73, -0.2);
	for (let i = 0; i < 3; i++) add(chair, new THREE.BoxGeometry(0.4, 0.05, 0.02), wood, 0, 0.62 + i * 0.13, -0.2);
	box(4.95, 6.25, 5.25, 6);
	interact("desk", { label: "Write a love note", stand: [5.0, 4.5], face: 0.6 }, desk, chair);

	// ------------------------------------------------------------ left wall
	// Memory photo frames + console table
	const photos = [];
	for (let i = 0; i < 3; i++) {
		const z = -0.95 + i * 0.95;
		const f = group(scene, -6.97, 1.75 + (i === 1 ? 0.12 : 0), z, Math.PI / 2);
		add(f, new THREE.BoxGeometry(0.78, 0.64, 0.04), [darkWood, wood, brass][i] === brass ? mat("#b08d57", 0.35, 0.7) : [darkWood, wood][i], 0, 0, 0);
		add(f, new THREE.PlaneGeometry(0.68, 0.54), mat("#fbf8f1", 0.9), 0, 0, 0.021, { cast: false });
		const ph = add(f, new THREE.PlaneGeometry(0.58, 0.44), new THREE.MeshStandardMaterial({ map: placeholderPhoto(i), roughness: 0.5 }), 0, 0, 0.023, { cast: false });
		photos.push({
			mesh: ph,
			setImage(url) {
				if (!url) { ph.material.map = placeholderPhoto(i); ph.material.needsUpdate = true; return; }
				new THREE.TextureLoader().load(url, t => {
					t.colorSpace = THREE.SRGBColorSpace;
					const img = t.image, a = img.width / img.height, target = 0.58 / 0.44;
					// cover-crop so any photo fills the frame without stretching
					if (a > target) { t.repeat.set(target / a, 1); t.offset.set((1 - target / a) / 2, 0); }
					else { t.repeat.set(1, a / target); t.offset.set(0, (1 - a / target) / 2); }
					ph.material.map = t; ph.material.needsUpdate = true;
				});
			}
		});
		f.traverse(c => { c.userData.photoIndex = i; });
	}
	const cons = group(scene, -6.78, 0, 0, Math.PI / 2);
	add(cons, rbox(1.5, 0.04, 0.34, 0.01), darkWood, 0, 0.8, 0);
	for (const sx of [-0.7, 0.7]) add(cons, new THREE.BoxGeometry(0.04, 0.8, 0.3), darkWood, sx, 0.4, 0);
	add(cons, new THREE.CylinderGeometry(0.07, 0.05, 0.26, 20), mat("#2f4858", 0.25, 0.1), -0.45, 0.95, 0);
	for (let i = 0; i < 5; i++) add(cons, new THREE.CylinderGeometry(0.003, 0.003, 0.4, 5), mat("#7a6a50"), -0.45 + (i - 2) * 0.012, 1.2, 0, { rz: (i - 2) * 0.15, cast: false });
	add(cons, rbox(0.18, 0.24, 0.02, 0.005), mat("#d4b483", 0.4, 0.6), 0.45, 0.94, -0.05, { rx: -0.15 });
	box(-7, -6.55, -0.78, 0.78);
	interact("photos", { label: "Look at our memories", stand: [-5.8, 0], face: -Math.PI / 2 }, ...scene.children.filter(c => c.userData.photoIndex !== undefined), cons);

	// Kitchen corner: counter, coffee machine, fridge
	const counterTop = mat("#ffffff", 0.25, 0, { map: marbleTex() });
	const cab = mat("#7f9c8e", 0.55);
	const kitchen = group(scene, -6.66, 0, 3.8, Math.PI / 2);
	add(kitchen, new THREE.BoxGeometry(2.4, 0.86, 0.62), cab, 0, 0.43, 0);
	for (let i = 0; i < 4; i++) {
		add(kitchen, rbox(0.56, 0.7, 0.02, 0.008), mat("#8fae9f", 0.5), -0.9 + i * 0.6, 0.45, 0.315);
		add(kitchen, new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), chrome, -0.9 + i * 0.6 + 0.2, 0.62, 0.34);
	}
	add(kitchen, new THREE.BoxGeometry(2.46, 0.05, 0.66), counterTop, 0, 0.885, 0.01);
	add(kitchen, new THREE.PlaneGeometry(2.4, 0.62), mat("#fff", 0.3, 0, { map: tileTex(5, 1.5) }), 0, 1.22, -0.305, { cast: false });
	add(kitchen, new THREE.BoxGeometry(2.4, 0.66, 0.36), cab, 0, 1.95, -0.13);
	for (let i = 0; i < 4; i++) add(kitchen, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), chrome, -0.9 + i * 0.6 + 0.2, 1.75, 0.06, { rz: Math.PI / 2 });
	const ul = new THREE.PointLight("#ffe7c4", 1.4, 2.5, 2);
	ul.position.set(-6.5, 1.55, 3.8);
	scene.add(ul);
	// jars + fruit bowl
	const jarM = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transmission: 0.85, roughness: 0.05, thickness: 0.03, transparent: true, opacity: 0.6 });
	[[-1.0, "#6b4226"], [-0.85, "#f2e8d5"], [-0.7, "#c58940"]].forEach(([x, c]) => {
		add(kitchen, new THREE.CylinderGeometry(0.055, 0.055, 0.12, 18), mat(c, 0.9), x, 0.97, -0.15);
		add(kitchen, new THREE.CylinderGeometry(0.06, 0.06, 0.18, 18), jarM, x, 1.0, -0.15, { cast: false });
		add(kitchen, new THREE.CylinderGeometry(0.062, 0.062, 0.025, 18), lightWood, x, 1.1, -0.15);
	});
	add(kitchen, new THREE.SphereGeometry(0.14, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#e4ddd0", 0.4, 0, { side: THREE.DoubleSide }), 0.9, 1.05, 0.02);
	[[0.86, 0.02, "#f4a259"], [0.95, -0.04, "#f4a259"], [0.92, 0.07, "#bc4b51"]].forEach(([x, z, c]) => add(kitchen, new THREE.SphereGeometry(0.05, 14, 10), mat(c, 0.5), x, 1.0, z));
	// espresso machine
	const cm = group(kitchen, -0.05, 0.91, -0.05);
	add(cm, rbox(0.38, 0.4, 0.32, 0.03), chrome, 0, 0.2, 0);
	add(cm, rbox(0.38, 0.06, 0.32, 0.02), mat("#202024", 0.4), 0, 0.43, 0);
	add(cm, rbox(0.3, 0.04, 0.2, 0.01), mat("#1b1b1e", 0.5), 0, 0.02, 0.12);
	add(cm, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16), chrome, 0, 0.25, 0.17);
	add(cm, new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), mat("#111"), 0, 0.25, 0.27, { rx: Math.PI / 2 });
	add(cm, new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), chrome, 0.15, 0.25, 0.2, { rx: 0.5 });
	const cmLed = add(cm, new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: "#3a3a3a" }), -0.12, 0.33, 0.162, { cast: false });
	add(cm, new THREE.CylinderGeometry(0.03, 0.03, 0.015, 16), mat("#333", 0.3), 0.1, 0.33, 0.162, { rx: Math.PI / 2 });
	const stream = add(cm, new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), mat("#4b2e1d", 0.2), 0, 0.14, 0.17, { cast: false });
	stream.visible = false;
	const brewCup = makeMug("#ffffff");
	brewCup.position.set(0, 0.04, 0.16);
	brewCup.visible = false;
	cm.add(brewCup);
	// fridge
	const fr = group(scene, -6.6, 0, 5.5, Math.PI / 2);
	add(fr, rbox(0.8, 1.95, 0.7, 0.05), mat("#e8ecef", 0.25, 0.4), 0, 0.975, 0);
	add(fr, new THREE.BoxGeometry(0.8, 0.008, 0.002), mat("#999"), 0, 1.3, 0.351, { cast: false });
	for (const y of [1.0, 1.6]) add(fr, rbox(0.03, 0.4, 0.04, 0.01), chrome, 0.32, y, 0.37);
	// fridge magnets
	const fm = [["#ff6b6b", 0.1], ["#ffd93d", -0.15], ["#6bcbef", 0.2]];
	fm.forEach(([c, x], i) => add(fr, new THREE.CylinderGeometry(0.025, 0.025, 0.01, 12), mat(c, 0.4), x, 1.5 + i * 0.1, 0.355, { rx: Math.PI / 2 }));
	box(-7, -6.3, 2.55, 6);
	interact("coffee", { label: "Make coffee", stand: [-5.75, 3.75], face: -Math.PI / 2 }, cm);

	const coffee = { brewing: 0, mugs: [] };
	const steamParts = [];
	const steamM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false });
	function emitSteam(worldPos, n) {
		for (let i = 0; i < n; i++) {
			const s = new THREE.Mesh(new THREE.SphereGeometry(0.02 + Math.random() * 0.02, 8, 6), steamM.clone());
			s.position.copy(worldPos).add(new THREE.Vector3((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04));
			s.userData.life = 0; s.userData.vy = 0.15 + Math.random() * 0.15;
			scene.add(s);
			steamParts.push(s);
		}
	}
	updaters.push((dt) => {
		if (coffee.brewing > 0) {
			coffee.brewing -= dt;
			const p = 1 - coffee.brewing / 4;
			cmLed.material.color.set(Math.sin(p * 40) > 0 ? "#7CFC00" : "#2f6b10");
			stream.visible = p > 0.25 && p < 0.85;
			brewCup.visible = true;
			brewCup.userData.fill.scale.y = Math.max(0.01, Math.min(1, (p - 0.25) / 0.6));
			if (Math.random() < 0.5) emitSteam(cm.localToWorld(new THREE.Vector3(0, 0.47, -0.05)), 1);
			if (coffee.brewing <= 0) { stream.visible = false; brewCup.visible = false; cmLed.material.color.set("#3a3a3a"); if (coffee.onDone) coffee.onDone(); }
		}
		for (let i = steamParts.length - 1; i >= 0; i--) {
			const s = steamParts[i];
			s.userData.life += dt;
			s.position.y += s.userData.vy * dt;
			s.position.x += Math.sin(s.userData.life * 4 + i) * 0.002;
			s.scale.setScalar(1 + s.userData.life * 2);
			s.material.opacity = Math.max(0, 0.35 - s.userData.life * 0.22);
			if (s.material.opacity <= 0) { scene.remove(s); s.geometry.dispose(); s.material.dispose(); steamParts.splice(i, 1); }
		}
		coffee.mugs.forEach(m => { if (m.visible && Math.random() < dt * 3) emitSteam(m.localToWorld(new THREE.Vector3(0, 0.1, 0)), 1); });
	});
	// mugs displayed on the coffee table
	for (let i = 0; i < 3; i++) {
		const m = makeMug(["#f7f1e3", "#e07a5f", "#81b29a"][i]);
		m.position.set(mugSpots[i][0], 0.45, mugSpots[i][1]);
		m.rotation.y = i * 1.3;
		m.visible = false;
		m.userData.fill.scale.y = 1;
		ct.add(m);
		coffee.mugs.push(m);
	}
	interact("mug", { label: "Drink a coffee", stand: [-3.8, -3.3] }, ...coffee.mugs);

	// ------------------------------------------------------------ bed corner
	const bedG = group(scene, -3.2, 0, 4.92, Math.PI);
	const sheetM = mat("#f3efe8", 0.9);
	const duvetM = mat("#9fb4d8", 0.95);
	add(bedG, rbox(1.76, 0.3, 2.14, 0.04), mat("#6e4a33", 0.55), 0, 0.2, 0);                 // frame
	add(bedG, rbox(1.66, 0.24, 2.04, 0.08), sheetM, 0, 0.45, 0);                              // mattress
	add(bedG, rbox(1.72, 0.08, 1.15, 0.04), duvetM, 0, 0.6, 0.42);                             // duvet folded at the foot
	add(bedG, rbox(1.72, 0.05, 0.25, 0.025), mat("#7f97c4", 0.95), 0, 0.64, -0.1);             // duvet fold
	for (const sx of [-0.42, 0.42]) add(bedG, rbox(0.6, 0.13, 0.36, 0.06), mat("#ffffff", 0.9), sx, 0.63, -0.8, { rx: -0.15 });
	add(bedG, rbox(1.8, 1.05, 0.1, 0.04), mat("#6e4a33", 0.55), 0, 0.62, -1.06);              // headboard
	add(bedG, rbox(1.6, 0.6, 0.06, 0.04), mat("#d8b49a", 0.9), 0, 0.72, -1.0);                 // padded panel
	for (const sx of [-0.84, 0.84]) for (const sz of [-1.0, 1.0]) add(bedG, new THREE.CylinderGeometry(0.03, 0.025, 0.08, 10), mat("#4a2f22"), sx, 0.04, sz);
	const bedRug = add(scene, new THREE.PlaneGeometry(2.2, 0.9), mat("#e8d5c4", 1), -3.2, 0.009, 3.45, { rx: -Math.PI / 2, cast: false });
	bedRug.userData.floor = true;
	box(-4.1, -2.3, 3.82, 6);
	// lying spots: feet at the foot end, head on the pillow (toward +z)
	sitSpots.push({ id: "bedL", x: -3.62, z: 4.1, h: Math.PI, y: 0.7, lie: true });
	sitSpots.push({ id: "bedR", x: -2.78, z: 4.1, h: Math.PI, y: 0.7, lie: true });
	interact("bed", { label: "Go to sleep", stand: [-3.2, 3.35], sit: ["bedL", "bedR"] }, bedG);
	// bedside table + night lamp
	const bst = group(scene, -1.95, 0, 5.6, Math.PI);
	add(bst, rbox(0.5, 0.55, 0.42, 0.02), lightWood, 0, 0.3, 0);
	add(bst, rbox(0.44, 0.2, 0.02, 0.008), wood, 0, 0.36, 0.21);
	add(bst, new THREE.SphereGeometry(0.015, 8, 6), brass, 0, 0.36, 0.225);
	add(bst, new THREE.CylinderGeometry(0.07, 0.09, 0.05, 18), mat("#e8e1d6", 0.4), 0.08, 0.6, 0);
	add(bst, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), brass, 0.08, 0.72, 0);
	const nightShadeM = new THREE.MeshStandardMaterial({ color: "#f6e7cf", roughness: 0.9, side: THREE.DoubleSide, emissive: "#ffcf8a", emissiveIntensity: 0 });
	add(bst, new THREE.CylinderGeometry(0.1, 0.14, 0.16, 22, 1, true), nightShadeM, 0.08, 0.86, 0, { cast: false });
	// alarm clock
	add(bst, rbox(0.12, 0.08, 0.05, 0.015), mat("#e76f51", 0.4), -0.13, 0.62, 0.05);
	add(bst, new THREE.PlaneGeometry(0.08, 0.04), new THREE.MeshBasicMaterial({ color: "#7cff9a", toneMapped: false }), -0.13, 0.625, 0.076, { cast: false });
	const nightLight = new THREE.PointLight("#ffb46b", 0, 4.5, 2);
	nightLight.position.set(-1.87, 0.95, 5.5);
	scene.add(nightLight);
	box(-2.22, -1.68, 5.35, 6);
	interact("nightlamp", { label: "Night lamp", stand: [-1.95, 4.8], face: 0 }, bst);
	const nightLamp = { on: false };
	const setNightLamp = on => { nightLamp.on = on; nightLight.intensity = on ? 3.2 : 0; nightShadeM.emissiveIntensity = on ? 1.1 : 0; };

	// Drawing easel
	const easelPos = new THREE.Vector3(-3.7, 0, 2.3);
	const easelFace = Math.atan2(0.5 - easelPos.x, -0.8 - easelPos.z);
	const easel = group(scene, easelPos.x, 0, easelPos.z, easelFace);
	for (const sx of [-0.32, 0.32]) add(easel, new THREE.BoxGeometry(0.04, 1.75, 0.04), lightWood, sx, 0.86, 0.05, { rz: sx * -0.12, rx: -0.08 });
	add(easel, new THREE.BoxGeometry(0.04, 1.7, 0.04), lightWood, 0, 0.82, -0.38, { rx: 0.32 });
	add(easel, new THREE.BoxGeometry(0.9, 0.04, 0.1), lightWood, 0, 0.8, 0.1);
	const easelCanvas = document.createElement("canvas");
	easelCanvas.width = 640; easelCanvas.height = 480;
	const easelTex = new THREE.CanvasTexture(easelCanvas);
	easelTex.colorSpace = THREE.SRGBColorSpace;
	add(easel, new THREE.BoxGeometry(0.86, 0.66, 0.03), mat("#f5f0e6", 0.9), 0, 1.16, 0.085, { rx: -0.08 });
	add(easel, new THREE.PlaneGeometry(0.82, 0.615), new THREE.MeshStandardMaterial({ map: easelTex, roughness: 0.9 }), 0, 1.16, 0.102, { rx: -0.08, cast: false });
	// paint palette + brushes jar on the ledge
	add(easel, new THREE.CylinderGeometry(0.08, 0.08, 0.008, 20), lightWood, 0.3, 0.825, 0.12);
	["#e63946", "#457b9d", "#f1c453", "#2a9d8f"].forEach((c, i) => add(easel, new THREE.SphereGeometry(0.012, 8, 6), mat(c, 0.3), 0.3 + Math.cos(i * 1.4) * 0.05, 0.832, 0.12 + Math.sin(i * 1.4) * 0.05, { cast: false }));
	box(easelPos.x - 0.45, easelPos.x + 0.45, easelPos.z - 0.45, easelPos.z + 0.45);
	interact("easel", { label: "Draw together", stand: [easelPos.x + Math.sin(easelFace) * 1.15, easelPos.z + Math.cos(easelFace) * 1.15], face: easelFace + Math.PI }, easel);

	// ------------------------------------------------------------ the big plant
	const plantG = group(scene, 5.5, 0, -5.25);
	const potGeo = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.24, 0), new THREE.Vector2(0.3, 0.42), new THREE.Vector2(0.33, 0.46), new THREE.Vector2(0.33, 0.5), new THREE.Vector2(0.3, 0.5)], 32);
	add(plantG, potGeo, mat("#c4673f", 0.85), 0, 0, 0);
	add(plantG, new THREE.CircleGeometry(0.29, 24), mat("#3b2a1f", 1), 0, 0.47, 0, { rx: -Math.PI / 2, cast: false });
	const foliage = group(plantG, 0, 0.47, 0);
	const leafShape = new THREE.Shape();
	leafShape.moveTo(0, 0);
	leafShape.bezierCurveTo(0.12, 0.05, 0.16, 0.25, 0, 0.42);
	leafShape.bezierCurveTo(-0.16, 0.25, -0.12, 0.05, 0, 0);
	const leafGeo = new THREE.ShapeGeometry(leafShape, 10);
	const leafMs = ["#3f7d4b", "#4f9a5a", "#2f6b3e", "#5aa865"].map(c => mat(c, 0.55, 0, { side: THREE.DoubleSide }));
	const stemM = mat("#3d6b35", 0.6);
	const petalMs = ["#ff8fab", "#ffc6ff", "#ffd6a5", "#ff6b81"].map(c => mat(c, 0.5));
	const pollenM = mat("#ffd23f", 0.5);
	const plant = { stage: -1, wilt: 0 };
	function setPlant(stage, wilt) {
		stage = Math.max(0, Math.min(8, stage | 0));
		wilt = Math.max(0, Math.min(1, wilt || 0));
		if (stage === plant.stage && Math.abs(wilt - plant.wilt) < 0.02) return;
		plant.stage = stage; plant.wilt = wilt;
		while (foliage.children.length) { const c = foliage.children[0]; foliage.remove(c); c.traverse(o => { if (o.geometry && o.geometry !== leafGeo) o.geometry.dispose(); }); }
		const r = rng(99);
		const n = 4 + stage * 2;
		const sc = 0.65 + stage * 0.09;
		for (let i = 0; i < n; i++) {
			const a = i * 2.399 + r() * 0.3;
			const lean = 0.25 + r() * 0.45 + wilt * 0.7;
			const len = (0.35 + r() * 0.45) * sc;
			const stem = group(foliage, 0, 0, 0, a);
			add(stem, new THREE.CylinderGeometry(0.008, 0.012, len, 6), stemM, 0, len / 2, 0);
			stem.rotation.x = lean;
			stem.rotation.order = "YXZ";
			const leaf = new THREE.Mesh(leafGeo, leafMs[i % 4]);
			leaf.castShadow = true;
			leaf.position.y = len;
			leaf.rotation.x = 0.6 + wilt * 0.9 + r() * 0.3;
			leaf.scale.setScalar((1.1 + r() * 0.6) * sc);
			stem.add(leaf);
		}
		if (stage >= 3) {
			for (let i = 0; i < stage - 2; i++) {
				const a = i * 1.9, rr = 0.12 + (i % 3) * 0.06;
				const fl = group(foliage, Math.cos(a) * rr, 0.55 * sc + (i % 2) * 0.12, Math.sin(a) * rr);
				add(fl, new THREE.CylinderGeometry(0.006, 0.006, 0.3, 5), stemM, 0, -0.15, 0);
				for (let p = 0; p < 5; p++) {
					const pe = add(fl, new THREE.SphereGeometry(0.035, 8, 6), petalMs[i % petalMs.length], Math.cos(p / 5 * Math.PI * 2) * 0.035, 0, Math.sin(p / 5 * Math.PI * 2) * 0.035);
					pe.scale.set(1, 0.45, 1);
				}
				add(fl, new THREE.SphereGeometry(0.018, 8, 6), pollenM, 0, 0.01, 0);
				fl.rotation.x = wilt * 0.6;
			}
		}
	}
	setPlant(1, 0);
	box(5.15, 5.85, -5.6, -4.9);
	interact("plant", { label: "Water the plant", stand: [5.0, -4.3], face: Math.PI * 0.8 }, plantG);

	// Water droplets effect over the pot
	const drops = [];
	const dropM = new THREE.MeshStandardMaterial({ color: "#8fd3ff", roughness: 0.1, transparent: true, opacity: 0.8 });
	function waterFx() {
		for (let i = 0; i < 40; i++) {
			const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), dropM);
			d.position.set(5.5 + (Math.random() - 0.5) * 0.4, 1.4 + Math.random() * 0.4, -5.25 + (Math.random() - 0.5) * 0.4);
			d.userData.vy = -Math.random() * 0.5; d.userData.delay = i * 0.03;
			d.scale.y = 2;
			d.visible = false;
			scene.add(d);
			drops.push(d);
		}
	}
	updaters.push(dt => {
		for (let i = drops.length - 1; i >= 0; i--) {
			const d = drops[i];
			if (d.userData.delay > 0) { d.userData.delay -= dt; continue; }
			d.visible = true;
			d.userData.vy -= 9.8 * dt;
			d.position.y += d.userData.vy * dt;
			if (d.position.y < 0.5) { scene.remove(d); d.geometry.dispose(); drops.splice(i, 1); }
		}
	});

	// The ball you can kick around
	const ballTex = canvasTex(512, 256, (g, w, h) => {
		const cols = ["#ff595e", "#ffffff", "#ffca3a", "#ffffff", "#1982c4", "#ffffff", "#8ac926", "#ffffff"];
		cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 8, 0, w / 8 + 1, h); });
		g.fillStyle = "#fff"; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
	});
	const ball = add(scene, new THREE.SphereGeometry(0.2, 32, 20), mat("#fff", 0.35, 0, { map: ballTex }), 1.6, 0.2, 1.2);
	ball.userData.v = new THREE.Vector2(0, 0);

	// TV channel painter
	const fish = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * 640, y: 60 + Math.random() * 240, s: 0.6 + Math.random() * 0.8, v: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 50), c: ["#ff9f1c", "#ffbf69", "#2ec4b6", "#e71d36", "#f15bb5"][i % 5] }));
	const TV_CHANNELS = ["Aquarium", "Fireplace", "Starry Night", "Ocean Sunset"];
	function drawTV(ch, t, info) {
		const g = tvCanvas.getContext("2d"), w = 640, h = 360;
		if (ch === 0) {
			const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0a6a9a"); gr.addColorStop(1, "#06334d");
			g.fillStyle = gr; g.fillRect(0, 0, w, h);
			for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.moveTo(80 + i * 110 + Math.sin(t + i) * 20, 0); g.lineTo(140 + i * 110, 0); g.lineTo(60 + i * 110 + Math.sin(t * 0.7 + i) * 40, h); g.lineTo(i * 110, h); g.fill(); }
			g.fillStyle = "#d8c08a"; g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(w / 2, h - 60, w, h - 20); g.lineTo(w, h); g.fill();
			for (let i = 0; i < 7; i++) { g.strokeStyle = "#2f8f4e"; g.lineWidth = 6; g.beginPath(); const bx = 40 + i * 95; g.moveTo(bx, h - 20); g.quadraticCurveTo(bx + Math.sin(t * 1.5 + i) * 25, h - 90, bx + Math.sin(t + i) * 12, h - 150 - (i % 3) * 30); g.stroke(); }
			fish.forEach(f => {
				f.x += f.v / 30; if (f.x > w + 40) f.x = -40; if (f.x < -40) f.x = w + 40;
				const dir = Math.sign(f.v), y = f.y + Math.sin(t * 2 + f.x * 0.02) * 6;
				g.save(); g.translate(f.x, y); g.scale(dir * f.s, f.s);
				g.fillStyle = f.c; g.beginPath(); g.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2); g.fill();
				g.beginPath(); g.moveTo(-22, 0); g.lineTo(-40, -13 + Math.sin(t * 10) * 3); g.lineTo(-40, 13 + Math.sin(t * 10) * 3); g.fill();
				g.fillStyle = "#fff"; g.beginPath(); g.arc(13, -3, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = "#111"; g.beginPath(); g.arc(14, -3, 2, 0, Math.PI * 2); g.fill();
				g.restore();
			});
			for (let i = 0; i < 12; i++) { const bx = (i * 57) % w, by = h - ((t * 40 + i * 47) % h); g.strokeStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(bx + Math.sin(t + i) * 6, by, 3 + (i % 3), 0, Math.PI * 2); g.stroke(); }
		} else if (ch === 1) {
			g.fillStyle = "#1a0d08"; g.fillRect(0, 0, w, h);
			g.fillStyle = "#3b2216"; for (let i = 0; i < 4; i++) g.fillRect(0, h - 60 + i * 15, w, 12);
			for (let i = 0; i < 70; i++) {
				const x = 140 + (i * 37) % 360, life = (t * 1.6 + i * 0.137) % 1;
				const y = h - 70 - life * 200, r = (1 - life) * 34;
				const c = life < 0.3 ? "255,240,180" : life < 0.6 ? "255,160,40" : "220,60,20";
				g.fillStyle = `rgba(${c},${0.55 * (1 - life)})`;
				g.beginPath(); g.arc(x + Math.sin(t * 3 + i) * 10 * life, y, r, 0, Math.PI * 2); g.fill();
			}
			g.fillStyle = "#4a2a1a"; g.save(); g.translate(w / 2, h - 70); g.rotate(0.12); g.fillRect(-170, -14, 340, 28); g.rotate(-0.24); g.fillRect(-170, -14, 340, 28); g.restore();
		} else if (ch === 2) {
			g.fillStyle = "#050818"; g.fillRect(0, 0, w, h);
			for (let i = 0; i < 160; i++) {
				const z = ((i * 13.37 + t * 40) % 400) + 1, x = ((i * 97) % 640 - 320) / z * 120 + w / 2, y = ((i * 53) % 360 - 180) / z * 120 + h / 2;
				g.fillStyle = `rgba(255,255,255,${1 - z / 400})`; g.fillRect(x, y, 3 - z / 200, 3 - z / 200);
			}
			g.fillStyle = "rgba(160,120,255,0.18)"; g.beginPath(); g.ellipse(w / 2 + Math.sin(t * 0.2) * 80, h / 2, 200, 70, t * 0.05, 0, Math.PI * 2); g.fill();
		} else {
			const gr = g.createLinearGradient(0, 0, 0, h * 0.6); gr.addColorStop(0, "#2b1055"); gr.addColorStop(0.6, "#d6457b"); gr.addColorStop(1, "#ffb26b");
			g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.6);
			g.fillStyle = "#ffd58a"; g.beginPath(); g.arc(w / 2, h * 0.6 - 20 + Math.sin(t * 0.1) * 5, 60, Math.PI, 0); g.fill();
			for (let y = h * 0.6; y < h; y += 6) { const k = (y - h * 0.6) / (h * 0.4); g.fillStyle = `rgba(${40 + 60 * (1 - k)},${30 + 30 * (1 - k)},${80 + 40 * (1 - k)},1)`; g.fillRect(0, y, w, 6); g.fillStyle = `rgba(255,200,120,${0.5 * (1 - k)})`; g.fillRect(w / 2 - 70 * (1 - k) + Math.sin(t * 2 + y) * 10, y, 140 * (1 - k), 2); }
		}
		if (info) {
			g.fillStyle = "rgba(0,0,0,0.55)"; roundRect(g, 18, 18, 230, 40, 10); g.fill();
			g.fillStyle = "#fff"; g.font = "700 20px sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(info, 32, 39);
		}
		tvTex.needsUpdate = true;
	}
	function drawTVOff() {
		const g = tvCanvas.getContext("2d");
		g.fillStyle = "#060607"; g.fillRect(0, 0, 640, 360);
		const gr = g.createLinearGradient(0, 0, 640, 360); gr.addColorStop(0, "rgba(255,255,255,0.06)"); gr.addColorStop(0.5, "rgba(255,255,255,0)");
		g.fillStyle = gr; g.fillRect(0, 0, 640, 360);
		tvTex.needsUpdate = true;
	}
	drawTVOff();

	// interactive light switch toggle visual
	const setSwitch = on => { toggle.rotation.x = on ? -0.35 : 0.35; };
	setSwitch(true);

	return {
		colliders, interactables, sitSpots, updaters,
		curtains, setLamp, setMain: on => { setMain(on); setSwitch(on); }, lampState, mainState,
		tv: { canvas: tvCanvas, tex: tvTex, light: tvLight, screen: tvScreen, draw: drawTV, off: drawTVOff, channels: TV_CHANNELS },
		arcade: { canvas: arcCanvas, tex: arcTex },
		easel: { canvas: easelCanvas, tex: easelTex },
		photos, setPlant, waterFx, record, coffee, ball, envs,
		pianoKeys, pressKey, remote: { mesh: remote, parent: ct }, setNightLamp, nightLamp,
		setFairy: k => { fairyLight.intensity = 1.5 * k; bulbs.forEach(b => { b.userData.k = k; }); },
		update(dt, t) { updaters.forEach(u => u(dt, t)); }
	};
}

export function makeMug(color) {
	const g = new THREE.Group();
	const m = new THREE.MeshStandardMaterial({ color, roughness: 0.3 });
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 20, 1, true), m);
	body.position.y = 0.05; body.castShadow = true;
	m.side = THREE.DoubleSide;
	const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), m);
	bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.002;
	const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI * 1.3), m);
	handle.position.set(0.05, 0.055, 0); handle.rotation.z = -Math.PI * 0.65;
	const fillPivot = new THREE.Group();
	fillPivot.position.y = 0.005;
	const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.04, 0.085, 20), new THREE.MeshStandardMaterial({ color: "#4b2e1d", roughness: 0.15 }));
	fill.position.y = 0.0425;
	fillPivot.add(fill);
	g.add(body, bottom, handle, fillPivot);
	g.userData.fill = fillPivot;
	return g;
}
