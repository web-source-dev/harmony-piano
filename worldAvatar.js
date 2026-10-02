/**
 * Harmony World — 3D characters.
 *
 * Builds a stylised male or female figure out of real geometry (lathe-shaped
 * torso, jointed limbs with hands, a face with eyes/eyelids/brows/smile, hair
 * and clothes) and animates it procedurally.
 *
 * Animation is two layers:
 *   anim  (base)  : "idle" (stand/walk/run from speed) | "sit" | "sleep"
 *   upper (arms)  : null | "wave" | "dance" | "clap" | "heart" | "drink" |
 *                   "paint" | "tug" | "piano"
 * The root group sits on the floor at the character's feet and faces +Z.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const SKIN_TONES = ["#f8dcc8", "#eec4a2", "#dba57f", "#bd8058", "#8f5b3b", "#5f3c27"];
export const HAIR_COLORS = ["#1c1411", "#4a2c1a", "#8a5a2b", "#e0bb6e", "#b5402f", "#ece6dd", "#5b3a7a", "#e889a8"];
export const OUTFIT_COLORS = ["#c0395a", "#e07a5f", "#f2cc8f", "#81b29a", "#3d5a80", "#5e60ce", "#2b2d42", "#f4f1de", "#a8dadc", "#ffafcc"];

function mesh(geo, mat, cast = true) {
	const m = new THREE.Mesh(geo, mat);
	m.castShadow = cast;
	m.receiveShadow = true;
	return m;
}
const capsule = (r, len, mat) => mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat);
const sphere = (r, mat, ws = 20, hs = 16) => mesh(new THREE.SphereGeometry(r, ws, hs), mat);
function lathe(profile, mat, segs = 28) {
	return mesh(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), segs), mat);
}

export function roundRect(g, x, y, w, h, r) {
	g.beginPath();
	g.moveTo(x + r, y);
	g.arcTo(x + w, y, x + w, y + h, r);
	g.arcTo(x + w, y + h, x, y + h, r);
	g.arcTo(x, y + h, x, y, r);
	g.arcTo(x, y, x + w, y, r);
	g.closePath();
}

function labelTexture(text, color) {
	const c = document.createElement("canvas");
	c.width = 512; c.height = 128;
	const g = c.getContext("2d");
	g.font = "700 54px 'Nunito', 'Segoe UI', sans-serif";
	const w = Math.min(500, g.measureText(text).width + 70);
	const x = (512 - w) / 2;
	g.fillStyle = "rgba(20,16,28,0.72)";
	roundRect(g, x, 22, w, 84, 42); g.fill();
	g.fillStyle = color || "#fff";
	g.beginPath(); g.arc(x + 36, 64, 12, 0, Math.PI * 2); g.fill();
	g.fillStyle = "#fff";
	g.textAlign = "left"; g.textBaseline = "middle";
	g.fillText(text, x + 58, 66, w - 74);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	return t;
}

function bubbleTexture(text) {
	const c = document.createElement("canvas");
	c.width = 512; c.height = 256;
	const g = c.getContext("2d");
	g.font = "600 34px 'Nunito', 'Segoe UI', sans-serif";
	const words = String(text).split(/\s+/);
	const lines = [];
	let line = "";
	for (const w of words) {
		const test = line ? line + " " + w : w;
		if (g.measureText(test).width > 430 && line) { lines.push(line); line = w; } else line = test;
		if (lines.length >= 3) break;
	}
	if (line && lines.length < 4) lines.push(line);
	let maxW = 0;
	for (const l of lines) maxW = Math.max(maxW, g.measureText(l).width);
	const w = Math.min(490, maxW + 50), h = lines.length * 42 + 34;
	const x = (512 - w) / 2, y = 226 - h - 18;
	g.fillStyle = "#fffdf8";
	g.shadowColor = "rgba(0,0,0,0.25)"; g.shadowBlur = 10;
	roundRect(g, x, y, w, h, 24); g.fill();
	g.beginPath(); g.moveTo(246, y + h - 2); g.lineTo(266, y + h - 2); g.lineTo(256, y + h + 18); g.fill();
	g.shadowBlur = 0;
	g.fillStyle = "#2a2233"; g.textAlign = "center"; g.textBaseline = "top";
	lines.forEach((l, i) => g.fillText(l, 256, y + 18 + i * 42, 460));
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

function zzzTexture() {
	const c = document.createElement("canvas");
	c.width = 128; c.height = 128;
	const g = c.getContext("2d");
	g.fillStyle = "#cfe0ff";
	g.strokeStyle = "rgba(20,20,60,0.6)"; g.lineWidth = 6;
	g.font = "900 96px 'Nunito', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
	g.strokeText("z", 64, 68); g.fillText("z", 64, 68);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
const ZZZ_TEX = zzzTexture();

// ---------- hand-held props ----------
function makeProp(kind) {
	const g = new THREE.Group();
	if (kind === "mug") {
		const m = new THREE.MeshStandardMaterial({ color: "#f7f1e3", roughness: 0.3, side: THREE.DoubleSide });
		g.add(mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 18, 1, true), m));
		const base = mesh(new THREE.CircleGeometry(0.038, 18), m); base.rotation.x = Math.PI / 2; base.position.y = -0.047; g.add(base);
		const handle = mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 14, Math.PI * 1.3), m);
		handle.position.set(0.045, 0, 0); handle.rotation.z = -Math.PI * 0.65; g.add(handle);
		const coffee = mesh(new THREE.CircleGeometry(0.039, 18), new THREE.MeshStandardMaterial({ color: "#4b2e1d", roughness: 0.15 }), false);
		coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.032; g.add(coffee);
		g.position.set(0, -0.06, 0.05);
		g.rotation.z = Math.PI / 2;
		g.rotation.y = -Math.PI / 2;
	} else if (kind === "brush") {
		g.add(mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.2, 8), new THREE.MeshStandardMaterial({ color: "#c58940", roughness: 0.5 })));
		const ferrule = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 8), new THREE.MeshStandardMaterial({ color: "#c0c4c8", metalness: 0.9, roughness: 0.3 }));
		ferrule.position.y = 0.11; g.add(ferrule);
		const tip = mesh(new THREE.ConeGeometry(0.009, 0.04, 8), new THREE.MeshStandardMaterial({ color: "#2b2d42", roughness: 0.6 }));
		tip.position.y = 0.145; g.add(tip);
		g.userData.tip = tip;
		g.position.set(0, -0.05, 0.02);
		g.rotation.x = Math.PI / 2;
	} else if (kind === "remote") {
		g.add(mesh(new RoundedBoxGeometry(0.05, 0.16, 0.022, 2, 0.01), new THREE.MeshStandardMaterial({ color: "#1d1d22", roughness: 0.45 })));
		const red = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), new THREE.MeshStandardMaterial({ color: "#e63946", emissive: "#e63946", emissiveIntensity: 0.4 }));
		red.rotation.x = Math.PI / 2; red.position.set(0, 0.06, 0.012); g.add(red);
		for (let i = 0; i < 6; i++) {
			const b = mesh(new THREE.BoxGeometry(0.01, 0.008, 0.004), new THREE.MeshStandardMaterial({ color: "#9aa0a6" }), false);
			b.position.set((i % 2 ? 0.01 : -0.01), 0.02 - Math.floor(i / 2) * 0.022, 0.012); g.add(b);
		}
		g.position.set(0, -0.07, 0.03);
		g.rotation.x = Math.PI / 2.4;
	}
	return g;
}

export class Avatar {
	constructor(look) {
		this.root = new THREE.Group();
		this.anim = "idle";
		this.upper = null;
		this.speed = 0;
		this.phase = 0;
		this.t = Math.random() * 10;
		this.label = null;
		this.bubble = null;
		this.bubbleUntil = 0;
		this.paintUV = { u: 0.5, v: 0.5 };
		this.pianoHits = [0, 0];
		this.lookYaw = null;   // desired head turn (radians, relative), or null
		this.prop = null;
		this.zzz = [];
		this.build(look);
	}

	dispose() {
		this.root.traverse(o => {
			if (o.geometry) o.geometry.dispose();
			if (o.material) {
				const ms = Array.isArray(o.material) ? o.material : [o.material];
				ms.forEach(m => { if (m.map && m.map !== ZZZ_TEX) m.map.dispose(); m.dispose(); });
			}
		});
	}

	build(look) {
		look = Object.assign({ gender: "female", skin: SKIN_TONES[1], hair: HAIR_COLORS[1], top: OUTFIT_COLORS[0], bottom: OUTFIT_COLORS[4], name: "" }, look || {});
		this.look = look;
		const keepProp = this.propKind || null;
		if (this.body) { this.root.remove(this.body); this.root.remove(this.shadowBlob); this.dispose(); }
		const female = look.gender === "female";
		const skinC = new THREE.Color(look.skin);
		const skin = new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.6 });
		const skinShade = new THREE.MeshStandardMaterial({ color: skinC.clone().multiplyScalar(0.88), roughness: 0.6 });
		const hair = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.42, metalness: 0.04 });
		const top = new THREE.MeshStandardMaterial({ color: look.top, roughness: 0.8 });
		const topDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.top).multiplyScalar(0.8), roughness: 0.85 });
		const bottom = new THREE.MeshStandardMaterial({ color: look.bottom, roughness: 0.85 });
		const shoeM = new THREE.MeshStandardMaterial({ color: female ? look.bottom : "#3a3330", roughness: 0.45 });
		const soleM = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.6 });
		const dark = new THREE.MeshStandardMaterial({ color: "#1b1418", roughness: 0.25 });
		const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.25 });
		const iris = new THREE.MeshStandardMaterial({ color: female ? "#5a3a2a" : "#3d2a1f", roughness: 0.2 });
		const lip = new THREE.MeshStandardMaterial({ color: female ? "#c9566a" : skinC.clone().multiplyScalar(0.72), roughness: 0.45 });
		const blush = new THREE.MeshBasicMaterial({ color: "#ff8fa3", transparent: true, opacity: female ? 0.35 : 0.18, depthWrite: false });

		const body = new THREE.Group();
		this.body = body;
		this.root.add(body);
		body.scale.setScalar(female ? 0.96 : 1.0);
		const hipY = 0.86;
		this.hipY = hipY;

		// ---- hips / trousers top
		const hips = new THREE.Group();
		hips.position.y = hipY;
		body.add(hips);
		this.hips = hips;
		const pelvis = lathe(female
			? [[0, -0.06], [0.12, -0.06], [0.165, 0.0], [0.168, 0.08], [0.145, 0.15], [0, 0.15]]
			: [[0, -0.07], [0.13, -0.07], [0.17, 0.0], [0.17, 0.08], [0.155, 0.15], [0, 0.15]], female ? top : bottom);
		pelvis.scale.z = 0.72;
		hips.add(pelvis);

		// ---- torso: a lathed body shape (chest, waist) flattened front-to-back
		const torso = new THREE.Group();
		torso.position.y = 0.12;
		hips.add(torso);
		this.torso = torso;
		const prof = female
			? [[0, 0], [0.14, 0], [0.128, 0.08], [0.122, 0.14], [0.14, 0.22], [0.158, 0.3], [0.16, 0.36], [0.15, 0.41], [0.11, 0.45], [0.05, 0.47], [0, 0.47]]
			: [[0, 0], [0.152, 0], [0.148, 0.08], [0.152, 0.16], [0.17, 0.25], [0.185, 0.33], [0.19, 0.39], [0.17, 0.44], [0.11, 0.48], [0.05, 0.5], [0, 0.5]];
		const chest = lathe(prof, top, 32);
		chest.scale.set(female ? 1.05 : 1.14, 1, 0.68);
		torso.add(chest);
		this.chest = chest;
		if (female) {
			for (const sx of [-1, 1]) {
				const b = sphere(0.07, top, 16, 12);
				b.position.set(sx * 0.068, 0.33, 0.065);
				b.scale.set(1, 0.85, 0.75);
				torso.add(b);
			}
			// sweetheart neckline in skin
			const nl = sphere(0.085, skin, 18, 12);
			nl.scale.set(1.15, 0.5, 0.5);
			nl.position.set(0, 0.45, 0.045);
			torso.add(nl);
		} else {
			const collar = mesh(new THREE.TorusGeometry(0.068, 0.016, 8, 22), topDark);
			collar.rotation.x = Math.PI / 2 - 0.15;
			collar.position.set(0, 0.485, 0.008);
			torso.add(collar);
			// shirt hem band
			const hem = mesh(new THREE.TorusGeometry(0.152, 0.012, 6, 28), topDark);
			hem.rotation.x = Math.PI / 2;
			hem.scale.set(1.14, 0.68, 1);
			hem.position.y = 0.01;
			torso.add(hem);
		}
		const neck = mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.12, 14), skinShade);
		neck.position.y = 0.52;
		torso.add(neck);

		// ---- head (slightly large for a friendly stylised look)
		const head = new THREE.Group();
		head.position.y = 0.6;
		torso.add(head);
		this.head = head;
		const face = new THREE.Group();
		face.position.y = 0.1;
		head.add(face);
		const skull = sphere(0.135, skin, 32, 24);
		skull.scale.set(0.93, 1.04, 0.98);
		face.add(skull);
		const jaw = sphere(0.11, skin, 24, 16);
		jaw.scale.set(female ? 0.84 : 0.92, 0.72, 0.9);
		jaw.position.set(0, -0.055, 0.02);
		face.add(jaw);
		this.lids = [];
		for (const sx of [-1, 1]) {
			const ear = sphere(0.03, skin, 12, 10);
			ear.scale.set(0.45, 1, 0.75);
			ear.position.set(sx * 0.125, -0.008, -0.005);
			face.add(ear);
			// eye: white, iris, pupil, sparkle, eyelid
			const eye = new THREE.Group();
			eye.position.set(sx * 0.047, 0.008, 0.112);
			face.add(eye);
			const sclera = sphere(0.026, white, 16, 12);
			sclera.scale.set(1.0, 1.08, 0.55);
			eye.add(sclera);
			const ir = mesh(new THREE.CircleGeometry(0.017, 20), iris, false);
			ir.position.z = 0.0145;
			eye.add(ir);
			const pu = mesh(new THREE.CircleGeometry(0.009, 16), dark, false);
			pu.position.z = 0.0148;
			eye.add(pu);
			const sp = mesh(new THREE.CircleGeometry(0.0045, 10), new THREE.MeshBasicMaterial({ color: "#ffffff" }), false);
			sp.position.set(0.006, 0.007, 0.015);
			eye.add(sp);
			const lid = mesh(new THREE.SphereGeometry(0.029, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin, false);
			lid.scale.set(1.0, 1.0, 0.62);
			lid.rotation.x = -0.45;
			eye.add(lid);
			this.lids.push(lid);
			if (female) {
				const lash = mesh(new THREE.TorusGeometry(0.026, 0.004, 4, 14, Math.PI * 0.8), dark, false);
				lash.position.set(0, 0.002, 0.006);
				lash.rotation.z = Math.PI * 0.1;
				lash.scale.set(1, 1.05, 1);
				eye.add(lash);
				lid.userData.lash = lash;
			}
			// curved brow
			const brow = mesh(new THREE.TorusGeometry(0.028, female ? 0.0045 : 0.0075, 4, 12, Math.PI * 0.6), hair, false);
			brow.position.set(sx * 0.048, 0.05, 0.116);
			brow.rotation.z = Math.PI * 0.2 + (sx > 0 ? -0.08 : 0.08);
			brow.scale.set(1, 0.6, 1);
			face.add(brow);
			const ch = mesh(new THREE.CircleGeometry(0.022, 14), blush, false);
			ch.position.set(sx * 0.072, -0.04, 0.108);
			ch.rotation.y = sx * 0.5;
			face.add(ch);
		}
		const nose = sphere(0.016, skinShade, 10, 8);
		nose.scale.set(1, 1, 1.2);
		nose.position.set(0, -0.022, 0.13);
		face.add(nose);
		const smile = mesh(new THREE.TorusGeometry(0.026, 0.0055, 6, 16, Math.PI * 0.75), lip, false);
		smile.rotation.z = Math.PI + Math.PI * 0.125;
		smile.position.set(0, -0.045, 0.118);
		face.add(smile);
		this.mouth = smile;
		this.buildHair(face, hair, female);

		// ---- arms (index 0 = right side, at -x; index 1 = left)
		const shoulderX = female ? 0.175 : 0.21;
		this.arms = [];
		for (const side of [-1, 1]) {
			const sh = new THREE.Group();
			sh.position.set(side * shoulderX, 0.4, 0);
			torso.add(sh);
			const pivot = new THREE.Group();
			sh.add(pivot);
			pivot.add(sphere(female ? 0.055 : 0.068, top, 14, 12));
			const ur = female ? 0.042 : 0.052;
			const upper = capsule(ur, 0.19, female ? skin : skin);
			upper.position.y = -0.135;
			pivot.add(upper);
			if (female) {
				const puff = sphere(0.068, top, 14, 12);
				puff.scale.set(1, 0.9, 1);
				puff.position.y = -0.04;
				pivot.add(puff);
			} else {
				const sl = mesh(new THREE.CylinderGeometry(0.068, 0.064, 0.16, 16, 1, true), top);
				sl.material = top.clone(); sl.material.side = THREE.DoubleSide;
				sl.position.y = -0.07;
				pivot.add(sl);
			}
			const elbow = new THREE.Group();
			elbow.position.y = -0.28;
			pivot.add(elbow);
			elbow.add(sphere(ur * 0.95, skin, 12, 10));
			const fore = capsule(ur * 0.88, 0.17, skin);
			fore.position.y = -0.12;
			elbow.add(fore);
			// hand: palm + finger block + thumb
			const hand = new THREE.Group();
			hand.position.y = -0.255;
			elbow.add(hand);
			const palm = mesh(new RoundedBoxGeometry(0.062, 0.07, 0.028, 2, 0.012), skin);
			palm.position.y = -0.025;
			hand.add(palm);
			const fingers = mesh(new RoundedBoxGeometry(0.058, 0.05, 0.024, 2, 0.011), skin);
			fingers.position.set(0, -0.075, 0.004);
			fingers.rotation.x = 0.25;
			hand.add(fingers);
			const thumb = capsule(0.011, 0.03, skin);
			thumb.position.set(-side * 0.035, -0.035, 0.012);
			thumb.rotation.z = -side * 0.6;
			hand.add(thumb);
			hand.rotation.y = side * -0.3;
			this.arms.push({ sh: pivot, elbow, hand, side });
		}
		this.propHolder = new THREE.Group();
		this.arms[0].hand.add(this.propHolder);

		// ---- legs
		this.legs = [];
		for (const side of [-1, 1]) {
			const hip = new THREE.Group();
			hip.position.set(side * (female ? 0.082 : 0.092), 0, 0);
			hips.add(hip);
			const legM = female ? skin : bottom;
			const thigh = capsule(female ? 0.066 : 0.074, 0.3, legM);
			thigh.position.y = -0.2;
			hip.add(thigh);
			const knee = new THREE.Group();
			knee.position.y = -0.4;
			hip.add(knee);
			knee.add(sphere(female ? 0.058 : 0.066, legM, 12, 10));
			const shin = capsule(female ? 0.052 : 0.062, 0.29, legM);
			shin.position.y = -0.19;
			knee.add(shin);
			if (!female) {
				const cuff = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), topDark.clone());
				cuff.material.color.set(new THREE.Color(look.bottom).multiplyScalar(0.8));
				cuff.position.y = -0.36;
				knee.add(cuff);
			}
			const foot = new THREE.Group();
			foot.position.y = -0.4;
			knee.add(foot);
			const shoe = capsule(female ? 0.045 : 0.052, female ? 0.12 : 0.14, shoeM);
			shoe.rotation.x = Math.PI / 2;
			shoe.position.set(0, -0.02, 0.045);
			shoe.scale.set(1, 1, 0.75);
			foot.add(shoe);
			const sole = mesh(new RoundedBoxGeometry(female ? 0.085 : 0.1, 0.022, female ? 0.22 : 0.25, 2, 0.01), soleM);
			sole.position.set(0, -0.055, 0.045);
			foot.add(sole);
			if (female) {
				const strap = mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14), shoeM);
				strap.rotation.x = Math.PI / 2; strap.position.set(0, 0.02, 0);
				foot.add(strap);
			}
			this.legs.push({ hip, knee, foot, side });
		}

		if (female) {
			// flared skirt of the dress, with a soft hem ring
			const skirtM = top.clone(); skirtM.side = THREE.DoubleSide;
			const skirt = lathe([[0.15, 0.1], [0.165, 0.04], [0.2, -0.08], [0.26, -0.22], [0.3, -0.33], [0.305, -0.35]], skirtM, 36);
			skirt.scale.z = 0.85;
			hips.add(skirt);
			this.skirt = skirt;
			const hem = mesh(new THREE.TorusGeometry(0.303, 0.012, 6, 36), topDark);
			hem.rotation.x = Math.PI / 2; hem.position.y = -0.35;
			skirt.add(hem);
			const belt = mesh(new THREE.TorusGeometry(0.152, 0.018, 8, 28), bottom);
			belt.rotation.x = Math.PI / 2; belt.position.y = 0.12; belt.scale.set(1.04, 0.72, 1);
			hips.add(belt);
		} else {
			const beltM = new THREE.MeshStandardMaterial({ color: "#3a2a20", roughness: 0.4 });
			const belt = mesh(new THREE.TorusGeometry(0.168, 0.02, 8, 28), beltM);
			belt.rotation.x = Math.PI / 2; belt.position.y = 0.11; belt.scale.set(1.02, 0.74, 1);
			hips.add(belt);
			const buckle = mesh(new THREE.BoxGeometry(0.045, 0.032, 0.015), new THREE.MeshStandardMaterial({ color: "#c9a85c", metalness: 0.9, roughness: 0.3 }));
			buckle.position.set(0, 0.11, 0.125);
			hips.add(buckle);
		}

		const blob = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
		blob.rotation.x = -Math.PI / 2;
		blob.position.y = 0.006;
		this.root.add(blob);
		this.shadowBlob = blob;

		this.propKind = null;
		this.prop = null;
		if (keepProp) this.setProp(keepProp);
		this.setName(look.name, look.top);
	}

	buildHair(head, mat, female) {
		const shell = mesh(new THREE.SphereGeometry(0.145, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.56), mat);
		shell.scale.set(0.96, 1.04, 1.02);
		shell.position.set(0, 0.012, -0.012);
		shell.rotation.x = -0.28;
		head.add(shell);
		if (female) {
			// long hair: a curved curtain behind the head down past the shoulders
			const backM = mat.clone(); backM.side = THREE.DoubleSide;
			const back = mesh(new THREE.CylinderGeometry(0.142, 0.17, 0.36, 28, 4, true, Math.PI * 0.32, Math.PI * 1.36), backM);
			back.position.set(0, -0.13, -0.012);
			back.scale.z = 0.85;
			head.add(back);
			const backFill = mesh(new THREE.SphereGeometry(0.14, 20, 14), mat);
			backFill.scale.set(1, 1.3, 0.6);
			backFill.position.set(0, -0.11, -0.06);
			head.add(backFill);
			// soft waves at the ends
			for (let i = 0; i < 9; i++) {
				const a = Math.PI * 0.36 + i * (Math.PI * 1.28 / 8);  // theta 0 = face, so leave the front open
				const curl = sphere(0.035, mat, 10, 8);
				curl.position.set(Math.sin(a) * 0.15, -0.31, Math.cos(a) * 0.13 - 0.012);
				head.add(curl);
			}
			// side-swept bangs
			for (let i = 0; i < 5; i++) {
				const b = capsule(0.028, 0.07, mat);
				b.position.set(-0.07 + i * 0.035, 0.085 - Math.abs(i - 1) * 0.008, 0.105 - Math.abs(i - 2) * 0.008);
				b.rotation.set(0.9, 0, -0.9 + i * 0.12);
				head.add(b);
			}
			const bow = new THREE.Group();
			const bowM = new THREE.MeshStandardMaterial({ color: "#ff6f91", roughness: 0.4 });
			for (const sx of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.03, 0.05, 10), bowM); w.rotation.z = sx * Math.PI / 2; w.position.x = sx * 0.024; bow.add(w); }
			bow.add(sphere(0.013, bowM));
			bow.position.set(0.1, 0.1, -0.02);
			bow.rotation.set(0, 1.0, 0.3);
			head.add(bow);
		} else {
			// short textured crop: tufts across the top + a swept quiff
			for (let i = 0; i < 11; i++) {
				const a = (i / 11) * Math.PI * 2;
				const tuft = mesh(new THREE.ConeGeometry(0.04, 0.07, 8), mat);
				const r = 0.1;
				tuft.position.set(Math.cos(a) * r * 0.8, 0.105 + Math.sin(i * 1.7) * 0.01, Math.sin(a) * r * 0.75 - 0.01);
				tuft.lookAt(tuft.position.clone().multiplyScalar(3).add(new THREE.Vector3(0, 0.4, 0)));
				tuft.rotateX(Math.PI / 2);
				head.add(tuft);
			}
			const quiff = sphere(0.075, mat, 16, 12);
			quiff.scale.set(1.45, 0.55, 0.85);
			quiff.position.set(0.02, 0.12, 0.065);
			quiff.rotation.set(0.35, 0, -0.15);
			head.add(quiff);
			const backH = mesh(new THREE.SphereGeometry(0.138, 22, 12, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.26), mat);
			backH.position.set(0, -0.005, -0.018);
			backH.rotation.x = 0.4;
			head.add(backH);
			for (const sx of [-1, 1]) {
				const burn = mesh(new RoundedBoxGeometry(0.016, 0.055, 0.035, 1, 0.006), mat);
				burn.position.set(sx * 0.122, 0.01, 0.035);
				head.add(burn);
			}
		}
	}

	setProp(kind) {
		if (this.propKind === kind) return;
		if (this.prop) { this.propHolder.remove(this.prop); this.prop.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.prop = null; }
		this.propKind = kind || null;
		if (kind) { this.prop = makeProp(kind); this.propHolder.add(this.prop); }
	}

	setName(name, color) {
		if (this.label) { this.root.remove(this.label); this.label.material.map.dispose(); this.label.material.dispose(); }
		if (!name) { this.label = null; return; }
		const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(name, color), depthTest: true, transparent: true }));
		spr.scale.set(0.9, 0.225, 1);
		spr.position.y = 2.0;
		spr.renderOrder = 10;
		this.label = spr;
		this.root.add(spr);
	}

	say(text) {
		if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map.dispose(); this.bubble.material.dispose(); }
		const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(text), transparent: true, depthTest: false }));
		spr.scale.set(1.5, 0.75, 1);
		spr.renderOrder = 20;
		this.bubble = spr;
		this.root.add(spr);
		this.bubbleUntil = performance.now() + Math.min(9000, 3500 + String(text).length * 70);
	}

	pianoHit(side) { this.pianoHits[side ? 1 : 0] = this.t; }

	_e(obj, prop, target, k) { obj[prop] += (target - obj[prop]) * k; }

	update(dt) {
		this.t += dt;
		const k = 1 - Math.pow(0.0004, dt);
		const t = this.t;
		const base = this.anim, up = this.upper;
		const moving = this.speed > 0.05 && base === "idle";
		this.phase += dt * (moving ? 6.2 + this.speed * 3.4 : 0);
		const ph = this.phase;
		const amp = moving ? Math.min(1.25, this.speed) : 0;
		const breathe = Math.sin(t * 1.8) * 0.012;

		const P = {
			bodyY: 0, bodyRY: 0, hipsX: 0, torsoX: breathe, torsoZ: 0, torsoY: 0, headX: 0, headY: 0, headZ: 0,
			arm: [{ x: 0.05, z: -0.1, y: 0, e: -0.18 }, { x: 0.05, z: 0.1, y: 0, e: -0.18 }],
			leg: [{ x: 0, z: 0, k: 0.04 }, { x: 0, z: 0, k: 0.04 }],
			foot: [0, 0], eyes: 1
		};

		// ---- base layer
		if (base === "sit") {
			P.bodyY = -0.42;
			P.leg[0].x = P.leg[1].x = -1.5; P.leg[0].k = P.leg[1].k = 1.48;
			P.leg[0].z = -0.05; P.leg[1].z = 0.05;
			P.arm[0].x = P.arm[1].x = -0.45; P.arm[0].e = P.arm[1].e = -0.75;
			P.arm[0].z = -0.12; P.arm[1].z = 0.12;
			P.torsoX = -0.04 + breathe;
		} else if (base === "sleep") {
			P.leg[0].z = -0.04; P.leg[1].z = 0.04; P.leg[0].k = P.leg[1].k = 0.12;
			P.arm[0].z = -0.12; P.arm[1].z = 0.12; P.arm[0].e = P.arm[1].e = -0.2;
			P.torsoX = Math.sin(t * 1.1) * 0.02;
			P.headY = 0.35; P.eyes = 0.05;
			P.foot[0] = P.foot[1] = 0.6;
		} else {
			const sw = Math.sin(ph);
			P.leg[0].x = -sw * 0.62 * amp; P.leg[1].x = sw * 0.62 * amp;
			P.leg[0].k = Math.max(0, sw) * 0.95 * amp + 0.04; P.leg[1].k = Math.max(0, -sw) * 0.95 * amp + 0.04;
			P.foot[0] = -Math.max(0, -sw) * 0.3 * amp; P.foot[1] = -Math.max(0, sw) * 0.3 * amp;
			P.arm[0].x = sw * 0.6 * amp; P.arm[1].x = -sw * 0.6 * amp;
			P.arm[0].e = P.arm[1].e = -0.2 - 0.5 * amp;
			P.bodyY = -Math.abs(Math.cos(ph)) * 0.045 * amp;
			P.torsoX = 0.07 * amp + breathe;
			P.torsoY = -sw * 0.08 * amp;
			P.bodyRY = 0;
			if (!moving) {
				// idle weight shift + glance around
				P.hipsX = 0; P.torsoZ = Math.sin(t * 0.6) * 0.02;
				P.headY = Math.sin(t * 0.45) * 0.2; P.headX = Math.sin(t * 0.33) * 0.04;
			}
		}
		if (this.lookYaw !== null && base !== "sleep" && !moving) {
			P.headY = Math.max(-0.95, Math.min(0.95, this.lookYaw));
		}

		// ---- upper layer
		if (up === "wave") {
			P.arm[0].z = -2.65 + Math.sin(t * 9) * 0.22; P.arm[0].x = -0.1; P.arm[0].e = -0.35 + Math.sin(t * 9) * 0.35;
			P.headZ = 0.08;
		} else if (up === "dance" && base === "idle" && !moving) {
			const b = t * 7;
			P.bodyY = -Math.abs(Math.sin(b)) * 0.07;
			P.bodyRY = Math.sin(b * 0.5) * 0.5;
			P.torsoZ = Math.sin(b) * 0.12;
			P.arm[0].z = -2.2 + Math.sin(b) * 0.6; P.arm[1].z = 2.2 + Math.sin(b + Math.PI) * 0.6;
			P.arm[0].e = P.arm[1].e = -0.8;
			P.leg[0].x = Math.sin(b) * 0.35; P.leg[1].x = -Math.sin(b) * 0.35;
			P.leg[0].k = Math.max(0, Math.sin(b)) * 0.6; P.leg[1].k = Math.max(0, -Math.sin(b)) * 0.6;
			P.headX = Math.sin(b * 2) * 0.1;
		} else if (up === "clap") {
			const c = Math.sin(t * 14);
			P.arm[0].x = P.arm[1].x = -1.2;
			P.arm[0].z = -0.3 - c * 0.15; P.arm[1].z = 0.3 + c * 0.15;
			P.arm[0].e = P.arm[1].e = -0.9;
		} else if (up === "heart") {
			P.arm[0].x = P.arm[1].x = -0.9; P.arm[0].z = -0.5; P.arm[1].z = 0.5;
			P.arm[0].e = P.arm[1].e = -1.9;
			P.headY = Math.sin(t * 2.5) * 0.15;
		} else if (up === "drink") {
			// raise the mug to the mouth, sip, lower a little, repeat
			const s = (Math.sin(t * 2.2) + 1) / 2;
			P.arm[0].x = -1.25 - s * 0.35; P.arm[0].z = -0.35; P.arm[0].e = -1.7 - s * 0.25; P.arm[0].y = 0.3;
			P.headX = -0.12 - s * 0.18;
		} else if (up === "paint") {
			const { u, v } = this.paintUV;
			P.arm[0].x = -1.15 - (0.5 - v) * 0.8 + Math.sin(t * 9) * 0.02;
			P.arm[0].z = -0.12 + (0.5 - u) * 0.9;
			P.arm[0].e = -0.35;
			P.arm[1].x = -0.3; P.arm[1].e = -1.2; P.arm[1].z = 0.25;
			P.headX = 0.1 - (0.5 - v) * 0.2; P.headY = (0.5 - u) * 0.4;
		} else if (up === "tug") {
			const w = Math.sin(t * 10) * 0.08;
			P.arm[0].x = P.arm[1].x = -1.45 + w; P.arm[0].z = -0.05; P.arm[1].z = 0.05;
			P.arm[0].e = P.arm[1].e = -0.15;
			P.torsoX = -0.28 + w; P.bodyY = -0.06;
			P.leg[0].x = -0.45; P.leg[0].k = 0.5; P.leg[1].x = 0.35; P.leg[1].k = 0.1;
			P.headX = -0.15;
		} else if (up === "piano") {
			for (let i = 0; i < 2; i++) {
				const hit = Math.max(0, 1 - (t - this.pianoHits[i]) * 6);
				P.arm[i].x = -1.0 - hit * 0.06; P.arm[i].e = -0.95 + hit * 0.25;
				P.arm[i].z = (i ? 1 : -1) * (0.18 + Math.sin(t * 1.3 + i) * 0.06);
			}
			P.headX = 0.22;
		}

		// ---- apply with smoothing
		const B = this.body, T = this.torso, H = this.head;
		this._e(B.position, "y", P.bodyY, k);
		this._e(B.rotation, "y", P.bodyRY, k);
		this._e(T.rotation, "x", P.torsoX, k);
		this._e(T.rotation, "z", P.torsoZ, k);
		this._e(T.rotation, "y", P.torsoY, k);
		this._e(H.rotation, "x", P.headX, k);
		this._e(H.rotation, "y", P.headY, k * 0.7);
		this._e(H.rotation, "z", P.headZ, k);
		for (let i = 0; i < 2; i++) {
			const a = this.arms[i], l = this.legs[i];
			this._e(a.sh.rotation, "x", P.arm[i].x, k);
			this._e(a.sh.rotation, "z", P.arm[i].z, k);
			this._e(a.sh.rotation, "y", P.arm[i].y, k);
			this._e(a.elbow.rotation, "x", P.arm[i].e, k);
			this._e(l.hip.rotation, "x", P.leg[i].x, k);
			this._e(l.hip.rotation, "z", P.leg[i].z, k);
			this._e(l.knee.rotation, "x", P.leg[i].k, k);
			this._e(l.foot.rotation, "x", P.foot[i], k);
		}
		if (this.skirt) {
			const sp = base === "sit" ? 1.25 : 1 + amp * 0.05 * Math.sin(ph * 2);
			this.skirt.scale.x += (sp - this.skirt.scale.x) * k;
		}
		// blink (or closed while asleep)
		const blink = P.eyes < 0.5 ? 1 : ((t % 4.1) < 0.13 ? 1 : 0);
		this.lids.forEach(l => { const target = blink ? 1.45 : -0.45; l.rotation.x += (target - l.rotation.x) * Math.min(1, dt * 30); if (l.userData.lash) l.userData.lash.visible = !blink; });
		this.shadowBlob.visible = base !== "sleep";
		this.shadowBlob.material.opacity = base === "sit" ? 0.1 : 0.22;
		this.propHolder.visible = !!this.prop;

		// sleepy z's
		if (base === "sleep") {
			if (!this.zzz.length || t - this.zzz[this.zzz.length - 1].userData.born > 1.1) {
				const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ZZZ_TEX, transparent: true, depthWrite: false }));
				s.userData.born = t;
				s.scale.setScalar(0.12);
				this.root.add(s);
				this.zzz.push(s);
			}
		}
		for (let i = this.zzz.length - 1; i >= 0; i--) {
			const s = this.zzz[i], age = t - s.userData.born;
			// the root is lying down, so "up" in world is local -z... use local coords along the body
			// lying down: local +y runs along the body to the head, local +z points up
			s.position.set(0.1 + Math.sin(age * 2) * 0.05, 1.6 + age * 0.05, 0.3 + age * 0.15);
			s.scale.setScalar(0.1 + age * 0.06);
			s.material.opacity = Math.max(0, 1 - age / 3);
			if (age > 3 || base !== "sleep") { this.root.remove(s); s.material.dispose(); this.zzz.splice(i, 1); }
		}

		// name tag + bubble ride just above the head
		const headWorldY = (B.position.y + 1.78) * B.scale.y;
		const asleep = base === "sleep";
		if (this.label) { if (asleep) this.label.position.set(0, 1.6, 0.45); else this.label.position.set(0, headWorldY + 0.22, 0); this.label.visible = !asleep; }
		if (this.bubble) { if (asleep) this.bubble.position.set(0, 1.6, 0.8); else this.bubble.position.set(0, headWorldY + 0.64, 0); }
		if (this.bubble && performance.now() > this.bubbleUntil) {
			this.root.remove(this.bubble);
			this.bubble.material.map.dispose(); this.bubble.material.dispose();
			this.bubble = null;
		}
	}
}
