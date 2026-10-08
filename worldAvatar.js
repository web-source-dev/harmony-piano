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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, normalizeLook, outfitById } from "./worldOutfits.js";
export { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS };

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
const LOVE_UPPERS = new Set(["foreheadkiss", "boop", "backhug", "neckkiss", "buttpat", "beckon", "flirty", "bitelip", "shy", "melt", "giggle", "eep", "dz_sway", "blush", "lovestruck", "heartarms", "smooch", "cheekkiss", "cuddle", "slowdance", "propose", "kiss", "hug", "nightkiss", "carry", "carrykiss", "handhold"]);
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
// snacks you can carry (world.js FOODS: what they're called, how many bites)
export const FOOD_PROPS = ["apple", "cake", "icecream", "juice", "sandwich", "strawberry", "cookie", "marshmallow", "smoothie"];
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
	} else if (FOOD_PROPS.includes(kind)) {
		// snacks (from the fridge, the fire pit, the smoothie bar): built upright, held like the mug
		const M = (c, r = 0.6, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r }, extra || {}));
		if (kind === "apple") {
			g.add(mesh(new THREE.SphereGeometry(0.04, 16, 12), M("#d62839", 0.35)));
			const st = mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.025, 6), M("#5b3a1e")); st.position.y = 0.045; g.add(st);
			const lf = mesh(new THREE.SphereGeometry(0.012, 8, 6), M("#4f8a57")); lf.scale.set(1, 0.3, 0.6); lf.position.set(0.012, 0.05, 0); g.add(lf);
		} else if (kind === "cake") {
			const sl = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12, 1, false, 0, Math.PI / 4), M("#ffd6e0", 0.7)); sl.position.set(-0.04, 0, -0.04); g.add(sl);
			const top = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 12, 1, false, 0, Math.PI / 4), M("#fff8f0", 0.5)); top.position.set(-0.04, 0.03, -0.04); g.add(top);
			const ch = mesh(new THREE.SphereGeometry(0.011, 8, 6), M("#d62839", 0.3)); ch.position.set(0.0, 0.045, 0.0); g.add(ch);
		} else if (kind === "icecream") {
			const cone = mesh(new THREE.ConeGeometry(0.03, 0.1, 14), M("#e0a96d", 0.8)); cone.rotation.x = Math.PI; g.add(cone);
			[["#ffc8dd", 0.06], ["#fdf0d5", 0.095]].forEach(([c, y]) => { const s = mesh(new THREE.SphereGeometry(0.032, 14, 10), M(c, 0.5)); s.position.y = y; g.add(s); });
		} else if (kind === "juice" || kind === "smoothie") {
			const glass = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.11, 16, 1, true), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }), false);
			g.add(glass);
			const liq = mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.085, 16), M(kind === "juice" ? "#ffa62b" : "#ff8fab", 0.3), false); liq.position.y = -0.01; g.add(liq);
			const straw = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), M(kind === "juice" ? "#ffffff" : "#3ff0ff", 0.4)); straw.position.set(0.012, 0.05, 0); straw.rotation.z = -0.2; g.add(straw);
		} else if (kind === "sandwich") {
			for (const y of [-0.018, 0.018]) { const b = mesh(new THREE.BoxGeometry(0.1, 0.014, 0.08), M("#e9c46a", 0.9)); b.position.y = y; g.add(b); }
			const let_ = mesh(new THREE.BoxGeometry(0.105, 0.01, 0.085), M("#8ac926", 0.7)); let_.position.y = -0.004; g.add(let_);
			const tom = mesh(new THREE.BoxGeometry(0.09, 0.01, 0.07), M("#e63946", 0.5)); tom.position.y = 0.007; g.add(tom);
		} else if (kind === "strawberry") {
			for (let i = 0; i < 3; i++) {
				const s = mesh(new THREE.ConeGeometry(0.018, 0.035, 10), M("#e5383b", 0.4)); s.rotation.x = Math.PI; s.position.set(Math.cos(i * 2.1) * 0.022, 0.005 + i * 0.01, Math.sin(i * 2.1) * 0.022); g.add(s);
				const l = mesh(new THREE.CylinderGeometry(0.014, 0.008, 0.006, 6), M("#4f8a57")); l.position.set(s.position.x, s.position.y + 0.02, s.position.z); g.add(l);
			}
		} else if (kind === "cookie") {
			g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 18), M("#c68b59", 0.9)));
			for (let i = 0; i < 5; i++) { const c = mesh(new THREE.SphereGeometry(0.007, 6, 4), M("#4a2c1c"), false); c.position.set(Math.cos(i * 1.3) * 0.022, 0.007, Math.sin(i * 1.3) * 0.022); g.add(c); }
		} else if (kind === "marshmallow") {
			const stick = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 6), M("#8a5a3c")); stick.position.y = 0.1; g.add(stick);
			const mm = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 12), M("#e9b872", 0.8)); mm.position.y = 0.24; g.add(mm);
		}
		g.position.set(0, -0.07, 0.055);
		g.rotation.x = Math.PI / 2;
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

// ---------- building blocks for the body and clothes
const _o3 = new THREE.Object3D();
// bake a transform into a geometry: p position, r rotation (euler), s scale (number or [x, y, z])
function bake(geo, p, r, s) {
	_o3.position.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
	_o3.rotation.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
	if (typeof s === "number") _o3.scale.setScalar(s); else _o3.scale.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1);
	_o3.updateMatrix();
	geo.applyMatrix4(_o3.matrix);
	return geo;
}
// Many still pieces that share a material and a joint are drawn as one mesh (an avatar is a lot of little shapes).
class Batch {
	constructor() { this.groups = new Map(); }
	add(parent, mat, geo, cast = true) {
		let byMat = this.groups.get(parent);
		if (!byMat) this.groups.set(parent, byMat = new Map());
		let e = byMat.get(mat);
		if (!e) byMat.set(mat, e = { geos: [], cast: false });
		for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") geo.deleteAttribute(k);
		if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
		e.geos.push(geo.index ? geo.toNonIndexed() : geo);
		if (geo.index) geo.dispose();
		e.cast = e.cast || cast;
		return geo;
	}
	flush() {
		this.groups.forEach((byMat, parent) => byMat.forEach((e, m) => {
			const geo = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false);
			if (e.geos.length > 1) e.geos.forEach(g => g.dispose());
			parent.add(mesh(geo, m, e.cast));
		}));
		this.groups.clear();
	}
}
// a smooth revolved outline: pts [r, y] (y going up), smoothed, revolved round y (the seam at the back)
function revolve(pts, segs = 28, rows = 0, phiStart = Math.PI, phiLength = Math.PI * 2) {
	const v = pts.map(p => new THREE.Vector2(p[0], p[1]));
	const sm = rows ? new THREE.SplineCurve(v).getPoints(rows) : v;
	sm.forEach(p => { p.x = Math.max(0, p.x); });
	return new THREE.LatheGeometry(sm, segs, phiStart, phiLength);
}
// a rounded limb from yTop down to yBot, radii rs from top to bottom (evenly spaced), round ends
function limbGeo(yTop, yBot, rs, segs = 18, cap = 0.8) {
	const n = rs.length, rb = rs[n - 1], rt = rs[0], pts = [];
	for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + i / 4 * Math.PI / 2; pts.push([Math.cos(a) * rb, yBot + Math.sin(a) * rb * cap]); }
	for (let i = n - 2; i >= 1; i--) pts.push([rs[i], yBot + (yTop - yBot) * (n - 1 - i) / (n - 1)]);
	for (let i = 0; i <= 4; i++) { const a = i / 4 * Math.PI / 2; pts.push([Math.cos(a) * rt, yTop + Math.sin(a) * rt * cap]); }
	return revolve(pts, segs, pts.length * 3);
}
// an open tube (a sleeve, a trouser leg): radii rs from yTop down to yBot
function tubeGeo(yTop, yBot, rs, segs = 22) {
	const n = rs.length, pts = [];
	for (let i = n - 1; i >= 0; i--) pts.push([rs[i], yBot + (yTop - yBot) * (n - 1 - i) / (n - 1)]);
	return revolve(pts, segs, n > 2 ? n * 4 : 0);
}
const ring = (r, t, y, sx = 1, sz = 1, seg = 28) => bake(new THREE.TorusGeometry(r, t, 6, seg), [0, y, 0], [Math.PI / 2, 0, 0], [sx, sz, 1]);
// a round tube along an ellipse (rx across, rz front to back) at height y
function ellipseRing(rx, rz, y, t, seg = 64) {
	const pts = [];
	for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * rx, y, Math.cos(a) * rz)); }
	return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), seg, t, 6, true);
}
const shade = (c, k) => "#" + new THREE.Color(c).multiplyScalar(k).getHexString();
const smooth01 = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const gauss = (d2, s) => Math.exp(-d2 / (2 * s * s));
const interp = (tab, x) => {
	if (x <= tab[0][0]) return tab[0][1];
	for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; const t = smooth01((x - x0) / (x1 - x0)); return y0 + (y1 - y0) * t; }
	return tab[tab.length - 1][1];
};

// ---------- shared textures (made once, never disposed with an avatar)
function sharedTex(w, h, draw, rx = 1, ry = 1) {
	const c = document.createElement("canvas");
	c.width = w; c.height = h;
	draw(c.getContext("2d"), w, h);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(rx, ry);
	t.anisotropy = 4;
	t.userData.shared = true;
	return t;
}
let _tex = null;
function tex() {
	if (_tex) return _tex;
	let seed = 7;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
	_tex = {
		// plain cotton: a fine, soft weave
		cotton: sharedTex(256, 256, (g, w, h) => {
			g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, w, h);
			for (let i = 0; i < 9000; i++) { const v = 215 + rnd() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
			g.globalAlpha = 0.08; g.strokeStyle = "#000";
			for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
		}, 3, 3),
		// denim: diagonal twill with faded threads
		denim: sharedTex(256, 256, (g, w, h) => {
			g.fillStyle = "#e6e6e6"; g.fillRect(0, 0, w, h);
			g.lineWidth = 2;
			for (let i = -h; i < w; i += 4) { const v = 175 + rnd() * 60; g.strokeStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
			for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.35})`; g.fillRect(rnd() * w, rnd() * h, 3, 1); }
		}, 4, 4),
		// knit: soft vertical ribs
		knit: sharedTex(256, 256, (g, w, h) => {
			g.fillStyle = "#eeeeee"; g.fillRect(0, 0, w, h);
			for (let x = 0; x < w; x += 8) {
				const gr = g.createLinearGradient(x, 0, x + 8, 0);
				gr.addColorStop(0, "rgba(0,0,0,0.22)"); gr.addColorStop(0.5, "rgba(255,255,255,0.15)"); gr.addColorStop(1, "rgba(0,0,0,0.22)");
				g.fillStyle = gr; g.fillRect(x, 0, 8, h);
			}
			for (let y = 0; y < h; y += 6) { g.fillStyle = "rgba(0,0,0,0.06)"; g.fillRect(0, y, w, 2); }
		}, 6, 4),
		// leather: a faint grain
		leather: sharedTex(256, 256, (g, w, h) => {
			g.fillStyle = "#e9e9e9"; g.fillRect(0, 0, w, h);
			for (let i = 0; i < 5000; i++) { const v = 190 + rnd() * 60; g.fillStyle = `rgba(${v},${v},${v},0.7)`; g.beginPath(); g.arc(rnd() * w, rnd() * h, rnd() * 2.2, 0, Math.PI * 2); g.fill(); }
		}, 3, 3),
		// hair: strands running from the crown down
		hair: sharedTex(256, 256, (g, w, h) => {
			g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, w, h);
			for (let i = 0; i < 700; i++) {
				const x = rnd() * w, v = 140 + rnd() * 115;
				g.strokeStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.5})`; g.lineWidth = 0.6 + rnd() * 1.4;
				g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - 0.5) * 8, h * 0.33, x + (rnd() - 0.5) * 8, h * 0.66, x + (rnd() - 0.5) * 6, h); g.stroke();
			}
		}, 6, 2),
		// a soft round glow: cheeks
		blush: (() => { const t = sharedTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.55, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; })()
	};
	return _tex;
}
// the iris: rings and fibres round a dark pupil, with a catchlight
const IRIS = new Map();
function irisTex(color) {
	if (IRIS.has(color)) return IRIS.get(color);
	const c = new THREE.Color(color);
	const css = k => "#" + c.clone().multiplyScalar(k).getHexString();
	const t = sharedTex(128, 128, (g, w, h) => {
		g.clearRect(0, 0, w, h);
		const cx = 64, r = 62;
		let gr = g.createRadialGradient(cx, cx, 8, cx, cx, r);
		gr.addColorStop(0, css(1.35)); gr.addColorStop(0.45, css(1.0)); gr.addColorStop(0.85, css(0.7)); gr.addColorStop(1, css(0.35));
		g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.fill();
		// fibres
		for (let i = 0; i < 140; i++) {
			const a = i / 140 * Math.PI * 2 + Math.sin(i) * 0.05;
			g.strokeStyle = i % 2 ? `rgba(255,255,255,0.12)` : `rgba(0,0,0,0.16)`; g.lineWidth = 1.2;
			g.beginPath(); g.moveTo(cx + Math.cos(a) * 20, cx + Math.sin(a) * 20); g.lineTo(cx + Math.cos(a) * 56, cx + Math.sin(a) * 56); g.stroke();
		}
		// the dark limbal ring, the pupil
		g.strokeStyle = "rgba(10,6,4,0.75)"; g.lineWidth = 7; g.beginPath(); g.arc(cx, cx, r - 3, 0, Math.PI * 2); g.stroke();
		gr = g.createRadialGradient(cx, cx, 0, cx, cx, 25);
		gr.addColorStop(0, "#050304"); gr.addColorStop(0.8, "#0b0708"); gr.addColorStop(1, "rgba(11,7,8,0)");
		g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, 25, 0, Math.PI * 2); g.fill();
		// catchlights
		g.fillStyle = "rgba(255,255,255,0.95)"; g.beginPath(); g.ellipse(cx + 17, cx - 19, 9, 8, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(cx - 15, cx + 17, 4, 0, Math.PI * 2); g.fill();
	});
	t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
	IRIS.set(color, t);
	return t;
}

// ---------- the head: a sphere sculpted into a skull, cheeks, jaw and chin (unit direction in, a point on the face out)
const HEAD_R = 0.132;
function headShape(x, y, z, female, out) {
	// the skull: round, a touch narrower than it is deep
	x *= female ? 0.86 : 0.88; y *= 1.03; z *= 1.0;
	// the jaw: gently narrower toward a soft chin; the back of the jaw tucks in to the neck
	if (y < 0.0) {
		const s = smooth01(-y / 1.0);
		x *= 1 - s * (female ? 0.31 : 0.2);
		z *= z < 0 ? 1 - s * 0.55 : 1 - s * 0.1;
	}
	// a chin, not a point: the bottom of the face is flattened off
	if (y < -0.4) { const d = -0.4 - y; y = -0.4 - d * (1 - 0.45 * smooth01(d / 0.6)); }
	if (!female && y < -0.2 && y > -0.75) x *= 1 + 0.06 * gauss((y + 0.5) ** 2, 0.12);   // a squarer jaw
	// the face is flatter than the back of the head
	if (z > 0.55) z = 0.55 + (z - 0.55) * 0.85;
	// cheekbones, the brow ridge, eye sockets, the chin
	const ax = Math.abs(x);
	if (z > 0) {
		const zf = smooth01(z / 0.6);
		x *= 1 + 0.035 * gauss((y + 0.1) ** 2, 0.18) * zf;   // cheekbones
		z += 0.022 * gauss((y - 0.24) ** 2, 0.07) * gauss((ax - 0.3) ** 2, 0.25) * zf;   // the brow
		z -= 0.045 * gauss((y - 0.07) ** 2, 0.08) * gauss((ax - 0.36) ** 2, 0.12) * zf;  // the eye sockets
		z += 0.02 * gauss((y + 0.7) ** 2, 0.1) * gauss(ax * ax, female ? 0.14 : 0.2) * zf;   // the chin
		z += 0.015 * gauss((y + 0.25) ** 2, 0.15) * gauss((ax - 0.4) ** 2, 0.15) * zf;   // round cheeks
	}
	return out.set(x * HEAD_R, y * HEAD_R, z * HEAD_R);
}
function headGeo(female) {
	const g = new THREE.SphereGeometry(1, 72, 56);
	const p = g.attributes.position, v = new THREE.Vector3();
	for (let i = 0; i < p.count; i++) { headShape(p.getX(i), p.getY(i), p.getZ(i), female, v); p.setXYZ(i, v.x, v.y, v.z); }
	g.computeVertexNormals();
	return g;
}
// a point on the head's surface where the direction (azimuth a from the front, unit height uy) meets it
function headAt(a, uy, female, out) {
	const h = Math.sqrt(Math.max(0, 1 - uy * uy));
	return headShape(Math.sin(a) * h, uy, Math.cos(a) * h, female, out);
}

const _up = new THREE.Vector3(0, 1, 0), _sq = new THREE.Quaternion(), _sv = new THREE.Vector3();
// a capsule from point a to point b
function segment(r, a, b, rs = 8) {
	_sv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const len = _sv.length();
	const g = new THREE.CapsuleGeometry(r, Math.max(0.0001, len), 3, rs);
	_sq.setFromUnitVectors(_up, _sv.normalize());
	g.applyQuaternion(_sq);
	g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
	return g;
}
// a strip through pairs of points (lapels, a tie, straps)
function ribbon(rows) {
	const pos = [], uv = [], idx = [];
	rows.forEach(([l, r], i) => {
		pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
		const v = i / (rows.length - 1);
		uv.push(0, v, 1, v);
		if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
	});
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}
// move every vertex of a geometry: fn(v) changes v in place
function reshape(g, fn) {
	const p = g.attributes.position, v = new THREE.Vector3();
	for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
	g.computeVertexNormals();
	return g;
}
// The torso: a revolved outline, squashed front to back and sculpted (deform). Garments are the same shape a little
// further out, cut to their own neckline / hem, maybe open down the front.
function torsoMaker(prof, sx, sz, deform) {
	const pts = new THREE.SplineCurve(prof.map(p => new THREE.Vector2(p[0], p[1]))).getPoints(44);
	const rAt = y => {
		if (y <= pts[0].y) return pts[0].x;
		for (let i = 1; i < pts.length; i++) if (y <= pts[i].y) { const t = (y - pts[i - 1].y) / ((pts[i].y - pts[i - 1].y) || 1); return pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t; }
		return 0;
	};
	const point = (a, y, inf = 0) => {
		const r = rAt(y) + inf, v = new THREE.Vector3(Math.sin(a) * r * sx, y, Math.cos(a) * r * sz);
		deform(v);
		return v;
	};
	function geo(inf, o = {}) {
		let ps = pts.map(p => [p.x > 0.001 ? p.x + inf : 0, p.y]);
		if (o.ext) { const r0 = ps[0][0] + (o.flare || 0); ps = [[r0, ps[0][1] - o.ext], [ps[0][0] + (o.flare || 0) * 0.55, ps[0][1] - o.ext * 0.5]].concat(ps); }
		const g = revolve(ps, o.segs || 41);
		const p = g.attributes.position, flag = new Int8Array(p.count), v = new THREE.Vector3();
		for (let i = 0; i < p.count; i++) {
			v.fromBufferAttribute(p, i);
			v.x *= sx; v.z *= sz;
			const y0 = v.y;
			if (o.ext && y0 < pts[0].y && o.hip) {
				// below the waist: over the hips
				const t = smooth01((pts[0].y - y0) / (o.ext * 0.6)), ph = Math.atan2(v.x, v.z), R = Math.hypot(v.x / sx, v.z / sz);
				const hx = o.hip[0] + inf + (o.flare || 0), hz = o.hip[1] + inf + (o.flare || 0) * 0.8;
				v.x = Math.sin(ph) * (R * sx + (hx - R * sx) * t); v.z = Math.cos(ph) * (R * sz + (hz - R * sz) * t);
			}
			deform(v);
			const a = Math.atan2(v.x, v.z);
			if (o.neck) { const n = o.neck(a); if (v.y > n) v.y = n; }
			if (o.hem !== undefined && v.y < o.hem) v.y = o.hem;
			if (o.gap) {
				const gp = o.gap(y0);
				if (gp > 0 && Math.abs(a) < gp) {
					const s = a >= 0 ? 1 : -1, R = Math.hypot(v.x / sx, v.z / sz);
					v.x = Math.sin(s * gp) * R * sx; v.z = Math.cos(s * gp) * R * sz;
					flag[i] = s;
				}
			}
			p.setXYZ(i, v.x, v.y, v.z);
		}
		if (o.gap) {
			// no skin across the opening: drop the faces that join its two edges
			const idx = g.index.array, keep = [];
			for (let i = 0; i < idx.length; i += 3) {
				const f = [flag[idx[i]], flag[idx[i + 1]], flag[idx[i + 2]]];
				if (f.includes(1) && f.includes(-1)) continue;
				keep.push(idx[i], idx[i + 1], idx[i + 2]);
			}
			g.setIndex(keep);
		}
		g.computeVertexNormals();
		return g;
	}
	function band(y0, y1, inf) {
		const g = new THREE.PlaneGeometry(1, 1, 64, 6), p = g.attributes.position;
		for (let i = 0; i < p.count; i++) { const u = p.getX(i) + 0.5, w = p.getY(i) + 0.5; const q = point(Math.PI - u * Math.PI * 2, y0 + w * (y1 - y0), inf); p.setXYZ(i, q.x, q.y, q.z); }
		g.computeVertexNormals();
		return g;
	}
	return { geo, point, rAt, band };
}
// a footprint (for soles): toe forward (+z once laid flat), heel back
function footGeo(L, W, back, depth, bevel = 0.004) {
	const s = new THREE.Shape(), n = 28, c = L / 2 - back;
	for (let i = 0; i <= n; i++) {
		const t = i / n * Math.PI * 2;
		const ct = Math.cos(t), st = Math.sin(t);
		const f = c + (L / 2) * Math.sign(st) * Math.pow(Math.abs(st), 0.85);
		const x = (W / 2) * Math.sign(ct) * Math.pow(Math.abs(ct), 0.8) * (1 + 0.16 * (f - c) / (L / 2));
		if (i === 0) s.moveTo(x, -f); else s.lineTo(x, -f);
	}
	const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
	g.rotateX(-Math.PI / 2);
	return g;
}
// a rounded shoe upper / foot: an egg over the footprint, flat underneath, lower toward the toe
function upperGeo(L, W, back, h, toeH = 0.45, top = 1) {
	const g = new THREE.SphereGeometry(1, 26, 16);
	const c = L / 2 - back;
	return reshape(g, v => {
		const u = (v.z + 1) / 2;   // 0 heel .. 1 toe
		v.y = Math.max(0, v.y) * h * (1 - (1 - toeH) * smooth01((u - 0.25) / 0.75)) * top;
		v.x *= W / 2 * (0.86 + 0.16 * smooth01((u - 0.2) / 0.5));
		v.z = c + v.z * L / 2;
	});
}

// free a removed part's geometry and materials (shared textures stay)
function disposeTree(root) {
	root.traverse(o => {
		if (o.geometry) o.geometry.dispose();
		if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map !== ZZZ_TEX && !m.map.userData.shared) m.map.dispose(); m.dispose(); });
	});
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

	dispose() { disposeTree(this.root); }

	build(look) {
		look = normalizeLook(look);
		this.look = look;
		const keepProp = this.propKind || null;
		if (this.body) {
			const old = [this.body, this.shadowBlob];
			old.forEach(o => { this.root.remove(o); disposeTree(o); });
		}
		const female = look.gender === "female";
		const fit = (outfitById(look.outfit) || outfitById("tee")).build;
		const C = look.colors;
		const T = tex();
		const skinC = new THREE.Color(look.skin);
		const skin = new THREE.MeshPhysicalMaterial({ color: skinC, roughness: 0.5, sheen: 0.4, sheenRoughness: 0.5, sheenColor: skinC.clone().lerp(new THREE.Color("#ff8a7a"), 0.55).multiplyScalar(0.6) });
		const skinShade = skin.clone(); skinShade.color = skinC.clone().multiplyScalar(0.9);
		// every garment's cloth (shared between the pieces of one colour and weave, so they draw as one)
		const mats = new Map();
		const M = (c, kind = "cotton", double = false) => {
			const key = c + kind + double;
			if (mats.has(key)) return mats.get(key);
			let m;
			if (kind === "leather") m = new THREE.MeshPhysicalMaterial({ color: c, map: T.leather, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.35 });
			else if (kind === "satin") m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.36, sheen: 1, sheenRoughness: 0.28, sheenColor: new THREE.Color(c).lerp(new THREE.Color("#ffffff"), 0.4) });
			else if (kind === "metal") m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.95 });
			else if (kind === "rubber") m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
			else if (kind === "gloss") m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
			else m = new THREE.MeshStandardMaterial({ color: c, map: kind === "smooth" ? null : T[kind] || T.cotton, roughness: kind === "smooth" ? 0.7 : kind === "denim" ? 0.92 : 0.88 });
			if (double) m.side = THREE.DoubleSide;
			mats.set(key, m);
			return m;
		};
		const TOPK = { sweater: "knit", turtle: "knit", sweaterdress: "knit", hoodie: "cotton", gown: "satin", dress: "smooth", maxi: "smooth", wrapdress: "smooth", offsh: "smooth", blouse: "smooth" }[fit.top] || "cotton";
		const OVERK = { leather: "leather", cardigan: "knit", blazer: "smooth", denim: "denim", bomber: "smooth" }[fit.over];
		const BOTK = { jeans: "denim", hijeans: "denim", trousers: "smooth", skirt: "smooth", midi: "smooth", joggers: "cotton", shorts: "cotton" }[fit.bottom];
		const topC = C.top, trimC = C.trim || shade(C.top, 0.82), botC = C.bottom, overC = C.over;
		const topM = M(topC, TOPK), topMd = M(topC, TOPK, true);
		const trimM = M(trimC, fit.top === "sweater" ? "knit" : TOPK === "satin" ? "satin" : "cotton");
		const overM = fit.over && M(overC, OVERK), overMd = fit.over && M(overC, OVERK, true);
		const botM = fit.bottom && M(botC, BOTK), botMd = fit.bottom && M(botC, BOTK, true);
		const dressy = ["dress", "gown", "maxi", "wrapdress", "offsh", "sweaterdress"].includes(fit.top);
		const tunic = fit.top === "kurta";   // (a long tunic over trousers)
		const hairM = new THREE.MeshPhysicalMaterial({ color: look.hair, map: T.hair, roughness: 0.48, sheen: 0.6, sheenRoughness: 0.32, sheenColor: new THREE.Color(look.hair).lerp(new THREE.Color("#ffffff"), 0.35) });
		const dark = new THREE.MeshStandardMaterial({ color: "#1a1214", roughness: 0.5 });
		const blush = new THREE.MeshBasicMaterial({ color: "#ff8fa3", map: T.blush, transparent: true, opacity: female ? 0.32 : 0.16, depthWrite: false });
		this.blushM = blush; this.blushBase = blush.opacity; this._rosy = false;
		const B = new Batch();

		const body = new THREE.Group();
		this.body = body;
		this.root.add(body);
		body.scale.setScalar(female ? 0.96 : 1.0);
		const hipY = 0.86;
		this.hipY = hipY;

		// ================================================================ hips
		const hips = new THREE.Group();
		hips.position.y = hipY;
		body.add(hips);
		this.hips = hips;
		const pelvisM = dressy ? topM : fit.bottom ? botM : skin;
		{
			const g = revolve(female
				? [[0, -0.12], [0.085, -0.112], [0.148, -0.075], [0.176, -0.005], [0.172, 0.07], [0.152, 0.15], [0.08, 0.162], [0, 0.164]]
				: [[0, -0.12], [0.095, -0.11], [0.152, -0.07], [0.171, 0.0], [0.168, 0.08], [0.158, 0.15], [0.08, 0.162], [0, 0.164]], 34, 30);
			const cloth = fit.bottom && fit.bottom !== "skirt" && fit.bottom !== "midi" ? 0.014 : 0;
			reshape(g, v => {
				if (cloth) { const r = Math.hypot(v.x, v.z); if (r > 0.01) { const k = (r + cloth * smooth01((0.15 - v.y) / 0.1)) / r; v.x *= k; v.z *= k; } }
				v.z *= 0.72 - 0.1 * smooth01((v.y - 0.04) / 0.12);
				if (v.z > 0) v.z *= 0.86 + 0.14 * smooth01((v.y - 0.04) / 0.1);   // flatter in front
				// the seat
				if (v.z < 0) v.z -= (female ? 0.03 : 0.018) * gauss((Math.abs(v.x) - 0.07) ** 2, 0.05) * gauss((v.y + 0.02) ** 2, 0.06);
			});
			B.add(hips, pelvisM, g);
		}

		// ================================================================ torso
		const torso = new THREE.Group();
		torso.position.y = 0.12;
		hips.add(torso);
		this.torso = torso;
		const prof = female
			? [[0.148, -0.02], [0.136, 0.05], [0.126, 0.12], [0.132, 0.19], [0.146, 0.27], [0.154, 0.33], [0.154, 0.39], [0.142, 0.43], [0.115, 0.46], [0.082, 0.483], [0.06, 0.495], [0, 0.5]]
			: [[0.155, -0.02], [0.152, 0.05], [0.153, 0.12], [0.166, 0.2], [0.181, 0.28], [0.193, 0.35], [0.194, 0.4], [0.182, 0.44], [0.148, 0.475], [0.103, 0.505], [0.074, 0.518], [0, 0.524]];
		const TOPY = female ? 0.5 : 0.524;
		const HIP = female ? [0.188, 0.142] : [0.182, 0.136];   // the hips' half-width and half-depth (garments hang over them)
		const TM = torsoMaker(prof, female ? 1.08 : 1.12, female ? 0.68 : 0.66, v => {
			const ax = Math.abs(v.x);
			v.z *= 1 + 0.12 * smooth01((0.12 - v.y) / 0.14);
			if (v.z > 0) {
				const f = smooth01(v.z / 0.05);
				if (female) { v.z += 0.052 * gauss((ax - 0.072) ** 2, 0.04) * gauss((v.y - 0.315) ** 2, 0.045) * f; v.y -= 0.008 * gauss((ax - 0.072) ** 2, 0.04) * gauss((v.y - 0.29) ** 2, 0.03) * f; }
				else v.z += 0.014 * gauss((ax - 0.08) ** 2, 0.05) * gauss((v.y - 0.35) ** 2, 0.05) * f;
			} else v.z -= 0.012 * gauss((ax - 0.08) ** 2, 0.05) * gauss((v.y - 0.36) ** 2, 0.06);
		});
		B.add(torso, skin, TM.geo(0));
		const fz = (y, inf = 0) => TM.point(0, y, inf).z;   // the front of the chest at height y
		// necklines: how high the cloth comes at each angle round the body (0 = the front)
		const cf = a => Math.max(0, Math.cos(a)), cb = a => Math.max(0, -Math.cos(a));
		const NECK = {
			crew: a => TOPY - 0.008 - 0.022 * cf(a) ** 3,
			v: a => TOPY - 0.012 - 0.15 * Math.max(0, 1 - Math.abs(a) / 0.5),
			scoop: a => TOPY - 0.02 - 0.085 * cf(a) ** 2 - 0.03 * cb(a) ** 2,
			sweet: a => 0.452 - 0.07 * cf(a) ** 1.5 - 0.012 * cb(a) ** 2,
			gown: a => interp([[0, 0.37], [0.3, 0.402], [0.9, 0.405], [Math.PI, 0.39]], Math.abs(a))
		};
		const neck = mesh(revolve(female ? [[0.064, 0.43], [0.056, 0.48], [0.052, 0.53], [0.051, 0.6], [0, 0.62]] : [[0.078, 0.44], [0.07, 0.5], [0.066, 0.55], [0.064, 0.6], [0, 0.62]], 20, 16), skinShade);
		neck.scale.z = 0.92;
		torso.add(neck);

		// ---- the top
		const TOPS = {
			tee: { neck: "crew", ext: 0.075, flare: 0.012, sleeve: "short", hemRing: true },
			tank: { neck: "scoop", ext: 0.06, flare: 0.01, sleeve: null, hemRing: true },
			crop: { neck: "scoop", hem: 0.27, sleeve: "tight", hemRing: true },
			shirt: { neck: "v", ext: 0.012, sleeve: "long", collar: true, buttons: true },
			hoodie: { neck: "crew", ext: 0.105, flare: 0.022, sleeve: "long", band: true, hood: true, inf: 0.016 },
			sweater: { neck: "crew", ext: 0.09, flare: 0.018, sleeve: "long", band: true, inf: 0.014 },
			blouse: { neck: "v", ext: 0.012, sleeve: "puff", buttons: true },
			dress: { neck: "sweet", ext: 0.02, sleeve: "puff" },
			maxi: { neck: "scoop", ext: 0.02, sleeve: "long" },
			kurta: { neck: "v", ext: 0.012, sleeve: "long", buttons: true },
			polo: { neck: "crew", ext: 0.075, flare: 0.012, sleeve: "short", hemRing: true, collar: true, buttons: true, placket: true },
			turtle: { neck: "crew", ext: 0.09, flare: 0.018, sleeve: "long", band: true, inf: 0.014, turtle: true },
			wrapdress: { neck: "v", ext: 0.02, sleeve: "short" },
			offsh: { neck: "gown", ext: 0.02, sleeve: "puff" },
			sweaterdress: { neck: "crew", ext: 0.02, sleeve: "long", inf: 0.012 },
			gown: { neck: "gown", ext: 0.02, sleeve: null, straps: true }
		};
		const tp = Object.assign({}, TOPS[fit.top] || TOPS.tee);
		if (fit.belt && tp.ext > 0.02) { tp.ext = 0.012; tp.flare = 0; tp.hemRing = false; }
		const tInf = tp.inf || 0.008;
		B.add(torso, topM, TM.geo(tInf, { neck: NECK[tp.neck], ext: tp.ext, flare: tp.flare, hem: tp.hem, hip: HIP }));
		const r0 = TM.rAt(-0.02);
		const sxT = female ? 1.08 : 1.12, szT = female ? 0.68 : 0.66;
		// a rolled edge along a garment's edge: y(a) round the body, inf out from the skin
		const edge = (yf, inf, t, m) => {
			const pts = [];
			for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; pts.push(TM.point(a, yf(a), inf)); }
			B.add(torso, m, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal"), 160, t, 6, true));
		};
		if (tp.hemRing) {
			if (tp.hem !== undefined) edge(() => tp.hem, tInf, 0.006, topM);
			else B.add(torso, topM, ellipseRing(HIP[0] + tInf + (tp.flare || 0), HIP[1] + tInf + (tp.flare || 0) * 0.8, -0.02 - tp.ext, 0.006));
		}
		if (tp.band) B.add(torso, trimM, bake(tubeGeo(-0.02 - tp.ext + 0.035, -0.02 - tp.ext, [1, 1]), null, null, [HIP[0] + tInf + tp.flare + 0.004, 1, HIP[1] + tInf + tp.flare * 0.8 + 0.004]));
		edge(NECK[tp.neck], tInf - 0.002, tp.neck === "crew" ? 0.007 : 0.004, tp.neck === "crew" && fit.top !== "tee" ? trimM : topM);
		if (tp.collar) {
			// a shirt collar: a band round the neck, its points folded down at the front
			B.add(torso, topMd, revolve([[0.072, TOPY - 0.03], [0.068, TOPY + 0.012]], 24, 0, 0.55, Math.PI * 2 - 1.1));
			for (const sx of [-1, 1]) B.add(torso, topMd, bake(new RoundedBoxGeometry(0.055, 0.04, 0.006, 1, 0.003), [sx * 0.036, TOPY - 0.03, fz(TOPY - 0.03, tInf) + 0.004], [-0.5, sx * 0.4, sx * 0.55]));
		}
		if (tp.buttons) for (let y = TOPY - 0.13; y > (tunic ? TOPY - 0.32 : tp.placket ? TOPY - 0.2 : 0.03); y -= 0.075) B.add(torso, M(shade(topC, 0.75), "smooth"), bake(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 10), [0, y, fz(y, tInf) + 0.002], [Math.PI / 2, 0, 0]));
		// a turtleneck: a soft roll up the neck
		if (tp.turtle) { const nr = female ? 0.052 : 0.065; B.add(torso, topMd, revolve([[nr + 0.016, TOPY - 0.035], [nr + 0.014, TOPY + 0.02], [nr + 0.01, TOPY + 0.065]], 28, 8)); B.add(torso, topM, ring(nr + 0.01, 0.006, TOPY + 0.065, 1, 0.92, 24)); }
		if (tp.hood) {
			// the hood, bunched round the back of the neck; the pouch pocket; the drawstrings
			B.add(torso, topM, bake(new THREE.TorusGeometry(0.098, 0.036, 10, 26, Math.PI * 1.25).rotateZ(-Math.PI / 2 - Math.PI * 0.625).rotateX(Math.PI / 2), [0, TOPY - 0.035, -0.012], null, [1.18, 1, 0.92]));
			B.add(torso, topM, bake(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), [0, TOPY - 0.09, -0.07], [-1.75, 0, 0], [0.12, 0.1, 0.05]));
			B.add(torso, topM, bake(new RoundedBoxGeometry(0.2, 0.1, 0.014, 2, 0.006), [0, 0.07, fz(0.07, tInf) + 0.003], [-0.12, 0, 0]));
			for (const sx of [-1, 1]) {
				const yA = TOPY - 0.035, yB = TOPY - 0.17;
				B.add(torso, trimM, segment(0.0035, [sx * 0.03, yA, fz(yA, tInf) + 0.004], [sx * 0.034, yB, fz(yB, tInf) + 0.008], 5));
				B.add(torso, trimM, bake(new THREE.CylinderGeometry(0.005, 0.005, 0.016, 6), [sx * 0.034, yB - 0.006, fz(yB, tInf) + 0.008]));
			}
		}
		if (tp.straps) for (const sx of [-1, 1]) {
			// thin straps over the shoulders
			const pts = [];
			for (let i = 0; i <= 10; i++) {
				const t = i / 10, a = sx * (0.5 + t * 2.1), y = 0.4 + Math.sin(t * Math.PI) * 0.09 - t * 0.0;
				const p = TM.point(a, y, 0.006);
				const w = 0.006;
				pts.push([p.clone().add(new THREE.Vector3(-w, 0, 0)), p.clone().add(new THREE.Vector3(w, 0, 0))]);
			}
			B.add(torso, M(trimC, "satin", true), ribbon(pts));
		}

		// ---- a jacket / cardigan over it: open down the front
		if (fit.over) {
			const blazer = fit.over === "blazer", cardi = fit.over === "cardigan";
			const oInf = 0.026;
			const gap = blazer ? y => y > 0.14 ? 0.06 + (y - 0.14) * 1.35 : 0.0 : cardi ? y => y > 0.0 ? 0.08 + (y - 0.0) * 1.0 : 0.08 : y => 0.07 + Math.max(0, y - 0.25) * 0.8;
			B.add(torso, overMd, TM.geo(oInf, { ext: blazer ? 0.14 : cardi ? 0.12 : 0.06, flare: 0.012, gap, neck: a => TOPY + 0.004, hip: HIP, segs: 121 }));
			const yBot = -0.02 - (blazer ? 0.14 : cardi ? 0.12 : 0.06);
			for (const sx of [-1, 1]) {
				const pts = [];
				for (let i = 0; i <= 30; i++) {
					const y = yBot + i / 30 * (TOPY - yBot);
					let p;
					if (y < -0.02) { const t = smooth01((-0.02 - y) / (blazer ? 0.14 : cardi ? 0.12 : 0.06)), a = sx * Math.max(gap(-0.02), 0.002), R0 = TM.rAt(-0.02) + oInf; p = new THREE.Vector3(Math.sin(a) * (R0 * (female ? 1.08 : 1.12) + (HIP[0] + oInf + 0.012 - R0 * (female ? 1.08 : 1.12)) * t), y, Math.cos(a) * (R0 * (female ? 0.68 : 0.66) * 1.12 + (HIP[1] + oInf + 0.01 - R0 * (female ? 0.68 : 0.66) * 1.12) * t)); }
					else p = TM.point(sx * Math.max(gap(y), 0.002), y, oInf);
					pts.push(p);
				}
				B.add(torso, cardi ? M(shade(overC, 0.85), "knit") : overM, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.006, 6, false));
			}
			// the collar behind the neck
			B.add(torso, overMd, revolve([[0.08, TOPY - 0.035], [0.074, TOPY + 0.018]], 24, 0, 1.2, Math.PI * 2 - 2.4));
			if (blazer || fit.over === "leather" || fit.over === "denim") for (const sx of [-1, 1]) {
				// lapels: folded back along each edge of the opening
				const rows = [];
				for (let i = 0; i <= 12; i++) {
					const y = 0.15 + i / 12 * (TOPY - 0.17), g = gap(y), w = (blazer ? 0.05 : 0.07) + 0.2 * smooth01((y - 0.15) / 0.25);
					rows.push([TM.point(sx * g, y, oInf + 0.004), TM.point(sx * (g + w), y + 0.004, oInf + 0.012)]);
				}
				B.add(torso, overMd, ribbon(rows));
			}
			if (blazer) {
				B.add(torso, M(shade(overC, 0.6), "smooth"), bake(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12), [0.03, 0.06, fz(0.06, oInf) + 0.004], [Math.PI / 2, 0, 0]));
				for (const sx of [-1, 1]) { const p = TM.point(sx * 0.78, -0.03, oInf + 0.022); B.add(torso, overM, bake(new RoundedBoxGeometry(0.075, 0.02, 0.01, 1, 0.004), p.toArray(), [0, sx * 0.78, 0])); }
			}
			if (cardi) for (let y = 0.0; y < 0.34; y += 0.07) B.add(torso, M("#f2ece0", "gloss"), bake(new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 10), TM.point(0.12, y, oInf + 0.004).toArray(), [Math.PI / 2, 0.12, 0]));
			if (fit.over === "leather" || fit.over === "bomber") {
				const zipM = M("#c8ccd2", "metal");
				for (const sx of [-1, 1]) { const rows = []; for (let i = 0; i <= 10; i++) { const y = -0.06 + i / 10 * 0.36; const p = TM.point(sx * gap(y), y, oInf + 0.003); rows.push([p, p.clone().add(new THREE.Vector3(sx * 0.006, 0, 0))]); } B.add(torso, zipM, ribbon(rows)); }
			}
		}
		// ---- a tie
		if (fit.tie) {
			const tieM = M(C.tie || "#8c1c3a", "satin", true);
			B.add(torso, tieM, bake(new RoundedBoxGeometry(0.03, 0.026, 0.016, 1, 0.005), [0, TOPY - 0.045, fz(TOPY - 0.045, tInf) + 0.008], [-0.25, 0, 0]));
			const rows = [];
			for (let i = 0; i <= 12; i++) {
				const t = i / 12, y = TOPY - 0.06 - t * 0.36, w = 0.014 + 0.024 * t;
				const z = fz(y, tInf) + 0.007 + (female ? 0 : 0.004 * t);
				rows.push([new THREE.Vector3(-w, y, z), new THREE.Vector3(w, y, z)]);
			}
			rows.push([new THREE.Vector3(0, TOPY - 0.06 - 0.36 - 0.022, fz(TOPY - 0.42, tInf) + 0.011), new THREE.Vector3(0.0001, TOPY - 0.06 - 0.36 - 0.022, fz(TOPY - 0.42, tInf) + 0.011)]);
			B.add(torso, tieM, ribbon(rows));
		}

		// ================================================================ head and face
		const head = new THREE.Group();
		head.position.y = 0.555;
		torso.add(head);
		this.head = head;
		const face = new THREE.Group();
		face.position.y = 0.1;
		head.add(face);
		this.face = face;
		B.add(face, skin, headGeo(female));
		const hv = new THREE.Vector3();
		// the point on the face in front of (x, y)
		const faceAt = (x, y) => {
			let a = Math.asin(Math.max(-0.95, Math.min(0.95, x / 0.11))), uy = y / 0.14;
			for (let i = 0; i < 8; i++) { headAt(a, uy, female, hv); a += (x - hv.x) / 0.11; uy += (y - hv.y) / 0.14; }
			return headAt(a, uy, female, new THREE.Vector3());
		};
		this.lids = [];
		this.brows = [];
		this.tears = [];
		const eyeR = female ? 0.0202 : 0.019;
		const sclera = new THREE.MeshPhysicalMaterial({ color: "#f3eeea", roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
		const irisM = new THREE.MeshPhysicalMaterial({ map: irisTex(look.eyes), transparent: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 });
		const browM = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.hair).multiplyScalar(0.72), roughness: 0.9, side: THREE.DoubleSide });
		const lashM = new THREE.MeshStandardMaterial({ color: "#120c0c", roughness: 0.6 });
		// the iris: a cap of the eyeball's front (uvs laid flat across it, the way the texture is drawn)
		const irisGeo = (() => {
			const R = eyeR * 1.008, rho = eyeR * 0.54;
			const g = new THREE.SphereGeometry(R, 30, 8, 0, Math.PI * 2, 0, Math.asin(rho / R)).rotateX(Math.PI / 2);
			const p = g.attributes.position, uv = g.attributes.uv;
			for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) / rho + 1) / 2, (p.getY(i) / rho + 1) / 2);
			return g;
		})();
		for (const sx of [-1, 1]) {
			const s = faceAt(sx * 0.044, 0.012);
			const eye = new THREE.Group();
			eye.position.set(sx * 0.044, 0.012, s.z - eyeR * 0.42);
			eye.rotation.y = sx * 0.05;
			face.add(eye);
			eye.add(mesh(new THREE.SphereGeometry(eyeR, 22, 16), sclera, false));
			eye.add(mesh(irisGeo.clone(), irisM, false));
			// the eyelids: the top one blinks (rotation.x), the lashes ride on its edge
			const lid = mesh(new THREE.SphereGeometry(eyeR * 1.14, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin, false);
			lid.rotation.x = -0.45;
			eye.add(lid);
			this.lids.push(lid);
			const lash = mesh(new THREE.TorusGeometry(eyeR * 1.15, female ? 0.0026 : 0.0016, 4, 18, Math.PI * 0.86).rotateZ(Math.PI * 0.07).rotateX(Math.PI / 2), lashM, false);
			lash.scale.set(1, 1, female ? 1.08 : 1);
			lid.add(lash);
			lid.userData.lash = lash;
			const low = mesh(new THREE.SphereGeometry(eyeR * 1.1, 22, 6, 0, Math.PI * 2, Math.PI * 0.66, Math.PI * 0.34), skin, false);
			low.rotation.x = 0.28;
			eye.add(low);
			// a tapered, gently arched eyebrow (it moves with the mood)
			const bs = new THREE.Shape(), bw = 0.044, th0 = female ? 0.0068 : 0.0095, th1 = female ? 0.0022 : 0.003;
			const N = 10;
			for (let i = 0; i <= N; i++) { const u = i / N, x = u * bw, y = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (female ? 0.0075 : 0.004) + (th0 + (th1 - th0) * u) / 2; i ? bs.lineTo(x, y) : bs.moveTo(x, y); }
			for (let i = N; i >= 0; i--) { const u = i / N, x = u * bw, y = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (female ? 0.0075 : 0.004) - (th0 + (th1 - th0) * u) / 2; bs.lineTo(x, y); }
			const bg = new THREE.ShapeGeometry(bs, 2);
			bg.translate(-bw / 2, 0, 0);
			if (sx < 0) bg.scale(-1, 1, 1);
			const bp = faceAt(sx * 0.05, 0.047);
			const brow = mesh(bg, browM, false);
			brow.position.set(sx * 0.05, 0.047, bp.z + 0.0035);
			brow.rotation.set(-0.12, sx * 0.32, sx * -0.04);
			face.add(brow);
			this.brows.push({ m: brow, sx, rot: brow.rotation.z, y: brow.position.y });
			const tp2 = faceAt(sx * 0.05, -0.014);
			const tear = mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: "#8fd3ff", roughness: 0.05, transparent: true, opacity: 0.9 }), false);
			tear.scale.set(0.8, 1.3, 0.8);
			tear.position.set(sx * 0.05, -0.014, tp2.z + 0.006);
			tear.visible = false;
			face.add(tear);
			this.tears.push(tear);
			const cp = faceAt(sx * 0.066, -0.032);
			const ch = mesh(new THREE.CircleGeometry(0.03, 20), blush, false);
			ch.position.set(sx * 0.066, -0.032, cp.z + 0.004);
			ch.rotation.y = sx * 0.5;
			face.add(ch);
			// the ear
			const ear = new THREE.Group();
			ear.position.set(sx * 0.111, -0.006, -0.014);
			ear.rotation.y = sx * 0.35;
			face.add(ear);
			B.add(ear, skin, bake(new THREE.SphereGeometry(1, 14, 12), null, null, [0.011, 0.03, 0.019]));
			B.add(ear, skin, bake(new THREE.TorusGeometry(0.019, 0.0045, 6, 14, Math.PI * 1.25), [sx * 0.004, 0.003, 0], [0, sx * Math.PI / 2, Math.PI * 0.2], [1, 1.45, 1]));
		}
		// the nose: one sculpted shape - a narrow bridge, a rounded tip, the wings flaring either side of it, nostrils under
		{
			const k = female ? 0.86 : 1;
			const H = 0.05 * k, yTop = 0.024, yBot = yTop - H;
			const zs = [];
			for (let i = 0; i <= 24; i++) zs.push(faceAt(0, yTop - i / 24 * H).z - 0.004);
			const baseAt = t => { const f = t * 24, i = Math.min(23, Math.floor(f)); return zs[i] + (zs[i + 1] - zs[i]) * (f - i); };
			const wAt = t => k * (0.005 + 0.0055 * Math.pow(t, 1.5) + 0.0085 * smooth01((t - 0.6) / 0.32));
			const dAt = (t, ax) => {
				let d = k * (0.003 + 0.019 * Math.pow(t, 1.3));
				d *= 1 - 0.6 * ax * ax * smooth01((t - 0.55) / 0.3);   // the wings sit back from the tip
				if (t > 0.82) d *= 1 - (t - 0.82) * 2.2;                // round under the tip
				return d;
			};
			B.add(face, skin, reshape(new THREE.SphereGeometry(1, 24, 22), v => {
				const t = (1 - v.y) / 2, ax = Math.abs(v.x);
				v.set(v.x * wAt(t), yTop - t * H + (t > 0.9 ? (t - 0.9) * H * 0.6 : 0), baseAt(t) + (v.z > 0 ? v.z * dAt(t, ax) : v.z * 0.004));
			}));
			for (const sx of [-1, 1]) B.add(face, M("#3a201c", "smooth"), bake(new THREE.SphereGeometry(0.0038 * k, 10, 6), [sx * 0.0065 * k, yBot + 0.0035, baseAt(0.97) + dAt(0.97, 0.35) * 0.55], [0.3, 0, 0], [1.25, 0.42, 0.9]), false);
		}
		// the lips (a little smile; turned over for a frown), and an open mouth for laughing
		{
			const my = -0.05, mz = faceAt(0, my).z + 0.002;
			const mouth = new THREE.Group();
			mouth.position.set(0, my, mz);
			face.add(mouth);
			const lipC = skinC.clone().lerp(new THREE.Color(female ? "#c2475f" : "#b0605a"), female ? 0.6 : 0.35).multiplyScalar(female ? 0.95 : 0.92);
			const lipM = new THREE.MeshPhysicalMaterial({ color: lipC, roughness: female ? 0.32 : 0.5, clearcoat: female ? 0.5 : 0.1, clearcoatRoughness: 0.3 });
			const bend = (w, sy) => v => { v.y += 4.2 * v.x * v.x; v.z -= 9 * v.x * v.x; };
			const lip = (w, h, d, y, z) => reshape(bake(new THREE.SphereGeometry(1, 24, 12), [0, 0, 0], null, [w, h, d]), v => { v.y += y; v.z += z; bend()(v); });
			const lips = new THREE.Group();
			lips.add(mesh(lip(0.024, 0.0052, 0.0075, 0.0034, 0), lipM, false));
			lips.add(mesh(lip(0.021, 0.0066, 0.0085, -0.0042, -0.0008), lipM, false));
			lips.add(mesh(lip(0.0235, 0.0011, 0.004, 0.0, 0.003), M("#4a1e22", "smooth"), false));
			mouth.add(lips);
			this.mouth = mouth;
			this.mouthRot = 0;
			this.mouthY = my;
			const o = new THREE.Group();
			o.add(mesh(bake(new THREE.SphereGeometry(1, 16, 10), null, null, [0.017, 0.012, 0.006]), M("#4a1a22", "smooth"), false));
			o.add(mesh(new RoundedBoxGeometry(0.021, 0.005, 0.004, 1, 0.0015).translate(0, 0.0085, 0.002), M("#f6f1ea", "smooth"), false));
			o.position.set(0, my - 0.004, mz - 0.001);
			o.visible = false;
			face.add(o);
			this.mouthO = o;
		}
		this.buildHair(face, hairM, female, look.hairStyle);
		if (look.glasses && look.glasses !== "none") this.buildGlasses(face, look.glasses, faceAt, female);

		// ================================================================ arms (index 0 = right side, at -x; index 1 = left)
		const shoulderX = female ? 0.175 : 0.21;
		const ur = female ? 0.046 : 0.057;
		const SLEEVE = { tee: "short", crop: "tight", tank: null, shirt: "long", hoodie: "long", sweater: "long", blouse: "puff", dress: "puff", gown: null, maxi: "long", kurta: "long", polo: "short", turtle: "long", wrapdress: "short", offsh: "puff", sweaterdress: "long" }[fit.top];
		const cuffM = fit.top === "hoodie" || fit.top === "sweater" ? trimM : topM;
		this.arms = [];
		for (const side of [-1, 1]) {
			const sh = new THREE.Group();
			sh.position.set(side * shoulderX, 0.4, 0);
			torso.add(sh);
			const pivot = new THREE.Group();
			sh.add(pivot);
			const elbow = new THREE.Group();
			elbow.position.y = -0.28;
			pivot.add(elbow);
			const hand = new THREE.Group();
			hand.position.y = -0.255;
			elbow.add(hand);
			// skin: shoulder, upper arm, elbow, forearm
			const shR = female ? 0.056 : 0.068;
			B.add(pivot, SLEEVE ? topM : skin, bake(new THREE.SphereGeometry(shR + (SLEEVE === "short" || SLEEVE === "long" ? 0.007 : SLEEVE === "tight" ? 0.004 : 0), 18, 14), [0, -0.014, 0], null, [1, 0.92, 0.9]));
			B.add(pivot, skin, limbGeo(-0.01, -0.285, [ur * 1.0, ur * 1.07, ur * 1.03, ur * 0.9, ur * 0.8]));
			B.add(elbow, skin, bake(new THREE.SphereGeometry(ur * 0.82, 14, 10)));
			B.add(elbow, skin, limbGeo(0, -0.245, [ur * 0.84, ur * 0.94, ur * 0.86, ur * 0.68, ur * 0.56]));
			// sleeves (a jacket's cover the top's)
			if (fit.over) { /* see below */ }
			else if (SLEEVE === "short" || SLEEVE === "tight") {
				const e = SLEEVE === "tight" ? 0.012 : 0.022, L = SLEEVE === "tight" ? -0.1 : -0.135;
				B.add(pivot, topMd, tubeGeo(-0.02, L, [ur + e - 0.002, ur + e + 0.002, ur + e]));
				B.add(pivot, topM, ring(ur + e, 0.005, L, 1, 1, 20));
			} else if (SLEEVE === "long") {
				B.add(pivot, topMd, tubeGeo(-0.02, -0.29, [ur + 0.017, ur + 0.021, ur + 0.019, ur + 0.017]));
				B.add(elbow, topM, bake(new THREE.SphereGeometry(ur * 0.84 + 0.016, 14, 10)));
				B.add(elbow, topMd, tubeGeo(0.0, -0.215, [ur * 0.84 + 0.017, ur * 0.88 + 0.017, ur * 0.72 + 0.017, ur * 0.62 + 0.018]));
				B.add(elbow, cuffM, bake(tubeGeo(-0.205, -0.235, [ur * 0.6 + 0.017, ur * 0.6 + 0.015]), null, null, 1));
			} else if (SLEEVE === "puff") {
				B.add(pivot, topM, bake(new THREE.SphereGeometry(0.066, 18, 12), [0, -0.05, 0], null, [1, 0.86, 1]));
				B.add(pivot, topM, ring(ur + 0.006, 0.006, -0.1, 1, 1, 20));
			}
			if (fit.over) {
				B.add(pivot, overM, bake(new THREE.SphereGeometry(shR + 0.018, 18, 14), [0, -0.01, 0], null, [1.02, 0.95, 0.95]));
				B.add(pivot, overMd, tubeGeo(-0.02, -0.29, [ur + 0.024, ur + 0.026, ur + 0.024, ur + 0.021]));
				B.add(elbow, overM, bake(new THREE.SphereGeometry(ur * 0.84 + 0.021, 14, 10)));
				B.add(elbow, overMd, tubeGeo(0.0, -0.222, [ur * 0.84 + 0.021, ur * 0.88 + 0.021, ur * 0.72 + 0.021, ur * 0.64 + 0.022]));
				B.add(elbow, overM, ring(ur * 0.64 + 0.022, 0.005, -0.222, 1, 1, 20));
			}
			// the hand: palm, four jointed fingers, a thumb (palm toward +z: where things are held)
			{
				const hw = female ? 0.056 : 0.066, th = female ? 0.021 : 0.025;
				B.add(hand, skin, bake(new THREE.SphereGeometry(ur * 0.58, 12, 10), [0, -0.004, 0], null, [1.1, 1, 0.75]));
				B.add(hand, skin, reshape(new RoundedBoxGeometry(hw, 0.078, th, 2, 0.011), v => { v.x *= 1 - 0.14 * smooth01((v.y + 0.01) / 0.05); v.y -= 0.042; }));
				const lens = female ? [0.043, 0.049, 0.046, 0.036] : [0.048, 0.054, 0.051, 0.04];
				const fr = female ? 0.0072 : 0.0088;
				lens.forEach((L, i) => {
					const x = -side * (1.5 - i) * hw / 4 * 0.94, y0 = -0.08 + (i === 0 || i === 3 ? 0.004 : 0), c1 = 0.25 + i * 0.04, c2 = 0.75 + i * 0.05;
					const L1 = L * 0.55, L2 = L * 0.45;
					const j = [x * 1.03, y0 - Math.cos(c1) * L1, Math.sin(c1) * L1 + 0.002];
					const tip = [x * 1.05, j[1] - Math.cos(c2) * L2, j[2] + Math.sin(c2) * L2];
					B.add(hand, skin, segment(fr * (i === 3 ? 0.9 : 1), [x, y0 + 0.006, 0.002], j, 7));
					B.add(hand, skin, segment(fr * 0.86 * (i === 3 ? 0.9 : 1), j, tip, 7));
				});
				const tb = [-side * hw * 0.44, -0.028, 0.007], tj = [-side * hw * 0.62, -0.056, 0.022], tt = [-side * hw * 0.58, -0.078, 0.036];
				B.add(hand, skin, segment(female ? 0.0098 : 0.0115, tb, tj, 7));
				B.add(hand, skin, segment(female ? 0.0086 : 0.0102, tj, tt, 7));
			}
			hand.rotation.y = side * -0.3;
			this.arms.push({ sh: pivot, elbow, hand, side });
		}
		this.propHolder = new THREE.Group();
		this.arms[0].hand.add(this.propHolder);

		// ================================================================ legs
		const LONG = fit.bottom === "jeans" || fit.bottom === "hijeans" || fit.bottom === "trousers" || fit.bottom === "joggers";
		this.legs = [];
		for (const side of [-1, 1]) {
			const hip = new THREE.Group();
			hip.position.set(side * (female ? 0.082 : 0.092), 0, 0);
			hips.add(hip);
			const knee = new THREE.Group();
			knee.position.y = -0.4;
			hip.add(knee);
			const foot = new THREE.Group();
			foot.position.y = -0.4;
			knee.add(foot);
			B.add(hip, skin, limbGeo(-0.04, -0.4, female ? [0.093, 0.09, 0.08, 0.068, 0.058, 0.053] : [0.093, 0.091, 0.083, 0.072, 0.063, 0.058]));
			B.add(knee, skin, bake(new THREE.SphereGeometry(female ? 0.052 : 0.057, 14, 10)));
			B.add(knee, skin, limbGeo(0, -0.39, female ? [0.052, 0.058, 0.053, 0.043, 0.034, 0.03] : [0.057, 0.064, 0.059, 0.048, 0.039, 0.035]));
			if (LONG) {
				const j = fit.bottom === "joggers";
				B.add(hip, botMd, tubeGeo(0.05, -0.41, [0.098, 0.103, 0.098, 0.088, 0.079, 0.074]));
				B.add(knee, botM, bake(new THREE.SphereGeometry(0.07, 14, 10)));
				const bot = j ? [0.07, 0.07, 0.064, 0.056, 0.05, 0.046] : fit.bottom === "trousers" ? [0.072, 0.07, 0.068, 0.066, 0.065, 0.064] : [0.072, 0.07, 0.066, 0.062, 0.06, 0.06];
				B.add(knee, botMd, tubeGeo(0.0, j ? -0.34 : -0.372, bot));
				if (j) B.add(knee, M(shade(botC, 0.85), "knit"), bake(tubeGeo(-0.335, -0.372, [0.047, 0.044]), null, null, 1));
				else B.add(knee, botM, ring(bot[5], 0.006, -0.372, 1, 1, 20));
			} else if (fit.bottom === "shorts") {
				B.add(hip, botMd, tubeGeo(0.05, -0.22, [0.098, 0.105, 0.105, 0.102]));
				B.add(hip, botM, ring(0.102, 0.006, -0.22, 1, 1, 22));
			}
			this.legs.push({ hip, knee, foot, side });
			this.buildShoe(foot, fit.shoes, C.shoes, female, skin, M, B, side);
		}
		// jeans: back pockets, a fly; hi-waisted ones come up over the navel
		if (fit.bottom === "jeans" || fit.bottom === "hijeans") {
			const pm = M(shade(botC, 0.9), "denim");
			for (const sx of [-1, 1]) B.add(hips, pm, bake(new RoundedBoxGeometry(0.066, 0.07, 0.006, 1, 0.003), [sx * 0.068, 0.02, female ? -0.153 : -0.14], [0.15, sx * 0.25, 0]));
			B.add(hips, M(shade(botC, 0.7), "denim"), bake(new THREE.BoxGeometry(0.005, 0.085, 0.004), [0.012, 0.06, 0.121]));
		}
		if (fit.bottom === "hijeans") B.add(torso, botMd, TM.band(-0.06, 0.1, 0.012));
		// skirts and dresses
		this.skirt = null; this.skirtLong = false; this.drapes = [];
		const SK = {
			skirt: { y0: 0.13, r0: 0.182, y1: -0.6, r1: 0.29, pleat: 0.03, n: 11, sz: 0.9, m: botMd },
			midi: { y0: 0.13, r0: 0.16, y1: -0.52, r1: 0.29, fold: 0.03, n: 7, sz: 0.9, m: botMd },
			dress: { y0: 0.11, r0: 0.155, y1: -0.66, r1: 0.34, fold: 0.05, n: 8, sz: 0.88, m: topMd },
			gown: { y0: 0.11, r0: 0.155, y1: -0.83, r1: 0.39, fold: 0.06, n: 9, sz: 0.92, m: topMd, long: true },
			maxi: { y0: 0.11, r0: 0.155, y1: -0.82, r1: 0.36, fold: 0.05, n: 8, sz: 0.9, m: topMd, long: true },
			wrapdress: { y0: 0.11, r0: 0.155, y1: -0.6, r1: 0.31, fold: 0.05, n: 7, sz: 0.88, m: topMd },
			offsh: { y0: 0.11, r0: 0.155, y1: -0.82, r1: 0.4, fold: 0.06, n: 9, sz: 0.92, m: topMd, long: true },
			sweaterdress: { y0: 0.11, r0: 0.16, y1: -0.6, r1: 0.22, fold: 0.015, n: 6, sz: 0.92, m: topMd },
			kurta: { y0: 0.12, r0: 0.2, y1: -0.42, r1: 0.25, fold: 0.03, n: 6, sz: 0.88, m: topMd }
		}[dressy ? fit.top : tunic ? "kurta" : fit.bottom];
		if (SK) {
			const pts = [];
			for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([SK.r0 + (SK.r1 - SK.r0) * Math.pow(t, 0.85) + (i === 0 ? 0 : 0), SK.y0 + (SK.y1 - SK.y0) * t]); }
			pts.reverse();
			const g = reshape(revolve(pts, 56), v => {
				const t = (SK.y0 - v.y) / (SK.y0 - SK.y1), a = Math.atan2(v.x, v.z);
				const k = 1 + (SK.pleat ? SK.pleat * Math.abs(Math.sin(a * SK.n)) : SK.fold * Math.sin(a * SK.n)) * t;
				v.x *= k; v.z *= k * (0.66 + (SK.sz - 0.66) * smooth01(t / 0.35));
			});
			const skirt = mesh(g, SK.m);
			hips.add(skirt);
			this.skirt = skirt; this.skirtLong = !!SK.long;
			// sitting in a long skirt, the cloth drapes over the legs instead (shown by update())
			if (SK.y1 < -0.45) {
				this.legs.forEach(l => {
					const th = mesh(tubeGeo(0.04, -0.43, SK.long ? [0.128, 0.124, 0.112, 0.09, 0.078] : [0.13, 0.125, 0.11, 0.085, 0.07]), SK.m), arr = [th];
					l.hip.add(th);
					if (SK.long) {
						const kn = mesh(new THREE.SphereGeometry(0.078, 16, 12), SK.m), sh = mesh(tubeGeo(0.0, -0.37, [0.078, 0.09, 0.115, 0.14, 0.16]), SK.m);
						l.knee.add(kn, sh); arr.push(kn, sh);
					}
					this.drapes.push(...arr);
				});
				this.drapes.forEach(d => { d.visible = false; });
			}
		}
		// a sash / waist bow
		if (dressy && C.trim) {
			B.add(hips, trimM, ring(0.158, 0.017, 0.125, 1, 0.74, 36));
			const bow = new THREE.Group();
			bow.position.set(0, 0.125, -0.122);
			hips.add(bow);
			for (const sx of [-1, 1]) {
				B.add(bow, trimM, bake(new THREE.TorusGeometry(0.024, 0.009, 8, 16), [sx * 0.03, 0.004, -0.004], [0, 0, 0], [1.2, 0.8, 0.5]));
				B.add(bow, trimM, bake(new RoundedBoxGeometry(0.02, 0.09, 0.005, 1, 0.002), [sx * 0.016, -0.05, -0.006], [0.1, 0, sx * 0.25]));
			}
			B.add(bow, trimM, bake(new THREE.SphereGeometry(0.012, 10, 8), [0, 0, -0.006]));
		}
		// a belt
		if (fit.belt) {
			const bm = M(C.belt || "#5a3a26", "leather");
			if (fit.bottom === "hijeans") {
				const pts = [];
				for (let i = 0; i < 64; i++) pts.push(TM.point(i / 64 * Math.PI * 2, 0.075, 0.02));
				B.add(torso, bm, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.013, 6, true));
				B.add(torso, M("#c9a85c", "metal"), bake(new RoundedBoxGeometry(0.04, 0.028, 0.008, 1, 0.003), [0, 0.075, TM.point(0, 0.075, 0.034).z]));
			} else {
				B.add(hips, bm, ellipseRing(0.172, 0.112, 0.12, 0.016));
				B.add(hips, M("#c9a85c", "metal"), bake(new RoundedBoxGeometry(0.044, 0.032, 0.008, 1, 0.003), [0, 0.12, 0.128]));
			}
		}

		B.flush();

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

	// Glasses: a frame round each eye, a bridge, arms back to the ears (they turn with the head)
	buildGlasses(face, kind, faceAt, female) {
		const g = new THREE.Group();
		face.add(g);
		const col = { round: "#c9a05a", square: "#1c1a20", cat: "#a3123a", heart: "#e05a9a", sun: "#1c1a20" }[kind] || "#1c1a20";
		const frameM = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, metalness: kind === "round" ? 0.9 : 0.1, clearcoat: 0.6 });
		const lensM = new THREE.MeshPhysicalMaterial({ color: kind === "sun" ? "#1a1a24" : "#e8f4ff", transparent: true, opacity: kind === "sun" ? 0.82 : 0.14, roughness: 0.05, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
		const t = kind === "round" ? 0.0016 : 0.0026;
		// one lens outline (round x: the outer side), in the plane of the lens
		const outline = sx => {
			const pts = [];
			for (let i = 0; i < 40; i++) {
				const a = i / 40 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
				let x, y;
				if (kind === "round") { x = c * 0.022; y = s * 0.021; }
				else if (kind === "heart") { const hx = 16 * Math.sin(a) ** 3, hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); x = hx * 0.0015; y = hy * 0.0015 + 0.002; }
				else {
					const p = 5;   // a rounded rectangle (a superellipse)
					x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * 0.026; y = Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * (kind === "sun" ? 0.019 : 0.016);
					if (kind === "cat" && y > 0) y += 0.009 * Math.max(0, x / 0.026) ** 3;   // the upswept outer corners
					if (kind === "sun" && y < 0) y *= 1 + 0.25 * Math.max(0, x / 0.026);
				}
				pts.push(new THREE.Vector3(x * sx, y, 0));
			}
			return pts;
		};
		const ez = faceAt(0.044, 0.012).z, z = ez + 0.017;
		for (const sx of [-1, 1]) {
			const lens = new THREE.Group();
			lens.position.set(sx * 0.044, 0.012, z - 0.002);
			lens.rotation.y = sx * 0.12;
			g.add(lens);
			const pts = outline(sx);
			lens.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, t, 6, true), frameM, false));
			lens.add(mesh(new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)))), lensM, false));
			// the arm, from the outer edge back over the ear
			const ear = faceAt(sx * 0.105, 0.02);
			g.add(mesh(segment(t * 0.9, [sx * 0.072, 0.02, z - 0.008], [sx * 0.114, 0.02, ear.z - 0.05], 5), frameM, false));
			g.add(mesh(segment(t * 0.9, [sx * 0.114, 0.02, ear.z - 0.05], [sx * 0.112, -0.004, ear.z - 0.075], 5), frameM, false));
		}
		// the bridge over the nose
		const br = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.019, 0.016, z), new THREE.Vector3(0, 0.022, z + 0.003), new THREE.Vector3(0.019, 0.016, z)]);
		g.add(mesh(new THREE.TubeGeometry(br, 12, t, 5, false), frameM, false));
		return g;
	}

	// shoes (and bare feet in sandals / heels / flats): the foot group's origin is the ankle, 6cm off the ground
	buildShoe(foot, kind, color, female, skin, M, B, side) {
		const L = female ? 0.228 : 0.255, W = female ? 0.086 : 0.098, back = female ? 0.07 : 0.078, G = -0.06;
		const c = color || "#26242b";
		const showFoot = kind === "sandals" || kind === "heels" || kind === "flats";
		if (showFoot) {
			B.add(foot, skin, bake(upperGeo(L * 0.94, W * 0.9, back * 0.92, 0.05, 0.4), [0, G + 0.008, 0]));
			// toes (the big one on the inside)
			if (kind === "sandals") for (let i = 0; i < 5; i++) {
				const k = side < 0 ? 4 - i : i, x = (i - 2) * W * 0.17, f = L - back - 0.016 - k * 0.007;
				B.add(foot, skin, bake(new THREE.SphereGeometry(k ? 0.0085 - k * 0.0004 : 0.011, 8, 6), [x, G + 0.016, f], null, [1, 0.8, 1.2]));
			}
		}
		if (kind === "sneakers") {
			B.add(foot, M("#f4f1ea", "rubber"), footGeo(L, W * 1.04, back, 0.022, 0.005).translate(0, G, 0));
			B.add(foot, M(c, "leather"), bake(upperGeo(L * 0.98, W * 0.98, back * 0.98, 0.085, 0.42), [0, G + 0.022, 0]));
			const lace = M(c === "#f5f2ea" ? "#c9c5bd" : "#f5f2ea", "smooth");
			for (let i = 0; i < 4; i++) B.add(foot, lace, bake(new THREE.BoxGeometry(W * 0.42, 0.004, 0.006), [0, G + 0.022 + 0.085 * (0.98 - i * 0.12) - 0.003, 0.02 + i * 0.022], [0.35, 0, 0]));
			B.add(foot, M(c === "#f5f2ea" ? "#2a9d8f" : "#f5f2ea", "smooth"), bake(new THREE.BoxGeometry(0.003, 0.02, 0.07), [side * W * 0.47, G + 0.045, 0.0]));
		} else if (kind === "boots") {
			B.add(foot, M("#2a2220", "rubber"), footGeo(L * 1.02, W * 1.05, back, 0.024, 0.004).translate(0, G, 0));
			B.add(foot, M(c, "leather"), bake(upperGeo(L, W, back, 0.08, 0.5), [0, G + 0.024, 0]));
			B.add(foot, M(c, "leather"), limbGeo(0.13, -0.01, [0.05, 0.052, 0.054], 18, 0.3));
		} else if (kind === "loafers") {
			B.add(foot, M("#2a1c14", "rubber"), footGeo(L, W, back, 0.012, 0.003).translate(0, G, 0));
			B.add(foot, M(c, "gloss"), bake(upperGeo(L * 0.99, W * 0.98, back, 0.062, 0.48), [0, G + 0.012, 0]));
			B.add(foot, M(shade(c, 0.7), "gloss"), bake(new THREE.BoxGeometry(W * 0.62, 0.008, 0.014), [0, G + 0.012 + 0.05, 0.04], [0.45, 0, 0]));
		} else if (kind === "flats") {
			B.add(foot, M(shade(c, 0.6), "rubber"), footGeo(L, W, back, 0.01, 0.003).translate(0, G, 0));
			B.add(foot, M(c, "gloss"), reshape(bake(upperGeo(L * 0.98, W * 0.99, back, 0.05, 0.6), [0, G + 0.01, 0]), v => { if (v.z < 0.04 && v.y > G + 0.03) v.y = G + 0.03; }));
		} else if (kind === "heels") {
			B.add(foot, M(c, "gloss"), footGeo(L, W * 0.95, back, 0.008, 0.002).translate(0, G, 0));
			B.add(foot, M(c, "gloss"), reshape(bake(upperGeo(L * 0.98, W * 0.98, back, 0.045, 0.6), [0, G + 0.008, 0]), v => { if (v.z < 0.07 && v.y > G + 0.022) v.y = G + 0.022; }));
			B.add(foot, M(c, "gloss"), bake(new THREE.CylinderGeometry(0.009, 0.006, 0.05, 10), [0, G + 0.02, -back + 0.018]));
			B.add(foot, M(c, "gloss"), bake(new THREE.TorusGeometry(0.034, 0.004, 5, 18), [0, G + 0.055, -0.005], [Math.PI / 2, 0, 0], [1, 1.2, 1]));
		} else if (kind === "sandals") {
			B.add(foot, M(shade(c, 0.8), "leather"), footGeo(L * 1.02, W * 1.04, back, 0.014, 0.003).translate(0, G, 0));
			for (const z of [0.03, 0.09]) B.add(foot, M(c, "leather"), bake(new THREE.TorusGeometry(W * 0.5, 0.006, 5, 20, Math.PI), [0, G + 0.012, z], [0, 0, 0], [1, 0.62, 1]));
		}
	}


	// Hair: a cap that follows the skull down to a hairline, plus whatever the style adds (a curtain of long hair, a bob,
	// a ponytail, a bun, curls). Everything is in the face group (it turns with the head).
	buildHair(face, mat, female, style) {
		const B = new Batch();
		const v = new THREE.Vector3();
		const HL_F = [[0, 0.6], [0.45, 0.55], [0.9, 0.4], [1.3, 0.26], [1.65, 0.14], [2.1, -0.25], [2.6, -0.5], [Math.PI, -0.55]];
		const HL_M = [[0, 0.64], [0.4, 0.62], [0.75, 0.52], [1.1, 0.36], [1.28, 0.16], [1.36, -0.16], [1.46, -0.14], [1.56, 0.2], [1.85, 0.12], [2.2, -0.3], [2.7, -0.48], [Math.PI, -0.52]];
		const HL = female ? HL_F : HL_M;
		const line = (tab, extra) => a => interp(tab, Math.abs(a)) - (extra ? extra(a) : 0);
		// a cap over the skull: th(a, y) is its thickness (in head radii), hl(a) the hairline (unit height, a from the front)
		const cap = (hl, th, segs = 84) => reshape(new THREE.SphereGeometry(1, segs, 64), p => {
			const a = Math.atan2(p.x, p.z), h = hl(a);
			const y = Math.max(p.y, h), r = Math.sqrt(Math.max(0, 1 - y * y));
			const t = th(a, y) * (0.08 + 0.92 * smooth01((y - h) / 0.2));
			headShape(Math.sin(a) * r, y, Math.cos(a) * r, female, v);
			p.copy(v).multiplyScalar(1 + t);
		});
		const add = (g, m = mat) => B.add(face, m, g);
		const tieM = new THREE.MeshStandardMaterial({ color: "#2a1f2a", roughness: 0.6 });
		// long hair falling behind (and to the sides of) the face: a revolved curtain, open at the front
		const curtain = (pts, gap, flare, wave) => {
			const g = revolve(pts, 60, pts.length * 4, gap, Math.PI * 2 - gap * 2);
			return reshape(g, p => {
				const a = Math.atan2(p.x, p.z), down = smooth01(-(p.y + 0.06) / 0.3);
				const k = 1 + wave * Math.sin(a * 9 + p.y * 30) * smooth01(-p.y / 0.12);
				p.x *= k * (0.92 + flare * down); p.z *= k * (0.98 - 0.1 * down);
			});
		};
		const hairDouble = mat.clone(); hairDouble.side = THREE.DoubleSide;
		const tail = (pts, r0, rMax, rEnd) => {
			const curve = new THREE.CatmullRomCurve3(pts), TS = 24, RS = 10, g = new THREE.TubeGeometry(curve, TS, 1, RS, false), c = new THREE.Vector3();
			return reshape(g, (p, i) => {
				const t = Math.floor(i / (RS + 1)) / TS;
				curve.getPointAt(t, c);
				const r = t < 0.3 ? r0 + (rMax - r0) * smooth01(t / 0.3) : rMax + (rEnd - rMax) * smooth01((t - 0.3) / 0.7);
				p.sub(c).multiplyScalar(Math.max(0.002, r)).add(c);
			});
		};

		// ---- locks: the strands that make a cut look like hair (not a helmet)
		const rnd = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
		const dirOf = (a, y) => { const h = Math.sqrt(Math.max(0, 1 - y * y)); return new THREE.Vector3(Math.sin(a) * h, y, Math.cos(a) * h); };
		const onHead = (d, lift) => headShape(d.x, d.y, d.z, female, new THREE.Vector3()).multiplyScalar(1 + lift);
		// one lock from (a0, y0) on the scalp over the head to (a1, y1), lifted by lift (+ an arch in the middle); then it can
		// hang free for fall metres (flaring out by flare, waving by wave). w: its width, tip: how fine its end is
		const lock = (a0, y0, a1, y1, o) => {
			o = Object.assign({ lift: 0.07, arch: 0.04, w: 0.022, tip: 0.25, fall: 0, flare: 0, wave: 0, seed: 0 }, o);
			const pts = [], N = 7, d0 = dirOf(a0, y0), d1 = dirOf(a1, y1);
			for (let i = 0; i <= N; i++) { const t = i / N; pts.push(onHead(d0.clone().lerp(d1, t).normalize(), o.lift + o.arch * Math.sin(t * Math.PI))); }
			if (o.fall) {
				const last = pts[N], out = new THREE.Vector3(last.x, 0, last.z).normalize();
				for (let i = 1; i <= 6; i++) {
					const t = i / 6, wv = Math.sin(t * 7 + o.seed * 5) * o.wave;
					pts.push(last.clone().addScaledVector(out, o.flare * t + wv).add(new THREE.Vector3(0, -o.fall * t, 0)));
				}
			}
			const curve = new THREE.CatmullRomCurve3(pts), TS = o.fall ? 26 : 12, RS = 6;
			const g = new THREE.TubeGeometry(curve, TS, 1, RS, false), c = new THREE.Vector3(), n = new THREE.Vector3();
			return reshape(g, (p, i) => {
				const t = Math.floor(i / (RS + 1)) / TS;
				curve.getPointAt(t, c);
				const r = o.w * (t < 0.12 ? 0.55 + 0.45 * t / 0.12 : 1 - (1 - o.tip) * smooth01((t - 0.3) / 0.7));
				n.copy(c).setY(c.y * 0.3).normalize();
				p.sub(c);
				p.addScaledVector(n, -p.dot(n) * 0.55);   // flat against the head
				p.multiplyScalar(r).add(c);
			});
		};
		// roots spread evenly over the scalp above the hairline (and above yMin): [a, y]
		const roots = (n, yMin, hl) => {
			const out = [];
			for (let i = 0; i < n * 3 && out.length < n; i++) {
				const y = 1 - (i + 0.5) / (n * 3) * 2, a = Math.atan2(Math.sin(i * 2.39996), Math.cos(i * 2.39996));
				if (y < yMin || y < hl(a) + 0.08) continue;
				out.push([a, y, out.length]);
			}
			return out;
		};
		const HLm = line(HL_M), HLf = line(HL_F);
		// short back and sides (a fade): the cap thins out low down
		const fade = top => (a, y) => 0.016 + (top - 0.016) * smooth01((y - 0.25) / 0.3);
		// where a lock that falls loose should land: round at the side or the back, never across the face
		const aside = a => (a >= 0 ? 1 : -1) * Math.max(1.05, Math.abs(a) * 1.05 + 0.3);
		const knot = (at, r) => add(reshape(new THREE.SphereGeometry(r, 18, 12), p => { p.multiplyScalar(1 + 0.08 * Math.sin(p.x * 150) * Math.sin(p.y * 130)); p.y *= 0.85; p.add(at); }));

		// ================================================================ boys
		if (style === "textured") {
			// a textured crop: short faded sides, choppy pieces on top pushed forward into a messy fringe
			add(cap(HLm, fade(0.06)));
			for (const [a, y, i] of roots(70, 0.48, HLm)) {
				const front = Math.abs(a) < 1.3;
				add(lock(a, y, a * (front ? 0.85 : 0.95) + (rnd(i) - 0.5) * 0.35, front ? Math.max(0.52, y - 0.3) : Math.max(0.45, y - 0.22), { lift: 0.06, arch: 0.05 + rnd(i + 3) * 0.05, w: 0.02 + rnd(i + 7) * 0.008, tip: 0.15 }));
			}
		} else if (style === "curtain") {
			// middle part, curtain fringe falling either side of the forehead, covering the tops of the ears
			add(cap(HLm, () => 0.05));
			for (const [a, y, i] of roots(80, 0.2, HLm)) {
				const s = a >= 0 ? 1 : -1, ab = Math.abs(a);
				if (ab < 1.2) add(lock(s * Math.max(0.05, ab * 0.4), Math.min(0.98, y + 0.15), s * (0.55 + ab * 0.7), 0.28 + (1 - ab) * 0.1, { lift: 0.07, arch: 0.06, w: 0.024, tip: 0.2 }));
				else add(lock(a, y, a * 1.02, Math.max(-0.35, y - 0.55), { lift: 0.06, arch: 0.03, w: 0.026, tip: 0.3 }));
			}
		} else if (style === "undercut") {
			// clipped sides, a long top swept over to one side and back
			add(cap(HLm, fade(0.065)));
			for (const [a, y, i] of roots(55, 0.55, HLm)) add(lock(a, y, a + 0.9 + rnd(i) * 0.2, Math.max(0.42, y - 0.22), { lift: 0.06, arch: 0.1 + rnd(i) * 0.05, w: 0.026, tip: 0.2 }));
		} else if (style === "slick") {
			// slicked back from the hairline
			add(cap(HLm, fade(0.05)));
			for (const [a, y, i] of roots(50, 0.4, HLm)) {
				const s = a >= 0 ? 1 : -1;
				add(lock(a, y, s * (Math.PI - Math.abs(a) * 0.4), Math.max(0.0, 0.45 - Math.abs(a) * 0.12), { lift: 0.05, arch: 0.09, w: 0.024, tip: 0.12 }));
			}
		} else if (style === "fluffy") {
			// soft and full, a fluffy fringe down to the brows (the K-pop look)
			add(cap(line(HL_M, a => 0.2 * gauss(a * a, 0.5)), () => 0.08));
			for (const [a, y, i] of roots(95, 0.05, HLm)) {
				const ab = Math.abs(a);
				const y1 = ab < 1.1 ? 0.36 + rnd(i) * 0.06 : ab < 2.1 ? 0.0 : -0.3;
				add(lock(a, y, a * (ab < 1.1 ? 1.05 : 1.0) + (rnd(i + 1) - 0.5) * 0.15, Math.min(y - 0.05, y1), { lift: 0.09, arch: 0.07, w: 0.03, tip: 0.3 }));
			}
		} else if (style === "curls") {
			// a curly top over a faded back and sides
			add(cap(HLm, fade(0.07)));
			for (let i = 0; i < 150; i++) {
				const y = 1 - (i + 0.5) / 150 * 0.75, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
				const d = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
				add(bake(new THREE.TorusGeometry(0.014 + rnd(i) * 0.006, 0.0075, 6, 12), onHead(d, 0.12 + 0.05 * rnd(i + 2)).toArray(), [rnd(i) * 3, rnd(i + 1) * 3, rnd(i + 2) * 3]));
			}
		}

		// ================================================================ girls
		else if (style === "curtainlong") {
			// long layers with curtain bangs from a middle part
			add(cap(HLf, () => 0.05));
			add(curtain([[0.11, -0.42], [0.15, -0.36], [0.153, -0.26], [0.146, -0.14], [0.141, -0.04], [0.136, 0.03], [0.12, 0.07]], 0.85, 0.36, 0.0), hairDouble);
			for (const [a, y, i] of roots(80, -0.1, HLf)) {
				const s = a >= 0 ? 1 : -1, ab = Math.abs(a);
				if (ab < 1.0) add(lock(s * Math.max(0.04, ab * 0.3), Math.min(0.98, y + 0.12), s * (0.95 + ab * 0.5), -0.05, { lift: 0.07, arch: 0.05, w: 0.026, fall: 0.12 + rnd(i) * 0.1, flare: 0.02, tip: 0.2 }));
				else add(lock(a, y, a, -0.2, { lift: 0.06, arch: 0.02, w: 0.03, fall: 0.18 + rnd(i) * 0.08, flare: 0.05, wave: 0.008, seed: i, tip: 0.25 }));
			}
		} else if (style === "sleek") {
			// long, straight and glossy from a sharp middle part
			add(cap(HLf, () => 0.045));
			add(curtain([[0.11, -0.46], [0.152, -0.4], [0.152, -0.26], [0.145, -0.14], [0.14, -0.04], [0.135, 0.03], [0.12, 0.07]], 0.8, 0.3, 0.0), hairDouble);
			for (const [a, y, i] of roots(70, -0.1, HLf)) {
				const s = a >= 0 ? 1 : -1;
				add(lock(s * Math.max(0.03, Math.abs(a) * 0.9), Math.min(0.99, y + 0.05), aside(a), -0.22, { lift: 0.06, arch: 0.02, w: 0.032, fall: 0.3 + rnd(i) * 0.04, flare: 0.04, tip: 0.6 }));
			}
		} else if (style === "beach") {
			// beach waves from a side part
			add(cap(line(HL_F, a => 0.1 * gauss((a - 0.4) ** 2, 0.15)), () => 0.06));
			add(curtain([[0.11, -0.42], [0.16, -0.36], [0.162, -0.26], [0.15, -0.14], [0.142, -0.04], [0.137, 0.03], [0.12, 0.07]], 0.8, 0.42, 0.035), hairDouble);
			for (const [a, y, i] of roots(80, -0.1, HLf)) {
				const sw = a > 0.5 ? 1 : -1;   // (parted on one side: most of it swept over)
				add(lock(a, y, aside(a) + sw * 0.12, -0.15, { lift: 0.07, arch: 0.05, w: 0.03, fall: 0.2 + rnd(i) * 0.1, flare: 0.06, wave: 0.03, seed: i, tip: 0.3 }));
			}
		} else if (style === "wolf") {
			// a wolf cut: shaggy layers to the shoulders, wispy bangs
			add(cap(line(HL_F, a => 0.18 * gauss(a * a, 0.35)), () => 0.07));
			add(curtain([[0.12, -0.27], [0.165, -0.22], [0.16, -0.12], [0.148, -0.03], [0.14, 0.03], [0.12, 0.07]], 0.9, 0.3, 0.03), hairDouble);
			for (const [a, y, i] of roots(95, -0.05, HLf)) {
				const ab = Math.abs(a);
				if (ab < 0.9) add(lock(a * 0.6, Math.min(0.98, y + 0.1), a * 1.15, 0.3 + rnd(i) * 0.06, { lift: 0.08, arch: 0.05, w: 0.022, tip: 0.12 }));
				else add(lock(a, y, a * 1.03, -0.1, { lift: 0.08, arch: 0.07, w: 0.028, fall: 0.06 + rnd(i) * 0.12, flare: 0.07, wave: 0.02, seed: i, tip: 0.15 }));
			}
		} else if (style === "lob") {
			// a long bob, swept from a side part, the ends flicked under
			add(cap(line(HL_F, a => 0.1 * gauss((a + 0.4) ** 2, 0.15)), () => 0.06));
			add(curtain([[0.11, -0.2], [0.155, -0.17], [0.158, -0.1], [0.148, -0.02], [0.14, 0.03], [0.12, 0.07]], 0.95, 0.12, 0.0), hairDouble);
			for (const [a, y, i] of roots(70, -0.05, HLf)) add(lock(a, y, aside(a) - 0.12, -0.1, { lift: 0.07, arch: 0.05, w: 0.03, fall: 0.06, flare: -0.01, tip: 0.35 }));
		} else if (style === "highpony") {
			// a high ponytail, smooth on top, a couple of loose strands framing the face
			add(cap(HLf, () => 0.04));
			headAt(Math.PI, 0.62, female, v);
			const at = v.clone().multiplyScalar(1.09);
			for (const [a, y, i] of roots(40, 0.2, HLf)) add(lock(a, y, Math.PI * (a >= 0 ? 0.97 : -0.97), 0.62, { lift: 0.04, arch: 0.02, w: 0.022, tip: 0.6 }));
			add(tail([at, at.clone().add(new THREE.Vector3(0, 0.04, -0.07)), at.clone().add(new THREE.Vector3(0, -0.08, -0.12)), at.clone().add(new THREE.Vector3(0, -0.26, -0.1)), at.clone().add(new THREE.Vector3(0, -0.36, -0.08))], 0.034, 0.055, 0.012));
			add(bake(new THREE.TorusGeometry(0.028, 0.008, 8, 18), at.toArray(), [0.9, 0, 0]), tieM);
			for (const sx of [-1, 1]) add(lock(sx * 0.75, 0.5, sx * 1.0, 0.05, { lift: 0.05, arch: 0.02, w: 0.01, fall: 0.08, wave: 0.01, seed: sx, tip: 0.3 }));
		} else if (style === "messybun") {
			// a messy bun on top, loose face-framing pieces
			add(cap(HLf, () => 0.045));
			headAt(Math.PI * 0.9, 0.78, female, v);
			const at = v.clone().multiplyScalar(1.24);
			for (const [a, y, i] of roots(40, 0.2, HLf)) add(lock(a, y, Math.PI * 0.9 * (a >= 0 ? 1 : -1), 0.8, { lift: 0.04, arch: 0.02, w: 0.022, tip: 0.6 }));
			knot(at, 0.055);
			for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(bake(new THREE.TorusGeometry(0.022, 0.009, 6, 14, Math.PI * 1.3), [at.x + Math.cos(a) * 0.035, at.y + 0.015 + rnd(i) * 0.02, at.z + Math.sin(a) * 0.035], [rnd(i) * 3, a, rnd(i + 4)])); }
			for (const sx of [-1, 1]) add(lock(sx * 0.7, 0.52, sx * 0.95, 0.0, { lift: 0.05, arch: 0.02, w: 0.011, fall: 0.07, wave: 0.012, seed: sx + 2, tip: 0.3 }));
		} else if (style === "halfup") {
			// half up, half down: the top pulled back into a little knot, the rest long and loose
			add(cap(HLf, () => 0.05));
			add(curtain([[0.11, -0.42], [0.15, -0.36], [0.153, -0.26], [0.146, -0.14], [0.141, -0.04], [0.136, 0.03], [0.12, 0.07]], 0.85, 0.36, 0.02), hairDouble);
			headAt(Math.PI, 0.4, female, v);
			const at = v.clone().multiplyScalar(1.12);
			for (const [a, y, i] of roots(70, -0.1, HLf)) {
				if (y > 0.45) add(lock(a, y, Math.PI * (a >= 0 ? 0.96 : -0.96), 0.42, { lift: 0.05, arch: 0.03, w: 0.022, tip: 0.6 }));
				else add(lock(a, y, a, -0.2, { lift: 0.06, arch: 0.02, w: 0.03, fall: 0.2 + rnd(i) * 0.08, flare: 0.05, wave: 0.012, seed: i, tip: 0.3 }));
			}
			knot(at, 0.04);
		}
		B.flush();
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
		this.mouth.position.y = this.mouthY + (frown ? -0.007 : 0);
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
		// "walkride": walking along while a ride carries you (back round to the slide's ladder): a walk at a steady pace
		const walkRide = this.anim === "walkride";
		const base = bedsit ? "sit" : walkRide ? "idle" : this.anim, up = this.upper;
		if (up !== this._lastUp) { this._lastUp = up; this.upperT = 0; }
		this.upperT += dt;
		const ut = this.upperT;
		const mood = this.mood;
		const speed = walkRide ? 1 : this.speed;
		const moving = speed > 0.05 && base === "idle";
		this.phase += dt * (moving ? 6.2 + speed * 3.4 : 0);
		const ph = this.phase;
		const amp = moving ? Math.min(1.25, speed) : 0;
		const breathe = Math.sin(t * 1.8) * 0.012;

		const P = {
			bodyY: 0, bodyRY: 0, hipsX: 0, hipsY: 0, hipsZ: 0, torsoX: breathe, torsoZ: 0, torsoY: 0, headX: 0, headY: 0, headZ: 0,
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
		} else if (base === "climb") {
			// up (or down) a ladder, facing it: hand over hand, one knee up then the other
			const c = t * 5.2;
			for (let i = 0; i < 2; i++) {
				const s2 = Math.sin(c + i * Math.PI);
				P.arm[i].x = -2.55 - s2 * 0.32; P.arm[i].z = (i ? 1 : -1) * 0.16; P.arm[i].e = -0.35 - Math.max(0, s2) * 0.55;
				P.leg[i].x = -0.35 - Math.max(0, s2) * 0.95; P.leg[i].k = 0.25 + Math.max(0, s2) * 1.35; P.leg[i].z = (i ? 1 : -1) * 0.06;
				P.foot[i] = 0.15;
			}
			P.torsoX = 0.06; P.headX = -0.25; P.bodyY = -0.04 + Math.abs(Math.sin(c)) * 0.04;
		} else if (base === "slide") {
			// whizzing down a slide: sat back, legs out straight, hands up in the air
			P.bodyY = -0.42;
			P.leg[0].x = P.leg[1].x = -1.45; P.leg[0].k = P.leg[1].k = 0.08; P.foot[0] = P.foot[1] = -0.35;
			P.leg[0].z = -0.07; P.leg[1].z = 0.07;
			P.torsoX = -0.38 + breathe; P.headX = 0.15;
			const w = Math.sin(t * 9) * 0.12;
			P.arm[0].z = -2.6 + w; P.arm[1].z = 2.6 - w; P.arm[0].e = P.arm[1].e = -0.2;
		} else if (base === "zip") {
			// hanging from a zipline's handle: arms straight up, legs dangling and swinging a little
			P.arm[0].x = P.arm[1].x = -2.95; P.arm[0].z = -0.12; P.arm[1].z = 0.12; P.arm[0].e = P.arm[1].e = -0.08;
			const sw2 = Math.sin(t * 3.1) * 0.18;
			P.leg[0].x = -0.35 + sw2; P.leg[1].x = -0.2 - sw2; P.leg[0].k = 0.35; P.leg[1].k = 0.2; P.foot[0] = P.foot[1] = 0.3;
			P.torsoX = -0.05; P.headX = -0.1;
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

		// in the air (a jump): knees tucked, arms out for balance
		if (this.air != null && base === "idle") {
			const s = Math.sin(this.air * Math.PI);
			P.leg[0].x = -0.75 * s; P.leg[1].x = -0.35 * s; P.leg[0].k = 1.25 * s; P.leg[1].k = 0.8 * s;
			P.foot[0] = P.foot[1] = 0.3 * s;
			if (!up) { P.arm[0].z = -0.95 * s; P.arm[1].z = 0.95 * s; P.arm[0].x = P.arm[1].x = -0.35 * s; P.arm[0].e = P.arm[1].e = -0.6 * s; }
			P.torsoX += 0.12 * s; P.bodyY = 0;
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
		} else if (up === "kick") {
			// a big kick with the right foot (a snowman, a ball): wind back, swing through, arms out for balance
			const c = Math.min(1, ut / 0.75);
			const swing = c < 0.3 ? -c / 0.3 * 0.55 : c < 0.55 ? -0.55 + (c - 0.3) / 0.25 * 2.25 : 1.7 * (1 - (c - 0.55) / 0.45);
			P.leg[1].x = -swing; P.leg[1].k = c < 0.3 ? 0.9 : c < 0.55 ? 0.25 : 0.2 + (c - 0.55);
			P.leg[0].k = 0.12; P.torsoX = -0.12 * Math.max(0, swing);
			P.arm[0].z = -1.0; P.arm[1].z = 0.9; P.arm[0].x = -0.4 * swing; P.arm[1].x = 0.3 * swing; P.arm[0].e = P.arm[1].e = -0.3;
		} else if (up === "scoop") {
			// crouching to scoop up a handful of snow and pat it into a ball
			const c = ut;
			const down = c < 0.35 ? c / 0.35 : c < 1.05 ? 1 : Math.max(0, 1 - (c - 1.05) / 0.3);
			P.bodyY = -0.42 * down;
			P.leg[0].x = P.leg[1].x = -1.25 * down; P.leg[0].k = P.leg[1].k = 2.0 * down + 0.04;
			P.foot[0] = P.foot[1] = 0.55 * down;
			P.torsoX = 0.55 * down; P.headX = 0.25 * down;
			const pat = c > 0.5 && c < 1.1 ? Math.sin(c * 30) * 0.12 : 0;
			for (let i = 0; i < 2; i++) { P.arm[i].x = -1.0 * down - 0.4; P.arm[i].z = (i ? 1 : -1) * (0.05 + pat); P.arm[i].e = -0.9 - pat; }
		} else if (up === "throw") {
			// an overarm throw with the right hand: back over the shoulder, then whip it forward
			const c = Math.min(1, ut / 0.6);
			const r = c < 0.4 ? c / 0.4 : 1;
			const f = c < 0.4 ? 0 : Math.min(1, (c - 0.4) / 0.2);
			P.arm[1].x = -2.7 * r + 2.0 * f; P.arm[1].e = -1.6 * r + 1.3 * f; P.arm[1].z = 0.25;
			P.arm[0].x = -0.9 * r + 0.5 * f; P.arm[0].z = -0.35; P.arm[0].e = -0.5;
			P.torsoY = 0.35 * r - 0.7 * f; P.torsoX = -0.08 * r + 0.18 * f;
			P.leg[0].x = -0.35 * r; P.leg[1].x = 0.25 * r;
		} else if (up === "kart") {
			// both hands on a bumper kart's steering wheel
			for (let i = 0; i < 2; i++) { P.arm[i].x = -0.95; P.arm[i].e = -0.8; P.arm[i].z = (i ? 1 : -1) * 0.22; }
		} else if (up === "drive") {
			// at the wheel of a car: leaning back in the seat, both hands up on the wheel
			P.torsoX = -0.14;
			for (let i = 0; i < 2; i++) { P.arm[i].x = -1.15; P.arm[i].e = -0.62; P.arm[i].z = (i ? 1 : -1) * 0.2; }
		} else if (up === "carpass") {
			// riding along: leaning back, hands in the lap
			P.torsoX = -0.16; P.headX = -0.04;
			for (let i = 0; i < 2; i++) { P.arm[i].x = -0.5; P.arm[i].e = -0.95; P.arm[i].z = (i ? 1 : -1) * 0.1; }
		}

		else if (up && up.startsWith("dz_") && base === "idle" && !moving) this.dancePose(up.slice(3), t, P);
		else if (up === "beckon") {
			// "come here": a curling finger, head tilted, a little smile
			const c = Math.max(0, Math.sin(t * 6));
			P.arm[0].x = -1.25; P.arm[0].z = -0.15; P.arm[0].e = -0.6 - c * 1.2;
			P.headZ = 0.18; P.headX = -0.05; P.bodyRY = 0.15;
		} else if (up === "flirty") {
			// hand on the hip, the other one through the hair, hip popped out
			P.arm[0].x = -0.25; P.arm[0].z = -0.85; P.arm[0].e = -1.7;
			P.arm[1].x = -2.3 + Math.sin(t * 2) * 0.15; P.arm[1].z = 1.0; P.arm[1].e = -2.2;
			P.hipsZ = 0.12; P.torsoZ = -0.12; P.headZ = 0.2; P.headY = 0.25;
			P.leg[0].x = -0.15; P.leg[0].k = 0.35; P.leg[0].z = 0.08;
		} else if (up === "bitelip") {
			// a finger to the lip, a sideways look
			P.arm[0].x = -1.6; P.arm[0].z = 0.42; P.arm[0].e = -2.35;
			P.arm[1].x = -0.4; P.arm[1].z = -0.5; P.arm[1].e = -1.4;
			P.headX = 0.12; P.headY = -0.3 + Math.sin(t * 1.5) * 0.08; P.headZ = 0.12;
		} else if (up === "shy") {
			// hands behind the back, swaying, a toe drawing circles
			P.arm[0].x = P.arm[1].x = 0.45; P.arm[0].z = 0.25; P.arm[1].z = -0.25; P.arm[0].e = P.arm[1].e = -1.1;
			P.headX = 0.3; P.headZ = Math.sin(t * 1.6) * 0.12; P.bodyRY = Math.sin(t * 1.6) * 0.15;
			P.leg[1].x = -0.15; P.leg[1].z = 0.12 + Math.sin(t * 4) * 0.08; P.foot[1] = 0.4;
		} else if (up === "giggle") {
			// a hand over the mouth, shoulders shaking
			const sh = Math.sin(t * 16) * 0.05;
			P.arm[0].x = -1.75; P.arm[0].z = 0.38; P.arm[0].e = -2.35;
			P.torsoX = 0.1 + sh; P.headX = 0.15 + sh; P.headZ = 0.15;
		} else if (up === "eep") {
			// "eep!": a little hop, hands flying up to the cheeks
			const k = Math.min(1, ut * 3), hop = ut < 0.5 ? Math.sin(ut / 0.5 * Math.PI) : 0;
			P.bodyY = hop * 0.08;
			P.arm[0].x = P.arm[1].x = -1.7 * k; P.arm[0].z = 0.3; P.arm[1].z = -0.3; P.arm[0].e = P.arm[1].e = -2.4 * k;
			P.headX = -0.1; P.leg[1].x = -0.4 * k; P.leg[1].k = 0.9 * k;
		} else if (up === "melt") {
			// held from behind: holding their arms, leaning back into them, eyes closed
			P.arm[0].x = P.arm[1].x = -0.45; P.arm[0].z = 0.55; P.arm[1].z = -0.55; P.arm[0].e = P.arm[1].e = -1.45;
			P.torsoX = -0.08; P.headX = -0.15; P.headZ = 0.2; P.eyes = 0.05;
		} else if (up === "foreheadkiss") {
			// hands on their face, a kiss on the forehead
			P.torsoX = 0.06; P.headX = 0.3; P.eyes = ut > 0.4 ? 0.05 : 1;
			P.arm[0].x = P.arm[1].x = -1.3; P.arm[0].e = P.arm[1].e = -1.2;
		} else if (up === "boop") {
			// one finger, right on the nose
			P.arm[0].x = -1.4; P.arm[0].e = -0.3; P.headZ = 0.15;
		} else if (up === "backhug" || up === "neckkiss") {
			// arms round them from behind; a kiss on the neck leans right in
			P.arm[0].x = P.arm[1].x = -1.2; P.arm[0].e = P.arm[1].e = -1.0;
			P.headZ = 0.2; P.headX = 0.15;
			if (up === "neckkiss") { const k = Math.min(1, ut * 2); P.torsoX = 0.14 * k; P.headX = 0.4 * k; P.headY = 0.5 * k; P.headZ = 0.25 * k; if (ut > 0.4) P.eyes = 0.05; }
		} else if (up === "buttpat") {
			// a cheeky pat (the hand's placed by IK; it bounces)
			P.arm[0].x = -0.5; P.arm[0].e = -0.4; P.headZ = 0.2; P.headY = -0.2;
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
		this._e(this.hips.rotation, "y", P.hipsY, k);
		this._e(this.hips.rotation, "z", P.hipsZ, k);
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
			// sitting, the skirt spreads over the lap (a long one rides up to the knees); walking, it sways (a long one
			// opens front to back with the stride)
			const sit = base === "sit" || base === "floor";
			const sp = sit ? 1.25 : 1 + amp * 0.05 * Math.sin(ph * 2);
			this.skirt.scale.x += (sp - this.skirt.scale.x) * k;
			if (this.skirtLong || this.drapes.length) {
				this._e(this.skirt.scale, "y", sit ? 0.2 : base === "sleep" && this.skirtLong ? 0.75 : 1, k);
				this._e(this.skirt.scale, "z", sit ? 1.1 : 1 + amp * (this.skirtLong ? 0.32 : 0.15), k);
				this.drapes.forEach(d => { d.visible = sit; });
			}
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

	// Ten dances (on the arms layer, while standing still): each sets the pose P for time t
	dancePose(id, t, P) {
		const S = Math.sin, C = Math.cos;
		const arm = (i, x, z, e) => { P.arm[i].x = x; P.arm[i].z = z; P.arm[i].e = e; };
		const leg = (i, x, k, z = 0) => { P.leg[i].x = x; P.leg[i].k = k; P.leg[i].z = z; };
		if (id === "hiphop") {
			const b = t * 7.5, s = S(b);
			P.bodyY = -Math.abs(s) * 0.07; P.headX = Math.abs(s) * 0.18 - 0.05;
			leg(0, -0.35 * Math.abs(s), 0.6 * Math.abs(s)); leg(1, -0.35 * Math.abs(s), 0.6 * Math.abs(s));
			arm(0, -1.2 - S(b / 2) * 0.6, -0.4, -1.4); arm(1, -1.2 + S(b / 2) * 0.6, 0.4, -1.4);
			P.torsoY = S(b / 2) * 0.3; P.torsoX = 0.12;
		} else if (id === "floss") {
			const b = t * 6, s = S(b);
			arm(0, s * 0.5, -0.25 + s * 0.15, -0.1); arm(1, s * 0.5, 0.25 + s * 0.15, -0.1);
			P.hipsZ = -s * 0.18; P.torsoZ = s * 0.12; P.bodyY = -Math.abs(C(b)) * 0.03;
		} else if (id === "robot") {
			const step = Math.floor(t * 3), q = [0.0, 0.6, -0.6, 0.3][step % 4];
			arm(0, -1.55, -0.1, -1.57 + q); arm(1, -1.55, 0.1, -1.57 - q);
			P.headY = [0, 0.5, 0, -0.5][step % 4]; P.torsoY = [0, 0.2, 0, -0.2][step % 4];
			leg(step % 2, -0.3, 0.5);
		} else if (id === "disco") {
			const b = t * 4, up = S(b) > 0;
			arm(0, up ? -2.6 : -0.3, up ? -0.5 : -0.4, -0.1); arm(1, -0.3, 0.35, -1.6);
			P.hipsZ = S(b) * 0.15; P.torsoZ = -S(b) * 0.1; P.headY = up ? -0.3 : 0.2;
			leg(0, -0.2, 0.4 * Math.max(0, S(b)));
		} else if (id === "salsa") {
			const b = t * 5, s = S(b);
			leg(0, -s * 0.35, Math.max(0, s) * 0.5); leg(1, s * 0.35, Math.max(0, -s) * 0.5);
			P.hipsY = s * 0.25; P.hipsZ = S(b * 2) * 0.08; P.torsoY = -s * 0.15;
			arm(0, -0.9, -0.5, -1.3 + s * 0.2); arm(1, -1.6, 0.6, -0.8 - s * 0.2);
		} else if (id === "shuffle") {
			const b = t * 9, s = S(b);
			leg(0, -Math.max(0, s) * 0.8, Math.max(0, s) * 1.0, -0.1); leg(1, -Math.max(0, -s) * 0.8, Math.max(0, -s) * 1.0, 0.1);
			arm(0, -s * 0.7, -0.3, -1.2); arm(1, s * 0.7, 0.3, -1.2);
			P.bodyY = -Math.abs(s) * 0.05; P.torsoX = 0.1;
		} else if (id === "bootyshake") {
			// a cheeky one: bent over a little, hands on the knees, hips shaking
			const s = S(t * 14);
			P.torsoX = 0.45; P.headX = -0.35; P.bodyY = -0.08;
			leg(0, -0.35, 0.65, -0.12); leg(1, -0.35, 0.65, 0.12);
			arm(0, -0.75, -0.2, -0.3); arm(1, -0.75, 0.2, -0.3);
			P.hipsY = s * 0.22; P.hipsZ = s * 0.1;
		} else if (id === "ballet") {
			const b = t * 1.6;
			arm(0, -2.6, -0.45, -0.8); arm(1, -2.6, 0.45, -0.8);
			P.bodyRY = S(b) * 0.9; P.foot[0] = P.foot[1] = -0.6; P.bodyY = 0.04;
			leg(1, -0.2, 1.3 + S(b * 2) * 0.2, 0.2); P.headX = -0.1;
		} else if (id === "kpop") {
			const b = t * 5, ph = Math.floor(t * 1.25) % 4;
			if (ph === 0) { arm(0, -2.5, 0.35, -1.9); arm(1, -2.5, -0.35, -1.9); }          // a heart over the head
			else if (ph === 1) { arm(0, -1.6 + S(b) * 0.3, -0.2, -0.1); arm(1, -0.3, 0.3, -1.5); }   // point
			else if (ph === 2) { arm(0, -1.2, -0.9, -1.2); arm(1, -1.2, 0.9, -1.2); P.torsoY = S(b) * 0.3; }
			else { arm(0, -0.3, -1.4 + S(b) * 0.3, -0.2); arm(1, -0.3, 1.4 - S(b) * 0.3, -0.2); }
			leg(0, -Math.max(0, S(b)) * 0.3, Math.max(0, S(b)) * 0.6); leg(1, -Math.max(0, -S(b)) * 0.3, Math.max(0, -S(b)) * 0.6);
			P.bodyY = -Math.abs(S(b)) * 0.04; P.headZ = S(b / 2) * 0.12;
		} else if (id === "sway") {
			// a slow, sultry sway, hands up through the hair
			const b = t * 1.8, s = S(b);
			P.hipsZ = s * 0.16; P.hipsY = s * 0.12; P.torsoZ = -s * 0.12; P.bodyRY = s * 0.15;
			arm(0, -2.4 + s * 0.2, -0.6, -2.0); arm(1, -2.4 - s * 0.2, 0.6, -2.0);
			P.headX = -0.12; P.headZ = s * 0.15; P.eyes = (t % 5) < 2.5 ? 0.3 : 1;
			leg(s > 0 ? 0 : 1, -0.15, 0.35);
		}
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
