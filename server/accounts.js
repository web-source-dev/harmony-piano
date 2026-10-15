/**
 * User accounts (stored in the same SQLite file as the chat history).
 *
 * An admin creates an account on /manage with a name and a password. On the
 * piano the person types ONLY their password, so passwords are unique per
 * account. Nothing stores the password itself:
 *   - pw_key  = HMAC(server secret, password) -> finds the account (UNIQUE)
 *   - pw_hash = salted scrypt                 -> confirms it
 *
 * Every account has ONE fixed piano id (uid), so the same person is the same
 * person on any device or browser. Their browser settings (localStorage) are
 * saved here too and restored on whatever device they log in from.
 */
"use strict";

var crypto = require("crypto");

var NAME_MAX = 40;
var PW_MIN = 4;
var PW_MAX = 200;
var DATA_MAX = 2 * 1024 * 1024;   // saved browser settings per account
var LOGINS_KEPT = 200;            // login history rows kept per account

function str(v, max) { v = v == null ? "" : String(v); return max && v.length > max ? v.slice(0, max) : v; }
function color(v) { v = String(v || "").trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ""; }

function open(chatDb) {
	var db = chatDb && chatDb.db;
	if (!db) {
		console.error("  accounts: no database — user accounts are disabled (run `npm install`).");
		return null;
	}
	db.exec([
		"CREATE TABLE IF NOT EXISTS accounts (",
		"  id TEXT PRIMARY KEY,",
		"  name TEXT NOT NULL,",
		"  color TEXT NOT NULL DEFAULT '',",
		"  uid TEXT NOT NULL UNIQUE,",          // the fixed piano _id for this person
		"  pw_key TEXT NOT NULL UNIQUE,",
		"  pw_hash TEXT NOT NULL,",
		"  session_ver INTEGER NOT NULL DEFAULT 1,", // bumped on reset/disable: signs every device out
		"  disabled INTEGER NOT NULL DEFAULT 0,",
		"  data TEXT NOT NULL DEFAULT '',",      // JSON of their browser settings
		"  data_ts INTEGER NOT NULL DEFAULT 0,",
		"  created_ts INTEGER NOT NULL DEFAULT 0,",
		"  last_login_ts INTEGER NOT NULL DEFAULT 0,",
		"  last_seen_ts INTEGER NOT NULL DEFAULT 0,",
		"  last_ip TEXT NOT NULL DEFAULT '',",
		"  logins INTEGER NOT NULL DEFAULT 0",
		");",
		"CREATE TABLE IF NOT EXISTS account_logins (",
		"  id INTEGER PRIMARY KEY AUTOINCREMENT,",
		"  account_id TEXT NOT NULL,",
		"  ts INTEGER NOT NULL,",
		"  ip TEXT NOT NULL DEFAULT '',",
		"  ua TEXT NOT NULL DEFAULT ''",
		");",
		"CREATE INDEX IF NOT EXISTS account_logins_acct ON account_logins(account_id, id);",
		// Every piano id this account has shown up as (its own backup-server id,
		// and public-MPP ids seen through its Harmony tabs).
		"CREATE TABLE IF NOT EXISTS account_uids (",
		"  account_id TEXT NOT NULL,",
		"  uid TEXT NOT NULL,",
		"  server TEXT NOT NULL DEFAULT '',",
		"  first_ts INTEGER NOT NULL DEFAULT 0,",
		"  last_ts INTEGER NOT NULL DEFAULT 0,",
		"  PRIMARY KEY (account_id, uid)",
		");",
		"CREATE INDEX IF NOT EXISTS account_uids_uid ON account_uids(uid);"
	].join("\n"));

	// Server secret for pw_key and the login cookie. Made once, kept in the DB,
	// so it survives restarts and piano-password changes.
	var secretRow = db.prepare("SELECT v FROM meta WHERE k = 'account_secret'").get();
	var SECRET = secretRow && secretRow.v;
	if (!SECRET) {
		SECRET = crypto.randomBytes(32).toString("hex");
		db.prepare("INSERT INTO meta (k, v) VALUES ('account_secret', ?)").run(SECRET);
	}

	function pwKey(pw) { return crypto.createHmac("sha256", SECRET).update("pw|" + pw).digest("hex"); }
	function pwHash(pw) {
		var salt = crypto.randomBytes(16).toString("hex");
		return salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex");
	}
	function pwCheck(pw, stored) {
		var parts = String(stored || "").split(":");
		if (parts.length !== 2) return false;
		var a = Buffer.from(parts[1], "hex"), b = crypto.scryptSync(pw, parts[0], 32);
		return a.length === b.length && crypto.timingSafeEqual(a, b);
	}
	function sign(s) { return crypto.createHmac("sha256", SECRET).update("cookie|" + s).digest("hex"); }

	var stById = db.prepare("SELECT * FROM accounts WHERE id = ?");
	var stByKey = db.prepare("SELECT * FROM accounts WHERE pw_key = ?");
	var stSeen = db.prepare("UPDATE accounts SET last_seen_ts = ? WHERE id = ?");
	var stLinkUid = db.prepare(
		"INSERT INTO account_uids (account_id, uid, server, first_ts, last_ts) VALUES (?, ?, ?, ?, ?) " +
		"ON CONFLICT(account_id, uid) DO UPDATE SET last_ts = excluded.last_ts, " +
		"server = CASE WHEN excluded.server <> '' THEN excluded.server ELSE server END");

	function checkName(name) {
		name = str(name).trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
		if (!name) throw new Error("Give the user a name");
		return name;
	}
	function checkPassword(pw, exceptId) {
		pw = typeof pw === "string" ? pw : "";
		if (pw.length < PW_MIN) throw new Error("Password must be at least " + PW_MIN + " characters");
		if (pw.length > PW_MAX) throw new Error("Password is too long");
		var other = stByKey.get(pwKey(pw));
		// Users log in with the password alone, so two accounts can't share one.
		if (other && other.id !== exceptId) throw new Error("That password is already used by another user — pick a different one");
		return pw;
	}
	// What /manage sees about an account (never the hashes or saved data).
	function pub(a) {
		if (!a) return null;
		return {
			id: a.id, name: a.name, color: a.color, uid: a.uid, disabled: !!a.disabled,
			created_ts: a.created_ts, last_login_ts: a.last_login_ts, last_seen_ts: a.last_seen_ts,
			last_ip: a.last_ip, logins: a.logins, data_ts: a.data_ts, data_bytes: a.data.length
		};
	}

	return {
		DATA_MAX: DATA_MAX,

		list: function () {
			return db.prepare("SELECT * FROM accounts ORDER BY name COLLATE NOCASE").all().map(pub);
		},
		get: function (id) { return pub(stById.get(str(id, 64))); },
		detail: function (id) {
			var a = stById.get(str(id, 64));
			if (!a) return null;
			return {
				account: pub(a),
				logins: db.prepare("SELECT ts, ip, ua FROM account_logins WHERE account_id = ? ORDER BY id DESC LIMIT 50").all(a.id),
				uids: db.prepare("SELECT uid, server, first_ts, last_ts FROM account_uids WHERE account_id = ? ORDER BY last_ts DESC").all(a.id)
			};
		},
		create: function (o) {
			var name = checkName(o.name);
			var pw = checkPassword(o.password);
			var id = "a" + crypto.randomBytes(8).toString("hex");
			var uid = "u" + crypto.createHash("sha256").update("harmony-account|" + id).digest("hex").slice(0, 24);
			db.prepare(
				"INSERT INTO accounts (id, name, color, uid, pw_key, pw_hash, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)"
			).run(id, name, color(o.color), uid, pwKey(pw), pwHash(pw), Date.now());
			return pub(stById.get(id));
		},
		update: function (o) {
			var a = stById.get(str(o.id, 64));
			if (!a) throw new Error("No such user");
			if (o.name != null) db.prepare("UPDATE accounts SET name = ? WHERE id = ?").run(checkName(o.name), a.id);
			if (o.color != null) db.prepare("UPDATE accounts SET color = ? WHERE id = ?").run(color(o.color), a.id);
			if (o.password != null) {
				var pw = checkPassword(o.password, a.id);
				db.prepare("UPDATE accounts SET pw_key = ?, pw_hash = ?, session_ver = session_ver + 1 WHERE id = ?").run(pwKey(pw), pwHash(pw), a.id);
			}
			if (o.disabled != null) {
				db.prepare("UPDATE accounts SET disabled = ?, session_ver = session_ver + ? WHERE id = ?").run(o.disabled ? 1 : 0, o.disabled ? 1 : 0, a.id);
			}
			if (o.clearData) db.prepare("UPDATE accounts SET data = '', data_ts = 0 WHERE id = ?").run(a.id);
			return pub(stById.get(a.id));
		},
		remove: function (id) {
			id = str(id, 64);
			var n = db.prepare("DELETE FROM accounts WHERE id = ?").run(id).changes;
			db.prepare("DELETE FROM account_logins WHERE account_id = ?").run(id);
			db.prepare("DELETE FROM account_uids WHERE account_id = ?").run(id);
			return n;
		},

		// Password -> account (or null). Disabled accounts never match.
		login: function (pw, ip, ua) {
			if (typeof pw !== "string" || !pw || pw.length > PW_MAX) return null;
			var a = stByKey.get(pwKey(pw));
			if (!a || a.disabled || !pwCheck(pw, a.pw_hash)) return null;
			var now = Date.now();
			db.prepare("UPDATE accounts SET last_login_ts = ?, last_seen_ts = ?, last_ip = ?, logins = logins + 1 WHERE id = ?").run(now, now, str(ip, 64), a.id);
			db.prepare("INSERT INTO account_logins (account_id, ts, ip, ua) VALUES (?, ?, ?, ?)").run(a.id, now, str(ip, 64), str(ua, 300));
			db.prepare(
				"DELETE FROM account_logins WHERE account_id = ? AND id NOT IN " +
				"(SELECT id FROM account_logins WHERE account_id = ? ORDER BY id DESC LIMIT " + LOGINS_KEPT + ")").run(a.id, a.id);
			return stById.get(a.id);
		},
		// Signed cookie value: id.ver.nonce.sig — changing the password or
		// disabling the account bumps ver, which signs out every device.
		makeToken: function (a) {
			var body = a.id + "." + a.session_ver + "." + crypto.randomBytes(8).toString("hex");
			return body + "." + sign(body);
		},
		// Cookie value -> live account row (or null).
		fromToken: function (token) {
			var p = String(token || "").split(".");
			if (p.length !== 4) return null;
			var body = p[0] + "." + p[1] + "." + p[2];
			var good = sign(body);
			if (p[3].length !== good.length || !crypto.timingSafeEqual(Buffer.from(p[3]), Buffer.from(good))) return null;
			var a = stById.get(p[0]);
			if (!a || a.disabled || String(a.session_ver) !== p[1]) return null;
			return a;
		},
		touch: function (id) { stSeen.run(Date.now(), id); },
		linkUid: function (accountId, uid, server) {
			uid = str(uid, 64);
			if (!accountId || !uid) return;
			var now = Date.now();
			stLinkUid.run(accountId, uid, str(server, 20), now, now);
		},
		// Which account a piano id belongs to (for /manage People profiles).
		byUid: function (uid) {
			uid = str(uid, 64);
			var a = db.prepare("SELECT * FROM accounts WHERE uid = ?").get(uid);
			if (!a) {
				var link = db.prepare("SELECT account_id FROM account_uids WHERE uid = ? ORDER BY last_ts DESC LIMIT 1").get(uid);
				if (link) a = stById.get(link.account_id);
			}
			return a ? { id: a.id, name: a.name } : null;
		},

		getData: function (id) {
			var a = stById.get(str(id, 64));
			if (!a) return null;
			var data = null;
			try { data = a.data ? JSON.parse(a.data) : null; } catch (e) { data = null; }
			return { data: data, ts: a.data_ts };
		},
		setData: function (id, data) {
			if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Bad data");
			var clean = {};
			Object.keys(data).forEach(function (k) {
				if (typeof data[k] === "string" && k.length <= 200) clean[k] = data[k];
			});
			var json = JSON.stringify(clean);
			if (json.length > DATA_MAX) throw new Error("Saved settings are too big");
			var now = Date.now();
			db.prepare("UPDATE accounts SET data = ?, data_ts = ?, last_seen_ts = ? WHERE id = ?").run(json, now, now, str(id, 64));
			return now;
		}
	};
}

module.exports = { open: open };
