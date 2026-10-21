/**
 * RoomChat — the piano chat's full history, emoji reactions, replies and photos.
 *
 *  - History: every chat line, join and name change a room ever had comes from
 *    the server's chat database (GET /api/chat/history), newest page first;
 *    scrolling to the top of the chat loads older pages. Times show in the
 *    viewer's own time zone, with a date line between days. Deleted lines are
 *    not shown and edited lines show only their current text.
 *  - Reactions / replies: stored on the server (POST /api/chat/react|reply) and
 *    pushed to everyone in the room over the relay as "CX|{json}" lines.
 *  - Photos: uploaded to /api/chat/photo and sent as an ordinary chat line (the
 *    picture's link), so people on plain multiplayerpiano.com still get a link;
 *    Harmony shows the picture itself.
 *
 * A chat line is named by its "ref": the chat server's timestamp + the sender's
 * id (same formula as chatRef() in server/chatDb.js), which every visitor and
 * the stored copy agree on.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "CX|";
	var PAGE = 150;
	var FADE_LINES = 50;
	var PHOTO_RE = /^(?:https?:\/\/[^\s\/]+)?(\/chat-photos\/[a-f0-9]{16}\.(?:jpg|png|gif|webp))(?:\s+([\s\S]*))?$/i;
	var PHOTO_MAX_BYTES = 10 * 1024 * 1024;
	var PHOTO_MAX_SIDE = 1920;
	var QUICK_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎹"];
	var MORE_EMOJI = [
		"😀", "😁", "😅", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😇",
		"🤔", "🙄", "😏", "😴", "😭", "😡", "🤯", "😱", "🥺", "😬", "🤗", "🤝",
		"🙏", "👌", "✌️", "🤘", "💪", "👀", "💯", "✨", "🎉", "🎶", "🎵", "🎸",
		"🎤", "🎧", "🥁", "🎻", "🎺", "🌹", "🌈", "⭐", "☕", "🍕", "💀", "👎"
	];

	var opts = null;
	var $ul = null, logEl = null;
	var state = freshState();
	var historyGen = 0;
	var loading = false;
	var replyTarget = null;      // { ref, name, text }
	var pendingReplies = [];     // [{ text, target, at }] — matched to our own line when it comes back
	var $picker = null, pickerRef = null;
	var $jump = null;

	function freshState() {
		return {
			room: "",
			byRef: Object.create(null),     // ref -> <li>
			byText: Object.create(null),    // name|text -> [ts] (dedupe stored lines that lack the server's time)
			gone: Object.create(null),      // ref -> true: deleted by a moderator
			edits: Object.create(null),     // ref -> text: edited by a moderator
			reacts: Object.create(null),    // ref -> [{ emoji, people: { by: name } }]
			replies: Object.create(null),   // ref -> { ref, name, text }
			oldestId: 0,
			more: false,
			loaded: false
		};
	}

	function chatRef(t, who) {
		t = Math.round(+t || 0);
		if (!t || !who) return "";
		return t.toString(36) + "." + String(who).slice(0, 64);
	}
	function norm(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
	function client() { return opts && opts.client; }
	function roomId() {
		var c = client();
		return (c && c.channel && c.channel._id) || "";
	}
	function relayChannel() {
		var c = client();
		return (c && (c.desiredChannelId || (c.channel && c.channel._id))) || "";
	}
	function me() {
		var c = client();
		try { return (c && c.getOwnParticipant && c.getOwnParticipant()) || null; } catch (e) { return null; }
	}
	function isChatting() { return $("#chat").hasClass("chatting"); }
	function isMobile() { try { return !!(opts.isMobileLayout && opts.isMobileLayout()); } catch (e) { return false; } }

	// ---- time ----
	var timeFmt = null, fullFmt = null, dayFmt = null, dayFmtYear = null;
	try {
		timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
		fullFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
		dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
		dayFmtYear = new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
	} catch (e) {}
	function fmtTime(ts) { var d = new Date(ts); return timeFmt ? timeFmt.format(d) : d.toLocaleTimeString(); }
	function fmtFull(ts) { var d = new Date(ts); return fullFmt ? fullFmt.format(d) : d.toString(); }
	function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
	function dayLabel(ts) {
		var d = new Date(ts), now = new Date();
		if (dayKey(ts) === dayKey(now.getTime())) return "Today";
		var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
		if (dayKey(ts) === dayKey(y.getTime())) return "Yesterday";
		var f = d.getFullYear() === now.getFullYear() ? dayFmt : dayFmtYear;
		return f ? f.format(d) : d.toDateString();
	}

	// ---- building lines ----
	function timeSpan(ts) {
		return $('<span class="chat-time"/>').text(fmtTime(ts)).attr("title", fmtFull(ts));
	}
	function photoOf(text) {
		var m = PHOTO_RE.exec(String(text || "").trim());
		return m ? { src: m[1], caption: m[2] || "" } : null;
	}
	function snippet(text) {
		var p = photoOf(text);
		if (p) return "📷 Photo" + (p.caption ? " — " + p.caption : "");
		text = norm(text);
		return text.length > 120 ? text.slice(0, 117) + "…" : text;
	}
	function fillMessage($li, text) {
		var $msg = $li.children(".message");
		$li.children(".chat-photo").remove();
		var p = photoOf(text);
		if (!p) { $msg.text(text); return; }
		$msg.text(p.caption);
		var $a = $('<a class="chat-photo" target="_blank" rel="noopener"/>').attr("href", p.src);
		var img = new Image();
		img.alt = "Photo";
		img.loading = "lazy";
		img.decoding = "async";
		img.onload = function () { if (nearBottom(160)) scrollToBottom(); };
		img.onerror = function () { $a.addClass("broken").text(p.src); };
		img.src = p.src;
		$a.append(img);
		$msg.before($a);
	}
	function quoteEl(target) {
		var $q = $('<div class="chat-reply-quote" role="button" tabindex="-1"/>').attr("data-target", target.ref || "");
		$q.append($('<span class="chat-reply-arrow"/>').text("↪"));
		$q.append($('<span class="chat-reply-name"/>').text(target.name || "?"));
		$q.append($('<span class="chat-reply-text"/>').text(snippet(target.text)));
		$q.attr("title", "Go to the message");
		return $q;
	}
	function setQuote($li, target) {
		$li.children(".chat-reply-quote").remove();
		if (target) $li.prepend(quoteEl(target));
	}

	// msg: { p:{_id,name,color}, a, t, id }
	function buildChatLine(msg, ts) {
		var p = msg.p || {};
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		var $li = $('<li class="chat-line"><span class="name"/><span class="message"/></li>');
		var li = $li[0];
		li._ts = ts;
		li._name = p.name || "?";
		li._text = text;
		li._ref = chatRef(msg.t, p._id || p.name);
		$li.prepend(timeSpan(ts));
		$li.children(".name").text((p.name || "?") + ":");
		fillMessage($li, text);
		var color = opts.colorFor ? opts.colorFor(p) : (p.color || "white");
		$li.css("color", color || "white");
		if (msg.id != null) $li.attr("data-chat-id", String(msg.id));
		if (li._ref) {
			$li.attr("data-ref", li._ref);
			$li.append('<span class="chat-actions">' +
				'<button type="button" class="chat-act-react" title="React" aria-label="React with an emoji">☺</button>' +
				'<button type="button" class="chat-act-reply" title="Reply" aria-label="Reply to this message">↩</button>' +
			'</span>');
			$li.append('<div class="chat-reacts"/>');
			if (state.replies[li._ref]) setQuote($li, state.replies[li._ref]);
			renderReacts(li);
		}
		return $li;
	}
	function buildSystemLine(kind, ts, p, text) {
		var $li = $('<li class="chat-system"/>');
		var li = $li[0];
		li._ts = ts;
		li._kind = kind;
		li._name = p.name || "?";
		$li.addClass("chat-" + kind);
		// A centred note, so it never reads like someone's chat line.
		var $pill = $('<span class="chat-sys-pill"/>').appendTo($li);
		var color = opts.colorFor ? opts.colorFor(p) : (p.color || "");
		var $who = $('<span class="chat-sys-name"/>').text(p.name || "?").css("color", color || "");
		if (kind === "join") {
			$pill.append($('<span class="chat-sys-icon"/>').text("→"), $who, document.createTextNode(" joined the room"));
		} else if (kind === "leave") {
			$pill.append($('<span class="chat-sys-icon"/>').text("←"), $who, document.createTextNode(" left the room"));
		} else {
			$pill.append($('<span class="chat-sys-icon"/>').text("✎"), $who, document.createTextNode(" changed name to "),
				$('<span class="chat-sys-name"/>').text(text || "?").css("color", color || ""));
		}
		$pill.append(timeSpan(ts));
		// Chat moderators (#manage) can delete the note for everyone.
		$pill.append('<button type="button" class="chat-sys-del" title="Delete this for everyone" aria-label="Delete this for everyone">✕</button>');
		return $li;
	}

	// ---- placing lines (kept in time order; your own unsent lines stay last) ----
	function tsOf(el) { return el._ts == null ? Infinity : el._ts; }
	function insertSorted($li) {
		var li = $li[0], ts = li._ts, ul = $ul[0];
		var node = ul.lastElementChild;
		while (node && !node.classList.contains("chat-history-top") && tsOf(node) > ts) node = node.previousElementSibling;
		if (node) ul.insertBefore(li, node.nextSibling);
		else {
			var top = ul.querySelector(".chat-history-top");
			ul.insertBefore(li, top ? top.nextSibling : ul.firstChild);
		}
		return li;
	}
	function rebuildDays() {
		var ul = $ul[0];
		$(ul).children(".chat-day").remove();
		var last = "";
		var kids = Array.prototype.slice.call(ul.children);
		kids.forEach(function (el) {
			if (el._ts == null || !isFinite(el._ts)) return;
			var k = dayKey(el._ts);
			if (k !== last) { ul.insertBefore(dayLine(el._ts), el); last = k; }
		});
	}
	function dayLine(ts) {
		var li = $('<li class="chat-day"><span/></li>')[0];
		li._ts = ts;
		li._day = dayKey(ts);
		li.firstChild.textContent = dayLabel(ts);
		return li;
	}
	// A single new line: add a date line in front of it when its day differs.
	function fixDayBefore(li) {
		if (li._ts == null || !isFinite(li._ts)) return;
		var prev = li.previousElementSibling;
		while (prev && (prev._ts == null || !isFinite(prev._ts)) && !prev.classList.contains("chat-history-top")) prev = prev.previousElementSibling;
		var k = dayKey(li._ts);
		if (prev && prev.classList.contains("chat-day") && prev._day === k) return;
		if (prev && !prev.classList.contains("chat-history-top") && !prev.classList.contains("chat-day") && dayKey(prev._ts) === k) return;
		li.parentNode.insertBefore(dayLine(li._ts), li);
	}

	// Desktop (not typing): MPP-style overlay — the newest lines fade, older ones hide.
	function refreshFade(full) {
		var kids = $ul[0].children, n = kids.length;
		var stop = full ? 0 : Math.max(0, n - FADE_LINES - 2);
		for (var i = n - 1, k = 1; i >= stop; i--, k++) {
			var el = kids[i];
			if (k <= FADE_LINES) { el.style.display = ""; el.style.opacity = String(1 - k * 0.018); }
			else if (el.style.display !== "none") el.style.display = "none";
		}
	}

	function nearBottom(px) {
		if (!logEl) return true;
		return logEl.scrollTop >= logEl.scrollHeight - logEl.clientHeight - (px || 60);
	}
	function scrollToBottom() {
		if (!logEl) return;
		logEl.scrollTop = logEl.scrollHeight - logEl.clientHeight;
	}
	function afterAppend(wasNear) {
		refreshFade(false);
		if ((!isChatting() && !isMobile()) || wasNear) scrollToBottom();
		updateJump();
	}

	function isDupStored(name, text, ts) {
		var list = state.byText[name + "\x1e" + norm(text)];
		if (!list) return false;
		for (var i = 0; i < list.length; i++) if (Math.abs(list[i] - ts) < 5 * 60000) return true;
		return false;
	}
	function rememberText(name, text, ts) {
		var k = name + "\x1e" + norm(text);
		(state.byText[k] || (state.byText[k] = [])).push(ts);
	}
	function hasSystemNear(kind, name, ts) {
		var found = false;
		$ul.children(".chat-system").each(function () {
			if (this._kind === kind && this._name === name && Math.abs(this._ts - ts) < 120000) { found = true; return false; }
		});
		return found;
	}

	// ---- live chat (called from script.js for every line shown) ----
	function addMessage(msg, info) {
		info = info || {};
		var ts = +msg.t > 1e12 ? +msg.t : Date.now();
		var wasNear = nearBottom();
		var $li = buildChatLine(msg, ts);
		var li = $li[0];
		// A moderator deleted / edited it (the public server still replays the original).
		if (li._ref && state.gone[li._ref]) return $li;
		if (li._ref && state.edits[li._ref] != null) setLineText(li, state.edits[li._ref]);
		if (li._ref && state.byRef[li._ref] && state.byRef[li._ref].isConnected) {
			// Already shown (from the stored history): keep one copy.
			$(state.byRef[li._ref]).remove();
		}
		if (li._ref) state.byRef[li._ref] = li;
		rememberText(li._name, li._text, ts);
		insertSorted($li);
		fixDayBefore(li);
		var mine = me();
		if (!info.fromHistory && mine && msg.p && msg.p._id === mine._id && li._ref) claimReply(li);
		afterAppend(wasNear);
		return $li;
	}
	function addSystem(kind, p, text) {
		if (!$ul) return;
		var ts = Date.now();
		if (hasSystemNear(kind, p.name || "?", ts)) return;
		var wasNear = nearBottom();
		var $li = buildSystemLine(kind, ts, p, text);
		insertSorted($li);
		fixDayBefore($li[0]);
		afterAppend(wasNear);
	}

	// ---- stored history ----
	function topMarker() {
		var $top = $ul.children(".chat-history-top");
		if (!$top.length) $top = $('<li class="chat-history-top"/>').prependTo($ul);
		$top.empty();
		if (state.more) {
			$top.append($('<button type="button" class="chat-load-older"/>').text(loading ? "Loading…" : "Show earlier messages"));
		} else if (state.loaded) {
			$top.append($('<span/>').text("Beginning of the chat in " + (state.room || "this room")));
		}
		return $top;
	}
	function addRows(rows) {
		rows.forEach(function (r) {
			if (opts.isMuted && r.uid && opts.isMuted(r.uid)) return;
			var p = { _id: r.uid, name: r.name, color: r.color };
			var $li;
			if (r.kind === "chat") {
				if (r.gone) { removeChat(r.ref); return; }
				var shown = r.ref && state.byRef[r.ref];
				if (shown && shown.isConnected) {
					// Shown from the chat server's replay: the stored text is the current one.
					if (shown._text !== r.text) { state.edits[r.ref] = r.text; setLineText(shown, r.text); }
					return;
				}
				if (isDupStored(r.name, r.text, r.ts)) return;
				if (opts.isSyncText && opts.isSyncText(r.text)) return;
				$li = buildChatLine({ p: p, a: r.text, t: r.ts, id: r.msgId }, r.ts);
				if (r.ref) { $li.attr("data-ref", r.ref); $li[0]._ref = r.ref; state.byRef[r.ref] = $li[0]; }
				if (opts.decorate) opts.decorate($li, r.msgId);
				rememberText(r.name, r.text, r.ts);
			} else {
				if (hasSystemNear(r.kind, r.name, r.ts)) return;
				$li = buildSystemLine(r.kind, r.ts, p, r.text);
			}
			$li[0]._dbId = r.id;
			insertSorted($li);
		});
	}
	function applyMeta(meta) {
		if (!meta) return;
		(meta.replies || []).forEach(function (r) {
			state.replies[r.ref] = { ref: r.target, name: r.target_name, text: r.target_text };
			var li = state.byRef[r.ref];
			if (li && li.isConnected) setQuote($(li), state.replies[r.ref]);
		});
		var touched = Object.create(null);
		(meta.reactions || []).forEach(function (x) {
			setReact(x.ref, x.emoji, x.by, x.name, true);
			touched[x.ref] = true;
		});
		for (var ref in touched) { var li2 = state.byRef[ref]; if (li2) renderReacts(li2); }
	}
	function fetchHistory(before) {
		var room = state.room;
		var q = "/api/chat/history?room=" + encodeURIComponent(room) + "&limit=" + PAGE + (before ? "&before=" + before : "");
		return fetch(q, { credentials: "same-origin", cache: "no-store" }).then(function (r) {
			return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || "HTTP " + r.status); return d; });
		});
	}
	function loadLatest() {
		if (!$ul) return;
		var room = roomId();
		if (!room) return;
		state.room = room;
		var gen = ++historyGen;
		loading = true;
		fetchHistory(0).then(function (d) {
			if (gen !== historyGen || state.room !== room) return;
			if (d.me) state.me = d.me;
			if (opts.onPermission) opts.onPermission(!!d.canManage);
			var wasNear = nearBottom(200);
			addRows(d.rows);
			state.oldestId = d.rows.length ? d.rows[d.rows.length - 1].id : 0;
			state.more = !!d.more;
			state.loaded = true;
			loading = false;
			applyMeta(d.meta);
			topMarker();
			rebuildDays();
			refreshFade(true);
			if (wasNear || !isChatting()) scrollToBottom();
			updateJump();
		}).catch(function (e) {
			if (gen !== historyGen) return;
			loading = false;
			try { console.warn("[RoomChat] history unavailable:", e && e.message || e); } catch (x) {}
		});
	}
	function loadOlder() {
		if (loading || !state.more || !state.oldestId || !$ul) return;
		var gen = historyGen, room = state.room;
		loading = true;
		topMarker();
		fetchHistory(state.oldestId).then(function (d) {
			if (gen !== historyGen || state.room !== room) return;
			var fromBottom = logEl ? logEl.scrollHeight - logEl.scrollTop : 0;
			addRows(d.rows);
			if (d.rows.length) state.oldestId = d.rows[d.rows.length - 1].id;
			state.more = !!d.more;
			loading = false;
			applyMeta(d.meta);
			topMarker();
			rebuildDays();
			refreshFade(true);
			if (logEl) logEl.scrollTop = logEl.scrollHeight - fromBottom;
		}).catch(function () {
			loading = false;
			topMarker();
		});
	}

	// ---- reactions ----
	function setReact(ref, emoji, by, name, on) {
		var list = state.reacts[ref] || (state.reacts[ref] = []);
		var item = null;
		for (var i = 0; i < list.length; i++) if (list[i].emoji === emoji) { item = list[i]; break; }
		if (on) {
			if (!item) { item = { emoji: emoji, people: Object.create(null) }; list.push(item); }
			item.people[by] = name || "?";
		} else if (item) {
			delete item.people[by];
			if (!Object.keys(item.people).length) list.splice(list.indexOf(item), 1);
		}
	}
	function renderReacts(li) {
		var $box = $(li).children(".chat-reacts");
		if (!$box.length) return;
		$box.empty();
		var list = state.reacts[li._ref] || [];
		list.forEach(function (item) {
			var who = Object.keys(item.people);
			if (!who.length) return;
			var names = who.map(function (k) { return item.people[k]; });
			var $b = $('<button type="button" class="chat-react-chip"/>')
				.attr("data-emoji", item.emoji)
				.attr("title", names.join(", ") + " reacted with " + item.emoji)
				.toggleClass("mine", !!(state.me && item.people[state.me]));
			$b.append($('<span class="e"/>').text(item.emoji), $('<span class="n"/>').text(who.length));
			$box.append($b);
		});
		$box.toggleClass("has", list.length > 0);
	}
	function myName() {
		var m = me(), c = client();
		return (m && m.name) || (c && c.lastUserSet && c.lastUserSet.name) || "";
	}
	function toggleReact(ref, emoji) {
		var list = state.reacts[ref] || [];
		var mineNow = false;
		for (var i = 0; i < list.length; i++) if (list[i].emoji === emoji && state.me && list[i].people[state.me]) mineNow = true;
		var on = !mineNow, name = myName();
		if (state.me) {
			setReact(ref, emoji, state.me, name, on);
			var li = state.byRef[ref];
			if (li) renderReacts(li);
		}
		fetch("/api/chat/react", {
			method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ room: state.room || roomId(), ch: relayChannel(), ref: ref, emoji: emoji, on: on, name: name })
		}).then(function (r) { return r.json(); }).then(function (d) {
			if (d && d.me) {
				state.me = d.me;
				setReact(ref, emoji, d.me, name, on);
				var li2 = state.byRef[ref];
				if (li2) renderReacts(li2);
			}
		}).catch(function () {});
	}

	// ---- replies ----
	function setReplyTarget(li) {
		if (!li || !li._ref) return;
		replyTarget = { ref: li._ref, name: li._name, text: li._text };
		var $bar = $("#chat-reply-bar");
		$bar.find(".chat-reply-bar-name").text(li._name);
		$bar.find(".chat-reply-bar-text").text(snippet(li._text));
		$bar.removeAttr("hidden");
		document.body.classList.add("chat-replying");
		$("#chat-input-bar input").focus();
	}
	function clearReplyTarget() {
		replyTarget = null;
		$("#chat-reply-bar").attr("hidden", "hidden");
		document.body.classList.remove("chat-replying");
	}
	// Called just before a typed line is sent.
	function beforeSend(text) {
		if (!replyTarget) return;
		pendingReplies.push({ text: norm(text), target: replyTarget, at: Date.now() });
		if (pendingReplies.length > 20) pendingReplies.shift();
		clearReplyTarget();
	}
	function decoratePending($li, text) {
		for (var i = pendingReplies.length - 1; i >= 0; i--) {
			if (pendingReplies[i].text === norm(text)) { $li.prepend(quoteEl(pendingReplies[i].target)); return; }
		}
	}
	// Our own line came back from the chat server: it now has a ref, so the
	// reply link can be stored and shown to everyone.
	function claimReply(li) {
		var t = norm(li._text), now = Date.now();
		for (var i = 0; i < pendingReplies.length; i++) {
			var pr = pendingReplies[i];
			if (now - pr.at > 5 * 60000) { pendingReplies.splice(i--, 1); continue; }
			if (pr.text !== t) continue;
			pendingReplies.splice(i, 1);
			state.replies[li._ref] = pr.target;
			setQuote($(li), pr.target);
			fetch("/api/chat/reply", {
				method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ room: state.room || roomId(), ch: relayChannel(), ref: li._ref, target: pr.target.ref, targetName: pr.target.name, targetText: String(pr.target.text || "").slice(0, 300) })
			}).catch(function () {});
			return;
		}
	}
	function goToRef(ref) {
		var li = state.byRef[ref];
		if (!li || !li.isConnected || !logEl) return;
		li.style.display = "";
		var top = li.offsetTop - logEl.clientHeight / 3;
		logEl.scrollTop = Math.max(0, top);
		li.classList.remove("chat-flash");
		void li.offsetWidth;
		li.classList.add("chat-flash");
		setTimeout(function () { li.classList.remove("chat-flash"); }, 1600);
		updateJump();
	}

	// ---- moderators: edit / delete any chat line ----
	function setLineText(li, text) {
		li._text = text;
		fillMessage($(li), text);
	}
	function removeChat(ref) {
		if (!ref) return;
		state.gone[ref] = true;
		var li = state.byRef[ref];
		if (li && li.isConnected) {
			$(li).remove();
			if ($ul) { rebuildDays(); refreshFade(true); }
		}
	}
	function moderate(ref, action, text) {
		return fetch("/api/chat/moderate", {
			method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ room: state.room || roomId(), ch: relayChannel(), ref: ref, action: action, text: text || "" })
		}).then(function (r) {
			return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || "HTTP " + r.status); return d; });
		}).then(function (d) {
			if (action === "delete") removeChat(ref);
			else { state.edits[ref] = text; var li = state.byRef[ref]; if (li && li.isConnected) setLineText(li, text); }
			return d;
		});
	}

	// ---- deleted joins / leaves / name changes ----
	// A stored note goes by its row id; one this tab made live goes by kind +
	// name + time (the server matched it to the same stored row).
	function removeSystem(d) {
		if (!$ul) return;
		$ul.children(".chat-system").each(function () {
			var same = (d.id && this._dbId === d.id) ||
				(this._dbId == null && this._kind === d.kind && this._name === d.name && Math.abs(this._ts - d.ts) < 120000);
			if (same) $(this).remove();
		});
		rebuildDays();
		refreshFade(true);
	}
	function deleteSystem(li, $btn) {
		$btn.prop("disabled", true).text("…");
		fetch("/api/chat/hide-event", {
			method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ room: state.room || roomId(), ch: relayChannel(), kind: li._kind, id: li._dbId || 0, name: li._name, ts: li._ts })
		}).then(function (r) {
			return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || "HTTP " + r.status); return d; });
		}).then(function (d) {
			removeSystem({ id: d.id, kind: li._kind, name: li._name, ts: li._ts });
			$(li).remove();
		}).catch(function (e) {
			$btn.prop("disabled", false).removeClass("confirm").text("✕").attr("title", (e && e.message) || "Could not delete");
		});
	}

	// ---- relay sync (CX| lines) ----
	function isSyncText(text) { return typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0; }
	function handleSync(msg) {
		var text = msg && (msg.a != null ? msg.a : msg.message);
		if (!isSyncText(text)) return false;
		var d;
		try { d = JSON.parse(text.slice(SYNC_PREFIX.length)); } catch (e) { return true; }
		if (!d || (state.room && d.room !== state.room)) return true;
		if (d.t === "r" && d.ref && d.emoji && d.by) {
			setReact(d.ref, d.emoji, d.by, d.name, !!d.on);
			var li = state.byRef[d.ref];
			if (li) renderReacts(li);
		} else if (d.t === "e" && d.ref && typeof d.text === "string") {
			state.edits[d.ref] = d.text;
			var le = state.byRef[d.ref];
			if (le && le.isConnected) setLineText(le, d.text);
		} else if (d.t === "d" && d.ref) {
			removeChat(d.ref);
		} else if (d.t === "x") {
			removeSystem(d);
		} else if (d.t === "m" && typeof d.text === "string" && d.ts && d.uid) {
			if (opts.onSay && !state.gone[chatRef(d.ts, d.uid)]) opts.onSay(d);
		} else if (d.t === "p" && d.ref && d.target) {
			state.replies[d.ref] = { ref: d.target, name: d.targetName, text: d.targetText };
			var li2 = state.byRef[d.ref];
			if (li2 && li2.isConnected) setQuote($(li2), state.replies[d.ref]);
		}
		return true;
	}

	// ---- emoji picker ----
	function ensurePicker() {
		if ($picker) return $picker;
		$picker = $('<div id="chat-emoji-picker" role="dialog" aria-label="Pick a reaction" hidden><div class="quick"/><div class="more"/></div>');
		QUICK_EMOJI.forEach(function (e) { $picker.children(".quick").append($('<button type="button"/>').text(e).attr("data-emoji", e)); });
		$picker.children(".quick").append('<button type="button" class="chat-emoji-more" title="More emoji" aria-label="More emoji">＋</button>');
		MORE_EMOJI.forEach(function (e) { $picker.children(".more").append($('<button type="button"/>').text(e).attr("data-emoji", e)); });
		$("#chat").append($picker);
		$picker.on("click", "button[data-emoji]", function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (pickerRef) toggleReact(pickerRef, this.getAttribute("data-emoji"));
			closePicker();
		});
		$picker.on("click", ".chat-emoji-more", function (e) {
			e.preventDefault();
			e.stopPropagation();
			$picker.toggleClass("expanded");
			placePicker(pickerAnchor);
		});
		return $picker;
	}
	var pickerAnchor = null;
	function placePicker(anchor) {
		if (!$picker || !anchor) return;
		var r = anchor.getBoundingClientRect();
		var w = $picker.outerWidth(), h = $picker.outerHeight();
		var left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
		var top = r.top - h - 6;
		if (top < 8) top = r.bottom + 6;
		$picker.css({ left: left + "px", top: top + "px" });
	}
	function openPicker(ref, anchor) {
		ensurePicker();
		pickerRef = ref;
		pickerAnchor = anchor;
		$picker.removeClass("expanded").removeAttr("hidden");
		placePicker(anchor);
	}
	function closePicker() {
		if ($picker) $picker.attr("hidden", "hidden");
		pickerRef = null;
		pickerAnchor = null;
	}

	// ---- photos ----
	function lightbox(src) {
		var $lb = $("#chat-lightbox");
		if (!$lb.length) {
			$lb = $('<div id="chat-lightbox" role="dialog" aria-label="Photo" hidden>' +
				'<img alt="Photo"/>' +
				'<div class="chat-lightbox-bar"><a class="chat-lightbox-open" target="_blank" rel="noopener">Open original</a>' +
				'<button type="button" class="chat-lightbox-close">Close</button></div></div>').appendTo(document.body);
			$lb.on("click", function (e) {
				if ($(e.target).closest("a").length) return;
				$lb.attr("hidden", "hidden");
			});
		}
		$lb.find("img").attr("src", src);
		$lb.find(".chat-lightbox-open").attr("href", src);
		$lb.removeAttr("hidden");
	}
	// Shrinks big pictures before upload (phones take 4000px+ photos).
	function preparePhoto(file) {
		return new Promise(function (resolve, reject) {
			if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) return reject(new Error("Pick a JPG, PNG, GIF or WebP picture."));
			if (file.type === "image/gif") {
				if (file.size > PHOTO_MAX_BYTES) return reject(new Error("That GIF is too big (max 10 MB)."));
				return resolve(file);
			}
			var url = URL.createObjectURL(file);
			var img = new Image();
			img.onload = function () {
				URL.revokeObjectURL(url);
				var w = img.naturalWidth, h = img.naturalHeight;
				var scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(w, h));
				if (scale === 1 && file.size <= 1.5 * 1024 * 1024) return resolve(file);
				var c = document.createElement("canvas");
				c.width = Math.max(1, Math.round(w * scale));
				c.height = Math.max(1, Math.round(h * scale));
				var g = c.getContext("2d");
				var keepPng = file.type === "image/png";
				if (!keepPng) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
				g.drawImage(img, 0, 0, c.width, c.height);
				c.toBlob(function (blob) {
					if (!blob) return resolve(file);
					if (keepPng && blob.size > 4 * 1024 * 1024) {
						g.globalCompositeOperation = "destination-over";
						g.fillStyle = "#fff";
						g.fillRect(0, 0, c.width, c.height);
						c.toBlob(function (jpg) { resolve(jpg || blob); }, "image/jpeg", 0.86);
						return;
					}
					resolve(blob.size < file.size ? blob : file);
				}, keepPng ? "image/png" : "image/jpeg", 0.86);
			};
			img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read that picture.")); };
			img.src = url;
		}).then(function (blob) {
			if (blob.size > PHOTO_MAX_BYTES) throw new Error("That picture is too big (max 10 MB).");
			return blob;
		});
	}
	function uploadPhoto(blob, onProgress) {
		return new Promise(function (resolve, reject) {
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "/api/chat/photo");
			xhr.setRequestHeader("Content-Type", blob.type || "image/jpeg");
			xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
			xhr.onload = function () {
				var d = null;
				try { d = JSON.parse(xhr.responseText); } catch (e) {}
				if (xhr.status === 200 && d && d.ok && d.url) resolve(d.url);
				else reject(new Error((d && d.error) || (xhr.status === 413 ? "That picture is too big." : "Upload failed (" + xhr.status + ")")));
			};
			xhr.onerror = function () { reject(new Error("Upload failed — check your connection.")); };
			xhr.send(blob);
		});
	}
	function sendPhoto(file) {
		var c = client();
		if (!c || !file || !$ul) return;
		var $input = $("#chat-input-bar input");
		var caption = norm($input.val());
		$input.val("");
		var $li = $('<li class="chat-pending chat-uploading"><span class="name"/><span class="message"/><span class="chat-pending-state"/></li>');
		$li.find(".name").text((myName() || "You") + ":");
		$li.find(".message").text("📷 " + (file.name || "Photo"));
		$li.find(".chat-pending-state").text(" preparing…");
		if (replyTarget) $li.prepend(quoteEl(replyTarget));
		$ul.append($li);
		scrollToBottom();
		preparePhoto(file).then(function (blob) {
			$li.find(".chat-pending-state").text(" uploading…");
			return uploadPhoto(blob, function (f) { $li.find(".chat-pending-state").text(" uploading… " + Math.round(f * 100) + "%"); });
		}).then(function (path) {
			$li.remove();
			var text = (location.origin || "") + path;
			if (caption) text = (text + " " + caption).slice(0, 512);
			beforeSend(text);
			c.sendChat(text);
		}).catch(function (err) {
			$li.removeClass("chat-pending chat-uploading").addClass("chat-failed");
			$li.find(".chat-pending-state").text(" — " + (err && err.message || "upload failed") + " (click to dismiss)");
			$li.one("click", function () { $li.remove(); });
			if (caption && !$input.val()) $input.val(caption);
		});
	}
	function imageFromTransfer(dt) {
		if (!dt) return null;
		var items = dt.items || [];
		for (var i = 0; i < items.length; i++) {
			if (items[i].kind === "file" && /^image\//.test(items[i].type)) return items[i].getAsFile();
		}
		var files = dt.files || [];
		for (var j = 0; j < files.length; j++) if (/^image\//.test(files[j].type)) return files[j];
		return null;
	}

	// ---- jump to newest ----
	function updateJump() {
		if (!$jump || !logEl) return;
		var away = logEl.scrollHeight - logEl.clientHeight - logEl.scrollTop;
		$jump.toggleClass("show", away > 240 && (isChatting() || isMobile()));
	}

	// ---- live joins / renames ----
	function watchPresence(c) {
		var known = Object.create(null);
		function skip(part) {
			if (!part) return true;
			if (global.Client && Client.isLobbyNoobParticipant && Client.isLobbyNoobParticipant(part)) return true;
			return part.id === c.participantId;
		}
		c.on("room participants sync", function (ppl) {
			known = Object.create(null);
			(ppl || []).forEach(function (p) { if (p && p.id != null) known[p.id] = true; });
		});
		c.on("participant added", function (part) {
			if (!part || part.id == null || known[part.id]) return;
			known[part.id] = true;
			if (skip(part)) return;
			if (opts.isMuted && opts.isMuted(part._id)) return;
			addSystem("join", part);
		});
		// Only a "bye" from the server is someone leaving; participants are also
		// dropped when WE change rooms or resync, which is not a leave.
		var lastRemoved = null;
		c.on("participant removed", function (part) {
			if (part && part.id != null) delete known[part.id];
			lastRemoved = part || null;
		});
		c.on("bye", function (msg) {
			var part = lastRemoved;
			lastRemoved = null;
			if (!part || !msg || part.id !== msg.p || skip(part)) return;
			if (opts.isMuted && opts.isMuted(part._id)) return;
			addSystem("leave", part);
		});
		c.on("participant renamed", function (info) {
			if (!info || !info.part || skip(info.part) || !info.oldName || !info.newName) return;
			addSystem("rename", { _id: info.part._id, name: info.oldName, color: info.part.color }, info.newName);
		});
	}

	function init(o) {
		opts = o || {};
		$ul = $("#chat ul");
		logEl = $("#chat .chat-log")[0];
		var c = client();
		if (c) watchPresence(c);
		// A new room (or the server came back): reload when the room's chat arrives.
		if (c) c.on("ch", function (msg) {
			var id = msg && msg.ch && msg.ch._id;
			if (id && id !== state.room) {
				clearReplyTarget();
				closePicker();
			}
		});

		$jump = $('<button type="button" id="chat-jump" aria-label="Jump to the newest messages">↓ Newest</button>').appendTo("#chat");
		$jump.on("click", function (e) { e.preventDefault(); scrollToBottom(); updateJump(); });
		if (logEl) logEl.addEventListener("scroll", function () {
			updateJump();
			if (logEl.scrollTop < 120 && (isChatting() || isMobile())) loadOlder();
		}, { passive: true });

		var $chat = $("#chat");
		$chat.on("mousedown touchstart pointerdown", ".chat-actions button, .chat-react-chip, .chat-load-older, .chat-reply-quote, #chat-emoji-picker, #chat-jump, .chat-photo", function (e) {
			e.stopPropagation();
		});
		$chat.on("click", ".chat-load-older", function (e) { e.preventDefault(); loadOlder(); });
		// First click arms it ("Delete?"), a second click within 3 s deletes.
		$chat.on("mousedown touchstart pointerdown", ".chat-sys-del", function (e) { e.stopPropagation(); });
		$chat.on("click", ".chat-sys-del", function (e) {
			e.preventDefault();
			e.stopPropagation();
			var $btn = $(this), li = $btn.closest("li")[0];
			if (!$btn.hasClass("confirm")) {
				$btn.addClass("confirm").text("Delete?");
				clearTimeout(this._disarm);
				this._disarm = setTimeout(function () { $btn.removeClass("confirm").text("✕"); }, 3000);
				return;
			}
			clearTimeout(this._disarm);
			deleteSystem(li, $btn);
		});
		$chat.on("click", ".chat-act-react", function (e) {
			e.preventDefault();
			e.stopPropagation();
			var li = $(this).closest("li")[0];
			if (pickerRef === li._ref && $picker && !$picker.is("[hidden]")) closePicker();
			else openPicker(li._ref, this);
		});
		$chat.on("click", ".chat-act-reply", function (e) {
			e.preventDefault();
			e.stopPropagation();
			setReplyTarget($(this).closest("li")[0]);
		});
		$chat.on("click", ".chat-react-chip", function (e) {
			e.preventDefault();
			e.stopPropagation();
			var li = $(this).closest("li")[0];
			if (li && li._ref) toggleReact(li._ref, this.getAttribute("data-emoji"));
		});
		$chat.on("click", ".chat-reply-quote", function (e) {
			e.preventDefault();
			e.stopPropagation();
			var ref = this.getAttribute("data-target");
			if (ref) goToRef(ref);
		});
		$chat.on("click", ".chat-photo", function (e) {
			if ($(this).hasClass("broken")) return;
			e.preventDefault();
			e.stopPropagation();
			lightbox(this.getAttribute("href"));
		});
		// Phones: tap a line to show its React / Reply buttons.
		$chat.on("click", "li.chat-line", function (e) {
			if ($(e.target).closest("button, a").length) return;
			var sel = global.getSelection && global.getSelection();
			if (sel && String(sel).length) return;
			var was = this.classList.contains("show-actions");
			$ul.children(".show-actions").removeClass("show-actions");
			if (!was) this.classList.add("show-actions");
		});
		$(document).on("mousedown touchstart", function (e) {
			if ($picker && !$picker.is("[hidden]") && !$(e.target).closest("#chat-emoji-picker, .chat-act-react").length) closePicker();
		});
		document.addEventListener("keydown", function (e) {
			if (e.keyCode !== 27) return;
			var $lb = $("#chat-lightbox");
			if ($lb.length && !$lb.is("[hidden]")) { $lb.attr("hidden", "hidden"); e.stopPropagation(); e.preventDefault(); return; }
			if ($picker && !$picker.is("[hidden]")) { closePicker(); e.stopPropagation(); e.preventDefault(); return; }
			if (replyTarget && document.activeElement === $("#chat-input-bar input")[0]) { clearReplyTarget(); e.stopPropagation(); e.preventDefault(); }
		}, true);

		// Reply bar + photo button live in the chat input bar.
		var $bar = $("#chat-input-bar");
		$bar.on("mousedown touchstart", "#chat-reply-bar, #chat-photo-btn", function (e) { e.stopPropagation(); });
		$bar.on("click", ".chat-reply-bar-close", function (e) { e.preventDefault(); clearReplyTarget(); $("#chat-input-bar input").focus(); });
		$bar.on("click", "#chat-photo-btn", function (e) { e.preventDefault(); $("#chat-photo-file").val("").trigger("click"); });
		$("#chat-photo-file").on("change", function () {
			var f = this.files && this.files[0];
			if (f) sendPhoto(f);
			this.value = "";
		});
		$("#chat-input-bar input").on("paste", function (e) {
			var f = imageFromTransfer(e.originalEvent && e.originalEvent.clipboardData);
			if (f) { e.preventDefault(); sendPhoto(f); }
		});
		$("#chat, #chat-input-bar").on("dragover", function (e) {
			var dt = e.originalEvent && e.originalEvent.dataTransfer;
			if (dt && Array.prototype.indexOf.call(dt.types || [], "Files") >= 0) { e.preventDefault(); dt.dropEffect = "copy"; }
		}).on("drop", function (e) {
			var f = imageFromTransfer(e.originalEvent && e.originalEvent.dataTransfer);
			if (f) { e.preventDefault(); sendPhoto(f); }
		});
		// Day labels ("Today") go stale overnight.
		setInterval(function () { if ($ul && $ul.children(".chat-day").length) rebuildDays(); }, 30 * 60000);
	}

	function reset() {
		historyGen++;
		loading = false;
		var keepMe = state.me;
		state = freshState();
		state.me = keepMe;
		state.room = roomId();
		if ($ul) $ul.children(".chat-history-top, .chat-day").remove();
		closePicker();
	}

	global.RoomChat = {
		SYNC_PREFIX: SYNC_PREFIX,
		init: init,
		reset: reset,
		addMessage: addMessage,
		loadLatest: loadLatest,
		beforeSend: beforeSend,
		decoratePending: decoratePending,
		isSyncText: isSyncText,
		handleSync: handleSync,
		refreshFade: refreshFade,
		updateJump: updateJump,
		chatRef: chatRef,
		setLineText: setLineText,
		moderate: moderate
	};
})(typeof window !== "undefined" ? window : this);
