/**
 * Harmony World — what the cinema screen can show besides YouTube.
 *
 *   video  a video file by its link (.mp4 .webm .m3u8 ..., or a movie in the media library); everyone's player loads
 *          it and they're kept in step the same way as YouTube (shared start time / paused position)
 *   embed  another site's player in a frame: Vimeo, Dailymotion, Twitch, Google Drive, Streamable, archive.org...,
 *          a pasted <iframe> embed code, or any page that lets itself be framed
 *   share  one person's browser tab / window, or a movie file from their computer, streamed live to everyone else
 *          (WebRTC, signalled over the world relay as { t: "rtc" } messages) - for the sites that give you no link
 */
import { parseYouTube } from "./worldYT.js";

const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|m3u8)$/i;

// a pasted link (or embed code) -> { kind, ... }, or null when it isn't a link at all.
// kind "page" means we can't tell from the link alone: probe() asks the server what's there.
export function parseSource(text) {
	text = String(text || "").trim();
	const tag = /<iframe[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(text);
	if (tag) text = tag[1].replace(/&amp;/g, "&");
	const y = parseYouTube(text);
	if (y) return Object.assign({ kind: "yt" }, y);
	let u;
	try {
		u = new URL(/^\/\//.test(text) ? "https:" + text : /^\//.test(text) ? location.origin + text : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(text) ? "https://" + text : text);
	} catch (e) { return null; }
	if (!/^https?:$/.test(u.protocol)) return null;
	if (tag) return { kind: "embed", url: u.href, known: true };
	const h = u.hostname.replace(/^(www|m)\./, ""), p = u.pathname;
	const emb = src => ({ kind: "embed", url: src, known: true });
	let m;
	if (VIDEO_EXT.test(p) || (u.origin === location.origin && /^\/(media-library|room-media)\//.test(p))) return { kind: "video", url: u.href };
	if (h === "vimeo.com" && (m = /^\/(?:.*\/)?(\d{5,})(?:\/([\da-f]{6,}))?/.exec(p))) return emb(`https://player.vimeo.com/video/${m[1]}?autoplay=1${m[2] ? "&h=" + m[2] : ""}`);
	if (h === "player.vimeo.com") return emb(u.href);
	if ((h === "dailymotion.com" && (m = /\/video\/([a-z0-9]+)/i.exec(p))) || (h === "dai.ly" && (m = /^\/([a-z0-9]+)/i.exec(p)))) return emb(`https://www.dailymotion.com/embed/video/${m[1]}?autoplay=1`);
	if (h === "twitch.tv") {
		const par = "&parent=" + encodeURIComponent(location.hostname);
		if ((m = /^\/videos\/(\d+)/.exec(p))) return emb(`https://player.twitch.tv/?video=${m[1]}${par}`);
		if ((m = /^\/(\w+)\/?$/.exec(p))) return emb(`https://player.twitch.tv/?channel=${m[1]}${par}`);
	}
	if (h === "drive.google.com") {
		const id = (/\/file\/d\/([\w-]+)/.exec(p) || [])[1] || u.searchParams.get("id");
		if (id) return emb(`https://drive.google.com/file/d/${id}/preview`);
	}
	if (h === "streamable.com" && (m = /^\/(?:e\/)?(\w+)/.exec(p))) return emb(`https://streamable.com/e/${m[1]}?autoplay=1`);
	if (h === "archive.org" && (m = /^\/(?:details|embed)\/([^/]+)/.exec(p))) return emb(`https://archive.org/embed/${m[1]}`);
	if (h === "facebook.com" || h === "fb.watch") return emb(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false&autoplay=1`);
	if (h === "kick.com" && (m = /^\/([\w-]+)\/?$/.exec(p))) return emb(`https://player.kick.com/${m[1]}`);
	if (h === "ok.ru" && (m = /^\/video(?:embed)?\/(\d+)/.exec(p))) return emb(`https://ok.ru/videoembed/${m[1]}?autoplay=1`);
	if (h === "rumble.com" && /^\/embed\//.test(p)) return emb(u.href);
	return { kind: "page", url: u.href };
}

// ask the server what's behind a link: { video, hls, frameable } (null when it couldn't find out)
export function probe(link) {
	return fetch("/api/world/probe?u=" + encodeURIComponent(link), { cache: "no-store" })
		.then(r => r.ok ? r.json() : null).then(j => j && j.ok ? j : null).catch(() => null);
}

// ---------------------------------------------------------------- one clock for everyone
// A phone's clock can be seconds off a computer's. The cinema's times ("started at", "resumes at") are all on the
// server's clock: we measure how far ours is from it (the quickest of a few round trips is the most exact) and add that.
let clockOff = 0, clockRtt = Infinity, clockAt = 0;
export const serverNow = () => Date.now() + clockOff;
function clockSample() {
	const t0 = Date.now();
	return fetch("/api/world/time", { cache: "no-store" }).then(r => r.json()).then(j => {
		const t1 = Date.now(), rtt = t1 - t0;
		if (!j || typeof j.now !== "number") return;
		// a better measurement wins; an old one is replaced after a while anyway (clocks wander)
		if (rtt <= clockRtt || t1 - clockAt > 600000) { clockRtt = rtt; clockAt = t1; clockOff = j.now + rtt / 2 - t1; }
	}).catch(() => {});
}
let clockStarted = false;
export function startClock() {
	if (clockStarted) return;
	clockStarted = true;
	let n = 0;
	const burst = () => clockSample().then(() => { if (++n < 6) setTimeout(burst, 250); });
	burst();
	setInterval(() => { clockRtt = clockRtt * 1.5 + 5; clockSample(); }, 60000);
}

// ---------------------------------------------------------------- whole movies on the server
// Upload a movie file to the media library (straight to disk on the server; any size up to its limit).
// onProgress(0..1). Resolves { url, title }; .abort() on the promise cancels it.
export function uploadMovie(file, onProgress) {
	const xhr = new XMLHttpRequest();
	const p = new Promise((ok, no) => {
		xhr.open("POST", "/api/world/movie");
		xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));
		xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
		xhr.onload = () => {
			let j = null;
			try { j = JSON.parse(xhr.responseText); } catch (e) { /* below */ }
			if (xhr.status === 413) no(new Error((j && j.error) || "That file is too big for the server (if the site runs behind nginx, raise client_max_body_size for /api/world/movie)."));
			else if (j && j.ok) ok({ url: j.url, title: file.name.replace(/\.[^.]+$/, "") });
			else no(new Error((j && j.error) || "Upload failed (" + xhr.status + ")"));
		};
		xhr.onerror = () => no(new Error("The upload was cut off - check the connection and try again."));
		xhr.onabort = () => no(Object.assign(new Error("Upload cancelled"), { name: "AbortError" }));
		xhr.send(file);
	});
	p.abort = () => xhr.abort();
	return p;
}
export function deleteMovie(link) {
	const file = String(link).split("/").pop();
	return fetch("/api/world/movie?file=" + encodeURIComponent(file), { method: "DELETE" }).then(r => r.ok).catch(() => false);
}

export function libraryVideos() {
	return fetch("/api/world/videos", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => (j && j.videos) || []).catch(() => []);
}

// a short name for what's on: the file's name, or the site's
export function sourceTitle(link) {
	try {
		const u = new URL(link, location.href);
		const f = decodeURIComponent(u.pathname.split("/").pop() || "");
		if (VIDEO_EXT.test(f)) return f.replace(VIDEO_EXT, "").replace(/[_.]+/g, " ").trim().slice(0, 60) || f;
		return u.hostname.replace(/^www\./, "");
	} catch (e) { return ""; }
}

// .m3u8 needs hls.js everywhere but Safari: loaded the first time one plays
let hlsLib = null;
export function loadHls() {
	if (window.Hls) return Promise.resolve(window.Hls);
	if (!hlsLib) hlsLib = new Promise((ok, no) => {
		const s = document.createElement("script");
		s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
		s.onload = () => window.Hls ? ok(window.Hls) : no(new Error("hls.js"));
		s.onerror = () => { hlsLib = null; no(new Error("hls.js")); };
		document.head.appendChild(s);
	});
	return hlsLib;
}
export const isHls = link => /\.m3u8($|[?#])/i.test(link);

export const canShareTab = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
const canCapture = () => { const v = HTMLVideoElement.prototype; return !!(v.captureStream || v.mozCaptureStream); };
export const canShareFile = () => typeof RTCPeerConnection !== "undefined" && canCapture();

/**
 * Live streaming between the people in the cinema.
 *   ctx       the house context (send, MY_ID, muted)
 *   onChange  something changed (a stream arrived / ended): redraw
 *   onEnded   my own share stopped by itself (the browser's "Stop sharing" bar, a file I closed)
 *   onAsk     (from, what) someone watching my shared tab asks me to "pause" / "play" it (I'm the only one who can)
 * The sharer offers its stream to each viewer who asks ("want"); a viewer asks again every few seconds until a
 * picture arrives, so it doesn't matter who came into the room first.
 */
export function createStreamer(ctx, onChange, onEnded, onAsk) {
	let ice = null;
	const iceConfig = () => ice || (ice = fetch("/api/world/ice", { cache: "no-store" }).then(r => r.json()).then(j => j.iceServers)
		.catch(() => [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }]));
	const send = (to, sid, type, extra) => ctx.send(Object.assign({ t: "rtc", to, sid, type }, extra || {}));
	const newSid = () => Math.random().toString(36).slice(2, 10);

	// ---------------------------------------------------------------- sharing (my tab, or a file I play)
	let mine = null;          // { sid, src: "tab" | "file", title, stream, video?, actx?, gain?, url? }
	const outs = new Map();   // viewer id -> RTCPeerConnection

	async function shareTab() {
		const stream = await navigator.mediaDevices.getDisplayMedia({
			video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
			audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
			selfBrowserSurface: "exclude", surfaceSwitching: "include", systemAudio: "include"
		});
		stop(true);
		const vt = stream.getVideoTracks()[0];
		if (vt && "contentHint" in vt) vt.contentHint = "motion";
		const title = (vt && vt.label && !/^(screen|window|tab)[\s:-]*\d*$/i.test(vt.label) ? vt.label : "a shared tab").slice(0, 60);
		mine = { sid: newSid(), src: "tab", title, stream, audio: stream.getAudioTracks().length > 0 };
		const sid = mine.sid;
		stream.getTracks().forEach(t => t.addEventListener("ended", () => { if (mine && mine.sid === sid && !stream.getVideoTracks().some(x => x.readyState === "live")) { stop(true); onEnded(); } }));
		return mine;
	}

	// a movie file from this computer: played here (you hear it through the page), its picture and sound sent on
	async function shareFile(file) {
		const video = document.createElement("video");
		video.playsInline = true;
		video.preload = "auto";
		video.style.cssText = "position:fixed;left:0;bottom:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-1";
		const src = URL.createObjectURL(file);
		video.src = src;
		document.body.appendChild(video);
		try {
			await new Promise((ok, no) => { video.onloadedmetadata = ok; video.onerror = () => no(new Error("This browser can't play that file (try .mp4 or .webm).")); });
			const AC = window.AudioContext || window.webkitAudioContext;
			const actx = new AC();
			const node = actx.createMediaElementSource(video);
			const gain = actx.createGain();
			const dest = actx.createMediaStreamDestination();
			node.connect(gain); gain.connect(actx.destination);
			node.connect(dest);
			await video.play();
			if (actx.state === "suspended") actx.resume().catch(() => {});
			const cap = video.captureStream ? video.captureStream() : video.mozCaptureStream();
			const stream = new MediaStream(cap.getVideoTracks().concat(dest.stream.getAudioTracks()));
			stop(true);
			mine = { sid: newSid(), src: "file", title: file.name.replace(/\.[^.]+$/, "").slice(0, 60), stream, video, actx, gain, url: src, audio: true };
			// the captured picture gets a new track if the file's video changes size (some files do): pass it on
			cap.addEventListener("addtrack", e => { if (mine && mine.video === video && e.track.kind === "video") swapVideoTrack(e.track); });
			return mine;
		} catch (e) {
			video.remove();
			URL.revokeObjectURL(src);
			throw e;
		}
	}
	function swapVideoTrack(track) {
		const old = mine.stream.getVideoTracks()[0];
		if (old) mine.stream.removeTrack(old);
		mine.stream.addTrack(track);
		outs.forEach(pc => pc.getSenders().forEach(s => { if (s.track && s.track.kind === "video") s.replaceTrack(track).catch(() => {}); }));
		onChange();
	}

	// stop sharing (quiet: don't tell anyone, something else is about to take over)
	function stop(quiet) {
		if (!mine) return;
		const m = mine;
		mine = null;
		outs.forEach((pc, id) => { if (!quiet) send(id, m.sid, "end"); try { pc.close(); } catch (e) {} });
		outs.clear();
		m.stream.getTracks().forEach(t => t.stop());
		if (m.video) { m.video.pause(); m.video.removeAttribute("src"); m.video.load(); m.video.remove(); }
		if (m.actx) m.actx.close().catch(() => {});
		if (m.url) URL.revokeObjectURL(m.url);
		onChange();
	}

	async function offerTo(id) {
		const m = mine;
		if (!m) return;
		const old = outs.get(id);
		if (old) try { old.close(); } catch (e) {}
		const pc = new RTCPeerConnection({ iceServers: await iceConfig() });
		if (mine !== m) { pc.close(); return; }
		outs.set(id, pc);
		pc.onicecandidate = e => { if (e.candidate) send(id, m.sid, "ice", { cand: e.candidate.toJSON() }); };
		pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState) && outs.get(id) === pc) outs.delete(id); };
		m.stream.getTracks().forEach(t => pc.addTrack(t, m.stream));
		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		send(id, m.sid, "offer", { sdp: pc.localDescription.sdp });
		// a movie wants a good picture: up to 8 Mbit/s (the browser still backs off on a slow line)
		pc.getSenders().forEach(s => {
			if (!s.track || s.track.kind !== "video") return;
			const p = s.getParameters();
			if (!p.encodings || !p.encodings.length) p.encodings = [{}];
			p.encodings[0].maxBitrate = 8000000;
			p.degradationPreference = "balanced";
			s.setParameters(p).catch(() => {});
		});
	}

	// ---------------------------------------------------------------- watching someone else's
	let inn = null;   // { from, sid, pc, stream, queue, asked }
	let askT = 0;
	function watch(from, sid) {
		if (inn && inn.from === from && inn.sid === sid) return;
		unwatch();
		inn = { from, sid, pc: null, stream: null, queue: [], asked: 0 };
		ask();
	}
	function ask() {
		clearTimeout(askT);
		if (!inn || inn.stream) return;
		send(inn.from, inn.sid, "want");
		inn.asked++;
		askT = setTimeout(ask, inn.asked < 4 ? 3000 : 6000);
	}
	function unwatch() {
		clearTimeout(askT);
		if (!inn) return;
		send(inn.from, inn.sid, "bye");
		if (inn.pc) try { inn.pc.close(); } catch (e) {}
		inn = null;
		onChange();
	}
	async function onOffer(d) {
		const w = inn;
		if (w.pc) try { w.pc.close(); } catch (e) {}
		w.stream = null;
		const pc = w.pc = new RTCPeerConnection({ iceServers: await iceConfig() });
		if (inn !== w || w.pc !== pc) { pc.close(); return; }
		pc.onicecandidate = e => { if (e.candidate) send(w.from, w.sid, "ice", { cand: e.candidate.toJSON() }); };
		pc.ontrack = e => {
			if (inn !== w) return;
			w.stream = e.streams[0] || w.stream || new MediaStream();
			if (!e.streams[0]) w.stream.addTrack(e.track);
			clearTimeout(askT);
			onChange();
		};
		pc.onconnectionstatechange = () => {
			if (inn !== w || w.pc !== pc) return;
			// lost the line (their wifi blinked): ask for a fresh connection
			if (pc.connectionState === "failed" || pc.connectionState === "disconnected" && !w.stream) { w.stream = null; w.asked = 0; onChange(); askT = setTimeout(ask, 1500); }
		};
		await pc.setRemoteDescription({ type: "offer", sdp: d.sdp });
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		send(w.from, w.sid, "answer", { sdp: pc.localDescription.sdp });
		w.queue.splice(0).forEach(c => pc.addIceCandidate(c).catch(() => {}));
	}

	// ---------------------------------------------------------------- signalling (messages addressed to me)
	function onRtc(d) {
		const from = d.id;
		if (typeof from !== "string" || typeof d.sid !== "string") return;
		const sharing = mine && d.sid === mine.sid;
		const watching = inn && inn.from === from && inn.sid === d.sid;
		try {
			if (d.type === "want" && sharing) offerTo(from).catch(() => {});
			else if (d.type === "answer" && sharing && outs.get(from) && typeof d.sdp === "string") outs.get(from).setRemoteDescription({ type: "answer", sdp: d.sdp }).catch(() => {});
			else if (d.type === "ask" && sharing && (d.what === "pause" || d.what === "play")) onAsk(from, d.what);
			else if (d.type === "bye" && sharing) { const pc = outs.get(from); if (pc) { pc.close(); outs.delete(from); } }
			else if (d.type === "offer" && watching && typeof d.sdp === "string") onOffer(d).catch(() => {});
			else if (d.type === "end" && watching) { if (inn.pc) inn.pc.close(); inn.pc = null; inn.stream = null; onChange(); }
			else if (d.type === "ice" && d.cand) {
				if (sharing && outs.get(from)) outs.get(from).addIceCandidate(d.cand).catch(() => {});
				else if (watching) { if (inn.pc && inn.pc.remoteDescription) inn.pc.addIceCandidate(d.cand).catch(() => {}); else inn.queue.push(d.cand); }
			}
		} catch (e) { /* a stale message from an old connection */ }
	}

	return {
		shareTab, shareFile, stop, watch, unwatch, onRtc,
		ask: what => { if (inn) send(inn.from, inn.sid, "ask", { what }); },
		mine: () => mine,
		sharing: sid => !!mine && mine.sid === sid,
		incoming: () => inn && inn.stream,
		viewers: () => outs.size,
		// the file I'm playing: pause / play / jump, and its volume here
		file: () => mine && mine.src === "file" ? mine.video : null,
		setVolume(v) { if (mine && mine.gain) mine.gain.gain.value = v; }
	};
}
