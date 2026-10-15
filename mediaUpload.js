/**
 * Media upload helper — finds the media server (media-server.py on :8551) and
 * uploads/deletes files there. Used by Play MP3 to share a file with the room.
 * (What's left of the old Room DJ code.)
 */
(function (global) {
	"use strict";

	var DEFAULT_MEDIA_PORT = 8551;
	var VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v|ogv|m3u8)$/i;
	var MAX_TITLE = 120;
	var mediaServerBase = null;
	var mediaServerReady = null;

	function getParam(name) {
		if (typeof window === "undefined" || !window.location) return null;
		var m = window.location.search.match(new RegExp("[?&]" + name + "=([^&]*)"));
		return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
	}

	function normalizeBase(base) {
		if (!base) return null;
		base = String(base).trim().replace(/\/+$/, "");
		if (/^\d+$/.test(base)) {
			var host = (typeof window !== "undefined" && window.location && window.location.hostname) || "localhost";
			return "http://" + host + ":" + base;
		}
		if (!/^https?:\/\//i.test(base)) base = "http://" + base;
		return base.replace(/\/+$/, "");
	}

	function probeMediaServer(base) {
		base = normalizeBase(base);
		if (!base) return Promise.resolve(null);
		return fetch(base + "/api/media/health", { method: "GET", cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(function (data) {
				if (!data || !data.ok) return null;
				if (data.media === true || data.service === "harmony-media") return base;
				return null;
			})
			.catch(function () { return null; });
	}

	function detectMediaServerBases() {
		var bases = [];
		var param = getParam("media");
		if (param) bases.push(normalizeBase(param));
		try {
			if (typeof localStorage !== "undefined" && localStorage.harmonyMediaServer) {
				bases.push(normalizeBase(localStorage.harmonyMediaServer));
			}
		} catch (e) {}
		if (typeof window !== "undefined" && window.location) {
			var host = window.location.hostname || "localhost";
			bases.push("http://" + host + ":" + DEFAULT_MEDIA_PORT);
			bases.push("http://localhost:" + DEFAULT_MEDIA_PORT);
			bases.push("http://127.0.0.1:" + DEFAULT_MEDIA_PORT);
			bases.push(window.location.origin);
		}
		var seen = {}, out = [];
		for (var i = 0; i < bases.length; i++) {
			if (bases[i] && !seen[bases[i]]) { seen[bases[i]] = true; out.push(bases[i]); }
		}
		return out;
	}

	function initMediaServer() {
		if (mediaServerReady) return mediaServerReady;
		var chain = Promise.resolve(null);
		detectMediaServerBases().forEach(function (base) {
			chain = chain.then(function (found) { return found || probeMediaServer(base); });
		});
		mediaServerReady = chain.then(function (found) {
			mediaServerBase = found;
			try { if (found && typeof localStorage !== "undefined") localStorage.harmonyMediaServer = found; } catch (e) {}
			return found;
		});
		return mediaServerReady;
	}

	function getMediaServerBase() { return mediaServerBase; }

	function publicMediaBase() {
		var base = getMediaServerBase();
		if (!base || typeof window === "undefined" || !window.location || !window.location.hostname) return base;
		var host = window.location.hostname;
		return base.replace("://localhost:", "://" + host + ":").replace("://127.0.0.1:", "://" + host + ":");
	}

	function resolveMediaUrl(path) {
		if (!path) return "";
		if (/^https?:\/\//i.test(path) || path.indexOf("blob:") === 0) return path;
		var base = publicMediaBase() || getMediaServerBase();
		if (!base && typeof window !== "undefined" && window.location) base = window.location.origin;
		return (base || "") + (path.charAt(0) === "/" ? "" : "/") + path;
	}

	function normalizeServerMediaUrl(url) {
		var path = (url || "").split("?")[0].split("#")[0];
		if (!/\/room-media\/[^/?#]+$/i.test(path)) return null;
		return path.slice(path.indexOf("/room-media/"));
	}

	function uploadFile(file) {
		if (!file) return Promise.reject(new Error("No file selected"));
		var kind = VIDEO_EXT.test(file.name || "") ? "video" : "audio";
		var title = (file.name.replace(/\.[^.]+$/, "") || "Untitled").replace(/\|/g, "/").trim().slice(0, MAX_TITLE);
		return initMediaServer().then(function (base) {
			if (!base) throw new Error("Media server not running. Run: python media-server.py 8551\nOr double-click run-servers.bat");
			var fd = new FormData();
			fd.append("file", file, file.name);
			return fetch(base + "/api/media", { method: "POST", body: fd, cache: "no-store" }).then(function (r) {
				return r.json().catch(function () { return { ok: false, error: "Upload failed (" + r.status + ")" }; }).then(function (data) {
					if (r.status === 413) throw new Error("File too large for the server (413). On nginx add: client_max_body_size 80m; then reload nginx.");
					if (!data.ok) throw new Error(data.error || "Upload failed (" + r.status + ")");
					return { url: data.absUrl || resolveMediaUrl(data.url), title: title, kind: data.kind || kind, serverHosted: true };
				});
			});
		});
	}

	function deleteServerMedia(url) {
		url = normalizeServerMediaUrl(url);
		if (!url) return Promise.resolve(false);
		var base = getMediaServerBase();
		return fetch((base ? base : "") + "/api/media", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: url }),
			cache: "no-store"
		}).then(function (r) { return r.json(); })
			.then(function (data) { return !!(data && data.ok); })
			.catch(function () { return false; });
	}

	global.MediaUpload = {
		initMediaServer: initMediaServer,
		getMediaServerBase: getMediaServerBase,
		uploadFile: uploadFile,
		deleteServerMedia: deleteServerMedia
	};
})(typeof window !== "undefined" ? window : this);
