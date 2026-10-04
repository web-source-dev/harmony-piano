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
 *                   "paint" | "tug" | "piano" | ... and the love ones:
 *                   "blush" | "lovestruck" | "heartarms" | "wink" | "propose" |
 *                   "cuddle" | "smooch" | "cheekkiss" | "slowdance"
 *                   (the couple ones read `coupleSide` to lean the right way)
 * The root group sits on the floor at the character's feet and faces +Z.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const SKIN_TONES = ["#f8dcc8", "#eec4a2", "#dba57f", "#bd8058", "#8f5b3b", "#5f3c27"];
export const HAIR_COLORS = ["#1c1411", "#4a2c1a", "#8a5a2b", "#e0bb6e", "#b5402f", "#ece6dd", "#5b3a7a", "#e889a8"];
export const MOODS = [
	{ id: "happy", label: "Happy", color: "#ffd166" },
	{ id: "excited", label: "Excited", color: "#ff9f43" },
	{ id: "love", label: "In love", color: "#ff6b8b" },
	{ id: "shy", label: "Shy", color: "#ffb3c6" },
	{ id: "sleepy", label: "Sleepy", color: "#a0c4ff" },
	{ id: "sad", label: "Sad", color: "#7aa7d8" },
	{ id: "missing", label: "Missing you", color: "#b8a1ff" },
	{ id: "angry", label: "Angry", color: "#ff595e" }
];
const MOOD_COLOR = Object.fromEntries(MOODS.map(m => [m.id, m.color]));
// arm-layer animations that make the cheeks go pink
const LOVE_UPPERS = new Set(["blush", "lovestruck", "heartarms", "smooch", "cheekkiss", "cuddle", "slowdance", "propose", "kiss", "hug", "nightkiss", "carry", "carrykiss", "handhold"]);
// love you can still do while treading water (your legs keep kicking underneath)
const WATER_UPPERS = new Set(["handhold", "smooch", "cheekkiss", "kiss", "hug", "highfive", "blush", "lovestruck", "heart", "heartarms", "wink", "cuddle", "slowdance"]);
// solo ones also float little hearts
const HEART_UPPERS = new Set(["blush", "lovestruck", "heartarms"]);

// A tiny face that shows a mood (drawn, not an emoji) - used on name tags and in the HUD.
export function drawMoodFace(g, x, y, r, mood) {
	g.save();
	g.fillStyle = MOOD_COLOR[mood] || "#ffd166";
	g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
	g.strokeStyle = "#2a1f33"; g.fillStyle = "#2a1f33"; g.lineWidth = Math.max(2, r * 0.13); g.lineCap = "round";
	const ex = r * 0.36, ey = y - r * 0.18, er = r * 0.12;
	const eye = (cx) => {
		if (mood === "sleepy") { g.beginPath(); g.moveTo(cx - er * 1.4, ey); g.lineTo(cx + er * 1.4, ey); g.stroke(); }
		else if (mood === "love") { g.fillStyle = "#c9184a"; g.beginPath(); g.arc(cx - er * 0.6, ey - er * 0.3, er * 0.75, 0, Math.PI * 2); g.arc(cx + er * 0.6, ey - er * 0.3, er * 0.75, 0, Math.PI * 2); g.moveTo(cx - er * 1.3, ey); g.lineTo(cx, ey + er * 1.6); g.lineTo(cx + er * 1.3, ey); g.fill(); g.fillStyle = "#2a1f33"; }
		else { g.beginPath(); g.arc(cx, ey, er, 0, Math.PI * 2); g.fill(); }
	};
	eye(x - ex); eye(x + ex);
	if (mood === "angry") { g.beginPath(); g.moveTo(x - ex - er * 2, ey - er * 3); g.lineTo(x - ex + er * 1.5, ey - er * 1.6); g.moveTo(x + ex + er * 2, ey - er * 3); g.lineTo(x + ex - er * 1.5, ey - er * 1.6); g.stroke(); }
	if (mood === "sad" || mood === "missing") { g.beginPath(); g.moveTo(x - ex - er * 1.6, ey - er * 1.8); g.lineTo(x - ex + er * 1.6, ey - er * 2.8); g.moveTo(x + ex + er * 1.6, ey - er * 1.8); g.lineTo(x + ex - er * 1.6, ey - er * 2.8); g.stroke(); }
	const my = y + r * 0.32;
	g.beginPath();
	if (mood === "sad" || mood === "angry" || mood === "missing") g.arc(x, my + r * 0.3, r * 0.32, Math.PI * 1.15, Math.PI * 1.85);
	else if (mood === "excited") { g.arc(x, my - r * 0.05, r * 0.32, 0, Math.PI); g.closePath(); g.fill(); }
	else if (mood === "sleepy") g.arc(x, my, r * 0.1, 0, Math.PI * 2);
	else g.arc(x, my - r * 0.12, r * (mood === "shy" ? 0.22 : 0.34), Math.PI * 0.15, Math.PI * 0.85);
	g.stroke();
	if (mood === "missing" || mood === "sad") { g.fillStyle = "#4ea8ff"; g.beginPath(); g.arc(x + ex, ey + er * 3, er * 0.9, 0, Math.PI * 2); g.fill(); }
	if (mood === "shy" || mood === "love") { g.fillStyle = "rgba(255,90,120,0.55)"; g.beginPath(); g.arc(x - r * 0.55, y + r * 0.12, r * 0.15, 0, Math.PI * 2); g.arc(x + r * 0.55, y + r * 0.12, r * 0.15, 0, Math.PI * 2); g.fill(); }
	g.restore();
}

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

function labelTexture(text, color, mood) {
	const c = document.createElement("canvas");
	c.width = 512; c.height = 128;
	const g = c.getContext("2d");
	g.font = "700 54px 'Nunito', 'Segoe UI', sans-serif";
	const w = Math.min(500, g.measureText(text).width + 84);
	const x = (512 - w) / 2;
	g.fillStyle = "rgba(20,16,28,0.72)";
	roundRect(g, x, 22, w, 84, 42); g.fill();
	if (mood) drawMoodFace(g, x + 38, 64, 24, mood);
	else { g.fillStyle = color || "#fff"; g.beginPath(); g.arc(x + 36, 64, 12, 0, Math.PI * 2); g.fill(); }
	g.fillStyle = "#fff";
	g.textAlign = "left"; g.textBaseline = "middle";
	g.fillText(text, x + 70, 66, w - 84);
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
		// mug axis along the palm normal: upright with the forearm level, tipped to the lips when raised
		g.position.set(0, -0.07, 0.055);
		g.rotation.x = Math.PI / 2;
	} else if (kind === "popcorn") {
		// red and white striped bucket, overflowing
		const red = new THREE.MeshStandardMaterial({ color: "#d62839", roughness: 0.5, side: THREE.DoubleSide });
		const wht = new THREE.MeshStandardMaterial({ color: "#fdf6ec", roughness: 0.5, side: THREE.DoubleSide });
		for (let i = 0; i < 8; i++) {
			const seg = mesh(new THREE.CylinderGeometry(0.07, 0.052, 0.15, 3, 1, true, i * Math.PI / 4, Math.PI / 4), i % 2 ? red : wht);
			g.add(seg);
		}
		const pc = new THREE.MeshStandardMaterial({ color: "#fff1c2", roughness: 0.8 });
		for (let i = 0; i < 16; i++) {
			const k = mesh(new THREE.IcosahedronGeometry(0.018, 0), pc, false);
			const a = i * 2.4, r = (i % 4) * 0.016;
			k.position.set(Math.cos(a) * r, 0.075 + (i % 3) * 0.012, Math.sin(a) * r);
			g.add(k);
		}
		g.position.set(0, -0.08, 0.075);
		g.rotation.x = Math.PI / 2;
	} else if (kind === "fork" || kind === "spoon" || kind === "sponge") {
		if (kind === "sponge") {
			g.add(mesh(new THREE.BoxGeometry(0.09, 0.035, 0.06), new THREE.MeshStandardMaterial({ color: "#ffd166", roughness: 0.9 })));
			const top = mesh(new THREE.BoxGeometry(0.09, 0.012, 0.06), new THREE.MeshStandardMaterial({ color: "#2a9d8f", roughness: 0.9 }));
			top.position.y = 0.023; g.add(top);
			g.position.set(0, -0.07, 0.03);
		} else {
			const steel = new THREE.MeshStandardMaterial({ color: kind === "spoon" ? "#b07a4a" : "#d9dde2", roughness: kind === "spoon" ? 0.6 : 0.25, metalness: kind === "spoon" ? 0 : 0.9 });
			g.add(mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.17, 8), steel));
			const head = mesh(kind === "spoon" ? new THREE.SphereGeometry(0.022, 10, 8) : new THREE.BoxGeometry(0.026, 0.05, 0.004), steel);
			if (kind === "spoon") head.scale.set(1, 1.4, 0.4);
			head.position.y = 0.105; g.add(head);
			g.position.set(0, -0.1, 0.02);
			g.rotation.x = Math.PI;
		}
	} else if (kind === "brush") {
		g.add(mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.2, 8), new THREE.MeshStandardMaterial({ color: "#c58940", roughness: 0.5 })));
		const ferrule = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 8), new THREE.MeshStandardMaterial({ color: "#c0c4c8", metalness: 0.9, roughness: 0.3 }));
		ferrule.position.y = 0.11; g.add(ferrule);
		const tip = mesh(new THREE.ConeGeometry(0.009, 0.04, 8), new THREE.MeshStandardMaterial({ color: "#2b2d42", roughness: 0.6 }));
		tip.position.y = 0.145; g.add(tip);
		g.userData.tip = tip;
		// held like a pen: the brush continues the line of the forearm, tip 0.23m past the wrist
		g.position.set(0, -0.12, 0.01);
		g.rotation.x = Math.PI;
	} else if (kind === "flower") {
		g.add(mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.28, 6), new THREE.MeshStandardMaterial({ color: "#3d6b35" })));
		const petalM = new THREE.MeshStandardMaterial({ color: "#ff4d6d", roughness: 0.5 });
		for (let k = 0; k < 7; k++) {
			const pe = mesh(new THREE.SphereGeometry(0.028, 8, 6), petalM);
			pe.position.set(Math.cos(k * 0.9) * 0.018, 0.15 + (k % 3) * 0.008, Math.sin(k * 0.9) * 0.018);
			pe.scale.set(0.8, 1, 0.8);
			g.add(pe);
		}
		const leaf = mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: "#4f8a57" }));
		leaf.scale.set(0.4, 1.2, 0.2); leaf.position.set(0.02, 0.03, 0); leaf.rotation.z = -0.6;
		g.add(leaf);
		g.position.set(0, -0.07, 0.02);
		g.rotation.x = Math.PI * 0.85;
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
	} else if (kind === "ring") {
		// open velvet box with a sparkly ring, held out on the palm
		const velvet = new THREE.MeshStandardMaterial({ color: "#a3123a", roughness: 0.85 });
		g.add(mesh(new RoundedBoxGeometry(0.07, 0.04, 0.07, 2, 0.008), velvet));
		const lid = mesh(new RoundedBoxGeometry(0.07, 0.012, 0.07, 2, 0.005), velvet);
		lid.position.set(0, 0.045, -0.04); lid.rotation.x = -1.25; g.add(lid);
		const gold = new THREE.MeshStandardMaterial({ color: "#ffd36b", metalness: 1, roughness: 0.22 });
		const band = mesh(new THREE.TorusGeometry(0.017, 0.004, 8, 20), gold);
		band.position.y = 0.035; g.add(band);
		const gem = mesh(new THREE.OctahedronGeometry(0.011), new THREE.MeshStandardMaterial({ color: "#e8f6ff", emissive: "#bfe6ff", emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.05 }));
		gem.position.y = 0.058; g.add(gem);
		g.userData.gem = gem;
		g.position.set(0, -0.06, 0.05);
		g.rotation.x = Math.PI / 2;
	}
	return g;
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(),
	_v6 = new THREE.Vector3(), _v7 = new THREE.Vector3(), _v8 = new THREE.Vector3(), _v9 = new THREE.Vector3(), _v10 = new THREE.Vector3(),
	_v11 = new THREE.Vector3(), _v12 = new THREE.Vector3(), _v13 = new THREE.Vector3(), _v14 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();

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
		this.coupleSide = 0;
		this.coupleRole = null;   // "lapholder" / "lapsitter" (armchair), "under" / "over" (lying on the sofa)
		this.carriedBy = null;    // set while someone carries us in their arms (world.js places the root)
		this.kissAdj = 0;         // extra lean toward our partner so faces really meet in a kiss (world.js measures it)   // where the person we're cuddling/kissing is: -1 right, 1 left, 0 in front
		this.prop = null;
		this.zzz = [];
		this.mood = "happy";
		this.upperT = 0; this._lastUp = null;
		// inverse kinematics: world-space targets for each hand (set every frame by the world)
		this.ik = [null, null];
		this.ikW = [0, 0];
		this.ikLast = [new THREE.Vector3(), new THREE.Vector3()];
		this.ikReach = [0.075, 0.075];
		this.ikPole = null;
		this.moodFx = [];
		this.moodT = 0;
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
		this.blushM = blush; this.blushBase = blush.opacity; this._rosy = false;

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
		this.brows = [];
		this.tears = [];
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
			this.brows.push({ m: brow, sx, rot: brow.rotation.z, y: brow.position.y });
			const tear = mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshStandardMaterial({ color: "#8fd3ff", roughness: 0.05, transparent: true, opacity: 0.9 }), false);
			tear.scale.set(0.8, 1.3, 0.8);
			tear.position.set(sx * 0.05, -0.012, 0.12);
			tear.visible = false;
			face.add(tear);
			this.tears.push(tear);
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
		this.mouthRot = smile.rotation.z;
		const mouthO = mesh(new THREE.SphereGeometry(0.02, 14, 10), new THREE.MeshStandardMaterial({ color: "#5a1f2a", roughness: 0.6 }), false);
		mouthO.scale.set(1.1, 0.8, 0.4);
		mouthO.position.set(0, -0.05, 0.116);
		mouthO.visible = false;
		face.add(mouthO);
		this.mouthO = mouthO;
		this.face = face;
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
		this.applyFace();
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

	setMood(m) {
		if (!MOOD_COLOR[m] || m === this.mood) return;
		this.mood = m;
		this.setName(this.look.name, this.look.top);
		this.applyFace();
	}

	// eyebrows, mouth, blush for the current mood
	applyFace() {
		const m = this.mood;
		this.brows.forEach(b => {
			let d = 0, dy = 0;
			if (m === "angry") { d = b.sx < 0 ? -0.5 : 0.5; dy = -0.008; }
			else if (m === "sad" || m === "missing") { d = b.sx < 0 ? 0.4 : -0.4; dy = 0.004; }
			else if (m === "excited") dy = 0.01;
			b.m.rotation.z = b.rot + d; b.m.position.y = b.y + dy;
		});
		const frown = m === "sad" || m === "angry" || m === "missing";
		this.mouth.rotation.z = frown ? this.mouthRot - Math.PI : this.mouthRot;
		this.mouth.position.y = frown ? -0.058 : -0.045;
		this.mouth.scale.setScalar(m === "shy" ? 0.65 : m === "sleepy" ? 0.5 : 1);
		this.blushM.color.set(m === "angry" ? "#ff2a2a" : "#ff8fa3");
		this.blushM.opacity = m === "love" || m === "shy" ? 0.75 : m === "angry" ? 0.55 : this.blushBase;
	}

	setName(name, color) {
		if (this.label) { this.root.remove(this.label); this.label.material.map.dispose(); this.label.material.dispose(); }
		if (!name) { this.label = null; return; }
		const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(name, color, this.mood), depthTest: true, transparent: true }));
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
		// "bedsit" (sitting up in bed) is a sit with the legs stretched out along the mattress;
		// "lounge" (a pool lounger) the same, lying right back against the backrest
		const lounge = this.anim === "lounge";
		const bedsit = this.anim === "bedsit" || lounge;
		const base = bedsit ? "sit" : this.anim, up = this.upper;
		if (up !== this._lastUp) { this._lastUp = up; this.upperT = 0; }
		this.upperT += dt;
		const ut = this.upperT;
		const mood = this.mood;
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
			if (bedsit) {
				// back against the pillows, legs out straight, hands resting on the duvet
				P.leg[0].x = P.leg[1].x = -1.56; P.leg[0].k = P.leg[1].k = 0.1;
				P.foot[0] = P.foot[1] = -0.35;
				P.torsoX = -0.16 + breathe;
				P.arm[0].x = P.arm[1].x = -0.35; P.arm[0].e = P.arm[1].e = -0.55;
				P.arm[0].z = -0.18; P.arm[1].z = 0.18;
			}
			if (lounge) {
				// back flat on the backrest, head up to look out at the pool, one knee lazily raised,
				// arms resting along the sides
				P.torsoX = -0.72 + breathe;
				P.headX = 0.42;
				P.leg[1].x = -1.95; P.leg[1].k = 0.85; P.foot[1] = 0.2;
				P.leg[0].x = -1.55; P.leg[0].k = 0.06; P.foot[0] = -0.3;
				P.arm[0].x = P.arm[1].x = -0.15; P.arm[0].e = P.arm[1].e = -0.3;
				P.arm[0].z = -0.3; P.arm[1].z = 0.3;
			}
		} else if (base === "floor") {
			// sitting cross-legged on the floor
			P.bodyY = -0.7;
			P.leg[0].x = P.leg[1].x = -1.25; P.leg[0].z = -0.75; P.leg[1].z = 0.75;
			P.leg[0].k = P.leg[1].k = 2.3;
			P.arm[0].x = P.arm[1].x = -0.55; P.arm[0].e = P.arm[1].e = -0.6;
			P.arm[0].z = -0.3; P.arm[1].z = 0.3;
			P.torsoX = 0.05 + breathe;
		} else if (base === "carried") {
			// lying across someone's arms: knees over one arm, curled a little toward them, arm round their neck
			// (the root is tilted flat, local +x faces the person carrying us)
			P.leg[0].x = P.leg[1].x = -1.05; P.leg[0].k = P.leg[1].k = 1.45;
			P.leg[0].z = -0.03; P.leg[1].z = 0.03;
			P.foot[0] = P.foot[1] = 0.35;
			P.torsoX = 0.22 + breathe; P.bodyRY = 0.4;
			P.headX = -0.08; P.headY = 0.55;
			P.arm[0].x = -0.55; P.arm[0].z = -0.3; P.arm[0].e = -1.2;
			P.arm[1].x = -1.7; P.arm[1].e = -1.1;
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
		// mood body language when nothing else is going on
		if (!up && base !== "sleep" && base !== "carried") {
			if (mood === "sad" || mood === "missing") {
				P.torsoX += 0.13; P.headX += 0.28;
				if (!moving && base === "idle" && mood === "missing" && (t % 9) < 3.5) { P.arm[0].x = -0.9; P.arm[0].z = 0.55; P.arm[0].e = -1.5; }
			} else if (mood === "angry" && !moving && base === "idle") {
				P.arm[0].x = -0.95; P.arm[0].z = 0.62; P.arm[0].e = -1.95;
				P.arm[1].x = -0.85; P.arm[1].z = -0.62; P.arm[1].e = -1.95;
				P.headX = -0.08; P.headY = Math.sin(t * 0.7) * 0.25;
				if ((t % 6) < 0.5) { P.leg[0].x = -0.35; P.bodyY = -0.02; }
			} else if (mood === "shy" && !moving) {
				P.headX += 0.25; P.headZ = 0.15; P.headY = Math.sin(t * 0.6) * 0.15;
				if (base === "idle") { P.arm[0].x = P.arm[1].x = -0.35; P.arm[0].z = 0.35; P.arm[1].z = -0.35; P.arm[0].e = P.arm[1].e = -0.7; P.torsoY = Math.sin(t * 1.2) * 0.12; }
			} else if (mood === "excited" && !moving && base === "idle") {
				P.bodyY = -Math.abs(Math.sin(t * 6)) * 0.035; P.headZ = Math.sin(t * 3) * 0.08;
			} else if (mood === "sleepy") {
				P.headX += 0.15 + Math.max(0, Math.sin(t * 0.8)) * 0.25; P.torsoX += 0.06;
			} else if (mood === "love" && !moving) {
				P.headZ = Math.sin(t * 1.5) * 0.1;
			}
		}
		if (this.lookYaw !== null && base !== "sleep" && base !== "carried" && !moving) {
			P.headY = Math.max(-0.95, Math.min(0.95, this.lookYaw));
		}

		// carrying a mug: forearm held level out in front so it stays upright
		if ((this.propKind === "mug" || this.propKind === "popcorn") && !up && base !== "sleep" && base !== "carried") { P.arm[0].x = -0.2; P.arm[0].z = -0.15; P.arm[0].e = -1.35; }

		// in deep water: breaststroke when moving, treading water when still
		if (this.water > 0.55 && base === "idle" && (!up || up === "wave" || up === "laugh" || WATER_UPPERS.has(up))) {
			const s = t * (moving ? 4.4 : 2.4), pull = Math.max(0, Math.cos(s)), reach = Math.max(0, -Math.cos(s));
			// (holding hands: the free arm keeps stroking, the other one is in theirs)
			if (!up || up === "handhold") {
				P.arm[0].x = P.arm[1].x = -1.25 - reach * 0.35 + Math.sin(s) * 0.12;
				P.arm[0].z = -0.25 - pull * 0.95; P.arm[1].z = 0.25 + pull * 0.95;
				P.arm[0].e = P.arm[1].e = -0.35 - reach * 1.0;
			}
			P.leg[0].x = Math.sin(s * 2) * 0.35 - 0.2; P.leg[1].x = -Math.sin(s * 2) * 0.35 - 0.2;
			P.leg[0].k = P.leg[1].k = 0.35 + pull * 0.4;
			P.foot[0] = P.foot[1] = 0.4;
			// lying flat when swimming: look ahead, not down at the bottom of the pool
			const pr = this.swimProne || 0;
			P.torsoX = 0.04 * (1 - pr); P.headX = -0.02 - pr * 0.75;
			if (pr > 0.3) { P.leg[0].k = P.leg[1].k = 0.15 + pull * 0.5; P.foot[0] = P.foot[1] = 0.7; }
			P.bodyY = Math.sin(t * 2) * 0.025;
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
		} else if (up === "eat") {
			// fork from the plate to the mouth, chew, back down
			const s = (Math.sin(t * 2.6) + 1) / 2;
			P.arm[0].x = -1.0 - s * 0.55; P.arm[0].z = -0.28; P.arm[0].e = -1.35 - s * 0.6; P.arm[0].y = 0.3;
			P.arm[1].x = -0.62; P.arm[1].z = 0.18; P.arm[1].e = -1.05;
			P.headX = 0.12 - s * 0.16;
		} else if (up === "cook") {
			// stirring the pot, the other hand on the handle
			const c = t * 5;
			P.arm[0].x = -1.0 + Math.sin(c) * 0.12; P.arm[0].z = -0.1 + Math.cos(c) * 0.16; P.arm[0].e = -0.85;
			P.arm[1].x = -0.75; P.arm[1].z = 0.22; P.arm[1].e = -1.05;
			P.headX = 0.28; P.torsoX += 0.08;
		} else if (up === "wash") {
			// scrubbing a plate in the sink
			const c = t * 7;
			P.arm[0].x = -0.95 + Math.sin(c) * 0.1; P.arm[0].z = -0.12 + Math.cos(c) * 0.12; P.arm[0].e = -0.9;
			P.arm[1].x = -0.85; P.arm[1].z = 0.12 + Math.sin(c * 0.5) * 0.05; P.arm[1].e = -0.95;
			P.headX = 0.32; P.torsoX += 0.1;
		} else if (up === "pet" && base === "idle") {
			// crouch down and stroke the pet in front of you
			const c = Math.sin(t * 3.2);
			P.bodyY = -0.42;
			P.leg[0].x = P.leg[1].x = -1.25; P.leg[0].k = P.leg[1].k = 2.15;
			P.leg[0].z = -0.08; P.leg[1].z = 0.08;
			P.foot[0] = P.foot[1] = -0.6;
			P.torsoX = 0.4;
			P.arm[0].x = -1.05 + c * 0.12; P.arm[0].z = -0.1; P.arm[0].e = -0.25;
			P.arm[1].x = -0.4; P.arm[1].z = 0.25; P.arm[1].e = -0.9;
			P.headX = 0.25;
		} else if (up === "write") {
			// bent over the desk, pen scribbling, other hand holding the paper
			const w = Math.sin(t * 14) * 0.03;
			P.arm[0].x = -0.8 + w; P.arm[0].z = 0.12 + Math.sin(t * 3.1) * 0.05; P.arm[0].e = -1.05;
			P.arm[1].x = -0.65; P.arm[1].z = -0.2; P.arm[1].e = -1.25;
			P.torsoX += 0.14; P.headX = 0.32;
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

		else if (up === "laugh") {
			const sh = Math.sin(t * 18) * 0.04;
			P.torsoX = -0.12 + sh; P.headX = -0.32 + sh;
			P.arm[0].x = P.arm[1].x = -0.55; P.arm[0].z = 0.35; P.arm[1].z = -0.35; P.arm[0].e = P.arm[1].e = -1.5;
		} else if (up === "cry") {
			P.arm[0].x = P.arm[1].x = -1.95; P.arm[0].z = 0.38; P.arm[1].z = -0.38; P.arm[0].e = P.arm[1].e = -2.25;
			P.headX = 0.35; P.torsoX = 0.15 + Math.sin(t * 12) * 0.03;
		} else if (up === "kiss") {
			const k = (ut % 1.6) / 1.6;
			if (k < 0.45) { P.arm[0].x = -1.75; P.arm[0].z = 0.32; P.arm[0].e = -2.3; P.headX = 0.05; }
			else { P.arm[0].x = -1.55 - (k - 0.45) * 0.6; P.arm[0].z = -0.3; P.arm[0].e = -0.2; P.headX = -0.1; }
		} else if (up === "hug") {
			P.arm[0].x = P.arm[1].x = -1.35; P.arm[0].z = 0.35; P.arm[1].z = -0.35; P.arm[0].e = P.arm[1].e = -1.0;
			P.headY = 0.35; P.headZ = 0.12; P.torsoX = 0.08;
		} else if (up === "highfive") {
			P.arm[0].x = -2.65; P.arm[0].z = -0.15; P.arm[0].e = -0.2;
			P.torsoZ = 0.06;
		} else if (up === "jump") {
			const c = ut % 0.9;
			const air = c > 0.2 && c < 0.75 ? Math.sin((c - 0.2) / 0.55 * Math.PI) : 0;
			const crouch = c < 0.2 ? Math.sin(c / 0.2 * Math.PI) : 0;
			P.bodyY = air * 0.38 - crouch * 0.1;
			P.leg[0].x = P.leg[1].x = -0.3 * crouch - 0.25 * air; P.leg[0].k = P.leg[1].k = 0.6 * crouch + 0.5 * air;
			P.arm[0].z = -0.6 - air * 1.6; P.arm[1].z = 0.6 + air * 1.6;
		} else if (up === "bow") {
			const k = Math.min(1, ut * 2.5) * (ut > 1.6 ? Math.max(0, 1 - (ut - 1.6) * 2) : 1);
			P.torsoX = 0.75 * k; P.headX = 0.2 * k;
			P.arm[0].x = P.arm[1].x = 0.15 * k; P.arm[0].z = -0.05; P.arm[1].z = 0.05; P.arm[0].e = P.arm[1].e = -0.1;
		} else if (up === "cheer") {
			const w = Math.sin(t * 10) * 0.25;
			P.arm[0].z = -2.8 + w; P.arm[1].z = 2.8 - w; P.arm[0].e = P.arm[1].e = -0.25;
			P.bodyY = -Math.abs(Math.sin(t * 5)) * 0.05; P.headX = -0.2;
		} else if (up === "think") {
			P.arm[0].x = -1.55; P.arm[0].z = 0.45; P.arm[0].e = -2.35;
			P.arm[1].x = -0.9; P.arm[1].z = -0.55; P.arm[1].e = -1.6;
			P.headZ = 0.16; P.headX = -0.08; P.headY = -0.2;
		} else if (up === "shrug") {
			const k = Math.min(1, ut * 4);
			P.arm[0].z = -0.55 * k; P.arm[1].z = 0.55 * k; P.arm[0].x = P.arm[1].x = -0.25 * k; P.arm[0].e = P.arm[1].e = -1.55 * k;
			P.arm[0].y = -0.8 * k; P.arm[1].y = 0.8 * k;
			P.headZ = 0.2 * k; P.bodyY = 0.015 * k;
		} else if (up === "facepalm") {
			P.arm[0].x = -2.0; P.arm[0].z = 0.28; P.arm[0].e = -2.4;
			P.headX = 0.35; P.torsoX = 0.1;
		} else if (up === "yawn") {
			const k = Math.min(1, ut * 2);
			P.arm[0].z = -2.9 * k; P.arm[1].z = 2.9 * k; P.arm[0].e = P.arm[1].e = -0.4;
			P.torsoX = -0.18 * k; P.headX = -0.3 * k;
		} else if (up === "warm") {
			const r = Math.sin(t * 6) * 0.06;
			P.arm[0].x = P.arm[1].x = -1.25; P.arm[0].z = 0.14 + r; P.arm[1].z = -0.14 + r; P.arm[0].e = P.arm[1].e = -0.45;
			P.torsoX = 0.12;
		} else if (up === "telescope") {
			P.torsoX = 0.42; P.headX = -0.15;
			P.arm[0].x = P.arm[1].x = -1.35; P.arm[0].z = 0.15; P.arm[1].z = -0.25; P.arm[0].e = P.arm[1].e = -0.9;
			P.leg[0].x = -0.15; P.leg[1].x = 0.2;
		} else if (up === "shake") {
			const sh = Math.sin(t * 20) * 0.12;
			P.arm[0].x = P.arm[1].x = -1.25 + sh; P.arm[0].e = P.arm[1].e = -0.5;
			if (base === "sit" && this.coupleSide) {
				// in bed beside them: lean over sideways onto their shoulder
				const sd = this.coupleSide;
				P.torsoX = 0.05; P.torsoZ = -sd * 0.7 + sh * 0.15; P.headZ = -sd * 0.2; P.headX = 0.3; P.headY = sd * 0.2;
			} else if (base === "sleep") { P.bodyRY = (this.coupleSide || 1) * 0.9; }
			else { P.torsoX = 0.4; P.headX = 0.1; }
		} else if (up === "give") {
			P.arm[0].x = -1.3; P.arm[0].z = 0.05; P.arm[0].e = -0.35; P.headX = 0.1;
		} else if (up === "stumble") {
			const f = Math.sin(t * 14);
			P.torsoX = -0.35 + f * 0.05; P.bodyY = -0.05;
			P.arm[0].z = -1.4 + f * 0.5; P.arm[1].z = 1.4 - f * 0.5; P.arm[0].e = P.arm[1].e = -0.6;
			P.leg[0].x = 0.4; P.leg[0].k = 0.3;
		}

		// ---- love layer (hands that touch the other person are placed by IK in world.js)
		const side = this.coupleSide;
		const lying = base === "sleep";
		if (up === "blush") {
			// hands on the cheeks, swaying shyly
			P.arm[0].x = P.arm[1].x = -1.7; P.arm[0].z = 0.3; P.arm[1].z = -0.3; P.arm[0].e = P.arm[1].e = -2.4;
			P.headX = 0.18; P.headZ = Math.sin(t * 2.2) * 0.16; P.torsoY = Math.sin(t * 2.2) * 0.12;
		} else if (up === "lovestruck") {
			// hands clasped under the chin, dreamy head tilt
			P.arm[0].x = P.arm[1].x = -1.3; P.arm[0].z = 0.32; P.arm[1].z = -0.32; P.arm[0].e = P.arm[1].e = -2.1;
			P.headX = -0.12; P.headZ = Math.sin(t * 1.6) * 0.2; P.bodyRY = Math.sin(t * 1.6) * 0.08;
			if (base === "idle" && !moving) P.bodyY = -Math.abs(Math.sin(t * 3.2)) * 0.02;
		} else if (up === "heartarms") {
			// arms make a big heart over the head (hands meet via IK)
			P.arm[0].z = -2.45; P.arm[1].z = 2.45; P.arm[0].e = P.arm[1].e = -1.2;
			P.headX = -0.1; P.torsoZ = Math.sin(t * 2) * 0.05;
		} else if (up === "wink") {
			// finger-gun wink
			P.arm[0].x = -1.35; P.arm[0].z = -0.1; P.arm[0].e = -0.25;
			P.headZ = 0.14; P.headX = -0.05;
		} else if (up === "propose") {
			// down on one knee, ring held out, looking up at them
			const k = Math.min(1, ut * 2);
			P.bodyY = -0.42 * k;
			P.leg[0].x = -1.45 * k; P.leg[0].k = 1.5 * k; P.leg[0].z = -0.05;
			P.leg[1].x = 0.15 * k; P.leg[1].k = 1.65 * k; P.leg[1].z = 0.05;
			P.foot[1] = 0.6 * k;
			P.torsoX = 0.05;
			P.arm[0].x = -1.45; P.arm[0].z = -0.05; P.arm[0].e = -0.35 + Math.sin(t * 3) * 0.04;
			P.arm[1].x = -0.55; P.arm[1].z = 0.1; P.arm[1].e = -0.9;
			P.headX = -0.3;
		} else if (up === "carry" || up === "carrykiss") {
			// someone in your arms: arms out in front (hands placed by IK), leaning back a touch to take the weight
			P.arm[0].x = P.arm[1].x = -1.0; P.arm[0].e = P.arm[1].e = -1.3;
			P.arm[0].z = 0.15; P.arm[1].z = -0.15;
			P.torsoX = -0.1 + breathe; P.headX = 0.25; P.headY = -0.35;
			if (up === "carrykiss") {
				// lean down to the right, where their face is (the rest of the lean is measured: kissAdj)
				const k = Math.min(1, ut * 2.5);
				P.torsoX = 0.02 * k; P.torsoZ = (0.12 + this.kissAdj) * k;
				P.headX = 0.32 * k; P.headY = -0.55 * k; P.headZ = 0.12 * k;
				if (ut > 0.35) P.eyes = 0.05;
			}
		} else if (up === "cuddle" || up === "smooch" || up === "cheekkiss") {
			const kiss = up !== "cuddle";
			const role = this.coupleRole;
			if (base === "carried") {
				// in their arms: roll toward them and curl up to their face (lean measured: kissAdj)
				P.bodyRY = kiss ? 1.0 : 0.6;
				P.torsoX = (kiss ? 0.3 : 0.22) + (kiss ? this.kissAdj : 0);
				P.headY = 0.3; P.headX = -0.15;
			} else if (lying && role === "under") {
				// on your back along the sofa, arm round them (IK), face turned to theirs
				P.bodyRY = side * (kiss ? 0.45 : 0.25);
				P.headY = side * (kiss ? 0.65 : 0.45);
				P.arm[0].e = P.arm[1].e = -0.6;
			} else if (lying && role === "over") {
				// rolled right onto your side, half on top of them, head tucked in by their shoulder
				P.bodyRY = side * 1.25;
				P.headY = side * (kiss ? 0.4 : 0.15); P.headX = kiss ? 0 : 0.15;
				P.torsoX = 0.1;
				P.leg[0].x = P.leg[1].x = -0.3; P.leg[0].k = 0.5; P.leg[1].k = 0.25;
				P.arm[0].e = P.arm[1].e = -0.9;
			} else if (role === "lapholder") {
				// someone on your lap: sit back into the chair and look up at them (arms round their waist via IK)
				P.torsoX = kiss ? 0.0 : -0.14;
				P.headX = kiss ? -0.15 : -0.05;
				P.headY = kiss ? -0.5 : -0.3;
			} else if (role === "lapsitter" && side) {
				// on their lap: stay upright on their thighs, just rest your head back on their shoulder
				P.torsoZ = -side * 0.06;
				P.headZ = -side * (kiss ? 0.1 : 0.3);
				P.headY = side * (kiss ? 0.9 : 0.45);
				P.headX = kiss ? -0.1 : 0;
			} else if (lying) {
				// roll onto your side toward them
				P.bodyRY = side * (kiss ? 1.0 : 0.85);
				P.headY = side * (kiss ? 0.45 : 0.3);
				P.arm[0].e = P.arm[1].e = -0.6;
			} else if (lounge && side) {
				// on the next lounger over: hand in theirs (IK), turned to look at them; a kiss leans across the gap
				P.torsoZ = kiss ? -side * 0.24 : -side * 0.05;
				P.headY = side * (kiss ? 0.9 : 0.55);
				P.headZ = -side * (kiss ? 0.15 : 0.08);
				P.headX = kiss ? 0.2 : 0.3;
			} else if (side) {
				// side by side (sofa, swing, bean bags, a lap): lean in, head on their shoulder
				P.torsoZ = -side * (kiss ? 0.24 : 0.17);
				P.headZ = -side * (kiss ? 0.12 : 0.34);
				P.headY = side * (kiss ? 0.95 : 0.3);
				P.headX = kiss ? -0.05 : 0.08;
			} else if (base === "sit") {
				// across a table: lean forward on the elbows toward them
				P.torsoX = kiss ? 0.32 : 0.14; P.headX = kiss ? -0.12 : 0.02;
				P.arm[0].x = P.arm[1].x = -1.1; P.arm[0].e = P.arm[1].e = -0.5;
				P.headZ = kiss ? 0.22 : Math.sin(t * 1.3) * 0.06;
			} else {
				// standing face to face
				P.torsoX = kiss ? 0.1 : 0.04; P.headX = kiss ? 0.06 : 0;
				P.headZ = kiss ? (up === "cheekkiss" ? 0.38 : 0.24) : 0;
				P.headY = up === "cheekkiss" ? 0.32 : 0;
				P.arm[0].x = P.arm[1].x = -1.0; P.arm[0].e = P.arm[1].e = -0.8;
				if (up === "smooch") { P.leg[1].x = 0.3; P.leg[1].k = 0.7; P.foot[1] = 0.4; }   // the little foot pop
			}
			// kisses: the measured extra lean toward them (sideways on a seat, forward when facing / lying on your side)
			if (kiss && base !== "carried") {
				if (side && !lying) P.torsoZ += -side * this.kissAdj;
				else P.torsoX += this.kissAdj;
			}
			if (kiss && ut > 0.35) P.eyes = 0.05;
			if (up === "cuddle" && !lying && side) P.eyes = (t % 6) < 2 ? 0.05 : 1;   // drowsy, content blinks
		} else if (up === "nightkiss") {
			// lean right over someone asleep and kiss their cheek
			const k = Math.min(1, ut * 1.6), sd = side || 1;
			if (lying) {
				// propped up on an elbow, rolled toward them
				P.bodyRY = sd * 1.05 * k; P.torsoX = 0.35 * k; P.torsoZ = -sd * 0.25 * k;
				P.headX = 0.25 * k; P.headZ = -sd * 0.2 * k;
				P.arm[sd < 0 ? 1 : 0].x = -0.6; P.arm[sd < 0 ? 1 : 0].e = -1.4;
			} else {
				// sitting up beside them: bend right over sideways, face down to their cheek
				P.torsoX = 0.08 * k; P.torsoZ = -sd * 1.02 * k;
				P.headX = 0.3 * k; P.headZ = -sd * 0.3 * k; P.headY = sd * 0.25 * k;
				// the far hand braces on the mattress
				P.arm[sd < 0 ? 1 : 0].z = sd * 0.9 * k; P.arm[sd < 0 ? 1 : 0].e = -0.2;
			}
			if (ut > 0.6) P.eyes = 0.05;
		} else if (up === "handhold") {
			// hand in hand (the hand itself is placed by IK): every so often a happy glance at them
			const glance = Math.max(0, Math.sin(t * 0.7));
			if (side) { P.headY = side * (0.12 + glance * 0.5); P.headZ = -side * 0.06 * glance; }
		} else if (up === "slowdance") {
			const b = t * 1.3;
			P.bodyRY = Math.sin(b) * 0.12;
			P.torsoZ = Math.sin(b) * 0.05;
			P.bodyY = -Math.abs(Math.sin(b)) * 0.02;
			P.leg[0].x = Math.max(0, Math.sin(b)) * 0.18; P.leg[1].x = Math.max(0, -Math.sin(b)) * 0.18;
			P.leg[0].k = Math.max(0, Math.sin(b)) * 0.25; P.leg[1].k = Math.max(0, -Math.sin(b)) * 0.25;
			P.arm[0].x = P.arm[1].x = -1.4; P.arm[0].e = P.arm[1].e = -0.7;
			P.headZ = 0.18 + Math.sin(b) * 0.05; P.headX = 0.05;
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
		const wink = up === "wink" && ut > 0.25 && ut < 1.1;
		this.lids.forEach((l, i) => { const shut = blink || (wink && i === 0); const target = shut ? 1.45 : -0.45; l.rotation.x += (target - l.rotation.x) * Math.min(1, dt * 30); if (l.userData.lash) l.userData.lash.visible = !shut; });
		// rosy cheeks while being sweet
		const rosy = LOVE_UPPERS.has(up);
		if (rosy !== this._rosy) { this._rosy = rosy; if (rosy) this.blushM.opacity = 0.85; else this.applyFace(); }
		if (this.prop && this.prop.userData.gem) this.prop.userData.gem.rotation.y += dt * 3;
		const openMouth = up === "laugh" || up === "yawn" || up === "cheer" || (mood === "excited" && !up) || (mood === "sleepy" && (t % 7) < 1.2);
		this.mouthO.visible = openMouth && base !== "sleep";
		if (openMouth) this.mouthO.scale.y = up === "yawn" || mood === "sleepy" ? 1.4 : 0.8 + Math.abs(Math.sin(t * 16)) * 0.4;
		this.mouth.visible = !this.mouthO.visible;
		if (mood === "sleepy" && !blink) this.lids.forEach(l => { l.rotation.x = Math.max(l.rotation.x, 0.45); });
		// tears roll down the cheeks
		const crying = up === "cry" || ((mood === "sad" || mood === "missing") && base !== "sleep" && (t % 5) < 2.5);
		this.tears.forEach((tr, i) => {
			tr.visible = crying;
			if (crying) { const k = ((t * (0.9 + i * 0.2)) % 1); tr.position.y = -0.012 - k * 0.07; tr.material.opacity = 1 - k; }
		});
		this.updateMoodFx(dt, base, up);
		this.shadowBlob.visible = base !== "sleep" && base !== "carried";
		this.shadowBlob.material.opacity = base === "sit" ? 0.1 : 0.22;
		this.propHolder.visible = !!this.prop;

		// sleepy z's
		if (base === "sleep" && !up) {
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
			if (age > 3 || base !== "sleep" || up) { this.root.remove(s); s.material.dispose(); this.zzz.splice(i, 1); }
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
		this.solveIK(dt);
	}

	// little floating things that show a mood: steam when angry, hearts when in love
	updateMoodFx(dt, base, up) {
		this.moodT += dt;
		const m = this.mood;
		const hearts = m === "love" || HEART_UPPERS.has(up);
		if (base !== "sleep" && this.moodT > (m === "angry" && !hearts ? 0.5 : HEART_UPPERS.has(up) ? 0.45 : 1.8) && (m === "angry" || hearts)) {
			this.moodT = 0;
			let o;
			if (m === "angry" && !hearts) o = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, depthWrite: false }));
			else {
				const sh = new THREE.Shape();
				sh.moveTo(0, -0.03); sh.bezierCurveTo(-0.04, 0, -0.04, 0.035, 0, 0.02); sh.bezierCurveTo(0.04, 0.035, 0.04, 0, 0, -0.03);
				o = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: "#ff4d6d", transparent: true, side: THREE.DoubleSide, depthWrite: false }));
			}
			const side = Math.random() < 0.5 ? -1 : 1;
			o.position.set(side * 0.12, (this.body.position.y + 1.85) * this.body.scale.y, 0);
			o.userData = { life: 0, side };
			this.root.add(o);
			this.moodFx.push(o);
		}
		for (let i = this.moodFx.length - 1; i >= 0; i--) {
			const o = this.moodFx[i];
			o.userData.life += dt;
			o.position.y += dt * 0.35;
			o.position.x += o.userData.side * dt * 0.08;
			o.scale.setScalar(1 + o.userData.life * (o.geometry.type === "SphereGeometry" ? 1.5 : 0.3));
			o.material.opacity = Math.max(0, 0.8 - o.userData.life * 0.6);
			if (o.userData.life > 1.3) { this.root.remove(o); o.geometry.dispose(); o.material.dispose(); this.moodFx.splice(i, 1); }
		}
	}

	// Two-bone IK: swing each arm so the hand (plus whatever it holds) reaches its target.
	solveIK(dt) {
		if (!this.ik[0] && !this.ik[1] && this.ikW[0] < 0.001 && this.ikW[1] < 0.001) return;
		this.root.updateMatrixWorld(true);
		const S = _v1, E0 = _v2, W0 = _v3;
		for (let i = 0; i < 2; i++) {
			const a = this.arms[i];
			const tgt = this.ik[i];
			if (tgt) this.ikLast[i].copy(tgt);
			this.ikW[i] += ((tgt ? 1 : 0) - this.ikW[i]) * Math.min(1, dt * 7);
			const w = this.ikW[i];
			if (w < 0.001) continue;
			a.sh.getWorldPosition(S);
			a.elbow.getWorldPosition(E0);
			a.hand.getWorldPosition(W0);
			const sc = this.body.scale.y;
			const L1 = S.distanceTo(E0), L2 = E0.distanceTo(W0) + this.ikReach[i] * sc;
			const T = _v4.copy(this.ikLast[i]);
			const n = _v5.subVectors(T, S);
			let d = n.length();
			if (d < 1e-4) continue;
			n.divideScalar(d);
			d = Math.min(L1 + L2 - 0.002, Math.max(Math.abs(L1 - L2) + 0.01, d));
			// elbows point down, back and out (or along a custom pole)
			const tq = a.sh.parent.getWorldQuaternion(_q1);
			const pole = _v6.copy(this.ikPole || _v7.set(a.side * 0.7, -1, -0.45)).applyQuaternion(this.ikPole ? _q2.identity() : tq);
			const pp = pole.addScaledVector(n, -pole.dot(n));
			if (pp.lengthSq() < 1e-6) pp.set(0, -1, 0);
			pp.normalize();
			const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
			const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
			const u = _v8.copy(n).multiplyScalar(Math.cos(A)).addScaledVector(pp, Math.sin(A)).normalize();
			const E = _v9.copy(S).addScaledVector(u, L1);
			const Tc = _v10.copy(S).addScaledVector(n, d);
			const f = _v11.subVectors(Tc, E).normalize();
			// basis for the shoulder pivot: -Y along the upper arm, +Z toward the forearm's bend
			const Y = _v12.copy(u).negate();
			const Z = _v13.copy(f).addScaledVector(u, -f.dot(u));
			if (Z.lengthSq() < 1e-6) Z.copy(pp); else Z.normalize();
			const X = _v14.crossVectors(Y, Z).normalize();
			_m1.makeBasis(X, Y, Z);
			const qw = _q3.setFromRotationMatrix(_m1);
			const qLocal = tq.invert().multiply(qw);
			a.sh.quaternion.slerp(qLocal, w);
			const bend = -Math.acos(Math.max(-1, Math.min(1, u.dot(f))));
			a.elbow.rotation.x += (bend - a.elbow.rotation.x) * w;
		}
	}
}
