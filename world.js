/**
 * Harmony World — a shared 3D living room for everyone in a piano room.
 *
 * Opened from the piano page ("Enter World") as world.html?c=<room>. Everyone
 * with the same ?c= is in the same world. Transport is the existing Harmony
 * relay (/relay, see roomSync.js + relay-server.js) on its own channel
 * "world~<room>", so nothing here touches the piano's own sync.
 *
 * Shared state is a last-writer-wins key/value map ({v, ts} per key) that is
 * broadcast on change, sent to newcomers on join, and cached in localStorage
 * so the room keeps its photos, notes, plant, etc. between visits.
 *
 * The YouTube video is a real <iframe> placed on the TV with CSS3DRenderer;
 * the WebGL TV screen becomes a transparent "hole" so the video shows through
 * while furniture and people in front of the TV still cover it.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { Avatar, SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, MOODS, drawMoodFace } from "./worldAvatar.js";
import { buildRoom, ROOM, DOOR, TERRACE, MOON_DIR, walkable, areaOf, heartMesh, makeMug } from "./worldRoom.js";
import { WorldAudio, TRACKS } from "./worldAudio.js";
import * as Games from "./worldGames.js";

const esc = Games.esc;
const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const ROOM_NAME = (params.get("c") || "lobby").slice(0, 120);
const CHANNEL = "world~" + ROOM_NAME;
const LS_PROFILE = "harmonyWorldProfile";
const LS_STATE = "harmonyWorldState:" + ROOM_NAME;
const LS_STROKES = "harmonyWorldStrokes:" + ROOM_NAME;
const LS_SEEN = "harmonyWorldSeen:" + ROOM_NAME;
const now = () => Date.now();
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };

// one id per tab (survives reloads), so two tabs show up as two people
let MY_ID;
try { MY_ID = sessionStorage.getItem("harmonyWorldId"); } catch (e) {}
if (!MY_ID) { MY_ID = "w" + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem("harmonyWorldId", MY_ID); } catch (e) {} }
// stable per-browser person id (love notes remember who wrote/read them across visits)
let ME_PID = lsGet("harmonyWorldPid", "");
if (!ME_PID) { ME_PID = "p" + Math.random().toString(36).slice(2, 12); lsSet("harmonyWorldPid", ME_PID); }

const profile = Object.assign({
	name: "", gender: Math.random() < 0.5 ? "female" : "male",
	skin: SKIN_TONES[1], hair: HAIR_COLORS[1], top: OUTFIT_COLORS[0], bottom: OUTFIT_COLORS[4], mood: "happy"
}, lsGet(LS_PROFILE, {}));
if (!MOODS.some(m => m.id === profile.mood)) profile.mood = "happy";
if (params.get("n") && !profile.name) profile.name = params.get("n").slice(0, 24);

// ============================================================ graphics quality
// Everything in the world works the same on every device; only how hard the GPU works changes.
// High is the default. "Auto" starts from a guess about the device and then watches the real frame rate: it lowers the
// render resolution first, and only on a really struggling device makes the shadows cheaper.
const LS_GFX = "harmonyWorldGfx";
const GFX = [
	{ name: "Low", px: 1.0, shadows: false, map: 1024, every: 4, soft: false, tvFps: 15, arcFps: 6 },
	{ name: "Medium", px: 1.25, shadows: true, map: 1024, every: 3, soft: false, tvFps: 24, arcFps: 8 },
	{ name: "High", px: 1.5, shadows: true, map: 2048, every: 2, soft: true, tvFps: 30, arcFps: 10 }
];
function detectTier() {
	const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
	const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
	let gpu = "";
	try {
		const gl = document.createElement("canvas").getContext("webgl");
		const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
		if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
		const lose = gl && gl.getExtension("WEBGL_lose_context");
		if (lose) lose.loseContext();
	} catch (e) { /* no WebGL info: fall back to the other hints */ }
	const weakGpu = /SwiftShader|llvmpipe|Software|Mali-[4T]|Mali-G(31|51|52|57)\b|Adreno \(TM\) [3-5]\d\d|Adreno [3-5]\d\d|PowerVR|Intel\(R\) HD Graphics( [2-5]\d\d\d?)?$/i.test(gpu);
	if (weakGpu || mem <= 2 || cores <= 2) return 0;
	if (mobile || mem <= 4 || cores <= 4) return 1;
	return 2;
}
const gfx = { pref: lsGet(LS_GFX, "high"), auto: 2, scale: 1 };   // full quality unless you pick something else
if (!["auto", "low", "medium", "high"].includes(gfx.pref)) gfx.pref = "high";
gfx.auto = detectTier();
const gfxTier = () => gfx.pref === "auto" ? gfx.auto : ["low", "medium", "high"].indexOf(gfx.pref);
// scale it down a bit straight away on weak devices so the first seconds are already smooth
if (gfx.pref === "auto") gfx.scale = gfx.auto === 0 ? 0.8 : 1;

// ============================================================ renderer/scene
const canvas = $("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: gfxTier() >= 2, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, GFX[gfxTier()].px) * gfx.scale);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = GFX[gfxTier()].soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const cssRenderer = new CSS3DRenderer({ element: $("#css3d") });
cssRenderer.setSize(innerWidth, innerHeight);
const cssScene = new THREE.Scene();

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 60);
const hemi = new THREE.HemisphereLight("#ffe6cf", "#3a2a35", 0.55);
scene.add(hemi);
const moon = new THREE.DirectionalLight("#a9b8ff", 1.8);
moon.position.set(5, 6.5, -12);
moon.target.position.set(-0.5, 0, -4);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 34 });
moon.shadow.bias = -0.0005;
moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);

const room = buildRoom(scene);
// three.js keys every shader on how many lights are on, so the room and the terrace must
// light with the same number of point lights; otherwise crossing the door recompiles every
// material in the scene (a freeze of a second or more). Pad the smaller side with dark lights.
{
	const side = k => room.areaLights[k].concat(room.minorLights[k]);
	const nRoom = side("room").length, nTerrace = side("terrace").length;
	const short = nRoom < nTerrace ? "room" : "terrace";
	for (let i = Math.abs(nRoom - nTerrace); i > 0; i--) {
		const pad = new THREE.PointLight("#000000", 0, 0.01);
		pad.position.set(0, -50, 0);
		scene.add(pad);
		room.areaLights[short].push(pad);
	}
}
let audio = null;
// Shadows are the biggest cost: tiny props (books, keys, petals, jars...) don't need to cast them,
// and the shadow maps only refresh every other frame (only people and the ball really move).
{
	const ws = new THREE.Vector3();
	scene.updateMatrixWorld(true);
	scene.traverse(o => {
		if (!o.isMesh || !o.castShadow) return;
		if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
		o.getWorldScale(ws);
		if (o.geometry.boundingSphere.radius * Math.max(ws.x, ws.y, ws.z) < 0.22) o.castShadow = false;
	});
	renderer.shadowMap.autoUpdate = false;
	renderer.shadowMap.needsUpdate = true;
}

let gfxApplied = null;
function applyGfx() {
	const tier = gfxTier(), g = GFX[tier];
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, g.px) * gfx.scale);
	renderer.setSize(innerWidth, innerHeight);
	if (gfxApplied === tier) return;
	gfxApplied = tier;
	// shadow on/off or soft/hard changes the shaders: rebuild them once
	const rebuild = renderer.shadowMap.enabled !== g.shadows || (renderer.shadowMap.type === THREE.PCFSoftShadowMap) !== g.soft;
	renderer.shadowMap.enabled = g.shadows;
	renderer.shadowMap.type = g.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
	for (const l of [moon].concat(room.shadowLights || [])) {
		l.castShadow = g.shadows;
		if (l.shadow.mapSize.x !== g.map) {
			l.shadow.mapSize.set(g.map, g.map);
			if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
		}
	}
	if (rebuild) scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
	renderer.shadowMap.needsUpdate = true;
	renderGfxBtn();
}
addEventListener("resize", () => {
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, GFX[gfxTier()].px) * gfx.scale);
	renderer.setSize(innerWidth, innerHeight);
	cssRenderer.setSize(innerWidth, innerHeight);
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix();
});

// ============================================================ player
const me = {
	x: 0.8 + (Math.random() - 0.5) * 1.5, z: 1.6 + (Math.random() - 0.5) * 1.2, h: Math.PI,
	speed: 0, anim: "idle", upper: null, upperUntil: 0, sit: null, target: null, targetAct: null, stuck: 0,
	pu: 0.5, pv: 0.5, path: [], partner: null, holding: null, sips: 0,
	carrying: null, carriedBy: null   // bridal carry: who we're holding / who is holding us
};
const myAvatar = new Avatar(Object.assign({}, profile, { name: profile.name || "You" }));
myAvatar.setMood(profile.mood);
scene.add(myAvatar.root);
const cam = { yaw: 0.35, pitch: 0.38, dist: 4.2, tx: me.x, ty: 1.2, tz: me.z };
const RADIUS = 0.28;

function lookPayload() { return { g: profile.gender, s: profile.skin, hr: profile.hair, t: profile.top, b: profile.bottom, n: profile.name, pid: ME_PID }; }
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
function lookFromPayload(l) {
	const col = (c, d) => COLOR_RE.test(c) ? c : d;
	return { gender: l.g === "male" ? "male" : "female", skin: col(l.s, SKIN_TONES[1]), hair: col(l.hr, HAIR_COLORS[1]), top: col(l.t, OUTFIT_COLORS[0]), bottom: col(l.b, OUTFIT_COLORS[4]), name: String(l.n || "Guest").slice(0, 24), pid: String(l.pid || "").slice(0, 20) };
}

// ============================================================ shared state
const DEFAULTS = {
	lamp: true, mainLight: true, curtains: true, night: false, nightlamp: false,
	tv: { on: false, ch: 0, yt: "", at: 0, paused: false, pos: 0 },
	remote: { by: "", name: "" },
	fight: null,
	music: { on: false, track: 0, at: 0 },
	plant: { water: 1, at: 0 },
	coffee: { n: 0, at: 0 },
	cups: [],   // mugs people have set down on tables
	terraceDoor: true,
	notes: "",
	photo0: "", photo1: "", photo2: "",
	cap0: "", cap1: "", cap2: "",
	game: null, rps0: { gid: "", p: [] }, rps1: { gid: "", p: [] },
	drawClear: 0
};
const S = lsGet(LS_STATE, {});
// transient things never come back from a cached copy
delete S.remote; delete S.fight;
function get(k) { return S[k] ? S[k].v : (k in DEFAULTS ? DEFAULTS[k] : undefined); }
let saveTimer = 0;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { const c = Object.assign({}, S); delete c.remote; delete c.fight; lsSet(LS_STATE, c); }, 400); }
function setShared(k, v) {
	S[k] = { v, ts: Math.max(now(), S[k] ? S[k].ts + 1 : 0) };
	persist();
	send({ t: "set", k, v, ts: S[k].ts });
	applyKey(k, false);
	if (WORLD_SAVED.test(k)) { clearTimeout(worldSaveT[k]); worldSaveT[k] = setTimeout(() => saveWorldKey(k), k.indexOf("cap") === 0 ? 800 : 0); }
}
function receiveSet(k, v, ts) {
	if (typeof k !== "string" || k.length > 64) return;
	if (S[k] && S[k].ts >= ts) return;
	S[k] = { v, ts };
	persist();
	applyKey(k, true);
}

// ============================================================ networking
let sync = null, wasConnected = false;
const peers = new Map(); // id -> { avatar, look, x,z,h, tx,tz,th, anim, upper, sit, last, speed }
function send(obj) {
	if (!sync) return;
	obj.id = MY_ID;
	sync.broadcast("W3|" + JSON.stringify(obj));
}
function poseMsg() {
	return { t: "p", x: +me.x.toFixed(2), z: +me.z.toFixed(2), h: +me.h.toFixed(2), a: me.anim, u: me.upper, s: me.sit, sp: +me.speed.toFixed(2), pr: myAvatar.propKind, pu: +me.pu.toFixed(2), pv: +me.pv.toFixed(2), md: profile.mood, tg: me.partner, cb: me.carriedBy };
}
function startNetwork() {
	if (typeof RoomSync === "undefined" || !/^https?:$/.test(location.protocol)) {
		addLog("Offline: open this page from the Harmony server to share the world.", true);
		return;
	}
	const uri = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/relay";
	sync = new RoomSync({
		uri, channel: CHANNEL,
		getIdentity: () => ({ _id: MY_ID, name: profile.name }),
		onText: m => {
			const s = m && m.message;
			if (typeof s !== "string" || s.slice(0, 3) !== "W3|") return;
			let d;
			try { d = JSON.parse(s.slice(3)); } catch (e) { return; }
			if (d && typeof d.id === "string" && d.id !== MY_ID) onNet(d);
		}
	});
	sync.start();
	addEventListener("pagehide", () => send({ t: "bye" }));
}
function sendSnapshot() {
	// every key as its own frame keeps each one well under the relay's frame limit
	for (const k in S) send({ t: "set", k, v: S[k].v, ts: S[k].ts });
	const list = Object.values(strokes);
	let chunk = [], size = 0;
	for (const st of list) {
		const sz = st.p.length * 4 + 60;
		if (size + sz > 40000 && chunk.length) { send({ t: "strokes", list: chunk }); chunk = []; size = 0; }
		chunk.push(st); size += sz;
	}
	if (chunk.length) send({ t: "strokes", list: chunk });
}
let lastHelloAsk = 0;
function onNet(d) {
	const id = d.id;
	let p = peers.get(id);
	switch (d.t) {
		case "hello":
		case "hi":
			if (d.lk) p = upsertPeer(id, d.lk);
			if (d.pose && p) applyPose(p, d.pose, true);
			if (d.t === "hello") {
				send({ t: "hi", lk: lookPayload(), pose: poseMsg() });
				sendSnapshot();
				if (d.lk && !d.re) addLog(esc(lookFromPayload(d.lk).name) + " came into the room", true);
				if (audio) audio.sfx("door", 0.6);
			}
			break;
		case "look": if (d.lk) upsertPeer(id, d.lk); break;
		case "p":
			if (!p) { if (now() - lastHelloAsk > 3000) { lastHelloAsk = now(); send({ t: "hello", lk: lookPayload(), pose: poseMsg(), re: 1 }); } return; }
			applyPose(p, d, false);
			break;
		case "bye": if (p) { addLog(esc(p.look.name) + " left the room", true); removePeer(id); } break;
		case "set": receiveSet(d.k, d.v, +d.ts || 0); break;
		case "strokes": (d.list || []).forEach(st => mergeStroke(st)); redrawEasel(); break;
		case "seg": onSeg(d); break;
		case "chat":
			if (p) {
				const text = String(d.text).slice(0, 240);
				p.avatar.say(text);
				if (!d.auto) { chatMsg({ id: typeof d.mid === "string" ? d.mid : null, ts: now(), name: p.look.name, color: p.look.top, text }); if (audio) audio.sfx("pop", 0.5); }
			}
			break;
		case "fx": onFx(d, p); break;
		case "note": {
			const n = +d.n;
			if (audio) audio.pianoNote(n, 0.18);
			room.pressKey(n, false);
			if (p) noteHand(p.avatar, n);
			noteFx();
			break;
		}
		case "ball": ballState(d); break;
		case "tug": if (fightView && d.f === fightView.id) { fightView.other = Math.max(fightView.other, +d.n || 0); if (d.fin) fightView.gotFinal = true; } break;
		case "wake": if (d.to === MY_ID && me.anim === "sleep") { if (audio) audio.sfx("alarm"); document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 900); sitUpInBed(true); if (p && !me.sit) me.h = Math.atan2(p.x - me.x, p.z - me.z); doUpper("yawn", 2600); toast(`<b>${esc(p ? p.look.name : "Someone")}</b> woke you up!`, null, null, 5000); } break;
		case "act": onPartnerAct(d, p); break;
	}
	if (p) p.last = now();
}
function upsertPeer(id, lk) {
	let p = peers.get(id);
	const look = lookFromPayload(lk);
	if (!p) {
		const av = new Avatar(look);
		av.root.userData.peerId = id;
		scene.add(av.root);
		p = { avatar: av, look, x: 0, z: 2, h: 0, tx: 0, tz: 2, th: 0, anim: "idle", upper: null, sit: null, last: now(), speed: 0, fresh: true };
		peers.set(id, p);
	} else if (JSON.stringify(p.look) !== JSON.stringify(look)) {
		p.look = look;
		p.avatar.build(look);
	}
	refreshPeople();
	return p;
}
const BASE_ANIMS = ["idle", "sit", "sleep", "floor"];
const UPPER_ANIMS = ["wave", "dance", "clap", "heart", "drink", "paint", "write", "tug", "piano", "laugh", "cry", "kiss", "hug", "highfive", "jump", "bow", "cheer", "think", "shrug", "facepalm", "yawn", "warm", "telescope", "shake", "give", "stumble",
	"blush", "lovestruck", "heartarms", "wink", "propose", "cuddle", "smooch", "cheekkiss", "slowdance", "nightkiss", "carry", "carrykiss"];
const PROPS = ["mug", "brush", "remote", "flower", "ring"];
function applyPose(p, d, snap) {
	if (typeof d.x !== "number") return;
	p.tx = d.x; p.tz = d.z; p.th = d.h; p.sit = d.s || null;
	p.anim = BASE_ANIMS.includes(d.a) ? d.a : "idle";
	const prevUpper = p.upper;
	p.upper = UPPER_ANIMS.includes(d.u) ? d.u : (UPPER_ANIMS.includes(d.a) ? d.a : null);
	p.partner = typeof d.tg === "string" ? d.tg : null;
	p.carriedBy = typeof d.cb === "string" ? d.cb : null;
	if (d.md && MOODS.some(m => m.id === d.md) && d.md !== p.avatar.mood) { p.avatar.setMood(d.md); refreshPeople(); }
	if (!snap && !p.fresh && p.upper !== prevUpper) inviteFor(p);
	p.avatar.setProp(PROPS.includes(d.pr) ? d.pr : null);
	if (typeof d.pu === "number") p.avatar.paintUV = { u: d.pu, v: d.pv };
	if (snap || p.fresh) { p.x = p.tx; p.z = p.tz; p.h = p.th; p.fresh = false; }
}
function removePeer(id) {
	const p = peers.get(id);
	if (!p) return;
	scene.remove(p.avatar.root);
	p.avatar.dispose();
	peers.delete(id);
	refreshPeople();
	if (me.carrying === id) endCarry(true);
	if (me.carriedBy === id) hopDown(true);
	// they took the remote with them: put it back on the table
	if (get("remote").by === id) setShared("remote", { by: "", name: "" });
}
const moodImgs = {};
function moodImg(m) {
	if (!moodImgs[m]) { const c = document.createElement("canvas"); c.width = c.height = 40; drawMoodFace(c.getContext("2d"), 20, 20, 18, m); moodImgs[m] = c.toDataURL(); }
	return `<img class="mf" src="${moodImgs[m]}" alt="${m}" title="${(MOODS.find(x => x.id === m) || {}).label || ""}">`;
}
function refreshPeople() {
	const rows = [`<div>${moodImg(profile.mood)}${esc(profile.name || "You")} (you)</div>`];
	peers.forEach(p => rows.push(`<div>${moodImg(p.avatar.mood)}${esc(p.look.name)}${isAsleep(p) ? " <span class='zz'>sleeping</span>" : ""}</div>`));
	$("#ppl").innerHTML = rows.join("");
}

// ============================================================ apply shared keys to the world
function applyKey(k, remote) {
	const v = get(k);
	if (k === "lamp") { room.setLamp(!!v); if (audio && remote !== null) audio.sfx("switch"); }
	else if (k === "mainLight") { room.setMain(!!v); if (audio && remote !== null) audio.sfx("switch"); }
	else if (k === "nightlamp") { room.setNightLamp(!!v); if (audio && remote !== null) audio.sfx("switch"); }
	else if (k === "night") applyNight(remote);
	else if (k === "curtains") room.curtains.open = !!v;
	else if (k === "tv") applyTV(remote);
	else if (k === "remote") applyRemote(remote);
	else if (k === "fight") applyFight(remote);
	else if (k === "music") applyMusic(remote);
	else if (k === "plant") applyPlant();
	else if (k === "coffee") applyCoffee();
	else if (k === "cups") applyCups();
	else if (k === "terraceDoor") { room.setTerraceDoor(v); if (audio && remote !== null) audio.sfx("door", 0.5); }
	else if (k === "notes") { const ta = $("#notes-ta"); if (ta && remote) { const s = ta.selectionStart, e = ta.selectionEnd; ta.value = v || ""; if (document.activeElement === ta) ta.setSelectionRange(s, e); } }
	else if (/^photo\d$/.test(k)) { const i = +k[5]; room.photos[i].setImage(v || null); if (modalKind === "photos") openPhotos(); }
	else if (/^cap\d$/.test(k)) { if (modalKind === "photos" && remote) { const inp = document.querySelector(`[data-cap="${k[3]}"]`); if (inp && document.activeElement !== inp) inp.value = v || ""; } }
	else if (k === "game" || k === "rps0" || k === "rps1") applyGame(k, remote);
	else if (k === "drawClear") { for (const id in strokes) if (strokes[id].ts < v) delete strokes[id]; saveStrokes(); redrawEasel(); }
	else if (k.indexOf("letter:") === 0) onLetter(k, v, remote);
	else if (k.indexOf("opened:") === 0) onOpened(k, v, remote);
}
function applyAll() { Object.keys(Object.assign({}, DEFAULTS, S)).forEach(k => applyKey(k, null)); }

// ============================================================ chat log / notices / toasts
// Real chat goes in the scrollable chat history above the input (saved on the server, see
// /api/world). Everything else - cuddles, kisses, "X came in", tips - is a small notice at the top.
function addLog(html, sys) {
	if (sys) notice(html);
	else chatLine(html);
}
const NOTICE_MAX = 3;
function notice(html) {
	const box = $("#toasts");
	const el = document.createElement("div");
	el.className = "note";
	el.innerHTML = html;
	box.insertBefore(el, box.firstChild);
	const notes = box.querySelectorAll(".note");
	for (let i = NOTICE_MAX; i < notes.length; i++) notes[i].remove();
	setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 4500);
}
// Chat history lives on the server (every device sees it, it survives anything), and this device
// also keeps its own copy so a refresh shows everything instantly, even before the server answers.
// My own messages wait in a queue until the server confirms them, so none get lost offline.
const CHAT_MAX = 300;
const LS_CHAT = "harmonyWorldChat:" + ROOM_NAME, LS_CHATQ = "harmonyWorldChatQ:" + ROOM_NAME;
const validMsg = m => m && typeof m.id === "string" && typeof m.text === "string" && m.text;
let chatList = (lsGet(LS_CHAT, []) || []).filter(validMsg);       // {id, ts, name, color, text}, oldest first
let chatQueue = (lsGet(LS_CHATQ, []) || []).filter(validMsg);     // mine, not yet saved on the server
const chatIds = new Set(chatList.map(m => m.id));
let chatStoreT = 0;
function storeChat() { clearTimeout(chatStoreT); chatStoreT = setTimeout(() => lsSet(LS_CHAT, chatList.slice(-CHAT_MAX)), 300); }
function chatHtml(m) { return `<b style="color:${/^#[0-9a-f]{3,8}$/i.test(m.color || "") ? m.color : "#fff"}">${esc(m.name || "?")}</b> ${esc(m.text)}`; }
// a new live message: add it at the bottom
function chatMsg(m) {
	if (!m || !m.text) return;
	if (!m.id) m.id = "x" + now().toString(36) + Math.random().toString(36).slice(2, 6);
	if (chatIds.has(m.id)) return;
	chatIds.add(m.id);
	chatList.push(m);
	if (chatList.length > CHAT_MAX) chatList.splice(0, chatList.length - CHAT_MAX);
	storeChat();
	chatLine(chatHtml(m), new Date(m.ts || now()));
}
// messages from the server's history: fold in whatever this device didn't have, in time order
function mergeChat(list) {
	let added = false;
	(list || []).filter(validMsg).forEach(m => { if (!chatIds.has(m.id)) { chatIds.add(m.id); chatList.push(m); added = true; } });
	if (!added) return;
	chatList.sort((a, b) => (a.ts || 0) - (b.ts || 0));
	if (chatList.length > CHAT_MAX) chatList.splice(0, chatList.length - CHAT_MAX);
	storeChat();
	renderChat();
}
function renderChat() {
	const log = $("#log");
	log.innerHTML = "";
	chatList.forEach(m => chatLine(chatHtml(m), new Date(m.ts || now()), true));
	log.scrollTop = log.scrollHeight;
	log.classList.toggle("empty", !log.children.length);
}
function chatLine(html, t, bulk) {
	const log = $("#log");
	const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
	const el = document.createElement("div");
	el.className = "ln";
	el.innerHTML = html;
	el.title = (t || new Date()).toLocaleString();
	log.appendChild(el);
	if (bulk) return;
	while (log.children.length > CHAT_MAX) log.removeChild(log.firstChild);
	// stay pinned to the newest message unless you scrolled up to read older ones
	if (atBottom) log.scrollTop = log.scrollHeight;
	log.classList.remove("empty");
}
function newChatId() { return MY_ID + "-" + now().toString(36) + Math.random().toString(36).slice(2, 5); }
// save my chat line on the server (history for everyone + the /manage chat logs)
function saveChat(m) {
	chatQueue.push({ id: m.id, ts: m.ts, name: m.name, color: m.color, text: m.text });
	lsSet(LS_CHATQ, chatQueue.slice(-100));
	flushChat();
}
let chatFlushing = false, chatRetryT = 0;
function flushChat() {
	if (chatFlushing || !chatQueue.length || !/^https?:$/.test(location.protocol)) return;
	chatFlushing = true;
	const m = chatQueue[0];
	fetch("/api/world/chat", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
		body: JSON.stringify({ room: ROOM_NAME, id: m.id, name: m.name, color: m.color, text: m.text }) })
		.then(r => {
			chatFlushing = false;
			// saved (or rejected as empty: nothing to retry) -> next one; anything else -> try again soon
			if (r.ok || r.status === 400) { chatQueue.shift(); lsSet(LS_CHATQ, chatQueue); flushChat(); }
			else { clearTimeout(chatRetryT); chatRetryT = setTimeout(flushChat, 10000); }
		})
		.catch(() => { chatFlushing = false; clearTimeout(chatRetryT); chatRetryT = setTimeout(flushChat, 10000); });
}
// the wall photos + captions are saved on the server too, so they're there whenever anyone comes back
const WORLD_SAVED = /^(photo|cap)[0-2]$/;
const worldSaveT = {};
function saveWorldKey(k) {
	if (!WORLD_SAVED.test(k) || !S[k] || !/^https?:$/.test(location.protocol)) return;
	fetch("/api/world/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: ROOM_NAME, k, v: S[k].v, ts: S[k].ts }) }).catch(() => {});
}
// chat history + saved photos when you come in (keeps retrying until the server answers)
let worldLoaded = false, worldRetryT = 0;
function loadWorld() {
	renderChat();   // this device's copy right away
	fetchWorld();
}
function fetchWorld() {
	if (worldLoaded || !/^https?:$/.test(location.protocol)) return;
	const retry = () => { clearTimeout(worldRetryT); worldRetryT = setTimeout(fetchWorld, 10000); };
	fetch("/api/world?room=" + encodeURIComponent(ROOM_NAME), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
		if (!j || !j.ok) { retry(); return; }
		worldLoaded = true;
		mergeChat(j.chat);
		flushChat();   // anything I sent while the server was away
		const st = j.state || {};
		Object.keys(st).forEach(k => {
			if (!WORLD_SAVED.test(k) || !st[k]) return;
			const mine = S[k];
			if (mine && mine.ts > st[k].ts) saveWorldKey(k);   // this device has something newer: put it on the server
			else receiveSet(k, st[k].v, +st[k].ts || 0);
		});
	}).catch(retry);
}
function toast(text, action, onAction, ms = 7000) {
	const el = document.createElement("div");
	el.className = "toast chip";
	el.innerHTML = `<span>${text}</span>`;
	if (action) {
		const b = document.createElement("button");
		b.className = "btn primary"; b.textContent = action;
		b.onclick = () => { onAction(); close(); };
		el.appendChild(b);
	}
	const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
	$("#toasts").appendChild(el);
	setTimeout(close, ms);
	if (audio) audio.sfx("chime", 0.5);
}

// ============================================================ modal
let modalKind = null, modalOnClose = null;
function openModal(kind, title, html, width, onClose) {
	if (modalKind && modalKind !== kind && modalOnClose) modalOnClose();
	modalKind = kind; modalOnClose = onClose || null;
	$("#mtitle").textContent = title;
	$("#mbody").innerHTML = html;
	$("#modal .win").style.setProperty("--w", (width || 560) + "px");
	$("#modal").classList.remove("hidden");
	if (audio) audio.sfx("page", 0.6);
	return $("#mbody");
}
function closeModal() {
	if (!modalKind) return;
	if (modalOnClose) modalOnClose();
	modalKind = null; modalOnClose = null;
	$("#modal").classList.add("hidden");
	$("#mbody").innerHTML = "";
	canvas.focus();
}
$("#mclose").onclick = closeModal;
$("#modal").addEventListener("pointerdown", e => { if (e.target.id === "modal") closeModal(); });

// ============================================================ interactions
function interact(id) {
	if (!room.interactables[id]) return;
	const def = room.interactables[id];
	// carrying someone: the bed / sofa is where you lay them down to cuddle
	if (me.carrying && CARRY_FURNITURE[id]) { carryToCuddle(id); return; }
	if (def.face !== undefined && !def.sit && !me.sit) me.h = def.face;
	switch (id) {
		case "tv": case "remote": useRemote(); break;
		case "piano": { const who = whoSits("bench"); if (who) busy(who, "Can I play after you, {n}?", "{n} is playing the piano - let {pr} finish first"); else startPiano(); break; }
		case "telescope": { const who = whoDoes("telescope"); if (who) busy(who, "My turn next, {n}!", "{n} is looking at the stars - wait for {pr} to finish"); else startScope(); break; }
		case "fire": me.h = def.face; doUpper("warm", 7000); if (audio) audio.sfx("whoosh", 0.3); break;
		case "flowers": pickFlower(); break;
		case "bed": sitOnBed(); break;
		case "notes": openNotes(); break;
		case "lamp": setShared("lamp", !get("lamp")); break;
		case "nightlamp": setShared("nightlamp", !get("nightlamp")); break;
		case "switch": setShared("mainLight", !get("mainLight")); break;
		case "curtains": setShared("curtains", !get("curtains")); if (audio) audio.sfx("whoosh", 0.5); break;
		case "plant": waterPlant(); break;
		case "records": openMusic(); break;
		case "arcade": openArcade(); break;
		case "door": leaveToPiano(); break;
		case "desk": sitAtDesk(); break;
		case "photos": openPhotos(); break;
		case "coffee": if (coffeeReady()) takeCoffee(); else makeCoffee(); break;
		case "terraceDoor": setShared("terraceDoor", !get("terraceDoor")); break;
		case "easel": openDraw(); break;
		default:
			// armchair taken? curl up on their lap instead
			if (id === "armchair" && !freeSpot(def.sit) && whoSits("armchair") && freeSpot(["armchairLap"])) { if (sitOn(["armchairLap"])) setTimeout(() => { if (me.upper !== "cuddle") loveAct("cuddle"); }, 400); }
			else if (def.sit) sitOn(def.sit);
	}
}
// someone else is already using it: say so instead of barging in
function whoSits(spotId) { for (const [id, p] of peers) if (p.sit === spotId) return p; return null; }
function whoDoes(upper) { for (const [id, p] of peers) if (p.upper === upper) return p; return null; }
function busy(p, line, log) {
	const pr = p.look.gender === "female" ? "her" : "him";
	const say = line.replace("{n}", p.look.name);
	myAvatar.say(say);
	send({ t: "chat", text: say, auto: 1 });
	addLog(esc(log.replace("{n}", p.look.name).replace("{pr}", pr)), true);
	if (audio) audio.sfx("pop", 0.4);
}
// start a timed action (arms layer)
function doUpper(u, ms, partner) {
	if (me.carrying && u !== "carry" && u !== "carrykiss") endCarry();
	me.resume = me.upper === "cuddle" && me.partner && (u === "smooch" || u === "cheekkiss") && partner === me.partner ? me.partner : null;
	if (me.anim === "sleep" && !IN_BED_OK.includes(u)) sitUpInBed(true);
	me.upper = u;
	me.upperUntil = performance.now() + ms;
	me.partner = partner || null;
	updateProps();
	sendPose(true);
}
function labelOf(id) {
	if (me.carrying && CARRY_FURNITURE[id] && peers.get(me.carrying)) return "Lie down with " + peers.get(me.carrying).look.name + " and cuddle";
	if (id === "coffee") return coffeeReady() ? "Pick up the coffee" : room.coffee.brewing > 0 ? "Brewing..." : "Make coffee";
	if (id === "tv" || id === "remote") {
		const r = get("remote");
		if (r.by === MY_ID) return "Use the TV remote";
		if (r.by) return "Fight " + (r.name || "them") + " for the remote!";
		return "Pick up the TV remote";
	}
	if (id === "bed") return freeSpot(room.interactables.bed.sit) ? "Sit on the bed" : "The bed is full";
	if (id === "piano" && whoSits("bench")) return whoSits("bench").look.name + " is playing - wait your turn";
	if (id === "telescope" && whoDoes("telescope")) return whoDoes("telescope").look.name + " is stargazing";
	if (id === "terraceDoor") return get("terraceDoor") ? "Close the terrace door" : "Open the terrace door";
	if (id === "flowers") return me.holding === "flower" ? "Pick another flower" : "Pick a flower";
	if (id === "armchair" && whoSits("armchair") && me.sit !== "armchair") return "Sit on " + whoSits("armchair").look.name + "'s lap";
	const l = room.interactables[id].label;
	return typeof l === "function" ? l() : l;
}
function leaveToPiano() {
	send({ t: "bye" });
	if (audio) audio.sfx("door");
	setTimeout(() => { location.href = "./?c=" + encodeURIComponent(ROOM_NAME); }, 150);
}
// center of an interactable (for "can I reach it from my seat?")
function defCenter(def) {
	if (!def._c) {
		const b = new THREE.Box3();
		def.objects.forEach(o => b.expandByObject(o));
		def._c = b.getCenter(new THREE.Vector3());
	}
	return def._c;
}
const REACH = { remote: 2.3, notes: 2.3, tv: 7, lamp: 2.2, nightlamp: 2.2, records: 2.0 };
// the TV can only be worked from a seat that actually faces it
const TV_SEATS = ["sofa0", "sofa1", "sofa2", "armchair", "armchairLap"];
function canReach(id) {
	const r = REACH[id];
	if (!r) return false;
	if (id === "tv" && !(me.sit && TV_SEATS.includes(me.sit))) return false;
	const c = defCenter(room.interactables[id]);
	// never through a wall: the terrace and the room are separate
	if (areaOf(c.x, c.z) !== areaOf(me.x, me.z)) return false;
	return Math.hypot(c.x - me.x, c.z - me.z) < r;
}

// ---------- sitting / lying down / standing up
function spotById(id) { return room.sitSpots.find(s => s.id === id) || null; }
// seats other people use (plus the ones their body covers, e.g. the foot of the bed under someone's legs)
function takenSpots() {
	const taken = new Set();
	peers.forEach(p => {
		if (!p.sit) return;
		taken.add(p.sit);
		const s = spotById(p.sit);
		if (s && s.excl) s.excl.forEach(x => taken.add(x));
	});
	return taken;
}
function freeSpot(ids) {
	const taken = takenSpots();
	const spots = ids.map(spotById).filter(Boolean);
	spots.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
	return spots.find(s => !taken.has(s.id) || s.id === me.sit) || null;
}
function sitOn(ids) {
	const spot = freeSpot(ids);
	if (!spot) { addLog("That seat is taken.", true); return null; }
	if (me.carrying) endCarry();
	if (me.carriedBy) hopDown();
	if (me.sit && me.sit !== spot.id) standUp(true);
	me.sit = spot.id; me.anim = spot.lie ? "sleep" : "sit";
	if (me.upper !== "drink") me.upper = null;
	me.x = spot.x; me.z = spot.z; me.h = spot.h;
	me.target = null;
	// look over your shoulder from behind the seat
	// (lying down: the body runs toward spot.h, so watch from the foot of the bed)
	cam.yaw = spot.lie || spot.bedsit ? spot.h : spot.h + Math.PI; cam.pitch = spot.lie ? 0.75 : spot.bedsit ? 0.5 : 0.42; cam.dist = spot.lie ? 3.0 : 2.6;
	sendPose(true);
	const nb = spot.id !== "bench" && seatNeighbor();
	if (!nb && TV_SEATS.includes(spot.id) && get("tv").on) toast("Watch through your own eyes, with nothing in the way", "TV mode", enterTV, 7000);
	if (nb) {
		const q = peers.get(nb);
		if (isAsleep(q) && !spot.lie) toast(`<b>${esc(q.look.name)}</b> is fast asleep next to you`, "Goodnight kiss", () => goodnightKiss(nb), 9000);
		else toast(spot.lap ? `You're sitting on <b>${esc(q.look.name)}</b>'s lap` : `<b>${esc(q.look.name)}</b> is right next to you`, spot.lie ? "Snuggle" : "Cuddle up", () => { if (me.upper !== "cuddle") loveAct("cuddle"); }, 9000);
	}
	return spot;
}
function standUp(quiet) {
	exitTV();
	if (me.upper === "write") { me.upper = null; me.upperUntil = 0; updateProps(); }
	const spot = room.sitSpots.find(s => s.id === me.sit);
	const wasSleeping = me.anim === "sleep";
	me.sit = null; me.anim = "idle";
	if (me.upper === "piano") me.upper = null;
	if (SEATED_LOVE.includes(me.upper)) { me.upper = null; me.partner = null; me.upperUntil = 0; }
	if (spot) {
		// find the closest open floor next to the seat (in front first, then the sides, then behind)
		const p = freeFloorNear(spot.x, spot.z, spot.lie ? spot.h + Math.PI : spot.h);
		me.x = p.x; me.z = p.z;
	}
	cam.dist = 4.2; cam.pitch = 0.38;
	$("#pianobar").classList.add("hidden");
	if (wasSleeping) { $("#sleepov").classList.add("hidden"); if (!quiet && audio) audio.sfx("yawn"); }
	sendPose(true);
}
function freeFloorNear(x, z, h) {
	const dirs = [0, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI, 3 * Math.PI / 4, -3 * Math.PI / 4];
	for (let r = 0.6; r <= 3; r += 0.15) for (const d of dirs) {
		const a = h + d, nx = x + Math.sin(a) * r, nz = z + Math.cos(a) * r;
		if (!blocked(nx, nz, true)) return { x: nx, z: nz };
	}
	return { x: 0.5, z: 1.5 };
}

// ---------- the bed: sit on it, lie down, sit up, wake / kiss whoever is asleep
const onBed = () => { const s = spotById(me.sit); return !!(s && s.bed); };
function sitOnBed() {
	if (!freeSpot(room.interactables.bed.sit)) { addLog("There's no room left on the bed.", true); return; }
	sitOn(room.interactables.bed.sit);
}
function goToBed() {
	const spot = freeSpot(room.interactables.bed.lie);
	if (!spot) { addLog("Both sides of the bed are taken.", true); return; }
	closeRemote(); closeDraw();
	sitOn([spot.id]);
	$("#sleepov").classList.remove("hidden");
	if (audio) audio.sfx("yawn");
	addLog("You curled up in bed. Sweet dreams.", true);
	send({ t: "fx", kind: "sys", text: profile.name + " went to sleep" });
}
// lying down -> sit up right there on the bed (falls back to standing if the bed is full)
function sitUpInBed(quiet) {
	const cur = spotById(me.sit);
	if (!cur || !cur.lie) return;
	// lying on the sofa: "sitting up" just means getting up off it (never jumping into the bed)
	if (!cur.bed) { standUp(quiet); return; }
	// sit up right where you are lying (the other side if that's somehow taken)
	const mine = cur.id === "bedL" ? "bedSitL" : "bedSitR";
	const taken = takenSpots();
	const next = [mine].concat(room.interactables.bed.sit).find(id => !taken.has(id));
	if (!next) { standUp(quiet); return; }
	sitOn([next]);
	if (!quiet && audio) audio.sfx("yawn");
}
// lying down isn't the same as asleep: cuddling / kissing in bed, or lying on the sofa, you're wide awake
function isAsleep(o) {
	if (!o || o.anim !== "sleep" || COUPLE_POSES.includes(o.upper)) return false;
	const s = o.sit && spotById(o.sit);
	return !(s && s.sofaLie);
}
function sleepingPeers() { const out = []; peers.forEach((p, id) => { if (isAsleep(p)) out.push(id); }); return out; }
function nearestSleeper() {
	let best = null, bd = 1e9;
	peers.forEach((p, id) => { if (!isAsleep(p)) return; const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < bd) { bd = d; best = id; } });
	return best;
}
// get into bed on the other side of a sleeper (sitting up), then run fn
function sitBeside(id, fn) {
	const p = peers.get(id);
	if (!p || !isAsleep(p)) return;
	// already in bed right next to them (sitting up or lying down): just lean over
	if (me.sit && onBed() && seatDist(me, p) < NEAR_SEAT) { fn(); return; }
	const taken = takenSpots();
	const spot = room.sitSpots.find(s => s.bedsit && !taken.has(s.id) && s.excl.indexOf(p.sit) < 0 && s.id !== { bedL: "bedSitL", bedR: "bedSitR" }[p.sit]);
	if (!spot) {
		// no room in the bed: lean over from the floor instead
		const side = p.sit === "bedR" ? [-1.95, 4.95] : [-4.45, 4.95];
		walkTo(side[0], side[1], () => { const q = peers.get(id); if (!q) return; me.h = Math.atan2(q.x - me.x, (q.z + 0.9) - me.z); fn(); });
		return;
	}
	const go = () => { if (sitOn([spot.id])) setTimeout(fn, 450); };
	const st = spot.stand || room.interactables.bed.stand;
	if (Math.hypot(st[0] - me.x, st[1] - me.z) < 0.6 || (me.sit && onBed())) go(); else walkTo(st[0], st[1], go);
}
// lean over and gently shake them awake, from your side of the bed
function wakePeer(id) {
	sitBeside(id, () => {
		const q = peers.get(id);
		if (!q || !isAsleep(q)) return;
		doUpper("shake", 2400, id);
		myAvatar.say("Wake up, sleepyhead!");
		send({ t: "chat", text: "Wake up, sleepyhead!", auto: 1 });
		setTimeout(() => { send({ t: "wake", to: id }); if (audio) audio.sfx("alarm", 0.35); addLog("You woke up " + esc(q.look.name), true); }, 1500);
	});
}
// lean over and kiss someone who's asleep on the cheek (they stay asleep)
function goodnightKiss(id) {
	id = id || nearestSleeper();
	if (!id) { myAvatar.say("Nobody's asleep yet..."); return; }
	sitBeside(id, () => {
		const q = peers.get(id);
		if (!q) return;
		doUpper("nightkiss", 2600, id);
		send({ t: "act", kind: "goodnight", to: id });
		setTimeout(() => { heartsFx(myAvatar.root, 4, null, 1.0); if (audio) audio.sfx("smack", 0.6); }, 900);
		addLog("You kissed " + esc(q.look.name) + " goodnight", true);
	});
}
function wakeNearest() {
	const id = nearestSleeper();
	if (!id) { myAvatar.say("Everyone's already awake!"); return; }
	wakePeer(id);
}

// ---------- night mode
function applyNight(remote) {
	const night = !!get("night");
	hemi.intensity = night ? 0.13 : 0.55;
	moon.intensity = night ? 2.5 : 1.8;
	scene.environmentIntensity = night ? 0.07 : 0.3;
	renderer.toneMappingExposure = night ? 0.98 : 1.05;
	room.setFairy(night ? 2.3 : 1);
	document.body.classList.toggle("night", night);
	$("#b-night").classList.toggle("on", night);
	if (remote) addLog(night ? "Someone switched the room to night mode" : "Good morning! The lights are back on", true);
}
function toggleNight() {
	const night = !get("night");
	setShared("night", night);
	setShared("mainLight", !night);
	setShared("lamp", !night);
	setShared("nightlamp", night);
	if (!night && !get("curtains")) setShared("curtains", true);
}
$("#b-night").onclick = toggleNight;

// ---------- piano (play on the real 3D keys, no popup)
const KEYMAP_HI = "awsedftgyhujkolp;'";   // 60..77
const KEYMAP_LO = "zsxdcvgbhnjm";          // 48..59
function startPiano() {
	const spot = sitOn(["bench"]);
	if (!spot) return;
	me.upper = "piano";
	cam.yaw = Math.PI; cam.pitch = 0.55; cam.dist = 1.7;
	$("#pianobar").classList.remove("hidden");
	sendPose(true);
}
function playKey(n) {
	if (audio) audio.pianoNote(n, 0.25);
	send({ t: "note", n });
	room.pressKey(n, true);
	noteHand(myAvatar, n);
	noteFx();
}
// which hand plays it: low notes left, high notes right
function noteHand(av, n) {
	const i = n < 62 ? 1 : 0;
	av._pn = av._pn || [69, 53]; av._pt = av._pt || [0, 0];
	av._pn[i] = n; av._pt[i] = performance.now();
	av.pianoHit(i);
}
$("#pianostand").onclick = () => standUp();

// ---------- TV + remote
const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;
const HOLE = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false });
const tvScreenMat = room.tv.screen.material;
let yt = null; // { id, obj, iframe }
let lastYt = "";
function ytCmd(func, args) {
	if (!yt || !yt.iframe.contentWindow) return;
	try { yt.iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: args || [] }), "*"); } catch (e) {}
}
function tvElapsed(tv) { return tv.paused ? (tv.pos || 0) : Math.max(0, (now() - tv.at) / 1000); }
function mountYouTube(tv) {
	if (yt && yt.id === tv.yt) return;
	unmountYouTube();
	const iframe = document.createElement("iframe");
	iframe.width = "960"; iframe.height = "537";
	iframe.style.cssText = "width:960px;height:537px;border:0;background:#000";
	iframe.allow = "autoplay; encrypted-media; picture-in-picture";
	const start = Math.floor(tvElapsed(tv));
	iframe.src = `https://www.youtube.com/embed/${tv.yt}?enablejsapi=1&autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&start=${start}&origin=${encodeURIComponent(location.origin)}`;
	const obj = new CSS3DObject(iframe);
	scene.updateMatrixWorld();
	room.tv.screen.getWorldPosition(obj.position);
	room.tv.screen.getWorldQuaternion(obj.quaternion);
	obj.scale.setScalar(1.86 / 960);
	cssScene.add(obj);
	room.tv.screen.material = HOLE;
	yt = { id: tv.yt, obj, iframe };
	iframe.addEventListener("load", () => {
		try { iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*"); } catch (e) {}
		setTimeout(() => syncYouTube(true), 800);
		setTimeout(() => syncYouTube(true), 2500);
	});
}
function unmountYouTube() {
	if (!yt) return;
	cssScene.remove(yt.obj);
	yt.iframe.src = "about:blank";
	yt.obj.element.remove();
	yt = null;
	room.tv.screen.material = tvScreenMat;
}
function syncYouTube(hard) {
	const tv = get("tv");
	if (!yt) return;
	ytCmd("unMute");
	if (tv.paused) { ytCmd("seekTo", [tv.pos || 0, true]); ytCmd("pauseVideo"); }
	else { if (hard) ytCmd("seekTo", [tvElapsed(tv), true]); ytCmd("playVideo"); }
}
function applyTV(remote) {
	const tv = get("tv");
	room.tv.light.intensity = tv.on ? 2.2 : 0;
	if (tv.on && tv.yt && entered) { const fresh = !yt || yt.id !== tv.yt; mountYouTube(tv); if (!fresh) syncYouTube(true); }
	else unmountYouTube();
	if (!tv.on) room.tv.off();
	if (remote && tv.on && tv.yt && tv.yt !== lastYt && entered) {
		toast("A video just started on the TV", "Go watch", () => walkTo(room.interactables.sofa.stand[0], room.interactables.sofa.stand[1], "sofa"), 12000);
	}
	lastYt = tv.on ? tv.yt : "";
	renderRemote();
}
function drawTVFrame(t) {
	const tv = get("tv");
	if (!tv.on || tv.yt) return;
	room.tv.draw(tv.ch, t, null);
	room.tv.light.color.setHSL((t * 0.05) % 1, 0.5, 0.6);
}
function useRemote() {
	const r = get("remote");
	if (r.by === MY_ID) { openRemote(); return; }
	if (r.by && peers.has(r.by)) { startFight(); return; }
	setShared("remote", { by: MY_ID, name: profile.name });
	if (audio) audio.sfx("pop");
	addLog("You picked up the TV remote", true);
	send({ t: "fx", kind: "sys", text: profile.name + " grabbed the TV remote" });
	openRemote();
}
function applyRemote(remote) {
	const r = get("remote");
	const someone = r.by && (r.by === MY_ID || peers.has(r.by));
	room.remote.mesh.visible = !someone;
	updateProps();
	if (r.by !== MY_ID) closeRemote();
	renderRemote();
	if (remote && r.by === MY_ID) toast("You have the TV remote now", "Use it", openRemote, 5000);
}
let remoteOpen = false;
function openRemote() { remoteOpen = true; $("#remotepanel").classList.remove("hidden"); renderRemote(); }
function closeRemote() { remoteOpen = false; $("#remotepanel").classList.add("hidden"); }
function renderRemote() {
	if (!remoteOpen) return;
	const tv = get("tv");
	const ch = room.tv.channels;
	$("#rm-ch").textContent = !tv.on ? "TV is off" : tv.yt ? (tv.paused ? "YouTube (paused)" : "YouTube") : ch[tv.ch];
	$("#rm-pow").classList.toggle("on", !!tv.on);
	$("#rm-pause").textContent = tv.paused ? "Play" : "Pause";
	$("#rm-pause").disabled = !(tv.on && tv.yt);
}
function tvSet(patch) { setShared("tv", Object.assign({}, get("tv"), patch)); if (audio) audio.sfx("click"); }
$("#rm-pow").onclick = () => { const tv = get("tv"); tvSet({ on: !tv.on, paused: false, at: now() - tvElapsed(tv) * 1000 }); };
$("#rm-up").onclick = () => { const tv = get("tv"); tvSet({ on: true, yt: "", ch: (tv.yt ? tv.ch : tv.ch + 1) % room.tv.channels.length }); };
$("#rm-down").onclick = () => { const tv = get("tv"); const n = room.tv.channels.length; tvSet({ on: true, yt: "", ch: ((tv.yt ? tv.ch : tv.ch - 1) + n) % n }); };
$("#rm-pause").onclick = () => {
	const tv = get("tv");
	if (!tv.yt) return;
	if (tv.paused) tvSet({ paused: false, at: now() - (tv.pos || 0) * 1000 });
	else tvSet({ paused: true, pos: tvElapsed(tv) });
};
const ytGo = () => {
	const inp = $("#rm-url");
	const m = YT_RE.exec(inp.value.trim());
	if (!m) { inp.classList.add("bad"); setTimeout(() => inp.classList.remove("bad"), 900); return; }
	tvSet({ on: true, yt: m[1], at: now(), paused: false, pos: 0 });
	inp.value = "";
	send({ t: "fx", kind: "sys", text: profile.name + " put a video on the TV" });
	addLog("You put a video on the TV", true);
};
$("#rm-play").onclick = ytGo;
$("#rm-url").addEventListener("keydown", e => { if (e.key === "Enter") ytGo(); });
$("#rm-drop").onclick = () => { setShared("remote", { by: "", name: "" }); addLog("You put the remote back on the coffee table", true); };
$("#rm-close").onclick = closeRemote;

// ---------- fight for the remote (button-mashing tug of war)
let fightView = null; // { id, a, b, an, bn, start, end, mine, other, decided }
function startFight() {
	const r = get("remote");
	const f = get("fight");
	if (f && now() < f.end + 1500) return;
	const holder = peers.get(r.by);
	if (!holder) return;
	// walk right up to them first, then grab the other end of the remote
	const dx = me.x - holder.x, dz = me.z - holder.z, l = Math.hypot(dx, dz) || 1;
	const go = () => {
		const h2 = peers.get(r.by);
		if (!h2 || get("remote").by !== r.by) return;
		myAvatar.say("Give me that remote!");
		send({ t: "chat", text: "Give me that remote!", auto: 1 });
		setShared("fight", { id: Math.random().toString(36).slice(2, 8), a: r.by, an: r.name, b: MY_ID, bn: profile.name, start: now() + 2600, end: now() + 2600 + 6000 });
	};
	if (l < 1.1) go(); else walkTo(holder.x + dx / l * 0.8, holder.z + dz / l * 0.8, go);
}
function applyFight() {
	const f = get("fight");
	if (!f) { fightView = null; $("#fight").classList.add("hidden"); fightRemote.visible = false; if (me.upper === "tug") { me.upper = null; me.partner = null; updateProps(); sendPose(true); } return; }
	if (fightView && fightView.id === f.id) return;
	fightView = Object.assign({ mine: 0, other: 0, decided: false, lastSent: 0, lastCount: 9, k: 0.5, gotFinal: false, sentFinal: false }, f);
	const inFight = f.a === MY_ID || f.b === MY_ID;
	$("#fight").classList.remove("hidden");
	$("#fight").classList.toggle("spectate", !inFight);
	$("#f-a").textContent = f.an || "Holder";
	$("#f-b").textContent = f.bn || "Challenger";
	if (inFight) {
		if (me.sit) standUp(true);
		if (drawOpen) closeDraw();
		closeRemote();
		me.upper = "tug";
		me.partner = f.a === MY_ID ? f.b : f.a;
		me.target = null; me.path = [];
		updateProps();
		const opp = peers.get(f.a === MY_ID ? f.b : f.a);
		if (opp) me.h = Math.atan2(opp.x - me.x, opp.z - me.z);
		sendPose(true);
		if (f.a === MY_ID) addLog(esc(f.bn) + " is trying to steal the remote!", true);
	}
}
function tugTap() {
	const f = fightView;
	if (!f || now() < f.start || now() > f.end) return;
	if (f.a !== MY_ID && f.b !== MY_ID) return;
	f.mine++;
	if (now() - f.lastSent > 90) { f.lastSent = now(); send({ t: "tug", f: f.id, n: f.mine }); }
	if (audio) audio.sfx("tug", 0.5);
	const el = $("#fight");
	el.classList.remove("tap"); void el.offsetWidth; el.classList.add("tap");
}
$("#fight").addEventListener("pointerdown", e => { e.preventDefault(); tugTap(); });
function updateFight() {
	const f = fightView;
	if (!f) return;
	const t = now();
	const inFight = f.a === MY_ID || f.b === MY_ID;
	const aScore = f.a === MY_ID ? f.mine : f.other, bScore = f.b === MY_ID ? f.mine : f.other;
	// bar: 0 = holder winning fully, 1 = challenger
	const k = (bScore + 5) / (aScore + bScore + 10);
	f.k += (k - f.k) * 0.2;
	$("#f-bar i").style.left = (k * 100) + "%";
	$("#f-sa").textContent = inFight || t > f.end ? aScore : "";
	$("#f-sb").textContent = inFight || t > f.end ? bScore : "";
	let msg;
	if (t < f.start) {
		const c = Math.ceil((f.start - t) / 800);
		msg = String(Math.min(3, c));
		if (c !== f.lastCount && c <= 3) { f.lastCount = c; if (audio) audio.sfx("count"); }
	} else if (t <= f.end) {
		if (f.lastCount !== 0) { f.lastCount = 0; if (audio) audio.sfx("go"); }
		msg = (inFight ? "MASH SPACE / TAP!  " : "Fight for the remote!  ") + Math.ceil((f.end - t) / 1000) + "s";
	} else msg = "Time!";
	$("#f-msg").textContent = msg;
	if (inFight && t - f.lastSent > 120 && t < f.end) { f.lastSent = t; send({ t: "tug", f: f.id, n: f.mine }); }
	if (inFight && t > f.end && !f.sentFinal) { f.sentFinal = true; send({ t: "tug", f: f.id, n: f.mine, fin: 1 }); }
	// the holder's client decides once it has the challenger's final count (or after a timeout);
	// the challenger decides only if the holder vanished
	const ready = f.a === MY_ID ? (f.gotFinal && t > f.end + 300) || t > f.end + 3000 : f.b === MY_ID ? t > f.end + 6000 : false;
	if (!f.decided && ready) {
		f.decided = true;
		const winB = bScore > aScore;
		const winId = winB ? f.b : f.a, winName = winB ? f.bn : f.an;
		setShared("remote", { by: winId, name: winName });
		setShared("fight", null);
		send({ t: "fx", kind: "fightend", w: winName, wid: winId, a: f.a, b: f.b, sa: aScore, sb: bScore });
		fightResult(winName, aScore, bScore, winId, f.a, f.b);
	}
}
function fightResult(winName, sa, sb, wid, a, b) {
	toast(`<b>${esc(winName)}</b> won the remote! (${sa} : ${sb})`, null, null, 5000);
	if (audio) audio.sfx(wid === MY_ID ? "win" : "chime");
	if (wid === MY_ID) { heartsFx(myAvatar.root, 6, "#ffd34f"); setTimeout(() => doUpper("cheer", 2400), 50); }
	else if (a === MY_ID || b === MY_ID) setTimeout(() => { doUpper("stumble", 1300); myAvatar.say("Hey! Not fair!"); }, 50);
}
// the remote both people pull on during a fight (lives between their hands)
const fightRemote = new THREE.Group();
{
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.18), new THREE.MeshStandardMaterial({ color: "#1d1d22", roughness: 0.45 }));
	body.castShadow = true;
	const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), new THREE.MeshStandardMaterial({ color: "#e63946", emissive: "#e63946", emissiveIntensity: 0.5 }));
	btn.position.set(0, 0.013, -0.06);
	fightRemote.add(body, btn);
	fightRemote.visible = false;
	scene.add(fightRemote);
}
function avatarOf(id) { return id === MY_ID ? myAvatar : (peers.get(id) || {}).avatar; }
function updateFightRemote(t) {
	const f = fightView;
	if (!f) { fightRemote.visible = false; return; }
	const A = avatarOf(f.a), B = avatarOf(f.b);
	if (!A || !B) { fightRemote.visible = false; return; }
	const pa = A.root.position, pb = B.root.position;
	const pull = Math.max(0.15, Math.min(0.85, 0.5 + (f.k - 0.5) * 0.9));
	const wob = now() > f.start && now() < f.end ? Math.sin(t * 22) * 0.025 : 0;
	fightRemote.position.set(pa.x + (pb.x - pa.x) * pull, 1.02 + wob, pa.z + (pb.z - pa.z) * pull);
	fightRemote.rotation.set(0, Math.atan2(pb.x - pa.x, pb.z - pa.z), wob * 4);
	fightRemote.visible = true;
}

// ---------- music
function applyMusic(remote) {
	const m = get("music");
	room.record.playing = !!m.on;
	if (audio) { if (m.on) audio.startMusic(m.track, m.at); else audio.stopMusic(); }
	if (remote && m.on) addLog("The record player is playing " + esc(TRACKS[m.track % TRACKS.length].name), true);
	if (modalKind === "music") openMusic();
}
function openMusic() {
	const m = get("music");
	const cols = ["#d1495b", "#3d7ea6", "#e9c46a"];
	const html = `<div class="tracks">${TRACKS.map((t, i) => `<div class="track ${m.on && m.track === i ? "on" : ""}" data-t="${i}"><div class="disc" style="--c:${cols[i]}"></div><div><b>${t.name}</b><span>${t.bpm} bpm · plays for everyone</span></div>${m.on && m.track === i ? '<div class="eq"><i></i><i></i><i></i></div>' : ""}</div>`).join("")}</div>
		<div class="row" style="margin-top:14px;justify-content:space-between"><span class="muted">Music gets louder the closer you are to the speakers.</span>${m.on ? '<button class="btn" id="mstop">Stop</button>' : ""}</div>`;
	const body = openModal("music", "Record Player", html, 480);
	body.querySelectorAll("[data-t]").forEach(el => el.onclick = () => setShared("music", { on: true, track: +el.dataset.t, at: now() }));
	const st = body.querySelector("#mstop");
	if (st) st.onclick = () => setShared("music", { on: false, track: m.track, at: 0 });
}

// ---------- notes
let notesTimer = 0;
function openNotes() {
	const body = openModal("notes", "Our Notebook", `<textarea class="notebook" id="notes-ta" placeholder="Write anything here - plans, lists, little thoughts. It saves for both of you."></textarea><div class="muted" style="margin-top:8px">Changes appear live for everyone in the room.</div>`, 620);
	const ta = body.querySelector("#notes-ta");
	ta.value = get("notes") || "";
	ta.oninput = () => { clearTimeout(notesTimer); notesTimer = setTimeout(() => setShared("notes", ta.value.slice(0, 20000)), 300); };
	setTimeout(() => ta.focus(), 50);
}

// ---------- photos
function compressImage(file, maxChars) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			let size = 560, q = 0.8, out = "";
			for (let tries = 0; tries < 10; tries++) {
				const sc = Math.min(1, size / Math.max(img.width, img.height));
				const c = document.createElement("canvas");
				c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
				c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
				out = c.toDataURL("image/jpeg", q);
				if (out.length <= maxChars) break;
				if (q > 0.5) q -= 0.1; else size *= 0.8;
			}
			URL.revokeObjectURL(img.src);
			out.length <= maxChars ? resolve(out) : reject(new Error("too big"));
		};
		img.onerror = () => reject(new Error("not an image"));
		img.src = URL.createObjectURL(file);
	});
}
function openPhotos() {
	const html = `<div class="photos">${[0, 1, 2].map(i => {
		const src = get("photo" + i);
		return `<div class="ph" style="--r:${[-2, 1.5, -1][i]}deg"><div class="img" data-view="${i}" style="${src ? `background-image:url('${src}')` : "background:linear-gradient(135deg,#f3d9e3,#dfe8f5)"}"></div>
			<input data-cap="${i}" maxlength="40" placeholder="caption..." value="${esc(get("cap" + i) || "")}">
			<div class="row"><button class="btn" data-pick="${i}">Upload</button><button class="btn" data-lib="${i}">Library</button>${src ? `<button class="btn" data-del="${i}">Remove</button>` : ""}</div></div>`;
	}).join("")}</div><input type="file" accept="image/*" id="phfile" class="hidden">
	<div id="phlib" class="phlib hidden"><div class="phlib-head"><b id="phlib-t">Choose a photo</b><button class="btn" id="phlib-x">Back</button></div><div class="phlib-grid" id="phlib-g"><p class="muted">Loading the media library...</p></div></div>
	<p class="muted" style="margin:14px 0 0">Photos hang on the wall for everyone and stay saved in this room - upload one or pick from the media library.</p>`;
	const body = openModal("photos", "Our Memories", html, 680);
	let slot = 0;
	const file = body.querySelector("#phfile");
	body.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { slot = +b.dataset.pick; file.click(); });
	body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { setShared("photo" + b.dataset.del, ""); openPhotos(); });
	body.querySelectorAll("[data-lib]").forEach(b => b.onclick = () => openPhotoLibrary(body, +b.dataset.lib));
	body.querySelectorAll("[data-cap]").forEach(inp => inp.oninput = () => { clearTimeout(inp._t); inp._t = setTimeout(() => setShared("cap" + inp.dataset.cap, inp.value.slice(0, 40)), 400); });
	body.querySelectorAll("[data-view]").forEach(d => d.onclick = () => {
		const src = get("photo" + d.dataset.view);
		if (!src) { slot = +d.dataset.view; file.click(); return; }
		const v = document.createElement("div");
		v.className = "bigphoto"; v.innerHTML = `<img src="${src}" alt="">`;
		v.onclick = () => v.remove();
		document.body.appendChild(v);
	});
	file.onchange = () => {
		const f = file.files && file.files[0];
		if (!f) return;
		compressImage(f, 45000).then(url => {
			setShared("photo" + slot, url);
			send({ t: "fx", kind: "sys", text: profile.name + " hung up a new photo" });
			addLog("You hung up a new photo", true);
		}).catch(() => toast("That image couldn't be used. Try another one."));
	};
}

// pick one of the media library's pictures for a frame on the wall
let libCache = null;
function openPhotoLibrary(body, slot) {
	const box = body.querySelector("#phlib"), grid = body.querySelector("#phlib-g");
	body.querySelector(".photos").classList.add("hidden");
	box.classList.remove("hidden");
	body.querySelector("#phlib-t").textContent = "Choose a photo for frame " + (slot + 1);
	body.querySelector("#phlib-x").onclick = () => openPhotos();
	const show = list => {
		if (!list.length) { grid.innerHTML = `<p class="muted">No pictures in the media library yet. Add some on the /manage page (Media tab).</p>`; return; }
		grid.innerHTML = list.map((m, i) => `<button class="phlib-it${get("photo" + slot) === m.url ? " on" : ""}" data-i="${i}" title="${esc(m.title)}"><img loading="lazy" src="${esc(m.url)}" alt=""></button>`).join("");
		grid.querySelectorAll(".phlib-it").forEach(b => b.onclick = () => {
			const m = list[+b.dataset.i];
			setShared("photo" + slot, m.url);
			send({ t: "fx", kind: "sys", text: profile.name + " hung up a new photo" });
			addLog("You hung up a new photo", true);
			openPhotos();
		});
	};
	if (libCache) { show(libCache); return; }
	fetch("/api/world/library", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j => {
		const list = (j && j.images) || [];
		libCache = list.length ? list : null;
		if (modalKind === "photos" && !box.classList.contains("hidden")) show(list);
	}).catch(() => { grid.innerHTML = `<p class="muted">Couldn't load the media library.</p>`; });
}

// ---------- love notes
const seen = new Set(lsGet(LS_SEEN, []));
const pendingLetters = [];
function letters() {
	return Object.keys(S).filter(k => k.indexOf("letter:") === 0 && S[k].v).map(k => S[k].v).sort((a, b) => b.ts - a.ts);
}
function onLetter(k, v, remote) {
	if (!v || v.from === ME_PID || seen.has(v.id)) { if (loveOpen) renderLove(); return; }
	if (get("opened:" + v.id + ":" + ME_PID)) return;
	if (!entered) { pendingLetters.push(v); return; }
	if (now() - v.ts > 3600000) remote = false; // old note: no flying envelope
	seen.add(v.id); lsSet(LS_SEEN, [...seen].slice(-200));
	if (remote) envelopeFx(v.from);
	toast(`A love note from <b>${esc(v.fromName)}</b>`, "Open", () => readLetter(v), 12000);
	if (audio) audio.sfx("love");
	if (loveOpen) renderLove();
}
function onOpened(k, v, remote) {
	if (!remote) return;
	const [, lid, who] = k.split(":");
	const l = get("letter:" + lid);
	if (l && l.from === ME_PID) {
		const p = [...peers.values()].find(x => x.look.pid === who);
		toast(`<b>${esc(p ? p.look.name : "They")}</b> opened your love note`, null, null, 6000);
	}
	if (loveOpen) renderLove();
}
function readLetter(l) {
	if (!get("opened:" + l.id + ":" + ME_PID) && l.from !== ME_PID) setShared("opened:" + l.id + ":" + ME_PID, now());
	openLove(l);
	if (audio) audio.sfx("love", 0.7);
}
// pull out the desk chair, sit down and start writing
function sitAtDesk() {
	if (me.sit !== "deskChair") {
		const who = whoSits("deskChair");
		if (who || !sitOn(["deskChair"])) { if (who) addLog(esc(who.look.name) + " is at the desk - you can still write from here.", true); openLove(); return; }
	}
	me.upper = "write"; me.upperUntil = performance.now() + 1e9; me.partner = null;
	updateProps();
	sendPose(true);
	// over your shoulder, looking down at the paper
	cam.yaw = Math.PI - 0.55; cam.pitch = 0.62; cam.dist = 1.7;
	openLove();
}
const ENV_SVG = '<svg class="env" viewBox="0 0 38 28"><rect x="1" y="1" width="36" height="26" rx="3" fill="#f8efe1" stroke="#d8c6ad"/><path d="M1 3l18 13L37 3" fill="none" stroke="#d8c6ad" stroke-width="1.5"/><circle cx="19" cy="16" r="4" fill="#b5272d"/></svg>';
let loveOpen = false, loveView = null, loveDraft = "";
function openLove(letter) {
	if (modalKind) closeModal();
	loveOpen = true;
	loveView = letter && letter.id ? letter : null;
	$("#lovepanel").classList.remove("hidden");
	renderLove();
	if (!loveView) setTimeout(() => { const t = $("#lovetext"); if (t && innerWidth > 560) t.focus(); }, 50);
}
function closeLove() {
	if (!loveOpen) return;
	loveOpen = false; loveView = null;
	$("#lovepanel").classList.add("hidden");
	if (document.activeElement && document.activeElement.id === "lovetext") canvas.focus();
	if (me.upper === "write") { me.upper = null; me.upperUntil = 0; updateProps(); sendPose(true); }
}
$("#lp-close").onclick = closeLove;
function renderLove() {
	const body = $("#lp-body");
	if (loveView) {
		const l = loveView;
		$("#lp-title").textContent = l.from === ME_PID ? "Your love note" : "From " + l.fromName;
		body.innerHTML = `<div class="letter openletter"><div style="white-space:pre-wrap">${esc(l.text)}</div><div class="sig">with love, ${esc(l.fromName)}</div></div>
			<div class="lp-row"><span class="muted">${new Date(l.ts).toLocaleString()}</span><span><button class="btn ghost" id="lp-back">All notes</button> <button class="btn primary" id="reply">${l.from === ME_PID ? "Write another" : "Write back"}</button></span></div>`;
		body.querySelector("#lp-back").onclick = () => { loveView = null; renderLove(); };
		body.querySelector("#reply").onclick = () => { if (me.sit !== "deskChair" && Math.hypot(5.0 - me.x, 4.5 - me.z) < 2) sitAtDesk(); else { loveView = null; renderLove(); } };
		return;
	}
	$("#lp-title").textContent = me.sit === "deskChair" ? "Writing a love note" : "Love notes";
	const typingNow = document.activeElement && document.activeElement.id === "lovetext";
	const all = letters().slice(0, 30);
	const list = all.map(l => {
		const mine = l.from === ME_PID;
		const readBy = Object.keys(S).some(k => k.indexOf("opened:" + l.id + ":") === 0);
		const readMe = !!get("opened:" + l.id + ":" + ME_PID);
		return `<div class="lt" data-l="${esc(l.id)}">${ENV_SVG}<div class="meta"><b>${mine ? "You wrote" : "From " + esc(l.fromName)}</b><span>${esc(l.text.slice(0, 60))}${l.text.length > 60 ? "..." : ""}</span></div><span class="tag ${(mine ? readBy : readMe) ? "read" : ""}">${mine ? (readBy ? "Opened" : "Sent") : (readMe ? "Read" : "New")}</span></div>`;
	}).join("");
	body.innerHTML = `<div class="letter"><textarea id="lovetext" maxlength="1500" placeholder="Write something sweet..."></textarea></div>
		<div class="lp-row"><span class="muted">${peers.size ? "It flies straight to " + [...peers.values()].map(p => esc(p.look.name)).join(", ") : "Nobody else is here yet - it'll be waiting for them."}</span><button class="btn primary" id="lovesend">Send note</button></div>
		${list ? `<div class="letters">${list}</div>` : ""}`;
	const ta = body.querySelector("#lovetext");
	ta.value = loveDraft;
	ta.oninput = () => { loveDraft = ta.value; };
	if (typingNow) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
	body.querySelector("#lovesend").onclick = () => {
		const text = ta.value.trim();
		if (!text) return;
		loveDraft = "";
		const id = Math.random().toString(36).slice(2, 10);
		setShared("letter:" + id, { id, from: ME_PID, fromName: profile.name, text, ts: now() });
		send({ t: "fx", kind: "letter" });
		if (audio) audio.sfx("whoosh");
		toast("Your love note is on its way", null, null, 4000);
		pruneLetters();
		renderLove();
	};
	body.querySelectorAll("[data-l]").forEach(el => el.onclick = () => { const l = get("letter:" + el.dataset.l); if (l) readLetter(l); });
}
function pruneLetters() {
	const all = letters();
	all.slice(40).forEach(l => { delete S["letter:" + l.id]; Object.keys(S).forEach(k => { if (k.indexOf("opened:" + l.id) === 0) delete S[k]; }); });
	persist();
}

// ---------- coffee: brew it, pick up a mug, sip it as you go, hand it to someone or set it down on a table
const SIPS = 3, MAX_CUPS = 10;
function makeCoffee() {
	if (room.coffee.brewing > 0 || coffeeReady()) return;
	startBrew(true);
	send({ t: "fx", kind: "coffee" });
}
function startBrew(mine) {
	room.coffee.brewing = 4;
	if (audio) { audio.sfx("steam", 0.8); audio.sfx("pour", 0.8); }
	room.coffee.onDone = () => {
		room.coffee.onDone = null;
		if (mine) {
			const c = get("coffee");
			setShared("coffee", { n: 1, at: now() });
			const st = room.interactables.coffee.stand;
			toast("Your coffee is ready", "Pick it up", () => { if (Math.hypot(st[0] - me.x, st[1] - me.z) < 1.5) takeCoffee(); else walkTo(st[0], st[1], "coffee"); }, 9000);
		}
	};
}
// a finished cup waiting at the machine (a stale one from hours ago has gone cold and been cleared away)
function coffeeReady() { const c = get("coffee"); return c.n > 0 && now() - (c.at || 0) < 3 * 3600 * 1000; }
function applyCoffee() { room.coffee.setReady(coffeeReady()); }
function holdMug(sips) {
	me.holding = "mug"; me.sips = sips;
	updateProps();
	sendPose(true);
	if (audio) audio.sfx("pop", 0.4);
}
// take the finished cup from the machine
function takeCoffee() {
	const c = get("coffee");
	if (!coffeeReady()) { addLog("There's no coffee ready. Make some at the machine in the kitchen.", true); return false; }
	if (me.holding === "mug") { addLog("You're already holding a coffee.", true); return false; }
	setShared("coffee", { n: 0, at: c.at });
	holdMug(SIPS);
	addLog("You picked up a coffee. <b>G</b> to sip, <b>R</b> to put it on a table, or click someone to give it to them.", true);
	return true;
}
// one sip (a few seconds; you can keep walking); the last one finishes the mug
function drinkCoffee() {
	if (me.holding !== "mug" && !takeCoffee()) return;
	if (me.upper === "drink") return;
	me.sips--;
	const last = me.sips <= 0;
	me.upper = "drink"; me.upperUntil = performance.now() + 5200;
	updateProps();
	sendPose(true);
	if (audio) { setTimeout(() => audio.sfx("sip"), 900); setTimeout(() => audio.sfx("sip"), 3700); }
	setTimeout(() => {
		if (!last || me.holding !== "mug" || me.sips > 0) return;
		me.holding = null;
		updateProps();
		sendPose(true);
		addLog("Mmm, that was a good coffee.", true);
	}, 5200);
}
// mugs set down around the world (shared, so everyone sees them and anyone can pick them up)
const cupMeshes = new Map();
function cupList() { const v = get("cups"); return Array.isArray(v) ? v : []; }
function applyCups() {
	const keep = new Set();
	for (const c of cupList()) {
		if (!c || typeof c.id !== "string" || ![c.x, c.y, c.z].every(Number.isFinite)) continue;
		keep.add(c.id);
		let m = cupMeshes.get(c.id);
		if (!m) {
			m = makeMug(["#f7f1e3", "#e07a5f", "#81b29a"][c.id.charCodeAt(c.id.length - 1) % 3]);
			m.traverse(o => { o.userData.cupId = c.id; });
			scene.add(m);
			cupMeshes.set(c.id, m);
		}
		m.position.set(c.x, c.y, c.z);
		m.rotation.y = +c.r || 0;
		m.userData.fill.scale.y = Math.max(0.1, Math.min(1, (c.s || 0) / SIPS));
	}
	for (const [id, m] of cupMeshes) {
		if (keep.has(id)) continue;
		scene.remove(m);
		m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
		cupMeshes.delete(id);
	}
}
// clear spots on the table tops where a mug can go (world x, top of the table, z)
const CUP_SPOTS = [
	[-2.65, 0.452, -3.68], [-2.42, 0.452, -3.72], [-2.75, 0.452, -3.3], [-3.1, 0.452, -3.3], [-2.62, 0.452, -3.24], [-3.1, 0.452, -3.45],   // coffee table
	[-6.48, 0.912, 3.2], [-6.48, 0.912, 3.42], [-6.45, 0.912, 4.25], [-6.45, 0.912, 4.45],   // kitchen counter
	[5.7, 0.787, 5.35], [6.05, 0.787, 5.37], [5.2, 0.787, 5.4],   // writing desk
	[-1.8, 0.577, 5.74],   // bedside table
	[-6.72, 0.822, 0.05], [-6.72, 0.822, -0.18],   // console under the photos
	[-2.75, 0.757, -10.95], [-2.45, 0.757, -10.95]   // bistro table on the terrace
];
const spotFree = s => !cupList().some(c => Math.hypot(c.x - s[0], c.z - s[2]) < 0.1);
// set the mug down on the nearest table with room (walking over to it if it's not in reach)
function putDownMug() {
	if (me.holding !== "mug") return;
	if (me.upper === "drink") { addLog("Finish your sip first.", true); return; }
	const area = areaOf(me.x, me.z);
	const cost = s => Math.hypot(s[0] - me.x, s[2] - me.z) + (areaOf(s[0], s[2]) === area ? 0 : 6);
	const spot = CUP_SPOTS.filter(spotFree).sort((a, b) => cost(a) - cost(b))[0];
	if (!spot) { addLog("Every table is full - drink up or hand it to someone.", true); return; }
	const place = () => {
		if (me.holding !== "mug") return;
		if (!spotFree(spot)) { putDownMug(); return; }   // someone beat us to that spot
		if (!me.sit) me.h = Math.atan2(spot[0] - me.x, spot[2] - me.z);
		const list = cupList().slice(-(MAX_CUPS - 1));
		list.push({ id: "c" + Math.random().toString(36).slice(2, 9), x: spot[0], y: spot[1], z: spot[2], r: +(Math.random() * 6.28).toFixed(2), s: me.sips });
		setShared("cups", list);
		me.holding = null; me.sips = 0;
		doUpper("give", 900);
		if (audio) audio.sfx("pop", 0.4);
	};
	const d = Math.hypot(spot[0] - me.x, spot[2] - me.z);
	if (areaOf(spot[0], spot[2]) === area && d < (me.sit ? 2.2 : 1.1)) place();
	else { const dx = me.x - spot[0], dz = me.z - spot[2], l = Math.hypot(dx, dz) || 1; walkTo(spot[0] + dx / l * 0.7, spot[2] + dz / l * 0.7, place); }
}
function cupReach(c) { return areaOf(c.x, c.z) === areaOf(me.x, me.z) && Math.hypot(c.x - me.x, c.z - me.z) < (me.sit ? 2.1 : 1.0); }
function nearestCup() {
	let best = null, bd = 1e9;
	for (const c of cupList()) { const d = Math.hypot(c.x - me.x, c.z - me.z); if (d < bd && cupReach(c)) { bd = d; best = c; } }
	return best;
}
function pickCup(id) {
	const list = cupList(), c = list.find(x => x.id === id);
	if (!c) return;
	if (me.holding === "mug") { addLog("You're already holding a coffee.", true); return; }
	setShared("cups", list.filter(x => x.id !== id));
	holdMug(Math.max(1, Math.min(SIPS, c.s | 0)));
}
// clicked a mug across the room: walk up to it first
function goPickCup(id) {
	const c = cupList().find(x => x.id === id);
	if (!c) return;
	if (cupReach(c)) { pickCup(id); return; }
	const dx = me.x - c.x, dz = me.z - c.z, l = Math.hypot(dx, dz) || 1;
	walkTo(c.x + dx / l * 0.75, c.z + dz / l * 0.75, () => pickCup(id));
}

// ---------- plant
function waterPlant() {
	const p = get("plant");
	if (now() - (p.at || 0) < 15000) { addLog("The soil is still wet. Give it a moment.", true); return; }
	setShared("plant", { water: Math.min(8, (p.water || 0) + 1), at: now() });
	room.waterFx();
	if (audio) audio.sfx("water");
	send({ t: "fx", kind: "water" });
	addLog(p.water >= 7 ? "The plant is in full bloom!" : "You watered the plant. It's growing.", true);
}
function applyPlant() {
	const p = get("plant");
	const hrs = (now() - (p.at || now())) / 3600000;
	room.setPlant(p.water || 0, p.at ? Math.max(0, (hrs - 24) / 48) : 0);
}

// ---------- drawing on the easel (side panel, your character paints with a brush)
const strokes = lsGet(LS_STROKES, {});
const easel = room.easel;
let drawColor = "#2b2d42", drawSize = 6, drawOpen = false;
function saveStrokes() {
	const ids = Object.keys(strokes);
	if (ids.length > 700) ids.sort((a, b) => strokes[a].ts - strokes[b].ts).slice(0, ids.length - 700).forEach(id => delete strokes[id]);
	clearTimeout(saveStrokes.t);
	saveStrokes.t = setTimeout(() => lsSet(LS_STROKES, strokes), 800);
}
function mergeStroke(st) {
	if (!st || typeof st.i !== "string" || !Array.isArray(st.p)) return;
	if (st.ts < get("drawClear")) return;
	const cur = strokes[st.i];
	if (!cur || cur.p.length < st.p.length) strokes[st.i] = { i: st.i, c: String(st.c).slice(0, 9), w: +st.w || 4, p: st.p.slice(0, 4000), ts: +st.ts || now() };
	saveStrokes();
}
function paintStroke(g, st, from) {
	const p = st.p;
	g.strokeStyle = st.c; g.lineWidth = st.w; g.lineCap = "round"; g.lineJoin = "round";
	g.beginPath();
	const s = Math.max(0, (from || 0) - 2);
	g.moveTo(p[s], p[s + 1]);
	if (p.length <= 2) g.lineTo(p[0] + 0.1, p[1]);
	for (let i = s + 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
	g.stroke();
}
function paperBg(g) { g.fillStyle = "#fffdf8"; g.fillRect(0, 0, 640, 480); }
function redrawEasel() {
	const g = easel.canvas.getContext("2d");
	paperBg(g);
	const list = Object.values(strokes).sort((a, b) => a.ts - b.ts);
	if (!list.length) {
		g.fillStyle = "#d9cfc3"; g.font = "600 34px Caveat, cursive"; g.textAlign = "center";
		g.fillText("draw something together...", 320, 250);
	}
	list.forEach(st => paintStroke(g, st, 0));
	easel.tex.needsUpdate = true;
}
function onSeg(d) {
	if (typeof d.i !== "string" || !Array.isArray(d.p)) return;
	let st = strokes[d.i];
	const g = easel.canvas.getContext("2d");
	if (!st) {
		if (!Object.keys(strokes).length) paperBg(g);
		st = strokes[d.i] = { i: d.i, c: String(d.c).slice(0, 9), w: +d.w || 4, p: [], ts: +d.ts || now() };
	}
	const from = st.p.length;
	st.p.push(...d.p.slice(0, 2000));
	paintStroke(g, st, from);
	easel.tex.needsUpdate = true;
	// aim the painter's brush at the latest point
	const p = peers.get(d.id);
	if (p && st.p.length >= 2) p.avatar.paintUV = { u: st.p[st.p.length - 2] / 640, v: st.p[st.p.length - 1] / 480 };
	saveStrokes();
}
const DRAW_COLS = ["#2b2d42", "#e63946", "#ff7aa2", "#f4a261", "#e9c46a", "#2a9d8f", "#457b9d", "#8e7dbe", "#ffffff"];
function openDraw() {
	const def = room.interactables.easel;
	if (me.sit) standUp(true);
	// two painters fit side by side; take whichever spot is free
	const taken = s => [...peers.values()].some(p => p.upper === "paint" && Math.hypot(p.x - s[0], p.z - s[1]) < 0.3);
	const stand = def.stands.slice().sort((a, b) => Math.hypot(a[0] - me.x, a[1] - me.z) - Math.hypot(b[0] - me.x, b[1] - me.z)).find(s => !taken(s));
	if (!stand) { const p = whoDoes("paint"); if (p) busy(p, "Save a corner of the paper for me!", "Both spots at the easel are taken"); return; }
	me.x = stand[0]; me.z = stand[1]; me.h = def.face;
	me.upper = "paint";
	updateProps();
	drawOpen = true;
	const panel = $("#drawpanel");
	panel.classList.remove("hidden");
	$("#dp-cols").innerHTML = DRAW_COLS.map(c => `<button class="sw ${c === drawColor ? "on" : ""}" data-c="${c}" style="background:${c}" aria-label="color ${c}"></button>`).join("");
	$("#dp-sizes").innerHTML = [3, 6, 12, 24].map(s => `<button data-s="${s}" class="${s === drawSize ? "on" : ""}"><i style="width:${Math.min(22, s)}px;height:${Math.min(22, s)}px"></i></button>`).join("");
	panel.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { drawColor = b.dataset.c; panel.querySelectorAll("[data-c]").forEach(x => x.classList.toggle("on", x === b)); });
	panel.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { drawSize = +b.dataset.s; panel.querySelectorAll("[data-s]").forEach(x => x.classList.toggle("on", x === b)); });
	easel.canvas.style.cssText = "width:100%;display:block;cursor:crosshair;touch-action:none";
	$("#dp-canvas").appendChild(easel.canvas);
	// frame the camera so you can see yourself painting
	// side-on view: you, your brush and the paper (the building wall is right behind you)
	cam.yaw = def.face - Math.PI / 2 + 0.3; cam.pitch = 0.25; cam.dist = 2.3;
	sendPose(true);
}
function closeDraw() {
	if (!drawOpen) return;
	drawOpen = false;
	$("#drawpanel").classList.add("hidden");
	if (me.upper === "paint") me.upper = null;
	updateProps();
	cam.dist = 4.2; cam.pitch = 0.38;
	sendPose(true);
}
$("#dp-close").onclick = closeDraw;
$("#dp-clear").onclick = () => setShared("drawClear", now());
{
	let cur = null, sentUpTo = 0, timer = 0;
	const pt = e => { const r = easel.canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 640), Math.round((e.clientY - r.top) / r.height * 480)]; };
	const aim = (x, y) => { me.pu = x / 640; me.pv = y / 480; myAvatar.paintUV = { u: me.pu, v: me.pv }; };
	const flush = () => {
		if (!cur || cur.p.length <= sentUpTo) return;
		send({ t: "seg", i: cur.i, c: cur.c, w: cur.w, ts: cur.ts, p: cur.p.slice(sentUpTo) });
		sentUpTo = cur.p.length;
	};
	easel.canvas.addEventListener("pointerdown", e => {
		if (!drawOpen) return;
		e.preventDefault();
		easel.canvas.setPointerCapture(e.pointerId);
		if (!Object.keys(strokes).length) paperBg(easel.canvas.getContext("2d"));
		const sid = MY_ID + now().toString(36);
		const p0 = pt(e);
		cur = strokes[sid] = { i: sid, c: drawColor, w: drawSize, p: p0, ts: now() };
		sentUpTo = 0;
		aim(p0[0], p0[1]);
		paintStroke(easel.canvas.getContext("2d"), cur, 0);
		easel.tex.needsUpdate = true;
		timer = setInterval(flush, 60);
	});
	easel.canvas.addEventListener("pointermove", e => {
		if (!cur) return;
		const [x, y] = pt(e), n = cur.p.length;
		if (Math.abs(x - cur.p[n - 2]) + Math.abs(y - cur.p[n - 1]) < 2) return;
		cur.p.push(x, y);
		aim(x, y);
		paintStroke(easel.canvas.getContext("2d"), cur, n);
		easel.tex.needsUpdate = true;
	});
	const end = () => { if (!cur) return; clearInterval(timer); flush(); saveStrokes(); cur = null; };
	easel.canvas.addEventListener("pointerup", end);
	easel.canvas.addEventListener("pointercancel", end);
}

// ---------- arcade games
function openArcade(menu) {
	const g = get("game");
	if (!g || menu) {
		const icons = {
			ttt: '<svg viewBox="0 0 40 40"><path d="M14 4v32M26 4v32M4 14h32M4 26h32" stroke="#7c5cff" stroke-width="3"/><path d="M6 6l6 6M12 6l-6 6" stroke="#ff4fa3" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="20" r="3.5" stroke="#41e0ff" stroke-width="3" fill="none"/></svg>',
			c4: '<svg viewBox="0 0 40 40"><rect x="3" y="7" width="34" height="28" rx="4" fill="#2a3cff"/><g fill="#0b0620"><circle cx="11" cy="15" r="4"/><circle cx="20" cy="15" r="4"/><circle cx="29" cy="15" r="4"/></g><circle cx="11" cy="27" r="4" fill="#ff4fa3"/><circle cx="20" cy="27" r="4" fill="#ffd34f"/><circle cx="29" cy="27" r="4" fill="#ff4fa3"/></svg>',
			gomoku: '<svg viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx="4" fill="#d9b77a"/><path d="M3 12h34M3 20h34M3 28h34M12 3v34M20 3v34M28 3v34" stroke="#8a6a3c" stroke-width="1"/><g fill="#ff4fa3"><circle cx="8" cy="32" r="3.2"/><circle cx="16" cy="24" r="3.2"/><circle cx="24" cy="16" r="3.2"/><circle cx="32" cy="8" r="3.2"/></g><circle cx="24" cy="24" r="3.2" fill="#41e0ff"/></svg>',
			rev: '<svg viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx="4" fill="#1d7a4f"/><path d="M20 3v34M3 20h34" stroke="#0d4a2e" stroke-width="1.5"/><circle cx="11.5" cy="11.5" r="6" fill="#ff4fa3"/><circle cx="28.5" cy="28.5" r="6" fill="#ff4fa3"/><circle cx="28.5" cy="11.5" r="6" fill="#41e0ff"/><circle cx="11.5" cy="28.5" r="6" fill="#41e0ff"/></svg>',
			dots: '<svg viewBox="0 0 40 40"><rect x="9" y="9" width="11" height="11" fill="rgba(255,79,163,.5)"/><path d="M8 8h12v12H8z" fill="none" stroke="#ff4fa3" stroke-width="2.5"/><path d="M20 8h12M32 8v12" stroke="#41e0ff" stroke-width="2.5"/><g fill="#fff"><circle cx="8" cy="8" r="2.4"/><circle cx="20" cy="8" r="2.4"/><circle cx="32" cy="8" r="2.4"/><circle cx="8" cy="20" r="2.4"/><circle cx="20" cy="20" r="2.4"/><circle cx="32" cy="20" r="2.4"/><circle cx="8" cy="32" r="2.4"/><circle cx="20" cy="32" r="2.4"/><circle cx="32" cy="32" r="2.4"/></g></svg>',
			mem: '<svg viewBox="0 0 40 40"><rect x="4" y="7" width="14" height="20" rx="3" fill="#7c5cff" transform="rotate(-10 11 17)"/><rect x="20" y="11" width="14" height="20" rx="3" fill="#f7f1e3" transform="rotate(8 27 21)"/><path d="M27 18c-1.4-1.8-4-.8-3.6 1.3.3 1.4 2.2 2.5 3.6 3.5 1.4-1 3.3-2.1 3.6-3.5.4-2.1-2.2-3.1-3.6-1.3z" fill="#e05561"/></svg>',
			rps: '<svg viewBox="0 0 40 40"><circle cx="12" cy="24" r="8" fill="#9aa0a6"/><rect x="20" y="8" width="14" height="18" rx="2" fill="#fdfaf2"/><path d="M22 30l10-8M22 22l10 8" stroke="#e05561" stroke-width="3" stroke-linecap="round"/></svg>'
		};
		const body = openModal("arcade", "Arcade", `<div class="gmenu">${Games.GAME_LIST.map(x => `<button class="gcard" data-g="${x.type}"><div class="gi">${icons[x.type]}</div><div><b>${x.name}</b><span>${x.desc}</span></div></button>`).join("")}</div><p class="muted" style="margin:14px 0 0">Starting a game puts it on the arcade screen for everyone. Anyone can join, or play the computer.</p>`, 460);
		body.querySelectorAll("[data-g]").forEach(b => b.onclick = () => startGame(b.dataset.g));
		return;
	}
	if (g.players[1] && g.winner === null && !g.players.includes(MY_ID) && g.players[1] !== "cpu") {
		const p = peers.get(g.players[0]) || peers.get(g.players[1]);
		if (p) busy(p, "I'll play the winner!", g.names[0] + " and " + g.names[1] + " are playing - you can watch");
	}
	const body = openModal("arcade", Games.GAME_LIST.find(x => x.type === g.type).name, "", 520);
	Games.renderGame(body, g, gameCtx());
}
function rpsLists() {
	const g = get("game");
	const a = get("rps0"), b = get("rps1");
	return [a && g && a.gid === g.id ? a.p : [], b && g && b.gid === g.id ? b.p : []];
}
function gameCtx() {
	return {
		me: MY_ID, rps: rpsLists(),
		onMove: (mv, idx) => {
			const g = get("game");
			if (g.type === "rps") {
				const lists = rpsLists(), r = Games.rpsScore(lists[0], lists[1]).rounds;
				if (lists[idx].length > r) return;
				setShared("rps" + idx, { gid: g.id, p: lists[idx].concat([mv]) });
				if (g.players[1] === "cpu") setTimeout(() => { const l = rpsLists(); if (l[1].length <= r) setShared("rps1", { gid: g.id, p: l[1].concat([Games.cpuMove(g)]) }); }, 500);
				return;
			}
			const n = Games.applyMove(g, idx, mv);
			if (n) { setShared("game", n); if (audio) audio.sfx("move"); }
		},
		onJoin: () => { const g = get("game"); if (g.players[1]) return; const n = JSON.parse(JSON.stringify(g)); n.players[1] = MY_ID; n.names[1] = profile.name; setShared("game", n); send({ t: "fx", kind: "sys", text: profile.name + " joined the game" }); },
		onCpu: () => { const g = get("game"); const n = JSON.parse(JSON.stringify(g)); n.players[1] = "cpu"; n.names[1] = "Computer"; setShared("game", n); },
		onRematch: () => {
			const g = get("game");
			const n = Games.newGame(g.type, g.players[0], g.names[0]);
			n.players = g.players.slice(); n.names = g.names.slice();
			n.turn = g.winner === 0 ? 1 : 0;
			setShared("game", n);
		},
		onNew: () => openArcade(true)
	};
}
function startGame(type) {
	const g = Games.newGame(type, MY_ID, profile.name);
	setShared("game", g);
	send({ t: "fx", kind: "game", type });
	openArcade();
}
let lastGameSig = "";
function applyGame(k, remote) {
	const g = get("game");
	if (modalKind === "arcade" && g) { const body = $("#mbody"); body.innerHTML = ""; $("#mtitle").textContent = Games.GAME_LIST.find(x => x.type === g.type).name; Games.renderGame(body, g, gameCtx()); }
	if (!g) return;
	if (g.players[1] === "cpu" && g.players[0] === MY_ID && g.turn === 1 && g.winner === null && g.type !== "rps") {
		setTimeout(() => { const cur = get("game"); if (cur.id !== g.id || cur.turn !== 1) return; const n = Games.applyMove(cur, 1, Games.cpuMove(cur)); if (n) { setShared("game", n); if (audio) audio.sfx("move"); } }, 650);
	}
	const sig = g.id + ":" + g.winner;
	if (g.winner !== null && sig !== lastGameSig && remote !== null) {
		const myIdx = g.players.indexOf(MY_ID);
		if (audio) audio.sfx(g.winner === "draw" ? "chime" : g.winner === myIdx ? "win" : myIdx >= 0 ? "lose" : "chime");
		if (g.winner === myIdx) heartsFx(myAvatar.root, 6, "#ffd34f");
	}
	lastGameSig = sig;
	if (remote && k === "game" && !g.moves && g.players[0] !== MY_ID && !g.players[1] && modalKind !== "arcade") {
		toast(`<b>${esc(g.names[0])}</b> started ${Games.GAME_LIST.find(x => x.type === g.type).name} on the arcade`, "Go play", () => walkTo(room.interactables.arcade.stand[0], room.interactables.arcade.stand[1], () => { me.h = room.interactables.arcade.face; openArcade(); gameCtx().onJoin(); }), 20000);
	}
	if (remote && k === "game" && g.players[1] && g.players[0] === MY_ID && g.moves === 0 && g.players[1] !== "cpu" && modalKind !== "arcade") {
		toast(`<b>${esc(g.names[1])}</b> joined your game`, "Go play", () => walkTo(room.interactables.arcade.stand[0], room.interactables.arcade.stand[1], "arcade"), 8000);
	}
}

// ============================================================ effects
const fxObjs = [];
function heartsFx(root, n, color, y = 1.7) {
	for (let i = 0; i < n; i++) {
		const h = heartMesh(0.16 + Math.random() * 0.08, color || ["#ff4d6d", "#ff8fab", "#ff6b81"][i % 3]);
		h.position.set(root.position.x + (Math.random() - 0.5) * 0.5, y + Math.random() * 0.3, root.position.z + (Math.random() - 0.5) * 0.5);
		h.userData = { life: 0, max: 2.2 + Math.random(), vy: 0.6 + Math.random() * 0.4, sw: Math.random() * 6, delay: i * 0.12 };
		h.visible = false;
		scene.add(h);
		fxObjs.push(h);
	}
}
function noteFx() {
	const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.8, 0.7), transparent: true }));
	const stem = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.08, 0.008), m.material);
	stem.position.set(0.025, 0.04, 0);
	m.add(stem);
	m.position.set(0.2 + (Math.random() - 0.5) * 1.2, 1.35, 5.4);
	m.userData = { life: 0, max: 1.6, vy: 0.5, sw: Math.random() * 6, delay: 0 };
	scene.add(m);
	fxObjs.push(m);
}
function envelopeFx(fromPid) {
	const env = new THREE.Group();
	const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.01), new THREE.MeshStandardMaterial({ color: "#f8efe1", roughness: 0.8 }));
	const seal = heartMesh(0.06, "#b5272d"); seal.position.z = 0.012;
	env.add(body, seal);
	const from = new THREE.Vector3(5.6, 1.0, 5.4);
	const sender = [...peers.values()].find(x => x.look.pid === fromPid);
	if (sender) { const r = sender.avatar.root.position; from.set(r.x, 1.4, r.z); }
	env.position.copy(from);
	env.userData = { life: 0, max: 2.2, env: true, from, delay: 0 };
	scene.add(env);
	fxObjs.push(env);
}
const dice = [];
function pipTex(v) {
	const c = document.createElement("canvas"); c.width = c.height = 128;
	const g = c.getContext("2d");
	g.fillStyle = "#fffaf3"; g.fillRect(0, 0, 128, 128);
	g.fillStyle = v === 1 ? "#d62839" : "#2b2d42";
	const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] };
	P[v].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, v === 1 ? 18 : 12, 0, Math.PI * 2); g.fill(); });
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const DIE_MATS = [3, 4, 1, 6, 2, 5].map(v => new THREE.MeshStandardMaterial({ map: pipTex(v), roughness: 0.35 }));
const DIE_ROT = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] };
function rollDie(v, x, z, h, name) {
	const d = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), DIE_MATS);
	d.castShadow = true;
	d.rotation.order = "YXZ"; // yaw last, so the landing face stays pointing up
	const tx = x + Math.sin(h) * 1.0, tz = z + Math.cos(h) * 1.0;
	d.userData = { life: 0, v, sx: x + Math.sin(h) * 0.3, sz: z + Math.cos(h) * 0.3, tx, tz, name, spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20) };
	scene.add(d);
	dice.push(d);
	if (audio) setTimeout(() => audio.sfx("dice"), 500);
}
function updateFx(dt) {
	for (let i = fxObjs.length - 1; i >= 0; i--) {
		const o = fxObjs[i], u = o.userData;
		if (u.delay > 0) { u.delay -= dt; continue; }
		o.visible = true;
		u.life += dt;
		const k = u.life / u.max;
		if (u.env) {
			const to = myAvatar.root.position;
			const e = Math.min(1, k);
			o.position.set(u.from.x + (to.x - u.from.x) * e, u.from.y + Math.sin(e * Math.PI) * 1.2 + (1.3 - u.from.y) * e, u.from.z + (to.z - u.from.z) * e);
			o.rotation.y += dt * 6;
			if (k >= 1) heartsFx(myAvatar.root, 5);
		} else {
			o.position.y += u.vy * dt;
			o.position.x += Math.sin(u.life * 3 + u.sw) * 0.004;
			o.rotation.y += dt * 2;
			const s = k < 0.2 ? k / 0.2 : 1 - Math.max(0, (k - 0.7) / 0.3);
			o.scale.setScalar(Math.max(0.01, s));
		}
		if (k >= 1) { scene.remove(o); fxObjs.splice(i, 1); }
	}
	for (let i = dice.length - 1; i >= 0; i--) {
		const d = dice[i], u = d.userData;
		u.life += dt;
		const k = Math.min(1, u.life / 0.9);
		d.position.set(u.sx + (u.tx - u.sx) * k, 0.1 + Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * 0.9 + (1 - k) * 0.6, u.sz + (u.tz - u.sz) * k);
		if (k < 1) { d.rotation.x += u.spin.x * dt * (1 - k); d.rotation.y += u.spin.y * dt * (1 - k); d.rotation.z += u.spin.z * dt * (1 - k); }
		else if (!u.landed) {
			u.landed = true;
			const r = DIE_ROT[u.v]; d.rotation.set(r[0], d.rotation.y, r[2]);
			addLog(`<b>${esc(u.name)}</b> rolled a <b>${u.v}</b>`, true);
		}
		if (u.life > 7) { d.scale.multiplyScalar(0.85); if (d.scale.x < 0.05) { scene.remove(d); d.geometry.dispose(); dice.splice(i, 1); } }
	}
}
function onFx(d, p) {
	const name = p ? p.look.name : "Someone";
	switch (d.kind) {
		case "coffee": startBrew(false); addLog(esc(name) + " is making coffee", true); break;
		case "water": room.waterFx(); if (audio) audio.sfx("water", 0.6); addLog(esc(name) + " watered the plant", true); break;
		case "dice": rollDie(Math.max(1, Math.min(6, d.v | 0)), +d.x, +d.z, +d.h, name); break;
		case "hearts": if (p) heartsFx(p.avatar.root, 7); if (audio) audio.sfx("love", 0.5); break;
		case "fightend": fightResult(String(d.w || "Someone").slice(0, 24), +d.sa || 0, +d.sb || 0, d.wid, d.a, d.b); break;
		case "flower": if (d.to === MY_ID) { me.holding = "flower"; updateProps(); sendPose(true); heartsFx(myAvatar.root, 6); if (audio) audio.sfx("love"); toast(`<b>${esc(name)}</b> gave you a flower`, null, null, 6000); } break;
		case "mug": if (d.to === MY_ID) { holdMug(Math.max(1, Math.min(SIPS, d.s | 0))); toast(`<b>${esc(name)}</b> gave you a coffee`, "Take a sip", drinkCoffee, 7000); } break;
		case "star": shootingStar(); break;
		case "yes": if (p) { heartsFx(p.avatar.root, 14); addLog(`<b>${esc(name)}</b> said YES!`, true); } if (audio) audio.sfx("yes"); break;
		case "smooch": if (p) heartsFx(p.avatar.root, 3, "#ff2d55", heartY(p.anim)); break;
		case "sys": if (d.text) addLog(esc(String(d.text).slice(0, 120)), true); break;
	}
}
function emote(e) {
	if (e === "dice") {
		const v = 1 + Math.floor(Math.random() * 6);
		rollDie(v, me.x, me.z, me.h, profile.name);
		send({ t: "fx", kind: "dice", v, x: me.x, z: me.z, h: me.h });
		return;
	}
	if (e === "goodnight") { goodnightKiss(); return; }
	if (e === "wakeup") { wakeNearest(); return; }
	if (e === "carry") { carryAct(); return; }
	// being carried: anything but a sweet little reaction means hopping down first
	if (me.carriedBy && !["cuddle", "smooch", "cheekkiss", "blush", "wink", "kiss", "heart", "lovestruck"].includes(e)) hopDown();
	if (me.anim === "sleep" && !SEATED_LOVE.includes(e)) sitUpInBed();
	if (me.upper === "piano" || me.upper === "paint" || me.upper === "tug" || me.upper === "telescope") return;
	if (COUPLE_ACTS.includes(e)) { loveAct(e); return; }
	if (e === "floor") { if (me.sit) standUp(true); me.anim = me.anim === "floor" ? "idle" : "floor"; me.upper = null; sendPose(true); return; }
	if (e === "hug" || e === "highfive") { partnerEmote(e); return; }
	if (me.anim === "floor" && ["dance", "jump", "bow"].includes(e)) me.anim = "idle";
	if (["dance", "jump", "bow"].includes(e) && me.sit) standUp();
	doUpper(e, EMOTE_MS[e] || 2400);
	if (e === "heart") { heartsFx(myAvatar.root, 7); send({ t: "fx", kind: "hearts" }); if (audio) audio.sfx("love", 0.5); }
	if (e === "kiss") setTimeout(() => { heartsFx(myAvatar.root, 4, "#ff4d6d"); send({ t: "fx", kind: "hearts" }); if (audio) audio.sfx("love", 0.4); }, 750);
	if (e === "heartarms") { heartsFx(myAvatar.root, 9, null, 2.0); send({ t: "fx", kind: "hearts" }); if (audio) audio.sfx("love", 0.6); }
	if (e === "lovestruck" && audio) audio.sfx("love", 0.4);
	if (e === "blush" && audio) audio.sfx("pop", 0.3);
	if (e === "wink" && audio) setTimeout(() => audio.sfx("wink"), 250);
	if (e === "laugh" && audio) audio.sfx("laugh");
	if (e === "jump" && audio) setTimeout(() => audio.sfx("kick", 0.3), 650);
}
const EMOTE_MS = { wave: 2600, dance: 8000, clap: 2200, heart: 2200, laugh: 3000, cry: 4200, kiss: 1700, jump: 1800, bow: 2200, cheer: 3000, think: 4000, shrug: 2000, facepalm: 2500, yawn: 3000, blush: 3000, lovestruck: 4200, heartarms: 2800, wink: 1500 };
function nearestPeer(maxD) {
	let best = null, bd = maxD;
	peers.forEach((p, id) => { const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < bd && !isAsleep(p) && !p.carriedBy) { bd = d; best = id; } });
	return best;
}
// hug / high-five: walk up to the closest person and actually touch them
function partnerEmote(e) {
	const id = nearestPeer(12);
	if (!id) { myAvatar.say(e === "hug" ? "I need someone to hug..." : "High five? Anyone?"); return; }
	const p = peers.get(id);
	const dx = me.x - p.x, dz = me.z - p.z, l = Math.hypot(dx, dz) || 1;
	const gap = COUPLE_GAP[e];
	const start = () => {
		const q = peers.get(id);
		if (!q) return;
		me.h = Math.atan2(q.x - me.x, q.z - me.z);
		doUpper(e, e === "hug" ? 3200 : 1500, id);
		me.lock = { id };
		send({ t: "act", kind: e, to: id });
		if (e === "hug") { heartsFx(myAvatar.root, 5); if (audio) audio.sfx("love", 0.5); }
		else if (audio) setTimeout(() => audio.sfx("clap"), 550);
	};
	// walk up to just outside arm's reach; the couple lock then pulls you in close
	const app = Math.max(gap, 0.62);
	if (l < app + 0.25) start(); else walkTo(p.x + dx / l * app, p.z + dz / l * app, start);
}
// someone hugged / high-fived / is giving us something: turn and join in
function onPartnerAct(d, p) {
	if (d.to !== MY_ID || !p) return;
	if (d.kind === "yes") { onYes(p); return; }
	if (onCarryAct(d, p)) return;
	// cuddles and kisses from the seat right next to you keep you sitting (or lying) there
	const together = SEATED_LOVE.includes(d.kind) && me.sit && p.sit && seatDist(me, p) < NEAR_SEAT;
	// kissed while asleep: stay asleep, just dream sweeter
	if (["goodnight", "smooch", "cheekkiss"].includes(d.kind) && (d.kind === "goodnight" ? me.anim === "sleep" : isAsleep(me))) {
		setTimeout(() => { heartsFx(myAvatar.root, 5, null, heartY(me.anim)); if (audio) audio.sfx("love", 0.3); }, 400);
		addLog(`<b>${esc(p.look.name)}</b> kissed you while you were sleeping`, true);
		return;
	}
	if (d.kind === "goodnight") { me.h = me.sit ? me.h : Math.atan2(p.x - me.x, p.z - me.z); doUpper("blush", 2600); addLog(`<b>${esc(p.look.name)}</b> kissed you goodnight`, true); return; }
	if (me.anim === "sleep" && !together) return;
	if (COUPLE_ACTS.includes(d.kind) && (me.upper === "piano" || me.upper === "telescope")) return;
	if (d.kind === "cuddle" && !together) return;
	if (me.sit && !together) standUp(true);
	me.target = null; me.path = [];
	if (!together) me.h = Math.atan2(p.x - me.x, p.z - me.z);
	if (onLoveAct(d, p)) return;
	if (d.kind === "hug") { doUpper("hug", 3200, d.id); heartsFx(myAvatar.root, 5); if (audio) audio.sfx("love", 0.5); }
	else if (d.kind === "highfive") { doUpper("highfive", 1500, d.id); if (audio) setTimeout(() => audio.sfx("clap"), 550); }
	else if (d.kind === "give") doUpper("give", 1600, d.id);
}

// ---------- love: kisses, cuddles, slow dances and proposals
// Cuddles happen seat to seat (sofa, bed, swing, bean bags, the candlelit table,
// a lap in the armchair); the rest walk you up to the nearest person.
const COUPLE_ACTS = ["smooch", "cheekkiss", "cuddle", "slowdance", "propose"];
const SEATED_LOVE = ["cuddle", "smooch", "cheekkiss"];
const IN_BED_OK = SEATED_LOVE.concat(["blush", "nightkiss", "shake"]);
const COUPLE_POSES = SEATED_LOVE.concat(["slowdance", "nightkiss"]);
const NEAR_SEAT = 1.45;
// where someone's body really is: a lying person's position is their feet, so use their middle
function bodyXZ(o) {
	const spot = o.sit && spotById(o.sit);
	if (spot && spot.lie) return { x: o.x - Math.sin(spot.h) * 1.0, z: o.z - Math.cos(spot.h) * 1.0 };
	return { x: o.x, z: o.z };
}
function seatDist(a, b) { const p = bodyXZ(a), q = bodyXZ(b); return Math.hypot(p.x - q.x, p.z - q.z); }
// root-to-root distance for things done face to face (heads / hands actually touch)
const COUPLE_GAP = { smooch: 0.3, cheekkiss: 0.33, slowdance: 0.34, propose: 0.62, hug: 0.33, highfive: 0.6 };   // the bistro chairs face each other 1.34m apart
const LOVE_MS = { smooch: 2600, cheekkiss: 1800, cuddle: 1e9, slowdance: 14000, propose: 6500 };
const LONELY = { smooch: "Who wants a kiss?", cheekkiss: "No cheeks to kiss around here...", cuddle: "I need someone to cuddle...", slowdance: "Anyone want to dance with me?", propose: "I'll wait for the right person..." };
function heartY(anim) { return anim === "sleep" ? 0.95 : anim === "sit" ? 1.3 : 1.75; }
function posOf(id) { return id === MY_ID ? me : peers.get(id) || null; }
// the person in the seat right next to yours
function seatNeighbor() {
	if (!me.sit || me.sit === "bench") return null;
	let best = null, bd = NEAR_SEAT;
	peers.forEach((p, id) => {
		if (!p.sit || p.sit === "bench") return;
		const d = seatDist(me, p);
		if (d < bd) { bd = d; best = id; }
	});
	return best;
}
function loveAct(e) {
	const nb = seatNeighbor();
	if ((e === "smooch" || e === "cheekkiss") && nb && isAsleep(peers.get(nb)) && me.anim !== "sleep") { goodnightKiss(nb); return; }
	if (SEATED_LOVE.includes(e) && nb) {
		const q = peers.get(nb);
		if (e === "cuddle" && me.upper === "cuddle" && me.partner === nb) { me.upper = null; me.partner = null; me.upperUntil = 0; sendPose(true); return; }
		doUpper(e, LOVE_MS[e], nb);
		send({ t: "act", kind: e, to: nb });
		loveFx(e, q);
		if (e === "cuddle") addLog((me.anim === "sleep" ? "You snuggled up to " : "You cuddled up with ") + esc(q.look.name), true);
		return;
	}
	if (e === "cuddle") {
		if (me.carrying) { carryToCuddle(); return; }
		if (me.carriedBy) { myAvatar.say("Take me to bed for a cuddle?"); send({ t: "chat", text: "Take me to bed for a cuddle?", auto: 1 }); return; }
		// standing next to someone who's standing too: offer to scoop them up and carry them to the bed / sofa
		if (!me.sit && !me.carriedBy) {
			const id = nearestPeer(12);
			if (id && !peers.get(id).sit) { offerCarry(id); return; }
		}
		cuddleUpTo();
		return;
	}
	// a kiss while one of you is carrying the other: no walking around, just hearts
	const held = me.carrying || me.carriedBy;
	if ((e === "smooch" || e === "cheekkiss") && held && peers.get(held)) {
		carryKiss(e, held);
		send({ t: "act", kind: e, to: held });
		loveFx(e, peers.get(held));
		return;
	}
	if (me.anim === "sleep") standUp(true);
	const id = nearestPeer(12);
	if (!id) { myAvatar.say(LONELY[e]); return; }
	const p = peers.get(id);
	const dx = me.x - p.x, dz = me.z - p.z, l = Math.hypot(dx, dz) || 1;
	const gap = COUPLE_GAP[e];
	const start = () => {
		const q = peers.get(id);
		if (!q) return;
		me.h = Math.atan2(q.x - me.x, q.z - me.z);
		doUpper(e, LOVE_MS[e], id);
		me.lock = { id };
		send({ t: "act", kind: e, to: id });
		loveFx(e, q);
	};
	const app = Math.max(gap, 0.62);
	if (l < app + 0.25 && !me.sit) start(); else walkTo(p.x + dx / l * app, p.z + dz / l * app, start);
}
// nobody next to you yet: go and sit beside (or on the lap of) the nearest seated person
function cuddleUpTo() {
	const taken = takenSpots();
	let best = null, bd = 1e9;
	peers.forEach(p => {
		if (!p.sit || p.sit === "bench") return;
		const lying = !!(spotById(p.sit) && spotById(p.sit).lie);
		for (const s of room.sitSpots) {
			if (s.id === p.sit || s.id === "bench" || taken.has(s.id)) continue;
			if (lying !== !!s.lie) continue;   // lie down next to a sleeper, sit next to a sitter
			if (s.lap && s.lap !== p.sit) continue;
			if (Math.hypot(s.x - p.x, s.z - p.z) >= NEAR_SEAT) continue;
			const d = Math.hypot(s.x - me.x, s.z - me.z);
			if (d < bd) { bd = d; best = s; }
		}
	});
	if (!best) {
		const anyone = [...peers.values()].some(p => p.sit);
		myAvatar.say(anyone ? "No room to squeeze in there..." : LONELY.cuddle);
		if (!anyone) addLog("Sit next to someone to cuddle: the sofa, the bed, the swing, the bean bags or the candlelit table.", true);
		return;
	}
	const defId = Object.keys(room.interactables).find(k => (room.interactables[k].sit || []).concat(room.interactables[k].lie || []).includes(best.lap || best.id));
	const def = defId && room.interactables[defId];
	const sitDown = () => {
		if (!sitOn([best.id])) return;
		if (best.lie) { $("#sleepov").classList.remove("hidden"); if (audio) audio.sfx("yawn", 0.5); }
		setTimeout(() => { if (me.upper !== "cuddle") loveAct("cuddle"); }, 350);
	};
	if (def && def.stand) walkTo(def.stand[0], def.stand[1], sitDown); else sitDown();
}
function loveFx(e, q) {
	if (e === "smooch") setTimeout(() => { heartsFx(myAvatar.root, 6, "#ff2d55", heartY(me.anim)); send({ t: "fx", kind: "smooch" }); if (audio) audio.sfx("smooch"); }, 450);
	else if (e === "cheekkiss") setTimeout(() => { heartsFx(myAvatar.root, 3, null, heartY(me.anim)); if (audio) audio.sfx("smack", 0.8); }, 400);
	else if (e === "cuddle") { heartsFx(myAvatar.root, 4, null, heartY(me.anim)); if (audio) audio.sfx("love", 0.4); }
	else if (e === "slowdance") { heartsFx(myAvatar.root, 5); if (audio) audio.sfx("love", 0.6); if (q) addLog("You're slow dancing with " + esc(q.look.name), true); }
	else if (e === "propose") {
		updateProps();
		if (audio) audio.sfx("chime", 0.7);
		setTimeout(() => { if (me.upper !== "propose") return; myAvatar.say("Will you be mine?"); send({ t: "chat", text: "Will you be mine?", auto: 1 }); }, 900);
	}
}
// someone kissed / cuddled / asked us to dance / proposed: join in
function onLoveAct(d, p) {
	const n = esc(p.look.name);
	switch (d.kind) {
		case "cuddle":
			if (me.upper === "cuddle" && me.partner === d.id) return true;
			doUpper("cuddle", LOVE_MS.cuddle, d.id);
			heartsFx(myAvatar.root, 4, null, heartY(me.anim));
			addLog(`<b>${n}</b> cuddled up with you`, true);
			if (audio) audio.sfx("love", 0.4);
			return true;
		case "smooch":
			doUpper("smooch", LOVE_MS.smooch, d.id);
			setTimeout(() => { heartsFx(myAvatar.root, 6, "#ff2d55", heartY(me.anim)); if (audio) audio.sfx("smooch"); }, 450);
			return true;
		case "cheekkiss":
			if (me.upper === "cuddle" && me.partner === d.id) {
				setTimeout(() => { heartsFx(myAvatar.root, 3, null, heartY(me.anim)); if (audio) audio.sfx("smack", 0.8); }, 400);
				addLog(`<b>${n}</b> kissed you on the cheek`, true);
				return true;
			}
			doUpper("blush", 2600);
			setTimeout(() => { if (audio) audio.sfx("smack", 0.8); }, 400);
			addLog(`<b>${n}</b> kissed you on the cheek`, true);
			return true;
		case "slowdance":
			doUpper("slowdance", LOVE_MS.slowdance, d.id);
			heartsFx(myAvatar.root, 5);
			if (audio) audio.sfx("love", 0.6);
			addLog(`<b>${n}</b> pulled you in for a slow dance`, true);
			return true;
		case "propose":
			doUpper("lovestruck", 7000);
			toast(`<b>${n}</b> is down on one knee with a ring...`, "Say yes!", () => sayYes(d.id), 15000);
			return true;
	}
	return false;
}
function sayYes(id) {
	const p = peers.get(id);
	if (!p) return;
	if (me.sit) standUp(true);
	me.h = Math.atan2(p.x - me.x, p.z - me.z);
	doUpper("heartarms", 3200);
	myAvatar.say("Yes! Yes! YES!");
	send({ t: "chat", text: "Yes! Yes! YES!", auto: 1 });
	send({ t: "act", kind: "yes", to: id });
	send({ t: "fx", kind: "yes" });
	heartsFx(myAvatar.root, 14);
	if (audio) audio.sfx("yes");
	addLog("You said yes to " + esc(p.look.name), true);
}
function onYes(p) {
	if (me.upper === "propose") { me.upper = null; me.partner = null; updateProps(); }
	doUpper("cheer", 2600);
	heartsFx(myAvatar.root, 10);
	toast(`<b>${esc(p.look.name)}</b> said YES!`, null, null, 7000);
}
// which side of you is your partner on (-1 right, 1 left, 0 in front)?
function coupleSide(x, z, h, sit, partnerId, upper) {
	if (!partnerId || !(COUPLE_POSES.includes(upper) || upper === "shake")) return 0;
	const po = posOf(partnerId);
	if (!po) return 0;
	const pp = bodyXZ(po), mp = bodyXZ({ x, z, sit });
	const dx = pp.x - mp.x, dz = pp.z - mp.z;
	const lx = dx * Math.cos(h) - dz * Math.sin(h), fz = dx * Math.sin(h) + dz * Math.cos(h);
	const spot = sit && room.sitSpots.find(s => s.id === sit);
	if (spot && (spot.lie || spot.bed)) return lx < 0 ? -1 : 1;
	return Math.abs(lx) > Math.abs(fz) * 0.8 ? (lx < 0 ? -1 : 1) : 0;
}
// Couples touch for real. Every frame we measure where the two bodies actually are (faces, near
// shoulders, chests) and scoot along the seat / mattress until they meet - and back off again if
// they'd sink into each other. Kisses then lean in the last bit (see kissReach).
const KISS_D = { smooch: 0.235, cheekkiss: 0.25, carrykiss: 0.235 };   // face centre to face centre when lips / cheek touch
const HEAD_MIN = 0.275;     // two heads never closer than this (skull radius ~0.135)
const _ca = new THREE.Vector3(), _cb = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function faceDist(a, b) { a.face.getWorldPosition(_ca); b.face.getWorldPosition(_cb); return _ca.distanceTo(_cb); }
function chestDist(a, b) {
	a.torso.updateWorldMatrix(true, false); b.torso.updateWorldMatrix(true, false);
	a.torso.localToWorld(_ca.set(0, 0.3, 0)); b.torso.localToWorld(_cb.set(0, 0.3, 0));
	return _ca.distanceTo(_cb);
}
function shoulderDist(a, b) {
	a.arms[a.coupleSide < 0 ? 0 : 1].sh.getWorldPosition(_ca);
	b.arms[b.coupleSide < 0 ? 0 : 1].sh.getWorldPosition(_cb);
	return _ca.distanceTo(_cb);
}
function snuggle(av, x, z, sit, partnerId, upper, dt) {
	const spot = sit && spotById(sit);
	const po = partnerId && posOf(partnerId), pav = partnerId && avatarOf(partnerId);
	const lean = upper === "nightkiss" || upper === "shake";
	av._slide = false;
	if (spot && !spot.lap && po && po.sit && pav && av.coupleSide && (SEATED_LOVE.includes(upper) || lean)) {
		const pp = bodyXZ(po), mp = bodyXZ({ x, z, sit });
		// only sideways (along the seat), never forward off it
		const sx = Math.cos(spot.h), sz = -Math.sin(spot.h);
		const lat = (pp.x - mp.x) * sx + (pp.z - mp.z) * sz;
		av._snugDir = [sx * Math.sign(lat), sz * Math.sign(lat)];
		if (lean) {
			// leaning over someone asleep: you move all the way over to them
			const pSpot = spotById(po.sit), l = Math.abs(lat);
			const want = clamp(pSpot && pSpot.lie ? l - 0.42 : (l - 0.42) / 2, 0, 0.3);
			av._snug = (av._snug || 0) + (want - (av._snug || 0)) * Math.min(1, dt * 4);
		} else av._slide = true;
	} else av._snug = (av._snug || 0) * (1 - Math.min(1, dt * 4));
	if (Math.abs(av._snug) > 0.001 && av._snugDir) {
		av.root.position.x += av._snugDir[0] * av._snug;
		av.root.position.z += av._snugDir[1] * av._snug;
	}
	if (!av._slide) return;
	// measure the real gap (each of the two closes half of it, so together they meet in the middle)
	const kiss = KISS_D[upper];
	const head = faceDist(av, pav) - (kiss || HEAD_MIN);
	const body = spot.lie
		? chestDist(av, pav) - (kiss ? 0.27 : av.coupleRole ? 0.33 : 0.29)   // lying: chest to chest
		: shoulderDist(av, pav) - 0.15;                                        // sitting: arm against arm
	av._bodyErr = body;
	const err = Math.min(head, body);
	av._snug = clamp(av._snug + err * 0.5 * Math.min(1, dt * (kiss ? 8 : 5)), -0.1, 0.38);
}
// kisses: lean in the rest of the way until the faces actually meet (or ease back if heads would bump).
// Sliding along the seat goes first; leaning only takes over once the bodies are touching.
function kissReach(av, upper, partnerId, dt) {
	const target = KISS_D[upper], pav = target && partnerId && avatarOf(partnerId);
	if (!pav) { av.kissAdj += -av.kissAdj * Math.min(1, dt * 3); return; }
	const e = faceDist(av, pav) - target;
	const canSlide = av._slide && av._bodyErr > 0.03 && av._snug < 0.37;
	if (e < 0 || !canSlide) av.kissAdj = clamp(av.kissAdj + e * 0.7 * Math.min(1, dt * 8), -0.3, 0.6);
	else av.kissAdj += -av.kissAdj * Math.min(1, dt * 3);
}
// little hearts keep floating up from cuddling / dancing couples
function loveAura(av, upper, anim, dt) {
	if (upper !== "cuddle" && upper !== "slowdance") return;
	av._auraT = (av._auraT || 0) + dt;
	if (av._auraT < 1.7) return;
	av._auraT = 0;
	heartsFx(av.root, 1, null, heartY(anim));
}

// ---------- carrying someone in your arms (to the bed or the sofa, for a lying-down cuddle)
// Ask -> they accept -> you carry them (they ride in your arms on every screen) -> press Cuddle
// (or click the bed / sofa) -> you walk over, lay them down and lie down beside them.
const CARRY_FURNITURE = { bed: { carried: "bedL", carrier: "bedR" }, sofa: { carried: "sofaLieB", carrier: "sofaLieA" } };
const CARRY_GRACE = 5000;
function offerCarry(id) {
	const p = peers.get(id);
	if (!p) return;
	const pr = p.look.gender === "female" ? "her" : "him";
	toast(`<b>${esc(p.look.name)}</b> is standing up. Pick ${pr} up and carry ${pr} to the bed or the sofa to cuddle?`, "Pick up", () => carryAct(id), 9000);
}
function carryAct(id) {
	if (me.carrying) { endCarry(); return; }
	if (me.carriedBy) hopDown();
	if (me.upper === "piano" || me.upper === "telescope") return;
	id = id && peers.get(id) && !peers.get(id).sit && !peers.get(id).carriedBy ? id : nearestPeer(12);
	const p = id && peers.get(id);
	if (!p) { myAvatar.say("Nobody here to pick up..."); return; }
	if (p.sit) { addLog(esc(p.look.name) + " is sitting down - ask them to stand up first.", true); return; }
	if (me.sit) standUp(true);
	const ask = () => {
		const q = peers.get(id);
		if (!q) return;
		me.h = Math.atan2(q.x - me.x, q.z - me.z);
		me.carryAsk = { id, t: now() };
		send({ t: "act", kind: "carryask", to: id });
		doUpper("heartarms", 1600);
		addLog(`You asked <b>${esc(q.look.name)}</b> if you can pick them up`, true);
	};
	const dx = me.x - p.x, dz = me.z - p.z, l = Math.hypot(dx, dz) || 1;
	if (l < 0.95) ask(); else walkTo(p.x + dx / l * 0.6, p.z + dz / l * 0.6, ask);
}
function acceptCarry(id) {
	const p = peers.get(id);
	if (!p) return;
	if (Math.hypot(p.x - me.x, p.z - me.z) > 3) { addLog(esc(p.look.name) + " walked away - get closer first.", true); return; }
	if (me.sit) standUp(true);
	if (me.carrying) endCarry();
	me.target = null; me.path = []; me.lock = null;
	me.anim = "idle"; me.upper = null; me.upperUntil = 0; me.partner = null;
	me.carriedBy = id; me.carriedAt = performance.now(); me.carryMiss = 0;
	send({ t: "act", kind: "carryok", to: id });
	sendPose(true);
	heartsFx(myAvatar.root, 5);
	if (audio) audio.sfx("love", 0.5);
	addLog(`<b>${esc(p.look.name)}</b> picked you up`, true);
	updateCarryBar();
}
function startCarry(id) {
	const p = peers.get(id);
	if (!p) return;
	me.carryAsk = null;
	if (me.sit) standUp(true);
	me.target = null; me.path = []; me.lock = null;
	me.carrying = id; me.carriedAt = performance.now(); me.carryMiss = 0;
	doUpper("carry", 1e9, id);
	heartsFx(myAvatar.root, 5);
	if (audio) audio.sfx("love", 0.5);
	addLog(`You picked up <b>${esc(p.look.name)}</b>. Press <b>Cuddle</b> or click the bed or sofa to lie down together.`, true);
	updateCarryBar();
}
// put them back on their feet (quiet = they already know)
function endCarry(quiet) {
	const id = me.carrying;
	if (!id) return;
	me.carrying = null;
	if (me.upper === "carry") { me.upper = null; me.partner = null; me.upperUntil = 0; }
	if (!quiet) send({ t: "act", kind: "carryend", to: id });
	updateCarryBar();
	sendPose(true);
}
function hopDown(quiet) {
	const id = me.carriedBy;
	if (!id) return;
	me.carriedBy = null;
	const p = freeFloorNear(me.x, me.z, me.h);
	me.x = p.x; me.z = p.z;
	if (!quiet) send({ t: "act", kind: "carryend", to: id });
	updateCarryBar();
	sendPose(true);
}
// room for two to lie down on that bed / sofa?
function carrySpots(id) {
	const c = CARRY_FURNITURE[id], taken = takenSpots();
	if (!c || taken.has(c.carried) || taken.has(c.carrier)) return null;
	return c;
}
// walk to the nearest free bed / sofa, lay them down there and lie down next to them
function carryToCuddle(furn) {
	const id = me.carrying, p = id && peers.get(id);
	if (!p) return;
	const opts = (furn ? [furn] : Object.keys(CARRY_FURNITURE)).filter(carrySpots);
	if (!opts.length) {
		myAvatar.say(furn ? "No room to lie down there..." : "The bed and the sofa are both taken...");
		return;
	}
	const dist = k => { const s = room.interactables[k].stand; return Math.hypot(s[0] - me.x, s[1] - me.z); };
	opts.sort((a, b) => dist(a) - dist(b));
	const k = opts[0], def = room.interactables[k];
	const layDown = () => {
		const c = carrySpots(k);
		if (me.carrying !== id || !peers.get(id)) return;
		if (!c) { myAvatar.say("Someone took our spot..."); return; }
		send({ t: "act", kind: "laydown", to: id, spot: c.carried });
		endCarry(true);
		if (!sitOn([c.carrier])) return;
		// wait for them to land next to us, then snuggle up
		const t0 = performance.now();
		const tryCuddle = () => {
			const q = peers.get(id);
			if (!q || !me.sit || performance.now() - t0 > 5000) return;
			if (q.sit && seatDist(me, q) < NEAR_SEAT) { if (me.upper !== "cuddle") loveAct("cuddle"); return; }
			setTimeout(tryCuddle, 200);
		};
		setTimeout(tryCuddle, 300);
	};
	if (dist(k) < 0.5) layDown();
	else walkTo(def.stand[0], def.stand[1], layDown);
}
// the one carrying leans down, the one being carried curls up toward their face
function carryKiss(e, id) {
	if (me.carrying === id) doUpper("carrykiss", LOVE_MS.smooch, id);
	else if (me.carriedBy === id) doUpper(e, LOVE_MS[e], id);
}
function onCarryAct(d, p) {
	const n = esc(p.look.name);
	switch (d.kind) {
		case "carryask":
			if (me.carriedBy || me.carrying || me.upper === "piano" || me.upper === "telescope") return true;
			toast(`<b>${n}</b> wants to pick you up and carry you`, "Let them", () => acceptCarry(d.id), 12000);
			return true;
		case "carryok":
			if (me.carryAsk && me.carryAsk.id === d.id && now() - me.carryAsk.t < 20000 && !me.carrying && !me.carriedBy) startCarry(d.id);
			else send({ t: "act", kind: "carryend", to: d.id });
			return true;
		case "carryend":
			if (me.carriedBy === d.id) { hopDown(true); addLog(`<b>${n}</b> put you down`, true); }
			if (me.carrying === d.id) { endCarry(true); addLog(`<b>${n}</b> hopped down`, true); }
			return true;
		case "laydown": {
			if (me.carriedBy !== d.id) return true;
			const spot = spotById(String(d.spot));
			me.carriedBy = null;
			updateCarryBar();
			if (spot && spot.lie && sitOn([spot.id])) addLog(`<b>${n}</b> laid you down gently`, true);
			else hopDown();
			return true;
		}
		case "smooch": case "cheekkiss":
			// kissed while carrying / being carried: keep holding on
			if (me.carrying !== d.id && me.carriedBy !== d.id) return false;
			carryKiss(d.kind, d.id);
			setTimeout(() => { heartsFx(myAvatar.root, 5, d.kind === "smooch" ? "#ff2d55" : null); if (audio) audio.sfx(d.kind === "smooch" ? "smooch" : "smack", 0.8); }, 400);
			addLog(`<b>${n}</b> kissed you`, true);
			return true;
	}
	return false;
}
// each frame: ride along in their arms / make sure whoever we're holding is still with us
function carryTick(dt) {
	const t = performance.now();
	if (me.carriedBy) {
		const q = peers.get(me.carriedBy);
		const ok = q && (q.upper === "carry" || q.upper === "carrykiss") && q.partner === MY_ID;
		me.carryMiss = ok ? 0 : (me.carryMiss || 0) + dt;
		if (!q || (t - me.carriedAt > CARRY_GRACE && me.carryMiss > 2.5)) { hopDown(true); return; }
		me.x = q.x; me.z = q.z; me.h = q.h;
		me.speed = 0; me.target = null; me.path = [];
	}
	if (me.carrying) {
		const q = peers.get(me.carrying);
		const ok = q && q.carriedBy === MY_ID;
		me.carryMiss = ok ? 0 : (me.carryMiss || 0) + dt;
		if (!q || (t - me.carriedAt > CARRY_GRACE && me.carryMiss > 2.5)) endCarry(true);
	}
}
function updateCarryBar() {
	const bar = $("#carrybar");
	const p = peers.get(me.carrying || me.carriedBy || "");
	bar.classList.toggle("hidden", !p);
	if (!p) return;
	$("#carrytxt").innerHTML = me.carrying ? `Carrying <b>${esc(p.look.name)}</b>` : `<b>${esc(p.look.name)}</b> is carrying you`;
	$("#carrycuddle").classList.toggle("hidden", !me.carrying);
	$("#carrydown").textContent = me.carrying ? "Put down" : "Hop down";
}
$("#carrycuddle").onclick = () => carryToCuddle();
$("#carrydown").onclick = () => { if (me.carrying) endCarry(); else hopDown(); };
// a carried person lies across the carrier's arms: hips in front of them, head on their right
function placeCarried(av, cav, dt) {
	const c = cav.root.position, H = cav.root.rotation.y;
	const fx = Math.sin(H), fz = Math.cos(H);
	const hx = -Math.cos(H), hz = Math.sin(H);
	// kissing: they get lifted more upright and pulled in toward your chest, so your faces can meet
	const kissing = !!KISS_D[av.upper] || cav.upper === "carrykiss";
	av._ck = (av._ck || 0) + ((kissing ? 1 : 0) - (av._ck || 0)) * Math.min(1, (dt || 0.016) * 4);
	const ck = av._ck;
	const a = 0.32 + 0.4 * ck, L = av.hipY * av.body.scale.y;   // tilt (head up), feet-to-hips
	const px = c.x + fx * (0.36 - 0.06 * ck) - hx * 0.2 * ck, pz = c.z + fz * (0.36 - 0.06 * ck) - hz * 0.2 * ck, py = c.y + (1.0 + 0.05 * ck) * cav.body.scale.y;
	av.root.position.set(px - hx * L * Math.cos(a), py - L * Math.sin(a), pz - hz * L * Math.cos(a));
	av.root.rotation.order = "YXZ";
	av.root.rotation.set(-Math.PI / 2 + a, H + Math.PI / 2, 0);
}
function placeBody(av, x, z, h, sit, carriedBy, dt) {
	const cav = carriedBy && avatarOf(carriedBy);
	if (cav) placeCarried(av, cav, dt); else placeAvatar(av, x, z, h, sit);
}
// sofa-lying and armchair-lap couples pose differently from side-by-side ones
function coupleRole(sit, partnerId, upper) {
	if (!sit || !partnerId || !SEATED_LOVE.includes(upper)) return null;
	const spot = spotById(sit);
	if (spot && spot.sofaLie) return spot.sofaLie;
	if (sit === "armchairLap") return "lapsitter";
	const po = posOf(partnerId);
	if (sit === "armchair" && po && po.sit === "armchairLap") return "lapholder";
	return null;
}

// ---------- flowers from the terrace
function pickFlower() {
	if (me.holding === "mug") { addLog("Your hands are full - drink or put down your coffee first.", true); return; }
	me.holding = "flower";
	updateProps();
	sendPose(true);
	if (audio) audio.sfx("pop", 0.5);
	addLog("You picked a flower. Click someone to give it to them.", true);
}
// hand whatever you hold (a flower, a coffee) to someone
function giveHeld(id) {
	const p = peers.get(id), what = me.holding;
	if (!p || !what) return;
	if (what === "mug" && me.upper === "drink") { addLog("Finish your sip first.", true); return; }
	const dx = me.x - p.x, dz = me.z - p.z, l = Math.hypot(dx, dz) || 1;
	const hand = () => {
		const q = peers.get(id);
		if (!q) return;
		me.h = Math.atan2(q.x - me.x, q.z - me.z);
		doUpper("give", 1600, id);
		send({ t: "act", kind: "give", to: id });
		setTimeout(() => {
			if (me.holding !== what) return;
			const s = me.sips;
			me.holding = null; me.sips = 0;
			updateProps(); sendPose(true);
			send({ t: "fx", kind: what, to: id, s });
			addLog("You gave " + esc(q.look.name) + (what === "mug" ? " a coffee" : " a flower"), true);
		}, 1100);
	};
	if (l < 1.0) hand(); else walkTo(p.x + dx / l * 0.7, p.z + dz / l * 0.7, hand);
}

// ---------- telescope
let scopeOn = false, starT = 0;
const MOON_POINT = new THREE.Vector3(0, 0, -3).addScaledVector(MOON_DIR, 50);   // the moon painted on the sky dome
function startScope() {
	const tel = room.terrace.telescope;
	if (me.sit) standUp(true);
	me.x = tel.stand[0]; me.z = tel.stand[1];
	me.h = room.interactables.telescope.face;
	scopeOn = true;
	doUpper("telescope", 1e9);
	$("#scope").classList.remove("hidden");
	addLog("You're looking at the moon. Watch for shooting stars! (Esc to stop)", true);
}
function stopScope() {
	if (!scopeOn) return;
	scopeOn = false;
	$("#scope").classList.add("hidden");
	if (me.upper === "telescope") { me.upper = null; me.upperUntil = 0; sendPose(true); }
}
// ---------- TV mode: watch from your own eyes on the sofa / armchair, no head or name tag in the way
let tvMode = false;
const _tvAt = new THREE.Vector3(), _tvEye = new THREE.Vector3();
function canTVMode() { return me.anim === "sit" && TV_SEATS.includes(me.sit); }
function enterTV() {
	if (!canTVMode() || tvMode) return;
	tvMode = true;
	document.body.classList.add("tvmode");
	addLog("TV mode - <b>F</b> or <b>Esc</b> to leave", true);
}
function exitTV() {
	if (!tvMode) return;
	tvMode = false;
	document.body.classList.remove("tvmode");
}
const stars = [];
function shootingStar() {
	const dir = room.terrace.telescope.dir.clone();
	const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
	const up = new THREE.Vector3().crossVectors(side, dir).normalize();
	const start = dir.clone().multiplyScalar(40).addScaledVector(side, (Math.random() - 0.5) * 18).addScaledVector(up, 4 + Math.random() * 8).add(new THREE.Vector3(0, 0, -3));
	const vel = side.clone().multiplyScalar(Math.random() < 0.5 ? -1 : 1).addScaledVector(up, -0.6).normalize().multiplyScalar(26);
	const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.12, 4.5, 6), new THREE.MeshBasicMaterial({ color: "#fff6d8", transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false }));
	m.position.copy(start);
	m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize().negate());
	m.userData = { vel, life: 0 };
	scene.add(m);
	stars.push(m);
}
function updateStars(dt) {
	starT += dt;
	if (scopeOn && starT > 1.6 + Math.random() * 2) { starT = 0; shootingStar(); send({ t: "fx", kind: "star" }); }
	for (let i = stars.length - 1; i >= 0; i--) {
		const m = stars[i];
		m.userData.life += dt;
		m.position.addScaledVector(m.userData.vel, dt);
		m.material.opacity = Math.max(0, 0.95 - m.userData.life * 0.9);
		if (m.userData.life > 1.1) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); stars.splice(i, 1); }
	}
}

// ---------- invitations: "go there" walks you over instead of teleporting a popup
const lastInvite = {};
function inviteFor(p) {
	if (!entered || !p.upper || me.anim === "sleep") return;
	const t = now();
	if (lastInvite[p.upper] && t - lastInvite[p.upper] < 25000) return;
	const n = esc(p.look.name);
	let text = null, btn = null, go = null;
	if (p.upper === "piano") { text = `<b>${n}</b> is playing the piano`; btn = "Go listen"; go = () => walkTo(0.95, 3.9, () => { me.h = Math.atan2(0.2 - me.x, 5.4 - me.z); }); }
	else if (p.upper === "paint") { text = `<b>${n}</b> is painting on the terrace`; btn = "Paint together"; go = () => { const st = room.interactables.easel.stands; const free = st.find(s => Math.hypot(s[0] - p.x, s[1] - p.z) > 0.3) || st[1]; walkTo(free[0], free[1], "easel"); }; }
	else if (p.upper === "telescope") { text = `<b>${n}</b> is looking at the stars`; btn = "Go see"; go = () => walkTo(room.terrace.telescope.stand[0] - 0.6, room.terrace.telescope.stand[1] + 0.6, () => { me.h = Math.atan2(p.x - me.x, p.z - me.z); }); }
	else if (p.upper === "warm") { text = `<b>${n}</b> is sitting by the fire`; btn = "Join"; go = () => walkTo(room.terrace.fire.x - 1.05, room.terrace.fire.z - 0.05, "bean0"); }
	if (!text) return;
	lastInvite[p.upper] = t;
	toast(text, btn, go, 12000);
}
// what's in your hand: a mug while drinking, the brush while painting, else the remote if you hold it
function updateProps() {
	const kind = me.upper === "drink" ? "mug" : me.upper === "paint" || me.upper === "write" ? "brush" : me.upper === "propose" ? "ring" : me.upper === "tug" ? null
		: me.holding === "mug" ? "mug" : me.holding === "flower" ? "flower" : get("remote").by === MY_ID ? "remote" : null;
	myAvatar.setProp(kind);
}

// ============================================================ input
const keys = new Set();
function typing() { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); }
addEventListener("keydown", e => {
	if (!entered) return;
	const k = e.key.toLowerCase();
	if (e.key === "Escape") {
		if (document.querySelector(".bigphoto")) document.querySelector(".bigphoto").remove();
		else if (modalKind) closeModal();
		else if (typing()) document.activeElement.blur();
		else if (scopeOn) stopScope();
		else if (wheelKind) closeWheel();
		else if (drawOpen) closeDraw();
		else if (remoteOpen) closeRemote();
		else if (loveOpen) closeLove();
		else if (tvMode) exitTV();
		else if (me.carrying) endCarry();
		else if (me.carriedBy) hopDown();
		else if (me.sit) standUp();
		else if (me.anim === "floor") { me.anim = "idle"; sendPose(true); }
		return;
	}
	if (typing()) return;
	// tug of war: mash space
	if (fightView && (k === " " || k === "e") && (fightView.a === MY_ID || fightView.b === MY_ID)) { e.preventDefault(); if (!e.repeat) tugTap(); return; }
	if (me.upper === "piano" && !modalKind) {
		let n = -1;
		if (KEYMAP_HI.indexOf(k) >= 0) n = 60 + KEYMAP_HI.indexOf(k);
		else if (KEYMAP_LO.indexOf(k) >= 0) n = 48 + KEYMAP_LO.indexOf(k);
		if (n >= 0) { e.preventDefault(); if (!e.repeat) playKey(n); return; }
		if (k.startsWith("arrow")) standUp();
		return;
	}
	if (modalKind) return;
	if (wheelKey(k, e)) return;
	if (k === "enter" || k === "t") { e.preventDefault(); $("#chat").focus(); return; }
	if (k === "e" || k === " ") { e.preventDefault(); const o = promptOpts.find(x => x.k === "E"); if (o) o.fn(); return; }
	if (k === "1") emote("kiss"); else if (k === "2") emote("smooch"); else if (k === "3") emote("carry");
	else if (k === "f" || k === "g" || k === "r") { const o = promptOpts.find(x => x.k === k.toUpperCase()); if (o) { e.preventDefault(); o.fn(); return; } }
	keys.add(k);
	if (k.startsWith("arrow")) e.preventDefault();
});
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());

const chatEl = $("#chat");
chatEl.addEventListener("keydown", e => {
	if (e.key === "Enter") {
		const text = chatEl.value.trim().slice(0, 240);
		if (text) {
			const m = { id: newChatId(), ts: now(), name: profile.name, color: profile.top, text };
			myAvatar.say(text);
			send({ t: "chat", text, mid: m.id });
			chatMsg(m);
			saveChat(m);
			chatEl.value = "";
		} else chatEl.blur();
	}
});
document.querySelectorAll(".em[data-e]").forEach(b => b.addEventListener("click", () => emote(b.dataset.e)));

// pointer: drag to orbit, click/tap to walk or use things
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
function pick(cx, cy) {
	ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
	ray.setFromCamera(ndc, camera);
	const hits = ray.intersectObjects(scene.children, true);
	for (const h of hits) {
		if (isMine(h.object) || h.object.isSprite || !visibleChain(h.object)) continue;
		return h;
	}
	return null;
}
function visibleChain(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function isMine(o) { while (o) { if (o === myAvatar.root) return true; o = o.parent; } return false; }
function findPeer(o) { while (o) { if (o.userData && o.userData.peerId) return o.userData.peerId; o = o.parent; } return null; }
canvas.addEventListener("pointerdown", e => {
	if (!entered) return;
	canvas.focus();
	drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, yaw: cam.yaw, pitch: cam.pitch };
	canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
	if (drag && drag.id === e.pointerId) {
		const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
		drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
		if (drag.moved > 5) {
			cam.yaw = drag.yaw - dx * 0.006;
			cam.pitch = Math.max(0.05, Math.min(1.35, drag.pitch + dy * 0.004));
		}
		return;
	}
	if (e.pointerType === "mouse") hoverAt(e.clientX, e.clientY);
});
canvas.addEventListener("pointerup", e => {
	if (!drag || drag.id !== e.pointerId) return;
	const clicked = drag.moved <= 5;
	drag = null;
	if (!clicked || modalKind) return;
	const h = pick(e.clientX, e.clientY);
	if (!h) return;
	// piano keys play directly while you sit at the piano
	if (h.object.userData.note !== undefined) {
		if (me.upper === "piano") { playKey(h.object.userData.note); return; }
		walkTo(room.interactables.piano.stand[0], room.interactables.piano.stand[1], "piano");
		return;
	}
	const pid = findPeer(h.object);
	if (pid) {
		const p = peers.get(pid);
		if (p && (me.carrying === pid || me.carriedBy === pid)) { /* the one in your arms (or holding you): nothing to do */ }
		else if (p && isAsleep(p)) wakePeer(pid);
		else if (p && me.holding) giveHeld(pid);
		else if (p) { if (!me.sit) me.h = Math.atan2(p.x - me.x, p.z - me.z); emote("wave"); }
		return;
	}
	if (h.object.userData.cupId) { goPickCup(h.object.userData.cupId); return; }
	const id = findInteract(h.object);
	if (id) {
		const def = room.interactables[id], st = standOf(id);
		const d = Math.hypot(st[0] - me.x, st[1] - me.z);
		if (d < 1.5 || canReach(id) || (me.sit && def.sit && def.sit.includes(me.sit))) interact(id);
		else walkTo(st[0], st[1], id);
		return;
	}
	walkTo(h.point.x, h.point.z, null);
	clickMarker(h.point.x, h.point.z);
});
canvas.addEventListener("wheel", e => { e.preventDefault(); if (tvMode) return; cam.dist = Math.max(1.2, Math.min(7.5, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
function findInteract(o) { while (o) { if (o.userData && o.userData.interact) return o.userData.interact; o = o.parent; } return null; }
let hoverT = 0;
function hoverAt(x, y) {
	if (modalKind || performance.now() - hoverT < 60) return;
	hoverT = performance.now();
	const h = pick(x, y);
	let label = null, pointer = false;
	if (h) {
		if (h.object.userData.note !== undefined) { pointer = true; label = me.upper === "piano" ? null : "Play the piano"; }
		else {
			const pid = findPeer(h.object);
			if (pid) { const p = peers.get(pid); label = p ? (me.carrying === pid ? "Press Cuddle or click the bed / sofa" : me.carriedBy === pid ? null : isAsleep(p) ? "Wake " + p.look.name + " up" : me.holding === "flower" ? "Give " + p.look.name + " your flower" : me.holding === "mug" ? "Give " + p.look.name + " your coffee" : "Wave at " + p.look.name) : null; }
			else if (h.object.userData.cupId) label = me.holding === "mug" ? null : "Pick up the coffee";
			else { const id = findInteract(h.object); if (id) label = labelOf(id); }
		}
	}
	const tip = $("#tip");
	canvas.style.cursor = label || pointer ? "pointer" : "default";
	if (label) { tip.textContent = label; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.remove("hidden"); }
	else tip.classList.add("hidden");
}
function walkTo(x, z, act) {
	if (me.carriedBy) hopDown();
	if (me.sit) standUp(true);
	if (drawOpen) closeDraw();
	stopScope();
	if (me.anim === "floor") me.anim = "idle";
	if (!get("terraceDoor") && areaOf(x, z) !== areaOf(me.x, me.z)) {
		const st = standOf("terraceDoor");
		if (Math.hypot(st[0] - me.x, st[1] - me.z) > 0.3) { walkTo(st[0], st[1], () => { setShared("terraceDoor", true); walkTo(x, z, act); }); return; }
		setShared("terraceDoor", true);
	}
	// route around furniture (and through the French doors between room and terrace)
	const pts = findPath(me.x, me.z, x, z) || [{ x, z }];
	me.final = pts[pts.length - 1];
	me.target = pts.shift();
	me.path = pts;
	me.targetAct = act;
	me.stuck = 0;
}
// ---------- grid A* pathfinding over everything you can walk on
const GRID = { x0: -7.1, z0: -12.1, s: 0.2, w: 72, h: 92 };
let gridBlocked = null;
function buildGrid() {
	gridBlocked = new Uint8Array(GRID.w * GRID.h);
	for (let j = 0; j < GRID.h; j++) for (let i = 0; i < GRID.w; i++) {
		const x = GRID.x0 + (i + 0.5) * GRID.s, z = GRID.z0 + (j + 0.5) * GRID.s;
		gridBlocked[j * GRID.w + i] = blocked(x, z, true) ? 1 : 0;
	}
}
function cellOf(x, z) { return [Math.floor((x - GRID.x0) / GRID.s), Math.floor((z - GRID.z0) / GRID.s)]; }
function cellFree(i, j) { return i >= 0 && j >= 0 && i < GRID.w && j < GRID.h && !gridBlocked[j * GRID.w + i]; }
function nearestFree(i, j) {
	if (cellFree(i, j)) return [i, j];
	for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
		if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
		if (cellFree(i + di, j + dj)) return [i + di, j + dj];
	}
	return null;
}
function lineClear(ax, az, bx, bz) {
	const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.08);
	for (let k = 1; k <= n; k++) { const u = k / n; if (blocked(ax + (bx - ax) * u, az + (bz - az) * u, true)) return false; }
	return true;
}
function findPath(sx, sz, tx, tz) {
	if (!gridBlocked) buildGrid();
	if (lineClear(sx, sz, tx, tz)) return [{ x: tx, z: tz }];
	const s0 = nearestFree(...cellOf(sx, sz)), t0 = nearestFree(...cellOf(tx, tz));
	if (!s0 || !t0) return null;
	const W = GRID.w, N = W * GRID.h;
	const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
	const start = s0[1] * W + s0[0], goal = t0[1] * W + t0[0];
	const hfun = c => Math.hypot((c % W) - t0[0], Math.floor(c / W) - t0[1]);
	g[start] = 0;
	const f = new Float32Array(N).fill(Infinity); f[start] = hfun(start);
	// binary min-heap on f (the old linear scan got slow on long walks on weak phones)
	const heap = [start];
	const push = c => {
		let i = heap.push(c) - 1;
		while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[c]) break; heap[i] = heap[p]; i = p; }
		heap[i] = c;
	};
	const pop = () => {
		const top = heap[0], last = heap.pop();
		if (heap.length) {
			let i = 0;
			for (;;) {
				const l = 2 * i + 1, r = l + 1;
				let m = i, mv = f[last];
				if (l < heap.length && f[heap[l]] < mv) { m = l; mv = f[heap[l]]; }
				if (r < heap.length && f[heap[r]] < mv) m = r;
				if (m === i) break;
				heap[i] = heap[m]; i = m;
			}
			heap[i] = last;
		}
		return top;
	};
	let found = false, iter = 0;
	while (heap.length && iter++ < 20000) {
		const c = pop();
		if (c === goal) { found = true; break; }
		if (closed[c]) continue;
		closed[c] = 1;
		const ci = c % W, cj = Math.floor(c / W);
		for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
			if (!di && !dj) continue;
			const ni = ci + di, nj = cj + dj;
			if (!cellFree(ni, nj)) continue;
			if (di && dj && (!cellFree(ci + di, cj) || !cellFree(ci, cj + dj))) continue; // no corner cutting
			const nc = nj * W + ni;
			const ng = g[c] + (di && dj ? 1.414 : 1);
			if (ng < g[nc]) { g[nc] = ng; came[nc] = c; f[nc] = ng + hfun(nc); push(nc); }
		}
	}
	if (!found) return null;
	const cells = [];
	for (let c = goal; c !== -1; c = came[c]) cells.push(c);
	cells.reverse();
	const raw = cells.map(c => ({ x: GRID.x0 + ((c % W) + 0.5) * GRID.s, z: GRID.z0 + (Math.floor(c / W) + 0.5) * GRID.s }));
	raw.push(blocked(tx, tz, true) ? raw[raw.length - 1] : { x: tx, z: tz });
	// string-pull: skip every waypoint we can walk straight past
	const out = [];
	let ax = sx, az = sz, k = 0;
	while (k < raw.length) {
		let far = k;
		for (let m = raw.length - 1; m > k; m--) if (lineClear(ax, az, raw[m].x, raw[m].z)) { far = m; break; }
		out.push(raw[far]);
		ax = raw[far].x; az = raw[far].z;
		k = far + 1;
	}
	return out;
}
function runAct(a) { if (typeof a === "function") a(); else if (a) interact(a); }
const marker = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.17, 28), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
function clickMarker(x, z) { marker.position.set(x, 0.02, z); marker.material.opacity = 0.8; marker.scale.setScalar(1); }

// touch joystick
const joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.body.classList.add("touch");
const joyEl = $("#joy"), knob = joyEl.querySelector("i");
joyEl.addEventListener("pointerdown", e => { joy.id = e.pointerId; const r = joyEl.getBoundingClientRect(); joy.x = r.left + r.width / 2; joy.y = r.top + r.height / 2; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
joyEl.addEventListener("pointermove", e => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.dx = joy.dy = 0; knob.style.transform = ""; };
joyEl.addEventListener("pointerup", joyEnd);
joyEl.addEventListener("pointercancel", joyEnd);
function joyMove(e) {
	let dx = e.clientX - joy.x, dy = e.clientY - joy.y;
	const l = Math.hypot(dx, dy), max = 46;
	if (l > max) { dx *= max / l; dy *= max / l; }
	joy.dx = dx / max; joy.dy = dy / max;
	knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

// ============================================================ movement + collision
function blocked(x, z, ignorePeers) {
	if (!walkable(x, z, RADIUS)) return true;
	for (const c of room.colliders) if (x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS) return true;
	if (ignorePeers) return false;
	// other people are solid too (only blocks moving closer, so you can never get stuck inside someone)
	for (const p of peers.values()) {
		if (p.sit || p.carriedBy) continue;
		const d = Math.hypot(x - p.x, z - p.z);
		if (d < RADIUS * 1.8 && d < Math.hypot(me.x - p.x, me.z - p.z)) return true;
	}
	return false;
}
// the closed terrace door is a wall across the doorway (stepping away from it is always fine)
const DOOR_Z = -6.2;
function doorShut(x, z) {
	if (get("terraceDoor") || x < DOOR.x0 - 0.1 || x > DOOR.x1 + 0.1) return false;
	const d = Math.abs(z - DOOR_Z);
	return d < RADIUS && d <= Math.abs(me.z - DOOR_Z);
}
// where to stand to use something (the terrace door works from either side)
function standOf(id) {
	const def = room.interactables[id];
	return def.standOut && areaOf(me.x, me.z) === "terrace" ? def.standOut : def.stand;
}
function angleLerp(a, b, k) { return a + angleDiff(a, b) * k; }
function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
let lastPoseSent = 0, lastPoseSig = "";
function sendPose(force) {
	const t = performance.now();
	const sig = me.x.toFixed(2) + me.z.toFixed(2) + me.h.toFixed(1) + me.anim + me.upper + me.sit + myAvatar.propKind + me.pu.toFixed(2) + me.pv.toFixed(2);
	if (force || (sig !== lastPoseSig && t - lastPoseSent > 80) || t - lastPoseSent > 1500) {
		lastPoseSent = t; lastPoseSig = sig;
		send(poseMsg());
	}
}
// sitting up in bed is its own pose (legs stretched out on the mattress)
function avatarAnim(anim, sit, carriedBy) {
	if (carriedBy && avatarOf(carriedBy)) return "carried";
	if (anim === "sit" && sit && sit.indexOf("bedSit") === 0) return "bedsit";
	return anim;
}
function placeAvatar(av, x, z, h, sitId) {
	const spot = sitId && room.sitSpots.find(s => s.id === sitId);
	av.root.position.set(x, spot ? spot.y : 0, z);
	if (spot && spot.lie) { av.root.rotation.order = "YXZ"; av.root.rotation.set(-Math.PI / 2, spot.h, 0); }
	else if (spot && spot.swing) {
		// ride along with the swing seat
		const sw = room.terrace.swing, a = sw.angle;
		av.root.position.x -= Math.sin(a) * sw.L * Math.sin(spot.h);
		av.root.position.z -= Math.sin(a) * sw.L * Math.cos(spot.h);
		av.root.position.y += (1 - Math.cos(a)) * sw.L;
		av.root.rotation.order = "YXZ"; av.root.rotation.set(a, spot.h, 0);
	}
	else { av.root.rotation.order = "XYZ"; av.root.rotation.set(0, h, 0); }
}
// turn the head toward the nearest other person who's close by
function lookYawFor(x, z, h, others) {
	let best = null, bd = 4.5;
	for (const o of others) { const d = Math.hypot(o.x - x, o.z - z); if (d > 0.01 && d < bd) { bd = d; best = o; } }
	if (!best) return null;
	const rel = angleDiff(h, Math.atan2(best.x - x, best.z - z));
	return Math.abs(rel) < 1.6 ? rel : null;
}
function updateMe(dt) {
	let ix = 0, iz = 0;
	if (!modalKind && !typing() && me.upper !== "piano") {
		if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
		if (keys.has("d") || keys.has("arrowright")) ix += 1;
		if (keys.has("w") || keys.has("arrowup")) iz += 1;
		if (keys.has("s") || keys.has("arrowdown")) iz -= 1;
	}
	if (joy.id !== null) { ix += joy.dx; iz -= joy.dy; }
	if (me.upper === "tug") { ix = 0; iz = 0; }
	// being carried: walking means hopping down, otherwise ride along in their arms
	if (me.carriedBy && Math.abs(ix) + Math.abs(iz) > 0.08) hopDown();
	carryTick(dt);
	if (me.carriedBy) { ix = 0; iz = 0; }
	const run = keys.has("shift");
	let mx = 0, mz = 0, want = 0;
	if (Math.abs(ix) + Math.abs(iz) > 0.08) {
		me.target = null; me.path = [];
		if (me.sit) standUp();
		if (drawOpen) closeDraw();
		stopScope();
		if (me.anim === "floor") { me.anim = "idle"; sendPose(true); }
		const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
		const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
		mx = fx * iz + rx * ix; mz = fz * iz + rz * ix;
		const l = Math.hypot(mx, mz);
		want = Math.min(1, l) * (run ? 1.75 : 1) * (me.carrying ? 0.75 : 1);
		mx /= l; mz /= l;
	} else if (me.target) {
		const dx = me.target.x - me.x, dz = me.target.z - me.z, l = Math.hypot(dx, dz);
		if (l < 0.12) {
			if (me.path.length) me.target = me.path.shift();
			else {
				me.target = null;
				if (me.targetAct) { const a = me.targetAct; me.targetAct = null; runAct(a); }
			}
		} else { mx = dx / l; mz = dz / l; want = Math.min(1.25, 0.4 + l + (me.path.length ? 1 : 0)) * (me.carrying ? 0.75 : 1); }
	}
	if (me.sit) want = 0;
	me.speed += (want - me.speed) * Math.min(1, dt * 10);
	if (me.speed > 0.02 && (mx || mz) && !me.sit) {
		const v = me.speed * 2.6 * dt;
		const nx = me.x + mx * v, nz = me.z + mz * v;
		const ox = me.x, oz = me.z;
		// if we somehow ended up inside furniture, let us walk straight out of it
		const trapped = blocked(me.x, me.z, true) && walkable(me.x, me.z, 0.05);
		if (((trapped && walkable(nx, me.z, 0.05)) || !blocked(nx, me.z)) && !doorShut(nx, me.z)) me.x = nx;
		if (((trapped && walkable(me.x, nz, 0.05)) || !blocked(me.x, nz)) && !doorShut(me.x, nz)) me.z = nz;
		me.h = angleLerp(me.h, Math.atan2(mx, mz), Math.min(1, dt * 12));
		if (me.target) {
			const moved = Math.hypot(me.x - ox, me.z - oz);
			if (moved < v * 0.25) { me.stuck += dt; if (me.stuck > 0.6) { const a = me.targetAct, fin = me.final || me.target; me.target = null; me.targetAct = null; me.path = []; if (a && fin && Math.hypot(fin.x - me.x, fin.z - me.z) < 2.0) runAct(a); } }
			else me.stuck = 0;
		}
		if (me.upper && !["drink", "tug", "carry", "carrykiss"].includes(me.upper)) { me.upper = null; me.partner = null; updateProps(); }
	}
	if (me.upperUntil && performance.now() > me.upperUntil) {
		me.upperUntil = 0;
		const back = me.resume && peers.get(me.resume);
		if (me.upper === "carrykiss" && me.carrying) { me.upper = "carry"; me.upperUntil = performance.now() + 1e9; sendPose(true); }
		else if (back && me.sit && back.sit && seatDist(me, back) < NEAR_SEAT) { me.upper = "cuddle"; me.partner = me.resume; me.upperUntil = performance.now() + LOVE_MS.cuddle; sendPose(true); }
		me.resume = null;
		if (me.upper === "carry" || me.upper === "cuddle") { /* still holding / snuggling */ }
		else if (me.upper && !["paint", "piano", "tug", "telescope", "carry"].includes(me.upper)) { me.upper = null; me.partner = null; updateProps(); sendPose(true); }
	}
	// keep facing whoever we're hugging / fighting / kissing / dancing with
	if (me.partner && (["tug", "hug", "highfive", "give"].includes(me.upper) || (!me.sit && ["smooch", "cheekkiss", "slowdance", "propose"].includes(me.upper)))) {
		const q = peers.get(me.partner);
		if (q) me.h = angleLerp(me.h, Math.atan2(q.x - me.x, q.z - me.z), Math.min(1, dt * 8));
	}
	// slow dance: both of you turn slowly around the spot between you
	if (me.upper === "slowdance" && me.partner && !me.sit) {
		const q = peers.get(me.partner);
		if (q) {
			const cx = (me.x + q.x) / 2, cz = (me.z + q.z) / 2;
			const a = Math.atan2(me.x - cx, me.z - cz) + dt * 0.45;
			const r = COUPLE_GAP.slowdance / 2;
			const nx = cx + Math.sin(a) * r, nz = cz + Math.cos(a) * r;
			if (!blocked(nx, nz, true)) { me.x = nx; me.z = nz; }
		}
	}
	// couple lock: whoever started a kiss / hug / dance eases in to exactly the right distance
	// (walking stops a little short, and people are solid, so without this you'd hover half a metre away)
	if (me.lock) {
		const q = peers.get(me.lock.id), gap = COUPLE_GAP[me.upper];
		if (!q || me.sit || q.sit || me.partner !== me.lock.id || !gap) me.lock = null;
		else {
			const dx = me.x - q.x, dz = me.z - q.z, l = Math.hypot(dx, dz) || 1;
			const k = Math.min(1, dt * 5);
			const nx = me.x + (q.x + dx / l * gap - me.x) * k, nz = me.z + (q.z + dz / l * gap - me.z) * k;
			if (!blocked(nx, nz, true)) { me.x = nx; me.z = nz; }
		}
	}
	// they got up: the cuddle is over
	if (SEATED_LOVE.includes(me.upper) && me.partner && me.sit) {
		const q = peers.get(me.partner);
		if (!q || !q.sit || seatDist(me, q) > NEAR_SEAT + 0.2) { me.upper = null; me.partner = null; me.upperUntil = 0; sendPose(true); }
	}
	// nobody left in the armchair = no lap to sit on
	if (me.sit === "armchairLap" && !whoSits("armchair")) standUp();
	placeBody(myAvatar, me.x, me.z, me.h, me.sit, me.carriedBy, dt);
	myAvatar.carriedBy = me.carriedBy;
	myAvatar.coupleRole = coupleRole(me.sit, me.partner, me.upper);
	myAvatar.coupleSide = coupleSide(me.x, me.z, me.h, me.sit, me.partner, me.upper);
	snuggle(myAvatar, me.x, me.z, me.sit, me.partner, me.upper, dt);
	kissReach(myAvatar, me.upper, me.partner, dt);
	loveAura(myAvatar, me.upper, me.anim, dt);
	myAvatar.speed = me.sit ? 0 : me.speed;
	myAvatar.anim = avatarAnim(me.anim, me.sit, me.carriedBy);
	myAvatar.upper = me.upper;
	myAvatar.lookYaw = me.sit ? null : lookYawFor(me.x, me.z, me.h, peers.values());
	sendPose(false);
}
// Where should each hand be? (real contact with keys, paper, mouth, people, the remote)
const _ik = [new THREE.Vector3(), new THREE.Vector3()], _ikB = [new THREE.Vector3(), new THREE.Vector3()];
const _tmpV = new THREE.Vector3(), _tmpV2 = new THREE.Vector3();
function assignIK(av, upper, sit, partnerId, store) {
	av.ik[0] = av.ik[1] = null;
	av.ikReach[0] = av.ikReach[1] = 0.075;
	av.ikPole = null;
	if (av.carriedBy) {
		const cav = avatarOf(av.carriedBy);
		if (cav) { cav.head.getWorldPosition(store[1]); store[1].y -= 0.2; av.ik[1] = store[1]; }
		return;
	}
	if (!upper) return;
	const t = performance.now();
	if (upper === "piano" && sit === "bench") {
		const pn = av._pn || [69, 53], pt = av._pt || [0, 0];
		for (let i = 0; i < 2; i++) {
			const k = room.pianoKeys.get(pn[i]);
			if (!k) continue;
			k.getWorldPosition(store[i]);
			const pressed = t - pt[i] < 190;
			store[i].y += pressed ? 0.004 : 0.045;
			store[i].z -= 0.03;   // toward the player, on the playing end of the key
			av.ik[i] = store[i];
		}
	} else if (upper === "paint") {
		room.easel.point(av.paintUV.u, av.paintUV.v, store[0]);
		av.ik[0] = store[0];
		av.ikReach[0] = 0.235;      // the brush tip, not the hand, touches the paper
	} else if (upper === "drink") {
		const s = (Math.sin(av.t * 2.2) + 1) / 2;
		const mouth = av.head.localToWorld(_tmpV.set(0.01, 0.02, 0.27));
		const chest = av.head.localToWorld(_tmpV2.set(0.02, -0.3, 0.3));
		store[0].copy(chest).lerp(mouth, s > 0.4 ? 1 : s / 0.4);
		av.ik[0] = store[0];
	} else if (["shake", "hug", "highfive", "give"].includes(upper) && partnerId) {
		const pav = avatarOf(partnerId);
		if (!pav) return;
		const me3 = av.root.position, pp = pav.root.position;
		if (upper === "shake") {
			pav.torso.getWorldPosition(store[0]);
			store[1].copy(store[0]);
			store[0].x += 0.12; store[1].x -= 0.12;
			store[0].y += 0.05 + Math.sin(t / 50) * 0.03; store[1].y += 0.05 + Math.sin(t / 50) * 0.03;
			av.ik[0] = store[0]; av.ik[1] = store[1];
		} else if (upper === "hug") {
			const dx = pp.x - me3.x, dz = pp.z - me3.z, l = Math.hypot(dx, dz) || 1;
			const fx = dx / l, fz = dz / l, rx = fz, rz = -fx;
			const y = 1.12 * pav.body.scale.y;
			store[0].set(pp.x + fx * 0.1 - rx * 0.13, y, pp.z + fz * 0.1 - rz * 0.13);
			store[1].set(pp.x + fx * 0.1 + rx * 0.13, y + 0.05, pp.z + fz * 0.1 + rz * 0.13);
			av.ik[0] = store[0]; av.ik[1] = store[1];
			av.ikPole = _tmpV.set(0, -0.3, 0).addScaledVector(_tmpV2.set(-fx, 0, -fz), 0.2);
		} else {
			const y = upper === "highfive" ? 1.72 : 1.08;
			store[0].set((me3.x + pp.x) / 2, y, (me3.z + pp.z) / 2);
			av.ik[0] = store[0];
		}
	} else if ((upper === "carry" || upper === "carrykiss") && partnerId) {
		// one arm under their shoulders, the other under their knees
		const pav = avatarOf(partnerId);
		if (!pav || !pav.carriedBy) return;
		pav.torso.getWorldPosition(store[0]); store[0].y -= 0.13;
		pav.legs[0].knee.getWorldPosition(store[1]); store[1].y -= 0.09;
		av.ik[0] = store[0]; av.ik[1] = store[1];
		av.ikReach[0] = av.ikReach[1] = 0.05;
	} else if (upper === "heartarms") {
		// fingertips meet above the head: a big heart made of arms
		const top = av.head.localToWorld(_tmpV.set(0, 0.3, 0.05));
		const h = av.root.rotation.y, rx = Math.cos(h) * 0.035, rz = -Math.sin(h) * 0.035;
		store[0].set(top.x - rx, top.y, top.z - rz);
		store[1].set(top.x + rx, top.y, top.z + rz);
		av.ik[0] = store[0]; av.ik[1] = store[1];
	} else if (COUPLE_POSES.includes(upper) && partnerId) {
		const pav = avatarOf(partnerId);
		if (!pav) return;
		const me3 = av.root.position, pp = pav.root.position;
		const dx = pp.x - me3.x, dz = pp.z - me3.z, l = Math.hypot(dx, dz) || 1;
		const fx = dx / l, fz = dz / l, rx = fz, rz = -fx;
		const side = av.coupleSide;
		const mySpot = sit && room.sitSpots.find(s => s.id === sit);
		const ps = posOf(partnerId), pSpot = ps && ps.sit && room.sitSpots.find(s => s.id === ps.sit);
		if (side) {
			// arm around them: hand on their far shoulder (or their back, lying down)
			const i = side < 0 ? 0 : 1;
			if (mySpot && mySpot.lie) { pav.torso.getWorldPosition(store[i]); store[i].y += 0.12; }
			else { pav.head.getWorldPosition(store[i]); store[i].y -= 0.24; }
			store[i].x += fx * 0.13; store[i].z += fz * 0.13;
			av.ik[i] = store[i];
		} else if (mySpot && pSpot && pSpot.lap === mySpot.id) {
			// they're on your lap: arms around their waist
			pav.torso.getWorldPosition(store[0]);
			store[1].copy(store[0]);
			store[0].x -= rx * 0.13; store[0].z -= rz * 0.13; store[0].y += 0.06;
			store[1].x += rx * 0.13; store[1].z += rz * 0.13; store[1].y += 0.06;
			av.ik[0] = store[0]; av.ik[1] = store[1];
		} else if (mySpot) {
			// across the candlelit table: hold hands in the middle
			const mx = (me3.x + pp.x) / 2, mz = (me3.z + pp.z) / 2, y = upper === "cuddle" ? 0.86 : 0.9;
			store[0].set(mx - rx * 0.07, y, mz - rz * 0.07);
			store[1].set(mx + rx * 0.07, y, mz + rz * 0.07);
			av.ik[0] = store[0]; av.ik[1] = store[1];
		} else {
			// face to face: hands on their waist for a kiss, on their shoulders for a slow dance
			const y = (upper === "slowdance" ? 1.36 : 1.1) * pav.body.scale.y;
			store[0].set(pp.x - fx * 0.08 - rx * 0.15, y, pp.z - fz * 0.08 - rz * 0.15);
			store[1].set(pp.x - fx * 0.08 + rx * 0.15, y, pp.z - fz * 0.08 + rz * 0.15);
			av.ik[0] = store[0];
			av.ik[1] = upper === "cheekkiss" ? null : store[1];
			av.ikPole = _tmpV.set(0, -0.3, 0).addScaledVector(_tmpV2.set(-fx, 0, -fz), 0.2);
		}
	} else if (upper === "tug" && fightRemote.visible) {
		const r = fightRemote.position;
		const me3 = av.root.position;
		const dx = r.x - me3.x, dz = r.z - me3.z, l = Math.hypot(dx, dz) || 1;
		const rx = dz / l, rz = -dx / l;
		store[0].set(r.x - dx / l * 0.05 - rx * 0.035, r.y, r.z - dz / l * 0.05 - rz * 0.035);
		store[1].set(r.x - dx / l * 0.05 + rx * 0.035, r.y, r.z - dz / l * 0.05 + rz * 0.035);
		av.ik[0] = store[0]; av.ik[1] = store[1];
	}
}
function updatePeers(dt) {
	const t = now();
	peers.forEach((p, id) => {
		if (t - p.last > 25000) { removePeer(id); return; }
		const k = Math.min(1, dt * 10);
		const ox = p.x, oz = p.z;
		p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
		p.h = angleLerp(p.h, p.th, k);
		const sp = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 0.001) / 2.6;
		p.speed += (Math.min(1.8, sp) - p.speed) * Math.min(1, dt * 8);
		placeBody(p.avatar, p.x, p.z, p.h, p.sit, p.carriedBy, dt);
		p.avatar.carriedBy = p.carriedBy;
		p.avatar.coupleRole = coupleRole(p.sit, p.partner, p.upper);
		p.avatar.coupleSide = coupleSide(p.x, p.z, p.h, p.sit, p.partner, p.upper);
		snuggle(p.avatar, p.x, p.z, p.sit, p.partner, p.upper, dt);
		kissReach(p.avatar, p.upper, p.partner, dt);
		loveAura(p.avatar, p.upper, p.anim, dt);
		p.avatar.speed = p.sit ? 0 : p.speed;
		const wasSleep = p.avatar.anim === "sleep";
		p.avatar.anim = avatarAnim(p.anim, p.sit, p.carriedBy);
		p.avatar.upper = p.upper;
		if (wasSleep !== (p.anim === "sleep")) refreshPeople();
		const others = [{ x: me.x, z: me.z }].concat([...peers.values()].filter(q => q !== p));
		p.avatar.lookYaw = p.sit ? null : lookYawFor(p.x, p.z, p.h, others);
		p.ikStore = p.ikStore || [new THREE.Vector3(), new THREE.Vector3()];
		assignIK(p.avatar, p.upper, p.sit, p.partner, p.ikStore);
		p.avatar.update(dt);
	});
}

// ---------- the ball
const ball = room.ball;
function ballState(d) {
	if (typeof d.x !== "number") return;
	ball.position.x = d.x; ball.position.z = d.z;
	ball.userData.v.set(+d.vx || 0, +d.vz || 0);
	if (audio) audio.sfx("kick", 0.4);
}
function updateBall(dt) {
	const v = ball.userData.v, r = 0.2;
	const dx = ball.position.x - me.x, dz = ball.position.z - me.z, dist = Math.hypot(dx, dz);
	if (dist < r + RADIUS + 0.05 && me.speed > 0.2 && !me.sit) {
		const nx = dx / dist, nz = dz / dist;
		const power = 2.2 + me.speed * 2.6;
		v.set(nx * power, nz * power);
		ball.position.x = me.x + nx * (r + RADIUS + 0.06); ball.position.z = me.z + nz * (r + RADIUS + 0.06);
		send({ t: "ball", x: +ball.position.x.toFixed(2), z: +ball.position.z.toFixed(2), vx: +v.x.toFixed(2), vz: +v.y.toFixed(2) });
		if (audio) audio.sfx("kick", 0.6);
	}
	const sp = v.length();
	if (sp < 0.01) return;
	let nx = ball.position.x + v.x * dt, nz = ball.position.z + v.y * dt;
	if (nx < ROOM.minX + r || nx > ROOM.maxX - r) { v.x *= -0.7; nx = ball.position.x; }
	if (nz < ROOM.minZ + r || nz > ROOM.maxZ - r) { v.y *= -0.7; nz = ball.position.z; }
	for (const c of room.colliders) {
		if (nx > c.minX - r && nx < c.maxX + r && nz > c.minZ - r && nz < c.maxZ + r) {
			const inX = ball.position.x > c.minX - r && ball.position.x < c.maxX + r;
			if (inX) { v.y *= -0.6; nz = ball.position.z; } else { v.x *= -0.6; nx = ball.position.x; }
		}
	}
	ball.position.x = nx; ball.position.z = nz;
	ball.rotation.z -= v.x * dt / r; ball.rotation.x += v.y * dt / r;
	v.multiplyScalar(Math.max(0, 1 - dt * 0.9));
}

// ============================================================ camera
function updateCamera(dt, t) {
	if (!entered) {
		const a = t * 0.12;
		camera.position.set(me.x + Math.sin(a) * 3.0, 1.6, me.z + Math.cos(a) * 3.0);
		// on wide screens keep the character to the right of the lobby card
		const side = innerWidth > 760 ? 0.85 : 0;
		camera.lookAt(me.x - Math.cos(a) * side, 1.05, me.z + Math.sin(a) * side);
		return;
	}
	const k = 1 - Math.pow(0.001, dt);
	let fx = me.x, fz = me.z, ty = me.sit ? 1.0 : 1.35;
	const spot = me.sit && room.sitSpots.find(s => s.id === me.sit);
	if (spot && spot.lie) { fx = me.x - Math.sin(spot.h) * 0.9; fz = me.z - Math.cos(spot.h) * 0.9; ty = 0.75; }
	if (me.upper === "piano") { ty = 1.05; fz = me.z + 0.35; }
	if (drawOpen) { const d = room.interactables.easel; fx = (me.x + d.stand[0] + Math.sin(d.face) * 1.1) / 2; fz = (me.z + d.stand[1] + Math.cos(d.face) * 1.1) / 2; ty = 1.2; }
	cam.tx += (fx - cam.tx) * k; cam.tz += (fz - cam.tz) * k;
	cam.ty += (ty - cam.ty) * k;
	const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
	let px = cam.tx + Math.sin(cam.yaw) * cam.dist * cp;
	let pz = cam.tz + Math.cos(cam.yaw) * cam.dist * cp;
	let py = cam.ty + sp * cam.dist;
	if (areaOf(cam.tx, cam.tz) === "terrace") {
		// open air: the camera can roam, but never through the building
		px = Math.max(TERRACE.minX - 2, Math.min(TERRACE.maxX + 2, px));
		pz = Math.max(TERRACE.minZ - 2.5, Math.min(TERRACE.maxZ - 0.15, pz));
		py = Math.max(0.3, Math.min(6, py));
	} else {
		px = Math.max(ROOM.minX + 0.25, Math.min(ROOM.maxX - 0.25, px));
		pz = Math.max(ROOM.minZ + 0.25, Math.min(ROOM.maxZ - 0.25, pz));
		py = Math.max(0.3, Math.min(ROOM.H - 0.2, py));
	}
	let fov = 55;
	if (tvMode) {
		// your own eyes, looking at the screen (your avatar is hidden so nothing's in the way)
		myAvatar.head.localToWorld(_tvEye.set(0, 0.14, 0.12));
		room.tv.screen.getWorldPosition(_tvAt);
		camera.position.copy(_tvEye);
		camera.lookAt(_tvAt);
		fov = 48;
	} else if (scopeOn) {
		// looking through the eyepiece at the moon
		const tel = room.terrace.telescope;
		// view from just past the end of the tube (your own head would otherwise fill the eyepiece)
		tel.eyepiece.getWorldPosition(camera.position).addScaledVector(tel.dir, 3.4);
		camera.lookAt(MOON_POINT);
		fov = 16;
	} else {
		camera.position.set(px, py, pz);
		camera.lookAt(cam.tx, cam.ty, cam.tz);
	}
	if (camera.fov !== fov) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); if (Math.abs(camera.fov - fov) < 0.1) camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ============================================================ HUD prompt
// What you can do right where you are: E is the main action, F / G / R the extras.
let nearId = null, promptOpts = [], promptSig = "";
const USE_DIST = 1.25;   // how close to an object's spot you must stand to get its prompt
function nearestUsable() {
	let best = null, bd = USE_DIST;
	const area = areaOf(me.x, me.z);
	for (const id in room.interactables) {
		const def = room.interactables[id];
		const st = standOf(id);
		if (areaOf(st[0], st[1]) !== area) continue;
		const d = Math.hypot(st[0] - me.x, st[1] - me.z);
		if (d < bd) { bd = d; best = id; }
	}
	return best;
}
function sleeperOpts(id, out) {
	const q = peers.get(id);
	if (!q) return;
	out.push({ k: "G", label: "Goodnight kiss for " + q.look.name, fn: () => goodnightKiss(id) });
	out.push({ k: "R", label: "Wake " + q.look.name + " up", fn: () => wakePeer(id) });
}
const MOON_IC = '<svg viewBox="0 0 24 24" fill="#cfe0ff"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function updatePrompt() {
	const opts = [];
	let best = null;
	const busyNow = modalKind || drawOpen || me.upper === "piano" || fightView || scopeOn || wheelKind;
	if (busyNow) { /* nothing */ }
	else if (!me.sit) {
		best = nearestUsable();
		if (best === "bed") {
			if (freeSpot(room.interactables.bed.sit)) opts.push({ k: "E", label: "Sit on the bed", fn: sitOnBed });
			if (freeSpot(room.interactables.bed.lie)) opts.push({ k: "F", label: "Lie down and sleep", fn: goToBed });
			const z = nearestSleeper();
			if (z) sleeperOpts(z, opts);
		} else if (best) opts.push({ k: "E", label: labelOf(best), fn: () => interact(best) });
	} else if (me.anim === "sit") {
		if (onBed()) {
			if (freeSpot(room.interactables.bed.lie)) opts.push({ k: "F", label: "Lie down", fn: goToBed });
			const nb = seatNeighbor();
			if (nb && isAsleep(peers.get(nb))) sleeperOpts(nb, opts);
		}
		// from a seat you can still reach things on the table, the TV, lamps...
		for (const id of ["remote", "notes", "tv", "lamp", "nightlamp"]) {
			if (canReach(id)) { best = id; opts.unshift({ k: "E", label: labelOf(id), fn: () => interact(id) }); break; }
		}
		if (me.sit === "deskChair" && !loveOpen) opts.unshift({ k: "E", label: "Write a love note", fn: sitAtDesk });
		if (canTVMode()) opts.push(tvMode ? { k: "F", label: "Leave TV mode", fn: exitTV } : { k: "F", label: "TV mode", fn: enterTV });
	}
	// coffee: pick up a mug someone set down, or sip / hand over / put down the one you hold
	if (!busyNow && !me.carriedBy && me.anim !== "sleep") {
		const free = k => !opts.some(o => o.k === k);
		if (me.holding === "mug") {
			if (me.upper !== "drink" && free("G")) opts.push({ k: "G", label: "Sip your coffee", fn: drinkCoffee });
			if (free("R")) opts.push({ k: "R", label: "Put it on the nearest table", fn: putDownMug });
			let near = null, nd = 1.6;
			peers.forEach((p, id) => { const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < nd && !isAsleep(p) && !p.carriedBy) { nd = d; near = id; } });
			if (near && !tvMode && free("F")) opts.push({ k: "F", label: "Give " + peers.get(near).look.name + " your coffee", fn: () => giveHeld(near) });
		} else {
			const c = nearestCup();
			const k = free("E") ? "E" : free("F") ? "F" : null;
			if (c && k) opts.push({ k, label: "Pick up the coffee", fn: () => pickCup(c.id) });
		}
	}
	// seated / lying down: always offer a way back up
	if (!busyNow && me.sit) {
		if (!$("#sleepov").classList.contains("hidden")) {
			opts.unshift({ k: null, label: "Sleeping... sweet dreams", icon: MOON_IC });
			if (onBed() && !opts.some(o => o.k === "F")) opts.push({ k: "F", label: "Sit up", fn: () => sitUpInBed() });
			opts.push({ k: "Esc", label: onBed() ? "Get out of bed" : "Get up", fn: () => standUp() });
		} else opts.push({ k: "Esc", label: "Stand up", fn: () => standUp() });
	}
	nearId = best;
	promptOpts = opts;
	const pr = $("#prompt");
	const sig = opts.map(o => o.k + o.label).join("|");
	if (sig !== promptSig) {
		promptSig = sig;
		pr.innerHTML = opts.map((o, i) => o.k ? `<div class="po chip" data-i="${i}"><kbd>${o.k}</kbd><span>${esc(o.label)}</span></div>` : `<div class="po chip info">${o.icon || ""}<span>${esc(o.label)}</span></div>`).join("");
		pr.querySelectorAll(".po[data-i]").forEach(el => el.onclick = () => { const o = promptOpts[+el.dataset.i]; if (o) o.fn(); });
	}
	pr.classList.toggle("off", !opts.length);
}

// ============================================================ sound toggle
let muted = lsGet("harmonyWorldMuted", false);
const SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/></svg>';
function renderSound() { $("#b-sound").innerHTML = muted ? SND_OFF : SND_ON; if (audio) audio.setMuted(muted); }
$("#b-sound").onclick = () => { muted = !muted; lsSet("harmonyWorldMuted", muted); renderSound(); };
$("#b-exit").onclick = leaveToPiano;
// graphics: High -> Medium -> Low -> Auto -> High
const GFX_LABEL = { auto: "Auto", high: "High", medium: "Medium", low: "Low" };
function renderGfxBtn() { $("#b-gfx .lbl").textContent = GFX_LABEL[gfx.pref]; $("#b-gfx").title = "Graphics: " + GFX_LABEL[gfx.pref] + (gfx.pref === "auto" ? " (now " + GFX[gfxTier()].name + ")" : ""); }
$("#b-gfx").onclick = () => {
	const order = ["high", "medium", "low", "auto"];
	gfx.pref = order[(order.indexOf(gfx.pref) + 1) % order.length];
	lsSet(LS_GFX, gfx.pref);
	if (gfx.pref === "auto") { gfx.auto = detectTier(); gfx.scale = 1; }
	else gfx.scale = 1;
	perf.n = perf.t = perf.good = 0; perf.cool = 1;
	applyGfx();
	renderGfxBtn();
	toast("Graphics: <b>" + GFX_LABEL[gfx.pref] + "</b>" + (gfx.pref === "auto" ? " - adjusts itself to keep things smooth" : ""), null, null, 3500);
};
renderGfxBtn();

// emote + mood menu
const EMOTES = [
	["wave", "Wave"], ["highfive", "High five"],
	["dance", "Dance"], ["clap", "Clap"], ["laugh", "Laugh"], ["cry", "Cry"], ["cheer", "Cheer"],
	["jump", "Jump"], ["bow", "Bow"], ["think", "Think"], ["shrug", "Shrug"], ["facepalm", "Facepalm"],
	["yawn", "Stretch"], ["floor", "Sit on floor"], ["wakeup", "Wake someone"], ["dice", "Roll a die"]
];
const LOVE_EMOTES = [
	["smooch", "Kiss"], ["cheekkiss", "Cheek kiss"], ["cuddle", "Cuddle"], ["carry", "Pick up"], ["slowdance", "Slow dance"],
	["goodnight", "Goodnight kiss"], ["propose", "Propose"], ["hug", "Hug"], ["kiss", "Blow a kiss"], ["heart", "Hearts"],
	["heartarms", "Big heart"], ["lovestruck", "Lovestruck"], ["blush", "Blush"], ["wink", "Wink"]
];
// little line-drawn icons for the action menu
const EI = {
	wave: '<path d="M7 13V7a1.5 1.5 0 0 1 3 0v4M10 10V5a1.5 1.5 0 0 1 3 0v5M13 10V6a1.5 1.5 0 0 1 3 0v6M16 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.5L7 14"/>',
	heart: '<path d="M12 20s-7-4.3-8.8-8.6C1.8 8.2 3.8 5 7 5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.2 3.2 3.8 6.4C19 15.7 12 20 12 20z"/>',
	kiss: '<path d="M6 12c2-2 4-2 6 0 2-2 4-2 6 0-2 3-4 4-6 4s-4-1-6-4z"/><path d="M17 5l2-2M19 8h3M14 4l.5-2.5"/>',
	hug: '<circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="6" r="2.5"/><path d="M4 21v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5M8 12l4 4 4-4"/>',
	highfive: '<path d="M8 21v-7l-3-4V5M8 14h3M16 21v-7l3-4V5M16 14h-3M12 3v3M9 4l1 2M15 4l-1 2"/>',
	dance: '<circle cx="12" cy="4" r="2"/><path d="M12 7v6l-4 7M12 13l4 7M6 9l6-1 6-3"/>',
	clap: '<path d="M8 12l4-6 2 1-3 6M11 14l4-6 2 1-4 7c-1.5 2.5-4.5 3-6.5 1.5S4 13 6 11l2-2"/><path d="M15 3l1-2M19 5l2-1"/>',
	laugh: '<circle cx="12" cy="12" r="9"/><path d="M7 9l2 1-2 1M17 9l-2 1 2 1M7 14h10a5 5 0 0 1-10 0z"/>',
	cry: '<circle cx="12" cy="12" r="9"/><path d="M8 10h2M14 10h2M9 17c2-1.5 4-1.5 6 0M8.5 12v3M15.5 12v3"/>',
	cheer: '<circle cx="12" cy="9" r="2"/><path d="M12 12v4l-3 5M12 16l3 5M6 3l4 7M18 3l-4 7"/>',
	jump: '<circle cx="12" cy="4" r="2"/><path d="M12 7v6M8 10l4-2 4 2M9 18l3-5 3 5M5 22h14"/>',
	bow: '<circle cx="15" cy="7" r="2"/><path d="M14 10l-6 3v8M8 13l-2 5M14 10l2 4"/>',
	think: '<circle cx="10" cy="12" r="7"/><path d="M8 15h4M13 10l2 3h-2"/><circle cx="19" cy="5" r="1.5"/><circle cx="21" cy="2" r="1"/>',
	shrug: '<circle cx="12" cy="6" r="2.5"/><path d="M12 9v12M4 9l3 3h10l3-3M3 7l1 2M21 7l-1 2"/>',
	facepalm: '<circle cx="12" cy="12" r="8"/><path d="M9 4c3 3 4 8 3 13M13 14h3"/>',
	yawn: '<path d="M5 3l3 6M19 3l-3 6"/><circle cx="12" cy="12" r="3"/><path d="M12 15v6M9 21h6"/>',
	floor: '<circle cx="12" cy="6" r="2.5"/><path d="M12 9v5M5 18c2-3 4-4 7-4s5 1 7 4M4 20h16"/>',
	smooch: '<path d="M4 12c2.2-2.6 4.8-2.6 8 0 3.2-2.6 5.8-2.6 8 0-2.6 3.6-5 4.6-8 4.6S6.6 15.6 4 12z"/><path d="M4 12h16"/>',
	cheekkiss: '<circle cx="10" cy="12" r="7"/><path d="M8 10.5v.5M12 10.5v.5M8.5 15c1 .8 2 .8 3 0"/><path d="M19.5 7.5c-.9-1.2-2.8-.6-2.5 1 .2 1 1.4 1.7 2.5 2.5 1.1-.8 2.3-1.5 2.5-2.5.3-1.6-1.6-2.2-2.5-1z"/>',
	cuddle: '<circle cx="8" cy="7" r="2.5"/><circle cx="15" cy="8.5" r="2.5"/><path d="M3 20v-3a5 5 0 0 1 5-5h1M21 20v-2.5a5 5 0 0 0-5-5h-4c-1.5 0-3 1-3 2.5"/>',
	carry: '<circle cx="9" cy="4" r="2"/><circle cx="17" cy="7.5" r="1.8"/><path d="M9 7v7l-2 7M9 14l2 7M9 9l3 3 7-1M12 12l-5 1.5M15.5 11l2.5 2.5h3"/>',
	slowdance: '<circle cx="8" cy="4.5" r="2"/><circle cx="16" cy="4.5" r="2"/><path d="M8 7.5v6l-2 7M16 7.5v6l2 7M8 9.5l4 1.5 4-1.5M8 13.5h8"/>',
	propose: '<circle cx="12" cy="15" r="6"/><path d="M9 5.5l3-3 3 3-3 3z"/>',
	heartarms: '<circle cx="12" cy="15" r="2"/><path d="M12 17v5M12 12.5C6.5 9 5.5 3 9 3c1.5 0 2.5 1 3 2.5C12.5 4 13.5 3 15 3c3.5 0 2.5 6-3 9.5z"/>',
	lovestruck: '<circle cx="12" cy="12" r="9"/><path d="M8.3 9c-.6-.8-1.9-.4-1.7.6.1.6 1 1.1 1.7 1.6.7-.5 1.6-1 1.7-1.6.2-1-1.1-1.4-1.7-.6zM15.7 9c-.6-.8-1.9-.4-1.7.6.1.6 1 1.1 1.7 1.6.7-.5 1.6-1 1.7-1.6.2-1-1.1-1.4-1.7-.6zM8 15c2.2 2 5.8 2 8 0"/>',
	blush: '<circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M10 15.5c1.2.7 2.8.7 4 0M6 13.5h2M16 13.5h2"/>',
	wink: '<circle cx="12" cy="12" r="9"/><path d="M7.5 10h3M15.5 9.5v1M8 14.5c2.2 2.2 5.8 2.2 8 0"/>',
	goodnight: '<path d="M14 3a7 7 0 1 0 7 9 5.5 5.5 0 0 1-7-9z"/><path d="M6.5 17.5c-.8-1-2.4-.5-2.2.8.1.8 1.2 1.4 2.2 2.1 1-.7 2.1-1.3 2.2-2.1.2-1.3-1.4-1.8-2.2-.8z"/>',
	wakeup: '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 1.5M5 4L2.5 6.5M19 4l2.5 2.5"/>',
	dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="12" cy="12" r="1.2"/>'
};
function emoteIcon(id) { return `<svg viewBox="0 0 24 24" fill="none" stroke="#ffd9b0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${EI[id] || ""}</svg>`; }
// ---------- action / love / mood wheels (Z / X / C), opened in the middle of the screen
const WHEEL_TITLES = { act: "Actions", love: "Love", mood: "Your mood" };
const WHEEL_SUB = {
	smooch: "Walks you over to the nearest person", slowdance: "Walks you over to the nearest person", propose: "Down on one knee in front of them",
	cuddle: "Sit next to someone, or pick them up and carry them to the bed or sofa", hug: "Walks you over to the nearest person",
	carry: "Asks the nearest person if you can carry them - then lie down together on the bed or sofa",
	goodnight: "Sit by someone asleep in bed and kiss them - they stay asleep", wakeup: "Sit on the bed and gently shake them awake",
	floor: "Sit right down where you stand", dice: "Everyone sees the roll", highfive: "Walks you over to the nearest person"
};
let wheelKind = null, wheelSel = -1, wheelItems = [];
function wheelList(kind) {
	if (kind === "mood") return MOODS.map(m => ({ id: m.id, label: m.label, icon: moodImg(m.id), on: profile.mood === m.id, fn: () => setMood(m.id) }));
	const src = kind === "love" ? LOVE_EMOTES : EMOTES;
	return src.map(([id, label]) => ({ id, label, icon: emoteIcon(id), fn: () => emote(id) }));
}
function openWheel(kind) {
	if (!entered || modalKind) return;
	wheelKind = kind; wheelSel = -1;
	wheelItems = wheelList(kind);
	const el = $("#wheel"), ring = $("#wh-ring");
	el.className = kind;
	// fit the ring to the screen; items shrink a little when there are lots of them
	const n = wheelItems.length;
	const maxR = Math.max(90, Math.min(innerWidth, innerHeight - 120) / 2 - 44);
	let size = innerWidth < 560 ? 50 : 60;
	let R = Math.max(innerWidth < 560 ? 104 : 136, n * (size + 8) / (2 * Math.PI));
	if (R > maxR) { R = maxR; size = Math.max(38, Math.min(size, 2 * Math.PI * R / n - 6)); }
	ring.style.setProperty("--R", R + "px");
	ring.querySelectorAll(".wh-it").forEach(b => b.remove());
	wheelItems.forEach((it, i) => {
		const a = -Math.PI / 2 + i / n * Math.PI * 2;
		const b = document.createElement("button");
		b.className = "wh-it" + (it.on ? " on" : "");
		b.style.cssText = `width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;--tx:${(Math.cos(a) * R).toFixed(1)}px;--ty:${(Math.sin(a) * R).toFixed(1)}px`;
		b.innerHTML = it.icon + (i < 10 ? `<span class="n">${(i + 1) % 10}</span>` : "");
		b.title = it.label;
		b.onclick = ev => { ev.stopPropagation(); pickWheel(i); };
		ring.appendChild(b);
	});
	document.querySelectorAll(".wh-tabs button, .em.wb").forEach(b => b.classList.toggle("on", b.dataset.wheel === kind));
	wheelHi(-1);
	$("#tip").classList.add("hidden");
}
function closeWheel() {
	wheelKind = null;
	$("#wheel").classList.add("hidden");
	document.querySelectorAll(".em.wb").forEach(b => b.classList.remove("on"));
}
function toggleWheel(kind) { if (wheelKind === kind) closeWheel(); else openWheel(kind); }
function wheelHi(i) {
	wheelSel = i;
	$("#wh-ring").querySelectorAll(".wh-it").forEach((b, j) => b.classList.toggle("sel", j === i));
	const it = wheelItems[i];
	$("#wh-title").textContent = WHEEL_TITLES[wheelKind] || "";
	$("#wh-label").textContent = it ? it.label : "Pick one";
	$("#wh-sub").textContent = it ? (WHEEL_SUB[it.id] || "") : (wheelKind === "mood" ? "Everyone sees your mood" : "Point, tap or press a number");
}
function pickWheel(i) {
	const it = wheelItems[i];
	if (!it) return;
	closeWheel();
	it.fn();
}
// keyboard: Z / X / C open the wheels; while one is open, numbers pick, arrows move, E / Enter confirm
const WHEEL_KEYS = { z: "act", x: "love", c: "mood" };
function wheelKey(k, e) {
	if (WHEEL_KEYS[k] && !e.repeat) { e.preventDefault(); toggleWheel(WHEEL_KEYS[k]); return true; }
	if (!wheelKind) return false;
	if (/^[0-9]$/.test(k)) { e.preventDefault(); pickWheel(k === "0" ? 9 : +k - 1); return true; }
	const n = wheelItems.length;
	if (k === "arrowright" || k === "arrowdown" || k === "tab") { e.preventDefault(); wheelHi((wheelSel + 1 + n) % n); return true; }
	if (k === "arrowleft" || k === "arrowup") { e.preventDefault(); wheelHi(wheelSel < 0 ? n - 1 : (wheelSel - 1 + n) % n); return true; }
	if (k === "enter" || k === "e" || k === " ") { e.preventDefault(); if (wheelSel >= 0) pickWheel(wheelSel); return true; }
	return false;
}
// point anywhere around the ring (like a game's radial menu): the slice under the pointer lights up
function sliceAt(ev) {
	const r = $("#wh-ring").getBoundingClientRect();
	const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
	const d = Math.hypot(dx, dy);
	if (d > r.width / 2 + 40) return -2;   // well outside: close
	if (d < 50) return -1;                 // the middle: nothing
	const n = wheelItems.length;
	const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / n + Math.PI * 4) % (Math.PI * 2);
	return Math.floor(a / (Math.PI * 2) * n) % n;
}
$("#wheel").addEventListener("pointermove", ev => {
	if (!wheelKind || ev.target.closest(".wh-tabs")) return;
	const i = Math.max(-1, sliceAt(ev));
	if (i !== wheelSel) wheelHi(i);
});
$("#wheel").addEventListener("click", ev => {
	if (!wheelKind || ev.target.closest(".wh-tabs")) return;
	const i = sliceAt(ev);
	if (i === -2) closeWheel(); else if (i >= 0) pickWheel(i);
});
document.querySelectorAll(".wh-tabs button, .em.wb").forEach(b => b.onclick = ev => { ev.stopPropagation(); if (b.closest(".wh-tabs")) openWheel(b.dataset.wheel); else toggleWheel(b.dataset.wheel); });
function setMood(m) {
	profile.mood = m;
	lsSet(LS_PROFILE, profile);
	myAvatar.setMood(m);
	sendPose(true);
	refreshPeople();
	addLog("Mood: " + esc(MOODS.find(x => x.id === m).label), true);
}
$("#b-look").onclick = () => showLobby(true);

// ============================================================ lobby / character select
let entered = false, editing = false;
function swatches(el, list, key) {
	el.innerHTML = list.map(c => `<button class="sw ${profile[key] === c ? "on" : ""}" style="background:${c}" data-c="${c}" aria-label="${key} ${c}"></button>`).join("");
	el.querySelectorAll("button").forEach(b => b.onclick = () => { profile[key] = b.dataset.c; el.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); rebuildMe(); });
}
function rebuildMe() {
	myAvatar.build(Object.assign({}, profile, { name: profile.name || "You" }));
	updateProps();
	$("#lbl-top").textContent = profile.gender === "female" ? "Dress" : "Shirt";
	$("#lbl-bottom").textContent = profile.gender === "female" ? "Shoes & belt" : "Trousers";
}
function showLobby(edit) {
	editing = !!edit;
	$("#lobby").classList.remove("hidden");
	$("#enter").textContent = edit ? "Save my look" : "Enter World";
	if (edit) { closeModal(); closeDraw(); $("#hud").classList.add("hidden"); entered = false; }
	$("#nm").value = profile.name;
	document.querySelectorAll("#gender button").forEach(b => b.classList.toggle("on", b.dataset.g === profile.gender));
	swatches($("#sw-skin"), SKIN_TONES, "skin");
	swatches($("#sw-hair"), HAIR_COLORS, "hair");
	swatches($("#sw-top"), OUTFIT_COLORS, "top");
	swatches($("#sw-bottom"), OUTFIT_COLORS, "bottom");
	rebuildMe();
}
document.querySelectorAll("#gender button").forEach(b => b.onclick = () => { profile.gender = b.dataset.g; document.querySelectorAll("#gender button").forEach(x => x.classList.toggle("on", x === b)); rebuildMe(); });
$("#nm").addEventListener("input", () => { profile.name = $("#nm").value.trim().slice(0, 24); });
$("#nm").addEventListener("keydown", e => { if (e.key === "Enter") $("#enter").click(); });

let needPassword = false;
async function checkAuth() {
	if (!/^https?:$/.test(location.protocol)) return true;
	try { const r = await fetch("/api/auth", { cache: "no-store" }); const j = await r.json(); return !!j.authed; } catch (e) { return true; }
}
$("#enter").onclick = async () => {
	profile.name = ($("#nm").value.trim() || profile.name || "").slice(0, 24);
	if (!profile.name) { $("#nm").focus(); $("#nm").style.borderColor = "#ff7aa2"; return; }
	if (needPassword) {
		const pw = $("#gpw").value;
		try {
			const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
			const j = await r.json().catch(() => ({}));
			if (!r.ok || !j.ok) { $("#gerr").textContent = j.error || "Wrong password."; return; }
			needPassword = false; $("#gate").classList.add("hidden"); $("#gerr").textContent = "";
		} catch (e) { $("#gerr").textContent = "Couldn't reach the server."; return; }
	}
	lsSet(LS_PROFILE, profile);
	rebuildMe();
	$("#lobby").classList.add("hidden");
	$("#hud").classList.remove("hidden");
	if (!audio) { audio = new WorldAudio(); applyKey("music", null); }
	audio.resume();
	renderSound();
	entered = true;
	refreshPeople();
	canvas.focus();
	if (editing) { send({ t: "look", lk: lookPayload() }); return; }
	cam.tx = me.x; cam.tz = me.z;
	cam.yaw = Math.atan2(me.x - (-1.5), me.z - (-3.5));
	applyKey("tv", null);
	startNetwork();
	loadWorld();
	addLog("Welcome to your little world, " + esc(profile.name) + ". Click anything to use it.", true);
	pendingLetters.splice(0).forEach(v => onLetter("letter:" + v.id, v, false));
	setTimeout(() => $("#help").classList.add("gone"), 45000);
};
// keep-alive pose even when the tab is in the background (rAF pauses there)
setInterval(() => { if (entered) send(poseMsg()); }, 5000);

// ============================================================ main loop
const clock = new THREE.Clock();
let tvAcc = 0, arcAcc = 0, ytAcc = 0, lastArea = null, precompiled = false, frameNo = 0;
// Auto quality: every ~1.5s look at the real frame rate. Too slow -> render fewer pixels (down to 60%),
// still too slow at the bottom -> cheaper tier. Smooth for a while -> win the resolution back.
// (Never steps the tier back up by itself, so it can't flicker between settings.)
const perf = { n: 0, t: 0, good: 0, cool: 0 };
function watchPerf(raw) {
	if (gfx.pref !== "auto" || document.hidden) return;
	if (raw > 0.25) { perf.n = 0; perf.t = 0; return; }   // tab was in the background / a one-off hitch
	perf.n++; perf.t += raw;
	if (perf.t < 1.5) return;
	const fps = perf.n / perf.t;
	perf.n = 0; perf.t = 0;
	if (perf.cool > 0) { perf.cool--; return; }
	if (fps < 45) {
		perf.good = 0;
		if (gfx.scale > 0.61) { gfx.scale = Math.max(0.6, gfx.scale - 0.1); applyGfx(); perf.cool = 1; }
		else if (gfx.auto > 0 && fps < 38) { gfx.auto--; gfx.scale = 0.9; applyGfx(); perf.cool = 2; }
	} else if (fps > 57 && gfx.scale < 1) {
		if (++perf.good >= 3) { perf.good = 0; gfx.scale = Math.min(1, gfx.scale + 0.1); applyGfx(); perf.cool = 1; }
	} else perf.good = 0;
}
function frame() {
	const raw = clock.getDelta();
	const dt = Math.min(0.05, raw);
	watchPerf(raw);
	const G = GFX[gfxTier()];
	const t = clock.elapsedTime;
	if (entered) updateMe(dt);
	else {
		placeAvatar(myAvatar, me.x, me.z, me.h + Math.sin(t * 0.4) * 0.3, null);
		myAvatar.anim = "idle"; myAvatar.upper = null; myAvatar.speed = 0; myAvatar.lookYaw = null;
	}
	if (entered) assignIK(myAvatar, me.upper, me.sit, me.partner, _ik);
	if (tvMode && !canTVMode()) exitTV();
	myAvatar.root.visible = !scopeOn && !tvMode;
	myAvatar.update(dt);
	// only light the area you're in (fewer lights = much cheaper shading)
	const inTerrace = areaOf(cam.tx, cam.tz) === "terrace" || (entered && areaOf(me.x, me.z) === "terrace");
	if (inTerrace !== lastArea) {
		lastArea = inTerrace;
		room.areaLights.room.concat(room.minorLights.room).forEach(l => { l.visible = !inTerrace; });
		room.areaLights.terrace.concat(room.minorLights.terrace).forEach(l => { l.visible = inTerrace; });
		// build every shader up front (terrace objects included) instead of stalling the first time they come into view
		if (!precompiled) { precompiled = true; renderer.compile(scene, camera); }
	}
	room.terrace.swing.occupied = me.sit === "swing0" || me.sit === "swing1" || [...peers.values()].some(p => p.sit === "swing0" || p.sit === "swing1");
	updateFightRemote(clock.elapsedTime);
	updatePeers(dt);
	if (tvMode) peers.forEach(p => { if (p.avatar.label) p.avatar.label.visible = false; });
	updateStars(dt);
	updateBall(dt);
	updateFx(dt);
	updateFight();
	room.update(dt, t);
	updateCamera(dt, t);
	if (entered) updatePrompt();
	tvAcc += dt; arcAcc += dt; ytAcc += dt;
	if (tvAcc > 1 / G.tvFps) { tvAcc = 0; drawTVFrame(t); }
	if (arcAcc > 1 / G.arcFps) { arcAcc = 0; Games.drawArcade(room.arcade.canvas, get("game"), rpsLists(), t); room.arcade.tex.needsUpdate = true; }
	if (marker.material.opacity > 0) { marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.5); marker.scale.multiplyScalar(1 + dt); }
	if (audio && get("music").on) {
		const d = Math.hypot(me.x - 6.4, me.z + 0.9);
		audio.setMusicVolume(muted ? 0 : Math.max(0.18, Math.min(1, 1.3 - d / 9)) * 0.9 * (yt ? 0.35 : 1));
	}
	// the TV's video gets louder the closer you are
	if (yt && ytAcc > 0.5) {
		ytAcc = 0;
		const d = Math.hypot(me.x + 2.6, me.z + 5.6);
		ytCmd("setVolume", [muted ? 0 : Math.round(Math.max(15, Math.min(100, 115 - d * 9)))]);
	}
	const conn = !!(sync && sync.isConnected());
	if (conn !== wasConnected) {
		wasConnected = conn;
		$("#netdot").classList.toggle("on", conn);
		$("#netdot").title = conn ? "Connected - everyone sees you" : "Offline - reconnecting";
		if (conn) send({ t: "hello", lk: lookPayload(), pose: poseMsg() });
	}
	if (G.shadows && frameNo++ % G.every === 0) renderer.shadowMap.needsUpdate = true;
	renderer.render(scene, camera);
	if (yt) cssRenderer.render(cssScene, camera);
	requestAnimationFrame(frame);
}

// ============================================================ boot
(window.requestIdleCallback || (fn => setTimeout(fn, 1500)))(() => { if (!gridBlocked) buildGrid(); });
applyGfx();
$("#rname").textContent = ROOM_NAME === "lobby" ? "Lobby World" : ROOM_NAME;
redrawEasel();
applyAll();
renderSound();
window.__worldBooted = true;
requestAnimationFrame(frame);
setTimeout(() => { $("#loading").style.opacity = 0; setTimeout(() => $("#loading").remove(), 600); }, 200);
checkAuth().then(ok => {
	if (!ok) { needPassword = true; $("#gate").classList.remove("hidden"); }
	showLobby(false);
	$("#who").textContent = "Room: " + ROOM_NAME;
});
setInterval(applyPlant, 5 * 60 * 1000);
// handle for debugging from the console
window.HarmonyWorld = { _net: d => onNet(d), MY_ID, room, doUpper, me, peers, interact, get, setShared, emote, loveAct, walkTo, cam, standUp, sitOn, goToBed, sitUpInBed, goodnightKiss, openWheel, closeWheel, playKey, tugTap, wakePeer, toggleNight, drinkCoffee, takeCoffee, putDownMug, enterTV, exitTV, setMood, giveFlower: giveHeld, pickFlower, myAvatar, findPath, blocked, renderer, scene, camera };
