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

var KINDS = ["chat", "join", "leave", "rename", "prompt", "world", "edit", "delete"];
var MAX_TEXT = 4000;

// The name a chat line goes by for reactions/replies (same formula in roomChat.js).
function chatRef(ts, who) { return Math.round(+ts || 0).toString(36) + "." + String(who || "").slice(0, 64); }
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
	// Edits and deletes (backup server). A chat row keeps the text as first sent
	// in `text`; cur_text is what it says now, edited counts the edits and
	// deleted/deleted_by mark a removed line. Each edit/delete is also its own
	// row (kind edit/delete) pointing at the chat row through ref_id.
	[
		["msg_id", "TEXT NOT NULL DEFAULT ''"],      // the chat server's id for the line
		["cur_text", "TEXT NOT NULL DEFAULT ''"],
		["edited", "INTEGER NOT NULL DEFAULT 0"],
		["deleted", "INTEGER NOT NULL DEFAULT 0"],   // UTC ms when deleted
		["deleted_by", "TEXT NOT NULL DEFAULT ''"],
		["ref_id", "INTEGER NOT NULL DEFAULT 0"],
		["ref_name", "TEXT NOT NULL DEFAULT ''"],
		["ref_color", "TEXT NOT NULL DEFAULT ''"],
		["old_text", "TEXT NOT NULL DEFAULT ''"]
	].forEach(function (c) { if (cols.indexOf(c[0]) < 0) db.exec("ALTER TABLE messages ADD COLUMN " + c[0] + " " + c[1]); });
	db.exec("CREATE INDEX IF NOT EXISTS messages_msgid ON messages(room, msg_id); CREATE INDEX IF NOT EXISTS messages_ref ON messages(ref_id);");
	db.exec("CREATE INDEX IF NOT EXISTS messages_uid ON messages(uid, id); CREATE INDEX IF NOT EXISTS messages_name ON messages(name, id);");

	// A person, keyed by their stable id (the backup server derives it from the
	// browser token, so the same browser keeps one id across refreshes). The
	// server restores their last name/colour from here, and /manage tracks them.
	db.exec([
		"CREATE TABLE IF NOT EXISTS identities (",
		"  uid TEXT PRIMARY KEY,",
		"  name TEXT NOT NULL DEFAULT '',",
		"  color TEXT NOT NULL DEFAULT '',",
		"  first_ts INTEGER NOT NULL DEFAULT 0,",
		"  last_ts INTEGER NOT NULL DEFAULT 0",
		");",
		// Every IP a person has connected from (what /manage shows). Public-MPP
		// people get an IP too, via the relay connection their Harmony tab opens.
		"CREATE TABLE IF NOT EXISTS ips (",
		"  uid TEXT NOT NULL,",
		"  ip TEXT NOT NULL,",
		"  server TEXT NOT NULL DEFAULT '',",
		"  first_ts INTEGER NOT NULL DEFAULT 0,",
		"  last_ts INTEGER NOT NULL DEFAULT 0,",
		"  hits INTEGER NOT NULL DEFAULT 0,",
		"  PRIMARY KEY (uid, ip)",
		");",
		"CREATE INDEX IF NOT EXISTS ips_ip ON ips(ip);"
	].join("\n"));

	// Emoji reactions and reply links for the piano chat. A chat line is named by
	// its "ref": the chat server's timestamp + the sender's id, which every
	// visitor (and the stored row) agrees on. `by` is who reacted: their account.
	db.exec([
		"CREATE TABLE IF NOT EXISTS chat_reactions (",
		"  room TEXT NOT NULL,",
		"  ref TEXT NOT NULL,",
		"  emoji TEXT NOT NULL,",
		"  by TEXT NOT NULL,",
		"  name TEXT NOT NULL DEFAULT '',",
		"  ts INTEGER NOT NULL DEFAULT 0,",
		"  PRIMARY KEY (room, ref, emoji, by)",
		");",
		"CREATE TABLE IF NOT EXISTS chat_replies (",
		"  room TEXT NOT NULL,",
		"  ref TEXT NOT NULL,",            // the reply
		"  target TEXT NOT NULL,",         // the line it answers
		"  target_name TEXT NOT NULL DEFAULT '',",
		"  target_text TEXT NOT NULL DEFAULT '',",
		"  ts INTEGER NOT NULL DEFAULT 0,",
		"  PRIMARY KEY (room, ref)",
		");"
	].join("\n"));
	var stReactOn = db.prepare("INSERT OR IGNORE INTO chat_reactions (room, ref, emoji, by, name, ts) VALUES (?, ?, ?, ?, ?, ?)");
	var stReactOff = db.prepare("DELETE FROM chat_reactions WHERE room = ? AND ref = ? AND emoji = ? AND by = ?");
	var stReactCount = db.prepare("SELECT COUNT(DISTINCT emoji) AS n FROM chat_reactions WHERE room = ? AND ref = ? AND by = ?");
	var stReply = db.prepare(
		"INSERT INTO chat_replies (room, ref, target, target_name, target_text, ts) VALUES (?, ?, ?, ?, ?, ?) " +
		"ON CONFLICT(room, ref) DO NOTHING");

	var stInsert = db.prepare(
		"INSERT OR IGNORE INTO messages (room, kind, ts, uid, name, text, via, server, harmony, color, tz_known, dedup) " +
		"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
	var stSetColor = db.prepare("UPDATE messages SET color = ? WHERE dedup = ? AND color <> ?");
	var stByDedup = db.prepare("SELECT * FROM messages WHERE dedup = ?");
	var stByMsgId = db.prepare("SELECT * FROM messages WHERE room = ? AND msg_id = ? AND kind = 'chat' ORDER BY id LIMIT 1");
	var stSetColorId = db.prepare("UPDATE messages SET color = ? WHERE id = ?");
	var stSetMsgId =db.prepare("UPDATE messages SET msg_id = ? WHERE id = ? AND msg_id = ''");
	var stSetEdited = db.prepare("UPDATE messages SET cur_text = ?, edited = edited + 1 WHERE id = ?");
	var stSetDeleted = db.prepare("UPDATE messages SET deleted = ?, deleted_by = ? WHERE id = ?");
	var stSetRef = db.prepare("UPDATE messages SET ref_id = ?, ref_name = ?, ref_color = ?, old_text = ? WHERE id = ?");
	var stById = db.prepare("SELECT * FROM messages WHERE id = ?");
	var stRecent = db.prepare(
		"SELECT id FROM messages WHERE room = ? AND kind = ? AND (uid = ? OR (? = '' AND name = ?)) AND text = ? AND ts >= ? LIMIT 1");
	var stRecentPerson = db.prepare(
		"SELECT * FROM messages WHERE room = ? AND kind = ? AND ((? <> '' AND uid = ?) OR name = ?) AND ts >= ? ORDER BY id DESC LIMIT 1");
	var stSetVia = db.prepare("UPDATE messages SET via = ?, harmony = MAX(harmony, ?), uid = CASE WHEN uid = '' THEN ? ELSE uid END WHERE id = ?");
	// Upsert an identity: keep the first_ts, always move last_ts forward, and only
	// overwrite name/colour when the new one isn't blank.
	var stIdentity = db.prepare(
		"INSERT INTO identities (uid, name, color, first_ts, last_ts) VALUES (?, ?, ?, ?, ?) " +
		"ON CONFLICT(uid) DO UPDATE SET name = CASE WHEN ? <> '' THEN ? ELSE name END, " +
		"color = CASE WHEN ? <> '' THEN ? ELSE color END, last_ts = ?");
	var stIdentById = db.prepare("SELECT * FROM identities WHERE uid = ?");
	var stIp = db.prepare(
		"INSERT INTO ips (uid, ip, server, first_ts, last_ts, hits) VALUES (?, ?, ?, ?, ?, 1) " +
		"ON CONFLICT(uid, ip) DO UPDATE SET last_ts = ?, hits = hits + 1, server = CASE WHEN ? <> '' THEN ? ELSE server END");
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
	// Inserts an edit/delete row linked to the chat row it changed (orig may be
	// missing when the line was sent before the database existed).
	function insertRef(ev, orig, before) {
		var row = insert(ev, true);
		if (!row) return null;
		stSetRef.run(orig ? orig.id : 0, orig ? orig.name : "", orig ? orig.color : "", before || "", row.id);
		row = stById.get(row.id);
		emit(row);
		return row;
	}
	function seenRecently(room, kind, uid, name, text, windowMs) {
		return !!stRecent.get(room, kind, uid, uid, name, text, Date.now() - windowMs);
	}

	var api = {
		db: db,   // shared with server/accounts.js (same file)
		onRow: function (fn) { listeners.push(fn); },

		// A chat line. `t` is the chat server's timestamp when known (exact dedup);
		// without it we fall back to "same person, same text, recently".
		addChat: function (m) {
			var text = str(m.text).trim();
			var room = str(m.room, 120);
			if (!text || !room) return null;
			var uid = str(m.uid, 64), name = str(m.name, 120) || "?";
			var msgId = str(m.msgId, 64);
			// A line the chat server gave an id to is already stored: an edited copy
			// of it (sent again to newcomers in the room history) is not a new message.
			var known = msgId && stByMsgId.get(room, msgId);
			if (known) {
				var kc = color(m.color);
				if (m.fromTab && kc && known.color !== kc) {
					stSetColorId.run(kc, known.id);
					emit(Object.assign(stById.get(known.id), { updated: true }));
				}
				return null;
			}
			var t = +m.t;
			if (t > 1e12 && t < Date.now() + 864e5) {
				var key = "c|" + room + "|" + (uid || name) + "|" + Math.round(t) + "|" + hash(text);
				var row = insert({ room: room, kind: "chat", ts: t, uid: uid, name: name, text: text, server: m.server, color: m.color, dedup: key });
				if (msgId) {
					var target = row || stByDedup.get(key);
					if (target && stSetMsgId.run(msgId, target.id).changes && row) row.msg_id = msgId;
				}
				// Already stored (by the server or another tab): a piano tab knows the
				// colour people actually see (custom name colours), so it wins.
				var c = color(m.color);
				if (!row && m.fromTab && c && stSetColor.run(c, key, c).changes) emit(Object.assign(stByDedup.get(key), { updated: true }));
				return row;
			}
			if (seenRecently(room, "chat", uid, name, text, m.legacy ? 6 * 3600e3 : 180e3)) return null;
			return insert({ room: room, kind: "chat", ts: Date.now(), uid: uid, name: name, text: text, server: m.server, color: m.color });
		},

		// A chat line was edited (backup server). The chat row keeps the original
		// and gets the new text in cur_text; an "edit" row records who changed
		// what, with the text before and after.
		// `m.row` (a stored chat row) instead of msgId: a moderator's edit/delete of
		// a line from any server, found by its ref (see findByRef).
		addEdit: function (m) {
			var room = str(m.room, 120), msgId = str(m.msgId, 64), text = str(m.text).trim();
			if (!room || (!msgId && !m.row) || !text) return null;
			var orig = m.row || stByMsgId.get(room, msgId);
			var before = orig ? (orig.edited ? orig.cur_text : orig.text) : "";
			if (orig && before === text) return null;
			if (orig) {
				stSetEdited.run(text, orig.id);
				emit(Object.assign(stById.get(orig.id), { updated: true }));
			}
			return insertRef({ room: room, kind: "edit", ts: Date.now(), uid: m.uid, name: m.name, color: m.color, text: text, server: m.server }, orig, before);
		},
		addDelete: function (m) {
			var room = str(m.room, 120), msgId = str(m.msgId, 64);
			if (!room || (!msgId && !m.row)) return null;
			var orig = m.row || stByMsgId.get(room, msgId);
			if (orig && orig.deleted) return null;
			var now = Date.now();
			if (orig) {
				stSetDeleted.run(now, str(m.name, 120) || "?", orig.id);
				emit(Object.assign(stById.get(orig.id), { updated: true }));
			}
			var last = orig ? (orig.edited ? orig.cur_text : orig.text) : "";
			return insertRef({ room: room, kind: "delete", ts: now, uid: m.uid, name: m.name, color: m.color, text: last, server: m.server }, orig, last);
		},
		// The stored chat row a ref names (chat server time + sender id, or name
		// for old rows without an id).
		findByRef: function (room, ref) {
			var m = /^([0-9a-z]+)\.(.+)$/.exec(String(ref || ""));
			if (!m) return null;
			var ts = parseInt(m[1], 36);
			return db.prepare("SELECT * FROM messages WHERE room = ? AND kind = 'chat' AND ts = ? AND (uid = ? OR (uid = '' AND name = ?)) ORDER BY id LIMIT 1")
				.get(str(room, 120), ts, m[2], m[2]) || null;
		},
		// Every version of a chat line: the original, then each edit, then a delete.
		versions: function (id) {
			var orig = stById.get(+id);
			if (!orig) return null;
			return { message: orig, changes: db.prepare("SELECT * FROM messages WHERE ref_id = ? ORDER BY id").all(orig.id) };
		},

		// Someone arrived. Joins come from two places (the server watching who is in
		// each room, and the person's own tab, which also knows which site they
		// used) — within 2 minutes they are the same join, so merge them.
		addJoin: function (m) {
			var room = str(m.room, 120), uid = str(m.uid, 64), name = str(m.name, 120) || "?";
			if (!room) return null;
			// m.exact: a join the server itself made happen (mybot's Noob x_X) -
			// every one is real, never merged with an earlier one.
			var prev = m.exact ? null : stRecentPerson.get(room, "join", uid, uid, name, Date.now() - 120e3);
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
			if (!room || (!m.exact && stRecentPerson.get(room, "leave", uid, uid, name, Date.now() - 30e3))) return null;
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

		// ---- the piano's own chat history (what everyone in a room sees) ----
		// Chat lines, joins, leaves and name changes, newest first, `before` a row id.
		// Deleted lines are left out and edited ones show their current text,
		// with no marks — only /manage sees edit/delete history.
		history: function (room, before, limit) {
			room = str(room, 120);
			limit = Math.max(1, Math.min(+limit || 150, 500));
			var args = [room];
			var sql = "SELECT id, kind, ts, uid, name, text, cur_text, edited, deleted, color, msg_id FROM messages " +
				"WHERE room = ? AND kind IN ('chat', 'join', 'leave', 'rename') AND (deleted = 0 OR kind = 'chat')";
			if (+before > 0) { sql += " AND id < ?"; args.push(+before); }
			sql += " ORDER BY id DESC LIMIT " + (limit + 1);
			var stmt = db.prepare(sql);
			var rows = stmt.all.apply(stmt, args);
			var more = rows.length > limit;
			if (more) rows.pop();
			var out = rows.map(function (r) {
				// A deleted chat line comes back as just its ref, so a tab that already
				// shows it (the chat server's own replay) can drop it. No text, no name.
				if (r.kind === "chat" && r.deleted) return { id: r.id, kind: "chat", ts: r.ts, ref: chatRef(r.ts, r.uid || r.name), gone: true };
				var o = { id: r.id, kind: r.kind, ts: r.ts, uid: r.uid, name: r.name, color: r.color };
				if (r.kind === "chat") {
					o.text = r.edited ? r.cur_text : r.text;
					o.ref = chatRef(r.ts, r.uid || r.name);
					if (r.msg_id) o.msgId = r.msg_id;
				} else if (r.kind === "rename") {
					o.text = r.text;
				}
				return o;
			});
			var refs = out.filter(function (o) { return o.ref && !o.gone; }).map(function (o) { return o.ref; });
			return { rows: out, more: more, meta: api.chatMeta(room, refs) };
		},
		// A moderator hides a join / leave / name change from the piano chat. The
		// row stays (marked deleted) so /manage still sees it. Found by row id, or
		// for a note the piano made live, by kind + name + time (within 2 min).
		hideEvent: function (m) {
			var room = str(m.room, 120), kind = str(m.kind, 10);
			if (!room || ["join", "leave", "rename"].indexOf(kind) < 0) return null;
			var row = null;
			if (+m.id > 0) {
				row = stById.get(+m.id);
				if (row && (row.room !== room || row.kind !== kind)) row = null;
			} else {
				var ts = +m.ts || Date.now();
				// Nearest match within 2 minutes; a viewer whose clock is off gets the
				// nearest one within 12 hours instead.
				var near = db.prepare("SELECT * FROM messages WHERE room = ? AND kind = ? AND name = ? AND deleted = 0 AND ts BETWEEN ? AND ? " +
					"ORDER BY ABS(ts - ?) LIMIT 1");
				row = near.get(room, kind, str(m.name, 120), ts - 120e3, ts + 120e3, ts)
					|| near.get(room, kind, str(m.name, 120), ts - 432e5, ts + 432e5, ts);
			}
			if (!row) return null;
			if (!row.deleted) {
				stSetDeleted.run(Date.now(), str(m.by, 120) || "?", row.id);
				emit(Object.assign(stById.get(row.id), { updated: true }));
			}
			return stById.get(row.id);
		},
		// Reactions and reply links for a set of chat lines.
		chatMeta: function (room, refs) {
			var reactions = [], replies = [];
			for (var i = 0; i < refs.length; i += 400) {
				var part = refs.slice(i, i + 400);
				var marks = part.map(function () { return "?"; }).join(",");
				var s1 = db.prepare("SELECT ref, emoji, by, name, ts FROM chat_reactions WHERE room = ? AND ref IN (" + marks + ") ORDER BY ts");
				reactions = reactions.concat(s1.all.apply(s1, [room].concat(part)));
				var s2 = db.prepare("SELECT ref, target, target_name, target_text FROM chat_replies WHERE room = ? AND ref IN (" + marks + ")");
				replies = replies.concat(s2.all.apply(s2, [room].concat(part)));
			}
			return { reactions: reactions, replies: replies };
		},
		// One person toggles one emoji on one line. Returns true when it changed.
		setReaction: function (m) {
			var room = str(m.room, 120), ref = str(m.ref, 120), emoji = str(m.emoji, 32), by = str(m.by, 64);
			if (!room || !ref || !emoji || !by) return false;
			if (m.on) {
				if (stReactCount.get(room, ref, by).n >= 12) return false;   // a dozen different emoji per line each
				return stReactOn.run(room, ref, emoji, by, str(m.name, 120), Date.now()).changes > 0;
			}
			return stReactOff.run(room, ref, emoji, by).changes > 0;
		},
		setReply: function (m) {
			var room = str(m.room, 120), ref = str(m.ref, 120), target = str(m.target, 120);
			if (!room || !ref || !target || ref === target) return false;
			return stReply.run(room, ref, target, str(m.targetName, 120), str(m.targetText, 300), Date.now()).changes > 0;
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
				where.push("(name LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\' OR via LIKE ? ESCAPE '\\' OR cur_text LIKE ? ESCAPE '\\' OR old_text LIKE ? ESCAPE '\\' OR ref_name LIKE ? ESCAPE '\\')");
				args.push(like, like, like, like, like, like);
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

		// ---- identities & IPs ----
		// Remember who a person is and where they connected from. Called when a
		// browser says hello and whenever it sets its name/colour.
		rememberIdentity: function (m) {
			var uid = str(m.uid, 64);
			if (!uid) return;
			var now = Date.now(), name = str(m.name, 120), col = color(m.color), srv = str(m.server, 20);
			stIdentity.run(uid, name, col, now, now, name, name, col, col, now);
			var ip = str(m.ip, 64);
			if (ip && ip !== "?") stIp.run(uid, ip, srv, now, now, now, srv, srv);
		},
		// The saved name/colour for an id, so a reconnecting browser gets them back.
		getIdentity: function (uid) { return stIdentById.get(str(uid, 64)) || null; },
		// Full profile for /manage: identity, every IP, and totals from the chat log.
		profile: function (uid) {
			uid = str(uid, 64);
			if (!uid) return null;
			var ident = stIdentById.get(uid) || null;
			var ips = db.prepare("SELECT ip, server, first_ts, last_ts, hits FROM ips WHERE uid = ? ORDER BY last_ts DESC").all(uid);
			var agg = db.prepare(
				"SELECT COUNT(*) AS total, SUM(kind = 'chat') AS messages, SUM(kind = 'join') AS joins, " +
				"MIN(ts) AS first_ts, MAX(ts) AS last_ts FROM messages WHERE uid = ?").get(uid);
			var names = db.prepare("SELECT name, MAX(color) AS color, COUNT(*) AS n, MAX(ts) AS last_ts FROM messages WHERE uid = ? GROUP BY name ORDER BY n DESC LIMIT 50").all(uid);
			var rooms = db.prepare("SELECT room, COUNT(*) AS n, MAX(ts) AS last_ts FROM messages WHERE uid = ? GROUP BY room ORDER BY last_ts DESC LIMIT 100").all(uid);
			var recent = db.prepare("SELECT * FROM messages WHERE uid = ? ORDER BY id DESC LIMIT 60").all(uid).reverse();
			return { uid: uid, identity: ident, ips: ips, totals: agg, names: names, rooms: rooms, recent: recent };
		},
		// Everyone the chat log knows, newest activity first (the /manage people list).
		roster: function (o) {
			o = o || {};
			var limit = Math.max(1, Math.min(+o.limit || 500, 5000));
			var where = "uid <> ''", args = [];
			if (o.q) { where += " AND (name LIKE ? ESCAPE '\\\\' OR uid LIKE ? ESCAPE '\\\\')"; var like = "%" + String(o.q).replace(/[\\%_]/g, "\\$&") + "%"; args.push(like, like); }
			var sql = "SELECT uid, " +
				"(SELECT name FROM messages m2 WHERE m2.uid = m.uid AND m2.name <> '' ORDER BY m2.id DESC LIMIT 1) AS name, " +
				"(SELECT color FROM messages m3 WHERE m3.uid = m.uid AND m3.color <> '' ORDER BY m3.id DESC LIMIT 1) AS color, " +
				"COUNT(*) AS total, SUM(kind = 'chat') AS messages, MIN(ts) AS first_ts, MAX(ts) AS last_ts, " +
				"(SELECT COUNT(DISTINCT ip) FROM ips WHERE ips.uid = m.uid) AS ip_count " +
				"FROM messages m WHERE " + where + " GROUP BY uid ORDER BY last_ts DESC LIMIT " + limit;
			var stmt = db.prepare(sql);
			return args.length ? stmt.all.apply(stmt, args) : stmt.all();
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
