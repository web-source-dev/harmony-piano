/**
 * Harmony World — the Escape House: one mission through six linked escape rooms, on the west avenue between the
 * Haunted Mansion and the Bumper Karts. Indoors.
 *
 * Local coordinates (origin at world -43, -70): x -17..17, z -11..11. The front door is in the east wall (x 17) at
 * z -0.9..0.9, at the end of the path from the west avenue. From the grounds you see a brick block with a neon sign
 * on its roof, a canopy over the door and a velvet rope.
 *
 * Inside: the lobby (x 9..17: the reception desk and its bell, the mission board, a sofa) and a corridor running west
 * from it (z -1.8..1.8, x -8.33..9). The rooms are linked one into the next:
 *   corridor -> 1 Detective's Study -> 2 Pirate's Cabin -> 3 Mad Scientist's Lab (north side, east to west)
 *   -> a passage (the corridor's sealed-off west end) -> 4 Bank Vault -> 5 Space Station Omega -> 6 Wizard's Tower
 *   (south side, west to east) -> back out into the corridor.
 * Go into room 1 and press Start: the door locks behind you and the clock starts. Every room's last lock opens the
 * door into the next room; the Wizard's Tower's opens the way out. Puzzle progress is shared by everyone playing
 * (a "z:esc:<room>:<thing>" key per thing, tagged with the run, so a new run starts clean), and so is the best time.
 * The codes change every run (worked out from the run's id). Stuck? Hints (G), a step at a time.
 * Everything the rooms say is in English or Turkish (the TR / EN button on the panel; each viewer picks their own).
 *
 * Lights: seven (one per room, one in the lobby); the corridor has the key light and the fill.
 */
import { getLang, setLang, L, TX, langBtns } from "./worldLang.js";

const OX = -43.0, OZ = -70.0;                       // = ZONES.escape ox / oz
const X0 = -17, X1 = 17, Z0 = -11, Z1 = 11, H = 3.6, T = 0.2;
const LX = 9;                                       // the lobby's west wall (the lobby: x 9..17)
const CZ = 1.8;                                     // the corridor's walls (z -1.8 / 1.8)
const SEAL = -8.33;                                 // the wall between the corridor and the passage
const DOOR = { z0: -0.9, z1: 0.9, h: 2.6 };         // the front door, in the east wall
const DOOR_H = 2.4, DW = 0.65;                      // the rooms' doors: height, half width
const SIDE_Z = 3.25;                                // a door in a room's side wall: how far toward the front (room frame)
// the three columns of rooms: their middles and half-widths (inside their walls)
const COLS = [{ cx: 4.665, hw: 4.235 }, { cx: -4.0, hw: 4.23 }, { cx: -12.715, hw: 4.285 }];
const RZ = 6.45, RD = 4.55;                         // a room's middle (|z|) and half its depth
// the rooms, in the order you play them; doors: which walls (room frame) have a door: front, left (-x), right (+x)
const ROOMS = [
	{ id: "study", col: 0, north: true, doors: ["front", "right"] },
	{ id: "pirate", col: 1, north: true, doors: ["left", "right"] },
	{ id: "lab", col: 2, north: true, doors: ["left", "front"] },
	{ id: "vault", col: 2, north: false, doors: ["front", "right"] },
	{ id: "space", col: 1, north: false, doors: ["left", "right"] },
	{ id: "wizard", col: 0, north: false, doors: ["left", "front"] }
];
// the doors (zone coordinates): w "x" = in a wall along x at z = p (c: its x), "z" = in a wall along z at x = p (c: its
// z); f: the side (sign along the wall's normal) you come from; after: the room you must solve first (-1: the entrance)
const DOORS = [
	{ w: "x", c: 4.665, p: CZ, f: -1, after: -1 },
	{ w: "z", c: 3.2, p: 0.33, f: 1, after: 0 },
	{ w: "z", c: 3.2, p: SEAL, f: 1, after: 1 },
	{ w: "x", c: -12.715, p: CZ, f: 1, after: 2 },
	{ w: "x", c: -12.715, p: -CZ, f: 1, after: 2 },
	{ w: "z", c: -3.2, p: SEAL, f: -1, after: 3 },
	{ w: "z", c: -3.2, p: 0.33, f: -1, after: 4 },
	{ w: "x", c: 4.665, p: -CZ, f: -1, after: 5 }
];
const KEY = "z:esc:";
const TAU = Math.PI * 2;
const LASERS = 5;                                   // the vault's laser beams (the cipher's shift: count them!)
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const lcg = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const shuffle = (a, R) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const pad2 = n => String(n).padStart(2, "0");
const stars = n => "★".repeat(n) + "☆".repeat(3 - n);
const range = n => Array.from({ length: n }, (_, i) => i);
// answers: upper case, Turkish letters folded to plain ones, single spaces
const norm = s => String(s).toUpperCase().replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C").replace(/Â/g, "A").replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

// ================================================================ what the puzzles are made of
const SHAPES = [["triangle", "üçgen"], ["circle", "daire"], ["square", "kare"], ["star", "yıldız"], ["diamond", "baklava"], ["cross", "artı"]];
const FUSES = [["Red", "Kırmızı", "#ff4a4a"], ["Blue", "Mavi", "#4a8aff"], ["Yellow", "Sarı", "#ffd23a"]];
// passwords spelled with element symbols, and the atomic numbers that spell them (English / Turkish, same index)
const WORDS = [["GENIUS", [32, 7, 53, 92, 16]], ["BRAIN", [5, 88, 53, 7]], ["BACON", [56, 27, 7]], ["SNACK", [16, 7, 89, 19]], ["BONES", [5, 8, 10, 16]], ["SPOON", [16, 15, 8, 8, 7]]];
const WORDS_TR = [["SINIF", [14, 7, 53, 9]], ["SOBA", [16, 8, 56]], ["KOCA", [19, 8, 20]], ["SICAK", [14, 6, 89, 19]], ["KONU", [19, 8, 7, 92]], ["PIKNIK", [15, 53, 19, 7, 53, 19]]];
const ELEMS = [[1, "H"], [2, "He"], [3, "Li"], [4, "Be"], [5, "B"], [6, "C"], [7, "N"], [8, "O"], [9, "F"], [10, "Ne"], [11, "Na"], [12, "Mg"], [13, "Al"], [14, "Si"], [15, "P"], [16, "S"], [17, "Cl"], [18, "Ar"], [19, "K"], [20, "Ca"],
	[26, "Fe"], [27, "Co"], [28, "Ni"], [29, "Cu"], [30, "Zn"], [32, "Ge"], [35, "Br"], [36, "Kr"], [47, "Ag"], [50, "Sn"], [53, "I"], [54, "Xe"], [56, "Ba"], [79, "Au"], [80, "Hg"], [82, "Pb"], [88, "Ra"], [89, "Ac"], [92, "U"], [94, "Pu"]];
const SEARCH = [
	[["Search the lab coat", "Laboratuvar önlüğünü ara"], ["Just a half-eaten sandwich in the pocket. Gross.", "Cepte sadece yarım yenmiş bir sandviç. İğrenç."]],
	[["Search the fridge", "Buzdolabını ara"], ["Mysterious green yoghurt, labelled DO NOT EAT.", "Gizemli yeşil bir yoğurt, üstünde YEMEYİN yazıyor."]],
	[["Search the toolbox", "Alet kutusunu ara"], ["Spanners, a rubber duck and some glitter.", "İngiliz anahtarları, lastik bir ördek ve biraz sim."]],
	[["Look under the microscope", "Mikroskobun altına bak"], ["A slide labelled 'DO NOT LICK'.", "Üstünde 'YALAMAYIN' yazan bir lam."]],
	[["Search the bin", "Çöp kutusunu ara"], ["Crumpled-up formulas, all crossed out.", "Buruşturulmuş formüller, hepsinin üstü çizilmiş."]],
	[["Search the filing cabinet", "Dosya dolabını ara"], ["TOP SECRET folders. They're all cookie recipes.", "ÇOK GİZLİ dosyalar. Hepsi kurabiye tarifi."]]
];
// pirate: what the logbook asks you to count (portholes 3, anchors 2, lanterns 2: all built in the room)
const FORMULAS = [
	[["the number of portholes in my cabin times the anchors on my walls", "kamaramdaki lomboz sayısı ile duvarlarımdaki çapa sayısının çarpımı"], 6],
	[["the portholes, the anchors and the lanterns in my cabin, all added together", "kamaramdaki lombozların, çapaların ve fenerlerin toplamı"], 7],
	[["the portholes plus the lanterns, then times the anchors", "lombozlar ile fenerlerin toplamının çapa sayısıyla çarpımı"], 10],
	[["the portholes times the lanterns, plus the anchors", "lomboz sayısı ile fener sayısının çarpımına çapa sayısının eklenmesi"], 8]
];
const DIRS = ["N", "E", "S", "W"];
const DIR_NAME = { N: ["North", "Kuzey"], E: ["East", "Doğu"], S: ["South", "Güney"], W: ["West", "Batı"] };
const DIR_KEY = { N: ["N", "K"], E: ["E", "D"], S: ["S", "G"], W: ["W", "B"] };
const DIR_START = { N: ["the Pole Star", "Kutup Yıldızı'na"], E: ["the rising sun", "doğan güneşe"], S: ["the warm southern seas", "sıcak güney denizlerine"], W: ["the setting sun", "batan güneşe"] };
const TURN = { R: ["turn right", "sağa dön"], L: ["turn left", "sola dön"], U: ["turn right round", "tam geri dön"] };
const ARROW = { N: "↑", E: "→", S: "↓", W: "←" };
// vault: the bank's clients, the visiting times, the digits as words (for the cipher)
const CLIENTS = ["Victor Crane", "Mila Rossi", "Omar Haddad", "Lena Berg", "Jonas Park", "Elif Kaya"];
const TIMES = ["09:15", "10:40", "11:05", "12:30", "13:50", "14:30", "15:10", "16:45"];
const NUMW = [["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"], ["SIFIR", "BIR", "IKI", "UC", "DORT", "BES", "ALTI", "YEDI", "SEKIZ", "DOKUZ"]];
const caesar = (s, n) => s.replace(/[A-Z]/g, ch => String.fromCharCode(65 + (ch.charCodeAt(0) - 65 + n + 26) % 26));
// space: [name EN, name TR, rings, moons, colour, size]
const PLANETS = [["Mercury", "Merkür", 0, 0, "#b5a99a", 0.5], ["Venus", "Venüs", 0, 0, "#e8c88a", 0.8], ["Earth", "Dünya", 0, 1, "#4a8ad8", 0.85], ["Mars", "Mars", 0, 2, "#d0603a", 0.62],
	["Jupiter", "Jüpiter", 1, 95, "#d8b08a", 1.6], ["Saturn", "Satürn", 1, 146, "#e8d49a", 1.4], ["Uranus", "Uranüs", 1, 28, "#9fe0e8", 1.1], ["Neptune", "Neptün", 1, 16, "#4a6ae8", 1.05]];
const PRULES = [
	[["have rings", "halkası olan"], p => !!p[2]],
	[["have rings AND more than 20 moons", "halkası olan VE 20'den fazla uydusu olan"], p => !!p[2] && p[3] > 20],
	[["have NO rings but at least one moon", "halkası OLMAYAN ama en az bir uydusu olan"], p => !p[2] && p[3] >= 1]
];
// [name EN, name TR, the bright stars (0..1 in their box), the lines between them (default: one to the next)]
const CONSTS = [
	["Orion's Belt", "Orion'un Kemeri", [[0.2, 0.64], [0.5, 0.5], [0.8, 0.36]]],
	["the Big Dipper", "Büyük Kepçe", [[0.08, 0.3], [0.27, 0.36], [0.43, 0.46], [0.58, 0.52], [0.62, 0.78], [0.9, 0.8], [0.88, 0.52]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
	["Cassiopeia", "Kraliçe (Cassiopeia)", [[0.1, 0.35], [0.3, 0.72], [0.5, 0.45], [0.7, 0.76], [0.9, 0.34]]],
	["the Southern Cross", "Güney Haçı", [[0.5, 0.14], [0.52, 0.86], [0.24, 0.48], [0.78, 0.44]], [[0, 1], [2, 3]]],
	["the Summer Triangle", "Yaz Üçgeni", [[0.18, 0.26], [0.82, 0.3], [0.55, 0.84]], [[0, 1], [1, 2], [2, 0]]],
	["Leo's Sickle", "Aslan'ın Orağı", [[0.72, 0.86], [0.66, 0.62], [0.5, 0.47], [0.45, 0.27], [0.6, 0.13], [0.82, 0.2]]]
];
// the station's four oxygen tanks (the airlock code: their numbers, fullest first)
const TANKS = [["Red", "Kırmızı", "#e8503e"], ["Blue", "Mavi", "#3e7ee8"], ["Green", "Yeşil", "#3ec86a"], ["Yellow", "Sarı", "#e8c23e"]];
const TANK_LV = [14, 31, 47, 62, 78, 93];
// wizard
const RIDDLES = [
	[["I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?", "Ağzım yok ama konuşurum, kulağım yok ama duyarım. Bedenim yok, rüzgârla canlanırım. Ben neyim?"], ["ECHO", "AN ECHO", "YANKI"]],
	[["The more of me you take, the more you leave behind. What am I?", "Benden ne kadar çok alırsan, arkanda o kadar çok bırakırsın. Ben neyim?"], ["FOOTSTEPS", "STEPS", "FOOTPRINTS", "AYAK IZI", "AYAK IZLERI", "ADIM", "ADIMLAR", "IZ"]],
	[["What has to be broken before you can use it?", "Kullanılmadan önce kırılması gereken şey nedir?"], ["EGG", "AN EGG", "YUMURTA"]],
	[["I'm tall when I'm young and short when I'm old. What am I?", "Gençken uzunum, yaşlanınca kısalırım. Ben neyim?"], ["CANDLE", "A CANDLE", "MUM"]],
	[["I have a face but no eyes, and hands but no fingers. I never stop moving, yet I never leave my place. What am I?", "Yüzüm var ama gözüm yok, kollarım var ama parmağım yok. Hiç durmadan yürürüm ama yerimden kımıldamam. Ben neyim?"], ["CLOCK", "A CLOCK", "WATCH", "SAAT"]],
	[["The more of me there is, the less you see. What am I?", "Ben çoğaldıkça sen daha az görürsün. Ben neyim?"], ["DARKNESS", "DARK", "THE DARK", "KARANLIK"]],
	[["What gets wetter the more it dries?", "Kuruladıkça kendisi ıslanan şey nedir?"], ["TOWEL", "A TOWEL", "HAVLU"]],
	[["I have cities but no houses, forests but no trees, and seas but no fish. What am I?", "Şehirlerim var ama evlerim yok, ormanlarım var ama ağaçlarım yok, denizlerim var ama balıklarım yok. Ben neyim?"], ["MAP", "A MAP", "HARITA"]]
];
const POTIONS = [["Red", "Kırmızı", "#ff4a5a"], ["Blue", "Mavi", "#4a8aff"], ["Green", "Yeşil", "#4aff8a"], ["Gold", "Altın", "#ffd24a"], ["Violet", "Mor", "#c06aff"]];
const ELEMENTS = [["Fire", "Ateş"], ["Water", "Su"], ["Air", "Hava"], ["Earth", "Toprak"], ["Spirit", "Ruh"]];
// the alchemists' symbols, as strokes in a box -0.5..0.5 (y down); ["o", x, y, r] is a circle
const ALCH = [
	[[[0, -0.42], [0.42, 0.34]], [[0.42, 0.34], [-0.42, 0.34]], [[-0.42, 0.34], [0, -0.42]]],
	[[[0, 0.42], [0.42, -0.34]], [[0.42, -0.34], [-0.42, -0.34]], [[-0.42, -0.34], [0, 0.42]]],
	[[[0, -0.42], [0.42, 0.34]], [[0.42, 0.34], [-0.42, 0.34]], [[-0.42, 0.34], [0, -0.42]], [[-0.36, 0.05], [0.36, 0.05]]],
	[[[0, 0.42], [0.42, -0.34]], [[0.42, -0.34], [-0.42, -0.34]], [[-0.42, -0.34], [0, 0.42]], [[-0.36, -0.05], [0.36, -0.05]]],
	[["o", 0, 0, 0.4], ["o", 0, 0, 0.06]]
];
// runes as strokes in a box -0.5..0.5 (y down)
const RUNES = [
	["Fehu", [[[0, -0.5], [0, 0.5]], [[0, -0.12], [0.3, -0.45]], [[0, 0.12], [0.3, -0.2]]]],
	["Raido", [[[-0.15, -0.5], [-0.15, 0.5]], [[-0.15, -0.5], [0.22, -0.28]], [[0.22, -0.28], [-0.15, -0.05]], [[-0.15, -0.05], [0.22, 0.5]]]],
	["Algiz", [[[0, -0.5], [0, 0.5]], [[0, -0.02], [-0.3, -0.45]], [[0, -0.02], [0.3, -0.45]]]],
	["Othala", [[[0, -0.5], [0.28, -0.15]], [[0.28, -0.15], [-0.22, 0.5]], [[0, -0.5], [-0.28, -0.15]], [[-0.28, -0.15], [0.22, 0.5]]]]
];
const roman = n => { let s = ""; for (const [v, r] of [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]) while (n >= v) { s += r; n -= v; } return s; };
const strokesSvg = (strokes, w = 0.09) => `<svg viewBox="-0.6 -0.6 1.2 1.2"><path d="${strokes.filter(s => s[0] !== "o").map(([a, b]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`).join("")}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${strokes.filter(s => s[0] === "o").map(o => `<circle cx="${o[1]}" cy="${o[2]}" r="${o[3]}" stroke="currentColor" stroke-width="${w}" fill="${o[3] < 0.1 ? "currentColor" : "none"}"/>`).join("")}</svg>`;
const runeSvg = i => strokesSvg(RUNES[i][1], 0.1);
const alchSvg = i => strokesSvg(ALCH[i], 0.08);
const BOOK_COLS = ["#6a1a1a", "#1a4a2a", "#2a2a6a", "#6a4a1a", "#4a1a4a", "#1a3a4a", "#8a6a2a", "#3a2a1a"];

// ================================================================ the rooms' puzzles
// steps: what to do, one after another (f: the flag that says it's done; h: hints, one more each time you ask)
// items: what the team is carrying (got when f is set, gone again once u is)
const MISSIONS = {
	study: {
		name: ["Detective's Study", "Dedektifin Odası"], stars: 1, color: "#e0b25a", light: "#ffd59a",
		blurb: ["A famous detective vanished mid-case and left the study locked from the inside. Their clues are your way out.", "Ünlü bir dedektif bir davanın ortasında ortadan kayboldu, çalışma odası içeriden kilitli kaldı. Bıraktığı ipuçları tek çıkış yolunuz."],
		gen: R => {
			const sh = 1 + (R() * 12 | 0), sm = 5 * (R() * 12 | 0), fast = [10, 15, 20, 25, 35, 40][R() * 6 | 0];
			const t = ((sh * 60 + sm - fast - 60) % 720 + 720) % 720 + 60;
			return { sh, sm, fast, rh: Math.floor(t / 60), rm: t % 60, syms: shuffle(range(6), R).slice(0, 4), digits: shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], R).slice(0, 4), order: shuffle(range(4), R) };
		},
		steps: [
			{ f: "drawer", t: ["Open the locked desk drawer", "Kilitli masa çekmecesini aç"], h: [["Read the case file on the desk.", "Masadaki dava dosyasını oku."], ["The wall clock stopped at the moment of the crime, but the file says it always ran fast.", "Duvar saati suç anında durmuş, ama dosyaya göre o saat hep ileri gidiyormuş."], ["Take the 'fast' minutes away from the time on the clock. Then enter hours and minutes: 07:45 is 0745.", "Saatin gösterdiği zamandan 'ileri' dakikaları çıkar. Sonra saat ve dakikayı gir: 07:45 için 0745."]] },
			{ f: "cab", t: ["Unlock the cabinet", "Dolabı aç"], h: [["The drawer gave you something. What else here has a keyhole?", "Çekmeceden bir şey çıktı. Burada başka ne kilitli?"], ["Use the brass key on the tall cabinet.", "Pirinç anahtarı uzun dolapta kullan."]] },
			{ f: "uv", t: ["Find the hidden message", "Gizli mesajı bul"], h: [["Invisible ink only shows under UV light.", "Görünmez mürekkep sadece UV ışıkta görünür."], ["The evidence board says the detective hides things 'where I work'. Shine the torch over the desk.", "Delil panosuna göre dedektif sırlarını 'çalıştığı yere' saklıyor. El fenerini masanın üstüne tut."]] },
			{ f: "out", t: ["Work out the door code", "Kapı şifresini çöz"], h: [["The glowing symbols give you an ORDER. Something else in the room gives each symbol a NUMBER.", "Parlayan semboller bir SIRA veriyor. Odadaki başka bir şey her sembole bir SAYI veriyor."], ["Look at the evidence board with the magnifying glass: there's a tiny number by each symbol.", "Delil panosuna büyüteçle bak: her sembolün yanında minicik bir sayı var."], ["Write the board's numbers in the order the glowing symbols appear, and enter them on the keypad by the door.", "Panodaki sayıları parlayan sembollerin sırasıyla yaz ve kapının yanındaki tuş takımına gir."]] }
		],
		items: [{ f: "drawer", u: "cab", n: ["Brass key", "Pirinç anahtar"], ic: "🗝️" }, { f: "cab", n: ["UV torch", "UV el feneri"], ic: "🔦" }, { f: "cab", n: ["Magnifying glass", "Büyüteç"], ic: "🔍" }]
	},
	pirate: {
		name: ["Pirate's Cabin", "Korsan Kamarası"], stars: 2, color: "#ff8a5a", light: "#ffb35c",
		blurb: ["Captain Redbeard's cabin. The hatch is padlocked and the captain will be back soon...", "Kızıl Sakal'ın kamarası. Ambar kapağı asma kilitli ve kaptan birazdan dönecek..."],
		gen: R => {
			const fi = R() * FORMULAS.length | 0, ans = FORMULAS[fi][1];
			const others = shuffle([1, 2, 3, 4, 5, 9, 11, 12].filter(n => n !== ans), R).slice(0, 3);
			const kp = R() * 4 | 0, nums = others.slice(); nums.splice(kp, 0, ans);
			const start = R() * 4 | 0, turns = range(4).map(() => "RLRU"[R() * 4 | 0]);
			let d = start; const seq = [DIRS[d]];
			for (const tn of turns) { d = (d + (tn === "R" ? 1 : tn === "L" ? 3 : 2)) % 4; seq.push(DIRS[d]); }
			return { fi, nums, kp, start, turns, seq, flagMap: shuffle(range(10), R), ships: shuffle(range(10), R).slice(0, 3) };
		},
		steps: [
			{ f: "key", t: ["Find the captain's key", "Kaptanın anahtarını bul"], h: [["Read the captain's logbook on the table.", "Masadaki kaptanın seyir defterini oku."], ["Count what the logbook asks for: they're all here in the cabin. Look at every wall.", "Defterin istediklerini say: hepsi kamarada. Her duvara bak."], ["There are 3 portholes, 2 anchors and 2 lanterns. Work out the number and search that barrel.", "3 lomboz, 2 çapa ve 2 fener var. Sayıyı hesapla ve o numaralı fıçıyı ara."]] },
			{ f: "chest", t: ["Open the sea chest", "Deniz sandığını aç"], h: [["The rusty key fits something big and heavy.", "Paslı anahtar büyük ve ağır bir şeye uyuyor."], ["Use the rusty key on the sea chest by the back wall.", "Paslı anahtarı arka duvardaki sandıkta kullan."]] },
			{ f: "locker", t: ["Open the captain's locker", "Kaptanın dolabını aç"], h: [["The note from the chest is in your clues. It's a set of turns.", "Sandıktan çıkan not ipuçlarında. Bir dizi dönüş anlatıyor."], ["Start facing where the note says, then turn as it says. After every turn, write down where you face.", "Notun dediği yöne bakarak başla, sonra söylediği gibi dön. Her dönüşten sonra hangi yöne baktığını yaz."], ["Facing north, a right turn faces east and turning right round faces south. That's 5 directions in all.", "Kuzeye bakarken sağa dönersen doğuya, tam geri dönersen güneye bakarsın. Toplam 5 yön."]] },
			{ f: "spy", t: ["Spot the signal", "İşareti gör"], h: [["The locker held a spyglass. What would you look at through it?", "Dolaptan bir dürbün çıktı. Onunla neye bakarsın?"], ["Look out of the porthole through the spyglass.", "Dürbünle lombozdan dışarı bak."]] },
			{ f: "out", t: ["Open the hatch", "Ambar kapağını aç"], h: [["Each ship flies a signal flag. The signal book (in your clues) says what number each flag means.", "Her gemide bir işaret bayrağı var. İşaret kitabı (ipuçlarında) her bayrağın hangi sayı olduğunu söylüyor."], ["Read the flags left to right and enter the three numbers on the hatch padlock.", "Bayrakları soldan sağa oku ve üç sayıyı ambar kilidine gir."]] }
		],
		items: [{ f: "key", u: "chest", n: ["Rusty key", "Paslı anahtar"], ic: "🗝️" }, { f: "chest", n: ["Captain's note", "Kaptanın notu"], ic: "📜" }, { f: "locker", n: ["Spyglass", "Dürbün"], ic: "🔭" }, { f: "locker", n: ["Signal book", "İşaret kitabı"], ic: "📘" }]
	},
	lab: {
		name: ["Mad Scientist's Lab", "Çılgın Bilimcinin Laboratuvarı"], stars: 2, color: "#5dffb0", light: "#dff6ff",
		blurb: ["An experiment went wrong. The power's out and the door only opens for the antidote.", "Bir deney ters gitti. Elektrik kesik ve kapı sadece panzehir için açılıyor."],
		gen: R => {
			const r = 1 + (R() * 4 | 0), g = 1 + (R() * 4 | 0), b = 1 + (R() * 4 | 0);
			return { spots: shuffle(range(6), R).slice(0, 3), perm: shuffle(range(3), R), rule: R() * 2 | 0, word: R() * WORDS.length | 0, drops: [r, g, b], eq: [r + g, g + b, r + b] };
		},
		steps: [
			{ f: "power", t: ["Restore the power", "Elektriği geri getir"], h: [["The fuse box needs three fuses: they're hidden around the lab. Search everything.", "Sigorta kutusuna üç sigorta lazım: laboratuvarın her yerine saklanmışlar. Her şeyi ara."], ["The fuses must go in the right order. Read the safety poster by the door.", "Sigortalar doğru sırayla takılmalı. Kapının yanındaki güvenlik afişini oku."], ["Two colours must never touch, so the third goes in the middle. The other rule tells you which way round.", "İki renk asla yan yana gelmemeli, yani üçüncüsü ortaya gider. Diğer kural hangi tarafa geleceğini söyler."]] },
			{ f: "login", t: ["Log in to the computer", "Bilgisayara giriş yap"], h: [["The scientist wrote the password down... look at the whiteboard.", "Bilim insanı şifreyi bir yere yazmış... beyaz tahtaya bak."], ["Those numbers are atomic numbers. Find each one on the periodic table poster.", "O sayılar atom numaraları. Her birini periyodik tablo afişinde bul."], ["Put the element symbols together in that order: they spell the password.", "Element sembollerini o sırayla yan yana koy: şifreyi oluşturuyorlar."]] },
			{ f: "out", t: ["Mix the antidote", "Panzehiri karıştır"], h: [["The computer gives the formula as three sums.", "Bilgisayar formülü üç toplam olarak veriyor."], ["Add all three sums together and halve it: that's red + green + blue. Take away each sum to find each colour.", "Üç toplamı toplayıp ikiye böl: bu kırmızı + yeşil + mavi. Her bir toplamı çıkararak her rengi bul."], ["Each colour is between 1 and 4 drops. Add them at the lab bench and press Mix.", "Her renk 1 ile 4 damla arası. Laboratuvar tezgâhında ekle ve Karıştır'a bas."]] }
		],
		items: [],
		extra: f => { const n = range(6).filter(i => f("fuse" + i)).length; return n && !f("power") ? ["🔌 " + L("Fuses", "Sigorta") + " ×" + n] : []; }
	},
	vault: {
		name: ["Bank Vault", "Banka Kasası"], stars: 3, color: "#7ae5c8", light: "#e8f4ff",
		blurb: ["You're in the bank's vault room after hours. The lasers are on and the vault door is shut. Crack it.", "Mesai sonrası bankanın kasa dairesindesiniz. Lazerler açık, kasa kapısı kapalı. Kırın onu."],
		gen: R => {
			const d4 = 1 + (R() * 3 | 0), d3 = R() * 10 | 0, pin = [2 * d4, 3 * d4, d3, d4];
			const cells = shuffle(range(9), R).slice(0, 4), lights = range(9).map(() => false);
			for (const c of cells) for (const j of [c, c - 3, c + 3, c % 3 ? c - 1 : -1, c % 3 < 2 ? c + 1 : -1]) if (j >= 0 && j < 9) lights[j] = !lights[j];
			return { pin, sum: pin.reduce((a, b) => a + b, 0), lights, boxes: shuffle(range(24).map(i => i + 1), R).slice(0, 6), times: shuffle(TIMES, R).slice(0, 6), target: R() * 6 | 0, logOrder: shuffle(range(6), R), ledgerOrder: shuffle(range(6), R), vault: range(3).map(() => R() * 10 | 0) };
		},
		steps: [
			{ f: "drawer", t: ["Open the guard's drawer", "Bekçinin çekmecesini aç"], h: [["The guard keeps forgetting the PIN, so they left a note about it on the desk.", "Bekçi şifreyi hep unutuyor, o yüzden masaya onunla ilgili bir not bırakmış."], ["The last digit can only be 1, 2 or 3 (the 1st digit is double it, and the 2nd is 1st + last, which must stay under 10).", "Son rakam sadece 1, 2 ya da 3 olabilir (1. rakam onun iki katı, 2. rakam 1. + son, ve 10'dan küçük olmalı)."], ["Try each possible last digit and see which makes the four add up to the right total.", "Her olası son rakamı dene ve dördünün toplamını doğru yapanı bul."]] },
			{ f: "lasers", t: ["Switch off the lasers", "Lazerleri kapat"], h: [["The security panel on the wall needs the guard's keycard.", "Duvardaki güvenlik paneli bekçinin kartını istiyor."], ["Pressing a light flips it AND the ones above, below, left and right of it. Turn all nine off.", "Bir ışığa basınca o ışık VE üstündeki, altındaki, solundaki, sağındaki değişir. Dokuzunu da söndür."], ["Pressing the same light twice undoes it, so each light needs pressing once at most. Try working row by row.", "Aynı ışığa iki kez basmak etkisini geri alır, yani her ışığa en fazla bir kez basmak yeter. Satır satır çalışmayı dene."]] },
			{ f: "box", t: ["Open the right deposit box", "Doğru kiralık kasayı aç"], h: [["The torn receipt from the drawer has a visiting time but no name.", "Çekmeceden çıkan yırtık makbuzda saat var ama isim yok."], ["The visitor log by the door matches times to names. The ledger on the desk matches names to box numbers.", "Kapının yanındaki ziyaretçi defteri saatleri isimlerle eşleştiriyor. Masadaki kayıt defteri isimleri kasa numaralarıyla."], ["Time → name (visitor log) → box (ledger). Open that box with the deposit key.", "Saat → isim (ziyaretçi defteri) → kasa (kayıt defteri). O kasayı kiralık kasa anahtarıyla aç."]] },
			{ f: "out", t: ["Crack the vault door", "Kasa kapısını kır"], h: [["The note in the box is in code. It says how far each letter was moved.", "Kasadaki not şifreli. Her harfin ne kadar kaydırıldığını söylüyor."], ["Count the laser beams you switched off. Move every letter back that many places in the alphabet.", "Kapattığın lazer ışınlarını say. Her harfi alfabede o kadar geri kaydır."], ["There were 5 beams: F becomes A, G becomes B, and so on. The words are numbers.", "5 ışın vardı: F, A olur; G, B olur, böyle devam eder. Kelimeler sayıdır."]] }
		],
		items: [{ f: "drawer", u: "lasers", n: ["Keycard", "Giriş kartı"], ic: "💳" }, { f: "drawer", u: "box", n: ["Deposit key", "Kasa anahtarı"], ic: "🗝️" }, { f: "drawer", n: ["Torn receipt", "Yırtık makbuz"], ic: "🧾" }, { f: "box", n: ["Coded note", "Şifreli not"], ic: "✉️" }]
	},
	space: {
		name: ["Space Station Omega", "Omega Uzay İstasyonu"], stars: 3, color: "#6ad0ff", light: "#cfeaff",
		blurb: ["Station Omega has lost power and the alarm is wailing. Reboot the systems and get through the airlock.", "Omega İstasyonu'nun enerjisi kesildi, alarm çalıyor. Sistemleri yeniden başlat ve hava kilidinden geç."],
		gen: R => {
			const rule = R() * PRULES.length | 0;
			let pl;
			do pl = shuffle(range(8), R).slice(0, 5); while (!pl.some(i => PRULES[rule][1](PLANETS[i])) || pl.every(i => PRULES[rule][1](PLANETS[i])));
			return { rule, pl, cs: shuffle(range(6), R).slice(0, 3), tn: shuffle(range(9).map(i => i + 1), R).slice(0, 4), lv: shuffle(TANK_LV, R).slice(0, 4) };
		},
		steps: [
			{ f: "power", t: ["Reboot the station", "İstasyonu yeniden başlat"], h: [["Read the captain's log on the tablet.", "Tabletteki kaptan seyir kaydını oku."], ["The log says which planets' switches go ON. The planet chart on the wall has their rings and moons.", "Kayıt hangi gezegenlerin düğmelerinin AÇIK olacağını söylüyor. Duvardaki gezegen tablosunda halkaları ve uyduları var."], ["Check each switch's planet against the rule. Every other switch stays OFF.", "Her düğmenin gezegenini kurala göre kontrol et. Diğer bütün düğmeler KAPALI kalır."]] },
			{ f: "locker", t: ["Open the supply locker", "Erzak dolabını aç"], h: [["With power back, the navigation console shows a star chart.", "Enerji gelince navigasyon konsolu bir yıldız haritası gösteriyor."], ["The log names three constellations. Count the bright stars in each, in that order.", "Kayıtta üç takımyıldız var. Her birindeki parlak yıldızları o sırayla say."]] },
			{ f: "out", t: ["Open the airlock", "Hava kilidini aç"], h: [["The airlock manual from the supply locker is in your clues.", "Erzak dolabından çıkan hava kilidi kılavuzu ipuçlarında."], ["Four oxygen tanks stand around the station, each with a big number and a gauge. Walk up to each one and check it.", "İstasyonda dört oksijen tüpü var, her birinde büyük bir numara ve bir gösterge var. Her birine git ve kontrol et."], ["Put the tanks' numbers in order from the highest % to the lowest %, and enter them at the airlock terminal.", "Tüplerin numaralarını en yüksek %'den en düşük %'ye sırala ve hava kilidi terminaline gir."]] }
		],
		items: [{ f: "locker", n: ["Access card", "Giriş kartı"], ic: "💳" }, { f: "locker", n: ["Airlock manual", "Hava kilidi kılavuzu"], ic: "📘" }]
	},
	wizard: {
		name: ["Wizard's Tower", "Büyücünün Kulesi"], stars: 3, color: "#b48cff", light: "#b49cff",
		blurb: ["The last room. The old wizard sealed the way out with runes. Only real magic will break the seal.", "Son oda. Yaşlı büyücü çıkışı rünlerle mühürledi. Mührü sadece gerçek büyü kırabilir."],
		gen: R => {
			const vals = shuffle([1, 2, 3, 4], R);
			const expr = vals.map(n => {
				const k = R() * 3 | 0;
				if (k === 0 && n > 1) { const a = 1 + (R() * (n - 1) | 0); return roman(a) + " + " + roman(n - a); }
				if (k === 1) { const b = 2 + (R() * 3 | 0); return roman(n * b) + " ÷ " + roman(b); }
				const b = 1 + (R() * 6 | 0); return roman(n + b) + " − " + roman(b);
			});
			return { riddle: R() * RIDDLES.length | 0, seq: shuffle(range(5), R).slice(0, 4), colorOf: shuffle(range(5), R), vals, expr };
		},
		steps: [
			{ f: "mirror", t: ["Answer the mirror's riddle", "Aynanın bilmecesini çöz"], h: [["The spellbook is written backwards. How do you read backwards writing?", "Büyü kitabı ters yazılmış. Ters yazıyı nasıl okursun?"], ["Read the book, then look into the magic mirror: it shows the riddle the right way round.", "Kitabı oku, sonra sihirli aynaya bak: bilmeceyi düz gösterir."]] },
			{ f: "orb", t: ["Wake the crystal ball", "Kristal küreyi uyandır"], h: [["The mirror gave you a moonstone. Something here has an empty socket.", "Ayna sana bir ay taşı verdi. Burada boş bir yuvası olan bir şey var."], ["Set the moonstone into the crystal ball's pedestal, then gaze into the ball.", "Ay taşını kristal kürenin kaidesine yerleştir, sonra küreye bak."]] },
			{ f: "brew", t: ["Brew the potion", "İksiri hazırla"], h: [["The crystal ball shows alchemists' symbols, not colours.", "Kristal küre renkleri değil, simya sembollerini gösteriyor."], ["Each bottle on the potion shelf has a symbol on its label.", "İksir rafındaki her şişenin etiketinde bir sembol var."], ["Turn the ball's symbols into colours using the shelf, then pour them in that order.", "Kürenin sembollerini raftaki şişelere göre renklere çevir, sonra o sırayla dök."]] },
			{ f: "out", t: ["Break the rune seal", "Rün mührünü kır"], h: [["Each standing stone has a rune and a sum in Roman numerals.", "Her dikili taşta bir rün ve Roma rakamlarıyla bir işlem var."], ["Work out each sum: the answers are 1 to 4.", "Her işlemi çöz: cevaplar 1'den 4'e kadar."], ["Trace the runes on the door seal in order of their answers: 1, 2, 3, 4.", "Rünleri cevaplarının sırasıyla kapıdaki mühre çiz: 1, 2, 3, 4."]] }
		],
		items: [{ f: "mirror", u: "orb", n: ["Moonstone", "Ay taşı"], ic: "🌙" }, { f: "brew", n: ["Wand", "Asa"], ic: "🪄" }]
	}
};
const nameOf = rid => TX(MISSIONS[rid].name);

// ================================================================ pictures (for the clues and for the rooms' walls)
// text, shrunk until it fits
function fitText(c, w, h, text, o = {}) {
	let size = o.size || h * 0.62;
	const font = s => `${o.weight || 900} ${s}px ${o.family || "Nunito, 'Segoe UI', sans-serif"}`;
	c.font = font(size);
	while (c.measureText(text).width > w * (o.fit || 0.92) && size > 8) { size -= 3; c.font = font(size); }
	c.textAlign = o.align || "center"; c.textBaseline = "middle";
	if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.blur || 26; }
	c.fillStyle = o.color || "#fff";
	c.fillText(text, o.x !== undefined ? o.x : w / 2, o.y !== undefined ? o.y : h / 2 + 4);
	c.shadowBlur = 0;
}
function drawShape(c, i, x, y, s) {
	c.beginPath();
	if (i === 0) { c.moveTo(x, y - s * 0.45); c.lineTo(x + s * 0.45, y + s * 0.38); c.lineTo(x - s * 0.45, y + s * 0.38); c.closePath(); }
	else if (i === 1) c.arc(x, y, s * 0.42, 0, TAU);
	else if (i === 2) c.rect(x - s * 0.38, y - s * 0.38, s * 0.76, s * 0.76);
	else if (i === 3) { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * 0.2 : s * 0.47; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
	else if (i === 4) { c.moveTo(x, y - s * 0.48); c.lineTo(x + s * 0.32, y); c.lineTo(x, y + s * 0.48); c.lineTo(x - s * 0.32, y); c.closePath(); }
	else { const a = s * 0.14, b = s * 0.44; c.moveTo(x - a, y - b); c.lineTo(x + a, y - b); c.lineTo(x + a, y - a); c.lineTo(x + b, y - a); c.lineTo(x + b, y + a); c.lineTo(x + a, y + a); c.lineTo(x + a, y + b); c.lineTo(x - a, y + b); c.lineTo(x - a, y + a); c.lineTo(x - b, y + a); c.lineTo(x - b, y - a); c.lineTo(x - a, y - a); c.closePath(); }
	c.fill();
}
function drawClock(c, w, h, hh, mm) {
	const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
	c.fillStyle = "#f4ead2"; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
	c.lineWidth = R * 0.05; c.strokeStyle = "#5a3a1a"; c.stroke();
	c.fillStyle = "#2a1a0e"; c.strokeStyle = "#2a1a0e"; c.font = `700 ${R * 0.22 | 0}px Georgia, serif`; c.textAlign = "center"; c.textBaseline = "middle";
	for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillText(String(i || 12), cx + Math.sin(a) * R * 0.74, cy - Math.cos(a) * R * 0.74 + 2); }
	for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, l = i % 5 ? 0.04 : 0.09; c.lineWidth = i % 5 ? 1.5 : 3.5; c.beginPath(); c.moveTo(cx + Math.sin(a) * R * 0.94, cy - Math.cos(a) * R * 0.94); c.lineTo(cx + Math.sin(a) * R * (0.94 - l), cy - Math.cos(a) * R * (0.94 - l)); c.stroke(); }
	if (hh === undefined) return;
	const hand = (a, len, wd) => { c.lineWidth = wd; c.lineCap = "round"; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); c.stroke(); };
	hand(((hh % 12) + mm / 60) / 12 * TAU, R * 0.45, R * 0.07);
	hand(mm / 60 * TAU, R * 0.7, R * 0.04);
	c.beginPath(); c.arc(cx, cy, R * 0.05, 0, TAU); c.fill();
}
// the evidence board: four suspects, each pinned with a symbol (and, through the magnifying glass, a tiny number)
function drawEvidence(c, w, h, p, close) {
	c.fillStyle = "#b08a5a"; c.fillRect(0, 0, w, h);
	const pins = [[0.2, 0.3], [0.62, 0.26], [0.34, 0.74], [0.8, 0.7]].map(([x, y]) => [x * w, y * h]);
	c.strokeStyle = "#c02a2a"; c.lineWidth = 3; c.beginPath(); pins.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.stroke();
	const pw = w * 0.2, ph = h * 0.34;
	pins.forEach(([x, y], i) => {
		c.fillStyle = "#f4efe2"; c.fillRect(x - pw / 2, y - ph / 2, pw, ph);
		c.fillStyle = ["#3a3a4a", "#5a3a2a", "#2a4a3a", "#4a2a3a"][i];
		c.beginPath(); c.arc(x, y - ph * 0.12, pw * 0.2, 0, TAU); c.fill(); c.fillRect(x - pw * 0.28, y + ph * 0.1, pw * 0.56, ph * 0.2);
		c.fillStyle = "#c02a2a"; drawShape(c, p.syms[i], x, y - ph / 2, pw * 0.28);
		if (close) { c.fillStyle = "#1a1a1a"; c.font = `900 ${ph * 0.2 | 0}px 'Courier New', monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(p.digits[i]), x + pw * 0.36, y + ph * 0.38); }
		else { c.fillStyle = "#3a3a3a"; c.fillRect(x + pw * 0.32, y + ph * 0.36, 5, 3); }
	});
}
function drawUV(c, w, h, p, bg) {
	if (bg) { c.fillStyle = "#0c0618"; c.fillRect(0, 0, w, h); }
	c.shadowColor = "#b06aff"; c.shadowBlur = h * 0.12; c.fillStyle = "#e0b0ff";
	p.order.forEach((si, k) => drawShape(c, p.syms[si], w * (0.14 + k * 0.24), h * 0.5, h * 0.62));
	c.shadowBlur = 0;
}
function drawFlag(c, i, x, y, w, h) {
	const R = (col, a, b, cw, ch) => { c.fillStyle = col; c.fillRect(x + a * w, y + b * h, cw * w, ch * h); };
	c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
	switch (i) {
		case 0: R("#d82a2a", 0, 0, 1, 0.5); R("#ffffff", 0, 0.5, 1, 0.5); break;
		case 1: R("#2a4ad8", 0, 0, 1, 1); R("#ffffff", 0.3, 0.3, 0.4, 0.4); break;
		case 2: R("#ffd23a", 0, 0, 1, 1); c.strokeStyle = "#111"; c.lineWidth = h * 0.22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.stroke(); break;
		case 3: R("#d82a2a", 0, 0, 0.34, 1); R("#ffffff", 0.33, 0, 0.34, 1); R("#2a4ad8", 0.66, 0, 0.34, 1); break;
		case 4: R("#ffffff", 0, 0, 1, 1); R("#111111", 0, 0, 0.5, 0.5); R("#111111", 0.5, 0.5, 0.5, 0.5); break;
		case 5: R("#2a9a3a", 0, 0, 1, 1); R("#ffffff", 0.4, 0, 0.2, 1); R("#ffffff", 0, 0.4, 1, 0.2); break;
		case 6: R("#ffffff", 0, 0, 1, 1); c.fillStyle = "#d82a2a"; c.beginPath(); c.arc(x + w / 2, y + h / 2, h * 0.3, 0, TAU); c.fill(); break;
		case 7: for (let k = 0; k < 4; k++) R(k % 2 ? "#ffd23a" : "#111111", 0, k / 4, 1, 0.26); break;
		case 8: R("#2a4ad8", 0, 0, 1, 1); c.fillStyle = "#ffd23a"; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill(); break;
		default: R("#d82a2a", 0, 0, 1, 1); c.strokeStyle = "#fff"; c.lineWidth = h * 0.16; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke();
	}
	c.restore();
	c.strokeStyle = "#222"; c.lineWidth = 2; c.strokeRect(x, y, w, h);
}
function drawSea(c, w, h, ships) {
	const sky = c.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, "#6ab0e8"); sky.addColorStop(1, "#cfe8f8");
	c.fillStyle = sky; c.fillRect(0, 0, w, h * 0.6);
	c.fillStyle = "#2a6aa8"; c.fillRect(0, h * 0.6, w, h * 0.4);
	c.fillStyle = "#3a7a3a"; c.beginPath(); c.ellipse(w * 0.88, h * 0.6, w * 0.16, h * 0.1, 0, Math.PI, TAU); c.fill();
	const s = ships ? h / 360 : h / 900;
	for (let i = 0; i < 3; i++) {
		const x = w * (0.2 + i * 0.28), y = h * 0.62;
		c.fillStyle = "#5a3a1a"; c.beginPath(); c.moveTo(x - 60 * s, y - 10 * s); c.lineTo(x + 60 * s, y - 10 * s); c.lineTo(x + 40 * s, y + 14 * s); c.lineTo(x - 40 * s, y + 14 * s); c.fill();
		c.fillStyle = "#3a2a1a"; c.fillRect(x - 3 * s, y - 130 * s, 6 * s, 122 * s);
		c.fillStyle = "#f4ead2"; c.beginPath(); c.moveTo(x - 4 * s, y - 112 * s); c.lineTo(x - 50 * s, y - 30 * s); c.lineTo(x - 4 * s, y - 30 * s); c.fill();
		if (ships) drawFlag(c, ships[i], x + 3 * s, y - 130 * s, 64 * s, 42 * s);
	}
}
function drawPeriodic(c, w, h) {
	c.fillStyle = "#f4f6f8"; c.fillRect(0, 0, w, h);
	fitText(c, w, h * 0.12, L("PERIODIC TABLE (some of it)", "PERİYODİK TABLO (bir kısmı)"), { color: "#1a2a3a", y: h * 0.07 });
	const cols = 8, tw = (w - 40) / cols, th = (h * 0.84 - 20) / 5;
	ELEMS.forEach(([n, s], i) => {
		const x = 20 + (i % cols) * tw, y = h * 0.14 + (i / cols | 0) * th;
		c.fillStyle = ["#ffd9d9", "#d9ecff", "#dfffd9", "#fff2c9", "#ecd9ff"][(n * 7) % 5]; c.fillRect(x + 3, y + 3, tw - 6, th - 6);
		c.strokeStyle = "#8a9aa8"; c.lineWidth = 1.5; c.strokeRect(x + 3, y + 3, tw - 6, th - 6);
		c.fillStyle = "#1a2a3a"; c.textAlign = "left"; c.textBaseline = "middle"; c.font = `700 ${th * 0.2 | 0}px Nunito, sans-serif`; c.fillText(String(n), x + 10, y + th * 0.2);
		c.textAlign = "center"; c.font = `900 ${th * 0.44 | 0}px Nunito, sans-serif`; c.fillText(s, x + tw / 2, y + th * 0.58);
	});
}
function drawWhiteboard(c, w, h, nums) {
	c.fillStyle = "#fbfcfd"; c.fillRect(0, 0, w, h);
	c.strokeStyle = "#aab4be"; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
	const hand = "Caveat, 'Comic Sans MS', cursive";
	fitText(c, w, h, "E = mc² ...?", { family: hand, weight: 700, color: "#2a4ab0", align: "left", x: 30, y: h * 0.15, size: h * 0.1 });
	fitText(c, w, h, L("Password = my favourite elements!", "Şifre = en sevdiğim elementler!"), { family: hand, weight: 700, color: "#c02a2a", align: "left", x: 30, y: h * 0.42, size: h * 0.1 });
	fitText(c, w, h, nums.join(" · "), { family: hand, weight: 900, color: "#1a1a1a", align: "left", x: 50, y: h * 0.72, size: h * 0.16 });
	c.strokeStyle = "#c02a2a"; c.lineWidth = 4; c.beginPath(); c.ellipse(w * 0.45, h * 0.72, w * 0.42, h * 0.13, 0, 0, TAU); c.stroke();
}
function drawTerminal(c, w, h, mode, p) {
	c.fillStyle = mode ? "#041208" : "#020403"; c.fillRect(0, 0, w, h);
	if (!mode) return;
	c.fillStyle = "#6dff9a"; c.font = `700 ${h * 0.085 | 0}px 'Courier New', monospace`; c.textAlign = "left"; c.textBaseline = "top";
	const lines = mode === "login" ? ["OMEGA LABS v2.3", "", L("> PASSWORD: _", "> ŞİFRE: _")]
		: [L("> ACCESS GRANTED", "> ERİŞİM VERİLDİ"), L("ANTIDOTE (drops):", "PANZEHİR (damla):"), ` R + G = ${p.eq[0]}`, ` G + B = ${p.eq[1]}`, ` R + B = ${p.eq[2]}`];
	lines.forEach((l, i) => c.fillText(l, w * 0.06, h * 0.08 + i * h * 0.15));
}
function drawBoxes(c, w, h) {
	c.fillStyle = "#4a525a"; c.fillRect(0, 0, w, h);
	const cw = w / 6, ch = h / 4;
	for (let i = 0; i < 24; i++) {
		const x = (i % 6) * cw, y = (i / 6 | 0) * ch;
		const gr = c.createLinearGradient(x, y, x + cw, y + ch); gr.addColorStop(0, "#c8ced4"); gr.addColorStop(1, "#8a929a");
		c.fillStyle = gr; c.fillRect(x + 4, y + 4, cw - 8, ch - 8);
		c.fillStyle = "#2a2e32"; c.beginPath(); c.arc(x + cw * 0.8, y + ch / 2, ch * 0.08, 0, TAU); c.fill();
		c.fillStyle = "#1a1e22"; c.font = `900 ${ch * 0.36 | 0}px Nunito, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(i + 1), x + cw * 0.4, y + ch / 2);
	}
}
function drawStars(c, w, h) {
	c.fillStyle = "#050a1c"; c.fillRect(0, 0, w, h);
	const r = lcg(31);
	for (let n = 0; n < 220; n++) { c.fillStyle = `rgba(160,180,255,${0.12 + r() * 0.15})`; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
	const cw = w / 3, ch = h / 2;
	CONSTS.forEach((C, i) => {
		const pts = C[2], lines = C[3], ox = (i % 3) * cw, oy = (i / 3 | 0) * ch, P = q => [ox + cw * (0.1 + q[0] * 0.8), oy + ch * (0.08 + q[1] * 0.72)];
		c.strokeStyle = "rgba(120,170,255,0.45)"; c.lineWidth = 2;
		(lines || pts.slice(1).map((q, j) => [j, j + 1])).forEach(([a, b]) => { const A = P(pts[a]), B = P(pts[b]); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); });
		pts.forEach(q => { const [x, y] = P(q); const gr = c.createRadialGradient(x, y, 0, x, y, 12); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, "#cfe0ff"); gr.addColorStop(1, "rgba(120,160,255,0)"); c.fillStyle = gr; c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill(); });
		const nm = TX([C[0], C[1]]);
		fitText(c, cw, ch, nm.charAt(0).toUpperCase() + nm.slice(1), { color: "#9fc0ff", weight: 800, x: ox + cw / 2, y: oy + ch * 0.92, size: ch * 0.1 });
	});
}
function drawPlanetChart(c, w, h) {
	c.fillStyle = "#0a0f24"; c.fillRect(0, 0, w, h);
	fitText(c, w, h * 0.14, L("THE PLANETS", "GEZEGENLER"), { y: h * 0.08 });
	const sp = w / 8;
	PLANETS.forEach((P, i) => {
		const x = sp * (i + 0.5), y = h * 0.3, R = h * 0.06 * P[5];
		if (P[2]) { c.strokeStyle = "rgba(230,220,190,0.85)"; c.lineWidth = i === 5 ? 6 : 2.5; c.beginPath(); c.ellipse(x, y, R * 1.8, R * 0.45, -0.3, 0, TAU); c.stroke(); }
		c.fillStyle = P[4]; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
		fitText(c, sp, h, TX([P[0], P[1]]), { x, y: h * 0.56, size: h * 0.055, weight: 800, color: "#cfd8ff" });
		fitText(c, sp, h, P[2] ? L("rings: yes", "halka: var") : L("rings: no", "halka: yok"), { x, y: h * 0.7, size: h * 0.045, weight: 700, color: P[2] ? "#ffe38a" : "#8a96b8" });
		fitText(c, sp, h, L("moons: ", "uydu: ") + P[3], { x, y: h * 0.84, size: h * 0.045, weight: 700, color: "#a8ffcf" });
	});
}
// an oxygen tank, close up: its number and its gauge
function drawTank(c, w, h, num, lv, col) {
	c.fillStyle = "#0e141c"; c.fillRect(0, 0, w, h);
	const x = w / 2, tw = w * 0.56, top = h * 0.12, bot = h * 0.95;
	c.fillStyle = "#8a9099"; c.fillRect(x - tw * 0.12, top - h * 0.08, tw * 0.24, h * 0.1);
	c.fillStyle = col; c.beginPath(); c.roundRect(x - tw / 2, top, tw, bot - top, tw * 0.42); c.fill();
	const gx = x - tw * 0.36, gw = tw * 0.2, g0 = top + h * 0.14, g1 = bot - h * 0.08, gh = g1 - g0;
	c.fillStyle = "#05080c"; c.fillRect(gx, g0, gw, gh);
	c.fillStyle = "#7affd0"; c.fillRect(gx + 4, g1 - gh * lv / 100, gw - 8, gh * lv / 100);
	c.fillStyle = "rgba(255,255,255,.7)";
	for (let i = 0; i <= 10; i++) c.fillRect(gx + gw, g1 - gh * i / 10 - 1, i % 5 ? 6 : 12, 2);
	fitText(c, tw * 0.5, h, String(num), { x: x + tw * 0.14, y: h * 0.42, size: h * 0.24, color: "#ffffff", glow: "rgba(0,0,0,.6)", blur: 8 });
	fitText(c, tw * 0.6, h, "O₂ " + lv + "%", { x: x + tw * 0.14, y: h * 0.7, size: h * 0.07, color: "#0e141c" });
}
function drawStrokes(c, strokes, x, y, s, lw) {
	c.lineWidth = lw; c.lineCap = "round"; c.lineJoin = "round";
	c.beginPath();
	for (const st of strokes) {
		if (st[0] === "o") { c.moveTo(x + (st[1] + st[3]) * s, y + st[2] * s); c.arc(x + st[1] * s, y + st[2] * s, st[3] * s, 0, TAU); }
		else { c.moveTo(x + st[0][0] * s, y + st[0][1] * s); c.lineTo(x + st[1][0] * s, y + st[1][1] * s); }
	}
	c.stroke();
}
function drawMissionBoard(c, w, h) {
	c.fillStyle = "#16121e"; c.fillRect(0, 0, w, h);
	fitText(c, w, h, L("THE MISSION", "GÖREV"), { color: "#ff7aa2", glow: "#ff7aa2", y: 80, size: 84 });
	ROOMS.forEach((R, i) => {
		const M = MISSIONS[R.id], x = 60 + (i % 2) * (w / 2 - 20), y = 175 + (i / 2 | 0) * 120;
		c.fillStyle = M.color; c.beginPath(); c.arc(x + 18, y, 18, 0, TAU); c.fill();
		fitText(c, 36, 36, String(i + 1), { color: "#16121e", x: x + 18, y: y + 2, size: 26 });
		fitText(c, w / 2 - 110, 60, TX(M.name), { align: "left", x: x + 50, y: y - 14, size: 40, weight: 800 });
		fitText(c, w / 2 - 110, 50, stars(M.stars), { align: "left", x: x + 50, y: y + 28, size: 30, color: "#ffd36b", family: "'Segoe UI Symbol', sans-serif" });
	});
	fitText(c, w, h, L("Six rooms, one way out. Solve each room to open the next.", "Altı oda, tek çıkış. Sıradakini açmak için her odayı çöz."), { color: "#b9adc9", weight: 700, y: h - 40, size: 30 });
}
function img(w, h, fn, style) {
	const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
	fn(cv.getContext("2d"), w, h);
	return `<img src="${cv.toDataURL()}" alt=""${style ? ` style="${style}"` : ""}>`;
}

const CSS = `
#escHud { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 250px; padding: 12px 14px; pointer-events: auto; display: grid; gap: 8px; }
#escHud .eh-h { display: flex; align-items: center; gap: 8px; }
#escHud .eh-h b { flex: 1; font-size: 14px; font-weight: 900; line-height: 1.2; }
#escHud .eh-n { font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
#escHud .eh-st { color: #ffd36b; font-size: 12px; letter-spacing: 1px; white-space: nowrap; }
#escHud .eh-t { font: 900 24px "Nunito", sans-serif; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 8px; }
#escHud .eh-t small { font-size: 12px; color: var(--muted); font-weight: 800; }
#escHud .eh-rooms { display: flex; gap: 4px; }
#escHud .eh-rooms i { flex: 1; height: 6px; border-radius: 9px; background: rgba(255,255,255,.12); }
#escHud .eh-rooms i.done { background: var(--ok); }
#escHud .eh-rooms i.now { background: linear-gradient(90deg, var(--accent), var(--accent2)); }
#escHud .eh-step { font-size: 12.5px; color: var(--muted); line-height: 1.4; }
#escHud .eh-step b { color: var(--text); }
#escHud .eh-inv { display: flex; flex-wrap: wrap; gap: 5px; }
#escHud .eh-inv span { font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 99px; background: rgba(255,255,255,.08); border: 1px solid var(--line); }
#escHud .eh-b { display: flex; flex-wrap: wrap; gap: 6px; }
#escHud .eh-b .btn { padding: 7px 10px; font-size: 12.5px; border-radius: 10px; }
.esc-lang { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.esc-lang button { border: none; background: transparent; padding: 6px 9px; font: 900 12px "Nunito", sans-serif; color: var(--muted); cursor: pointer; }
.esc-lang button.on { background: rgba(255,122,162,.3); color: var(--text); }
@media (max-width: 640px) { #escHud { left: auto; right: 10px; top: 64px; transform: none; width: 200px; padding: 10px 12px; } #escHud .eh-step { display: none; } #escHud .eh-t { font-size: 19px; } }
.esc-p { margin: 0 0 12px; line-height: 1.5; }
.esc-lock { display: grid; gap: 12px; }
.esc-lock.bad { animation: escShake .4s; }
@keyframes escShake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
.esc-slots { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
.esc-slots i { width: 46px; height: 56px; border-radius: 12px; background: rgba(0,0,0,.35); border: 1px solid var(--line); display: grid; place-items: center; font: 900 24px "Nunito", sans-serif; font-style: normal; color: #9dffb0; }
.esc-slots i.on { border-color: var(--accent); }
.esc-slots i svg { width: 30px; height: 30px; }
.esc-keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.esc-keys.seq { grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); }
.esc-keys button { padding: 12px 6px; border-radius: 12px; border: 1px solid var(--line); background: rgba(255,255,255,.07); cursor: pointer; font: 900 18px "Nunito", sans-serif; color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 52px; }
.esc-keys button:hover { background: rgba(255,255,255,.15); }
.esc-keys button small { font-size: 11px; font-weight: 800; color: var(--muted); }
.esc-keys button svg { width: 30px; height: 30px; }
.esc-word { text-transform: uppercase; letter-spacing: .15em; font-weight: 900; text-align: center; font-size: 20px; }
.esc-msg { min-height: 18px; text-align: center; font-weight: 800; font-size: 13px; color: #ff9a9a; }
.esc-clue { line-height: 1.55; }
.esc-clue img { display: block; width: 100%; border-radius: 12px; margin: 4px 0 10px; }
.esc-clue .paper { background: var(--paper); color: var(--ink); border-radius: 12px; padding: 14px 18px; font-family: "Caveat", cursive; font-size: 23px; line-height: 1.3; margin-bottom: 8px; }
.esc-clue .mirror { display: block; transform: scaleX(-1); }
.esc-clue .term { background: #041208; color: #6dff9a; font-family: ui-monospace, Consolas, monospace; border-radius: 12px; padding: 14px 16px; font-size: 14px; white-space: pre-wrap; margin: 0 0 8px; }
.esc-clue .sym { display: inline-grid; width: 38px; height: 38px; vertical-align: middle; color: #c9a8ff; }
.esc-tbl { width: 100%; border-collapse: collapse; margin: 0 0 10px; font-size: 14px; }
.esc-tbl td, .esc-tbl th { padding: 7px 10px; border-bottom: 1px solid var(--line); text-align: left; }
.esc-tbl th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
.esc-flags { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; text-align: center; font-weight: 900; margin-bottom: 8px; }
.esc-flags img { margin: 0 0 4px; border-radius: 4px; }
.esc-j h4 { margin: 16px 0 6px; font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.esc-j h4:first-child { margin-top: 0; }
.esc-board { display: grid; gap: 8px; }
.esc-m { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.05); border: 1px solid var(--line); border-left: 4px solid var(--c); align-items: center; }
.esc-m .ic { grid-row: span 2; font-size: 20px; width: 28px; text-align: center; }
.esc-m b em { font-style: normal; color: #ffd36b; font-size: 12px; margin-left: 6px; letter-spacing: 1px; }
.esc-m .s { font-size: 12.5px; color: var(--muted); }
.esc-mix { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.esc-mix button { display: flex; flex-direction: column; gap: 2px; align-items: center; border-width: 2px; }
.esc-orb { display: flex; justify-content: center; gap: 14px; margin: 8px 0 14px; }
.esc-orb i { width: 58px; height: 58px; border-radius: 50%; background: radial-gradient(circle, #3a2a6a, #120a24); border: 2px solid #6a5aaa; color: #e8d8ff; display: grid; place-items: center; opacity: .2; animation: escOrb 3.4s infinite; }
.esc-orb i svg { width: 36px; height: 36px; }
@keyframes escOrb { 0%, 22% { opacity: 1; transform: scale(1.12); box-shadow: 0 0 24px #a98cff; } 30%, 100% { opacity: .2; transform: none; box-shadow: none; } }
.esc-sw { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.esc-sw button { padding: 12px; border-radius: 12px; border: 1px solid var(--line); background: rgba(255,255,255,.06); cursor: pointer; font: 800 15px "Nunito", sans-serif; color: var(--text); display: flex; justify-content: space-between; align-items: center; }
.esc-sw button span { font-size: 12px; font-weight: 900; padding: 3px 9px; border-radius: 99px; background: rgba(255,80,80,.25); color: #ffb0b0; }
.esc-sw button.on span { background: rgba(90,255,140,.25); color: #a8ffbf; }
.esc-lo { display: grid; grid-template-columns: repeat(3, 72px); gap: 10px; justify-content: center; margin: 4px 0; }
.esc-lo button { width: 72px; height: 72px; border-radius: 16px; border: 2px solid #3a4a5a; background: #141a22; cursor: pointer; }
.esc-lo button.on { background: radial-gradient(circle, #ff8a8a, #d82a2a); border-color: #ffb0b0; box-shadow: 0 0 18px rgba(255,60,60,.6); }
.esc-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.esc-tabs .btn { padding: 6px 10px; font-size: 12.5px; border-radius: 10px; }
`;

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const glow = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, o || {}));
	const esc = s => ctx.esc(String(s));
	const now = () => Date.now();
	const _d = new THREE.Object3D();
	k.floor(() => 0);
	k.walk(X0 + 0.12, X1 - 0.12, Z0 + 0.12, Z1 - 0.12);
	k.walk(X1 - 0.8, X1 + 0.5, DOOR.z0, DOOR.z1);   // the front door, out onto the path
	k.cam = { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2, maxY: H - 0.3, minY: 0.2 };
	if (!document.getElementById("escCss")) { const s = document.createElement("style"); s.id = "escCss"; s.textContent = CSS; document.head.appendChild(s); }

	// ================================================================ the mission's state (shared)
	// KEY + "run": { s: "run" | "won" | "idle", id, at, by, t } - KEY + room + ":" + thing: { r: the run's id, v }
	const RK = KEY + "run";
	const st = () => { const v = ctx.get(RK); return v && typeof v === "object" ? v : null; };
	// (a run never expires: the team can leave and come back, and every solved room stays solved until someone gives up)
	const running = () => { const s = st(); return !!s && s.s === "run"; };
	const won = () => { const s = st(); return !!s && s.s === "won"; };
	const runId = () => { const s = st(); return s && (running() || s.s === "won") ? s.id : null; };
	function flag(rid, f) { const id = runId(); if (!id) return undefined; const v = ctx.get(KEY + rid + ":" + f); return v && v.r === id ? v.v : undefined; }
	function setFlag(rid, f, v = true) { const id = runId(); if (id) ctx.setShared(KEY + rid + ":" + f, { r: id, v }); }
	// how many rooms are solved, one after another from the first
	function solved() {
		if (won()) return ROOMS.length;
		if (!running()) return 0;
		let n = 0;
		while (n < ROOMS.length && flag(ROOMS[n].id, "out") !== undefined) n++;
		return n;
	}
	// this run's codes (worked out from its id: everyone gets the same ones)
	const pcache = {};
	function P(rid) {
		const id = runId() || "demo", c = pcache[rid];
		if (c && c.id === id) return c.p;
		const p = MISSIONS[rid].gen(rng(hash(id + ":" + rid)));
		pcache[rid] = { id, p };
		return p;
	}
	// where (local) is: a room's index, 2.5 for the passage, -1 for the lobby / corridor, null outside
	function placeAt(lx, lz) {
		if (lx < X0 - 0.1 || lx > X1 + 0.1 || lz < Z0 - 0.1 || lz > Z1 + 0.1) return null;
		for (let i = 0; i < ROOMS.length; i++) {
			const R = ROOMS[i], C = COLS[R.col];
			if (Math.abs(lx - C.cx) < C.hw + 0.1 && (R.north ? lz > CZ : lz < -CZ)) return i;
		}
		if (lx < SEAL) return 2.5;
		return -1;
	}
	const me = () => ctx.me();
	const myPlace = () => { const m = me(); return placeAt(m.x - OX, m.z - OZ); };
	const myRoom = () => { const i = myPlace(); return i !== null && i >= 0 && i % 1 === 0 ? ROOMS[i].id : null; };
	const reachable = i => i === -1 || won() || (running() ? i <= solved() : i === 0);
	function teamNames() {
		const out = [], inside = i => i !== null && i >= 0;
		if (inside(myPlace())) out.push(ctx.profile().name || "You");
		ctx.peers().forEach(p => { if (p && p.look && inside(placeAt(p.x - OX, p.z - OZ))) out.push(p.look.name); });
		return out.length ? out : [ctx.profile().name || "Someone"];
	}
	function start() {
		if (running()) return;
		if (myPlace() !== 0) { ctx.toast(L("Go into room 1 first, then start the mission.", "Önce 1. odaya gir, sonra görevi başlat.")); return; }
		const id = now().toString(36) + Math.random().toString(36).slice(2, 7), name = String(ctx.profile().name || "Someone").slice(0, 24);
		ctx.setShared(RK, { s: "run", id, at: now(), by: name });
		ctx.send({ t: "fx", kind: "sys", text: L(`${name} started the Escape House mission`, `${name} Kaçış Evi görevini başlattı`) });
	}
	function abandon() { ctx.setShared(RK, { s: "idle", at: now() }); }
	function solveRoom(rid) {
		const s = st();
		if (!running() || flag(rid, "out") !== undefined) return;
		setFlag(rid, "out", now() - s.at);
		if (rid === ROOMS[ROOMS.length - 1].id) {
			const t = Math.max(1000, now() - s.at), team = teamNames().join(" & ").slice(0, 80);
			ctx.setShared(RK, Object.assign({}, s, { s: "won", t, team }));
			const b = ctx.get(KEY + "best");
			if (!b || !(b.t <= t)) ctx.setShared(KEY + "best", { t, by: team });
			ctx.send({ t: "fx", kind: "sys", text: L(`${team} escaped from the Escape House in ${fmt(t)}!`, `${team} Kaçış Evi'nden ${fmt(t)} sürede kaçtı!`) });
		}
	}
	function notStarted() {
		if (won()) ctx.toast(L("You already escaped! Press <b>Play again</b> in room 1 to reset the mission.", "Zaten kaçtınız! Görevi sıfırlamak için 1. odada <b>Tekrar oyna</b>'ya bas."));
		else ctx.toast(L("The mission hasn't started yet. Press <b>Start mission</b> on the panel (in room 1) to lock yourselves in.", "Görev henüz başlamadı. Kendinizi kilitlemek için (1. odada) paneldeki <b>Görevi başlat</b>'a bas."), L("Start", "Başlat"), start, 7000);
	}
	function askQuit() { ctx.toast(L("Give up the mission? Every room's progress will be lost.", "Görevden vazgeçilsin mi? Bütün odalardaki ilerleme silinir."), L("Give up", "Vazgeç"), abandon, 7000); }
	// the room the team is up to, and walking there (through the rooms already solved: their doors stay open)
	const current = () => Math.min(solved(), ROOMS.length - 1);
	function goOn() { const p = FR[ROOMS[current()].id].P(0, 2.6); ctx.closeModal(); ctx.walkTo(p[0] + OX, p[1] + OZ); }
	function inventory(rid) {
		const M = MISSIONS[rid], f = x => flag(rid, x);
		const out = M.items.filter(it => f(it.f) && !(it.u && f(it.u))).map(it => it.ic + " " + TX(it.n));
		return M.extra ? out.concat(M.extra(f, P(rid))) : out;
	}

	// ================================================================ clues, locks and hints (windows)
	// every clue a room has (title / html: functions, so they follow the language and the run), and which ones the
	// team has found this run: a shared flag each, so they're kept when you leave or reload, and everyone sees them
	const CLUES = {};   // rid -> [{ key, title, html, w }]
	function defClue(rid, key, title, html, w) { (CLUES[rid] = CLUES[rid] || []).push({ key, title, html, w }); }
	const clueOf = (rid, key) => (CLUES[rid] || []).find(c => c.key === key);
	const seen = (rid, key) => flag(rid, "c:" + key) !== undefined;
	function learn(rid, key) { if (runId() && !seen(rid, key)) setFlag(rid, "c:" + key); }
	const found = rid => (CLUES[rid] || []).filter(c => seen(rid, c.key));
	let closeFns = [];
	const dropClose = () => { closeFns.forEach(f => f()); closeFns = []; };
	function openEsc(title, html, w, onClose) {
		dropClose();
		if (onClose) closeFns.push(onClose);
		return ctx.openModal("escape", title, html, w || 460, dropClose);
	}
	function clue(rid, key) { const c = clueOf(rid, key); learn(rid, key); openEsc(c.title(), `<div class="esc-clue">${c.html()}</div>`, c.w || 500); }
	// a lock: kind "digits" (a keypad), "word" (type it), "seq" (press keys in order: o.keys [{ v, html, sub, c }])
	function lockUI(o) {
		const len = o.len || 4;
		let val = [];
		let keys;
		if (o.kind === "digits") keys = "123456789".split("").map(v => `<button data-k="${v}">${v}</button>`).join("") + `<button data-k="del">⌫</button><button data-k="0">0</button><button data-k="ok">✓</button>`;
		else if (o.kind === "seq") keys = o.keys.map(q => `<button data-k="${q.v}"${q.c ? ` style="border-color:${q.c};color:${q.c}"` : ""}>${q.html}${q.sub ? `<small>${q.sub}</small>` : ""}</button>`).join("") + `<button data-k="del">⌫<small>${L("undo", "geri al")}</small></button>`;
		else keys = `<button data-k="ok">${o.btn || L("Try it", "Dene")}</button>`;
		const body = openEsc(o.title, `<div class="esc-lock">${o.text ? `<div class="esc-p esc-clue">${o.text}</div>` : ""}
			${o.kind === "word" ? `<input class="input esc-word" maxlength="24" placeholder="${o.ph || L("Your answer", "Cevabın")}" autocomplete="off" spellcheck="false">` : `<div class="esc-slots">${"<i></i>".repeat(len)}</div>`}
			<div class="esc-keys ${o.kind}"${o.kind === "word" ? ' style="grid-template-columns:1fr"' : ""}>${keys}</div><div class="esc-msg"></div></div>`, o.w || 430);
		const box = body.querySelector(".esc-lock"), msg = body.querySelector(".esc-msg"), inp = body.querySelector(".esc-word");
		const show = () => body.querySelectorAll(".esc-slots i").forEach((el, i) => {
			const v = val[i], q = o.keys && o.keys.find(x => x.v === v);
			el.innerHTML = v === undefined ? "" : q ? (q.slot || q.html) : v;
			el.style.color = q && q.c ? q.c : "";
			el.classList.toggle("on", i === val.length);
		});
		const submit = () => {
			const v = o.kind === "word" ? norm(inp.value) : val.slice();
			if (o.kind !== "word" && v.length < len) return;
			if (o.kind === "word" && !v) return;
			if (o.check(v)) { ctx.sfx("win", 0.6); ctx.closeModal(); o.ok(); return; }
			ctx.sfx("lose", 0.5);
			msg.textContent = o.fail || L("Nope - that's not it.", "Hayır, bu değil.");
			box.classList.remove("bad"); void box.offsetWidth; box.classList.add("bad");
			val = []; if (inp) inp.select(); show();
		};
		const press = v => {
			if (v === "ok") return submit();
			if (v === "del") { val.pop(); show(); return; }
			if (val.length >= len) return;
			val.push(v); ctx.sfx("click", 0.5); msg.textContent = ""; show();
			if (val.length === len) setTimeout(submit, 160);
		};
		body.querySelectorAll("[data-k]").forEach(b => b.onclick = () => press(b.dataset.k));
		if (inp) { inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") submit(); }); setTimeout(() => inp.focus(), 60); }
		else {
			const map = o.keyMap || {};
			const fn = e => {
				const v = o.kind === "digits" && /^[0-9]$/.test(e.key) ? e.key : map[e.key];
				if (v !== undefined) { e.preventDefault(); press(v); }
				else if (e.key === "Backspace") { e.preventDefault(); press("del"); }
				else if (e.key === "Enter") { e.preventDefault(); submit(); }
			};
			document.addEventListener("keydown", fn, true);
			closeFns.push(() => document.removeEventListener("keydown", fn, true));
		}
		show();
	}
	const shake = body => { const b = body.querySelector(".esc-lock"); if (b) { b.classList.remove("bad"); void b.offsetWidth; b.classList.add("bad"); } };
	const hintAt = {};   // rid -> { id, step, n }: how many hints you've asked for on this step
	function hint(rid) {
		const M = MISSIONS[rid];
		if (!running()) return;
		const si = M.steps.findIndex(s => !flag(rid, s.f)), s = M.steps[si];
		if (!s) return;
		let Hn = hintAt[rid];
		if (!Hn || Hn.id !== runId() || Hn.step !== si) Hn = hintAt[rid] = { id: runId(), step: si, n: 0 };
		const n = Math.min(Hn.n, s.h.length - 1);
		Hn.n++;
		openEsc(L("Hint", "İpucu"), `<div class="esc-clue"><p class="esc-p" style="color:var(--muted)">${L("Puzzle", "Bulmaca")} ${si + 1} / ${M.steps.length}: <b style="color:var(--text)">${TX(s.t)}</b></p><p class="esc-p">${TX(s.h[n])}</p>${n < s.h.length - 1 ? `<p class="esc-p" style="color:var(--muted);font-size:13px">${L("Still stuck? Ask again for a bigger hint.", "Hâlâ takıldın mı? Daha büyük bir ipucu için tekrar sor.")}</p>` : ""}</div>`, 420);
	}
	// the clue book: every room's clues the team has found (a tab per room), from anywhere in the house
	function showClues(rid) {
		const rooms = ROOMS.map(R => R.id).filter(id => found(id).length);
		if (!rid || !found(rid).length) rid = rooms[rooms.length - 1] || rid;
		const J = rid ? found(rid) : [];
		const tabs = rooms.length > 1 ? `<div class="esc-tabs">${rooms.map(id => `<button class="btn${id === rid ? " primary" : ""}" data-r="${id}">${ROOMS.findIndex(R => R.id === id) + 1}. ${nameOf(id)}</button>`).join("")}</div>` : "";
		const body = openEsc(L("Clues - ", "İpuçları - ") + (rid ? nameOf(rid) : L("Escape House", "Kaçış Evi")), tabs + (J.length ? `<div class="esc-j esc-clue">${J.map(e => `<h4>${e.title()}</h4>${e.html()}`).join("")}</div>` : `<p class="esc-p">${L("Nothing yet. Look at, read and search everything in the room (the little glowing diamonds show what you can use): every clue anyone on the team finds is kept here.", "Henüz bir şey yok. Odadaki her şeye bak, oku ve ara (parlayan küçük elmaslar kullanabileceğin şeyleri gösterir): ekipten birinin bulduğu her ipucu burada saklanır.")}</p>`), 560);
		body.querySelectorAll("[data-r]").forEach(b => b.onclick = () => showClues(b.dataset.r));
	}

	// ================================================================ textures and materials
	const rgb = (hex, f = 1) => { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, ((n >> 16) & 255) * f) | 0},${Math.min(255, ((n >> 8) & 255) * f) | 0},${Math.min(255, (n & 255) * f) | 0})`; };
	function planksTex(base, seed, rx, ry, vertical) {
		return canvasTex(512, 512, (c, w, h) => {
			const r = rng(seed);
			for (let i = 0; i < 8; i++) {
				c.fillStyle = rgb(base, 0.8 + r() * 0.35);
				if (vertical) c.fillRect(i * 64, 0, 64, h); else c.fillRect(0, i * 64, w, 64);
				c.fillStyle = "rgba(0,0,0,.4)";
				if (vertical) c.fillRect(i * 64 + 62, 0, 2, h); else { c.fillRect(0, i * 64 + 62, w, 2); c.fillRect((i * 173) % w, i * 64, 2, 64); }
			}
			for (let n = 0; n < 500; n++) { c.fillStyle = `rgba(0,0,0,${r() * 0.12})`; if (vertical) c.fillRect(r() * w, r() * h, 1, 30 + r() * 80); else c.fillRect(r() * w, r() * h, 30 + r() * 80, 1); }
		}, rx, ry);
	}
	function blocksTex(base, seed, rx, ry, cols = 4, rows = 8) {
		return canvasTex(512, 512, (c, w, h) => {
			const r = rng(seed), bw = w / cols, bh = h / rows;
			c.fillStyle = rgb(base, 0.55); c.fillRect(0, 0, w, h);
			for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) { c.fillStyle = rgb(base, 0.85 + r() * 0.25); c.fillRect(i * bw + (j % 2) * bw / 2 + 3, j * bh + 3, bw - 6, bh - 6); }
			for (let n = 0; n < 400; n++) { c.fillStyle = `rgba(0,0,0,${r() * 0.1})`; c.fillRect(r() * w, r() * h, 3, 3); }
		}, rx, ry);
	}
	const stripesTex = (a, b, n, rx, ry) => canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect(i * w / n, 0, w / n + 1, h); } }, rx, ry);
	const checkTex = (a, b, n, rx, ry) => canvasTex(256, 256, (c, w, h) => { const s = w / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { c.fillStyle = (i + j) % 2 ? b : a; c.fillRect(i * s, j * s, s, s); } }, rx, ry);
	const panelTex = (base, line, rx, ry) => canvasTex(256, 256, (c, w, h) => { c.fillStyle = base; c.fillRect(0, 0, w, h); c.strokeStyle = line; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = line; for (const [x, y] of [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]]) { c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); } }, rx, ry);
	const rugTex = (a, b, seed) => canvasTex(512, 384, (c, w, h) => {
		c.fillStyle = a; c.fillRect(0, 0, w, h);
		c.strokeStyle = b; c.lineWidth = 14; c.strokeRect(24, 24, w - 48, h - 48); c.lineWidth = 4; c.strokeRect(50, 50, w - 100, h - 100);
		c.fillStyle = b; const r = rng(seed);
		for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { c.save(); c.translate(90 + i * 66, 92 + j * 66); c.rotate(Math.PI / 4); c.globalAlpha = 0.35 + r() * 0.3; c.fillRect(-12, -12, 24, 24); c.restore(); }
	});
	// a picture that's redrawn when the language changes, a new run starts, or state() changes
	const liveTexes = [];
	function liveTex(w, h, draw, state) {
		const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
		const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
		const R = { cv, t, draw, state, key: null };
		liveTexes.push(R); paint(R);
		return t;
	}
	function paint(R) {
		const key = getLang() + "|" + (runId() || "") + "|" + (R.state ? R.state() : "");
		if (key === R.key) return;
		R.key = key;
		const c = R.cv.getContext("2d");
		c.clearRect(0, 0, R.cv.width, R.cv.height);
		R.draw(c, R.cv.width, R.cv.height);
		R.t.needsUpdate = true;
	}
	// a sign: text (a function, so it follows the language) on a transparent background
	const signM = (fn, o = {}) => new THREE.MeshBasicMaterial({ map: liveTex(o.w || 1024, o.h || 256, (c, w, h) => { if (o.bg) { c.fillStyle = o.bg; c.fillRect(0, 0, w, h); } fitText(c, w, h, fn(), o); }), transparent: true, depthWrite: false, toneMapped: false });
	const wallM = mat("#2b3542", 0.85);                 // the lobby's and the corridor's walls (the rooms cover theirs)
	const trimM = mat("#15121a", 0.6);
	const blackM = mat("#0d0b10", 0.6);
	const goldM = mat("#c9a24a", 0.35, 0.8);
	const steelM = mat("#8a9099", 0.35, 0.85);
	const darkWoodM = mat("#3e2716", 0.75);

	// ================================================================ floor, ceiling, walls
	add(g, new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat("#2a2830", 0.45, 0.1), 0, 0, 0, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
	k.ceilParts = [add(g, new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat("#18161d", 0.95), 0, H, 0, { rx: Math.PI / 2, cast: false })];
	k.camWall(X0 - 0.2, X1 + 0.2, Z0 - 0.2, Z1 + 0.2, H, H + 3.2);   // (the ceiling and the roof over it)
	function doorTrim(alongX, x, z, w, h) {
		const d = T + 0.06;
		for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(alongX ? 0.1 : d, h, alongX ? d : 0.1), trimM, alongX ? x + s * (w / 2 + 0.05) : x, h / 2, alongX ? z : z + s * (w / 2 + 0.05), { cast: false });
		add(g, new THREE.BoxGeometry(alongX ? w + 0.2 : d, 0.12, alongX ? d : w + 0.2), trimM, x, h + 0.06, z, { cast: false });
	}
	// a wall along x at z (holes: { u0, u1, y1 } doorways, in order): solid to walk into, and the camera stops at it
	function wallX(z, x0, x1, m, holes = []) {
		let u = x0;
		const seg = (a, b, y0, y1) => { if (b - a > 0.01 && y1 - y0 > 0.01) add(g, new THREE.BoxGeometry(b - a, y1 - y0, T), m, (a + b) / 2, (y0 + y1) / 2, z, { cast: false }); };
		const solid = (a, b) => { if (b - a > 0.01) { seg(a, b, 0, H); k.wall(a, b, z - T / 2, z + T / 2, 0, H); } };
		for (const hl of holes) { solid(u, hl.u0); seg(hl.u0, hl.u1, hl.y1, H); k.camWall(hl.u0, hl.u1, z - T / 2, z + T / 2, hl.y1, H); doorTrim(true, (hl.u0 + hl.u1) / 2, z, hl.u1 - hl.u0, hl.y1); u = hl.u1; }
		solid(u, x1);
	}
	function wallZ(x, z0, z1, m, holes = []) {
		let u = z0;
		const seg = (a, b, y0, y1) => { if (b - a > 0.01 && y1 - y0 > 0.01) add(g, new THREE.BoxGeometry(T, y1 - y0, b - a), m, x, (y0 + y1) / 2, (a + b) / 2, { cast: false }); };
		const solid = (a, b) => { if (b - a > 0.01) { seg(a, b, 0, H); k.wall(x - T / 2, x + T / 2, a, b, 0, H); } };
		for (const hl of holes) { solid(u, hl.u0); seg(hl.u0, hl.u1, hl.y1, H); k.camWall(x - T / 2, x + T / 2, hl.u0, hl.u1, hl.y1, H); doorTrim(false, x, (hl.u0 + hl.u1) / 2, hl.u1 - hl.u0, hl.y1); u = hl.u1; }
		solid(u, z1);
	}
	const hole = c => ({ u0: c - DW, u1: c + DW, y1: DOOR_H });
	// the outside walls (the front door in the east one)
	wallX(Z1 + T / 2, X0 - T, X1 + T, wallM);
	wallX(Z0 - T / 2, X0 - T, X1 + T, wallM);
	wallZ(X0 - T / 2, Z0, Z1, wallM);
	wallZ(X1 + T / 2, Z0, Z1, wallM, [{ u0: DOOR.z0, u1: DOOR.z1, y1: DOOR.h }]);
	// the corridor's walls (room 1's way in, room 3's way out to the passage, room 4's way in, room 6's way out),
	// the walls between the rooms (with the doors from one into the next), the passage's seal, the lobby's west wall
	wallX(CZ, X0, LX, wallM, [hole(-12.715), hole(4.665)]);
	wallX(-CZ, X0, LX, wallM, [hole(-12.715), hole(4.665)]);
	wallZ(0.33, CZ, Z1, wallM, [hole(3.2)]);
	wallZ(0.33, Z0, -CZ, wallM, [hole(-3.2)]);
	wallZ(SEAL, Z0, Z1, wallM, [hole(-3.2), hole(3.2)]);
	wallZ(LX, CZ, Z1, wallM); wallZ(LX, Z0, -CZ, wallM);

	// ================================================================ the lights
	const lobbyL = k.light(13, 3.1, 0, "#ffd9b0", 4.5, 13);
	k.key.pos.copy(k.V(0, H - 0.15, 0)); k.key.target.copy(k.V(0, 0, 0));
	k.key.color.set("#d8e2ff"); k.key.intensity = 14; k.key.angle = 1.35; k.key.penumbra = 0.8; k.key.distance = 20;
	k.fill.pos.copy(k.V(-6, 2.6, 0)); k.fill.color.set("#c8d4ff"); k.fill.intensity = 4; k.fill.distance = 26;
	k.hemi = 0.4; k.env = 0.28; k.exposure = 1.02;

	// ================================================================ the doors
	// (the way in never locks: leave whenever you like and come back to carry on where the team got to)
	const doorOpen = i => { const D = DOORS[i]; return D.after < 0 ? true : solved() > D.after; };
	const onFrom = D => { const m = me(), lx = m.x - OX, lz = m.z - OZ; return Math.sign((D.w === "x" ? lz : lx) - D.p) === D.f; };
	const exitDoor = ri => DOORS.findIndex((D, i) => D.after === ri && i !== 4);
	const standOf = (D, side, d = 0.85) => D.w === "x" ? [D.c, D.p + side * d] : [D.p + side * d, D.c];
	const doorFx = [];
	DOORS.forEach((D, i) => {
		const ax = D.w === "x", piv = group(g, ax ? D.c - DW : D.p, 0, ax ? D.p : D.c - DW);
		const leafGeo = ax ? rbox(DW * 2 - 0.04, DOOR_H - 0.04, 0.06, 0.015) : rbox(0.06, DOOR_H - 0.04, DW * 2 - 0.04, 0.015);
		const to = D.after + 1, M = to < ROOMS.length ? MISSIONS[ROOMS[to].id] : null;
		add(piv, leafGeo, mat(i === 5 ? "#8a929a" : "#24202c", 0.5, i === 5 ? 0.7 : 0), ax ? DW : 0, DOOR_H / 2, ax ? 0 : DW);
		add(piv, ax ? new THREE.BoxGeometry(DW * 2 - 0.3, 0.06, 0.07) : new THREE.BoxGeometry(0.07, 0.06, DW * 2 - 0.3), glow(M ? M.color : "#5dff8a"), ax ? DW : 0, 1.75, ax ? 0 : DW, { cast: false });
		for (const sd of [-1, 1]) add(piv, new THREE.SphereGeometry(0.035, 10, 8), goldM, ax ? DW * 2 - 0.15 : sd * 0.05, 1.05, ax ? sd * 0.05 : DW * 2 - 0.15, { cast: false });
		// over the door, on the side you come from: where it leads, and a lamp (red: locked, green: open)
		const f = D.f, off = T / 2 + 0.015, ry = ax ? (f > 0 ? 0 : Math.PI) : (f > 0 ? Math.PI / 2 : -Math.PI / 2);
		const sp = ax ? [D.c, D.p + f * off] : [D.p + f * off, D.c];
		const line1 = () => M ? (to + 1) + " · " + nameOf(ROOMS[to].id) : L("EXIT", "ÇIKIŞ");
		const line2 = () => i === 0 ? L("START HERE", "BURADAN BAŞLA") : M ? L(`Room ${to + 1} of 6`, `6 odadan ${to + 1}.`) : L("The way out!", "Dışarı çıkış!");
		add(g, new THREE.PlaneGeometry(2.3, 0.46), signM(line1, { color: "#ffffff", glow: M ? M.color : "#5dff8a", size: 92 }), sp[0], 3.02, sp[1], { ry, cast: false, receive: false });
		add(g, new THREE.PlaneGeometry(1.6, 0.26), signM(line2, { color: "#ffd36b", w: 1024, h: 160, size: 80, weight: 800 }), sp[0], 2.66, sp[1], { ry, cast: false, receive: false });
		const lampM = glow("#ff3a3a");
		const lp = ax ? [D.c + 1.3, D.p + f * (off + 0.05)] : [D.p + f * (off + 0.05), D.c + 1.3];
		add(g, new THREE.SphereGeometry(0.07, 14, 10), lampM, lp[0], 3.02, lp[1], { cast: false });
		// (the corridor side of the way out says so too)
		if (i === 7) add(g, new THREE.PlaneGeometry(2.3, 0.46), signM(() => L("FINISH", "BİTİŞ"), { color: "#ffffff", glow: "#5dff8a", size: 110 }), D.c, 3.02, D.p + off, { cast: false, receive: false });
		k.camWall(ax ? D.c - DW : D.p - T / 2, ax ? D.c + DW : D.p + T / 2, ax ? D.p - T / 2 : D.c - DW, ax ? D.p + T / 2 : D.c + DW, 0, DOOR_H).on = () => !doorOpen(i);
		k.interact("esc:door" + i, { stands: [standOf(D, f), standOf(D, -f)], stand: standOf(D, f), nearest: true, reach: 2.6, label: () => doorLabel(i), use: () => doorUse(i) }, piv);
		doorFx.push({ piv, lampM, k: doorOpen(i) ? 1 : 0, sw: -f, ax });
	});
	function doorLabel(i) {
		const D = DOORS[i], open = doorOpen(i), from = onFrom(D), s = st();
		if (i === 0) {
			if (running()) return from ? L(`Rejoin the mission (room ${current() + 1} of 6)`, `Göreve geri dön (6 odadan ${current() + 1}.)`) : L("Step out to the corridor (progress is kept)", "Koridora çık (ilerleme saklanır)");
			if (from) return L("Go into room 1", "1. odaya gir");
			return won() ? L("Play again: start a new mission", "Tekrar oyna: yeni görev başlat") : L("Start the mission", "Görevi başlat");
		}
		const to = D.after + 1;
		if (open) return from ? (to < ROOMS.length ? L("Go through to ", "Geç: ") + nameOf(ROOMS[to].id) : L("Walk out", "Dışarı çık")) : L("Go back", "Geri dön");
		if (!from) return L("Locked", "Kilitli");
		const fr = FR[ROOMS[D.after].id];
		if (running() && fr.door && i === exitDoor(D.after)) return fr.door.label();
		return L("Locked: solve this room to open it", "Kilitli: açmak için bu odayı çöz");
	}
	function doorUse(i) {
		const D = DOORS[i], from = onFrom(D);
		if (i === 0) {
			if (running()) {
				if (!from) { const p = standOf(D, D.f, 1.2); ctx.walkTo(p[0] + OX, p[1] + OZ); return; }
				const sv = solved();
				goOn();
				ctx.toast(L(`<b>Welcome back!</b> Nothing was lost: ${sv} of 6 rooms solved, and their doors are open. Carry on in room ${current() + 1}, ${nameOf(ROOMS[current()].id)}.`, `<b>Tekrar hoş geldin!</b> Hiçbir şey kaybolmadı: 6 odadan ${sv} tanesi çözüldü ve kapıları açık. ${current() + 1}. odada (${nameOf(ROOMS[current()].id)}) devam et.`), null, null, 8000);
				return;
			}
			if (from) {
				const p = FR.study.P(0, 2.6);
				ctx.walkTo(p[0] + OX, p[1] + OZ);
				ctx.toast(L("<b>Room 1: the Detective's Study.</b> Gather your team in here, then press <b>Start mission</b> on the panel. Solve each room to open the next one: six rooms, one way out.", "<b>1. oda: Dedektifin Odası.</b> Ekibini buraya topla, sonra paneldeki <b>Görevi başlat</b>'a bas. Sıradakini açmak için her odayı çöz: altı oda, tek çıkış."), null, null, 10000);
				return;
			}
			start();
			return;
		}
		if (doorOpen(i)) { const p = standOf(D, from ? -D.f : D.f, 1.2); ctx.walkTo(p[0] + OX, p[1] + OZ); return; }
		if (!from) { ctx.toast(L("Locked from the other side.", "Diğer taraftan kilitli.")); return; }
		if (!running()) { notStarted(); return; }
		const fr = FR[ROOMS[D.after].id];
		if (fr.door && i === exitDoor(D.after)) fr.door.use();
		else ctx.toast(L("The door won't budge. Solve the room to open it! (Stuck? Press <b>G</b> for a hint.)", "Kapı yerinden oynamıyor. Açmak için odayı çöz! (Takıldın mı? İpucu için <b>G</b>'ye bas.)"));
	}

	// ================================================================ small furniture (shared builders)
	function bookshelf(parent, w, hgt, seed, wood) {
		const r = rng(seed);
		add(parent, new THREE.BoxGeometry(w, hgt, 0.03), wood, 0, hgt / 2, -0.17);
		for (const sx of [-1, 1]) add(parent, new THREE.BoxGeometry(0.04, hgt, 0.36), wood, sx * (w / 2 - 0.02), hgt / 2, 0);
		const n = 4, step = (hgt - 0.1) / n, books = [];
		for (let s = 0; s <= n; s++) add(parent, new THREE.BoxGeometry(w, 0.03, 0.36), wood, 0, 0.05 + s * step, 0, { cast: false });
		for (let s = 0; s < n; s++) { let x = -w / 2 + 0.07; while (x < w / 2 - 0.12) { const bw = 0.035 + r() * 0.04, bh = 0.12 + r() * Math.max(0.02, Math.min(0.16, step - 0.2)); books.push([x + bw / 2, 0.065 + s * step + bh / 2, bw, bh, r() * BOOK_COLS.length | 0]); x += bw + 0.004; } }
		const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.24), mat("#ffffff", 0.8), books.length);
		const col = new THREE.Color();
		books.forEach((b, i) => { _d.position.set(b[0], b[1], 0.02); _d.rotation.set(0, 0, 0); _d.scale.set(b[2], b[3], 1); _d.updateMatrix(); im.setMatrixAt(i, _d.matrix); im.setColorAt(i, col.set(BOOK_COLS[b[4]])); });
		im.castShadow = false;
		parent.add(im);
	}
	function floorLamp(parent, x, z, color) {
		add(parent, new THREE.CylinderGeometry(0.14, 0.16, 0.04, 16), blackM, x, 0.02, z);
		add(parent, new THREE.CylinderGeometry(0.015, 0.015, 1.55, 8), blackM, x, 0.8, z, { cast: false });
		add(parent, new THREE.CylinderGeometry(0.14, 0.24, 0.3, 18, 1, true), new THREE.MeshStandardMaterial({ color: "#efe2c4", emissive: color, emissiveIntensity: 0.7, side: THREE.DoubleSide }), x, 1.62, z, { cast: false });
	}
	// a cupboard with an open front (its doors are added on their own, so you can see inside once they swing open):
	// the floor at y 0, the front at z d / 2, a shelf at each height in shelves
	function shell(parent, w, h, d, m, shelves = []) {
		const t = 0.03;
		add(parent, new THREE.BoxGeometry(w, h, t), m, 0, h / 2, -d / 2 + t / 2);
		for (const sx of [-1, 1]) add(parent, new THREE.BoxGeometry(t, h, d), m, sx * (w / 2 - t / 2), h / 2, 0);
		for (const y of [t / 2, h - t / 2].concat(shelves)) add(parent, new THREE.BoxGeometry(w - 2 * t, t, d - t), m, 0, y, t / 2, { cast: false });
		// (a dim inside, so it doesn't look like a solid block)
		add(parent, new THREE.PlaneGeometry(w - 2 * t, h - 2 * t), mat("#141018", 0.95), 0, h / 2, -d / 2 + t + 0.002, { cast: false });
	}
	// a little stack of boxes / books / jars on a shelf: [x, w, h, d, colour]
	function stuff(parent, y, z, list) { for (const [x, w, h, d, c] of list) add(parent, rbox(w, h, d, Math.min(w, h, d) * 0.12), mat(c, 0.75), x, y + h / 2, z, { cast: false }); }
	function plant(parent, x, z, s = 1) {
		add(parent, new THREE.CylinderGeometry(0.2 * s, 0.15 * s, 0.4 * s, 14), mat("#e8e2d8", 0.6), x, 0.2 * s, z);
		for (let i = 0; i < 5; i++) add(parent, new THREE.SphereGeometry((0.22 + i * 0.02) * s, 10, 8), mat(i % 2 ? "#3a7a3a" : "#2f6a34", 0.8), x + Math.sin(i * 2.4) * 0.12 * s, (0.6 + i * 0.12) * s, z + Math.cos(i * 2.4) * 0.12 * s);
	}
	// a framed picture on a wall (room frame): the plane faces into the room
	function framed(G, tex, w, h, x, y, z, ry, frameM) {
		add(G, new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.04), frameM || darkWoodM, x, y, z, { ry, cast: false });
		const n = [Math.sin(ry) * 0.025, Math.cos(ry) * 0.025];
		return add(G, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), x + n[0], y, z + n[1], { ry, cast: false });
	}

	// ================================================================ the rooms
	const FR = {}, BUILD = {};
	function makeRoom(R, ri) {
		const C = COLS[R.col], s = R.north ? -1 : 1, cz = -s * RZ, rid = R.id, M = MISSIONS[rid];
		const G = group(g, C.cx, 0, cz, R.north ? Math.PI : 0);
		// the room's own frame: x across (±hw), z from the back wall (-RD) to the front, the corridor side (+RD)
		const Pt = (lx, lz) => [C.cx + s * lx, cz + s * lz];
		const fr = {
			rid, ri, M, g: G, hw: C.hw, P: Pt, solids: [], its: [],
			p: () => P(rid), flag: f => flag(rid, f), set: (f, v) => setFlag(rid, f, v), solve: () => solveRoom(rid),
			clue: (key, title, html, w) => defClue(rid, key, title, html, w),
			box(x0, x1, z0, z1) { const a = Pt(x0, z0), b = Pt(x1, z1); k.box(Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])); },
			// a box (room frame) that's solid only while on() says so
			solid(x0, x1, z0, z1, on) { const a = Pt(x0, z0), b = Pt(x1, z1); fr.solids.push({ r: [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])], on }); },
			// something to use (stand / at: room frame). Nothing works until the mission's on (always: it does)
			it(name, def, ...objs) {
				const lab = def.label, use = def.use;
				const d = {
					label: () => typeof lab === "function" ? lab() : TX(lab),
					use: () => { if (!def.always && !running()) { notStarted(); return; } used.add(runId() + ":" + rid + ":" + name); use(); },
					reach: def.reach || 2.6,
					stand: Pt(def.stand[0], def.stand[1])
				};
				if (def.at) { const a = Pt(def.at[0], def.at[1]); d.face = Math.atan2(a[0] - d.stand[0], a[1] - d.stand[1]); }
				fr.its.push({ name, d, objs });
				return k.interact("esc:" + rid + ":" + name, d, ...objs);
			},
			// the floor and the wall faces (inside the room's walls, with holes where its doors are)
			skin(floorM, faceM) {
				const w = C.hw * 2, d = RD * 2, hw = C.hw;
				add(G, new THREE.PlaneGeometry(w, d), floorM, 0, 0.01, 0, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
				const f = (x, z, ww, hh, y, ry) => { if (ww > 0.01) add(G, new THREE.PlaneGeometry(ww, hh), faceM, x, y, z, { ry, cast: false }); };
				// a wall face from a to b along it (u), with a doorway at u = c (or none)
				const face = (a, b, c, put) => {
					if (c === null) { put((a + b) / 2, b - a, H, H / 2); return; }
					put((a + c - DW) / 2, c - DW - a, H, H / 2); put((c + DW + b) / 2, b - c - DW, H, H / 2); put(c, DW * 2, H - DOOR_H, (H + DOOR_H) / 2);
				};
				f(0, -RD + 0.012, w, H, H / 2, 0);
				face(-RD, RD, R.doors.includes("left") ? SIDE_Z : null, (u, ww, hh, y) => f(-hw + 0.012, u, ww, hh, y, Math.PI / 2));
				face(-RD, RD, R.doors.includes("right") ? SIDE_Z : null, (u, ww, hh, y) => f(hw - 0.012, u, ww, hh, y, -Math.PI / 2));
				face(-hw, hw, R.doors.includes("front") ? 0 : null, (u, ww, hh, y) => f(u, RD - 0.012, ww, hh, y, Math.PI));
				add(G, new THREE.BoxGeometry(w, 0.1, 0.03), trimM, 0, 0.05, -RD + 0.03, { cast: false });
			},
			L: k.light(C.cx, 3.0, cz, M.light, 4.2, 10.5),
			door: null, anim: null
		};
		BUILD[rid](fr);
		// a little glowing diamond over everything you can use (dimmer once you've tried it), and where each thing is
		// (its footprint on the floor, so E works from anywhere close to it, not just one spot)
		g.updateMatrixWorld(true);
		const b = new THREE.Box3(), v = new THREE.Vector3();
		fr.its.forEach((it, i) => {
			b.makeEmpty(); it.objs.forEach(o => b.expandByObject(o));
			if (b.isEmpty()) return;
			const a = g.worldToLocal(v.copy(b.min)).clone(), c = g.worldToLocal(v.copy(b.max));
			it.foot = [Math.min(a.x, c.x), Math.max(a.x, c.x), Math.min(a.z, c.z), Math.max(a.z, c.z)];   // (zone coordinates)
			const top = G.worldToLocal(v.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2)).clone();
			const mk = add(G, new THREE.OctahedronGeometry(0.07), glow(M.color, { transparent: true, opacity: 0.9, depthWrite: false }), top.x, 0, top.z, { cast: false, receive: false });
			mk.raycast = () => {};
			mk.visible = false;
			it.mk = mk; it.y = Math.min(H - 0.3, top.y + 0.28); it.ph = i * 0.9;
		});
		return fr;
	}
	const used = new Set();   // run:room:thing - what you've tried already (its marker dims)
	function markers(fr, t) {
		const show = running() && myRoom() === fr.rid && solved() <= fr.ri;
		for (const it of fr.its) {
			if (!it.mk) continue;
			it.mk.visible = show;
			if (!show) continue;
			const tried = used.has(runId() + ":" + fr.rid + ":" + it.name);
			it.mk.position.y = it.y + Math.sin(t * 2.4 + it.ph) * 0.05;
			it.mk.rotation.y = t * 1.6 + it.ph;
			it.mk.scale.setScalar(tried ? 0.6 : 1);
			it.mk.material.opacity = tried ? 0.35 : 0.65 + 0.3 * Math.sin(t * 3 + it.ph);
		}
	}
	// the thing in your room closest to you (within reach of its footprint): what E does, if nothing else is closer
	function nearestThing() {
		const rid = myRoom(), m = me(), x = m.x - OX, z = m.z - OZ;
		if (!rid) return null;
		let best = null, bd = 1.15;
		for (const it of FR[rid].its) {
			if (!it.foot) continue;
			const f = it.foot, dx = Math.max(f[0] - x, 0, x - f[1]), dz = Math.max(f[2] - z, 0, z - f[3]), dd = Math.hypot(dx, dz);
			if (dd < bd) { bd = dd; best = it; }
		}
		return best;
	}

	// ---------------------------------------------------------------- 1. the Detective's Study (in: front, out: right)
	BUILD.study = fr => {
		const { g: G, hw, rid } = fr;
		fr.skin(mat("#ffffff", 0.7, 0, { map: planksTex("#6a4426", 31, 3, 3) }), mat("#ffffff", 0.9, 0, { map: stripesTex("#1f3a2c", "#264636", 14, 3, 1) }));
		const woodM = mat("#4a2c18", 0.55);
		add(G, new THREE.PlaneGeometry(3.4, 2.4), mat("#ffffff", 0.95, 0, { map: rugTex("#6a1a22", "#c9a24a", 77) }), 0, 0.022, -0.2, { rx: -Math.PI / 2, cast: false });
		floorLamp(G, -3.6, -3.9, "#ffd79a");
		{
			const ch = group(G, -3.3, 0, 3.6, 2.6), red = mat("#5a1f1f", 0.85);
			add(ch, rbox(0.8, 0.45, 0.75, 0.1), red, 0, 0.3, 0); add(ch, rbox(0.8, 0.85, 0.2, 0.08), red, 0, 0.8, -0.3);
			for (const sx of [-0.36, 0.36]) add(ch, rbox(0.14, 0.35, 0.75, 0.05), red, sx, 0.6, 0);
			fr.box(-3.85, -2.75, 3.05, 4.15);
		}
		// the desk (its drawer slides out), the case file, a typewriter, a banker's lamp
		const desk = group(G, 0, 0, -3.2);
		add(desk, rbox(2.1, 0.07, 0.9, 0.02), woodM, 0, 0.78, 0);
		for (const sx of [-0.75, 0.75]) add(desk, rbox(0.52, 0.74, 0.84, 0.02), woodM, sx, 0.37, 0);
		const drawer = group(desk, 0, 0.64, 0), drM = mat("#5a3620", 0.6);
		// (hollow: old papers, a photo and a pencil inside)
		add(drawer, new THREE.BoxGeometry(0.92, 0.02, 0.8), drM, 0, -0.08, 0);
		for (const z of [-0.39, 0.39]) add(drawer, new THREE.BoxGeometry(0.92, 0.18, 0.02), drM, 0, 0, z);
		for (const x of [-0.45, 0.45]) add(drawer, new THREE.BoxGeometry(0.02, 0.18, 0.76), drM, x, 0, 0, { cast: false });
		add(drawer, new THREE.PlaneGeometry(0.3, 0.22), mat("#efe6cf", 0.9), -0.15, -0.068, 0.1, { rx: -Math.PI / 2, rz: 0.15, cast: false });
		add(drawer, new THREE.PlaneGeometry(0.28, 0.2), mat("#e4d8b8", 0.9), -0.1, -0.066, -0.15, { rx: -Math.PI / 2, rz: -0.2, cast: false });
		add(drawer, new THREE.PlaneGeometry(0.12, 0.09), mat("#8a7454", 0.6), 0.22, -0.066, 0.12, { rx: -Math.PI / 2, rz: 0.3, cast: false });
		add(drawer, new THREE.CylinderGeometry(0.007, 0.007, 0.18, 6), mat("#e8b830", 0.6), 0.2, -0.062, -0.12, { rz: Math.PI / 2, ry: 0.5, cast: false });
		add(drawer, new THREE.BoxGeometry(0.16, 0.03, 0.03), goldM, 0, 0, 0.415, { cast: false });
		add(drawer, new THREE.BoxGeometry(0.1, 0.06, 0.02), mat("#1a1a1a", 0.4, 0.6), 0.3, 0, 0.41, { cast: false });
		const file = add(desk, rbox(0.36, 0.025, 0.26, 0.008), mat("#c8a46a", 0.8), -0.55, 0.83, 0.12, { cast: false }); file.rotation.y = 0.2;
		{ const tw = group(desk, 0.4, 0.82, -0.1); add(tw, rbox(0.44, 0.13, 0.32, 0.03), mat("#1d1d22", 0.4, 0.4), 0, 0.065, 0); add(tw, new THREE.PlaneGeometry(0.26, 0.22), mat("#f4efe2", 0.9), 0, 0.22, -0.1, { rx: -0.2, cast: false }); }
		add(desk, new THREE.CylinderGeometry(0.06, 0.06, 0.32, 14, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: "#1f6a3a", emissive: "#2a8a4a", emissiveIntensity: 0.6, roughness: 0.3 }), 0.85, 1.14, -0.25, { rz: Math.PI / 2, cast: false });
		add(desk, new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), goldM, 0.85, 0.98, -0.28, { cast: false });
		fr.box(-1.1, 1.1, -RD, -2.7);
		// the wall clock (stopped: its hands show this run's time)
		const clockG = group(G, -hw + 0.04, 2.05, -1.0, Math.PI / 2);
		add(clockG, new THREE.CylinderGeometry(0.37, 0.37, 0.06, 32), woodM, 0, 0, 0, { rx: Math.PI / 2 });
		add(clockG, new THREE.CircleGeometry(0.33, 32), mat("#ffffff", 0.8, 0, { map: canvasTex(256, 256, (c, w, h) => drawClock(c, w, h)) }), 0, 0, 0.032, { cast: false });
		const hHand = group(clockG, 0, 0, 0.04), mHand = group(clockG, 0, 0, 0.046);
		add(hHand, new THREE.BoxGeometry(0.03, 0.15, 0.008), blackM, 0, 0.065, 0, { cast: false });
		add(mHand, new THREE.BoxGeometry(0.02, 0.24, 0.008), blackM, 0, 0.11, 0, { cast: false });
		// the bookshelf (left), the cabinet (right, locked), the evidence board (right)
		const shelfG = group(G, -hw + 0.2, 0, 1.0, Math.PI / 2);
		bookshelf(shelfG, 1.6, 2.2, 61, woodM); fr.box(-hw, -hw + 0.42, 0.15, 1.85);
		const cab = group(G, hw - 0.25, 0, -1.3, -Math.PI / 2), cabDoors = [];
		// (inside: the detective's archive boxes, a fedora, a camera, a fingerprint kit, a trench coat on a hook)
		shell(cab, 1.0, 1.9, 0.46, woodM, [0.62, 1.25]);
		stuff(cab, 0.03, 0, [[-0.28, 0.3, 0.24, 0.32, "#b8925a"], [0.06, 0.3, 0.24, 0.32, "#a8824a"], [0.32, 0.16, 0.36, 0.3, "#3a2a1a"]]);
		stuff(cab, 0.635, 0, [[-0.3, 0.22, 0.12, 0.26, "#1a1a1e"], [-0.3, 0.2, 0.06, 0.24, "#2a2a30"], [0.0, 0.08, 0.3, 0.2, "#6a1a1a"], [0.09, 0.07, 0.26, 0.2, "#1a4a2a"], [0.17, 0.08, 0.28, 0.2, "#2a2a6a"]]);
		add(cab, rbox(0.16, 0.1, 0.08, 0.02), mat("#1a1a1a", 0.4, 0.5), 0.34, 0.72, 0.02, { cast: false });
		add(cab, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), mat("#3a3a40", 0.2, 0.8), 0.34, 0.72, 0.075, { rx: Math.PI / 2, cast: false });
		{
			const hat = mat("#4a3c2c", 0.8);
			add(cab, new THREE.CylinderGeometry(0.19, 0.19, 0.012, 22), hat, -0.2, 1.272, 0, { cast: false });
			add(cab, new THREE.CylinderGeometry(0.1, 0.115, 0.12, 18), hat, -0.2, 1.34, 0, { cast: false });
			add(cab, new THREE.CylinderGeometry(0.117, 0.117, 0.03, 18), mat("#1a1a1a", 0.7), -0.2, 1.3, 0, { cast: false });
			add(cab, new THREE.CylinderGeometry(0.17, 0.24, 0.58, 14, 1, true), mat("#a8925e", 0.85, 0, { side: THREE.DoubleSide }), 0.22, 1.56, -0.04, { cast: false });
			add(cab, new THREE.SphereGeometry(0.02, 8, 6), goldM, 0.22, 1.86, -0.18, { cast: false });
		}
		for (const sd of [-1, 1]) {
			const pv = group(cab, sd * 0.48, 0, 0.235);
			add(pv, rbox(0.47, 1.78, 0.03, 0.01), mat("#5a3620", 0.6), -sd * 0.235, 0.95, 0.015);
			add(pv, new THREE.SphereGeometry(0.025, 8, 6), goldM, -sd * 0.42, 1.0, 0.04, { cast: false });
			cabDoors.push({ pv, sd });
		}
		fr.box(hw - 0.5, hw, -1.85, -0.75);
		const evT = liveTex(640, 448, (c, w, h) => drawEvidence(c, w, h, fr.p(), false));
		const board = framed(G, evT, 1.4, 0.98, hw - 0.03, 1.6, 1.0, -Math.PI / 2);
		// the hidden message over the desk (invisible ink: it only shows once the UV torch has found it)
		const uvT = liveTex(512, 160, (c, w, h) => drawUV(c, w, h, fr.p()));
		const uvMsg = add(G, new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: uvT, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), 0, 2.15, -RD + 0.03, { cast: false, receive: false });
		// (where it is: a smudged, faded patch of wallpaper you can see, and use, from the start)
		const patch = add(G, new THREE.PlaneGeometry(1.8, 0.62), mat("#ffffff", 0.95, 0, { map: canvasTex(256, 96, (c, w, h) => { c.fillStyle = "#33503f"; c.fillRect(0, 0, w, h); const r = rng(5); for (let n = 0; n < 60; n++) { c.fillStyle = `rgba(230,220,190,${r() * 0.12})`; c.beginPath(); c.arc(r() * w, r() * h, 4 + r() * 14, 0, TAU); c.fill(); } }) }), 0, 2.15, -RD + 0.02, { cast: false });
		// the keypad by the way out
		const pad = add(G, rbox(0.18, 0.26, 0.04, 0.01), mat("#2a2a30", 0.4, 0.6), hw - 0.03, 1.35, SIDE_Z + 1.0, { ry: -Math.PI / 2, cast: false });
		add(G, new THREE.PlaneGeometry(0.12, 0.05), glow("#6dff9a"), hw - 0.055, 1.43, SIDE_Z + 1.0, { ry: -Math.PI / 2, cast: false });

		const p = () => fr.p();
		fr.clue("file", () => L("Case file", "Dava dosyası"), () => `<div class="paper">${L(`Case #47: The Stopped Clock.<br><br>The culprit struck at the very moment the wall clock stopped. My notes are locked in the desk drawer: <b>the real time of the crime, hours then minutes</b> (4 digits).<br><br>Careful: that old clock always ran <b>${p().fast} minutes fast</b>.<br><br>And if anything happens to me... look where I work, in a different light.<br>- D.`, `Dosya #47: Duran Saat.<br><br>Suçlu, duvar saatinin durduğu anda harekete geçti. Notlarım masanın çekmecesinde kilitli: <b>suçun gerçek saati, önce saat sonra dakika</b> (4 rakam).<br><br>Dikkat: o eski saat hep <b>${p().fast} dakika ileri</b> giderdi.<br><br>Bana bir şey olursa... çalıştığım yere bak, başka bir ışıkla.<br>- D.`)}</div>`);
		fr.clue("clock", () => L("The wall clock", "Duvar saati"), () => `${img(400, 400, (c, w, h) => drawClock(c, w, h, p().sh, p().sm), "max-width:300px;margin:0 auto 10px")}<p class="esc-p">${L("The old clock has stopped. Its hands haven't moved since that night.", "Eski saat durmuş. Akrep ve yelkovan o geceden beri kıpırdamamış.")}</p>`, 380);
		fr.clue("uv", () => L("Under UV light", "UV ışık altında"), () => `${img(512, 160, (c, w, h) => drawUV(c, w, h, p(), true))}<p class="esc-p">${L("Four glowing symbols appear on the wall above the desk, one after another.", "Masanın üstündeki duvarda yan yana dört parlayan sembol beliriyor.")}</p>`, 460);
		fr.clue("board", () => L("Evidence board", "Delil panosu"), () => { const close = !!fr.flag("cab"); return `${img(640, 448, (c, w, h) => drawEvidence(c, w, h, p(), close))}<p class="esc-p">${close ? L("Through the magnifying glass you can read a tiny number next to each suspect.", "Büyüteçle her şüphelinin yanındaki minicik sayıyı okuyabiliyorsun.") : L("Four suspects, each pinned with a symbol. Something tiny is written by each photo, far too small to read.", "Dört şüpheli, her biri bir sembolle iğnelenmiş. Her fotoğrafın yanında okunamayacak kadar küçük bir şey yazıyor.")}</p><div class="paper">${L("Note to self: I hide my secrets where I work, but only the right light shows them.", "Kendime not: Sırlarımı çalıştığım yere saklarım, ama onları sadece doğru ışık gösterir.")}</div>`; }, 540);
		fr.it("file", { stand: [-0.9, -2.15], at: [-0.55, -3.1], label: ["Read the case file", "Dava dosyasını oku"], use: () => clue(rid, "file") }, file);
		fr.it("drawer", {
			stand: [0.55, -2.15], at: [0, -3.2], label: () => fr.flag("drawer") ? L("The drawer (empty now)", "Çekmece (artık boş)") : L("Try the locked desk drawer", "Kilitli çekmeceyi dene"),
			use: () => {
				if (fr.flag("drawer")) { ctx.toast(L("Just an old pencil left in there.", "İçinde sadece eski bir kurşun kalem kaldı.")); return; }
				lockUI({ title: L("Desk drawer", "Masa çekmecesi"), text: L("A heavy drawer with a <b>4-digit</b> combination lock.", "<b>4 haneli</b> şifreli kilidi olan ağır bir çekmece."), kind: "digits", len: 4, check: v => v.join("") === pad2(p().rh) + pad2(p().rm), ok: () => { fr.set("drawer"); ctx.sfx("clack", 0.6); ctx.toast(L("Click! The drawer slides open. Inside: a <b>brass key</b>.", "Klik! Çekmece açıldı. İçinde: <b>pirinç bir anahtar</b>.")); } });
			}
		}, drawer);
		fr.it("clock", { stand: [-hw + 1.0, -1.0], at: [-hw, -1.0], label: ["Look at the wall clock", "Duvar saatine bak"], use: () => clue(rid, "clock") }, clockG);
		let shelfN = 0;
		fr.it("books", { stand: [-hw + 1.0, 1.0], at: [-hw, 1.0], always: true, label: ["Browse the bookshelf", "Kitaplığa göz at"], use: () => { const n = shelfN++ % 2; openEsc(L("The bookshelf", "Kitaplık"), `<p class="esc-p">${n ? L("A book falls open at a page on invisible ink: <i>'Lemon juice... or a UV pen. Only ultraviolet light will show it.'</i>", "Bir kitap görünmez mürekkep sayfasında açılıyor: <i>'Limon suyu... ya da UV kalem. Onu sadece morötesi ışık gösterir.'</i>") : L("'The Hound of the Basketballs', 'Murder on the Disoriented Express'... nothing hidden behind them.", "'Basketbolların Köpeği', 'Şaşkın Ekspreste Cinayet'... arkalarında hiçbir şey yok.")}</p>`, 420); } }, shelfG);
		fr.it("cab", {
			stand: [hw - 1.1, -1.3], at: [hw, -1.3], label: () => fr.flag("cab") ? L("The cabinet (open)", "Dolap (açık)") : fr.flag("drawer") ? L("Unlock the cabinet with the brass key", "Dolabı pirinç anahtarla aç") : L("A locked cabinet", "Kilitli bir dolap"),
			use: () => {
				if (fr.flag("cab")) { ctx.toast(L("The cabinet is empty now.", "Dolap artık boş.")); return; }
				if (!fr.flag("drawer")) { ctx.toast(L("Locked. There's a little brass keyhole in the door.", "Kilitli. Kapağında küçük, pirinç bir anahtar deliği var.")); return; }
				fr.set("cab"); ctx.sfx("door", 0.5); ctx.toast(L("The brass key turns... Inside: a <b>UV torch</b> and a <b>magnifying glass</b>!", "Pirinç anahtar döndü... İçinde: bir <b>UV el feneri</b> ve bir <b>büyüteç</b>!"));
			}
		}, cab);
		fr.it("uv", {
			stand: [1.75, -3.6], at: [0, -RD], label: () => fr.flag("cab") ? L("Shine the UV torch over the desk", "UV feneri masanın üstüne tut") : L("A patch of faded wallpaper", "Solmuş bir duvar kâğıdı parçası"),
			use: () => {
				if (!fr.flag("cab")) { ctx.toast(L("Just faded wallpaper... though it's oddly smudged, as if someone wrote on it.", "Sadece solmuş duvar kâğıdı... ama tuhaf biçimde lekeli, sanki biri üstüne bir şey yazmış.")); return; }
				if (!fr.flag("uv")) fr.set("uv");
				ctx.sfx("wink", 0.6);
				clue(rid, "uv");
			}
		}, patch, uvMsg);
		fr.it("board", {
			stand: [hw - 1.0, 1.0], at: [hw, 1.0], label: () => fr.flag("cab") ? L("Study the evidence board with the magnifying glass", "Delil panosunu büyüteçle incele") : L("Study the evidence board", "Delil panosunu incele"),
			use: () => clue(rid, "board")
		}, board);
		fr.door = {
			label: () => L("Enter the door code", "Kapı şifresini gir"),
			use: () => lockUI({ title: L("Door keypad", "Kapı tuş takımı"), text: L("A brass keypad by the door. The display blinks: <b>_ _ _ _</b>", "Kapının yanında pirinç bir tuş takımı. Ekranda yanıp sönüyor: <b>_ _ _ _</b>"), kind: "digits", len: 4, check: v => v.join("") === p().order.map(i => p().digits[i]).join(""), ok: () => { fr.solve(); ctx.sfx("door", 0.6); } })
		};
		let dO = 0, cO = 0;
		fr.anim = (dt, t) => {
			const q = p();
			hHand.rotation.z = -(((q.sh % 12) + q.sm / 60) / 12 * TAU);
			mHand.rotation.z = -(q.sm / 60 * TAU);
			dO += ((fr.flag("drawer") ? 1 : 0) - dO) * Math.min(1, dt * 4); drawer.position.z = 0.42 * dO;
			cO += ((fr.flag("cab") ? 1 : 0) - cO) * Math.min(1, dt * 3); cabDoors.forEach(D => { D.pv.rotation.y = D.sd * 1.8 * cO; });
			uvMsg.visible = !!fr.flag("uv");
			if (uvMsg.visible) uvMsg.material.opacity = 0.75 + 0.25 * Math.sin(t * 3);
			pad.visible = true;
		};
	};

	// ---------------------------------------------------------------- 2. the Pirate's Cabin (in: left, out: right)
	BUILD.pirate = fr => {
		const { g: G, hw, rid } = fr;
		fr.skin(mat("#ffffff", 0.8, 0, { map: planksTex("#8a5a32", 51, 3, 3) }), mat("#ffffff", 0.85, 0, { map: planksTex("#5a3a20", 53, 3, 1, true) }));
		const woodM = mat("#6a4426", 0.7), brass = mat("#c9a24a", 0.3, 0.85), lanternGlow = glow("#ffc070");
		const lantern = (parent, x, y, z) => { add(parent, new THREE.CylinderGeometry(0.08, 0.1, 0.24, 8), brass, x, y, z, { cast: false }); add(parent, new THREE.SphereGeometry(0.06, 10, 8), lanternGlow, x, y + 0.01, z, { cast: false }); add(parent, new THREE.ConeGeometry(0.1, 0.1, 8), brass, x, y + 0.17, z, { cast: false }); };
		// the table, with the logbook and a lantern; a second lantern hangs over it
		const tbl = group(G, 0, 0, -0.6);
		add(tbl, new THREE.CylinderGeometry(0.8, 0.8, 0.06, 24), woodM, 0, 0.78, 0);
		add(tbl, new THREE.CylinderGeometry(0.08, 0.2, 0.76, 10), darkWoodM, 0, 0.38, 0);
		add(tbl, rbox(0.42, 0.05, 0.3, 0.01), mat("#5a2a1a", 0.7), -0.1, 0.835, 0.15, { cast: false });
		add(tbl, new THREE.PlaneGeometry(0.38, 0.26), mat("#e8d4a6", 0.9), -0.1, 0.862, 0.15, { rx: -Math.PI / 2, cast: false });
		lantern(tbl, 0.48, 0.93, -0.3);
		add(G, new THREE.CylinderGeometry(0.01, 0.01, 0.55, 6), blackM, 0, H - 0.28, -0.6, { cast: false });
		lantern(G, 0, H - 0.7, -0.6);
		fr.box(-0.8, 0.8, -1.4, 0.2);
		// four numbered barrels along the left wall (the numbers change every run)
		const bGeo = new THREE.LatheGeometry([[0.001, 0], [0.3, 0], [0.36, 0.25], [0.38, 0.45], [0.36, 0.65], [0.3, 0.9], [0.001, 0.9]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
		const BZ = [-3.6, -2.1, -0.6, 0.9];
		const barrels = BZ.map((z, i) => {
			const bg = group(G, -hw + 0.45, 0, z);
			add(bg, bGeo, mat("#7a4a26", 0.8));
			for (const y of [0.2, 0.7]) add(bg, new THREE.TorusGeometry(0.37, 0.02, 6, 20), mat("#3a3a3a", 0.5, 0.6), 0, y, 0, { rx: Math.PI / 2, cast: false });
			add(bg, new THREE.PlaneGeometry(0.34, 0.3), new THREE.MeshBasicMaterial({ map: liveTex(256, 224, (c, w, h) => fitText(c, w, h, String(fr.p().nums[i]), { color: "#f4e6c0", size: 170, family: "Georgia, serif" })), transparent: true, depthWrite: false }), 0.385, 0.45, 0, { ry: Math.PI / 2, cast: false, receive: false });
			fr.box(-hw, -hw + 0.85, z - 0.4, z + 0.4);
			return bg;
		});
		// the sea chest (back wall): its lid lifts once it's unlocked
		const chest = group(G, 0, 0, -3.95);
		// (hollow: a heap of gold coins, a pearl necklace and a ruby inside)
		add(chest, new THREE.BoxGeometry(1.2, 0.05, 0.65), woodM, 0, 0.025, 0);
		for (const z of [-0.3, 0.3]) add(chest, rbox(1.2, 0.5, 0.05, 0.015), woodM, 0, 0.25, z);
		for (const x of [-0.575, 0.575]) add(chest, rbox(0.05, 0.5, 0.65, 0.015), woodM, x, 0.25, 0);
		add(chest, new THREE.SphereGeometry(0.3, 18, 10), goldM, 0, 0.3, 0, { cast: false }).scale.set(1.7, 0.55, 0.85);
		for (let i = 0; i < 14; i++) add(chest, new THREE.CylinderGeometry(0.035, 0.035, 0.008, 12), goldM, -0.45 + (i * 0.37) % 0.9, 0.36 + (i % 3) * 0.02, -0.18 + (i * 0.23) % 0.36, { rx: 0.3 * (i % 4), cast: false });
		add(chest, new THREE.TorusGeometry(0.1, 0.012, 6, 20), mat("#f4f0e8", 0.2, 0.3), 0.28, 0.44, 0.08, { rx: -1.2, cast: false });
		add(chest, new THREE.OctahedronGeometry(0.05), glow("#ff2a4a"), -0.25, 0.45, 0.05, { cast: false });
		add(chest, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), mat("#efe2c0", 0.9), 0.05, 0.44, 0.12, { rz: Math.PI / 2, ry: 0.4, cast: false });
		for (const x of [-0.45, 0.45]) add(chest, new THREE.BoxGeometry(0.06, 0.52, 0.67), brass, x, 0.26, 0, { cast: false });
		const lidP = group(chest, 0, 0.5, -0.33);
		add(lidP, new THREE.CylinderGeometry(0.33, 0.33, 1.2, 16, 1, false, 0, Math.PI), woodM, 0, 0, 0.33, { rz: Math.PI / 2 });
		add(chest, new THREE.BoxGeometry(0.12, 0.14, 0.03), brass, 0, 0.45, 0.335, { cast: false });
		fr.box(-0.65, 0.65, -RD, -3.55);
		// the captain's locker (right wall), with a compass dial for a lock
		const lk = group(G, hw - 0.3, 0, -1.6, -Math.PI / 2), lkDoors = [];
		// (inside: the captain's red coat on a rail, a tricorn hat, a cutlass, a bottle and a map case)
		shell(lk, 1.0, 2.0, 0.55, darkWoodM, [1.55]);
		add(lk, new THREE.CylinderGeometry(0.012, 0.012, 0.94, 6), brass, 0, 1.42, 0, { rz: Math.PI / 2, cast: false });
		add(lk, new THREE.CylinderGeometry(0.15, 0.24, 0.95, 14, 1, true), mat("#8a1a1a", 0.8, 0, { side: THREE.DoubleSide }), -0.18, 0.92, -0.02, { cast: false });
		add(lk, new THREE.TorusGeometry(0.06, 0.01, 6, 12), brass, -0.18, 1.42, 0, { cast: false });
		add(lk, new THREE.CylinderGeometry(0.2, 0.14, 0.1, 3), mat("#141014", 0.8), -0.2, 1.62, 0, { cast: false });
		add(lk, new THREE.BoxGeometry(0.03, 0.9, 0.06), steelM, 0.3, 0.5, -0.1, { rz: 0.12, cast: false });
		add(lk, new THREE.BoxGeometry(0.16, 0.03, 0.08), brass, 0.25, 0.98, -0.1, { cast: false });
		add(lk, new THREE.CylinderGeometry(0.05, 0.06, 0.24, 10), mat("#2a5a3a", 0.2, 0.1, { transparent: true, opacity: 0.85 }), 0.25, 1.69, 0.05, { cast: false });
		add(lk, new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10), mat("#5a3a20", 0.7), 0.2, 1.62, -0.12, { rz: Math.PI / 2, cast: false });
		for (const sd of [-1, 1]) { const pv = group(lk, sd * 0.48, 0, 0.28); add(pv, rbox(0.47, 1.86, 0.03, 0.01), woodM, -sd * 0.235, 1.0, 0.015); lkDoors.push({ pv, sd }); }
		const rose = canvasTex(256, 256, (c, w, h) => {
			c.fillStyle = "#e8d4a6"; c.beginPath(); c.arc(128, 128, 124, 0, TAU); c.fill();
			c.fillStyle = "#8a2a1a"; for (let i = 0; i < 4; i++) { c.save(); c.translate(128, 128); c.rotate(i * Math.PI / 2); c.beginPath(); c.moveTo(0, -110); c.lineTo(18, 0); c.lineTo(-18, 0); c.fill(); c.restore(); }
		});
		add(lkDoors[1].pv, new THREE.CircleGeometry(0.15, 24), mat("#ffffff", 0.6, 0, { map: rose }), -0.24, 1.3, 0.035, { cast: false });
		fr.box(hw - 0.6, hw, -2.12, -1.08);
		// three portholes (back wall), two anchors (front wall), a ship's wheel (right wall)
		const seaT = canvasTex(256, 256, (c, w, h) => drawSea(c, w, h));
		const portholes = [-2.6, 0, 2.6].map(x => {
			const pg = group(G, x, 1.75, -RD + 0.03);
			add(pg, new THREE.TorusGeometry(0.34, 0.06, 10, 28), brass, 0, 0, 0, { cast: false });
			add(pg, new THREE.CircleGeometry(0.33, 28), new THREE.MeshBasicMaterial({ map: seaT, toneMapped: false }), 0, 0, -0.005, { cast: false });
			return pg;
		});
		for (const x of [-2.4, 2.4]) {
			const an = group(G, x, 1.8, RD - 0.05, Math.PI), iron = mat("#2a2a2e", 0.5, 0.7);
			add(an, new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), iron, 0, 0, 0, { cast: false });
			add(an, new THREE.TorusGeometry(0.07, 0.02, 6, 14), iron, 0, 0.45, 0, { cast: false });
			add(an, new THREE.BoxGeometry(0.4, 0.04, 0.04), iron, 0, 0.25, 0, { cast: false });
			add(an, new THREE.TorusGeometry(0.28, 0.03, 6, 18, Math.PI), iron, 0, -0.3, 0, { rz: Math.PI, cast: false });
		}
		{
			const wh = group(G, hw - 0.06, 1.5, 0.6, -Math.PI / 2);
			add(wh, new THREE.TorusGeometry(0.4, 0.04, 8, 28), woodM, 0, 0, 0.05);
			for (let i = 0; i < 8; i++) add(wh, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), woodM, 0, 0, 0.05, { rz: i / 8 * TAU, cast: false });
			add(wh, new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), brass, 0, 0, 0.05, { rx: Math.PI / 2, cast: false });
		}

		const p = () => fr.p();
		fr.clue("log", () => L("Captain's logbook", "Seyir defteri"), () => `<div class="paper">${L(`I hid the key to my sea chest in the barrel whose number is <b>${TX(FORMULAS[p().fi][0])}</b>.<br><br>Count carefully, sailor!<br>- Captain Redbeard`, `Deniz sandığımın anahtarını, numarası <b>${TX(FORMULAS[p().fi][0])}</b> olan fıçıya sakladım.<br><br>Dikkatli say, tayfa!<br>- Kaptan Kızıl Sakal`)}</div>`);
		fr.it("log", { stand: [0, 0.65], at: [0, -0.6], label: ["Read the captain's logbook", "Kaptanın seyir defterini oku"], use: () => clue(rid, "log") }, tbl);
		const FLAV = [["Ship's biscuits, hard as rocks.", "Kaya gibi sert peksimetler."], ["Salted fish. Phew!", "Tuzlu balık. Of!"], ["Rum. Empty rum.", "Rom. Boş rom."], ["Cannonballs. Heavy and very boring.", "Gülleler. Ağır ve çok sıkıcı."]];
		barrels.forEach((bg, i) => fr.it("barrel" + i, {
			stand: [-hw + 1.3, BZ[i]], at: [-hw + 0.45, BZ[i]], label: () => L(`Search barrel no. ${p().nums[i]}`, `${p().nums[i]} numaralı fıçıyı ara`),
			use: () => {
				if (p().kp === i) { if (fr.flag("key")) { ctx.toast(L("Just salted fish now.", "Artık sadece tuzlu balık var.")); return; } fr.set("key"); ctx.sfx("clack", 0.6); ctx.toast(L("Under the salted fish... a <b>rusty key</b>!", "Tuzlu balıkların altında... <b>paslı bir anahtar</b>!")); return; }
				ctx.toast(TX(FLAV[i]));
			}
		}, bg));
		const capNote = () => { const q = p(); return `<div class="paper">${L(`"My locker answers only to the winds. Stand facing <b>${TX(DIR_START[DIRS[q.start]])}</b> and turn the dial to where you face.`, `"Dolabım sadece rüzgârlara cevap verir. <b>${TX(DIR_START[DIRS[q.start]])}</b> dönük dur ve kadranı baktığın yöne çevir.`)}<br>${q.turns.map(tn => L(`Then <b>${TX(TURN[tn])}</b>, and turn the dial again.`, `Sonra <b>${TX(TURN[tn])}</b> ve kadranı yine çevir.`)).join("<br>")}"<br>- ${L("Captain Redbeard", "Kaptan Kızıl Sakal")}</div><p class="esc-p" style="color:var(--muted)">${L("(Sailors know: the sun rises in the east and sets in the west.)", "(Denizciler bilir: güneş doğudan doğar, batıdan batar.)")}</p>`; };
		const codebook = () => { const q = p(); return `<p class="esc-p">${L("The signal book: what each flag means.", "İşaret kitabı: her bayrağın anlamı.")}</p><div class="esc-flags">${range(10).map(i => `<div>${img(96, 64, (c, w, h) => drawFlag(c, i, 2, 2, w - 4, h - 4))}${q.flagMap[i]}</div>`).join("")}</div>`; };
		fr.clue("note", () => L("The captain's note", "Kaptanın notu"), capNote);
		fr.clue("book", () => L("Signal book", "İşaret kitabı"), codebook);
		fr.clue("spy", () => L("Through the spyglass", "Dürbünle"), () => `${img(640, 360, (c, w, h) => drawSea(c, w, h, p().ships))}<p class="esc-p">${L("Three ships in the bay, each flying a signal flag. Left to right...", "Koyda üç gemi, her birinde bir işaret bayrağı. Soldan sağa...")}</p>`, 540);
		fr.it("chest", {
			stand: [0, -2.95], at: [0, -3.95], label: () => fr.flag("chest") ? L("Read the captain's note", "Kaptanın notunu oku") : fr.flag("key") ? L("Unlock the sea chest with the rusty key", "Sandığı paslı anahtarla aç") : L("A heavy sea chest (locked)", "Ağır bir deniz sandığı (kilitli)"),
			use: () => {
				if (!fr.flag("key")) { ctx.toast(L("Locked with a big rusty padlock.", "Büyük, paslı bir asma kilitle kilitli.")); return; }
				if (!fr.flag("chest")) { fr.set("chest"); ctx.sfx("creak", 0.6); }
				clue(rid, "note");
			}
		}, chest);
		fr.it("locker", {
			stand: [hw - 1.15, -1.6], at: [hw, -1.6], label: () => fr.flag("locker") ? L("Read the signal book", "İşaret kitabını oku") : L("Turn the locker's compass dial", "Dolabın pusula kadranını çevir"),
			use: () => {
				if (fr.flag("locker")) { clue(rid, "book"); return; }
				lockUI({
					title: L("The captain's locker", "Kaptanın dolabı"), text: L("A compass dial instead of a keyhole. Turn it <b>5</b> times.", "Anahtar deliği yerine bir pusula kadranı. <b>5</b> kez çevir."), kind: "seq", len: 5,
					keys: DIRS.map(d => ({ v: d, html: ARROW[d] + " " + TX(DIR_KEY[d]), slot: TX(DIR_KEY[d]), sub: TX(DIR_NAME[d]) })),
					keyMap: { ArrowUp: "N", ArrowRight: "E", ArrowDown: "S", ArrowLeft: "W" },
					check: v => v.join("") === p().seq.join(""), fail: L("The dial spins back to the start.", "Kadran başa döndü."),
					ok: () => { fr.set("locker"); ctx.sfx("door", 0.5); ctx.toast(L("The locker swings open: a brass <b>spyglass</b> and a <b>signal book</b>!", "Dolap açıldı: pirinç bir <b>dürbün</b> ve bir <b>işaret kitabı</b>!")); setTimeout(() => clue(rid, "book"), 150); }
				});
			}
		}, lk);
		fr.it("port", {
			stand: [2.6, -3.6], at: [2.6, -RD], label: () => fr.flag("locker") ? L("Look out through the spyglass", "Dürbünle dışarı bak") : L("Look out of the porthole", "Lombozdan dışarı bak"),
			use: () => {
				if (!fr.flag("locker")) { ctx.toast(L("Ships far out in the bay, flying little flags... too far away to make out.", "Koyun uzağında küçük bayraklı gemiler... seçilemeyecek kadar uzakta.")); return; }
				if (!fr.flag("spy")) fr.set("spy");
				ctx.sfx("whoosh", 0.4);
				clue(rid, "spy");
			}
		}, ...portholes);
		fr.door = {
			label: () => L("Try the hatch padlock", "Ambar kilidini dene"),
			use: () => lockUI({ title: L("The hatch padlock", "Ambar kilidi"), text: L("A heavy padlock with <b>3</b> number wheels.", "<b>3</b> rakam çarkı olan ağır bir asma kilit."), kind: "digits", len: 3, check: v => v.join("") === p().ships.map(i => p().flagMap[i]).join(""), ok: () => { fr.solve(); ctx.sfx("creak", 0.6); } })
		};
		let cO = 0, lO = 0;
		fr.anim = (dt, t) => {
			cO += ((fr.flag("chest") ? 1 : 0) - cO) * Math.min(1, dt * 3); lidP.rotation.x = -1.25 * cO;
			lO += ((fr.flag("locker") ? 1 : 0) - lO) * Math.min(1, dt * 3); lkDoors.forEach(D => { D.pv.rotation.y = D.sd * 1.7 * lO; });
			fr.L.intensity = fr.L.base * (0.9 + 0.1 * Math.sin(t * 2.3) * Math.sin(t * 5.1));
		};
	};

	// ---------------------------------------------------------------- 3. the Mad Scientist's Lab (in: left, out: front)
	BUILD.lab = fr => {
		const { g: G, hw, rid } = fr;
		fr.skin(mat("#ffffff", 0.45, 0, { map: checkTex("#d9dee2", "#b9c2c8", 8, 4, 4) }), mat("#ffffff", 0.8, 0, { map: panelTex("#9fb3ad", "#7d918b", 4, 1.5) }));
		const white = mat("#e8ecee", 0.5), dark = mat("#2a2f33", 0.4, 0.3);
		// the lab bench: three droppers and the mixing flask
		const bench = group(G, 0, 0, -0.4);
		add(bench, rbox(2.5, 0.88, 0.9, 0.03), white, 0, 0.44, 0);
		add(bench, rbox(2.6, 0.06, 1.0, 0.02), dark, 0, 0.91, 0);
		const DROP = ["#ff4a5a", "#4aff8a", "#4a8aff"];
		DROP.forEach((c, i) => { const x = -0.7 + i * 0.35; add(bench, new THREE.CylinderGeometry(0.06, 0.06, 0.24, 12), glow(c, { transparent: true, opacity: 0.85 }), x, 1.06, -0.15, { cast: false }); add(bench, new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8), dark, x, 1.22, -0.15, { cast: false }); });
		const flaskM = new THREE.MeshStandardMaterial({ color: "#9aa6ae", emissive: "#000000", transparent: true, opacity: 0.75, roughness: 0.1 });
		const flask = add(bench, new THREE.SphereGeometry(0.16, 16, 12), flaskM, 0.6, 1.1, 0.05, { cast: false });
		fr.box(-1.35, 1.35, -0.95, 0.15);
		// the fuse box (left wall): three slots
		const fb = group(G, -hw + 0.08, 1.5, -1.0, Math.PI / 2);
		add(fb, rbox(0.6, 0.8, 0.12, 0.02), mat("#5a6670", 0.5, 0.5), 0, 0, 0);
		const fuseLed = glow("#ff2a2a");
		add(fb, new THREE.SphereGeometry(0.03, 10, 8), fuseLed, 0.2, 0.3, 0.07, { cast: false });
		const fuseMs = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: "#888888", roughness: 0.4 }));
		const fuses = [-0.15, 0, 0.15].map((x, i) => add(fb, new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10), fuseMs[i], x, -0.05, 0.08, { cast: false }));
		// the safety poster (front wall, by the way out)
		const rulesT = liveTex(512, 640, (c, w, h) => {
			const q = fr.p(), [a, , cc] = q.perm, nm = i => TX([FUSES[i][0], FUSES[i][1]]).toUpperCase();
			c.fillStyle = "#ffd23a"; c.fillRect(0, 0, w, h); c.fillStyle = "#1a1a1a"; c.fillRect(16, 16, w - 32, 110);
			fitText(c, w, 140, L("SAFETY FIRST!", "ÖNCE GÜVENLİK!"), { color: "#ffd23a", y: 72, size: 70 });
			fitText(c, w, h, L("Fuse box, slots left to right:", "Sigorta kutusu, soldan sağa:"), { color: "#1a1a1a", y: 190, size: 36, weight: 800 });
			const r1 = L(`The ${nm(a)} and ${nm(cc)} fuses must NEVER sit side by side.`, `${nm(a)} ve ${nm(cc)} sigortalar ASLA yan yana takılmaz.`);
			const r2 = q.rule ? L(`The ${nm(a)} fuse must NOT go on the right.`, `${nm(a)} sigorta sağa TAKILMAZ.`) : L(`The ${nm(cc)} fuse must NOT go on the left.`, `${nm(cc)} sigorta sola TAKILMAZ.`);
			[r1, r2].forEach((r, i) => {
				const words = r.split(" "), lines = [""];
				words.forEach(wd => { const t = lines[lines.length - 1] ? lines[lines.length - 1] + " " + wd : wd; c.font = "800 34px Nunito, sans-serif"; if (c.measureText(t).width > w - 90) lines.push(wd); else lines[lines.length - 1] = t; });
				lines.forEach((ln, j) => fitText(c, w - 60, h, (j ? "   " : (i + 1) + ". ") + ln, { color: "#1a1a1a", align: "left", x: 30, y: 270 + i * 170 + j * 44, size: 34, weight: 800 }));
			});
		});
		const rules = add(G, new THREE.PlaneGeometry(0.8, 1.0), mat("#ffffff", 0.7, 0, { map: rulesT }), -2.2, 1.7, RD - 0.02, { ry: Math.PI, cast: false });
		// the whiteboard (right wall): the password hint, in your language
		const wbT = liveTex(768, 480, (c, w, h) => drawWhiteboard(c, w, h, (getLang() === "tr" ? WORDS_TR : WORDS)[fr.p().word][1]));
		const wb = add(G, new THREE.PlaneGeometry(1.7, 1.06), mat("#ffffff", 0.4, 0, { map: wbT }), hw - 0.03, 1.6, 0.3, { ry: -Math.PI / 2, cast: false });
		add(G, new THREE.BoxGeometry(0.03, 1.12, 1.76), mat("#aab4be", 0.4, 0.5), hw - 0.015, 1.6, 0.3, { cast: false });
		// the periodic table and the computer (back wall)
		const pt = add(G, new THREE.PlaneGeometry(1.9, 1.15), mat("#ffffff", 0.7, 0, { map: liveTex(1024, 620, drawPeriodic) }), -1.8, 1.8, -RD + 0.02, { cast: false });
		const desk = group(G, 1.6, 0, -4.15);
		add(desk, rbox(1.4, 0.75, 0.7, 0.02), white, 0, 0.375, 0);
		add(desk, rbox(0.72, 0.46, 0.05, 0.01), dark, 0, 1.05, -0.1);
		add(desk, new THREE.BoxGeometry(0.08, 0.25, 0.08), dark, 0, 0.85, -0.12, { cast: false });
		const termT = liveTex(512, 320, (c, w, h) => drawTerminal(c, w, h, fr.flag("login") ? "granted" : fr.flag("power") ? "login" : "", fr.p()), () => (fr.flag("power") ? "p" : "") + (fr.flag("login") ? "l" : ""));
		add(desk, new THREE.PlaneGeometry(0.66, 0.4), new THREE.MeshBasicMaterial({ map: termT, toneMapped: false }), 0, 1.05, -0.073, { cast: false });
		fr.box(0.85, 2.35, -RD, -3.75);
		// the places to search: the lab coat, the fridge, a toolbox, the microscope, the bin, the filing cabinet
		const coat = group(G, hw - 0.12, 0, 2.0, -Math.PI / 2);
		add(coat, new THREE.CylinderGeometry(0.2, 0.28, 1.1, 12, 1, true), mat("#f4f6f8", 0.8, 0, { side: THREE.DoubleSide }), 0, 1.2, 0.12);
		const fridge = group(G, hw - 0.4, 0, -1.8);
		add(fridge, rbox(0.7, 1.8, 0.75, 0.04), mat("#dfe6ea", 0.3, 0.2), 0, 0.9, 0);
		add(fridge, new THREE.BoxGeometry(0.03, 0.5, 0.04), steelM, -0.36, 1.2, 0.25, { cast: false });
		fr.box(hw - 0.78, hw, -2.2, -1.4);
		const tool = group(G, 2.2, 0, 3.9);
		add(tool, rbox(0.6, 0.3, 0.32, 0.02), mat("#c02a2a", 0.5, 0.3), 0, 0.15, 0); add(tool, new THREE.TorusGeometry(0.1, 0.015, 6, 14, Math.PI), dark, 0, 0.3, 0, { cast: false });
		fr.box(1.88, 2.52, 3.72, 4.08);
		const mic = group(G, -hw + 0.38, 0, 0.9);
		add(mic, rbox(0.6, 0.8, 0.6, 0.02), white, 0, 0.4, 0);
		add(mic, new THREE.CylinderGeometry(0.1, 0.12, 0.04, 12), dark, 0, 0.82, 0, { cast: false });
		add(mic, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), dark, 0, 1.0, 0.04, { rx: -0.3, cast: false });
		fr.box(-hw, -hw + 0.7, 0.58, 1.22);
		const bin = add(G, new THREE.CylinderGeometry(0.2, 0.17, 0.5, 14, 1, true), mat("#4a5a66", 0.5, 0.4, { side: THREE.DoubleSide }), -3.7, 0.25, -3.95);
		fr.box(-3.92, -3.48, -4.17, -3.73);
		const files = group(G, hw - 0.33, 0, -4.2);
		add(files, rbox(0.55, 1.25, 0.6, 0.02), mat("#7a8a96", 0.4, 0.6), 0, 0.625, 0);
		fr.box(hw - 0.62, hw, -RD, -3.88);

		const p = () => fr.p();
		const fuseAt = i => p().spots.indexOf(i);      // which fuse (colour) is hidden at search spot i (-1: none)
		const nFuses = () => range(6).filter(i => fr.flag("fuse" + i)).length;
		const SPOT = [[coat, [hw - 1.0, 2.0], [hw, 2.0]], [fridge, [hw - 1.3, -1.8], [hw, -1.8]], [tool, [2.2, 3.15], [2.2, 3.9]], [mic, [-hw + 1.1, 0.9], [-hw, 0.9]], [bin, [-3.3, -3.0], [-3.7, -3.95]], [files, [hw - 0.85, -3.15], [hw - 0.33, -4.2]]];
		SPOT.forEach(([obj, stand, at], i) => fr.it("search" + i, {
			stand, at, label: () => fr.flag("fuse" + i) ? L("Searched (you took the fuse)", "Arandı (sigortayı aldın)") : TX(SEARCH[i][0]),
			use: () => {
				if (fr.flag("fuse" + i)) { ctx.toast(L("You already took the fuse from here.", "Buradaki sigortayı zaten aldın.")); return; }
				const fz = fuseAt(i);
				if (fz >= 0) { fr.set("fuse" + i); ctx.sfx("pop", 0.7); ctx.toast(L(`You found a <b>${FUSES[fz][0].toLowerCase()} fuse</b>! (${nFuses()} of 3)`, `<b>${FUSES[fz][1].toLowerCase()} bir sigorta</b> buldun! (3'te ${nFuses()})`)); return; }
				ctx.toast(TX(SEARCH[i][1]));
			}
		}, obj));
		fr.it("fuses", {
			stand: [-hw + 1.0, -1.0], at: [-hw, -1.0], label: () => fr.flag("power") ? L("The fuse box (power on)", "Sigorta kutusu (elektrik var)") : L("Fit the fuses", "Sigortaları tak"),
			use: () => {
				if (fr.flag("power")) { ctx.toast(L("All three fuses are in. Power is on.", "Üç sigorta da takılı. Elektrik var.")); return; }
				const n = nFuses();
				if (n < 3) { ctx.toast(L(`The fuse box has 3 empty slots. You've found <b>${n} of 3</b> fuses: search the lab!`, `Sigorta kutusunda 3 boş yuva var. <b>3 sigortadan ${n}</b> tanesini buldun: laboratuvarı ara!`)); return; }
				lockUI({
					title: L("Fuse box", "Sigorta kutusu"), text: L("Three slots, left to right. Which fuse goes where?", "Soldan sağa üç yuva. Hangi sigorta nereye?"), kind: "seq", len: 3,
					keys: FUSES.map((F, i) => ({ v: String(i), html: "▮", sub: TX([F[0], F[1]]), c: F[2] })),
					check: v => v.join("") === p().perm.join(""), fail: L("BZZT! Sparks fly and the fuses pop out. Wrong order!", "BZZT! Kıvılcımlar saçıldı, sigortalar fırladı. Yanlış sıra!"),
					ok: () => { fr.set("power"); ctx.sfx("switch", 0.7); ctx.sfx("go", 0.6); ctx.toast(L("Clunk, clunk, clunk... the lights flicker on! The computer is booting up.", "Tak, tak, tak... ışıklar yandı! Bilgisayar açılıyor.")); }
				});
			}
		}, fb);
		const formula = () => { const e = p().eq; return `<pre class="term">${L("OMEGA LABS TERMINAL\n> ACCESS GRANTED\n\nANTIDOTE FORMULA (drops of each)\n", "OMEGA LABS TERMİNALİ\n> ERİŞİM VERİLDİ\n\nPANZEHİR FORMÜLÜ (her birinden damla)\n")}  ${L("RED + GREEN", "KIRMIZI + YEŞİL")} = ${e[0]}\n  ${L("GREEN + BLUE", "YEŞİL + MAVİ")} = ${e[1]}\n  ${L("RED + BLUE", "KIRMIZI + MAVİ")} = ${e[2]}\n\n${L("Mix it at the lab bench. Hurry!", "Laboratuvar tezgâhında karıştır. Acele et!")}</pre>`; };
		fr.clue("rules", () => L("Safety poster", "Güvenlik afişi"), () => { paint(liveTexes.find(R => R.t === rulesT)); return img(512, 640, c => c.drawImage(rulesT.image, 0, 0), "max-width:320px;margin:0 auto 10px"); }, 400);
		fr.clue("board", () => L("The whiteboard", "Beyaz tahta"), () => img(768, 480, (c, w, h) => drawWhiteboard(c, w, h, (getLang() === "tr" ? WORDS_TR : WORDS)[p().word][1])), 520);
		fr.clue("poster", () => L("Periodic table", "Periyodik tablo"), () => img(1024, 620, drawPeriodic), 620);
		fr.clue("pc", () => L("The computer", "Bilgisayar"), formula);
		fr.it("rules", { stand: [-2.0, 3.7], at: [-2.2, RD], label: ["Read the safety poster", "Güvenlik afişini oku"], use: () => clue(rid, "rules") }, rules);
		fr.it("board", { stand: [hw - 1.1, 0.3], at: [hw, 0.3], label: ["Read the whiteboard", "Beyaz tahtayı oku"], use: () => clue(rid, "board") }, wb);
		fr.it("poster", { stand: [-1.8, -3.5], at: [-1.8, -RD], label: ["Look at the periodic table", "Periyodik tabloya bak"], use: () => clue(rid, "poster") }, pt);
		fr.it("pc", {
			stand: [1.6, -3.2], at: [1.6, -4.15], label: () => !fr.flag("power") ? L("The computer (no power)", "Bilgisayar (elektrik yok)") : fr.flag("login") ? L("Read the computer screen", "Bilgisayar ekranını oku") : L("Log in to the computer", "Bilgisayara giriş yap"),
			use: () => {
				if (!fr.flag("power")) { ctx.toast(L("The screen is dead. There's no power in the lab.", "Ekran kapalı. Laboratuvarda elektrik yok.")); return; }
				if (fr.flag("login")) { clue(rid, "pc"); return; }
				lockUI({ title: L("Omega Labs terminal", "Omega Labs terminali"), text: `<span style="font-family:monospace;color:#6dff9a">${L("ENTER PASSWORD:", "ŞİFREYİ GİRİN:")}</span>`, kind: "word", ph: L("Password", "Şifre"), check: v => v === WORDS[p().word][0] || v === WORDS_TR[p().word][0], fail: L("ACCESS DENIED", "ERİŞİM REDDEDİLDİ"), ok: () => { fr.set("login"); ctx.sfx("chime", 0.6); setTimeout(() => clue(rid, "pc"), 120); } });
			}
		}, desk);
		fr.it("mix", {
			stand: [0, 0.85], at: [0, -0.4], label: () => fr.flag("login") ? L("Mix the antidote", "Panzehiri karıştır") : L("Look at the lab bench", "Laboratuvar tezgâhına bak"),
			use: () => {
				if (!fr.flag("login")) { ctx.toast(L("Three droppers (red, green and blue) and an empty flask. Better not mix anything without the formula...", "Üç damlalık (kırmızı, yeşil, mavi) ve boş bir şişe. Formül olmadan bir şey karıştırmasan iyi olur...")); return; }
				const n = [0, 0, 0], NM = [L("Red", "Kırmızı"), L("Green", "Yeşil"), L("Blue", "Mavi")];
				const body = openEsc(L("The lab bench", "Laboratuvar tezgâhı"), `<div class="esc-lock"><p class="esc-p">${L("Add drops to the flask, then mix. It has to be exactly right!", "Şişeye damla ekle, sonra karıştır. Tam doğru olmalı!")}</p><div class="esc-mix">${NM.map((c, i) => `<button class="btn" data-d="${i}" style="border-color:${DROP[i]}"><b style="color:${DROP[i]}">${c}</b><span>0</span></button>`).join("")}</div><div style="display:flex;gap:8px;justify-content:center"><button class="btn" data-x="empty">${L("Empty the flask", "Şişeyi boşalt")}</button><button class="btn primary" data-x="mix">${L("Mix!", "Karıştır!")}</button></div><div class="esc-msg"></div></div>`, 440);
				const show = () => body.querySelectorAll("[data-d]").forEach(b => { b.querySelector("span").textContent = n[b.dataset.d] + " " + L("drops", "damla"); });
				body.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { if (n[b.dataset.d] < 9) n[b.dataset.d]++; ctx.sfx("bubble", 0.4); show(); });
				body.querySelector("[data-x=empty]").onclick = () => { n.fill(0); ctx.sfx("pour", 0.4); show(); };
				body.querySelector("[data-x=mix]").onclick = () => {
					if (n.every((v, i) => v === p().drops[i])) { ctx.closeModal(); ctx.sfx("steam", 0.6); ctx.toast(L("The antidote glows bright green... the door's bio-lock clicks open!", "Panzehir parlak yeşil parlıyor... kapının biyo-kilidi açıldı!")); fr.solve(); return; }
					n.fill(0); show(); ctx.sfx("lose", 0.5);
					body.querySelector(".esc-msg").textContent = L("Fzzzt! It turns grey and fizzles. Try again.", "Fısss! Griye dönüp köpürdü. Tekrar dene.");
					shake(body);
				};
				show();
			}
		}, bench);
		fr.anim = (dt, t) => {
			const on = !!fr.flag("power"), q = p();
			fuses.forEach((f, i) => { f.visible = on; fuseMs[i].color.set(FUSES[q.perm[i]][2]); });
			fuseLed.color.set(on ? "#4aff6a" : nFuses() >= 3 ? "#ffd24a" : "#ff2a2a");
			flaskM.emissive.set(fr.flag("out") !== undefined ? "#2affc0" : "#000000"); flaskM.emissiveIntensity = 0.8;
			flask.scale.setScalar(fr.flag("out") !== undefined ? 1 + 0.05 * Math.sin(t * 6) : 1);
			if (on) { fr.L.color.set(MISSIONS.lab.light); fr.L.intensity = fr.L.base; }
			else { fr.L.color.set("#ff2a2a"); fr.L.intensity = fr.L.base * (0.25 + 0.15 * Math.max(0, Math.sin(t * 3))); }
		};
	};

	// ---------------------------------------------------------------- 4. the Bank Vault (in: front, out: right, the vault door)
	BUILD.vault = fr => {
		const { g: G, hw, rid } = fr;
		fr.skin(mat("#ffffff", 0.35, 0.2, { map: checkTex("#2a2e34", "#3a3f46", 6, 4, 4) }), mat("#ffffff", 0.6, 0.3, { map: panelTex("#5a626a", "#48505a", 4, 1.5) }));
		const metal = mat("#9aa2aa", 0.3, 0.8), goldBar = mat("#e8b84a", 0.25, 0.9);
		// the wall of deposit boxes (back), and the one that opens
		add(G, new THREE.BoxGeometry(5.0, 2.4, 0.1), mat("#3a4048", 0.4, 0.6), 0, 1.6, -RD + 0.05, { cast: false });
		const boxWall = add(G, new THREE.PlaneGeometry(4.8, 2.2), mat("#ffffff", 0.35, 0.6, { map: canvasTex(1200, 560, drawBoxes) }), 0, 1.6, -RD + 0.105, { cast: false });
		const openBox = group(G, 0, 0, -RD + 0.11);
		add(openBox, new THREE.PlaneGeometry(0.72, 0.47), blackM, 0, 0, 0.002, { cast: false });
		// (inside: the coded note in an envelope, and a gold bar)
		add(openBox, new THREE.PlaneGeometry(0.34, 0.2), mat("#f4efe2", 0.9), -0.1, 0.04, 0.006, { rz: 0.08, cast: false });
		add(openBox, new THREE.PlaneGeometry(0.1, 0.06), mat("#a02a2a", 0.6), -0.1, 0.04, 0.008, { cast: false });
		add(openBox, new THREE.BoxGeometry(0.2, 0.06, 0.08), goldBar, 0.18, -0.17, 0.04, { cast: false });
		const boxLid = group(openBox, -0.36, 0, 0.01);
		add(boxLid, new THREE.BoxGeometry(0.72, 0.47, 0.02), metal, 0.36, 0, 0, { cast: false });
		// gold bars and money bags in the back corners (behind the lasers)
		for (let i = 0; i < 6; i++) add(G, new THREE.BoxGeometry(0.28, 0.08, 0.13), goldBar, -3.6 + (i % 3) * 0.3, 0.04 + (i / 3 | 0) * 0.08, -3.9, { cast: false });
		for (const [x, z] of [[3.5, -3.9], [3.8, -3.5]]) { add(G, new THREE.SphereGeometry(0.25, 12, 10), mat("#8a7a5a", 0.9), x, 0.24, z).scale.set(1, 1.1, 1); add(G, new THREE.PlaneGeometry(0.2, 0.2), signM(() => "$", { color: "#2a5a2a", w: 128, h: 128, size: 100 }), x, 0.3, z + 0.255, { cast: false, receive: false }); }
		fr.box(-3.85, -3.0, -4.05, -3.75); fr.box(3.2, 4.1, -4.2, -3.2);
		// the lasers: five red beams across the room, a wall you can't walk through until they're off
		const beamM = glow("#ff2a2a", { transparent: true, opacity: 0.85 });
		const beams = [0.3, 0.65, 1.0, 1.35, 1.7].map(y => add(G, new THREE.CylinderGeometry(0.012, 0.012, hw * 2, 6), beamM, 0, y, -2.4, { rz: Math.PI / 2, cast: false, receive: false }));
		for (const sx of [-1, 1]) add(G, new THREE.BoxGeometry(0.1, 1.7, 0.16), mat("#1a1a1e", 0.4, 0.6), sx * (hw - 0.05), 1.0, -2.4, { cast: false });
		fr.solid(-hw, hw, -RD, -2.25, () => !fr.flag("lasers"));
		// the guard's desk (left): the monitor, the ledger, a sticky note
		const desk = group(G, -3.3, 0, 0.6, Math.PI / 2);
		add(desk, rbox(1.6, 0.76, 0.7, 0.02), mat("#3a2e26", 0.6), 0, 0.38, 0);
		add(desk, rbox(0.6, 0.4, 0.05, 0.01), blackM, 0.3, 1.0, -0.2);
		add(desk, new THREE.PlaneGeometry(0.54, 0.34), glow("#2a4a6a"), 0.3, 1.0, -0.172, { cast: false });
		add(desk, new THREE.PlaneGeometry(0.08, 0.08), glow("#ffe84a"), 0.03, 1.13, -0.17, { cast: false });
		const ledger = add(desk, rbox(0.34, 0.05, 0.26, 0.01), mat("#2a3a6a", 0.6), -0.45, 0.785, 0.05, { cast: false });
		fr.box(-hw, -2.92, -0.22, 1.42);
		// the visitor log (front wall), the security panel (right wall)
		const logB = group(G, -2.3, 1.5, RD - 0.03, Math.PI);
		add(logB, rbox(0.34, 0.46, 0.02, 0.01), mat("#8a6a3a", 0.7), 0, 0, 0, { cast: false });
		add(logB, new THREE.PlaneGeometry(0.28, 0.36), mat("#f4efe2", 0.9), 0, -0.02, 0.012, { cast: false });
		const panel = group(G, hw - 0.05, 1.4, 0.8, -Math.PI / 2);
		add(panel, rbox(0.5, 0.6, 0.06, 0.02), mat("#2a2e34", 0.4, 0.6), 0, 0, 0);
		const panelLeds = range(9).map(i => { const m = glow("#ff3a3a"); add(panel, new THREE.CircleGeometry(0.035, 12), m, -0.1 + (i % 3) * 0.1, 0.12 - (i / 3 | 0) * 0.1, 0.035, { cast: false }); return m; });
		// the vault door's steel ring, its wheel and its dial, round the way out
		{
			const ring = group(G, hw - 0.04, 1.2, SIDE_Z, -Math.PI / 2);
			add(ring, new THREE.TorusGeometry(1.0, 0.08, 10, 40), metal, 0, 0, 0, { cast: false });
			for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; add(ring, new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), metal, Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.06, { rx: Math.PI / 2, cast: false }); }
			add(G, new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), metal, hw - 0.06, 1.3, SIDE_Z + 1.1, { rz: Math.PI / 2, cast: false });
			add(G, new THREE.BoxGeometry(0.02, 0.06, 0.06), blackM, hw - 0.095, 1.42, SIDE_Z + 1.1, { cast: false });
		}

		const p = () => fr.p();
		const pinNote = () => `<div class="paper">${L(`My PIN (I always forget it!):<br>• the 1st digit is double the last one<br>• the 2nd digit is the 1st plus the last<br>• all four digits add up to <b>${p().sum}</b>`, `PIN'im (hep unutuyorum!):<br>• 1. rakam sonuncunun iki katı<br>• 2. rakam 1. ile sonuncunun toplamı<br>• dört rakamın toplamı <b>${p().sum}</b>`)}</div>`;
		const receipt = () => `<div class="paper">${L(`DEPOSIT RECEIPT<br>Client: <s>~~~~~~</s> (torn off)<br>Visit time: <b>${p().times[p().target]}</b><br>Item deposited: 1 gold bar`, `KASA MAKBUZU<br>Müşteri: <s>~~~~~~</s> (yırtılmış)<br>Ziyaret saati: <b>${p().times[p().target]}</b><br>Bırakılan eşya: 1 külçe altın`)}</div>`;
		fr.clue("pin", () => L("Sticky note", "Yapışkan not"), pinNote);
		fr.clue("receipt", () => L("Torn receipt", "Yırtık makbuz"), receipt);
		fr.clue("ledger", () => L("The ledger", "Kayıt defteri"), () => { const q = p(); return `<table class="esc-tbl"><tr><th>${L("Client", "Müşteri")}</th><th>${L("Box no.", "Kasa no.")}</th></tr>${q.ledgerOrder.map(i => `<tr><td>${CLIENTS[i]}</td><td><b>${q.boxes[i]}</b></td></tr>`).join("")}</table>`; }, 420);
		fr.clue("visitors", () => L("Visitor log", "Ziyaretçi defteri"), () => { const q = p(); return `<table class="esc-tbl"><tr><th>${L("Visitor", "Ziyaretçi")}</th><th>${L("Time", "Saat")}</th></tr>${q.logOrder.map(i => `<tr><td>${CLIENTS[i]}</td><td><b>${q.times[i]}</b></td></tr>`).join("")}</table>`; }, 420);
		fr.it("drawer", {
			stand: [-2.2, 1.1], at: [-3.3, 1.1], label: () => fr.flag("drawer") ? L("Read the torn receipt", "Yırtık makbuzu oku") : L("Open the guard's drawer", "Bekçinin çekmecesini aç"),
			use: () => {
				if (fr.flag("drawer")) { clue(rid, "receipt"); return; }
				learn(rid, "pin");
				lockUI({ title: L("The guard's drawer", "Bekçinin çekmecesi"), text: L("A 4-digit lock. A sticky note on the monitor says:", "4 haneli bir kilit. Monitördeki yapışkan notta şöyle yazıyor:") + pinNote(), kind: "digits", len: 4, w: 460, check: v => v.join("") === p().pin.join(""), ok: () => { fr.set("drawer"); ctx.sfx("clack", 0.6); ctx.toast(L("Inside: the guard's <b>keycard</b>, a <b>deposit box key</b> and a <b>torn receipt</b>.", "İçinde: bekçinin <b>giriş kartı</b>, bir <b>kasa anahtarı</b> ve <b>yırtık bir makbuz</b>.")); setTimeout(() => clue(rid, "receipt"), 150); } });
			}
		}, desk);
		fr.it("ledger", { stand: [-2.2, -0.2], at: [-3.3, -0.2], label: ["Read the bank's ledger", "Bankanın kayıt defterini oku"], use: () => clue(rid, "ledger") }, ledger);
		fr.it("log", { stand: [-2.3, 3.6], at: [-2.3, RD], label: ["Read the visitor log", "Ziyaretçi defterini oku"], use: () => clue(rid, "visitors") }, logB);
		let lo = null, loId = null;
		fr.it("panel", {
			stand: [hw - 1.0, 0.8], at: [hw, 0.8], label: () => fr.flag("lasers") ? L("The security panel (lasers off)", "Güvenlik paneli (lazerler kapalı)") : fr.flag("drawer") ? L("Swipe the keycard at the security panel", "Kartı güvenlik paneline okut") : L("The security panel", "Güvenlik paneli"),
			use: () => {
				if (fr.flag("lasers")) { ctx.toast(L("LASER GRID: OFF.", "LAZER AĞI: KAPALI.")); return; }
				if (!fr.flag("drawer")) { ctx.toast(L("INSERT KEYCARD. The panel stays dark.", "KART TAKIN. Panel kapalı kalıyor.")); return; }
				if (loId !== runId()) { lo = p().lights.slice(); loId = runId(); }
				const body = openEsc(L("Laser control", "Lazer kontrolü"), `<div class="esc-lock"><p class="esc-p">${L("LASER GRID: ON. To switch it off, turn <b>all nine lights off</b>. Pressing a light flips it and the lights above, below, left and right of it.", "LAZER AĞI: AÇIK. Kapatmak için <b>dokuz ışığın hepsini söndür</b>. Bir ışığa basınca o ve üstündeki, altındaki, solundaki, sağındaki ışıklar değişir.")}</p><div class="esc-lo">${range(9).map(i => `<button data-l="${i}"></button>`).join("")}</div><div style="display:flex;justify-content:center"><button class="btn" data-x="reset">${L("Start over", "Baştan başla")}</button></div></div>`, 400);
				const show = () => body.querySelectorAll("[data-l]").forEach(b => b.classList.toggle("on", lo[b.dataset.l]));
				body.querySelectorAll("[data-l]").forEach(b => b.onclick = () => {
					const c = +b.dataset.l;
					for (const j of [c, c - 3, c + 3, c % 3 ? c - 1 : -1, c % 3 < 2 ? c + 1 : -1]) if (j >= 0 && j < 9) lo[j] = !lo[j];
					ctx.sfx("switch", 0.5); show();
					if (lo.every(v => !v)) { setTimeout(() => { ctx.closeModal(); fr.set("lasers"); ctx.sfx("go", 0.6); ctx.toast(L("The lasers flicker and die. The deposit boxes are within reach!", "Lazerler titreyip söndü. Kiralık kasalara artık ulaşabilirsin!")); }, 300); }
				});
				body.querySelector("[data-x=reset]").onclick = () => { lo = p().lights.slice(); show(); };
				show();
			}
		}, panel);
		const cipher = () => { const q = p(), words = q.vault.map(d => caesar(NUMW[getLang() === "tr" ? 1 : 0][d], LASERS)); return `<div class="paper">${L("VAULT COMBINATION<br>Every letter has been moved FORWARD in the alphabet by as many places as there are laser beams guarding these boxes:", "KASA ŞİFRESİ<br>Her harf alfabede, bu kasaları koruyan lazer ışını sayısı kadar İLERİ kaydırıldı:")}<br><br><b style="font-family:'Courier New',monospace;font-size:24px;letter-spacing:.12em">${words.join(" · ")}</b></div><p class="esc-p" style="font-family:monospace;letter-spacing:.2em;color:var(--muted)">A B C D E F G H I J K L M N O P Q R S T U V W X Y Z</p>${getLang() === "tr" ? `<p class="esc-p" style="color:var(--muted)">(Türkçe harfler kullanılmadı: Ü yerine U, Ö yerine O, Ç yerine C...)</p>` : ""}`; };
		fr.clue("cipher", () => L("Coded note", "Şifreli not"), cipher);
		fr.it("boxes", {
			stand: [0, -3.5], at: [0, -RD], label: () => fr.flag("box") ? L("Read the coded note", "Şifreli notu oku") : L("Open a deposit box", "Bir kiralık kasa aç"),
			use: () => {
				if (fr.flag("box")) { clue(rid, "cipher"); return; }
				if (!fr.flag("drawer")) { ctx.toast(L("24 locked deposit boxes. You'd need a key.", "24 kilitli kiralık kasa. Bir anahtar lazım.")); return; }
				lockUI({ title: L("Deposit boxes", "Kiralık kasalar"), text: L("Which box does your key belong to? (two digits: box 7 is 07)", "Anahtarın hangi kasaya ait? (iki hane: 7 numara için 07)"), kind: "digits", len: 2, check: v => +v.join("") === p().boxes[p().target], fail: L("The key won't turn in that one.", "Anahtar o kasada dönmüyor."), ok: () => { fr.set("box"); ctx.sfx("clack", 0.6); setTimeout(() => clue(rid, "cipher"), 150); } });
			}
		}, boxWall);
		fr.door = {
			label: () => L("Turn the vault door's dial", "Kasa kapısının kadranını çevir"),
			use: () => lockUI({ title: L("The vault door", "Kasa kapısı"), text: L("A huge steel door with a <b>3-number</b> combination dial.", "<b>3 rakamlı</b> şifre kadranı olan dev çelik bir kapı."), kind: "digits", len: 3, check: v => v.join("") === p().vault.join(""), ok: () => { fr.solve(); ctx.sfx("thunk", 0.8); ctx.sfx("creak", 0.6); } })
		};
		let bO = 0;
		fr.anim = (dt, t) => {
			const q = p(), on = !fr.flag("lasers"), n = q.boxes[q.target] - 1;
			beams.forEach((b, i) => { b.visible = on; b.material.opacity = 0.7 + 0.3 * Math.sin(t * 9 + i); });
			openBox.position.set(-2.4 + (n % 6 + 0.5) * 0.8, 2.7 - ((n / 6 | 0) + 0.5) * 0.55, -RD + 0.11);
			bO += ((fr.flag("box") ? 1 : 0) - bO) * Math.min(1, dt * 3);
			openBox.visible = bO > 0.01; boxLid.rotation.y = -1.6 * bO;
			const L2 = loId === runId() && lo ? lo : q.lights;
			panelLeds.forEach((m, i) => m.color.set(!on ? "#2a3a2a" : L2[i] ? "#ff3a3a" : "#3a1a1a"));
		};
	};

	// ---------------------------------------------------------------- 5. Space Station Omega (in: left, out: right, the airlock)
	BUILD.space = fr => {
		const { g: G, hw, rid } = fr;
		fr.skin(mat("#ffffff", 0.4, 0.5, { map: panelTex("#2a3038", "#3c4652", 4, 4) }), mat("#ffffff", 0.5, 0.2, { map: panelTex("#cfd6de", "#a8b2bd", 4, 1.5) }));
		const panelM = mat("#3a4450", 0.4, 0.6), white = mat("#e8ecf0", 0.4, 0.2);
		// the big window (back wall): stars, and the Earth
		const spaceT = canvasTex(1024, 420, (c, w, h) => {
			c.fillStyle = "#02040c"; c.fillRect(0, 0, w, h);
			const r = rng(91); for (let n = 0; n < 500; n++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; c.fillRect(r() * w, r() * h, r() < 0.1 ? 2.5 : 1.2, r() < 0.1 ? 2.5 : 1.2); }
			const gr = c.createRadialGradient(w * 0.75, h * 1.6, h * 0.8, w * 0.75, h * 1.6, h * 1.25); gr.addColorStop(0, "#2a6ad8"); gr.addColorStop(0.9, "#4a9aff"); gr.addColorStop(1, "rgba(120,180,255,0)");
			c.fillStyle = gr; c.beginPath(); c.arc(w * 0.75, h * 1.6, h * 1.25, 0, TAU); c.fill();
		});
		add(G, new THREE.PlaneGeometry(3.4, 1.2), new THREE.MeshBasicMaterial({ map: spaceT, toneMapped: false }), 0, 2.4, -RD + 0.02, { cast: false });
		// glowing strips round the walls (red while the power's out)
		const stripM = glow("#3ad8ff");
		for (const [x, z, w, ry] of [[0, -RD + 0.03, hw * 2, 0], [-hw + 0.03, -1.0, RD * 2 - 2.2, Math.PI / 2], [hw - 0.03, -1.0, RD * 2 - 2.2, Math.PI / 2]]) add(G, new THREE.BoxGeometry(w, 0.04, 0.02), stripM, x, 0.12, z, { ry, cast: false });
		// the switch panel (left wall): five switches, labelled for this run
		const sp = group(G, -hw + 0.06, 1.4, -1.2, Math.PI / 2);
		add(sp, rbox(1.6, 0.8, 0.08, 0.02), panelM, 0, 0, 0);
		const swT = liveTex(1280, 128, (c, w, h) => { c.fillStyle = "#1a2028"; c.fillRect(0, 0, w, h); fr.p().pl.forEach((pi, i) => fitText(c, w / 5, h, TX([PLANETS[pi][0], PLANETS[pi][1]]).toUpperCase(), { x: (i + 0.5) * w / 5, color: "#cfe6ff", size: 50, weight: 800 })); });
		add(sp, new THREE.PlaneGeometry(1.5, 0.15), new THREE.MeshBasicMaterial({ map: swT, toneMapped: false }), 0, -0.25, 0.045, { cast: false });
		const toggles = range(5).map(i => { const pv = group(sp, -0.6 + i * 0.3, 0.08, 0.05); add(pv, new THREE.BoxGeometry(0.06, 0.18, 0.06), white, 0, 0.06, 0, { cast: false }); return pv; });
		const swLed = glow("#ff2a2a"); add(sp, new THREE.SphereGeometry(0.03, 10, 8), swLed, 0.7, 0.3, 0.05, { cast: false });
		// the navigation console (by the window): the star chart, once there's power
		const con = group(G, 0, 0, -3.55);
		add(con, rbox(1.7, 0.9, 0.6, 0.04), panelM, 0, 0.45, 0);
		const chart = add(con, new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ map: liveTex(768, 432, drawStars), toneMapped: false }), 0, 1.25, 0.05, { rx: -0.35, cast: false });
		add(con, new THREE.BoxGeometry(1.5, 0.86, 0.04), panelM, 0, 1.25, 0.02, { rx: -0.35, cast: false });
		fr.box(-0.88, 0.88, -RD, -3.22);
		// the captain's tablet on a crate (back left), the planet chart and the supply locker (right wall)
		const crate = group(G, -3.6, 0, -3.9);
		add(crate, rbox(0.65, 0.65, 0.65, 0.03), mat("#c8ccd2", 0.5, 0.4), 0, 0.325, 0);
		add(crate, new THREE.PlaneGeometry(0.27, 0.19), glow("#4ab8ff"), 0, 0.66, 0, { rx: -Math.PI / 2, cast: false });
		fr.box(-3.95, -3.25, -4.25, -3.55);
		const chartP = add(G, new THREE.PlaneGeometry(1.7, 0.96), new THREE.MeshBasicMaterial({ map: liveTex(1024, 576, drawPlanetChart), toneMapped: false }), hw - 0.02, 1.7, 0.3, { ry: -Math.PI / 2, cast: false });
		const lkr = group(G, hw - 0.27, 0, -2.4, -Math.PI / 2);
		// (inside: a spare helmet, food packs, oxygen canisters, a first-aid kit and boots)
		shell(lkr, 0.75, 1.95, 0.5, mat("#9aa4b0", 0.35, 0.7), [0.62, 1.3]);
		stuff(lkr, 0.03, 0, [[-0.18, 0.14, 0.26, 0.24, "#e8ecf0"], [0.0, 0.14, 0.26, 0.24, "#e8ecf0"], [0.2, 0.18, 0.2, 0.3, "#d84a3a"]]);
		stuff(lkr, 0.635, 0, [[-0.2, 0.2, 0.14, 0.26, "#ff8a2a"], [-0.2, 0.18, 0.1, 0.24, "#e8ecf0"], [0.12, 0.3, 0.2, 0.3, "#e8ecf0"]]);
		add(lkr, new THREE.BoxGeometry(0.08, 0.08, 0.02), glow("#ff3a3a"), 0.12, 0.745, 0.155, { cast: false });
		add(lkr, new THREE.SphereGeometry(0.15, 16, 12), white, -0.12, 1.465, 0, { cast: false });
		add(lkr, new THREE.SphereGeometry(0.12, 16, 10, -0.9, 1.8, 0.9, 1.0), new THREE.MeshStandardMaterial({ color: "#ffd27a", roughness: 0.05, metalness: 0.8 }), -0.12, 1.47, 0.04, { cast: false });
		for (const x of [0.12, 0.24]) { add(lkr, new THREE.CylinderGeometry(0.05, 0.05, 0.36, 12), mat("#3e7ee8", 0.35, 0.4), x, 1.5, 0, { cast: false }); add(lkr, new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), steelM, x, 1.71, 0, { cast: false }); }
		const lkDoor = group(lkr, -0.36, 0, 0.255);
		add(lkDoor, rbox(0.72, 1.85, 0.03, 0.01), mat("#b8c2cc", 0.35, 0.7), 0.36, 0.975, 0.015);
		const padM = glow("#ff3a3a"); add(lkDoor, new THREE.PlaneGeometry(0.12, 0.16), padM, 0.6, 1.2, 0.034, { cast: false });
		fr.box(hw - 0.55, hw, -2.8, -2.0);
		// a space suit (back right), the airlock's terminal (right wall, by the way out)
		{
			const su = group(G, 3.6, 0, -3.9, -0.6);
			add(su, new THREE.CylinderGeometry(0.26, 0.24, 0.8, 14), white, 0, 1.15, 0);
			add(su, new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: "#a8c8ff", roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.7 }), 0, 1.78, 0);
			for (const sx of [-0.12, 0.12]) add(su, new THREE.CylinderGeometry(0.09, 0.08, 0.75, 10), white, sx, 0.38, 0);
			fr.box(3.25, 3.95, -4.25, -3.55);
		}
		const term = group(G, hw - 0.05, 1.3, 1.85, -Math.PI / 2);
		add(term, rbox(0.4, 0.5, 0.06, 0.02), panelM, 0, 0, 0);
		const termM = glow("#ff3a3a"); add(term, new THREE.PlaneGeometry(0.32, 0.2), termM, 0, 0.08, 0.035, { cast: false });
		add(term, new THREE.BoxGeometry(0.2, 0.03, 0.04), blackM, 0, -0.15, 0.04, { cast: false });
		add(G, new THREE.PlaneGeometry(2.6, 0.5), signM(() => L("STATION OMEGA", "OMEGA İSTASYONU"), { color: "#e8f6ff", glow: "#3ad8ff", size: 130 }), 0, 2.95, RD - 0.03, { ry: Math.PI, cast: false, receive: false });
		// four oxygen tanks round the station, each with a big number and a gauge (together: the airlock's code)
		const TP = [[-2.2, 4.05], [2.2, 4.05], [-hw + 0.42, 1.0], [2.05, -4.05]];
		const tanks = TP.map(([x, z], i) => {
			const ry = Math.atan2(-x, -z), tg = group(G, x, 0, z, ry), tm = mat(TANKS[i][2], 0.35, 0.35);
			// (something flat on the tank's round side: at angle a round from the front)
			const onSide = (a, y, w, h, m, off) => add(tg, new THREE.PlaneGeometry(w, h), m, Math.sin(a) * (0.24 + off), y, Math.cos(a) * (0.24 + off), { ry: a, cast: false, receive: false });
			add(tg, new THREE.CylinderGeometry(0.26, 0.28, 0.06, 20), blackM, 0, 0.03, 0);
			add(tg, new THREE.CylinderGeometry(0.24, 0.24, 1.15, 22), tm, 0, 0.64, 0);
			add(tg, new THREE.SphereGeometry(0.24, 22, 10, 0, TAU, 0, Math.PI / 2), tm, 0, 1.215, 0);
			add(tg, new THREE.CylinderGeometry(0.04, 0.05, 0.16, 10), steelM, 0, 1.5, 0, { cast: false });
			add(tg, new THREE.TorusGeometry(0.08, 0.014, 6, 16), steelM, 0, 1.59, 0, { rx: Math.PI / 2, cast: false });
			onSide(-0.45, 0.62, 0.1, 0.76, glow("#05080c"), 0.004);
			const fillGeo = new THREE.PlaneGeometry(0.07, 0.72); fillGeo.translate(0, 0.36, 0);
			const fill = add(tg, fillGeo, glow("#7affd0"), Math.sin(-0.45) * 0.25, 0.26, Math.cos(-0.45) * 0.25, { ry: -0.45, cast: false, receive: false });
			onSide(0.32, 0.86, 0.22, 0.22, new THREE.MeshBasicMaterial({ map: liveTex(256, 256, c => { c.fillStyle = "#f4f6f8"; c.beginPath(); c.arc(128, 128, 122, 0, TAU); c.fill(); fitText(c, 256, 256, String(fr.p().tn[i]), { color: "#10161e", size: 200 }); }), transparent: true, toneMapped: false }), 0.006);
			onSide(0.32, 0.5, 0.2, 0.08, signM(() => "O₂", { color: "#ffffff", w: 256, h: 96, size: 80 }), 0.006);
			fr.box(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
			return { tg, fill, stand: [x + Math.sin(ry) * 0.95, z + Math.cos(ry) * 0.95] };
		});

		const p = () => fr.p();
		const logHtml = () => { const q = p(), nm = q.cs.map(i => TX([CONSTS[i][0], CONSTS[i][1]])); return `<pre class="term">${L(`CAPTAIN'S LOG - STATION OMEGA\n\nMain power has failed. To reboot, set the\nswitch panel: switch ON only the worlds that\n${TX(PRULES[q.rule][0]).toUpperCase()}. Every other switch stays OFF.\n\nSupply locker code: count the bright stars\nof ${nm[0]}, then ${nm[1]}, then ${nm[2]}.\n\nThe airlock's override code is in the\nairlock manual, in the supply locker.`, `KAPTAN KAYDI - OMEGA İSTASYONU\n\nAna güç kesildi. Yeniden başlatmak için düğme\npanelinde sadece ${TX(PRULES[q.rule][0]).toUpperCase()}\ngezegenleri AÇ. Diğer bütün düğmeler KAPALI kalsın.\n\nErzak dolabı şifresi: ${nm[0]}, sonra ${nm[1]},\nsonra ${nm[2]} takımyıldızlarının parlak yıldızlarını say.\n\nHava kilidinin acil durum kodu, erzak dolabındaki\nhava kilidi kılavuzunda yazıyor.`)}</pre>`; };
		const manual = () => `<div class="paper">${L("AIRLOCK MANUAL<br><br>Emergency override: the code is the numbers on the station's <b>four oxygen tanks</b>, from the <b>FULLEST</b> tank to the <b>EMPTIEST</b>.<br><br>Check every gauge carefully!", "HAVA KİLİDİ KILAVUZU<br><br>Acil durum kodu: istasyonun <b>dört oksijen tüpünün</b> üstündeki numaralar, <b>EN DOLU</b> tüpten <b>EN BOŞ</b> tüpe doğru.<br><br>Her göstergeyi dikkatle kontrol et!")}</div>`;
		const tankCode = () => { const q = p(); return range(4).sort((a, b) => q.lv[b] - q.lv[a]).map(i => q.tn[i]).join(""); };
		fr.clue("log", () => L("Captain's log", "Kaptan kaydı"), logHtml, 520);
		fr.clue("planets", () => L("Planet chart", "Gezegen tablosu"), () => img(1024, 576, drawPlanetChart), 620);
		fr.clue("chart", () => L("Star chart", "Yıldız haritası"), () => `${img(960, 540, drawStars)}<p class="esc-p">${L("Six constellations. Count only the bright stars.", "Altı takımyıldız. Sadece parlak yıldızları say.")}</p>`, 620);
		fr.clue("manual", () => L("Airlock manual", "Hava kilidi kılavuzu"), manual, 440);
		tanks.forEach((T2, i) => fr.clue("tank" + i, () => L(`The ${TANKS[i][0].toLowerCase()} oxygen tank`, `${TANKS[i][1]} oksijen tüpü`), () => { const q = p(); return `${img(300, 420, (c, w, h) => drawTank(c, w, h, q.tn[i], q.lv[i], TANKS[i][2]), "max-width:200px;margin:0 auto 10px")}<p class="esc-p" style="text-align:center">${L(`Tank number <b>${q.tn[i]}</b>. The gauge reads <b>${q.lv[i]}%</b>.`, `<b>${q.tn[i]}</b> numaralı tüp. Gösterge <b>%${q.lv[i]}</b> diyor.`)}</p>`; }, 340));
		fr.it("tablet", { stand: [-3.0, -3.1], at: [-3.6, -3.9], label: ["Read the captain's log", "Kaptan kaydını oku"], use: () => clue(rid, "log") }, crate);
		fr.it("chart", { stand: [hw - 1.0, 0.3], at: [hw, 0.3], label: ["Look at the planet chart", "Gezegen tablosuna bak"], use: () => clue(rid, "planets") }, chartP);
		tanks.forEach((T2, i) => fr.it("tank" + i, { stand: T2.stand, at: TP[i], label: () => L(`Check the ${TANKS[i][0].toLowerCase()} oxygen tank`, `${TANKS[i][1]} oksijen tüpünü kontrol et`), use: () => { ctx.sfx("click", 0.5); clue(rid, "tank" + i); } }, T2.tg));
		fr.it("switches", {
			stand: [-hw + 1.0, -1.2], at: [-hw, -1.2], label: () => fr.flag("power") ? L("The switch panel (systems online)", "Düğme paneli (sistemler açık)") : L("Set the switch panel", "Düğme panelini ayarla"),
			use: () => {
				if (fr.flag("power")) { ctx.toast(L("All systems online.", "Bütün sistemler çalışıyor.")); return; }
				const q = p(), on = q.pl.map(() => false);
				const body = openEsc(L("Switch panel", "Düğme paneli"), `<div class="esc-lock"><p class="esc-p">${L("Five switches, each labelled with a planet. Set them, then engage the reboot.", "Her biri bir gezegenle etiketli beş düğme. Ayarla, sonra yeniden başlat.")}</p><div class="esc-sw">${q.pl.map((pi, i) => `<button data-s="${i}">${TX([PLANETS[pi][0], PLANETS[pi][1]])}<span></span></button>`).join("")}</div><button class="btn primary" data-x="go">${L("Engage reboot", "Yeniden başlat")}</button><div class="esc-msg"></div></div>`, 420);
				const show = () => body.querySelectorAll("[data-s]").forEach(b => { const v = on[b.dataset.s]; b.classList.toggle("on", v); b.querySelector("span").textContent = v ? L("ON", "AÇIK") : L("OFF", "KAPALI"); });
				body.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { on[b.dataset.s] = !on[b.dataset.s]; ctx.sfx("switch", 0.6); show(); });
				body.querySelector("[data-x=go]").onclick = () => {
					fr.set("sw", on.slice());
					if (on.every((v, i) => v === PRULES[q.rule][1](PLANETS[q.pl[i]]))) { ctx.closeModal(); fr.set("power"); ctx.sfx("go", 0.7); ctx.toast(L("REBOOT COMPLETE. The lights come up and the alarm stops. The navigation console is online.", "YENİDEN BAŞLATMA TAMAM. Işıklar yandı, alarm sustu. Navigasyon konsolu çalışıyor.")); return; }
					ctx.sfx("alarm", 0.25);
					body.querySelector(".esc-msg").textContent = L("ERROR: wrong configuration. Reboot failed.", "HATA: yanlış ayar. Yeniden başlatma başarısız.");
					shake(body);
				};
				show();
			}
		}, sp);
		fr.it("console", {
			stand: [0, -2.6], at: [0, -3.55], label: () => fr.flag("power") ? L("Read the star chart", "Yıldız haritasını oku") : L("The navigation console (dark)", "Navigasyon konsolu (kapalı)"),
			use: () => { if (!fr.flag("power")) { ctx.toast(L("The console is dark. No power.", "Konsol kapalı. Enerji yok.")); return; } clue(rid, "chart"); }
		}, con);
		fr.it("locker", {
			stand: [hw - 1.15, -2.4], at: [hw, -2.4], label: () => fr.flag("locker") ? L("Read the airlock manual", "Hava kilidi kılavuzunu oku") : L("Open the supply locker", "Erzak dolabını aç"),
			use: () => {
				if (fr.flag("locker")) { clue(rid, "manual"); return; }
				lockUI({ title: L("Supply locker", "Erzak dolabı"), text: L("A keypad glows red: <b>ENTER 3-DIGIT CODE</b>", "Kırmızı parlayan bir tuş takımı: <b>3 HANELİ ŞİFRE GİRİN</b>"), kind: "digits", len: 3, check: v => v.join("") === p().cs.map(i => CONSTS[i][2].length).join(""), fail: L("ACCESS DENIED", "ERİŞİM REDDEDİLDİ"), ok: () => { fr.set("locker"); ctx.sfx("door", 0.5); ctx.toast(L("The locker hisses open: an <b>access card</b> and the <b>airlock manual</b>!", "Dolap tıslayarak açıldı: bir <b>giriş kartı</b> ve <b>hava kilidi kılavuzu</b>!")); setTimeout(() => clue(rid, "manual"), 150); } });
			}
		}, lkr);
		fr.it("airlock", {
			stand: [hw - 1.1, 1.85], at: [hw, 1.85], label: () => fr.flag("locker") ? L("Swipe the card and enter the override code", "Kartı okut ve acil durum kodunu gir") : L("The airlock terminal", "Hava kilidi terminali"),
			use: () => {
				if (!fr.flag("locker")) { ctx.toast(L("ACCESS CARD REQUIRED. The airlock stays sealed.", "GİRİŞ KARTI GEREKLİ. Hava kilidi kapalı kalıyor.")); return; }
				lockUI({ title: L("Airlock", "Hava kilidi"), text: L("CARD ACCEPTED. <b>ENTER THE 4-DIGIT OVERRIDE CODE</b>", "KART KABUL EDİLDİ. <b>4 HANELİ ACİL DURUM KODUNU GİRİN</b>"), kind: "digits", len: 4, check: v => v.join("") === tankCode(), fail: L("CODE REJECTED. Check the tanks' gauges again.", "KOD REDDEDİLDİ. Tüplerin göstergelerine tekrar bak."), ok: () => { ctx.sfx("steam", 0.7); ctx.toast(L("PSSSHHH... the airlock cycles and the far door slides open!", "PŞŞŞŞ... hava kilidi döndü ve öbür kapı kayarak açıldı!")); fr.solve(); } });
			}
		}, term);
		let dO = 0;
		fr.anim = (dt, t) => {
			const on = !!fr.flag("power"), sw = fr.flag("sw");
			toggles.forEach((pv, i) => { pv.rotation.x = sw && sw[i] ? -0.5 : 0.5; });
			swLed.color.set(on ? "#4aff6a" : "#ff2a2a");
			stripM.color.set(on ? "#3ad8ff" : Math.sin(t * 4) > 0 ? "#ff2a2a" : "#4a0a0a");
			chart.material.color.set(on ? "#ffffff" : "#050505");
			padM.color.set(fr.flag("locker") ? "#4aff6a" : "#ff3a3a");
			termM.color.set(fr.flag("out") !== undefined ? "#4aff6a" : fr.flag("locker") ? "#ffd24a" : "#ff3a3a");
			dO += ((fr.flag("locker") ? 1 : 0) - dO) * Math.min(1, dt * 3); lkDoor.rotation.y = -1.6 * dO;
			const q = p();
			tanks.forEach((T2, i) => { T2.fill.scale.y = Math.max(0.02, q.lv[i] / 100); });
			if (on) { fr.L.color.set(MISSIONS.space.light); fr.L.intensity = fr.L.base; }
			else { fr.L.color.set("#ff5040"); fr.L.intensity = fr.L.base * (0.5 + 0.2 * Math.max(0, Math.sin(t * 3))); }
		};
	};

	// ---------------------------------------------------------------- 6. the Wizard's Tower (in: left, out: front, the rune seal)
	BUILD.wizard = fr => {
		const { g: G, hw, rid } = fr;
		fr.skin(mat("#ffffff", 0.9, 0, { map: blocksTex("#3a3446", 71, 3, 3, 3, 6) }), mat("#ffffff", 0.9, 0, { map: blocksTex("#4a3a66", 73, 2, 1.5) }));
		const woodM = mat("#3a2418", 0.7), stoneM = mat("#5a5868", 0.95);
		// the lectern with the spellbook (left wall)
		const lec = group(G, -hw + 0.45, 0, 1.0, Math.PI / 2);
		add(lec, new THREE.CylinderGeometry(0.06, 0.16, 1.05, 10), woodM, 0, 0.52, 0);
		add(lec, rbox(0.6, 0.04, 0.45, 0.01), woodM, 0, 1.1, 0, { rx: 0.35 });
		for (const sd of [-1, 1]) add(lec, new THREE.PlaneGeometry(0.26, 0.36), mat("#f1e6c8", 0.9), sd * 0.14, 1.13, 0.01, { rx: -Math.PI / 2 + 0.35, cast: false });
		fr.box(-hw, -hw + 0.8, 0.65, 1.35);
		// the magic mirror (back wall)
		const mir = group(G, -2.0, 0, -RD + 0.04);
		add(mir, rbox(1.1, 1.9, 0.06, 0.03), goldM, 0, 1.45, 0);
		add(mir, new THREE.PlaneGeometry(0.92, 1.72), mat("#2a2a40", 0.05, 1.0), 0, 1.45, 0.035, { cast: false });
		const mirGlow = add(mir, new THREE.PlaneGeometry(0.92, 1.72), glow("#a07aff", { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 1.45, 0.04, { cast: false });
		// the crystal ball on its pedestal, with a socket for the moonstone
		const ped = group(G, 0, 0, -0.8);
		add(ped, new THREE.CylinderGeometry(0.2, 0.3, 1.0, 12), stoneM, 0, 0.5, 0);
		add(ped, new THREE.TorusGeometry(0.17, 0.03, 8, 20), goldM, 0, 1.02, 0, { rx: Math.PI / 2, cast: false });
		const ballM = new THREE.MeshStandardMaterial({ color: "#c8d8ff", emissive: "#3a4aaa", emissiveIntensity: 0.6, roughness: 0.05, transparent: true, opacity: 0.85 });
		const ball = add(ped, new THREE.SphereGeometry(0.2, 24, 16), ballM, 0, 1.22, 0, { cast: false });
		const moon = add(ped, new THREE.SphereGeometry(0.045, 12, 8), glow("#f0f4ff"), 0, 0.9, 0.24, { cast: false });
		fr.box(-0.4, 0.4, -1.2, -0.4);
		// the cauldron (back right)
		const cau = group(G, 2.3, 0, -3.3);
		add(cau, new THREE.SphereGeometry(0.55, 20, 14, 0, TAU, Math.PI * 0.35, Math.PI * 0.65), mat("#1a1a1e", 0.5, 0.6, { side: THREE.DoubleSide }), 0, 0.55, 0);
		const brewM = glow("#4aff8a");
		add(cau, new THREE.CircleGeometry(0.48, 24), brewM, 0, 0.82, 0, { rx: -Math.PI / 2, cast: false });
		const bubbles = range(6).map(() => add(cau, new THREE.SphereGeometry(0.05, 8, 6), glow("#8affb0", { transparent: true, opacity: 0.8 }), 0, 0.85, 0, { cast: false }));
		fr.box(1.7, 2.9, -3.9, -2.7);
		// the potion shelf (right wall): five bottles, each labelled with an alchemist's symbol (this run's)
		const shelf = group(G, hw - 0.2, 0, -0.6, -Math.PI / 2);
		add(shelf, rbox(1.5, 0.04, 0.3, 0.01), woodM, 0, 1.0, 0);
		add(shelf, rbox(1.5, 0.04, 0.3, 0.01), woodM, 0, 1.6, 0);
		POTIONS.forEach((P, i) => {
			const x = -0.56 + i * 0.28;
			add(shelf, new THREE.SphereGeometry(0.09, 12, 10), glow(P[2], { transparent: true, opacity: 0.85 }), x, 1.11, 0, { cast: false });
			add(shelf, new THREE.CylinderGeometry(0.025, 0.03, 0.09, 8), mat("#c8a070", 0.8), x, 1.24, 0, { cast: false });
			add(shelf, new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: liveTex(128, 128, c => { c.fillStyle = "#f1e6c8"; c.fillRect(0, 0, 128, 128); c.strokeStyle = c.fillStyle = "#2a1a0e"; drawStrokes(c, ALCH[fr.p().colorOf.indexOf(i)], 64, 64, 110, 9); }) }), x, 1.1, 0.095, { cast: false });
		});
		{ const bs = group(shelf, 0, 0, 0); bookshelf(bs, 1.4, 0.9, 79, woodM); }
		fr.box(hw - 0.4, hw, -1.35, 0.15);
		// four standing stones: a rune and a sum on each
		const SZ = [[-3.6, -2.3], [3.6, 1.6], [3.5, 3.7], [-1.7, 2.1]];
		const stones = SZ.map(([x, z], i) => {
			const sg = group(G, x, 0, z, Math.atan2(-x, -z));
			add(sg, rbox(0.7, 1.5, 0.35, 0.08), stoneM, 0, 0.75, 0);
			const rm = new THREE.MeshBasicMaterial({ map: liveTex(256, 384, c => { c.strokeStyle = "#d8b8ff"; c.shadowColor = "#a070ff"; c.shadowBlur = 16; drawStrokes(c, RUNES[i][1], 128, 120, 170, 20); c.shadowBlur = 0; fitText(c, 256, 384, fr.p().expr[i], { y: 320, size: 52, color: "#e8d8ff", family: "Georgia, serif", weight: 700 }); }), transparent: true, depthWrite: false, toneMapped: false });
			add(sg, new THREE.PlaneGeometry(0.46, 0.69), rm, 0, 0.95, 0.18, { cast: false, receive: false });
			fr.box(x - 0.42, x + 0.42, z - 0.42, z + 0.42);
			return { sg, rm };
		});
		// floating candles
		const candles = range(9).map(i => {
			const cg = group(G, -3 + (i % 3) * 3 + Math.sin(i) * 0.4, 2.6, -3 + (i / 3 | 0) * 2.6 + Math.cos(i) * 0.4);
			add(cg, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), mat("#f4ead2", 0.6), 0, 0, 0, { cast: false });
			add(cg, new THREE.ConeGeometry(0.018, 0.06, 6), glow("#ffcf6e"), 0, 0.13, 0, { cast: false });
			return { cg, y: cg.position.y, ph: i * 1.3 };
		});

		const p = () => fr.p();
		const riddle = () => RIDDLES[p().riddle];
		const orbHtml = () => `<p class="esc-p">${L("Symbols swirl in the glass, one after another:", "Camın içinde semboller sırayla dönüyor:")}</p><div class="esc-orb">${p().seq.map((s, i) => `<i style="animation-delay:${i * 0.85}s">${alchSvg(s)}</i>`).join("")}</div>`;
		fr.clue("book", () => L("The spellbook", "Büyü kitabı"), () => `<div class="paper"><span class="mirror">${TX(riddle()[0])}</span></div><p class="esc-p" style="color:var(--muted)">${L("Strange... every word is written backwards.", "Tuhaf... bütün kelimeler ters yazılmış.")}</p>`);
		fr.clue("riddle", () => L("The riddle (in the mirror)", "Bilmece (aynada)"), () => `<div class="paper">${TX(riddle()[0])}</div>`);
		fr.clue("orb", () => L("The crystal ball", "Kristal küre"), orbHtml, 440);
		fr.clue("shelf", () => L("The potion shelf", "İksir rafı"), () => { const q = p(); return `<table class="esc-tbl">${POTIONS.map((P, i) => `<tr><td><b style="color:${P[2]}">● ${TX([P[0], P[1]])}</b></td><td><span class="sym">${alchSvg(q.colorOf.indexOf(i))}</span></td></tr>`).join("")}</table><p class="esc-p" style="color:var(--muted)">${L("Every label is marked with a symbol. And every label says <i>Do not drink</i>.", "Her etikette bir sembol var. Ve her etikette <i>İçmeyin</i> yazıyor.")}</p>`; }, 380);
		stones.forEach((S, i) => fr.clue("stone" + i, () => L("Standing stone", "Dikili taş") + " (" + RUNES[i][0] + ")", () => `<p class="esc-p">${L("A standing stone carved with the rune", "Üstüne şu rün oyulmuş bir dikili taş:")} <b>${RUNES[i][0]}</b> <span class="sym">${runeSvg(i)}</span><br>${L("Scratched underneath it:", "Altına kazınmış:")} <b style="font-size:22px;font-family:Georgia,serif">${p().expr[i]}</b></p>`, 400));
		fr.it("book", { stand: [-hw + 1.15, 1.0], at: [-hw + 0.45, 1.0], label: ["Read the spellbook", "Büyü kitabını oku"], use: () => { if (!fr.flag("book")) fr.set("book"); clue(rid, "book"); } }, lec);
		fr.it("mirror", {
			stand: [-2.0, -3.5], at: [-2.0, -RD], label: () => fr.flag("mirror") ? L("The magic mirror (glowing)", "Sihirli ayna (parlıyor)") : L("Look into the magic mirror", "Sihirli aynaya bak"),
			use: () => {
				if (fr.flag("mirror")) { ctx.toast(L("Your reflection winks at you. Rude.", "Yansıman sana göz kırpıyor. Ne kaba.")); return; }
				if (!fr.flag("book")) { ctx.toast(L("Your reflection stares back. \"Show me something worth reading,\" it whispers.", "Yansıman sana bakıyor. \"Bana okumaya değer bir şey göster,\" diye fısıldıyor.")); return; }
				learn(rid, "riddle");
				lockUI({ title: L("The magic mirror", "Sihirli ayna"), text: L("You hold the spellbook up to the mirror, and the backwards words turn the right way round:", "Büyü kitabını aynaya tutuyorsun ve ters kelimeler düzeliyor:") + `<div class="paper">${TX(riddle()[0])}</div>` + L("Your reflection asks: <i>\"Well? What is it?\"</i>", "Yansıman soruyor: <i>\"Eee? Nedir?\"</i>"), kind: "word", w: 460, check: v => riddle()[1].includes(v) || RIDDLES[p().riddle][1].some(a => norm(a) === v), fail: L("\"Wrong!\" laughs your reflection.", "\"Yanlış!\" diye gülüyor yansıman."), ok: () => { fr.set("mirror"); ctx.sfx("chime", 0.7); ctx.toast(L("The mirror ripples like water... and a glowing <b>moonstone</b> drops into your hand!", "Ayna su gibi dalgalanıyor... ve avucuna parlayan bir <b>ay taşı</b> düşüyor!")); } });
			}
		}, mir);
		fr.it("orb", {
			stand: [0, 0.3], at: [0, -0.8], label: () => fr.flag("orb") ? L("Gaze into the crystal ball", "Kristal küreye bak") : fr.flag("mirror") ? L("Set the moonstone into the pedestal", "Ay taşını kaideye yerleştir") : L("Look at the crystal ball", "Kristal küreye bak"),
			use: () => {
				if (!fr.flag("orb")) {
					if (!fr.flag("mirror")) { ctx.toast(L("A cloudy crystal ball. Its pedestal has an empty socket, shaped like a small round stone.", "Bulanık bir kristal küre. Kaidesinde küçük, yuvarlak bir taş şeklinde boş bir yuva var.")); return; }
					fr.set("orb"); ctx.sfx("love", 0.6);
				}
				clue(rid, "orb");
			}
		}, ped);
		fr.it("shelf", { stand: [hw - 1.0, -0.6], at: [hw, -0.6], label: ["Look at the potion shelf", "İksir rafına bak"], use: () => clue(rid, "shelf") }, shelf);
		fr.it("cauldron", {
			stand: [1.5, -2.25], at: [2.3, -3.3], label: () => fr.flag("brew") ? L("The cauldron (quiet now)", "Kazan (artık sakin)") : L("Brew a potion in the cauldron", "Kazanda iksir hazırla"),
			use: () => {
				if (fr.flag("brew")) { ctx.toast(L("The cauldron just burps contentedly.", "Kazan memnun memnun geğiriyor.")); return; }
				if (!fr.flag("orb")) { ctx.toast(L("A bubbling cauldron. You've no idea what to brew in it... yet.", "Fokurdayan bir kazan. İçinde ne yapacağını henüz bilmiyorsun.")); return; }
				lockUI({ title: L("The cauldron", "Kazan"), text: L("Pour in four potions.", "Dört iksir dök."), kind: "seq", len: 4, keys: POTIONS.map((P, i) => ({ v: String(i), html: "●", sub: TX([P[0], P[1]]), c: P[2] })), keyMap: { 1: "0", 2: "1", 3: "2", 4: "3", 5: "4" }, check: v => v.join("") === p().seq.map(s => p().colorOf[s]).join(""), fail: L("The brew turns a nasty grey. Start again!", "İksir iğrenç bir griye döndü. Baştan başla!"), ok: () => { fr.set("brew"); ctx.sfx("yes", 0.5); ctx.toast(L("The brew flashes gold and a <b>wand</b> rises out of the cauldron!", "İksir altın gibi parladı ve kazandan bir <b>asa</b> yükseldi!")); } });
			}
		}, cau);
		const STAND = [[-2.8, -1.65], [2.8, 1.0], [2.75, 3.05], [-1.0, 1.4]];
		stones.forEach((S, i) => fr.it("stone" + i, { stand: STAND[i], at: SZ[i], label: ["Examine the standing stone", "Dikili taşı incele"], use: () => clue(rid, "stone" + i) }, S.sg));
		fr.door = {
			label: () => fr.flag("brew") ? L("Trace the runes on the seal with the wand", "Asayla mühre rünleri çiz") : L("The rune seal on the door", "Kapıdaki rün mührü"),
			use: () => {
				if (!fr.flag("brew")) { ctx.toast(L("The way out is sealed with glowing runes. You'd need something magic to trace them.", "Çıkış parlayan rünlerle mühürlü. Onları çizmek için büyülü bir şey lazım.")); return; }
				const want = [1, 2, 3, 4].map(v => p().vals.indexOf(v));
				lockUI({ title: L("The rune seal", "Rün mührü"), text: L("Trace four runes on the seal with the wand.", "Asayla mühre dört rün çiz."), kind: "seq", len: 4, keys: RUNES.map((r, i) => ({ v: String(i), html: runeSvg(i), sub: r[0], c: "#c9a8ff" })), check: v => v.join("") === want.join(""), fail: L("The runes flare red and fade. Wrong order!", "Rünler kırmızı parlayıp söndü. Yanlış sıra!"), ok: () => { fr.solve(); } });
			}
		};
		fr.anim = (dt, t) => {
			const q = p(), orb = !!fr.flag("orb");
			mirGlow.material.opacity = fr.flag("mirror") ? 0.25 + 0.1 * Math.sin(t * 2) : 0.04 + 0.03 * Math.sin(t * 1.3);
			moon.visible = orb;
			if (orb) { ballM.emissive.set(["#ff6a3a", "#3a8aff", "#cfe8ff", "#8a6a3a", "#e0b0ff"][q.seq[Math.floor(t / 0.85) % q.seq.length]]); ballM.emissiveIntensity = 1.1; }
			else { ballM.emissive.set("#3a4aaa"); ballM.emissiveIntensity = 0.5 + 0.2 * Math.sin(t * 1.5); }
			ball.rotation.y = t * 0.5;
			brewM.color.set(fr.flag("brew") ? "#ffd24a" : "#4aff8a");
			bubbles.forEach((b, i) => { const u = (t * 0.6 + i / bubbles.length) % 1; b.position.set(Math.sin(i * 2.3) * 0.3, 0.84 + u * 0.3, Math.cos(i * 1.7) * 0.3); b.scale.setScalar(0.5 + u); b.material.opacity = 0.8 * (1 - u); });
			candles.forEach(c => { c.cg.position.y = c.y + Math.sin(t * 0.9 + c.ph) * 0.08; });
			stones.forEach((S, i) => { S.rm.opacity = 0.75 + 0.25 * Math.sin(t * 2 + i); });
		};
	};

	ROOMS.forEach((R, i) => { FR[R.id] = makeRoom(R, i); });

	// ================================================================ the corridor, and the passage behind its sealed end
	{
		add(g, new THREE.PlaneGeometry(LX - SEAL - 0.4, 1.3), mat("#ffffff", 0.95, 0, { map: rugTex("#2a1a3a", "#ff7aa2", 13) }), (SEAL + LX) / 2, 0.015, 0, { rx: -Math.PI / 2, cast: false });
		for (const [z, c] of [[CZ - T / 2 - 0.02, "#ff7aa2"], [-CZ + T / 2 + 0.02, "#6ad0ff"]]) add(g, new THREE.BoxGeometry(LX - SEAL, 0.04, 0.02), glow(c), (SEAL + LX) / 2, H - 0.12, z, { cast: false });
		add(g, new THREE.PlaneGeometry(3.0, 0.75), signM(() => L("CAN YOU ESCAPE?", "KAÇABİLECEK MİSİN?"), { color: "#ffffff", glow: "#ff7aa2", w: 2048, h: 384, size: 200 }), SEAL + T / 2 + 0.02, 2.0, 0, { ry: Math.PI / 2, cast: false, receive: false });
		add(g, new THREE.PlaneGeometry(2.6, 0.5), signM(() => L("← THE MISSION", "← GÖREV"), { color: "#ffffff", glow: "#ffb86b", size: 120 }), LX, 3.0, 0, { ry: Math.PI / 2, cast: false, receive: false });
		// the passage: arrows on the floor from room 3's way out to room 4's way in
		add(g, new THREE.PlaneGeometry(1.2, 2.8), new THREE.MeshBasicMaterial({ map: canvasTex(128, 256, (c, w, h) => { c.strokeStyle = "#5dff8a"; c.lineWidth = 12; c.lineCap = "round"; for (let i = 0; i < 3; i++) { const y = 50 + i * 75; c.beginPath(); c.moveTo(24, y - 26); c.lineTo(64, y + 14); c.lineTo(104, y - 26); c.stroke(); } }), transparent: true, depthWrite: false, toneMapped: false }), -12.715, 0.02, 0, { rx: -Math.PI / 2, cast: false, receive: false });
		add(g, new THREE.PlaneGeometry(2.4, 0.6), signM(() => L("KEEP GOING!", "DEVAM ET!"), { color: "#ffffff", glow: "#5dff8a", size: 140 }), X0 + 0.02, 2.4, 0, { ry: Math.PI / 2, cast: false, receive: false });
	}

	// ================================================================ the lobby
	{
		add(g, new THREE.PlaneGeometry(X1 - LX, Z1 - Z0), mat("#ffffff", 0.35, 0.05, { map: checkTex("#1a1820", "#e8e2d8", 8, 4, 11) }), (LX + X1) / 2, 0.008, 0, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
		const desk = group(g, 13.2, 0, -8.6);
		add(desk, rbox(3.4, 1.05, 0.8, 0.03), mat("#1e1a26", 0.5), 0, 0.525, 0);
		add(desk, rbox(3.5, 0.05, 0.9, 0.02), mat("#d8cfc0", 0.3, 0.1), 0, 1.075, 0);
		add(desk, new THREE.BoxGeometry(3.3, 0.05, 0.02), glow("#ff7aa2"), 0, 0.2, 0.41, { cast: false });
		add(desk, new THREE.PlaneGeometry(1.8, 0.4), signM(() => L("GAME MASTER", "OYUN YÖNETİCİSİ"), { color: "#ffffff", glow: "#ff7aa2", size: 110 }), 0, 0.68, 0.405, { cast: false, receive: false });
		const bell = add(desk, new THREE.SphereGeometry(0.08, 14, 8, 0, TAU, 0, Math.PI / 2), goldM, 0.6, 1.1, 0.15, { cast: false });
		k.box(11.45, 14.95, -9.05, -8.15);
		for (let i = 0; i < 4; i++) add(g, rbox(0.42, 1.8, 0.45, 0.01), mat(["#ff7aa2", "#6ad0ff", "#ffb86b", "#7ae582"][i], 0.4, 0.3), 15.2 + i * 0.44, 0.9, Z0 + 0.25);
		k.box(14.95, 16.95, Z0, Z0 + 0.5);
		for (const [x, z] of [[16.4, 10.4], [16.4, -2.6], [16.4, 2.6], [9.7, 10.3], [9.7, -10.3]]) { plant(g, x, z, 1.1); k.box(x - 0.3, x + 0.3, z - 0.3, z + 0.3); }
		const sofa = group(g, 9.55, 0, 6.0, Math.PI / 2), velvet = mat("#5a2a6a", 0.85);
		add(sofa, rbox(1.9, 0.42, 0.8, 0.1), velvet, 0, 0.25, 0.05); add(sofa, rbox(1.9, 0.6, 0.22, 0.08), velvet, 0, 0.7, -0.3);
		for (const sx of [-0.9, 0.9]) add(sofa, rbox(0.18, 0.55, 0.8, 0.06), velvet, sx, 0.4, 0.05);
		k.spot({ id: "escSofaA", x: 9.6, z: 6.45, h: Math.PI / 2, y: 0.04 });
		k.spot({ id: "escSofaB", x: 9.6, z: 5.55, h: Math.PI / 2, y: 0.04 });
		k.interact("esc:sofa", { label: () => L("Sit on the sofa", "Kanepeye otur"), stand: [10.45, 6.0], sit: ["escSofaA", "escSofaB"] }, sofa);
		k.box(9.1, 10.05, 5.0, 7.0);
		const board = group(g, 13, 0, Z1 - 0.03, Math.PI);
		add(board, rbox(4.8, 2.6, 0.06, 0.03), mat("#2a2230", 0.5, 0.3), 0, 1.75, 0);
		add(board, new THREE.PlaneGeometry(4.6, 2.4), new THREE.MeshBasicMaterial({ map: liveTex(1280, 668, drawMissionBoard), toneMapped: false }), 0, 1.75, 0.035, { cast: false });
		add(board, new THREE.BoxGeometry(4.9, 0.04, 0.04), glow("#ff7aa2"), 0, 3.07, 0.03, { cast: false });
		k.interact("esc:board", { label: () => L("Read the mission board", "Görev panosunu oku"), stand: [13, 9.6], face: 0, reach: 3, use: openBoard }, board);
		k.interact("esc:bell", { label: () => L("Ring the bell", "Zili çal"), stand: [13.2, -7.45], face: Math.PI, reach: 2.4, use: () => { ctx.sfx("chime", 0.8); ctx.toast(L("<b>Welcome to the Escape House!</b> One mission, six linked rooms. Go into room 1, gather your team and press <b>Start mission</b>. Look at, read and search everything: clues from different places fit together. Each room's last lock opens the next room. Stuck? Press <b>G</b> for a hint.", "<b>Kaçış Evi'ne hoş geldin!</b> Tek görev, birbirine bağlı altı oda. 1. odaya gir, ekibini topla ve <b>Görevi başlat</b>'a bas. Her şeye bak, oku ve ara: farklı yerlerden gelen ipuçları birbirini tamamlar. Her odanın son kilidi sıradaki odayı açar. Takıldın mı? İpucu için <b>G</b>'ye bas."), null, null, 12000); } }, bell);
		add(g, new THREE.PlaneGeometry(4.2, 0.9), signM(() => L("ESCAPE HOUSE", "KAÇIŞ EVİ"), { color: "#ffffff", glow: "#ff7aa2", w: 2048, h: 384, size: 230 }), X1 - 0.02, 3.0, 4.6, { ry: -Math.PI / 2, cast: false, receive: false });
	}
	function openBoard() {
		const s = st(), sv = solved(), b = ctx.get(KEY + "best");
		const status = running() ? L(`<b>Mission in progress</b>: ${esc(s.by)}'s team, room ${Math.min(sv + 1, 6)} of 6, ${fmt(now() - s.at)}`, `<b>Görev sürüyor</b>: ${esc(s.by)} ve ekibi, 6 odadan ${Math.min(sv + 1, 6)}., ${fmt(now() - s.at)}`)
			: won() ? L(`<b>Escaped!</b> ${esc(s.team || s.by)} got out in ${fmt(s.t)}`, `<b>Kaçtılar!</b> ${esc(s.team || s.by)} ${fmt(s.t)} sürede çıktı`) : L("Nobody's on the mission right now. Go on in!", "Şu an görevde kimse yok. Haydi içeri!");
		const rows = ROOMS.map((R, i) => {
			const M = MISSIONS[R.id], tt = flag(R.id, "out");
			const ic = i < sv ? "✅" : i === sv && running() ? "▶️" : "🔒";
			return `<div class="esc-m" style="--c:${M.color}"><span class="ic">${ic}</span><b>${i + 1}. ${TX(M.name)}<em>${stars(M.stars)}</em></b><span class="s">${TX(M.blurb)}${tt !== undefined ? ` <b style="color:var(--ok)">(${fmt(tt)})</b>` : ""}</span></div>`;
		}).join("");
		const body = openEsc(L("Escape House - The Mission", "Kaçış Evi - Görev"), `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><span class="esc-p" style="margin:0">${status}</span>${langBtns()}</div><p class="esc-p">${L("Six linked rooms, one way out. Start in room 1 (off the corridor): each room's last lock opens the door into the next. Everyone inside plays together, and the codes change every time. Your progress is saved: leave whenever you like and carry on later.", "Birbirine bağlı altı oda, tek çıkış. 1. odadan başla (koridorda): her odanın son kilidi sıradakinin kapısını açar. İçerideki herkes birlikte oynar ve şifreler her seferinde değişir. İlerlemen saklanır: istediğin zaman çık, sonra kaldığın yerden devam et.")}</p><div class="esc-board">${rows}</div><p class="esc-p" style="margin-top:12px">${L("Best time:", "En iyi süre:")} ${b && b.t ? `<b>${fmt(b.t)}</b> (${esc(b.by)})` : L("nobody yet", "henüz kimse")}</p><button class="btn primary" data-x="go">${running() ? L(`Take me to room ${current() + 1}`, `Beni ${current() + 1}. odaya götür`) : L("Take me to room 1", "Beni 1. odaya götür")}</button>`, 600);
		body.querySelectorAll("[data-lang]").forEach(bt => bt.onclick = () => { setLang(bt.dataset.lang); openBoard(); });
		body.querySelector("[data-x=go]").onclick = () => { if (running()) { goOn(); return; } ctx.closeModal(); const p = standOf(DOORS[0], DOORS[0].f, 0.95); ctx.walkTo(p[0] + OX, p[1] + OZ, "esc:door0"); };
	}

	// ================================================================ the outside
	{
		const brick = canvasTex(512, 512, (c, w, h) => {
			c.fillStyle = "#2a1c1a"; c.fillRect(0, 0, w, h);
			const r = rng(17);
			for (let j = 0; j < 16; j++) for (let i = -1; i < 8; i++) { const t = 0.75 + r() * 0.35; c.fillStyle = `rgb(${108 * t | 0},${50 * t | 0},${40 * t | 0})`; c.fillRect(i * 64 + (j % 2) * 32 + 2, j * 32 + 2, 60, 28); }
		}, 1, 1);
		const bm = (w, h) => { const t = brick.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 2.2, h / 1.1); return mat("#ffffff", 0.9, 0, { map: t }); };
		const top = H + 0.7, ex = X1 + T + 0.012, wx = X0 - T - 0.012, nz = Z1 + T + 0.012, sz = Z0 - T - 0.012, Lw = X1 - X0 + 2 * T, D = Z1 - Z0 + 2 * T;
		const face = (x, z, w, h, y, ry) => add(g, new THREE.PlaneGeometry(w, h), bm(w, h), x, y, z, { ry, cast: false });
		face(wx, 0, D, top, top / 2, -Math.PI / 2);
		face(0, nz, Lw, top, top / 2, 0);
		face(0, sz, Lw, top, top / 2, Math.PI);
		const sw = (D / 2) - DOOR.z1;
		for (const sd of [-1, 1]) face(ex, sd * (DOOR.z1 + sw / 2), sw, top, top / 2, Math.PI / 2);
		face(ex, 0, DOOR.z1 - DOOR.z0, top - DOOR.h, (top + DOOR.h) / 2, Math.PI / 2);
		add(g, new THREE.BoxGeometry(Lw, 0.3, D), mat("#1c1a20", 0.9), 0, H + 0.15, 0, { cast: false });
		const cop = mat("#4a4450", 0.8);
		for (const [x, z, w, d] of [[0, Z1 + T / 2, Lw + 0.1, 0.32], [0, Z0 - T / 2, Lw + 0.1, 0.32], [X1 + T / 2, 0, 0.32, D], [X0 - T / 2, 0, 0.32, D]]) add(g, new THREE.BoxGeometry(w, 0.08, d), cop, x, top + 0.04, z, { cast: false });
		// the sign on the roof, over the door, a padlock either side
		const sg = group(g, X1 + T - 0.1, top, 0);
		for (const z of [-2.6, 2.6]) add(sg, new THREE.BoxGeometry(0.1, 0.5, 0.1), blackM, 0, 0.25, z, { cast: false });
		add(sg, rbox(0.12, 1.5, 7.4, 0.04), mat("#141218", 0.6), 0, 1.25, 0);
		add(sg, new THREE.PlaneGeometry(6.4, 1.2), signM(() => L("ESCAPE HOUSE", "KAÇIŞ EVİ"), { color: "#ffffff", glow: "#ff3a7a", w: 2048, h: 384, size: 250 }), 0.07, 1.25, 0, { ry: Math.PI / 2, cast: false, receive: false });
		const neonM = glow("#ff7aa2");
		for (const y of [0.52, 1.98]) add(sg, new THREE.BoxGeometry(0.04, 0.04, 7.2), neonM, 0.08, y, 0, { cast: false });
		const lockM = glow("#ffd24a");
		for (const z of [-3.15, 3.15]) {
			add(sg, new THREE.BoxGeometry(0.05, 0.45, 0.5), lockM, 0.1, 1.1, z, { cast: false });
			add(sg, new THREE.TorusGeometry(0.17, 0.04, 8, 18, Math.PI), lockM, 0.1, 1.33, z, { ry: Math.PI / 2, cast: false });
		}
		add(g, new THREE.PlaneGeometry(3.4, 0.5), signM(() => L("Can you get out?", "Çıkabilecek misin?"), { color: "#ffd36b", glow: "#ff9a3a", size: 120, family: "Caveat, Nunito, cursive", weight: 800 }), ex + 0.02, 3.18, 0, { ry: Math.PI / 2, cast: false, receive: false });
		// the canopy over the door, a glowing frame, a doormat
		add(g, rbox(1.4, 0.1, 3.2, 0.03), mat("#1a1820", 0.6, 0.3), X1 + T + 0.7, 2.85, 0);
		add(g, new THREE.BoxGeometry(0.04, 0.04, 3.1), neonM, X1 + T + 1.38, 2.79, 0, { cast: false });
		k.camWall(X1 + T, X1 + T + 1.4, -1.6, 1.6, 2.8, 2.92);
		for (const sd of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.05, 0.05, 2.8, 10), blackM, X1 + T + 1.3, 1.4, sd * 1.45, { cast: false }); k.box(X1 + T + 1.18, X1 + T + 1.42, sd * 1.45 - 0.12, sd * 1.45 + 0.12); }
		for (const [z, y, w, h] of [[DOOR.z0 - 0.05, DOOR.h / 2, 0.05, DOOR.h], [DOOR.z1 + 0.05, DOOR.h / 2, 0.05, DOOR.h], [0, DOOR.h + 0.05, DOOR.z1 - DOOR.z0 + 0.15, 0.05]]) add(g, new THREE.BoxGeometry(0.04, h, w), glow("#6ad0ff"), ex + 0.02, y, z, { cast: false });
		add(g, new THREE.PlaneGeometry(1.2, 1.6), mat("#3a1a2a", 0.95), X1 + T + 0.7, 0.01, 0, { rx: -Math.PI / 2, cast: false });
		// a velvet rope by the path
		const ropeM = mat("#8a1a2a", 0.7);
		for (const sd of [-1, 1]) {
			const pts = [];
			for (const x of [X1 + 2.0, X1 + 3.0, X1 + 4.0]) { add(g, new THREE.CylinderGeometry(0.04, 0.12, 0.95, 10), goldM, x, 0.475, sd * 1.65); k.box(x - 0.13, x + 0.13, sd * 1.65 - 0.13, sd * 1.65 + 0.13); }
			for (let i = 0; i <= 20; i++) { const u = i / 20, f = (u * 2) % 1; pts.push(new THREE.Vector3(X1 + 2.0 + u * 2.0, 0.9 - Math.sin(f * Math.PI) * 0.15, sd * 1.65)); }
			add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.02, 6), ropeM, 0, 0, 0, { cast: false });
		}
	}

	// ================================================================ the panel (anywhere in the house)
	const hud = document.createElement("div");
	hud.id = "escHud"; hud.className = "chip hidden";
	(document.getElementById("hud") || document.body).appendChild(hud);
	hud.addEventListener("pointerdown", e => e.stopPropagation());
	let hudSig = "";
	hud.addEventListener("click", e => {
		const lb = e.target.closest("[data-lang]");
		if (lb) { setLang(lb.dataset.lang); hudSig = ""; renderHud(); return; }
		const b = e.target.closest("[data-a]"), rid = myRoom();
		if (!b) return;
		const a = b.dataset.a;
		if (a === "start") start();
		else if (a === "board") openBoard();
		else if (a === "clues") showClues(rid);
		else if (a === "go") goOn();
		else if (!rid) return;
		else if (a === "hint") hint(rid);
		else if (a === "quit") askQuit();
	});
	function renderHud() {
		const pl = myPlace();
		if (pl === null) { if (!hud.classList.contains("hidden")) { hud.classList.add("hidden"); hudSig = ""; } return; }
		const s = st(), run = running(), done = won(), sv = solved();
		const ri = pl >= 0 && pl % 1 === 0 ? pl : -1, rid = ri >= 0 ? ROOMS[ri].id : null;
		const M = rid ? MISSIONS[rid] : null;
		const steps = M ? M.steps.filter(x => flag(rid, x.f) !== undefined).length : 0;
		const si = M ? M.steps.findIndex(x => flag(rid, x.f) === undefined) : -1;
		const items = run && rid ? inventory(rid) : [], nJ = run ? ROOMS.reduce((n, R) => n + found(R.id).length, 0) : 0;
		const sig = [getLang(), pl, run, done, sv, steps, si, items.join("|"), nJ, s && s.id].join("/");
		const clueBtn = `<button class="btn" data-a="clues">${L("Clues", "İpuçları")}${nJ ? " (" + nJ + ")" : ""}</button>`;
		const goBtn = `<button class="btn primary" data-a="go">${L(`Continue in room ${current() + 1}`, `${current() + 1}. odada devam et`)}</button>`;
		hud.classList.remove("hidden");
		if (sig !== hudSig) {
			hudSig = sig;
			const bar = `<div class="eh-rooms">${ROOMS.map((R, i) => `<i class="${i < sv ? "done" : i === sv && run ? "now" : ""}"></i>`).join("")}</div>`;
			let body;
			if (M) {
				const solvedHere = sv > ri;
				const next = ri + 1 < ROOMS.length ? nameOf(ROOMS[ri + 1].id) : null;
				const step = !run && !done ? `${TX(M.blurb)}<br><b>${ri === 0 ? L("Gather your team in here, then press Start.", "Ekibini buraya topla, sonra Başlat'a bas.") : ""}</b>`
					: done ? `<b>${L("Mission complete!", "Görev tamamlandı!")}</b> ${L("Play again from room 1: the codes will all be new.", "1. odadan tekrar oyna: bütün şifreler yeni olacak.")}`
						: solvedHere ? `<b>${L("Room solved!", "Oda çözüldü!")}</b> ${next ? L("The door to ", "Kapı açık: ") + next + L(" is open.", "") : L("The way out is open!", "Çıkış açık!")}`
							: `${L("Puzzle", "Bulmaca")} ${si + 1} / ${M.steps.length}: <b>${TX(M.steps[si].t)}</b>`;
				const btns = run ? `${solvedHere ? goBtn : `<button class="btn" data-a="hint">${L("Hint", "İpucu")} (G)</button>`}${clueBtn}<button class="btn ghost" data-a="quit">${L("Give up", "Vazgeç")}</button>`
					: ri === 0 ? `<button class="btn primary" data-a="start">${done ? L("Play again", "Tekrar oyna") : L("Start mission", "Görevi başlat")}</button>` : "";
				body = `<div class="eh-n">${L("Room", "Oda")} ${ri + 1} / 6</div><div class="eh-h"><b>${TX(M.name)}</b><span class="eh-st">${stars(M.stars)}</span></div>
					<div class="eh-t"><span></span><small>${run ? L("mission time", "görev süresi") : done ? L("escaped!", "kaçtınız!") : L("not started", "başlamadı")}</small></div>${bar}
					<div class="eh-step">${step}</div>${items.length ? `<div class="eh-inv">${items.map(x => `<span>${x}</span>`).join("")}</div>` : ""}
					<div class="eh-b">${btns}${langBtns()}</div>`;
			} else {
				const b = ctx.get(KEY + "best");
				const line = run ? L(`${esc(s.by)}'s team is on the mission: room ${current() + 1} of 6. Progress is saved, so anyone can go in and carry on.`, `${esc(s.by)} ve ekibi görevde: 6 odadan ${current() + 1}. İlerleme saklanıyor, herkes içeri girip devam edebilir.`) : done ? L("The last team escaped! Room 1 is open for a new mission.", "Son ekip kaçtı! 1. oda yeni bir görev için açık.") : L("Six linked rooms, one way out. Room 1 is off the corridor.", "Birbirine bağlı altı oda, tek çıkış. 1. oda koridorda.");
				body = `<div class="eh-h"><b>${L("Escape House", "Kaçış Evi")}</b></div><div class="eh-t"><span></span><small>${run ? L("mission time", "görev süresi") : done ? L("last escape", "son kaçış") : ""}</small></div>${bar}
					<div class="eh-step">${line}${b && b.t ? `<br>${L("Best time:", "En iyi süre:")} <b>${fmt(b.t)}</b>` : ""}</div>
					<div class="eh-b">${run ? goBtn + clueBtn : ""}<button class="btn" data-a="board">${L("Mission board", "Görev panosu")}</button>${langBtns()}</div>`;
			}
			hud.innerHTML = body;
		}
		const te = hud.querySelector(".eh-t span");
		if (te) te.textContent = run ? fmt(now() - s.at) : done ? fmt(s.t) : M ? "0:00" : "";
	}

	// ================================================================ every frame
	let prevKey, prevSolved, slow = 0, welcomed = false, evictT = 0;
	function transition(from, to, s) {
		if (to.indexOf("run:") === 0) {
			ctx.sfx("door", 0.8); setTimeout(() => ctx.sfx("thunk", 0.7), 250);
			ctx.toast(L("<b>The mission has started!</b> The glowing diamonds show what you can use: search everything, collect items and clues (they're all kept in the clue book, <b>F</b>), and crack each room's last lock to open the next. Your progress is saved, even if you leave.", "<b>Görev başladı!</b> Parlayan elmaslar kullanabileceğin şeyleri gösterir: her şeyi ara, eşyaları ve ipuçlarını topla (hepsi ipucu defterinde, <b>F</b>), sıradakini açmak için her odanın son kilidini kır. Çıksan bile ilerlemen saklanır."), null, null, 10000);
		} else if (to.indexOf("won:") === 0) {
			ctx.sfx("yes", 0.8); setTimeout(() => ctx.sfx("applause", 0.5), 300); ctx.doUpper("cheer", 2600);
			const b = ctx.get(KEY + "best");
			ctx.toast(L(`<b>You escaped the Escape House!</b> Time: ${fmt(s.t)}`, `<b>Kaçış Evi'nden kaçtınız!</b> Süre: ${fmt(s.t)}`) + (b && b.t === s.t ? L(" - a new best time!", " - yeni rekor!") : b ? L(` (best: ${fmt(b.t)})`, ` (rekor: ${fmt(b.t)})`) : ""), null, null, 10000);
		} else if (from && from.indexOf("run:") === 0) {
			ctx.sfx("door", 0.5); ctx.toast(L("The mission was called off: the doors reset.", "Görev iptal edildi: kapılar sıfırlandı."), null, null, 5000);
		}
	}
	function update(dt, t) {
		const pl = myPlace(), inside = pl !== null, s = st();
		const key = running() ? "run:" + s.id : won() ? "won:" + s.id : "idle", sv = solved();
		if (prevKey !== undefined && prevKey !== key && inside) transition(prevKey, key, s);
		if (prevSolved !== undefined && sv > prevSolved && running() && inside) {
			const next = sv < ROOMS.length ? nameOf(ROOMS[sv].id) : "";
			ctx.sfx("yes", 0.6);
			ctx.toast(L(`<b>Room ${sv} solved!</b> The door to room ${sv + 1}, ${next}, is open.`, `<b>${sv}. oda çözüldü!</b> ${sv + 1}. odanın (${next}) kapısı açık.`), null, null, 7000);
		}
		prevKey = key; prevSolved = sv;
		// somewhere you can't be (the mission was reset with you in a later room): back out to the corridor
		evictT -= dt;
		if (inside && !reachable(pl) && evictT <= 0) {
			const m = me();
			if (!m.sit) {
				evictT = 2;
				m.x = OX + 6.5; m.z = OZ; m.path = []; m.target = null; m.targetAct = null;
				ctx.toast(L("The mission reset, so you've been led back out to the corridor.", "Görev sıfırlandı, bu yüzden koridora geri çıkarıldın."), null, null, 6000);
			}
		}
		doorFx.forEach((F, i) => {
			F.k += ((doorOpen(i) ? 1 : 0) - F.k) * Math.min(1, dt * 4);
			F.piv.rotation.y = (F.ax ? -F.sw : F.sw) * 1.45 * smooth(F.k);
			F.lampM.color.set(doorOpen(i) ? "#5dff8a" : running() && i === 0 ? (Math.sin(t * 5) > 0 ? "#ff3a3a" : "#5a1010") : "#ff3a3a");
		});
		for (const R of ROOMS) { const fr = FR[R.id]; if (fr.anim) fr.anim(dt, t); markers(fr, t); }
		lobbyL.intensity = lobbyL.base * (0.96 + 0.04 * Math.sin(t * 1.3));
		slow -= dt;
		if (slow <= 0) { slow = 0.25; liveTexes.forEach(paint); renderHud(); }
	}

	return {
		update,
		onEnter() {
			if (welcomed) return;
			welcomed = true;
			ctx.toast(L("<b>Welcome to the Escape House!</b> Read the mission board, or ring the bell at the desk to hear how it works. (Türkçe için paneldeki TR'ye bas.)", "<b>Kaçış Evi'ne hoş geldin!</b> Görev panosunu oku ya da nasıl oynandığını öğrenmek için masadaki zili çal. (For English, press EN on the panel.)"), null, null, 9000);
		},
		onLeave() { hud.classList.add("hidden"); hudSig = ""; },
		// the shut doors are walls, and so are the vault's lasers while they're on
		solidAt(x, z, r) {
			const lx = x - OX, lz = z - OZ;
			if (lx < X0 - 1 || lx > LX + 1 || lz < Z0 - 1 || lz > Z1 + 1) return false;
			for (let i = 0; i < DOORS.length; i++) {
				const D = DOORS[i];
				if (doorFx[i].k > 0.5 && doorOpen(i)) continue;
				if (D.w === "x" ? Math.abs(lx - D.c) < DW + r && Math.abs(lz - D.p) < T / 2 + r : Math.abs(lz - D.c) < DW + r && Math.abs(lx - D.p) < T / 2 + r) { if (!doorOpen(i)) return true; }
			}
			for (const R of ROOMS) for (const S of FR[R.id].solids) if (S.on() && lx > S.r[0] - r && lx < S.r[1] + r && lz > S.r[2] - r && lz < S.r[3] + r) return true;
			return false;
		},
		promptOpts(opts) {
			const pl = myPlace(), free = key => !opts.some(o => o.k === key);
			if (pl === null) return;
			const rid = myRoom();
			// E: whatever you're right next to in the room (anywhere round it, not only on its one spot)
			const it = rid && free("E") ? nearestThing() : null;
			if (it) opts.unshift({ k: "E", label: it.d.label(), fn: () => { const m = me(), f = it.foot; m.h = Math.atan2((f[0] + f[1]) / 2 + OX - m.x, (f[2] + f[3]) / 2 + OZ - m.z); it.d.use(); } });
			if (rid && running() && free("G")) opts.push({ k: "G", label: L("Hint", "İpucu"), fn: () => hint(rid) });
			if (running() && ROOMS.some(R => found(R.id).length) && free("F")) opts.push({ k: "F", label: L("Clue book", "İpucu defteri"), fn: () => showClues(rid) });
		}
	};
}
