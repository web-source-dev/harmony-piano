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
	{ type: "rps", name: "Rock Paper Scissors", desc: "Best of luck, every round." }
];
const RPS = ["rock", "paper", "scissors"];

export function newGame(type, me, myName) {
	return {
		id: Math.random().toString(36).slice(2, 9),
		type,
		players: [me, null],
		names: [myName, ""],
		board: type === "ttt" ? Array(9).fill(-1) : type === "c4" ? Array(42).fill(-1) : null,
		turn: 0,
		winner: null,  // 0 | 1 | "draw"
		line: null,
		moves: 0
	};
}

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
	} else return null;
	n.turn = 1 - idx;
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
	} else if (g.type === "rps") {
		const sc = rpsScore(rps[0], rps[1]);
		c.font = "900 60px sans-serif"; c.fillStyle = P[0]; c.fillText(sc.score[0], w * 0.3, h / 2);
		c.fillStyle = "#fff"; c.fillText(":", w / 2, h / 2 - 4);
		c.fillStyle = P[1]; c.fillText(sc.score[1], w * 0.7, h / 2);
		c.font = "700 16px sans-serif"; c.fillStyle = "#cfc6ff"; c.fillText("ROUND " + (sc.rounds + 1), w / 2, h / 2 + 50);
	}
	c.font = "700 16px sans-serif";
	const nm = i => (g.players[i] === "cpu" ? "Computer" : g.names[i]) || "waiting...";
	c.fillStyle = P[0]; c.textAlign = "left"; c.fillText(nm(0), 10, h - 14);
	c.fillStyle = P[1]; c.textAlign = "right"; c.fillText(nm(1), w - 10, h - 14);
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

	const head = `<div class="g-players"><span class="g-p g-p0 ${g.turn === 0 && g.winner === null && g.type !== "rps" ? "on" : ""}">${esc(nm(0))}</span><span class="g-vs">vs</span><span class="g-p g-p1 ${g.turn === 1 && g.winner === null && g.type !== "rps" ? "on" : ""}">${esc(nm(1))}</span></div><div class="g-status">${esc(status)}</div>`;
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
