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
import { Avatar, SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS } from "./worldAvatar.js";
import { buildRoom, ROOM, heartMesh } from "./worldRoom.js";
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
	skin: SKIN_TONES[1], hair: HAIR_COLORS[1], top: OUTFIT_COLORS[0], bottom: OUTFIT_COLORS[4]
}, lsGet(LS_PROFILE, {}));
if (params.get("n") && !profile.name) profile.name = params.get("n").slice(0, 24);

// ============================================================ renderer/scene
const canvas = $("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
moon.target.position.set(2.2, 0, -2);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
moon.shadow.bias = -0.0005;
moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);

const room = buildRoom(scene);
let audio = null;

addEventListener("resize", () => {
	renderer.setSize(innerWidth, innerHeight);
	cssRenderer.setSize(innerWidth, innerHeight);
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix();
});

// ============================================================ player
const me = {
	x: 0.8 + (Math.random() - 0.5) * 1.5, z: 1.6 + (Math.random() - 0.5) * 1.2, h: Math.PI,
	speed: 0, anim: "idle", upper: null, upperUntil: 0, sit: null, target: null, targetAct: null, stuck: 0,
	pu: 0.5, pv: 0.5
};
const myAvatar = new Avatar(Object.assign({}, profile, { name: profile.name || "You" }));
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
	return { t: "p", x: +me.x.toFixed(2), z: +me.z.toFixed(2), h: +me.h.toFixed(2), a: me.anim, u: me.upper, s: me.sit, sp: +me.speed.toFixed(2), pr: myAvatar.propKind, pu: +me.pu.toFixed(2), pv: +me.pv.toFixed(2) };
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
		case "chat": if (p) { p.avatar.say(String(d.text).slice(0, 240)); addLog("<b style='color:" + p.look.top + "'>" + esc(p.look.name) + "</b> " + esc(String(d.text).slice(0, 240))); if (audio) audio.sfx("pop", 0.5); } break;
		case "fx": onFx(d, p); break;
		case "note": {
			const n = +d.n;
			if (audio) audio.pianoNote(n, 0.18);
			room.pressKey(n, false);
			if (p) p.avatar.pianoHit(n < 66 ? 1 : 0);
			noteFx();
			break;
		}
		case "ball": ballState(d); break;
		case "tug": if (fightView && d.f === fightView.id) fightView.other = Math.max(fightView.other, +d.n || 0); break;
		case "wake": if (d.to === MY_ID && me.anim === "sleep") { if (audio) audio.sfx("alarm"); document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 900); standUp(); toast(`<b>${esc(p ? p.look.name : "Someone")}</b> woke you up!`, null, null, 5000); } break;
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
const BASE_ANIMS = ["idle", "sit", "sleep"];
const UPPER_ANIMS = ["wave", "dance", "clap", "heart", "drink", "paint", "tug", "piano"];
const PROPS = ["mug", "brush", "remote"];
function applyPose(p, d, snap) {
	if (typeof d.x !== "number") return;
	p.tx = d.x; p.tz = d.z; p.th = d.h; p.sit = d.s || null;
	p.anim = BASE_ANIMS.includes(d.a) ? d.a : "idle";
	p.upper = UPPER_ANIMS.includes(d.u) ? d.u : (UPPER_ANIMS.includes(d.a) ? d.a : null);
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
	// they took the remote with them: put it back on the table
	if (get("remote").by === id) setShared("remote", { by: "", name: "" });
}
function refreshPeople() {
	const rows = [`<div><i style="background:${profile.top}"></i>${esc(profile.name || "You")} (you)</div>`];
	peers.forEach(p => rows.push(`<div><i style="background:${p.look.top}"></i>${esc(p.look.name)}${p.anim === "sleep" ? " <span class='zz'>sleeping</span>" : ""}</div>`));
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
	else if (k === "notes") { const ta = $("#notes-ta"); if (ta && remote) { const s = ta.selectionStart, e = ta.selectionEnd; ta.value = v || ""; if (document.activeElement === ta) ta.setSelectionRange(s, e); } }
	else if (/^photo\d$/.test(k)) { const i = +k[5]; room.photos[i].setImage(v || null); if (modalKind === "photos") openPhotos(); }
	else if (/^cap\d$/.test(k)) { if (modalKind === "photos" && remote) { const inp = document.querySelector(`[data-cap="${k[3]}"]`); if (inp && document.activeElement !== inp) inp.value = v || ""; } }
	else if (k === "game" || k === "rps0" || k === "rps1") applyGame(k, remote);
	else if (k === "drawClear") { for (const id in strokes) if (strokes[id].ts < v) delete strokes[id]; saveStrokes(); redrawEasel(); }
	else if (k.indexOf("letter:") === 0) onLetter(k, v, remote);
	else if (k.indexOf("opened:") === 0) onOpened(k, v, remote);
}
function applyAll() { Object.keys(Object.assign({}, DEFAULTS, S)).forEach(k => applyKey(k, null)); }

// ============================================================ chat log / toasts
function addLog(html, sys) {
	const el = document.createElement("div");
	el.className = "ln" + (sys ? " sys" : "");
	el.innerHTML = html;
	const log = $("#log");
	log.appendChild(el);
	while (log.children.length > 8) log.removeChild(log.firstChild);
	setTimeout(() => el.classList.add("old"), 14000);
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
	if (def.face !== undefined && !def.sit && !me.sit) me.h = def.face;
	switch (id) {
		case "tv": case "remote": useRemote(); break;
		case "sofa": case "armchair": sitOn(def.sit); break;
		case "piano": startPiano(); break;
		case "bed": goToBed(); break;
		case "notes": openNotes(); break;
		case "mug": drinkCoffee(); break;
		case "lamp": setShared("lamp", !get("lamp")); break;
		case "nightlamp": setShared("nightlamp", !get("nightlamp")); break;
		case "switch": setShared("mainLight", !get("mainLight")); break;
		case "curtains": setShared("curtains", !get("curtains")); if (audio) audio.sfx("whoosh", 0.5); break;
		case "plant": waterPlant(); break;
		case "records": openMusic(); break;
		case "arcade": openArcade(); break;
		case "door": leaveToPiano(); break;
		case "desk": openLove(); break;
		case "photos": openPhotos(); break;
		case "coffee": makeCoffee(); break;
		case "easel": openDraw(); break;
	}
}
function labelOf(id) {
	if (id === "mug") return get("coffee").n > 0 ? "Drink a coffee" : "No coffee yet - make one in the kitchen";
	if (id === "tv" || id === "remote") {
		const r = get("remote");
		if (r.by === MY_ID) return "Use the TV remote";
		if (r.by) return "Fight " + (r.name || "them") + " for the remote!";
		return "Pick up the TV remote";
	}
	if (id === "bed") return freeSpot(room.interactables.bed.sit) ? "Go to sleep" : "Wake them up";
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
const REACH = { mug: 2.3, remote: 2.3, notes: 2.3, tv: 7, lamp: 2.2, nightlamp: 2.2, records: 2.0 };
function canReach(id) {
	const r = REACH[id];
	if (!r) return false;
	const c = defCenter(room.interactables[id]);
	return Math.hypot(c.x - me.x, c.z - me.z) < r;
}

// ---------- sitting / lying down / standing up
function freeSpot(ids) {
	const taken = new Set();
	peers.forEach(p => { if (p.sit) taken.add(p.sit); });
	const spots = ids.map(i => room.sitSpots.find(s => s.id === i)).filter(Boolean);
	spots.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
	return spots.find(s => !taken.has(s.id) || s.id === me.sit) || null;
}
function sitOn(ids) {
	const spot = freeSpot(ids);
	if (!spot) { addLog("That seat is taken.", true); return null; }
	if (me.sit && me.sit !== spot.id) standUp(true);
	me.sit = spot.id; me.anim = spot.lie ? "sleep" : "sit";
	if (me.upper !== "drink") me.upper = null;
	me.x = spot.x; me.z = spot.z; me.h = spot.h;
	me.target = null;
	// look over your shoulder from behind the seat
	// (lying down: the body runs toward spot.h, so watch from the foot of the bed)
	cam.yaw = spot.lie ? spot.h : spot.h + Math.PI; cam.pitch = spot.lie ? 0.75 : 0.42; cam.dist = spot.lie ? 3.0 : 2.6;
	sendPose(true);
	return spot;
}
function standUp(quiet) {
	const spot = room.sitSpots.find(s => s.id === me.sit);
	const wasSleeping = me.anim === "sleep";
	me.sit = null; me.anim = "idle";
	if (me.upper === "piano") me.upper = null;
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

// ---------- sleeping
function goToBed() {
	const spot = freeSpot(room.interactables.bed.sit);
	if (!spot) {
		// bed is full: wake whoever is asleep in it
		peers.forEach((p, id) => { if (p.anim === "sleep") wakePeer(id); });
		return;
	}
	closeRemote(); closeDraw();
	sitOn(room.interactables.bed.sit);
	$("#sleepov").classList.remove("hidden");
	if (audio) audio.sfx("yawn");
	addLog("You curled up in bed. Sweet dreams.", true);
	send({ t: "fx", kind: "sys", text: profile.name + " went to sleep" });
}
function wakePeer(id) {
	const p = peers.get(id);
	if (!p || p.anim !== "sleep") return;
	send({ t: "wake", to: id });
	addLog("You woke up " + esc(p.look.name), true);
	if (audio) audio.sfx("alarm", 0.4);
}
$("#wakebtn").onclick = () => standUp();

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
	myAvatar.pianoHit(n < 66 ? 1 : 0);
	noteFx();
}
$("#pianostand").onclick = () => standUp();

// ---------- TV + remote
const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;
const HOLE = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false });
const tvScreenMat = room.tv.screen.material;
let yt = null; // { id, obj, iframe }
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
	if (remote && tv.on && tv.yt) addLog("A video is playing on the TV - turn your sound on", true);
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
	setShared("fight", { id: Math.random().toString(36).slice(2, 8), a: r.by, an: r.name, b: MY_ID, bn: profile.name, start: now() + 2400, end: now() + 2400 + 6000 });
}
function applyFight() {
	const f = get("fight");
	if (!f) { fightView = null; $("#fight").classList.add("hidden"); if (me.upper === "tug") { me.upper = null; sendPose(true); } return; }
	if (fightView && fightView.id === f.id) return;
	fightView = Object.assign({ mine: 0, other: 0, decided: false, lastSent: 0, lastCount: 9 }, f);
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
	if (inFight && t - f.lastSent > 120 && t < f.end + 400) { f.lastSent = t; send({ t: "tug", f: f.id, n: f.mine }); }
	// the holder's client decides (the challenger does if the holder vanished)
	const wait = f.a === MY_ID ? 700 : f.b === MY_ID ? 3500 : -1;
	if (!f.decided && wait >= 0 && t > f.end + wait) {
		f.decided = true;
		const winB = bScore > aScore;
		const winId = winB ? f.b : f.a, winName = winB ? f.bn : f.an;
		setShared("remote", { by: winId, name: winName });
		setShared("fight", null);
		send({ t: "fx", kind: "fightend", w: winName, sa: aScore, sb: bScore });
		fightResult(winName, aScore, bScore);
	}
}
function fightResult(winName, sa, sb) {
	toast(`<b>${esc(winName)}</b> won the remote! (${sa} : ${sb})`, null, null, 5000);
	if (audio) audio.sfx(winName === profile.name ? "win" : "chime");
	if (winName === profile.name) heartsFx(myAvatar.root, 6, "#ffd34f");
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
			<div class="row"><button class="btn" data-pick="${i}">${src ? "Change" : "Add photo"}</button>${src ? `<button class="btn" data-del="${i}">Remove</button>` : ""}</div></div>`;
	}).join("")}</div><input type="file" accept="image/*" id="phfile" class="hidden"><p class="muted" style="margin:14px 0 0">Photos hang on the wall for everyone. They're kept in this room on each device.</p>`;
	const body = openModal("photos", "Our Memories", html, 680);
	let slot = 0;
	const file = body.querySelector("#phfile");
	body.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { slot = +b.dataset.pick; file.click(); });
	body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => setShared("photo" + b.dataset.del, ""));
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

// ---------- love notes
const seen = new Set(lsGet(LS_SEEN, []));
const pendingLetters = [];
function letters() {
	return Object.keys(S).filter(k => k.indexOf("letter:") === 0 && S[k].v).map(k => S[k].v).sort((a, b) => b.ts - a.ts);
}
function onLetter(k, v, remote) {
	if (!v || v.from === ME_PID || seen.has(v.id)) { if (modalKind === "love") openLove(); return; }
	if (get("opened:" + v.id + ":" + ME_PID)) return;
	if (!entered) { pendingLetters.push(v); return; }
	if (now() - v.ts > 3600000) remote = false; // old note: no flying envelope
	seen.add(v.id); lsSet(LS_SEEN, [...seen].slice(-200));
	if (remote) envelopeFx(v.from);
	toast(`A love note from <b>${esc(v.fromName)}</b>`, "Open", () => readLetter(v), 12000);
	if (audio) audio.sfx("love");
	if (modalKind === "love") openLove();
}
function onOpened(k, v, remote) {
	if (!remote) return;
	const [, lid, who] = k.split(":");
	const l = get("letter:" + lid);
	if (l && l.from === ME_PID) {
		const p = [...peers.values()].find(x => x.look.pid === who);
		toast(`<b>${esc(p ? p.look.name : "They")}</b> opened your love note`, null, null, 6000);
	}
	if (modalKind === "love") openLove();
}
function readLetter(l) {
	if (!get("opened:" + l.id + ":" + ME_PID) && l.from !== ME_PID) setShared("opened:" + l.id + ":" + ME_PID, now());
	const body = openModal("letter", "Love note", `<div class="letter openletter"><div style="white-space:pre-wrap">${esc(l.text)}</div><div class="sig">with love, ${esc(l.fromName)}</div></div><div class="row" style="margin-top:14px;justify-content:space-between"><span class="muted">${new Date(l.ts).toLocaleString()}</span><button class="btn primary" id="reply">Write back</button></div>`, 520);
	body.querySelector("#reply").onclick = openLove;
	if (audio) audio.sfx("love", 0.7);
}
const ENV_SVG = '<svg class="env" viewBox="0 0 38 28"><rect x="1" y="1" width="36" height="26" rx="3" fill="#f8efe1" stroke="#d8c6ad"/><path d="M1 3l18 13L37 3" fill="none" stroke="#d8c6ad" stroke-width="1.5"/><circle cx="19" cy="16" r="4" fill="#b5272d"/></svg>';
function openLove() {
	const all = letters().slice(0, 30);
	const list = all.map(l => {
		const mine = l.from === ME_PID;
		const readBy = Object.keys(S).some(k => k.indexOf("opened:" + l.id + ":") === 0);
		const readMe = !!get("opened:" + l.id + ":" + ME_PID);
		return `<div class="lt" data-l="${esc(l.id)}">${ENV_SVG}<div class="meta"><b>${mine ? "You wrote" : "From " + esc(l.fromName)}</b><span>${esc(l.text.slice(0, 60))}${l.text.length > 60 ? "..." : ""}</span></div><span class="tag ${(mine ? readBy : readMe) ? "read" : ""}">${mine ? (readBy ? "Opened" : "Sent") : (readMe ? "Read" : "New")}</span></div>`;
	}).join("");
	const body = openModal("love", "Love Notes", `<div class="letter"><textarea id="lovetext" maxlength="1500" placeholder="Write something sweet..."></textarea></div>
		<div class="row" style="margin-top:12px;justify-content:space-between"><span class="muted">${peers.size ? "It flies straight to " + [...peers.values()].map(p => esc(p.look.name)).join(", ") : "Nobody else is here yet - it'll be waiting for them."}</span><button class="btn primary" id="lovesend">Send note</button></div>
		${list ? `<div class="letters">${list}</div>` : ""}`, 560);
	body.querySelector("#lovesend").onclick = () => {
		const text = body.querySelector("#lovetext").value.trim();
		if (!text) return;
		const id = Math.random().toString(36).slice(2, 10);
		setShared("letter:" + id, { id, from: ME_PID, fromName: profile.name, text, ts: now() });
		send({ t: "fx", kind: "letter" });
		if (audio) audio.sfx("whoosh");
		toast("Your love note is on its way", null, null, 4000);
		pruneLetters();
		openLove();
	};
	body.querySelectorAll("[data-l]").forEach(el => el.onclick = () => { const l = get("letter:" + el.dataset.l); if (l) readLetter(l); });
	setTimeout(() => { const t = body.querySelector("#lovetext"); if (t) t.focus(); }, 50);
}
function pruneLetters() {
	const all = letters();
	all.slice(40).forEach(l => { delete S["letter:" + l.id]; Object.keys(S).forEach(k => { if (k.indexOf("opened:" + l.id) === 0) delete S[k]; }); });
	persist();
}

// ---------- coffee: brew it, then actually drink it
function makeCoffee() {
	if (room.coffee.brewing > 0) return;
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
			setShared("coffee", { n: Math.min(3, (c.n || 0) + 1), at: now() });
			toast("Your coffee is ready - it's on the coffee table", "Drink it", drinkCoffee, 9000);
		}
	};
}
function applyCoffee() {
	const c = get("coffee");
	const fresh = now() - (c.at || 0) < 3 * 3600 * 1000;
	room.coffee.mugs.forEach((m, i) => { m.visible = fresh && i < (c.n || 0); });
}
function drinkCoffee() {
	const c = get("coffee");
	if (!(c.n > 0)) { addLog("There's no coffee yet. Make some at the machine in the kitchen.", true); return; }
	if (me.upper === "drink") return;
	setShared("coffee", { n: c.n - 1, at: c.at });
	me.upper = "drink"; me.upperUntil = performance.now() + 5200;
	updateProps();
	sendPose(true);
	if (audio) { setTimeout(() => audio.sfx("sip"), 900); setTimeout(() => audio.sfx("sip"), 3700); }
	setTimeout(() => addLog("Mmm, that's a good coffee.", true), 5200);
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
	me.x = def.stand[0]; me.z = def.stand[1]; me.h = def.face;
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
	cam.yaw = def.face + Math.PI + 0.55; cam.pitch = 0.3; cam.dist = 2.6;
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
			rps: '<svg viewBox="0 0 40 40"><circle cx="12" cy="24" r="8" fill="#9aa0a6"/><rect x="20" y="8" width="14" height="18" rx="2" fill="#fdfaf2"/><path d="M22 30l10-8M22 22l10 8" stroke="#e05561" stroke-width="3" stroke-linecap="round"/></svg>'
		};
		const body = openModal("arcade", "Arcade", `<div class="gmenu">${Games.GAME_LIST.map(x => `<button class="gcard" data-g="${x.type}"><div class="gi">${icons[x.type]}</div><div><b>${x.name}</b><span>${x.desc}</span></div></button>`).join("")}</div><p class="muted" style="margin:14px 0 0">Starting a game puts it on the arcade screen for everyone. Anyone can join, or play the computer.</p>`, 460);
		body.querySelectorAll("[data-g]").forEach(b => b.onclick = () => startGame(b.dataset.g));
		return;
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
		toast(`<b>${esc(g.names[0])}</b> started ${Games.GAME_LIST.find(x => x.type === g.type).name} on the arcade`, "Join", () => { openArcade(); gameCtx().onJoin(); }, 20000);
	}
	if (remote && k === "game" && g.players[1] && g.players[0] === MY_ID && g.moves === 0 && g.players[1] !== "cpu" && modalKind !== "arcade") {
		toast(`<b>${esc(g.names[1])}</b> joined your game`, "Play", () => openArcade(), 8000);
	}
}

// ============================================================ effects
const fxObjs = [];
function heartsFx(root, n, color) {
	for (let i = 0; i < n; i++) {
		const h = heartMesh(0.16 + Math.random() * 0.08, color || ["#ff4d6d", "#ff8fab", "#ff6b81"][i % 3]);
		h.position.set(root.position.x + (Math.random() - 0.5) * 0.5, 1.7 + Math.random() * 0.3, root.position.z + (Math.random() - 0.5) * 0.5);
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
		case "fightend": fightResult(String(d.w || "Someone").slice(0, 24), +d.sa || 0, +d.sb || 0); break;
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
	if (me.anim === "sleep") standUp();
	if (me.upper === "piano" || me.upper === "paint" || me.upper === "tug") return;
	if (e === "dance" && me.sit) standUp();
	me.upper = e;
	me.upperUntil = performance.now() + (e === "dance" ? 8000 : e === "wave" ? 2600 : 2200);
	updateProps();
	sendPose(true);
	if (e === "heart") { heartsFx(myAvatar.root, 7); send({ t: "fx", kind: "hearts" }); if (audio) audio.sfx("love", 0.5); }
}
// what's in your hand: a mug while drinking, the brush while painting, else the remote if you hold it
function updateProps() {
	const kind = me.upper === "drink" ? "mug" : me.upper === "paint" ? "brush" : get("remote").by === MY_ID ? "remote" : null;
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
		else if (drawOpen) closeDraw();
		else if (remoteOpen) closeRemote();
		else if (me.sit) standUp();
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
	if (k === "enter" || k === "t") { e.preventDefault(); $("#chat").focus(); return; }
	if (k === "e" || k === " ") { e.preventDefault(); if (nearId) interact(nearId); return; }
	if (k === "1") emote("wave"); else if (k === "2") emote("heart"); else if (k === "3") emote("dance"); else if (k === "4") emote("clap");
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
			myAvatar.say(text);
			send({ t: "chat", text });
			addLog("<b style='color:" + profile.top + "'>" + esc(profile.name) + "</b> " + esc(text));
			chatEl.value = "";
		} else chatEl.blur();
	}
});
document.querySelectorAll(".em").forEach(b => b.addEventListener("click", () => emote(b.dataset.e)));

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
		if (p && p.anim === "sleep") wakePeer(pid);
		else if (p) { if (!me.sit) me.h = Math.atan2(p.x - me.x, p.z - me.z); emote("wave"); }
		return;
	}
	const id = findInteract(h.object);
	if (id) {
		const def = room.interactables[id];
		const d = Math.hypot(def.stand[0] - me.x, def.stand[1] - me.z);
		if (d < 1.5 || canReach(id) || (me.sit && def.sit && def.sit.includes(me.sit))) interact(id);
		else walkTo(def.stand[0], def.stand[1], id);
		return;
	}
	walkTo(h.point.x, h.point.z, null);
	clickMarker(h.point.x, h.point.z);
});
canvas.addEventListener("wheel", e => { e.preventDefault(); cam.dist = Math.max(1.2, Math.min(7.5, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
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
			if (pid) { const p = peers.get(pid); label = p ? (p.anim === "sleep" ? "Wake " + p.look.name + " up" : "Wave at " + p.look.name) : null; }
			else { const id = findInteract(h.object); if (id) label = labelOf(id); }
		}
	}
	const tip = $("#tip");
	canvas.style.cursor = label || pointer ? "pointer" : "default";
	if (label) { tip.textContent = label; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.remove("hidden"); }
	else tip.classList.add("hidden");
}
function walkTo(x, z, act) {
	if (me.sit) standUp(true);
	if (drawOpen) closeDraw();
	me.target = { x: Math.max(ROOM.minX + 0.4, Math.min(ROOM.maxX - 0.4, x)), z: Math.max(ROOM.minZ + 0.4, Math.min(ROOM.maxZ - 0.4, z)) };
	me.targetAct = act;
	me.stuck = 0;
}
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
	if (x < ROOM.minX + RADIUS || x > ROOM.maxX - RADIUS || z < ROOM.minZ + RADIUS || z > ROOM.maxZ - RADIUS) return true;
	for (const c of room.colliders) if (x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS) return true;
	if (ignorePeers) return false;
	// other people are solid too (only blocks moving closer, so you can never get stuck inside someone)
	for (const p of peers.values()) {
		if (p.sit) continue;
		const d = Math.hypot(x - p.x, z - p.z);
		if (d < RADIUS * 1.8 && d < Math.hypot(me.x - p.x, me.z - p.z)) return true;
	}
	return false;
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
function placeAvatar(av, x, z, h, sitId) {
	const spot = sitId && room.sitSpots.find(s => s.id === sitId);
	av.root.position.set(x, spot ? spot.y : 0, z);
	if (spot && spot.lie) { av.root.rotation.order = "YXZ"; av.root.rotation.set(-Math.PI / 2, spot.h, 0); }
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
	const run = keys.has("shift");
	let mx = 0, mz = 0, want = 0;
	if (Math.abs(ix) + Math.abs(iz) > 0.08) {
		me.target = null;
		if (me.sit) standUp();
		if (drawOpen) closeDraw();
		const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
		const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
		mx = fx * iz + rx * ix; mz = fz * iz + rz * ix;
		const l = Math.hypot(mx, mz);
		want = Math.min(1, l) * (run ? 1.75 : 1);
		mx /= l; mz /= l;
	} else if (me.target) {
		const dx = me.target.x - me.x, dz = me.target.z - me.z, l = Math.hypot(dx, dz);
		if (l < 0.12) {
			me.target = null;
			if (me.targetAct) { const a = me.targetAct; me.targetAct = null; interact(a); }
		} else { mx = dx / l; mz = dz / l; want = Math.min(1.25, 0.4 + l); }
	}
	if (me.sit) want = 0;
	me.speed += (want - me.speed) * Math.min(1, dt * 10);
	if (me.speed > 0.02 && (mx || mz) && !me.sit) {
		const v = me.speed * 2.6 * dt;
		const nx = me.x + mx * v, nz = me.z + mz * v;
		const ox = me.x, oz = me.z;
		// if we somehow ended up inside furniture, let us walk straight out of it
		const trapped = blocked(me.x, me.z, true);
		if (trapped || !blocked(nx, me.z)) me.x = nx;
		if (trapped || !blocked(me.x, nz)) me.z = nz;
		me.x = Math.max(ROOM.minX + RADIUS, Math.min(ROOM.maxX - RADIUS, me.x));
		me.z = Math.max(ROOM.minZ + RADIUS, Math.min(ROOM.maxZ - RADIUS, me.z));
		me.h = angleLerp(me.h, Math.atan2(mx, mz), Math.min(1, dt * 12));
		if (me.target) {
			const moved = Math.hypot(me.x - ox, me.z - oz);
			if (moved < v * 0.25) { me.stuck += dt; if (me.stuck > 0.6) { const a = me.targetAct; me.target = null; me.targetAct = null; if (a && Math.hypot(room.interactables[a].stand[0] - me.x, room.interactables[a].stand[1] - me.z) < 2.6) interact(a); } }
			else me.stuck = 0;
		}
		if (["wave", "dance", "clap", "heart", "paint", "piano"].includes(me.upper)) { me.upper = null; updateProps(); }
	}
	if (me.upperUntil && performance.now() > me.upperUntil) {
		me.upperUntil = 0;
		if (["wave", "dance", "clap", "heart", "drink"].includes(me.upper)) { me.upper = null; updateProps(); sendPose(true); }
	}
	placeAvatar(myAvatar, me.x, me.z, me.h, me.sit);
	myAvatar.speed = me.sit ? 0 : me.speed;
	myAvatar.anim = me.anim;
	myAvatar.upper = me.upper;
	myAvatar.lookYaw = me.sit ? null : lookYawFor(me.x, me.z, me.h, peers.values());
	sendPose(false);
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
		placeAvatar(p.avatar, p.x, p.z, p.h, p.sit);
		p.avatar.speed = p.sit ? 0 : p.speed;
		const wasSleep = p.avatar.anim === "sleep";
		p.avatar.anim = p.anim;
		p.avatar.upper = p.upper;
		if (wasSleep !== (p.anim === "sleep")) refreshPeople();
		const others = [{ x: me.x, z: me.z }].concat([...peers.values()].filter(q => q !== p));
		p.avatar.lookYaw = p.sit ? null : lookYawFor(p.x, p.z, p.h, others);
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
	px = Math.max(ROOM.minX + 0.25, Math.min(ROOM.maxX - 0.25, px));
	pz = Math.max(ROOM.minZ + 0.25, Math.min(ROOM.maxZ - 0.25, pz));
	py = Math.max(0.3, Math.min(ROOM.H - 0.2, py));
	camera.position.set(px, py, pz);
	camera.lookAt(cam.tx, cam.ty, cam.tz);
}

// ============================================================ HUD prompt
let nearId = null;
function updatePrompt() {
	let best = null, bd = 1.6;
	if (!me.sit) {
		for (const id in room.interactables) {
			const def = room.interactables[id];
			const d = Math.hypot(def.stand[0] - me.x, def.stand[1] - me.z);
			if (d < bd) { bd = d; best = id; }
		}
	} else if (me.anim === "sit") {
		// from a seat you can still reach things on the table, the TV, lamps...
		for (const id of ["mug", "remote", "notes", "tv", "lamp"]) {
			if (id === "mug" && !(get("coffee").n > 0)) continue;
			if (canReach(id)) { best = id; break; }
		}
	}
	if (modalKind || drawOpen || me.upper === "piano" || fightView) best = null;
	nearId = best;
	const pr = $("#prompt");
	if (best) { $("#ptext").textContent = labelOf(best); pr.classList.remove("off"); }
	else pr.classList.add("off");
}
$("#prompt").onclick = () => { if (nearId) interact(nearId); };

// ============================================================ sound toggle
let muted = lsGet("harmonyWorldMuted", false);
const SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/></svg>';
function renderSound() { $("#b-sound").innerHTML = muted ? SND_OFF : SND_ON; if (audio) audio.setMuted(muted); }
$("#b-sound").onclick = () => { muted = !muted; lsSet("harmonyWorldMuted", muted); renderSound(); };
$("#b-exit").onclick = leaveToPiano;
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
	addLog("Welcome to your little world, " + esc(profile.name) + ". Click anything to use it.", true);
	pendingLetters.splice(0).forEach(v => onLetter("letter:" + v.id, v, false));
	setTimeout(() => $("#help").classList.add("gone"), 45000);
};
// keep-alive pose even when the tab is in the background (rAF pauses there)
setInterval(() => { if (entered) send(poseMsg()); }, 5000);

// ============================================================ main loop
const clock = new THREE.Clock();
let tvAcc = 0, arcAcc = 0, ytAcc = 0;
function frame() {
	const dt = Math.min(0.05, clock.getDelta());
	const t = clock.elapsedTime;
	if (entered) updateMe(dt);
	else {
		placeAvatar(myAvatar, me.x, me.z, me.h + Math.sin(t * 0.4) * 0.3, null);
		myAvatar.anim = "idle"; myAvatar.upper = null; myAvatar.speed = 0; myAvatar.lookYaw = null;
	}
	myAvatar.update(dt);
	updatePeers(dt);
	updateBall(dt);
	updateFx(dt);
	updateFight();
	room.update(dt, t);
	updateCamera(dt, t);
	if (entered) updatePrompt();
	tvAcc += dt; arcAcc += dt; ytAcc += dt;
	if (tvAcc > 1 / 30) { tvAcc = 0; drawTVFrame(t); }
	if (arcAcc > 0.1) { arcAcc = 0; Games.drawArcade(room.arcade.canvas, get("game"), rpsLists(), t); room.arcade.tex.needsUpdate = true; }
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
	renderer.render(scene, camera);
	if (yt) cssRenderer.render(cssScene, camera);
	requestAnimationFrame(frame);
}

// ============================================================ boot
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
window.HarmonyWorld = { me, peers, interact, get, setShared, emote, walkTo, cam, standUp, playKey, tugTap, wakePeer, toggleNight, drinkCoffee };
