/**
 * Harmony World — YouTube on the TV and the cinema screen: single videos and playlists, in sync for everyone.
 *
 * A shared screen's state is { on, yt, list, idx, at, paused, pos }:
 *   yt    the video id ("videoseries" for a playlist link with no video in it)
 *   list  the playlist id ("" for a single video)
 *   idx   which video of the playlist is on (-1: not known yet - a watch?v=...&list=... link starts part way in, and the
 *         first player to load says where), at: when that video started (so "elapsed" is always within the current one)
 * Every player reports where it is in the playlist (the iframe API's infoDelivery messages). When a video ends, each
 * player moves on by itself; the first to say so moves the shared index on (and restarts its clock), and anyone whose
 * player is on a different video than the shared one is sent to it.
 */
export const YT_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;
const LIST_RE = /[?&]list=([\w-]{10,80})/;

// a pasted link -> { yt, list, idx } (or null when it isn't a YouTube video or playlist)
export function parseYouTube(url) {
	url = String(url || "").trim();
	const v = YT_RE.exec(url), l = /youtu/.test(url) ? LIST_RE.exec(url) : null;
	if (!v && !l) return null;
	return { yt: v ? v[1] : "videoseries", list: l ? l[1] : "", idx: l ? (v ? -1 : 0) : 0 };
}
export const ytKey = m => (m.yt || "") + "|" + (m.list || "");
export const ytThumb = m => m.yt && m.yt !== "videoseries" ? `https://img.youtube.com/vi/${m.yt}/mqdefault.jpg` : "";

export function ytEmbedSrc(m, start) {
	const list = m.list ? `&list=${encodeURIComponent(m.list)}` : "";
	return `https://www.youtube.com/embed/${m.yt || "videoseries"}?enablejsapi=1&autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3${list}&start=${Math.max(0, Math.floor(start || 0))}&origin=${encodeURIComponent(location.origin)}`;
}

// what each mounted player says about itself (iframe window -> callback)
const listeners = new Map();
addEventListener("message", e => {
	if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
	const fn = listeners.get(e.source);
	if (!fn) return;
	let d;
	try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (err) { return; }
	if (d && d.event === "infoDelivery" && d.info) fn(d.info);
});

/**
 * Follow a mounted player's place in its playlist.
 *   get()        the shared state now
 *   patch(p)     merge p into the shared state (no click sound: this happens by itself)
 *   cmd(f, args) send the player a command
 *   elapsed(m)   seconds into the current video
 * Returns { stop(), index(), sync() } - sync() puts the player on the shared video (call it after a remote change).
 */
export function followPlaylist(iframe, get, patch, cmd, elapsed) {
	let cur = -1, seekT = 0;
	const win = iframe.contentWindow;
	const goTo = idx => {
		cmd("playVideoAt", [idx]);
		clearTimeout(seekT);
		// (once it's loaded that video: on to where everyone else is in it)
		seekT = setTimeout(() => { const m = get(); if (m.list && m.idx === idx) { cmd("seekTo", [elapsed(m), true]); if (m.paused) cmd("pauseVideo"); } }, 1300);
	};
	const sync = () => {
		const m = get();
		if (!m.list || cur < 0 || typeof m.idx !== "number" || m.idx < 0) return;
		if (cur !== m.idx) goTo(m.idx);
	};
	listeners.set(win, info => {
		if (typeof info.playlistIndex !== "number" || info.playlistIndex === cur) return;
		cur = info.playlistIndex;
		const m = get();
		if (!m.list || !m.on) return;
		const idx = typeof m.idx === "number" ? m.idx : -1;
		if (idx < 0) patch({ idx: cur });                                                        // where the link started
		else if (cur === idx + 1 && !m.paused && Date.now() - m.at > 4000) patch({ idx: cur, at: Date.now(), pos: 0 });   // that video ended
		else if (cur !== idx) goTo(idx);                                                           // we're on the wrong one
	});
	return { stop() { listeners.delete(win); clearTimeout(seekT); }, index: () => cur, sync };
}

// the next / previous video of the playlist (a patch for the shared state), or null with no playlist
export function playlistStep(m, dir, cur) {
	if (!m.list) return null;
	const idx = typeof m.idx === "number" && m.idx >= 0 ? m.idx : Math.max(0, cur);
	return { idx: Math.max(0, idx + dir), at: Date.now(), pos: 0, paused: false };
}
