/**
 * Harmony World — arcade games.
 *
 * Game state lives in the shared world state (key "game"), so both people see
 * the same board on the arcade cabinet screen and in the popup. Only the player
 * whose turn it is writes a move, so turn-based games never conflict.
 * Rock-Paper-Scissors picks are simultaneous, so each player writes only their
 * own key ("rps0" / "rps1") and the score is derived from both lists.
 */
export const GAME_LIST = [
	{ type: "ttt", name: "Tic-Tac-Toe", desc: "Three in a row wins." },
	{ type: "c4", name: "Connect Four", desc: "Drop discs, line up four." },
	{ type: "gomoku", name: "Five in a Row", desc: "Tic-tac-toe on a big board - get five." },
	{ type: "rev", name: "Reversi", desc: "Trap their discs to flip them. Most discs wins." },
	{ type: "dots", name: "Dots and Boxes", desc: "Close a box to score it - and go again." },
	{ type: "mem", name: "Memory Match", desc: "Find the pairs. A match gives you another go." },
	{ type: "rps", name: "Rock Paper Scissors", desc: "Best of luck, every round." }
];
const RPS = ["rock", "paper", "scissors"];
// games won on points rather than on a line
const SCORED = ["rev", "dots", "mem"];
export const MEM_FACES = ["\u2764\ufe0f", "\ud83c\udf39", "\u2615", "\ud83c\udfb5", "\u2b50", "\ud83c\udf19", "\ud83c\udf53", "\ud83d\udc8c"];

export function newGame(type, me, myName) {
	const g = {
		id: Math.random().toString(36).slice(2, 9),
		type,
		players: [me, null],
		names: [myName, ""],
		board: type === "ttt" ? Array(9).fill(-1) : type === "c4" ? Array(42).fill(-1) : type === "gomoku" ? Array(100).fill(-1)
			: type === "rev" ? Array(64).fill(-1) : type === "dots" ? Array(40).fill(-1) : type === "mem" ? Array(16).fill(-1) : null,
		turn: 0,
		winner: null,  // 0 | 1 | "draw"
		line: null,
		moves: 0
	};
	if (SCORED.includes(type)) g.score = [0, 0];
	if (type === "rev") { g.board[27] = g.board[36] = 1; g.board[28] = g.board[35] = 0; g.score = [2, 2]; }
	if (type === "dots") g.boxes = Array(16).fill(-1);
	if (type === "mem") {
		const cards = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7];
		for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
		g.cards = cards; g.open = []; g.seen = [];
	}
	return g;
}
function byScore(s) { return s[0] === s[1] ? "draw" : s[0] > s[1] ? 0 : 1; }

// ---------- five in a row (10x10)
const GN = 10;
function gomokuLine(b, i, dr, dc) {
	const p = b[i], r0 = Math.floor(i / GN), c0 = i % GN, line = [i];
	for (const s of [1, -1]) for (let k = 1; k < 5; k++) {
		const r = r0 + dr * k * s, c = c0 + dc * k * s;
		if (r < 0 || r >= GN || c < 0 || c >= GN || b[r * GN + c] !== p) break;
		line.push(r * GN + c);
	}
	return line;
}
function gomokuWinner(b, last) {
	for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const l = gomokuLine(b, last, dr, dc); if (l.length >= 5) return { w: b[last], line: l }; }
	if (b.every(v => v >= 0)) return { w: "draw", line: null };
	return null;
}
// how good is playing cell i for player p (runs, and how open their ends are)
function gomokuValue(b, i, p) {
	const r0 = Math.floor(i / GN), c0 = i % GN;
	let v = 0;
	for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
		let n = 1, open = 0;
		for (const s of [1, -1]) {
			let k = 1;
			for (; k < 5; k++) { const r = r0 + dr * k * s, c = c0 + dc * k * s; if (r < 0 || r >= GN || c < 0 || c >= GN || b[r * GN + c] !== p) break; n++; }
			const r = r0 + dr * k * s, c = c0 + dc * k * s;
			if (r >= 0 && r < GN && c >= 0 && c < GN && b[r * GN + c] < 0) open++;
		}
		v += n >= 5 ? 1e6 : n === 4 ? (open ? 2e4 : 0) * (open === 2 ? 5 : 1) : n === 3 ? [0, 300, 3000][open] : n === 2 ? [0, 30, 120][open] : open * 4;
	}
	return v;
}

// ---------- reversi (8x8)
const DIR8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
function revFlips(b, i, p) {
	if (!(i >= 0 && i < 64) || b[i] !== -1) return [];
	const r0 = i >> 3, c0 = i & 7, out = [];
	for (const [dr, dc] of DIR8) {
		const run = [];
		let r = r0 + dr, c = c0 + dc;
		while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === 1 - p) { run.push(r * 8 + c); r += dr; c += dc; }
		if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === p) out.push(...run);
	}
	return out;
}
export function revMoves(b, p) { const m = []; for (let i = 0; i < 64; i++) if (revFlips(b, i, p).length) m.push(i); return m; }
function revCount(b) { return [b.filter(v => v === 0).length, b.filter(v => v === 1).length]; }

// ---------- dots and boxes: 4x4 boxes; edges 0-19 run across (5 rows of 4), 20-39 run down (4 rows of 5)
function boxEdges(k) { const r = Math.floor(k / 4), c = k % 4; return [r * 4 + c, (r + 1) * 4 + c, 20 + r * 5 + c, 20 + r * 5 + c + 1]; }
function edgeBoxes(e) {
	const out = [];
	if (e < 20) { const r = Math.floor(e / 4), c = e % 4; if (r > 0) out.push((r - 1) * 4 + c); if (r < 4) out.push(r * 4 + c); }
	else { const k = e - 20, r = Math.floor(k / 5), c = k % 5; if (c > 0) out.push(r * 4 + c - 1); if (c < 4) out.push(r * 4 + c); }
	return out;
}
const sidesTaken = (b, k) => boxEdges(k).filter(e => b[e] >= 0).length;

const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(b) {
	for (const l of TTT_LINES) if (b[l[0]] >= 0 && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { w: b[l[0]], line: l };
	if (b.every(v => v >= 0)) return { w: "draw", line: null };
	return null;
}
function c4Drop(b, col) {
	for (let r = 5; r >= 0; r--) if (b[r * 7 + col] < 0) return r * 7 + col;
	return -1;
}
function c4Winner(b) {
	const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
	for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
		const v = b[r * 7 + c];
		if (v < 0) continue;
		for (const [dr, dc] of dirs) {
			const line = [r * 7 + c];
			for (let k = 1; k < 4; k++) {
				const rr = r + dr * k, cc = c + dc * k;
				if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== v) break;
				line.push(rr * 7 + cc);
			}
			if (line.length === 4) return { w: v, line };
		}
	}
	if (b.every(v => v >= 0)) return { w: "draw", line: null };
	return null;
}

// Returns a new state, or null if the move isn't legal.
export function applyMove(g, idx, move) {
	if (!g || g.winner !== null || g.turn !== idx || !g.players[1]) return null;
	const n = JSON.parse(JSON.stringify(g));
	let again = false;
	if (g.type === "ttt") {
		if (n.board[move] !== -1) return null;
		n.board[move] = idx;
		const w = tttWinner(n.board);
		if (w) { n.winner = w.w; n.line = w.line; }
	} else if (g.type === "c4") {
		const cell = c4Drop(n.board, move);
		if (cell < 0) return null;
		n.board[cell] = idx;
		n.last = cell;
		const w = c4Winner(n.board);
		if (w) { n.winner = w.w; n.line = w.line; }
	} else if (g.type === "gomoku") {
		if (!(move >= 0 && move < 100) || n.board[move] !== -1) return null;
		n.board[move] = idx;
		n.last = move;
		const w = gomokuWinner(n.board, move);
		if (w) { n.winner = w.w; n.line = w.line; }
	} else if (g.type === "rev") {
		const flips = revFlips(n.board, move, idx);
		if (!flips.length) return null;
		n.board[move] = idx;
		flips.forEach(i => { n.board[i] = idx; });
		n.last = move;
		n.score = revCount(n.board);
		n.passed = false;
		if (!revMoves(n.board, 1 - idx).length) {
			// they can't move: you go again, or nobody can and it's over
			if (revMoves(n.board, idx).length) { again = true; n.passed = true; }
			else n.winner = byScore(n.score);
		}
	} else if (g.type === "dots") {
		if (!(move >= 0 && move < 40) || n.board[move] !== -1) return null;
		n.board[move] = idx;
		n.last = move;
		const closed = edgeBoxes(move).filter(k => n.boxes[k] < 0 && sidesTaken(n.board, k) === 4);
		closed.forEach(k => { n.boxes[k] = idx; n.score[idx]++; });
		again = closed.length > 0;
		if (n.board.every(v => v >= 0)) n.winner = byScore(n.score);
	} else if (g.type === "mem") {
		if (!(move >= 0 && move < 16) || n.board[move] >= 0) return null;
		if (n.open.length >= 2) n.open = [];   // the last miss gets turned back over
		if (n.open.includes(move)) return null;
		n.open.push(move);
		if (!n.seen.includes(move)) n.seen.push(move);
		if (n.open.length === 1) again = true;
		else if (n.cards[n.open[0]] === n.cards[n.open[1]]) {
			n.open.forEach(i => { n.board[i] = idx; });
			n.open = [];
			n.score[idx]++;
			again = true;
			if (n.board.every(v => v >= 0)) n.winner = byScore(n.score);
		}
	} else return null;
	if (!again) n.turn = 1 - idx;
	n.moves++;
	return n;
}

// Simple but not dumb: win if possible, block if needed, else prefer the center.
export function cpuMove(g) {
	const me = 1, them = 0;
	if (g.type === "ttt") {
		const free = g.board.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0);
		for (const who of [me, them]) for (const i of free) { const b = g.board.slice(); b[i] = who; const w = tttWinner(b); if (w && w.w === who) return i; }
		if (g.board[4] < 0) return 4;
		const corners = [0, 2, 6, 8].filter(i => g.board[i] < 0);
		if (corners.length && Math.random() < 0.8) return corners[Math.floor(Math.random() * corners.length)];
		return free[Math.floor(Math.random() * free.length)];
	}
	if (g.type === "c4") {
		const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => c4Drop(g.board, c) >= 0);
		for (const who of [me, them]) for (const c of cols) { const b = g.board.slice(); b[c4Drop(b, c)] = who; const w = c4Winner(b); if (w && w.w === who) return c; }
		// avoid handing the opponent a win on top of our disc
		const safe = cols.filter(c => {
			const b = g.board.slice(); b[c4Drop(b, c)] = me;
			const above = c4Drop(b, c);
			if (above < 0) return true;
			b[above] = them; const w = c4Winner(b); return !(w && w.w === them);
		});
		const pool = safe.length ? safe : cols;
		pool.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) + (Math.random() - 0.5) * 1.5);
		return pool[0];
	}
	const pick = a => a[Math.floor(Math.random() * a.length)];
	if (g.type === "gomoku") {
		const b = g.board;
		if (b.every(v => v < 0)) return 44 + Math.floor(Math.random() * 2) + GN * Math.floor(Math.random() * 2);
		let best = -1, bv = -1;
		for (let i = 0; i < 100; i++) {
			if (b[i] >= 0) continue;
			const r = Math.floor(i / GN), c = i % GN;
			let near = false;
			for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < GN && cc >= 0 && cc < GN && b[rr * GN + cc] >= 0) { near = true; break; } }
			if (!near) continue;
			const v = gomokuValue(b, i, me) * 1.1 + gomokuValue(b, i, them) + Math.random() * 8;
			if (v > bv) { bv = v; best = i; }
		}
		return best;
	}
	if (g.type === "rev") {
		const W = [100, -20, 10, 5, 5, 10, -20, 100, -20, -40, 1, 1, 1, 1, -40, -20, 10, 1, 3, 2, 2, 3, 1, 10, 5, 1, 2, 1, 1, 2, 1, 5];
		const weight = i => { const r = i >> 3, c = i & 7; return W[(r < 4 ? r : 7 - r) * 8 + c]; };
		let best = -1, bv = -1e9;
		for (const i of revMoves(g.board, me)) { const v = weight(i) + revFlips(g.board, i, me).length + Math.random() * 3; if (v > bv) { bv = v; best = i; } }
		return best;
	}
	if (g.type === "dots") {
		const free = g.board.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0);
		const closes = free.filter(e => edgeBoxes(e).some(k => sidesTaken(g.board, k) === 3));
		if (closes.length) return pick(closes);
		const safe = free.filter(e => edgeBoxes(e).every(k => sidesTaken(g.board, k) < 2));
		if (safe.length) return pick(safe);
		// everything hands over a box: give away as few as possible
		const cost = e => edgeBoxes(e).filter(k => sidesTaken(g.board, k) === 2).length;
		const least = Math.min(...free.map(cost));
		return pick(free.filter(e => cost(e) === least));
	}
	if (g.type === "mem") {
		const hidden = g.board.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0);
		const unseen = hidden.filter(i => !g.seen.includes(i));
		const known = hidden.filter(i => g.seen.includes(i));
		const first = g.open.length === 1 ? g.open[0] : null;
		// the computer's memory isn't perfect
		if (first !== null) {
			const mate = known.find(i => i !== first && g.cards[i] === g.cards[first]);
			if (mate !== undefined && Math.random() < 0.8) return mate;
			const rest = (unseen.length ? unseen : hidden).filter(i => i !== first);
			return pick(rest.length ? rest : hidden.filter(i => i !== first));
		}
		for (const a of known) { const b = known.find(i => i !== a && g.cards[i] === g.cards[a]); if (b !== undefined && Math.random() < 0.7) return a; }
		return pick(unseen.length ? unseen : hidden);
	}
	return RPS[Math.floor(Math.random() * 3)];
}

export function rpsResult(a, b) {
	if (a === b) return "draw";
	return (a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper") ? 0 : 1;
}
export function rpsScore(p0, p1) {
	const s = [0, 0], rounds = Math.min(p0.length, p1.length);
	for (let i = 0; i < rounds; i++) { const r = rpsResult(p0[i], p1[i]); if (r !== "draw") s[r]++; }
	return { score: s, rounds };
}

// ---------- drawing ----------
function rpsIconSVG(kind) {
	if (kind === "rock") return '<svg viewBox="0 0 64 64"><path d="M14 38c-2-10 4-20 14-22 6-2 10 0 14 2 8 2 12 10 10 18-2 10-10 16-20 16-10 0-16-4-18-14z" fill="#9aa0a6"/><path d="M22 26c4-2 8-2 12 0M30 40c4 0 8-2 10-6" stroke="#6b7177" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
	if (kind === "paper") return '<svg viewBox="0 0 64 64"><path d="M18 8h22l10 10v38H18z" fill="#fdfaf2" stroke="#b8b0a0" stroke-width="2"/><path d="M40 8v10h10" fill="#e8e0cf" stroke="#b8b0a0" stroke-width="2"/><path d="M24 28h20M24 36h20M24 44h14" stroke="#b8b0a0" stroke-width="2.5" stroke-linecap="round"/></svg>';
	return '<svg viewBox="0 0 64 64"><circle cx="20" cy="46" r="8" fill="none" stroke="#e05561" stroke-width="5"/><circle cx="44" cy="46" r="8" fill="none" stroke="#e05561" stroke-width="5"/><path d="M25 40L46 8M39 40L18 8" stroke="#7d8790" stroke-width="5" stroke-linecap="round"/></svg>';
}

// Paints the arcade cabinet's 3D screen.
export function drawArcade(canvas, g, rps, t) {
	const c = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
	c.fillStyle = "#0b0620"; c.fillRect(0, 0, w, h);
	// scanline glow grid
	c.strokeStyle = "rgba(120,80,255,0.12)"; c.lineWidth = 1;
	for (let y = (t * 20) % 16; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
	c.textAlign = "center"; c.textBaseline = "middle";
	if (!g) {
		c.fillStyle = "#ffd34f"; c.font = "900 34px 'Trebuchet MS', sans-serif";
		c.fillText("INSERT COIN", w / 2, h / 2 - 20 + Math.sin(t * 3) * 4);
		c.fillStyle = `rgba(65,224,255,${0.6 + Math.sin(t * 5) * 0.4})`; c.font = "700 18px sans-serif";
		c.fillText("walk up and press E to play", w / 2, h / 2 + 30);
		// little invaders marching
		for (let i = 0; i < 6; i++) {
			const x = ((t * 40 + i * 64) % (w + 40)) - 20, y = 40 + Math.sin(t * 2 + i) * 6;
			c.fillStyle = ["#ff4fa3", "#41e0ff", "#7ae582"][i % 3];
			c.fillRect(x - 10, y - 6, 20, 12); c.fillRect(x - 14, y + 2, 4, 8); c.fillRect(x + 10, y + 2, 4, 8);
			c.fillStyle = "#0b0620"; c.fillRect(x - 6, y - 2, 4, 4); c.fillRect(x + 2, y - 2, 4, 4);
		}
		return;
	}
	const P = ["#ff4fa3", "#41e0ff"];
	c.font = "800 18px sans-serif"; c.fillStyle = "#fff";
	const title = GAME_LIST.find(x => x.type === g.type).name.toUpperCase();
	c.fillText(title, w / 2, 18);
	if (g.type === "ttt") {
		const s = 70, ox = w / 2 - s * 1.5, oy = 40;
		c.strokeStyle = "#7c5cff"; c.lineWidth = 4;
		for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(ox + i * s, oy); c.lineTo(ox + i * s, oy + 3 * s); c.stroke(); c.beginPath(); c.moveTo(ox, oy + i * s); c.lineTo(ox + 3 * s, oy + i * s); c.stroke(); }
		g.board.forEach((v, i) => {
			if (v < 0) return;
			const cx = ox + (i % 3) * s + s / 2, cy = oy + Math.floor(i / 3) * s + s / 2;
			c.strokeStyle = P[v]; c.lineWidth = 7; c.lineCap = "round";
			if (v === 0) { c.beginPath(); c.moveTo(cx - 20, cy - 20); c.lineTo(cx + 20, cy + 20); c.moveTo(cx + 20, cy - 20); c.lineTo(cx - 20, cy + 20); c.stroke(); }
			else { c.beginPath(); c.arc(cx, cy, 21, 0, Math.PI * 2); c.stroke(); }
		});
	} else if (g.type === "c4") {
		const s = 34, ox = w / 2 - s * 3.5, oy = 36;
		c.fillStyle = "#2a3cff"; c.fillRect(ox - 6, oy - 6, s * 7 + 12, s * 6 + 12);
		for (let i = 0; i < 42; i++) {
			const v = g.board[i];
			c.fillStyle = v < 0 ? "#0b0620" : v === 0 ? "#ff4fa3" : "#ffd34f";
			c.beginPath(); c.arc(ox + (i % 7) * s + s / 2, oy + Math.floor(i / 7) * s + s / 2, s * 0.4, 0, Math.PI * 2); c.fill();
		}
	} else if (g.type === "gomoku" || g.type === "rev") {
		const N = g.type === "rev" ? 8 : GN, s = Math.floor((h - 64) / N), ox = Math.round(w / 2 - s * N / 2), oy = 34;
		c.fillStyle = g.type === "rev" ? "#1d7a4f" : "#d9b77a"; c.fillRect(ox, oy, s * N, s * N);
		c.strokeStyle = g.type === "rev" ? "#0d4a2e" : "#8a6a3c"; c.lineWidth = 1;
		for (let i = 0; i <= N; i++) { c.beginPath(); c.moveTo(ox + i * s, oy); c.lineTo(ox + i * s, oy + N * s); c.stroke(); c.beginPath(); c.moveTo(ox, oy + i * s); c.lineTo(ox + N * s, oy + i * s); c.stroke(); }
		g.board.forEach((v, i) => {
			if (v < 0) return;
			c.fillStyle = P[v];
			c.beginPath(); c.arc(ox + (i % N) * s + s / 2, oy + Math.floor(i / N) * s + s / 2, s * 0.4, 0, Math.PI * 2); c.fill();
			if (g.line && g.line.includes(i)) { c.strokeStyle = "#fff"; c.lineWidth = 3; c.stroke(); }
		});
	} else if (g.type === "dots") {
		const s = 46, ox = w / 2 - s * 2, oy = 40;
		g.boxes.forEach((v, k) => { if (v >= 0) { c.fillStyle = v === 0 ? "rgba(255,79,163,.45)" : "rgba(65,224,255,.45)"; c.fillRect(ox + (k % 4) * s + 3, oy + Math.floor(k / 4) * s + 3, s - 6, s - 6); } });
		c.lineWidth = 5; c.lineCap = "round";
		g.board.forEach((v, e) => {
			if (v < 0) return;
			c.strokeStyle = P[v]; c.beginPath();
			if (e < 20) { const r = Math.floor(e / 4), cc = e % 4; c.moveTo(ox + cc * s, oy + r * s); c.lineTo(ox + (cc + 1) * s, oy + r * s); }
			else { const k = e - 20, r = Math.floor(k / 5), cc = k % 5; c.moveTo(ox + cc * s, oy + r * s); c.lineTo(ox + cc * s, oy + (r + 1) * s); }
			c.stroke();
		});
		c.fillStyle = "#fff";
		for (let r = 0; r < 5; r++) for (let cc = 0; cc < 5; cc++) { c.beginPath(); c.arc(ox + cc * s, oy + r * s, 4, 0, Math.PI * 2); c.fill(); }
	} else if (g.type === "mem") {
		const cw = 52, ch = 52, gap = 6, ox = w / 2 - (cw * 4 + gap * 3) / 2, oy = 32;
		c.font = "28px sans-serif";
		for (let i = 0; i < 16; i++) {
			const x = ox + (i % 4) * (cw + gap), y = oy + Math.floor(i / 4) * (ch + gap);
			const up = g.board[i] >= 0 || g.open.includes(i);
			c.fillStyle = !up ? "#5b3fd1" : g.board[i] >= 0 ? (g.board[i] === 0 ? "#5a2343" : "#1d4a5a") : "#f7f1e3";
			c.fillRect(x, y, cw, ch);
			if (up) { c.fillStyle = "#000"; c.fillText(MEM_FACES[g.cards[i]], x + cw / 2, y + ch / 2 + 2); }
			else { c.fillStyle = "#ffd34f"; c.fillText("?", x + cw / 2, y + ch / 2 + 2); }
		}
	} else if (g.type === "rps") {
		const sc = rpsScore(rps[0], rps[1]);
		c.font = "900 60px sans-serif"; c.fillStyle = P[0]; c.fillText(sc.score[0], w * 0.3, h / 2);
		c.fillStyle = "#fff"; c.fillText(":", w / 2, h / 2 - 4);
		c.fillStyle = P[1]; c.fillText(sc.score[1], w * 0.7, h / 2);
		c.font = "700 16px sans-serif"; c.fillStyle = "#cfc6ff"; c.fillText("ROUND " + (sc.rounds + 1), w / 2, h / 2 + 50);
	}
	c.font = "700 16px sans-serif";
	const nm = i => (g.players[i] === "cpu" ? "Computer" : g.names[i]) || "waiting...";
	const pts = i => g.score ? "  " + g.score[i] : "";
	c.fillStyle = P[0]; c.textAlign = "left"; c.fillText(nm(0) + pts(0), 10, h - 14);
	c.fillStyle = P[1]; c.textAlign = "right"; c.fillText(pts(1).trim() + (g.score ? "  " : "") + nm(1), w - 10, h - 14);
	c.textAlign = "center";
	if (g.winner !== null) {
		c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(0, h / 2 - 26, w, 52);
		c.fillStyle = "#ffd34f"; c.font = "900 28px sans-serif";
		c.fillText(g.winner === "draw" ? "DRAW!" : (nm(g.winner) + " WINS!").toUpperCase(), w / 2, h / 2);
	}
}

// Renders the game popup body. ctx: { me, onMove(move), onJoin(), onCpu(), onRematch(), onNew(), rps:[[],[]] }
export function renderGame(el, g, ctx) {
	const myIdx = g.players[0] === ctx.me ? 0 : g.players[1] === ctx.me ? 1 : -1;
	const nm = i => (g.players[i] === "cpu" ? "Computer" : g.names[i]) || "Waiting for player...";
	const isMyTurn = myIdx >= 0 && g.turn === myIdx && g.winner === null && g.players[1];
	let status;
	if (!g.players[1]) status = myIdx === 0 ? "Waiting for someone to join..." : nm(0) + " wants to play!";
	else if (g.winner === "draw") status = "It's a draw!";
	else if (g.winner !== null) status = g.winner === myIdx ? "You win!" : nm(g.winner) + " wins!";
	else if (g.type === "rps") status = "Pick one - it's revealed when you both choose";
	else status = isMyTurn ? "Your turn" : nm(g.turn) + "'s turn";
	if (g.type === "rev" && g.passed && g.winner === null) status = nm(1 - g.turn) + " has no move - " + (isMyTurn ? "you go again" : nm(g.turn) + " goes again");
	if (g.type === "mem" && g.open.length === 1 && g.winner === null) status = isMyTurn ? "Now find its pair" : nm(g.turn) + " is looking for the pair";

	const pts = i => g.score ? ` <b class="g-pts">${g.score[i]}</b>` : "";
	const head = `<div class="g-players"><span class="g-p g-p0 ${g.turn === 0 && g.winner === null && g.type !== "rps" ? "on" : ""}">${esc(nm(0))}${pts(0)}</span><span class="g-vs">vs</span><span class="g-p g-p1 ${g.turn === 1 && g.winner === null && g.type !== "rps" ? "on" : ""}">${esc(nm(1))}${pts(1)}</span></div><div class="g-status">${esc(status)}</div>`;
	let body = "";
	if (g.type === "ttt") {
		body = `<div class="ttt">${g.board.map((v, i) => `<button class="ttt-c ${g.line && g.line.includes(i) ? "win" : ""}" data-mv="${i}" ${!isMyTurn || v >= 0 ? "disabled" : ""}>${v === 0 ? '<svg viewBox="0 0 40 40"><path d="M9 9L31 31M31 9L9 31" stroke="#ff4fa3" stroke-width="6" stroke-linecap="round"/></svg>' : v === 1 ? '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="none" stroke="#3ab0d8" stroke-width="6"/></svg>' : ""}</button>`).join("")}</div>`;
	} else if (g.type === "c4") {
		let cells = "";
		for (let i = 0; i < 42; i++) {
			const v = g.board[i];
			cells += `<div class="c4-c"><div class="c4-d ${v === 0 ? "p0" : v === 1 ? "p1" : ""} ${g.line && g.line.includes(i) ? "win" : ""} ${g.last === i ? "drop" : ""}"></div></div>`;
		}
		const btns = [0, 1, 2, 3, 4, 5, 6].map(c => `<button class="c4-col" data-mv="${c}" ${!isMyTurn || g.board[c] >= 0 ? "disabled" : ""} aria-label="Drop in column ${c + 1}"></button>`).join("");
		body = `<div class="c4"><div class="c4-cols">${btns}</div><div class="c4-grid">${cells}</div></div>`;
	} else if (g.type === "gomoku" || g.type === "rev") {
		const legal = g.type === "rev" && isMyTurn ? revMoves(g.board, myIdx) : null;
		body = `<div class="bgrid ${g.type}">${g.board.map((v, i) => {
			const ok = isMyTurn && (legal ? legal.includes(i) : v < 0);
			return `<button class="bc ${legal && ok ? "hint" : ""} ${g.line && g.line.includes(i) ? "win" : ""}" data-mv="${i}" ${ok ? "" : "disabled"}>${v >= 0 ? `<i class="st p${v} ${g.last === i ? "new" : ""}"></i>` : ""}</button>`;
		}).join("")}</div>`;
	} else if (g.type === "dots") {
		let cells = "";
		for (let R = 0; R < 9; R++) for (let C = 0; C < 9; C++) {
			if (R % 2 === 0 && C % 2 === 0) cells += `<i class="dt"></i>`;
			else if (R % 2 === 1 && C % 2 === 1) { const k = (R - 1) / 2 * 4 + (C - 1) / 2; cells += `<i class="bx ${g.boxes[k] >= 0 ? "p" + g.boxes[k] : ""}"></i>`; }
			else {
				const e = R % 2 === 0 ? R / 2 * 4 + (C - 1) / 2 : 20 + (R - 1) / 2 * 5 + C / 2;
				const v = g.board[e];
				cells += `<button class="eg ${R % 2 === 0 ? "h" : "v"} ${v >= 0 ? "p" + v : ""}" data-mv="${e}" ${isMyTurn && v < 0 ? "" : "disabled"} aria-label="line"></button>`;
			}
		}
		body = `<div class="dots">${cells}</div>`;
	} else if (g.type === "mem") {
		body = `<div class="mem">${g.cards.map((f, i) => {
			const up = g.board[i] >= 0 || g.open.includes(i);
			return `<button class="mc ${up ? "up" : ""} ${g.board[i] >= 0 ? "m" + g.board[i] : ""}" data-mv="${i}" ${isMyTurn && g.board[i] < 0 && !(g.open.length === 1 && g.open[0] === i) ? "" : "disabled"}>${up ? MEM_FACES[f] : ""}</button>`;
		}).join("")}</div>`;
	} else if (g.type === "rps") {
		const rps = ctx.rps;
		const sc = rpsScore(rps[0], rps[1]);
		const round = sc.rounds;
		const mine = myIdx >= 0 ? rps[myIdx][round] : null;
		const other = myIdx >= 0 ? rps[1 - myIdx][round] : null;
		const last = round > 0 ? [rps[0][round - 1], rps[1][round - 1]] : null;
		let reveal = "";
		if (last) {
			const r = rpsResult(last[0], last[1]);
			reveal = `<div class="rps-last"><div class="rps-hand">${rpsIconSVG(last[0])}<span>${esc(nm(0))}</span></div><div class="rps-res">${r === "draw" ? "Draw" : esc(nm(r)) + " takes round " + round}</div><div class="rps-hand">${rpsIconSVG(last[1])}<span>${esc(nm(1))}</span></div></div>`;
		}
		body = `<div class="rps"><div class="rps-score"><b class="c0">${sc.score[0]}</b> : <b class="c1">${sc.score[1]}</b></div>${reveal}
			<div class="rps-pick">${RPS.map(k => `<button class="rps-b ${mine === k ? "sel" : ""}" data-mv="${k}" ${myIdx < 0 || !g.players[1] || mine ? "disabled" : ""}>${rpsIconSVG(k)}<span>${k}</span></button>`).join("")}</div>
			<div class="g-note">${myIdx < 0 ? "" : mine ? (other ? "" : "Locked in. Waiting for the other pick...") : (other ? "They already picked!" : "")}</div></div>`;
	}
	let foot = "";
	if (!g.players[1] && myIdx !== 0) foot += `<button class="btn primary" data-act="join">Join game</button>`;
	if (!g.players[1] && myIdx === 0) foot += `<button class="btn" data-act="cpu">Play vs computer</button>`;
	if (g.winner !== null && myIdx >= 0) foot += `<button class="btn primary" data-act="rematch">Rematch</button>`;
	foot += `<button class="btn ghost" data-act="new">Other games</button>`;
	el.innerHTML = `<div class="game">${head}${body}<div class="g-foot">${foot}</div></div>`;
	el.querySelectorAll("[data-mv]").forEach(b => b.addEventListener("click", () => {
		const v = b.getAttribute("data-mv");
		ctx.onMove(g.type === "rps" ? v : parseInt(v, 10), myIdx);
	}));
	el.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
		const a = b.getAttribute("data-act");
		if (a === "join") ctx.onJoin(); else if (a === "cpu") ctx.onCpu(); else if (a === "rematch") ctx.onRematch(); else ctx.onNew();
	}));
}

export function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
