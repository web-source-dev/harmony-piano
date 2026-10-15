/**
 * Chat history database (SQLite via better-sqlite3 on Node 20+, or node:sqlite on 22.5+).
 *
 * Every chat line, join, leave, rename, corner-prompt reply and World chat line
 * is stored ONCE, with one true time:
 *   - Chat lines use the chat server's own timestamp `t` (the same for every
 *     visitor), and (room, sender, t, text) is a UNIQUE key. Ten open tabs
 *     reporting the same line, or a newcomer's browser replaying the history it
 *     was sent, all land on the same row.
 *   - Everything else is stamped with this server's clock (UTC ms), never a
 *     visitor's clock.
 *
 * File: <ROOT>/data/harmony.sqlite (blocked from static serving in relay-server.js).
 * The old chat-logs/*.txt files are imported once on first start and left on disk.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

// SQLite driver: the better-sqlite3 package (works on Node 20+; `npm install`
// on the server), or Node's built-in node:sqlite (Node 22.5+) if the package is
// missing. Both have the same prepare/run/get/all/exec API used below.
var DatabaseSync = null, DRIVER = "";
try {
	DatabaseSync = require("better-sqlite3");
	DRIVER = "better-sqlite3";
} catch (e) {
	try {
		var origEmit = process.emitWarning;
		// node:sqlite prints an "experimental" warning on load; keep the log clean.
		process.emitWarning = function (w) { if (String(w).indexOf("SQLite") >= 0) return; return origEmit.apply(process, arguments); };
		DatabaseSync = require("node:sqlite").DatabaseSync;
		DRIVER = "node:sqlite";
		process.emitWarning = origEmit;
	} catch (e2) {
		if (origEmit) process.emitWarning = origEmit;
	}
}

var KINDS = ["chat", "join", "leave", "rename", "prompt", "world"];
var MAX_TEXT = 4000;

function hash(s) { return crypto.createHash("sha1").update(String(s)).digest("hex").slice(0, 16); }
function color(v) { v = String(v || "").trim(); return /^#[0-9a-f]{3,8}$/i.test(v) ? v.toLowerCase() : ""; }
function str(v, max) { v = v == null ? "" : String(v); return max && v.length > max ? v.slice(0, max) : v; }

function open(rootDir, opts) {
	opts = opts || {};
	if (!DatabaseSync) {
		console.error("  chat DB: no SQLite driver — run `npm install` (better-sqlite3). Chat history is NOT being saved.");
		return null;
	}
	var dir = path.join(rootDir, "data");
	fs.mkdirSync(dir, { recursive: true });
	var db = new DatabaseSync(path.join(dir, "harmony.sqlite"));
	console.log("  chat DB: data/harmony.sqlite (" + DRIVER + ")");
	db.exec([
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"CREATE TABLE IF NOT EXISTS messages (",
		"  id INTEGER PRIMARY KEY AUTOINCREMENT,",
		"  room TEXT NOT NULL,",
		"  kind TEXT NOT NULL,",          // chat | join | leave | rename | prompt | world
		"  ts INTEGER NOT NULL,",         // UTC milliseconds
		"  uid TEXT NOT NULL DEFAULT '',", // the person's _id when known
		"  name TEXT NOT NULL DEFAULT '',",
		"  text TEXT NOT NULL DEFAULT '',",// message / new name for renames
		"  via TEXT NOT NULL DEFAULT '',", // site they used (joins)
		"  server TEXT NOT NULL DEFAULT '',", // mpp | backup | harmony | world
		"  harmony INTEGER NOT NULL DEFAULT 0,",
		"  color TEXT NOT NULL DEFAULT '',",  // the person's chat colour, as the piano shows it
		"  tz_known INTEGER NOT NULL DEFAULT 1,", // 0 = imported old line, visitor's clock (zone unknown)
		"  dedup TEXT UNIQUE",
		");",
		"CREATE INDEX IF NOT EXISTS messages_room_id ON messages(room, id);",
		"CREATE INDEX IF NOT EXISTS messages_room_ts ON messages(room, ts);",
		"CREATE INDEX IF NOT EXISTS messages_recent ON messages(room, kind, ts);",
		"CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);"
	].join("\n"));
	// Databases made before colours were stored.
	var cols = db.prepare("PRAGMA table_info(messages)").all().map(function (c) { return c.name; });
	if (cols.indexOf("color") < 0) db.exec("ALTER TABLE messages ADD COLUMN color TEXT NOT NULL DEFAULT ''");
	db.exec("CREATE INDEX IF NOT EXISTS messages_uid ON messages(uid, id); CREATE INDEX IF NOT EXISTS messages_name ON messages(name, id);");

	var stInsert = db.prepare(
		"INSERT OR IGNORE INTO messages (room, kind, ts, uid, name, text, via, server, harmony, color, tz_known, dedup) " +
		"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
	var stSetColor = db.prepare("UPDATE messages SET color = ? WHERE dedup = ? AND color <> ?");
	var stByDedup = db.prepare("SELECT * FROM messages WHERE dedup = ?");
	var stById = db.prepare("SELECT * FROM messages WHERE id = ?");
	var stRecent = db.prepare(
		"SELECT id FROM messages WHERE room = ? AND kind = ? AND (uid = ? OR (? = '' AND name = ?)) AND text = ? AND ts >= ? LIMIT 1");
	var stRecentPerson = db.prepare(
		"SELECT * FROM messages WHERE room = ? AND kind = ? AND ((? <> '' AND uid = ?) OR name = ?) AND ts >= ? ORDER BY id DESC LIMIT 1");
	var stSetVia = db.prepare("UPDATE messages SET via = ?, harmony = MAX(harmony, ?), uid = CASE WHEN uid = '' THEN ? ELSE uid END WHERE id = ?");
	var stMetaGet = db.prepare("SELECT v FROM meta WHERE k = ?");
	var stMetaSet = db.prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v");

	var listeners = [];
	function emit(row) { listeners.forEach(function (fn) { try { fn(row); } catch (e) {} }); }

	// Low-level insert. Returns the new row, or null when it was already stored.
	function insert(ev, silent) {
		if (KINDS.indexOf(ev.kind) < 0) return null;
		var r = stInsert.run(
			str(ev.room, 120) || "lobby", ev.kind, Math.round(+ev.ts) || Date.now(),
			str(ev.uid, 64), str(ev.name, 120), str(ev.text, MAX_TEXT), str(ev.via, 200),
			str(ev.server, 20), ev.harmony ? 1 : 0, color(ev.color), ev.tzKnown === false ? 0 : 1, ev.dedup || null);
		if (!r.changes) return null;
		var row = stById.get(r.lastInsertRowid);
		if (!silent) emit(row);
		return row;
	}
	function seenRecently(room, kind, uid, name, text, windowMs) {
		return !!stRecent.get(room, kind, uid, uid, name, text, Date.now() - windowMs);
	}

	var api = {
		onRow: function (fn) { listeners.push(fn); },

		// A chat line. `t` is the chat server's timestamp when known (exact dedup);
		// without it we fall back to "same person, same text, recently".
		addChat: function (m) {
			var text = str(m.text).trim();
			var room = str(m.room, 120);
			if (!text || !room) return null;
			var uid = str(m.uid, 64), name = str(m.name, 120) || "?";
			var t = +m.t;
			if (t > 1e12 && t < Date.now() + 864e5) {
				var key = "c|" + room + "|" + (uid || name) + "|" + Math.round(t) + "|" + hash(text);
				var row = insert({ room: room, kind: "chat", ts: t, uid: uid, name: name, text: text, server: m.server, color: m.color, dedup: key });
				// Already stored (by the server or another tab): a piano tab knows the
				// colour people actually see (custom name colours), so it wins.
				var c = color(m.color);
				if (!row && m.fromTab && c && stSetColor.run(c, key, c).changes) emit(Object.assign(stByDedup.get(key), { updated: true }));
				return row;
			}
			if (seenRecently(room, "chat", uid, name, text, m.legacy ? 6 * 3600e3 : 180e3)) return null;
			return insert({ room: room, kind: "chat", ts: Date.now(), uid: uid, name: name, text: text, server: m.server, color: m.color });
		},

		// Someone arrived. Joins come from two places (the server watching who is in
		// each room, and the person's own tab, which also knows which site they
		// used) — within 2 minutes they are the same join, so merge them.
		addJoin: function (m) {
			var room = str(m.room, 120), uid = str(m.uid, 64), name = str(m.name, 120) || "?";
			if (!room) return null;
			var prev = stRecentPerson.get(room, "join", uid, uid, name, Date.now() - 120e3);
			if (prev) {
				if (m.via && !prev.via) {
					stSetVia.run(str(m.via, 200), m.harmony ? 1 : 0, uid, prev.id);
					emit(Object.assign(stById.get(prev.id), { updated: true }));
				}
				return null;
			}
			return insert({ room: room, kind: "join", ts: m.ts || Date.now(), uid: uid, name: name, via: m.via, harmony: m.harmony, server: m.server, color: m.color });
		},
		addLeave: function (m) {
			var room = str(m.room, 120), uid = str(m.uid, 64), name = str(m.name, 120) || "?";
			if (!room || stRecentPerson.get(room, "leave", uid, uid, name, Date.now() - 30e3)) return null;
			return insert({ room: room, kind: "leave", ts: m.ts || Date.now(), uid: uid, name: name, server: m.server, color: m.color });
		},
		addRename: function (m) {
			var room = str(m.room, 120), uid = str(m.uid, 64), name = str(m.name, 120) || "?", to = str(m.text, 120);
			if (!room || !to || to === name || seenRecently(room, "rename", uid, name, to, 120e3)) return null;
			return insert({ room: room, kind: "rename", ts: Date.now(), uid: uid, name: name, text: to, via: m.via, harmony: m.harmony, server: m.server, color: m.color });
		},
		addPrompt: function (m) {
			var room = str(m.room, 120), uid = str(m.uid, 64), name = str(m.name, 120) || "?", text = str(m.text).trim();
			if (!room || !text || seenRecently(room, "prompt", uid, name, text, 120e3)) return null;
			return insert({ room: room, kind: "prompt", ts: Date.now(), uid: uid, name: name, text: text, server: m.server, color: m.color });
		},
		addWorld: function (m) {
			var text = str(m.text).trim();
			if (!text) return null;
			return insert({
				room: str(m.room, 120) || "lobby", kind: "world", ts: m.ts || Date.now(), uid: str(m.uid, 64),
				name: str(m.name, 120) || "?", text: text, server: "world", color: m.color, dedup: m.id ? "w|" + m.room + "|" + m.id : null
			});
		},

		// ---- reading (for /manage) ----
		rooms: function () {
			return db.prepare(
				"SELECT room, COUNT(*) AS total, SUM(kind IN ('chat','world','prompt')) AS messages, " +
				"SUM(kind = 'join') AS joins, MIN(ts) AS first_ts, MAX(ts) AS last_ts, MAX(id) AS last_id " +
				"FROM messages GROUP BY room ORDER BY last_id DESC").all();
		},
		// Newest-first page. before/after are row ids; kinds an array; q a search.
		query: function (o) {
			var where = [], args = [];
			if (o.room) { where.push("room = ?"); args.push(String(o.room)); }
			if (o.kinds && o.kinds.length) {
				var ks = o.kinds.filter(function (k) { return KINDS.indexOf(k) >= 0; });
				if (ks.length) { where.push("kind IN (" + ks.map(function () { return "?"; }).join(",") + ")"); args = args.concat(ks); }
			}
			if (o.before) { where.push("id < ?"); args.push(+o.before); }
			if (o.after) { where.push("id > ?"); args.push(+o.after); }
			if (o.from) { where.push("ts >= ?"); args.push(+o.from); }
			if (o.to) { where.push("ts < ?"); args.push(+o.to); }
			function likeOf(v) { return "%" + String(v).replace(/[\\%_]/g, "\\$&") + "%"; }
			if (o.q) {
				var like = likeOf(o.q);
				where.push("(name LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\' OR via LIKE ? ESCAPE '\\')");
				args.push(like, like, like);
			}
			if (o.person) {
				where.push("(uid = ? OR name LIKE ? ESCAPE '\\')");
				args.push(String(o.person), likeOf(o.person));
			}
			if (o.server) {
				// "harmony" = came through a Harmony tab; otherwise the chat server.
				if (o.server === "harmony") where.push("(harmony = 1 OR server = 'harmony')");
				else { where.push("server = ?"); args.push(String(o.server)); }
			}
			var limit = Math.max(1, Math.min(+o.limit || 300, 5000));
			var sql = "SELECT m.*, CASE WHEN m.color <> '' THEN m.color ELSE COALESCE(" +
				"(SELECT c.color FROM messages c WHERE m.uid <> '' AND c.uid = m.uid AND c.color <> '' ORDER BY c.id DESC LIMIT 1), " +
				"(SELECT c.color FROM messages c WHERE c.name = m.name AND c.color <> '' ORDER BY c.id DESC LIMIT 1), '') END AS color " +
				"FROM messages m" + (where.length ? " WHERE " + where.join(" AND ") : "") +
				(o.after ? " ORDER BY id ASC" : " ORDER BY id DESC") + " LIMIT " + (limit + 1);
			var stmt = db.prepare(sql);
			var rows = stmt.all.apply(stmt, args);
			var more = rows.length > limit;
			if (more) rows.pop();
			return { rows: rows, more: more };
		},
		// Names seen (most active first) — suggestions for the person filter.
		people: function (room) {
			var sql = "SELECT name, uid, MAX(color) AS color, COUNT(*) AS n, MAX(ts) AS last_ts FROM messages" +
				(room ? " WHERE room = ?" : "") + " GROUP BY name ORDER BY n DESC LIMIT 300";
			var stmt = db.prepare(sql);
			return room ? stmt.all(String(room)) : stmt.all();
		},
		count: function () { return db.prepare("SELECT COUNT(*) AS n FROM messages").get().n; },
		deleteWhere: function (o) {
			if (o.ids && o.ids.length) {
				var ids = o.ids.map(Number).filter(isFinite).slice(0, 5000);
				if (!ids.length) return 0;
				var del = db.prepare("DELETE FROM messages WHERE id IN (" + ids.map(function () { return "?"; }).join(",") + ")");
				return del.run.apply(del, ids).changes;
			}
			if (!o.room) throw new Error("Pick a room");
			return db.prepare("DELETE FROM messages WHERE room = ?").run(String(o.room)).changes;
		},

		meta: function (k, v) { if (v === undefined) { var r = stMetaGet.get(k); return r ? r.v : null; } stMetaSet.run(k, String(v)); },
		db: db
	};

	if (opts.importDir && api.meta("imported_txt_logs") !== "1") {
		try {
			var n = importTextLogs(api, insert, db, opts.importDir);
			console.log("  chat DB: imported " + n + " lines from old chat-logs/*.txt (duplicates removed)");
		} catch (e) {
			console.error("  chat DB: import of old text logs failed:", e && e.message || e);
		}
		api.meta("imported_txt_logs", "1");
	}
	return api;
}

// One-time import of the old chat-logs/*.txt files. Those files have the same
// line written by many tabs at different times, so duplicates are dropped by
// (room, kind, person, text, day). Lines without "UTC" were stamped with the
// visitor's own clock: kept with tz_known = 0 and their wall-clock numbers.
function importTextLogs(api, insert, db, dir) {
	var names = [];
	try { names = fs.readdirSync(dir); } catch (e) { return 0; }
	var STAMP = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})( UTC)?\] ?(.*)$/;
	var seen = Object.create(null), events = [], n = 0;
	names.sort().forEach(function (file) {
		var m = /^(.*)_(\d{4}-\d{2}-\d{2})(?:_(joins|prompts|world))?\.txt$/.exec(file);
		if (!m) return;
		var room = m[1], type = m[3] || "chat";
		var text;
		try { text = fs.readFileSync(path.join(dir, file), "utf8"); } catch (e) { return; }
		text.split(/\r?\n/).forEach(function (line) {
			var s = STAMP.exec(line);
			if (!s) return;
			var ts = Date.parse(s[1] + "T" + s[2] + "Z"), utc = !!s[3], body = s[4];
			if (!isFinite(ts)) return;
			var ev = { room: room, ts: ts, tzKnown: utc };
			if (type === "joins") {
				ev.harmony = body.indexOf("*** HARMONY *** ") === 0;
				if (ev.harmony) body = body.slice(16);
				var r = /^(.*) changed name to (.*?)(?: via (.*))?$/.exec(body);
				var j = /^(.*) joined(?: via (.*))?$/.exec(body);
				if (r) { ev.kind = "rename"; ev.name = r[1]; ev.text = r[2]; ev.via = r[3] || ""; }
				else if (j) { ev.kind = "join"; ev.name = j[1]; ev.via = j[2] || ""; }
				else return;
			} else if (type === "prompts") {
				var p = /^(.*?) sent reply: (.*)$/.exec(body);
				if (!p) return;
				ev.kind = "prompt"; ev.name = p[1]; ev.text = p[2];
			} else {
				var i = body.indexOf(": ");
				if (i <= 0) return;
				ev.kind = type === "world" ? "world" : "chat"; ev.name = body.slice(0, i); ev.text = body.slice(i + 2);
			}
			var key = [room, ev.kind, ev.name, ev.text || "", s[1]].join("\x1e");
			if (seen[key]) return;
			seen[key] = true;
			ev.dedup = "i|" + hash(key);
			events.push(ev);
		});
	});
	// Insert oldest first so row order matches time order.
	events.sort(function (a, b) { return a.ts - b.ts; });
	db.exec("BEGIN");
	try {
		events.forEach(function (ev) { if (insert(ev, true)) n++; });
		db.exec("COMMIT");
	} catch (e) {
		db.exec("ROLLBACK");
		throw e;
	}
	return n;
}

module.exports = { open: open };
