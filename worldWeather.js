/**
 * Harmony World — the weather and the seasons, the same for everyone.
 *
 * One shared key, "weather" = { kind, at, by }: clear, rain, a thunderstorm, snow, cherry blossom (spring) or
 * autumn leaves. Whoever changes it (the Weather panel) changes it for the whole world, and it fades in over a few
 * seconds.
 *
 *   falling things: one cloud of points per kind (rain streaks, snowflakes, petals, leaves) in a 40 m box that
 *     follows the camera (the shader wraps every point round inside it, so nothing is moved on the CPU), and never
 *     inside a room: every indoor room's rect is passed in and the points there are dropped in the vertex shader
 *   a storm: heavier rain, wind, and lightning on a schedule worked out from the wall clock (every 10 s slot has
 *     its own seeded flashes), so everyone sees the same flash and hears the thunder after it
 *   the ground: puddles with ripples come up while it rains and dry off after; snow settles over ~30 s and melts
 *   in the snow: build a snowman (Q; shared list "snowmen", up to 12, cleared a while after the snow stops),
 *     knock one over (R), and throw snowballs (G): every client flies the same ball, and each one only checks
 *     whether it hit its own avatar (so a hit is never argued about), then tells the thrower
 *
 * Lights: the house and the night button set the hemisphere light, the moon and the sky's colour when they need
 * to; the weather multiplies whatever they last set (it notices when they set something new), every frame.
 */
const KINDS = {
	clear:   { name: "Clear",       icon: "🌙", desc: "A calm, starry night",          verb: "cleared the sky" },
	rain:    { name: "Rain",        icon: "🌧️", desc: "Soft rain and puddles",         verb: "made it rain" },
	storm:   { name: "Thunderstorm", icon: "⛈️", desc: "Heavy rain, wind and lightning", verb: "brought a thunderstorm" },
	snow:    { name: "Snow",        icon: "❄️", desc: "Snowmen and snowball fights",    verb: "made it snow" },
	blossom: { name: "Cherry blossom", icon: "🌸", desc: "Spring: pink petals drifting", verb: "brought cherry blossom season" },
	autumn:  { name: "Autumn",      icon: "🍂", desc: "Falling orange and red leaves",  verb: "brought autumn leaves" }
};
const KIND_LIST = Object.keys(KINDS);
// how each kind looks: particle levels, how bright the night is (gloom), the sky's tint, the wind
const LOOK = {
	clear:   { rain: 0, snow: 0, petal: 0, leaf: 0, storm: 0, gloom: 1.0,  sky: [1, 1, 1],          wind: [0, 0] },
	rain:    { rain: 0.55, snow: 0, petal: 0, leaf: 0, storm: 0, gloom: 0.72, sky: [0.62, 0.66, 0.74], wind: [0.8, 0.3] },
	storm:   { rain: 1, snow: 0, petal: 0, leaf: 0, storm: 1, gloom: 0.5,  sky: [0.45, 0.48, 0.58], wind: [3.2, 1.1] },
	snow:    { rain: 0, snow: 1, petal: 0, leaf: 0, storm: 0, gloom: 1.12, sky: [0.86, 0.92, 1.08],  wind: [0.5, 0.2] },
	blossom: { rain: 0, snow: 0, petal: 1, leaf: 0, storm: 0, gloom: 1.04, sky: [1.06, 0.92, 0.98],  wind: [0.7, 0.35] },
	autumn:  { rain: 0, snow: 0, petal: 0, leaf: 1, storm: 0, gloom: 0.95, sky: [1.05, 0.93, 0.82],  wind: [1.3, 0.5] }
};
const BOX = [40, 24, 40];          // the box of falling things round the camera
const MAX_RECTS = 24;
const MAX_SNOWMEN = 12;
const SCARVES = ["#e63946", "#4cc9f0", "#ffd166", "#06d6a0", "#c77dff", "#ff8fab"];

// a small seeded random (the same numbers for everyone)
function rng(seed) {
	let a = (seed >>> 0) || 1;
	return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

// ------------------------------------------------------------------ shaders for the falling things
const VERT = `
attribute float seed;
uniform float uTime, uFall, uDensity, uSize, uPix, uSway, uSpin;
uniform vec3 uCam, uBox;
uniform vec2 uWind;
uniform vec4 uRects[${MAX_RECTS}];
uniform float uTops[${MAX_RECTS}];
uniform int uRectN;
varying float vSeed;
varying float vRot;
void main() {
	vSeed = seed;
	vRot = 0.0;
	if (seed > uDensity) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
	float sp = 0.75 + 0.5 * fract(seed * 7.31);
	vec3 p = position * uBox + vec3(uWind.x * sp, -uFall * sp, uWind.y * sp) * uTime;
	p.x += sin(uTime * (0.6 + seed) * 1.3 + seed * 40.0) * uSway;
	p.z += cos(uTime * (0.5 + seed) * 1.1 + seed * 31.0) * uSway;
	vec3 lo = uCam - uBox * 0.5;
	vec3 wp = lo + mod(p - lo, uBox);
	for (int i = 0; i < ${MAX_RECTS}; i++) {
		if (i >= uRectN) break;
		vec4 r = uRects[i];
		if (wp.x > r.x && wp.x < r.y && wp.z > r.z && wp.z < r.w && wp.y < uTops[i]) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
	}
	vec4 mv = viewMatrix * vec4(wp, 1.0);
	gl_Position = projectionMatrix * mv;
	gl_PointSize = uSize * uPix / max(0.5, -mv.z);
	vRot = seed * 6.283 + uTime * (0.6 + 2.0 * fract(seed * 3.7)) * uSpin;
}`;
const FRAG = `
uniform vec3 uColor;
uniform float uAlpha, uTilt;
varying float vSeed;
varying float vRot;
vec2 rot(vec2 c, float a) { float s = sin(a), k = cos(a); return vec2(k * c.x - s * c.y, s * c.x + k * c.y); }
void main() {
	vec2 c = gl_PointCoord - 0.5;
	float a;
	vec3 col = uColor;
#if KIND == 0
	c = rot(c, uTilt);
	a = (1.0 - smoothstep(0.01, 0.03, abs(c.x))) * (1.0 - smoothstep(0.2, 0.5, abs(c.y)));
#elif KIND == 1
	a = 1.0 - smoothstep(0.12, 0.5, length(c));
#elif KIND == 2
	c = rot(c, vRot);
	vec2 q = c * vec2(2.4, 1.55);
	a = 1.0 - smoothstep(0.62, 0.72, length(q));
	a *= smoothstep(0.05, 0.09, length(c - vec2(0.0, 0.33)));
	col = mix(vec3(1.0, 0.66, 0.78), vec3(1.0, 0.88, 0.93), fract(vSeed * 13.0)) * (0.85 + 0.3 * (c.x + 0.5));
#else
	c = rot(c, vRot);
	float w = 0.22 * (1.0 - 4.0 * c.y * c.y);
	a = smoothstep(0.0, 0.03, w - abs(c.x)) * step(abs(c.y), 0.48);
	float f = fract(vSeed * 17.0);
	col = f < 0.3 ? vec3(0.95, 0.45, 0.12) : f < 0.55 ? vec3(0.8, 0.18, 0.12) : f < 0.8 ? vec3(0.98, 0.75, 0.2) : vec3(0.55, 0.3, 0.15);
	col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.02, abs(c.x)));
#endif
	if (a < 0.02) discard;
	gl_FragColor = vec4(col, a * uAlpha);
}`;

export function createWeather(W) {
	const { THREE, scene, camera } = W;
	const Y = new THREE.Vector3(0, 1, 0);
	const root = new THREE.Group();
	root.name = "weather";
	scene.add(root);

	// ------------------------------------------------------------------ the shared state
	const weather = () => {
		const w = W.get("weather");
		if (!w || typeof w !== "object" || !KINDS[w.kind]) return { kind: "clear", at: 0, by: "" };
		return { kind: w.kind, at: num(w.at, 0), by: typeof w.by === "string" ? w.by.slice(0, 24) : "" };
	};
	const snowmenList = () => {
		const l = W.get("snowmen");
		if (!Array.isArray(l)) return [];
		return l.filter(s => s && typeof s === "object" && typeof s.id === "string" && isFinite(s.x) && isFinite(s.z)).slice(-MAX_SNOWMEN);
	};
	const myName = () => (W.profile() && W.profile().name) || "Someone";
	function setWeather(kind) {
		if (!KINDS[kind]) return;
		W.setShared("weather", { kind, at: Date.now(), by: myName() });
		W.sfx(kind === "storm" ? "thunder" : "switch", 0.5);
	}

	// ------------------------------------------------------------------ falling things
	const rects = [];
	for (let i = 0; i < MAX_RECTS; i++) rects.push(new THREE.Vector4(0, 0, 0, 0));
	const tops = new Float32Array(MAX_RECTS);
	const rectN = { value: 0 };
	function loadRects() {
		const list = W.indoorRects || [];
		const n = Math.min(MAX_RECTS, list.length);
		for (let i = 0; i < n; i++) { const r = list[i]; rects[i].set(r.minX, r.maxX, r.minZ, r.maxZ); tops[i] = num(r.top, 9); }
		rectN.value = n;
	}
	const pix = { value: 600 };
	const camU = { value: new THREE.Vector3() };
	const boxU = { value: new THREE.Vector3(BOX[0], BOX[1], BOX[2]) };
	const timeU = { value: 0 };
	const windU = { value: new THREE.Vector2() };
	const rectsU = { value: rects }, topsU = { value: tops };
	function cloud(kind, count, o) {
		const pos = new Float32Array(count * 3), seed = new Float32Array(count);
		const r = rng(1000 + kind);
		for (let i = 0; i < count; i++) { pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = r(); seed[i] = r(); }
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
		geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
		const m = new THREE.ShaderMaterial({
			defines: { KIND: kind },
			uniforms: {
				uTime: timeU, uCam: camU, uBox: boxU, uWind: windU, uPix: pix, uRects: rectsU, uTops: topsU, uRectN: rectN,
				uFall: { value: o.fall }, uDensity: { value: 0 }, uSize: { value: o.size }, uSway: { value: o.sway || 0 }, uSpin: { value: o.spin || 0 },
				uColor: { value: new THREE.Color(o.color) }, uAlpha: { value: o.alpha }, uTilt: { value: 0 }
			},
			vertexShader: VERT, fragmentShader: FRAG,
			transparent: true, depthWrite: false
		});
		const pts = new THREE.Points(geo, m);
		pts.frustumCulled = false;
		pts.visible = false;
		pts.renderOrder = 5;
		root.add(pts);
		return pts;
	}
	const rain = cloud(0, 9000, { fall: 16, size: 0.9, color: "#c8d8ec", alpha: 0.42 });
	const snow = cloud(1, 5000, { fall: 1.1, size: 0.11, sway: 0.6, color: "#ffffff", alpha: 0.9 });
	const petals = cloud(2, 1600, { fall: 0.9, size: 0.16, sway: 1.1, spin: 1.6, color: "#ffb3c8", alpha: 0.95 });
	const leaves = cloud(3, 1200, { fall: 1.3, size: 0.24, sway: 1.4, spin: 2.2, color: "#e07a2f", alpha: 0.95 });

	// ------------------------------------------------------------------ lightning: deterministic flashes per 10 s slot
	const SLOT = 10000;
	const flashes = [];   // the flashes of the slot before, this one and the next: { t (ms), s, ang, bolt, thunder (ms) }
	for (let i = 0; i < 6; i++) flashes.push({ t: -1e15, s: 0, ang: 0, bolt: -1, thunder: -1e15 });
	let flashSlot = -1e9;
	function planFlashes(slot) {
		flashSlot = slot;
		for (let k = 0; k < 3; k++) {
			const r = rng((slot - 1 + k) * 9301 + 77);
			const n = r() < 0.5 ? 1 : r() < 0.6 ? 2 : 0;
			for (let j = 0; j < 2; j++) {
				const f = flashes[k * 2 + j];
				if (j >= n) { f.t = -1e15; f.thunder = -1e15; continue; }
				f.t = (slot - 1 + k) * SLOT + r() * (SLOT - 1200);
				f.s = 0.6 + r() * 0.4;
				f.ang = r() * Math.PI * 2;
				f.bolt = r() < 0.75 ? Math.floor(r() * 3) : -1;
				f.thunder = f.t + 500 + r() * 1500;
			}
		}
	}
	// three jagged bolts, built once
	const boltM = new THREE.MeshBasicMaterial({ color: "#e6eeff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
	const bolts = [0, 1, 2].map(b => {
		const r = rng(4242 + b * 17), verts = [];
		const strip = (pts, w) => {
			for (let i = 0; i < pts.length - 1; i++) {
				const a = pts[i], c = pts[i + 1];
				for (const [dx, dz] of [[w, 0], [0, w]]) verts.push(a[0] - dx, a[1], a[2] - dz, a[0] + dx, a[1], a[2] + dz, c[0] + dx, c[1], c[2] + dz, a[0] - dx, a[1], a[2] - dz, c[0] + dx, c[1], c[2] + dz, c[0] - dx, c[1], c[2] - dz);
			}
		};
		const main = [];
		let x = 0, z = 0;
		for (let y = 42; y >= 0; y -= 2.2 + r() * 1.6) { main.push([x, y, z]); x += (r() - 0.5) * 3.2; z += (r() - 0.5) * 1.2; }
		main.push([x, 0, z]);
		strip(main, 0.28);
		const from = main[2 + Math.floor(r() * 4)], br = [from];
		let bx = from[0], by = from[1], bz = from[2];
		for (let i = 0; i < 5; i++) { bx += 1 + r() * 2; by -= 2 + r() * 2; bz += (r() - 0.5); br.push([bx, by, bz]); }
		strip(br, 0.16);
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
		const m = new THREE.Mesh(geo, boltM);
		m.visible = false;
		m.frustumCulled = false;
		m.renderOrder = 6;
		root.add(m);
		return m;
	});

	// ------------------------------------------------------------------ the ground: puddles, ripples, snow cover
	const groundRects = () => (W.groundRects || []).filter(r => r && isFinite(r.minX) && isFinite(r.maxX) && isFinite(r.minZ) && isFinite(r.maxZ));
	// a ground rect with the water cut out of it (up to 4 pieces round each pool)
	function dry(r) {
		let out = [r];
		for (const w of W.waterRects || []) {
			const next = [];
			for (const q of out) {
				if (w.maxX <= q.minX || w.minX >= q.maxX || w.maxZ <= q.minZ || w.minZ >= q.maxZ) { next.push(q); continue; }
				const z0 = Math.max(q.minZ, w.minZ), z1 = Math.min(q.maxZ, w.maxZ);
				if (w.minZ > q.minZ) next.push({ minX: q.minX, maxX: q.maxX, minZ: q.minZ, maxZ: w.minZ, y: q.y });
				if (w.maxZ < q.maxZ) next.push({ minX: q.minX, maxX: q.maxX, minZ: w.maxZ, maxZ: q.maxZ, y: q.y });
				if (w.minX > q.minX) next.push({ minX: q.minX, maxX: w.minX, minZ: z0, maxZ: z1, y: q.y });
				if (w.maxX < q.maxX) next.push({ minX: w.maxX, maxX: q.maxX, minZ: z0, maxZ: z1, y: q.y });
			}
			out = next;
		}
		return out.filter(q => q.maxX - q.minX > 0.3 && q.maxZ - q.minZ > 0.3);
	}
	const MAX_PUDDLES = 90;
	const puddleM = new THREE.MeshStandardMaterial({ color: "#1a2230", roughness: 0.04, metalness: 0.75, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
	const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), puddleM, MAX_PUDDLES);
	const rippleM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
	const ripples = new THREE.InstancedMesh(new THREE.RingGeometry(0.86, 1, 28).rotateX(-Math.PI / 2), rippleM, MAX_PUDDLES * 2);
	ripples.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PUDDLES * 2 * 3), 3);
	puddles.castShadow = ripples.castShadow = false;
	puddles.visible = ripples.visible = false;
	puddles.frustumCulled = ripples.frustumCulled = false;
	root.add(puddles, ripples);
	const pud = { n: 0, x: new Float32Array(MAX_PUDDLES), y: new Float32Array(MAX_PUDDLES), z: new Float32Array(MAX_PUDDLES), r: new Float32Array(MAX_PUDDLES), ph: new Float32Array(MAX_PUDDLES * 2) };
	const snowTex = (() => {
		const c = document.createElement("canvas");
		c.width = c.height = 256;
		const g = c.getContext("2d"), r = rng(77);
		g.fillStyle = "#f4f8ff"; g.fillRect(0, 0, 256, 256);
		for (let i = 0; i < 260; i++) {
			const x = r() * 256, y = r() * 256, s = 4 + r() * 18, t = 215 + r() * 40;
			g.fillStyle = `rgba(${t | 0},${(t + 6) | 0},255,${0.15 + r() * 0.25})`;
			g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
		}
		const tx = new THREE.CanvasTexture(c);
		tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
		tx.colorSpace = THREE.SRGBColorSpace;
		return tx;
	})();
	const snowM = new THREE.MeshStandardMaterial({ color: "#ffffff", map: snowTex, roughness: 0.92, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
	let snowCover = null, groundSig = "";
	const _d = new THREE.Object3D(), _c = new THREE.Color();
	function buildGround() {
		const list = groundRects();
		const sig = list.map(r => [r.minX, r.maxX, r.minZ, r.maxZ, r.y].join(",")).join(";") + "|" + (W.waterRects || []).length;
		if (sig === groundSig) return;
		groundSig = sig;
		const pieces = [];
		list.forEach(r => dry({ minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, y: num(r.y, 0) }).forEach(q => pieces.push(q)));
		// snow: one merged sheet of quads, with the texture laid out in world space
		const pos = [], uv = [], idx = [];
		pieces.forEach(q => {
			const b = pos.length / 3, y = q.y + 0.025;
			pos.push(q.minX, y, q.minZ, q.maxX, y, q.minZ, q.maxX, y, q.maxZ, q.minX, y, q.maxZ);
			uv.push(q.minX / 4, q.minZ / 4, q.maxX / 4, q.minZ / 4, q.maxX / 4, q.maxZ / 4, q.minX / 4, q.maxZ / 4);
			idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
		});
		if (snowCover) { root.remove(snowCover); snowCover.geometry.dispose(); }
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
		geo.setIndex(idx);
		geo.computeVertexNormals();
		snowCover = new THREE.Mesh(geo, snowM);
		snowCover.receiveShadow = true;
		snowCover.visible = false;
		snowCover.frustumCulled = false;
		root.add(snowCover);
		// puddles: dotted about (the same places for everyone), about one per 18 m^2
		const r = rng(5150);
		const area = pieces.reduce((a, q) => a + (q.maxX - q.minX) * (q.maxZ - q.minZ), 0) || 1;
		let n = 0;
		pieces.forEach(q => {
			const want = Math.round(MAX_PUDDLES * (q.maxX - q.minX) * (q.maxZ - q.minZ) / Math.max(area, MAX_PUDDLES * 18));
			for (let i = 0; i < want && n < MAX_PUDDLES; i++, n++) {
				const rad = 0.35 + r() * 0.75;
				pud.x[n] = q.minX + rad + r() * Math.max(0, q.maxX - q.minX - rad * 2);
				pud.z[n] = q.minZ + rad + r() * Math.max(0, q.maxZ - q.minZ - rad * 2);
				pud.y[n] = q.y + 0.014; pud.r[n] = rad;
				pud.ph[n * 2] = r(); pud.ph[n * 2 + 1] = r();
				_d.position.set(pud.x[n], pud.y[n], pud.z[n]); _d.rotation.set(0, r() * 3, 0); _d.scale.set(rad * (1 + r() * 0.6), 1, rad); _d.updateMatrix();
				puddles.setMatrixAt(n, _d.matrix);
			}
		});
		pud.n = n;
		puddles.count = n;
		ripples.count = n * 2;
		puddles.instanceMatrix.needsUpdate = true;
	}

	// ------------------------------------------------------------------ puffs (snowball splats, snowmen knocked over)
	const PUFFS = 80;
	const puffM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
	const puffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), puffM, PUFFS);
	puffMesh.castShadow = false;
	puffMesh.frustumCulled = false;
	root.add(puffMesh);
	const pf = { p: new Float32Array(PUFFS * 3), v: new Float32Array(PUFFS * 3), life: new Float32Array(PUFFS), next: 0, alive: 0 };
	_d.position.set(0, -999, 0); _d.scale.set(0, 0, 0); _d.updateMatrix();
	for (let i = 0; i < PUFFS; i++) puffMesh.setMatrixAt(i, _d.matrix);
	function puff(x, y, z, n, sp) {
		for (let k = 0; k < n; k++) {
			const i = pf.next; pf.next = (pf.next + 1) % PUFFS;
			const a = Math.random() * Math.PI * 2, u = Math.random();
			pf.p[i * 3] = x; pf.p[i * 3 + 1] = y; pf.p[i * 3 + 2] = z;
			pf.v[i * 3] = Math.cos(a) * sp * (0.4 + u); pf.v[i * 3 + 1] = sp * (0.6 + Math.random()); pf.v[i * 3 + 2] = Math.sin(a) * sp * (0.4 + u);
			pf.life[i] = 0.6 + Math.random() * 0.5;
		}
		pf.alive = PUFFS;
	}
	function updatePuffs(dt) {
		if (!pf.alive) return;
		let any = 0;
		for (let i = 0; i < PUFFS; i++) {
			if (pf.life[i] <= 0) continue;
			pf.life[i] -= dt;
			pf.v[i * 3 + 1] -= 9.8 * dt;
			pf.p[i * 3] += pf.v[i * 3] * dt; pf.p[i * 3 + 1] += pf.v[i * 3 + 1] * dt; pf.p[i * 3 + 2] += pf.v[i * 3 + 2] * dt;
			const s = pf.life[i] > 0 ? Math.min(1, pf.life[i] * 2) : 0;
			_d.position.set(pf.p[i * 3], pf.p[i * 3 + 1], pf.p[i * 3 + 2]); _d.rotation.set(0, 0, 0); _d.scale.set(s, s, s); _d.updateMatrix();
			puffMesh.setMatrixAt(i, _d.matrix);
			any++;
		}
		puffMesh.instanceMatrix.needsUpdate = true;
		if (!any) pf.alive = 0;
	}

	// ------------------------------------------------------------------ snowmen
	// One goes on the shared list the moment you start building it (ts), so everyone (even someone who walks up
	// halfway through) sees the same stage of it from its age: the bottom ball rolls up, then the middle, the head
	// pops on, and the face, arms, scarf and hat follow (BUILD seconds in all).
	const BUILD = 4.6;
	const smM = {
		snow: new THREE.MeshStandardMaterial({ color: "#f6f9ff", roughness: 0.85 }),
		coal: new THREE.MeshStandardMaterial({ color: "#1c1a1f", roughness: 0.6 }),
		carrot: new THREE.MeshStandardMaterial({ color: "#ff8a2b", roughness: 0.6 }),
		stick: new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 0.9 }),
		hat: new THREE.MeshStandardMaterial({ color: "#1f1b26", roughness: 0.5 })
	};
	const smGeo = {
		ball: new THREE.SphereGeometry(1, 20, 14), dot: new THREE.SphereGeometry(0.028, 8, 6), nose: new THREE.ConeGeometry(0.04, 0.24, 10),
		stick: new THREE.CylinderGeometry(0.018, 0.012, 0.6, 6), scarf: new THREE.TorusGeometry(0.17, 0.05, 8, 20), tail: new THREE.BoxGeometry(0.1, 0.32, 0.04),
		brim: new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), crown: new THREE.CylinderGeometry(0.14, 0.15, 0.26, 20)
	};
	const scarfM = {};
	const backOut = u => { u = clamp01(u); const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
	const smooth = u => { u = clamp01(u); return u * u * (3 - 2 * u); };
	function makeSnowman(s) {
		const g = new THREE.Group();
		const part = (parent, geo, m, x, y, z, sc) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.setScalar(sc || 1); o.castShadow = true; parent.add(o); return o; };
		const bottom = part(g, smGeo.ball, smM.snow, 0, 0.4, 0, 0.42);
		const middle = part(g, smGeo.ball, smM.snow, 0, 0.98, 0, 0.3);
		const head = part(g, smGeo.ball, smM.snow, 0, 1.42, 0, 0.21);
		// the little things, each with the moment (in the build) it goes on
		const details = [];
		const detail = (o, at) => { o.userData.base = o.scale.x; o.userData.at = at; o.visible = false; details.push(o); return o; };
		for (const sx of [-0.07, 0.07]) detail(part(g, smGeo.dot, smM.coal, sx, 1.47, 0.18), 3.3);
		for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25; detail(part(g, smGeo.dot, smM.coal, Math.sin(a) * 0.15, 1.36 - Math.cos(a) * 0.05 + 0.02, 0.15 + Math.cos(a) * 0.02, 0.7), 3.45 + i * 0.03); }
		for (let i = 0; i < 3; i++) detail(part(g, smGeo.dot, smM.coal, 0, 0.88 + i * 0.12, 0.29 - Math.abs(i - 1) * 0.01, 1.2), 3.65 + i * 0.05);
		const nose = detail(part(g, smGeo.nose, smM.carrot, 0, 1.42, 0.3), 3.55); nose.rotation.x = Math.PI / 2;
		for (const sx of [-1, 1]) { const a = detail(part(g, smGeo.stick, smM.stick, sx * 0.48, 1.08, 0), 3.85 + (sx > 0 ? 0.1 : 0)); a.rotation.z = sx * -1.0; }
		const col = SCARVES.indexOf(s.c) >= 0 ? s.c : SCARVES[0];
		const sm = scarfM[col] || (scarfM[col] = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
		const scarf = new THREE.Group(); g.add(scarf); detail(scarf, 4.05);
		const sc = part(scarf, smGeo.scarf, sm, 0, 1.24, 0); sc.rotation.x = Math.PI / 2;
		const tl = part(scarf, smGeo.tail, sm, 0.1, 1.08, 0.17); tl.rotation.z = 0.25;
		const hat = new THREE.Group(); hat.position.y = 1.6; g.add(hat); detail(hat, 4.25);
		part(hat, smGeo.brim, smM.hat, 0, 0, 0);
		part(hat, smGeo.crown, smM.hat, 0, 0.14, 0);
		const p = W.visXZ(s.x, s.z);
		g.position.set(p[0], W.floorAt(s.x, s.z), p[1]);
		g.rotation.y = num(s.h, 0);
		root.add(g);
		return { g, s, bottom, middle, head, hat, details, done: false, hatOff: false, wob: 0, sfxAt: 0 };
	}
	// where it is in its build (age in seconds)
	function poseSnowman(o, age) {
		if (o.done) return;
		const g1 = smooth(age / 1.5), g2 = smooth((age - 1.5) / 1.2), e3 = (age - 2.75) / 0.45;
		o.bottom.scale.setScalar(Math.max(0.001, 0.42 * g1));
		o.bottom.position.y = 0.42 * g1 - 0.02;
		o.bottom.rotation.x = age * 3;   // (rolled along as it grows)
		o.middle.visible = age > 1.5;
		o.middle.scale.setScalar(Math.max(0.001, 0.3 * g2));
		o.middle.position.y = 0.8 + 0.18 * g2;
		o.head.visible = age > 2.75;
		o.head.scale.setScalar(Math.max(0.001, 0.21 * backOut(e3)));
		o.head.position.y = 1.42 + (1 - clamp01(e3)) * 0.5;
		o.details.forEach(d => {
			const u = (age - d.userData.at) / 0.25;
			d.visible = u > 0 && !(d === o.hat && o.hatOff);
			if (d.isGroup) { d.scale.setScalar(Math.max(0.001, backOut(u))); if (d === o.hat) d.position.y = 1.6 + (1 - clamp01(u)) * 0.6; }
			else d.scale.setScalar(Math.max(0.001, d.userData.base * backOut(u)));
		});
		// a pat of snow as each part goes on
		const stage = age < 1.5 ? 0 : age < 2.75 ? 1 : age < 3.3 ? 2 : 3;
		if (stage > o.sfxAt && age < BUILD) { o.sfxAt = stage; W.sfx(stage === 2 ? "pop" : "thunk", 0.3); puff(o.g.position.x, o.g.position.y + (stage === 1 ? 0.85 : 1.35), o.g.position.z, 8, 1.0); }
		if (age >= BUILD) o.done = true;
	}
	const snowmen = new Map();   // id -> made snowman (see makeSnowman)
	function syncSnowmen() {
		const list = snowmenList(), seen = new Set();
		list.forEach(s => {
			seen.add(s.id);
			if (snowmen.has(s.id) || broken.has(s.id)) return;
			const o = makeSnowman(s);
			o.sfxAt = (Date.now() - num(s.ts, 0)) / 1000 > BUILD ? 9 : 0;
			snowmen.set(s.id, o);
		});
		// gone from the list (kicked over, or tidied away after the snow): it crumbles where it stands
		snowmen.forEach((o, id) => { if (!seen.has(id)) breakSnowman(id, Math.random() * Math.PI * 2, 0.4); });
	}
	const broken = new Set();   // (ids already broken here, so the list catching up later doesn't do it twice)

	// ------------------------------------------------------------------ bits flying about (a snowman kicked to pieces, a hat knocked off)
	const debris = [];   // { o, v, w, r, gy, t, s0 }
	const _sv = new THREE.Vector3();
	function fling(obj, vx, vy, vz, wx, wy, wz, r, gy) {
		obj.updateMatrixWorld(true);
		root.attach(obj);
		debris.push({ o: obj, v: new THREE.Vector3(vx, vy, vz), w: new THREE.Vector3(wx, wy, wz), r, gy, t: 0, s0: obj.scale.clone() });
	}
	function breakSnowman(id, dir, power) {
		const o = snowmen.get(id);
		broken.add(id);
		if (broken.size > 64) broken.delete(broken.values().next().value);
		if (!o) return;
		snowmen.delete(id);
		// (melted down to nothing already: it just goes)
		if (!o.g.visible) { root.remove(o.g); return; }
		const dx = Math.sin(dir), dz = Math.cos(dir), gy = o.g.position.y, P = power === undefined ? 1 : power;
		const rnd = (a) => (Math.random() - 0.5) * a;
		o.g.updateMatrixWorld(true);
		const kids = o.g.children.slice();
		kids.forEach(c => {
			if (!c.visible) { o.g.remove(c); return; }
			if (c === o.head) fling(c, dx * 5.5 * P + rnd(1), 3.2 * P + 1, dz * 5.5 * P + rnd(1), rnd(14), rnd(14), rnd(14), 0.21 * o.g.scale.y, gy);
			else if (c === o.middle) fling(c, dx * 2.2 * P, 1.2 * P, dz * 2.2 * P, dz * 5 * P, rnd(2), -dx * 5 * P, 0.3 * o.g.scale.y, gy);
			else if (c === o.bottom) fling(c, dx * 0.9 * P, 0.3, dz * 0.9 * P, dz * 2.5 * P, 0, -dx * 2.5 * P, 0.42 * o.g.scale.y, gy);
			else fling(c, dx * 3.5 * P + rnd(4), 2.5 + Math.random() * 3 * P, dz * 3.5 * P + rnd(4), rnd(16), rnd(16), rnd(16), 0.04, gy);
		});
		// and it crumbles: chunks of snow
		for (let i = 0; i < 10; i++) {
			const ch = new THREE.Mesh(smGeo.ball, smM.snow);
			const s = 0.05 + Math.random() * 0.09;
			ch.scale.setScalar(s);
			ch.position.set(o.g.position.x + rnd(0.5), gy + 0.3 + Math.random() * 1.0, o.g.position.z + rnd(0.5));
			root.add(ch);
			debris.push({ o: ch, v: new THREE.Vector3(dx * 2.5 * P + rnd(3), 1.5 + Math.random() * 3, dz * 2.5 * P + rnd(3)), w: new THREE.Vector3(), r: s, gy, t: 0, s0: ch.scale.clone() });
		}
		root.remove(o.g);
		puff(o.g.position.x, gy + 0.7, o.g.position.z, 34, 2.6);
		W.sfx("thunk", 0.55);
	}
	function updateDebris(dt) {
		for (let i = debris.length - 1; i >= 0; i--) {
			const d = debris[i], o = d.o;
			d.t += dt;
			d.v.y -= 9.8 * dt;
			o.position.addScaledVector(d.v, dt);
			o.rotation.x += d.w.x * dt; o.rotation.y += d.w.y * dt; o.rotation.z += d.w.z * dt;
			if (o.position.y - d.r < d.gy) {
				o.position.y = d.gy + d.r;
				if (d.v.y < 0) d.v.y *= -0.28;
				d.v.x *= 0.82; d.v.z *= 0.82; d.w.multiplyScalar(0.85);
				// round things roll
				if (d.r > 0.1) { d.w.x = d.v.z / d.r; d.w.z = -d.v.x / d.r; }
			}
			// settles, then melts away
			if (d.t > 1.8) { const k = Math.max(0.001, 1 - (d.t - 1.8) / 1.2); o.scale.copy(d.s0).multiplyScalar(k); }
			if (d.t > 3) { if (o.parent) o.parent.remove(o); debris.splice(i, 1); }
		}
	}

	// ------------------------------------------------------------------ building one
	let building = null;   // { id, at (next scoop), end, x, z } while you're building one
	function buildSnowman() {
		const me = W.me();
		if (building || me.sit || me.upper === "kart") return;
		const x = me.x + Math.sin(me.h) * 0.9, z = me.z + Math.cos(me.h) * 0.9;
		const id = Math.random().toString(36).slice(2, 10), now = performance.now();
		const list = snowmenList();
		list.push({ id, x: +x.toFixed(2), z: +z.toFixed(2), h: +(me.h + Math.PI).toFixed(2), by: myName(), c: SCARVES[Math.floor(Math.random() * SCARVES.length)], ts: Date.now() });
		while (list.length > MAX_SNOWMEN) list.shift();
		W.setShared("snowmen", list);
		building = { id, at: now, end: now + BUILD * 1000, x: me.x, z: me.z };
	}
	function tickBuilding() {
		const b = building, me = W.me(), now = performance.now();
		if (!b) return;
		if (now >= b.end || me.sit || me.upper === "kart" || Math.hypot(me.x - b.x, me.z - b.z) > 0.6) {
			const done = now >= b.end;
			building = null;
			if (done) { W.sfx("yes", 0.35); W.notice("You built a snowman! Stand next to it and press <b>R</b> to kick it over."); }
			return;
		}
		// scoop and pat, over and over, while it goes up
		if (now >= b.at) { W.doUpper("scoop", 1350); W.sendPose(true); b.at = now + 1400; }
	}
	function nearSnowman() {
		const me = W.me();
		let best = null, bd = 1.4;
		snowmenList().forEach(s => { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < bd && snowmen.has(s.id)) { bd = d; best = s; } });
		return best;
	}
	// a kick: face it, swing the foot, and at the moment it connects it flies to bits (for everyone)
	let kicking = null;   // { id, at, dir }
	function kickSnowman(s) {
		const me = W.me();
		if (kicking || me.sit || me.upper === "kart") return;
		const dir = Math.atan2(s.x - me.x, s.z - me.z);
		me.h = dir;
		W.doUpper("kick", 800);
		W.sendPose(true);
		kicking = { id: s.id, at: performance.now() + 340, dir };
	}
	function tickKick() {
		if (!kicking || performance.now() < kicking.at) return;
		const k = kicking;
		kicking = null;
		W.sfx("kick", 0.6);
		breakSnowman(k.id, k.dir, 1);
		W.send({ t: "wx", what: "kickman", id: k.id, dir: +k.dir.toFixed(3) });
		W.setShared("snowmen", snowmenList().filter(o => o.id !== k.id));
	}

	// ------------------------------------------------------------------ snowballs: scoop one up, throw it
	const BALLS = 24;
	const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 12, 8), smM.snow, BALLS);
	ballMesh.castShadow = false;
	ballMesh.frustumCulled = false;
	root.add(ballMesh);
	const balls = [];
	for (let i = 0; i < BALLS; i++) { balls.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), by: "", age: 0 }); ballMesh.setMatrixAt(i, _d.matrix); }
	let ballNext = 0, ballsLive = 0, myHits = 0;
	function spawnBall(x, y, z, vx, vy, vz, by) {
		const b = balls[ballNext]; ballNext = (ballNext + 1) % BALLS;
		b.on = true; b.p.set(x, y, z); b.v.set(vx, vy, vz); b.by = by; b.age = 0;
		ballsLive = BALLS;
	}
	// who's in the snow with you, and how fast they're going (for leading a throw)
	const track = new Map();   // id -> { up, since, x, z, vx, vz }   ("me" for you)
	const tracked = id => { let o = track.get(id); if (!o) { o = { up: null, since: 0, x: 0, z: 0, vx: 0, vz: 0, init: false }; track.set(id, o); } return o; };
	// a snowball in your hand while you pat it and wind up (shown on everyone, from their arm pose)
	const handGeo = new THREE.SphereGeometry(0.075, 12, 8);
	const inHand = new Map();   // avatar -> mesh
	function holdBall(av, on) {
		const m = inHand.get(av);
		if (on && !m) {
			const hand = av.arms && av.arms[1] && av.arms[1].hand;
			if (!hand) return;
			const b = new THREE.Mesh(handGeo, smM.snow);
			b.position.set(0, -0.08, 0.03);
			hand.add(b);
			inHand.set(av, b);
		} else if (!on && m) { if (m.parent) m.parent.remove(m); inHand.delete(av); }
	}
	// dug-up snow where someone scooped
	const DIGS = 10;
	const digM = new THREE.MeshStandardMaterial({ color: "#aebcd2", roughness: 0.9, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
	const digGeo = new THREE.CircleGeometry(0.22, 18).rotateX(-Math.PI / 2);
	const digs = [];
	for (let i = 0; i < DIGS; i++) { const m = new THREE.Mesh(digGeo, digM.clone()); m.visible = false; m.userData.t = 0; root.add(m); digs.push(m); }
	let digNext = 0;
	const _f = new THREE.Vector3();
	function dig(av) {
		const r = av.root, m = digs[digNext];
		digNext = (digNext + 1) % DIGS;
		_f.set(0, 0, 1).applyQuaternion(r.quaternion);
		m.position.set(r.position.x + _f.x * 0.38, r.position.y + 0.03, r.position.z + _f.z * 0.38);
		m.scale.set(1 + Math.random() * 0.4, 1, 0.8 + Math.random() * 0.3);
		m.rotation.y = Math.random() * 3;
		m.visible = true;
		m.userData.t = 8;
		puff(m.position.x, m.position.y + 0.05, m.position.z, 6, 0.9);
	}
	// watch everyone's arms: a scoop starting digs the snow, and a ball is in the hand from the pat to the release
	function watchHands(dt, nowS) {
		const me = W.me(), mine = tracked("me");
		const step = (o, av, up, outdoors) => {
			if (up !== o.up) { o.up = up; o.since = nowS; if (up === "scoop" && outdoors && cover > 0.3) dig(av); }
			const e = nowS - o.since;
			holdBall(av, cover > 0.3 && ((up === "scoop" && e > 0.65 && !buildingBy(av)) || (up === "throw" && e < 0.32)));
		};
		step(mine, W.myAvatar(), me.upper, !!W.outdoorAt(me.x, me.z));
		W.peers().forEach((p, id) => {
			if (!p.avatar) return;
			const o = tracked(id), q = p.avatar.root.position;
			if (!o.init) { o.init = true; o.x = q.x; o.z = q.z; }
			if (dt > 0) { o.vx += ((q.x - o.x) / dt - o.vx) * Math.min(1, dt * 4); o.vz += ((q.z - o.z) / dt - o.vz) * Math.min(1, dt * 4); }
			o.x = q.x; o.z = q.z;
			step(o, p.avatar, p.upper, !!W.outdoorAt(p.x, p.z));
		});
		for (const id of track.keys()) if (id !== "me" && !W.peers().has(id)) track.delete(id);
		inHand.forEach((m, av) => { if (av !== W.myAvatar() && ![...W.peers().values()].some(p => p.avatar === av)) holdBall(av, false); });
		for (let i = 0; i < DIGS; i++) { const m = digs[i]; if (!m.visible) continue; m.userData.t -= dt; m.material.opacity = Math.min(0.8, m.userData.t / 3) * Math.min(1, cover * 1.5); if (m.userData.t <= 0) m.visible = false; }
	}
	// (building a snowman is scooping too, but that snow goes on the snowman, not into a ball)
	const buildingBy = av => av === W.myAvatar() && !!building;

	// aim: the nearest other player out in the open within ~30 degrees of where you're looking, up to 25 m
	const _dir = new THREE.Vector3(), _hand = new THREE.Vector3(), _chest = new THREE.Vector3(), _aim = new THREE.Vector3();
	function findTarget() {
		camera.getWorldDirection(_dir);
		_dir.y = 0;
		if (_dir.lengthSq() < 1e-6) return null;
		_dir.normalize();
		const me = W.myAvatar().root.position;
		let best = null, bs = Infinity;
		W.peers().forEach((p, id) => {
			if (!p.avatar || p.sit || p.upper === "kart" || !W.outdoorAt(p.x, p.z)) return;
			const q = p.avatar.root.position, dx = q.x - me.x, dz = q.z - me.z, d = Math.hypot(dx, dz);
			if (d < 0.8 || d > 25 || Math.abs(q.y - me.y) > 6) return;
			const cos = (dx * _dir.x + dz * _dir.z) / d;
			if (cos < 0.866) return;
			const score = d * (2 - cos);
			if (score < bs) { bs = score; best = id; }
		});
		return best;
	}
	// the crosshair over whoever you'd hit
	const marker = (() => {
		const c = document.createElement("canvas");
		c.width = c.height = 64;
		const g = c.getContext("2d");
		g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 4;
		g.beginPath(); g.arc(32, 32, 20, 0, Math.PI * 2); g.stroke();
		g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 16); g.moveTo(32, 48); g.lineTo(32, 60); g.moveTo(4, 32); g.lineTo(16, 32); g.moveTo(48, 32); g.lineTo(60, 32); g.stroke();
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: "#bfe3ff", transparent: true, opacity: 0.85, depthTest: false, toneMapped: false }));
		s.scale.set(0.42, 0.42, 1);
		s.renderOrder = 9;
		s.visible = false;
		root.add(s);
		return s;
	})();
	let throwing = null;   // { stage: 0 scooping | 1 winding up, at }
	function startThrow() {
		const me = W.me();
		if (throwing || building || me.sit || me.upper === "kart") return;
		throwing = { stage: 0, at: performance.now() };
		W.doUpper("scoop", 1350);
		W.sendPose(true);
	}
	function tickThrow() {
		const t = throwing, me = W.me(), now = performance.now();
		if (!t) return;
		if (me.sit || me.upper === "kart" || me.carriedBy) { throwing = null; return; }
		if (t.stage === 0 && now - t.at >= 1350) {
			// turn to whoever you're aiming at (or the way you're looking) and wind up
			const tid = findTarget(), p = tid && W.peers().get(tid);
			if (p) { const q = p.avatar.root.position, r = W.myAvatar().root.position; me.h = Math.atan2(q.x - r.x, q.z - r.z); }
			else { camera.getWorldDirection(_dir); me.h = Math.atan2(_dir.x, _dir.z); }
			W.doUpper("throw", 650);
			W.sendPose(true);
			t.stage = 1; t.at = now;
		} else if (t.stage === 1 && now - t.at >= 320) {
			throwing = null;
			release();
		}
	}
	function release() {
		const av = W.myAvatar();
		const hand = av.arms && av.arms[1] && av.arms[1].hand;
		if (hand) { hand.updateMatrixWorld(true); hand.localToWorld(_hand.set(0, -0.08, 0.03)); }
		else { _hand.copy(av.root.position); _hand.y += 1.6; }
		let vx, vy, vz;
		const tid = findTarget(), p = tid && W.peers().get(tid);
		if (p) {
			// a ballistic throw that lands on their chest, leading them a little if they're running
			const o = tracked(tid), q = p.avatar.root.position;
			let T = Math.max(0.3, Math.hypot(q.x - _hand.x, q.z - _hand.z) / 14);
			_aim.set(q.x + o.vx * T, q.y + 1.15, q.z + o.vz * T);
			T = Math.max(0.3, Math.hypot(_aim.x - _hand.x, _aim.z - _hand.z) / 14);
			vx = (_aim.x - _hand.x) / T; vz = (_aim.z - _hand.z) / T; vy = (_aim.y - _hand.y) / T + 0.5 * 9.8 * T;
		} else {
			camera.getWorldDirection(_dir);
			const up = Math.max(-0.2, Math.min(0.7, _dir.y));
			_dir.y = 0;
			if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, -1);
			_dir.normalize();
			vx = _dir.x * 13; vy = 3.6 + up * 7; vz = _dir.z * 13;
		}
		holdBall(av, false);
		spawnBall(_hand.x, _hand.y, _hand.z, vx, vy, vz, W.MY_ID);
		W.send({ t: "wx", what: "ball", x: +_hand.x.toFixed(2), y: +_hand.y.toFixed(2), z: +_hand.z.toFixed(2), vx: +vx.toFixed(2), vy: +vy.toFixed(2), vz: +vz.toFixed(2), by: W.MY_ID });
		W.sfx("whoosh", 0.3);
	}
	let splatEl = null, splatT = 0;
	function splat() {
		if (typeof document === "undefined" || !document.body) return;
		if (!splatEl) {
			splatEl = document.createElement("div");
			splatEl.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;transition:opacity .6s ease-out;" +
				"background:radial-gradient(circle at 38% 42%,rgba(255,255,255,.95) 0 9%,rgba(255,255,255,.6) 13%,transparent 22%)," +
				"radial-gradient(circle at 55% 52%,rgba(255,255,255,.9) 0 6%,transparent 12%),radial-gradient(circle at 30% 60%,rgba(255,255,255,.85) 0 4%,transparent 8%)," +
				"radial-gradient(circle at 47% 33%,rgba(240,246,255,.9) 0 3%,transparent 7%)";
			document.body.appendChild(splatEl);
		}
		splatEl.style.transition = "none";
		splatEl.style.opacity = "1";
		splatT = 1.0;
	}
	function nameOf(id) { const p = W.peers().get(id); return p && p.look ? p.look.name : "Someone"; }
	// a burst of snow on someone's body (whoever it hit; once, even if two things say so)
	const burstAt = new Map();   // id -> time of the last burst on them
	function burstOn(id, root3) {
		const now = performance.now();
		if (now - (burstAt.get(id) || 0) < 600) return;
		burstAt.set(id, now);
		puff(root3.position.x, root3.position.y + 1.2, root3.position.z, 18, 1.8);
	}
	function updateBalls(dt) {
		if (!ballsLive) return;
		let any = 0;
		const me = W.me(), my = W.myAvatar().root;
		_chest.copy(my.position); _chest.y += 1.15;
		for (let i = 0; i < BALLS; i++) {
			const b = balls[i];
			if (!b.on) continue;
			b.age += dt;
			b.v.y -= 9.8 * dt;
			b.p.addScaledVector(b.v, dt);
			let done = b.age > 4;
			// hit me? (only I decide that)
			if (!done && b.by !== W.MY_ID && b.p.distanceToSquared(_chest) < 0.3) {
				done = true;
				splat();
				burstOn("me", my);
				W.sfx("splat", 0.6);
				if (!me.sit && me.upper !== "kart") { W.doUpper("laugh", 1200); W.sendPose(true); }
				W.notice(`<b>${W.esc(nameOf(b.by))}</b> got you with a snowball!`);
				W.send({ t: "wx", what: "hit", by: b.by, v: W.MY_ID });
			}
			// hit someone else: it bursts on them (whether it counts is theirs to say)
			if (!done) W.peers().forEach((p, id) => {
				if (done || id === b.by || !p.avatar) return;
				const q = p.avatar.root.position;
				const dx = b.p.x - q.x, dy = b.p.y - q.y - 1.15, dz = b.p.z - q.z;
				if (dx * dx + dy * dy + dz * dz < 0.3) { done = true; burstOn(id, p.avatar.root); W.sfx("splat", 0.35); }
			});
			// a snowman: knock its hat off, or dent it
			if (!done) snowmen.forEach(o => {
				if (done) return;
				const q = o.g.position, dx = b.p.x - q.x, dz = b.p.z - q.z, y = b.p.y - q.y;
				if (dx * dx + dz * dz > 0.25 || y < 0 || y > 1.85 * o.g.scale.y) return;
				done = true;
				if (y > 1.28 && o.done && !o.hatOff) {
					o.hatOff = true;
					fling(o.hat, b.v.x * 0.35, 2.4, b.v.z * 0.35, (Math.random() - 0.5) * 10, 3, (Math.random() - 0.5) * 10, 0.05, q.y);
					W.sfx("pop", 0.4);
				} else { o.wob = 1; W.sfx("thunk", 0.3); }
			});
			if (!done && b.p.y < W.floorAt(b.p.x, b.p.z) + 0.05) done = true;
			if (done) { b.on = false; puff(b.p.x, b.p.y, b.p.z, 10, 1.4); _d.position.set(0, -999, 0); _d.scale.set(0, 0, 0); }
			else { _d.position.copy(b.p); _d.scale.set(1, 1, 1); any++; }
			_d.rotation.set(0, 0, 0); _d.updateMatrix();
			ballMesh.setMatrixAt(i, _d.matrix);
		}
		ballMesh.instanceMatrix.needsUpdate = true;
		if (!any) ballsLive = 0;
	}
	// can you throw one right now?
	function canThrow() {
		const me = W.me();
		return cover >= 0.3 && !me.sit && me.anim === "idle" && !me.carriedBy && !me.carrying && me.upper !== "kart" && !!W.outdoorAt(me.x, me.z);
	}

	// ------------------------------------------------------------------ the panel
	let panelOpen = false;
	function panelHTML() {
		const w = weather();
		const cards = KIND_LIST.map(k => {
			const K = KINDS[k], on = k === w.kind;
			return `<button class="hs-card wx-card" data-w="${k}" style="${on ? "border-color:#ffd166;box-shadow:inset 0 0 0 1px rgba(255,209,102,.45);" : ""}"><div class="ic" style="font-size:30px;line-height:1">${K.icon}</div><b>${K.name}${on ? " ✓" : ""}</b><span>${K.desc}</span></button>`;
		}).join("");
		const who = w.by && w.kind !== "clear" ? `${KINDS[w.kind].name} - set by <b>${W.esc(w.by)}</b>` : `${KINDS[w.kind].name}${w.by ? ` - set by <b>${W.esc(w.by)}</b>` : ""}`;
		const tips = w.kind === "snow" ? "In the snow: <b>Q</b> builds a snowman, <b>G</b> throws a snowball, <b>R</b> knocks a snowman over." : "The weather is the same for everyone, everywhere outdoors.";
		return `<div class="hs-grid">${cards}</div><p class="muted" style="margin:12px 0 0">${who}. ${tips}</p>`;
	}
	function openPanel() {
		const body = W.openModal("weather", "Weather & Seasons", panelHTML(), 560, () => { panelOpen = false; });
		panelOpen = true;
		wirePanel(body);
	}
	function wirePanel(body) {
		if (!body || !body.querySelectorAll) return;
		body.querySelectorAll("[data-w]").forEach(b => { b.onclick = () => { setWeather(b.dataset.w); renderPanel(); }; });
	}
	function renderPanel() {
		if (!panelOpen || W.modalKind() !== "weather") { panelOpen = false; return; }
		const body = typeof document !== "undefined" && document.getElementById ? document.getElementById("mbody") : null;
		if (!body) return;
		body.innerHTML = panelHTML();
		wirePanel(body);
	}

	// ------------------------------------------------------------------ lights: multiply whatever the house last set
	const lit = { hb: null, hs: null, mb: null, ms: null, sb: new THREE.Color(1, 1, 1), ss: new THREE.Color(-1, -1, -1) };
	function applyLights(gloom, flash, tint) {
		const h = W.hemi, m = W.moon, sky = W.room && W.room.sky;
		if (h) {
			if (lit.hs === null || Math.abs(h.intensity - lit.hs) > 1e-6) lit.hb = h.intensity;
			h.intensity = lit.hb * gloom + flash * 2.2;
			lit.hs = h.intensity;
		}
		if (m) {
			if (lit.ms === null || Math.abs(m.intensity - lit.ms) > 1e-6) lit.mb = m.intensity;
			m.intensity = lit.mb * Math.min(1, gloom) + (lit.mb > 0 ? flash * 3 : 0);
			lit.ms = m.intensity;
		}
		if (sky && sky.material && sky.material.color) {
			const c = sky.material.color;
			if (Math.abs(c.r - lit.ss.r) > 1e-4 || Math.abs(c.g - lit.ss.g) > 1e-4 || Math.abs(c.b - lit.ss.b) > 1e-4) lit.sb.copy(c);
			c.setRGB(lit.sb.r * tint[0] + flash * 1.6, lit.sb.g * tint[1] + flash * 1.6, lit.sb.b * tint[2] + flash * 1.8);
			lit.ss.copy(c);
		}
	}

	// ------------------------------------------------------------------ every frame
	const lv = { rain: 0, snow: 0, petal: 0, leaf: 0, storm: 0, gloom: 1 };
	const tint = [1, 1, 1], wind = [0, 0];
	let wet = 0, cover = 0, slowT = 1, rainSfxT = 0, lastNow = Date.now(), lastKind = null;
	// joining while it's been raining (or snowing) a while: the ground is already wet (or white)
	{
		const w = weather(), age = (Date.now() - w.at) / 1000;
		if ((w.kind === "rain" || w.kind === "storm") && age > 20) wet = 1;
		if (w.kind === "snow" && age > 30) cover = 1;
		const L = LOOK[w.kind];
		for (const k of ["rain", "snow", "petal", "leaf", "storm", "gloom"]) lv[k] = L[k];
		tint[0] = L.sky[0]; tint[1] = L.sky[1]; tint[2] = L.sky[2]; wind[0] = L.wind[0]; wind[1] = L.wind[1];
	}
	loadRects();
	buildGround();
	syncSnowmen(null);

	function update(dt, t) {
		dt = Math.min(0.1, Math.max(0, dt));
		const w = weather(), L = LOOK[w.kind], now = Date.now(), me = W.me();
		const outdoors = !!W.outdoorAt(me.x, me.z);
		// fade toward the current kind (~4 s)
		const f = Math.min(1, dt / 1.3);
		lv.rain += (L.rain - lv.rain) * f; lv.snow += (L.snow - lv.snow) * f; lv.petal += (L.petal - lv.petal) * f;
		lv.leaf += (L.leaf - lv.leaf) * f; lv.storm += (L.storm - lv.storm) * f; lv.gloom += (L.gloom - lv.gloom) * f;
		for (let i = 0; i < 3; i++) tint[i] += (L.sky[i] - tint[i]) * f;
		wind[0] += (L.wind[0] - wind[0]) * f; wind[1] += (L.wind[1] - wind[1]) * f;
		wet = clamp01(wet + (L.rain > 0 ? dt / 20 : -dt / 45));
		cover = clamp01(cover + (w.kind === "snow" ? dt / 30 : -dt / 25));

		// the slow things, once a second: rooms that have been built since, the canvas size
		slowT += dt;
		if (slowT > 1) {
			slowT = 0;
			loadRects();
			buildGround();
			const el = W.renderer && W.renderer.domElement, hpx = el && el.height ? el.height : 900;
			pix.value = hpx * 0.5 / Math.tan((camera.fov || 55) * Math.PI / 360);
			// the snow's long gone: tidy the snowmen away (anyone can; it's the same either way)
			if (w.kind !== "snow" && now - w.at > 40000 && snowmenList().length) W.setShared("snowmen", []);
		}

		// falling things
		camU.value.copy(camera.position);
		timeU.value = t % 600;
		windU.value.set(wind[0], wind[1]);
		const show = (pts, level, extra) => {
			const u = pts.material.uniforms;
			pts.visible = level > 0.01;
			u.uDensity.value = level;
			if (extra !== undefined) u.uTilt.value = extra;
		};
		show(rain, lv.rain, -0.08 - lv.storm * 0.22);
		show(snow, lv.snow);
		show(petals, lv.petal);
		show(leaves, lv.leaf);
		rain.material.uniforms.uFall.value = 15 + lv.storm * 5;

		// lightning
		let flash = 0;
		if (lv.storm > 0.05) {
			const slot = Math.floor(now / SLOT);
			if (slot !== flashSlot) planFlashes(slot);
			let bi = -1, ba = 0, bs = 0;
			for (let i = 0; i < 6; i++) {
				const F = flashes[i], e = (now - F.t) / 1000;
				if (e >= 0 && e < 1.2) {
					const v = F.s * (Math.exp(-e * 9) + (e > 0.12 ? 0.6 * Math.exp(-(e - 0.12) * 10) : 0));
					if (v > flash) flash = v;
					if (F.bolt >= 0 && e < 0.35) { bi = F.bolt; ba = F.ang; bs = v; }
				}
				if (F.thunder > lastNow && F.thunder <= now && now - F.thunder < 1500) W.sfx("thunder", (0.35 + 0.45 * F.s) * (outdoors ? 1 : 0.5) * lv.storm);
			}
			flash *= lv.storm;
			bolts.forEach((b, i) => {
				b.visible = i === bi;
				if (i === bi) { b.position.set(camera.position.x + Math.sin(ba) * 38, W.floorAt(camera.position.x, camera.position.z) - 2, camera.position.z + Math.cos(ba) * 38); b.rotation.y = ba; }
			});
			boltM.opacity = Math.min(1, bs * 1.4 * lv.storm);
		} else if (bolts[0].visible || bolts[1].visible || bolts[2].visible) bolts.forEach(b => { b.visible = false; });
		lastNow = now;
		applyLights(lv.gloom, flash * (outdoors ? 1 : 0.4), tint);

		// rain sound, while it's raining (quieter from inside)
		rainSfxT -= dt;
		if (lv.rain > 0.05 && rainSfxT <= 0) { W.sfx("rain", lv.rain * (0.35 + lv.storm * 0.25) * (outdoors ? 1 : 0.35)); rainSfxT = 1.8; }

		// the ground
		puddles.visible = ripples.visible = wet > 0.01 && pud.n > 0;
		if (puddles.visible) {
			puddleM.opacity = wet * 0.82;
			if (lv.rain > 0.05) {
				for (let i = 0; i < pud.n * 2; i++) {
					const j = i >> 1, u = (t * (0.7 + pud.ph[i] * 0.5) + pud.ph[i]) % 1, s = pud.r[j] * (0.15 + u * 0.75);
					_d.position.set(pud.x[j] + (pud.ph[i] - 0.5) * pud.r[j] * 0.8, pud.y[j] + 0.003, pud.z[j] + (pud.ph[(i + 1) % (pud.n * 2)] - 0.5) * pud.r[j] * 0.6);
					_d.rotation.set(0, 0, 0); _d.scale.set(s, 1, s); _d.updateMatrix();
					ripples.setMatrixAt(i, _d.matrix);
					const a = (1 - u) * wet * lv.rain;
					ripples.setColorAt(i, _c.setRGB(a, a, a));
				}
				ripples.instanceMatrix.needsUpdate = true;
				ripples.instanceColor.needsUpdate = true;
			} else ripples.visible = false;
		}
		if (snowCover) { snowCover.visible = cover > 0.01; snowM.opacity = Math.min(0.95, cover * 1.05); }

		// snowmen: going up (by age, the same for everyone), wobbling where a snowball hit, melting when the snow goes
		const melt = clamp01(cover * 1.6);
		snowmen.forEach(o => {
			poseSnowman(o, (now - num(o.s.ts, 0)) / 1000);
			const m = 0.6 + 0.4 * melt;
			o.g.scale.set(Math.max(0.001, m), Math.max(0.001, 0.25 + 0.75 * melt), Math.max(0.001, m));
			o.g.visible = melt > 0.03;
			if (o.wob > 0) { o.wob = Math.max(0, o.wob - dt * 1.5); o.g.rotation.z = Math.sin(t * 22) * 0.07 * o.wob; }
		});
		tickBuilding();
		tickKick();
		tickThrow();
		watchHands(dt, performance.now() / 1000);
		// the crosshair over whoever a snowball would go to
		const tid = canThrow() && !building ? findTarget() : null, tp = tid && W.peers().get(tid);
		marker.visible = !!tp;
		if (tp) { const q = tp.avatar.root.position; marker.position.set(q.x, q.y + 2.25 + Math.sin(t * 4) * 0.04, q.z); marker.material.rotation = t * 0.8; }
		updateDebris(dt);

		updateBalls(dt);
		updatePuffs(dt);
		if (splatT > 0) {
			splatT -= dt;
			if (splatEl && splatT < 0.7 && splatEl.style.opacity === "1") { splatEl.style.transition = "opacity .7s ease-out"; splatEl.style.opacity = "0"; }
		}
		if (lastKind !== w.kind) { lastKind = w.kind; renderPanel(); }
	}

	return {
		update,
		openPanel,
		// a shared key changed (remote: true from someone else, false: you, null: loaded at the start)
		applyKey(k, remote) {
			if (k === "snowmen") syncSnowmen();
			else if (k === "weather") {
				const w = weather();
				if (remote === true && w.by && w.by !== myName()) W.notice(`<b>${W.esc(w.by)}</b> ${KINDS[w.kind].verb}.`);
				renderPanel();
			}
		},
		onFx(d) {
			if (!d || typeof d !== "object") return;
			if (d.what === "ball") {
				const v = [d.x, d.y, d.z, d.vx, d.vy, d.vz].map(Number);
				if (v.some(n => !isFinite(n)) || Math.abs(v[3]) > 40 || Math.abs(v[4]) > 40 || Math.abs(v[5]) > 40) return;
				spawnBall(v[0], v[1], v[2], v[3], v[4], v[5], String(d.id || d.by || ""));
			} else if (d.what === "hit") {
				// someone got hit (they say so themselves): a burst on them for everyone, a point for the thrower
				const vid = String(d.v || d.id || ""), p = W.peers().get(vid);
				if (p && p.avatar) burstOn(vid, p.avatar.root);
				if (d.by === W.MY_ID) {
					myHits++;
					W.sfx("pop", 0.5);
					W.notice(`You hit <b>${W.esc(nameOf(vid))}</b>! (${myHits})`);
				}
			} else if (d.what === "kickman" && typeof d.id === "string") {
				const dir = Number(d.dir);
				W.sfx("kick", 0.5);
				breakSnowman(d.id, isFinite(dir) ? dir : 0, 1);
			}
		},
		// in the snow: build a snowman (Q), throw a snowball (G), knock a snowman over (R)
		promptOpts(opts) {
			if (!canThrow()) return;
			const free = key => !opts.some(o => o.k === key);
			if (building) return;
			if (free("G") && !throwing) opts.push({ k: "G", label: marker.visible ? "Throw a snowball at them!" : "Throw a snowball", fn: startThrow });
			if (weather().kind === "snow" && cover > 0.5 && free("Q")) opts.push({ k: "Q", label: "Build a snowman", fn: buildSnowman });
			const s = nearSnowman();
			if (s && free("R") && !kicking) opts.push({ k: "R", label: "Kick the snowman over", fn: () => kickSnowman(s) });
		}
	};
}
