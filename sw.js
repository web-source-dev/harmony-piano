/**
 * Harmony Piano — UI cache (service worker)
 *
 * Repeat visits load the piano UI + note samples from the browser cache so the
 * page comes up even when the origin is slow. Live traffic is never cached:
 *   /relay        WebSocket room sync
 *   /api/*        chat logs, media API
 *   /room-media/  Room DJ uploads
 *   /health       health checks
 *
 * Bump CACHE_NAME when you need everyone to drop the old shell (rare — JS/CSS
 * also refresh in the background via stale-while-revalidate).
 */
"use strict";

var CACHE_NAME = "harmony-piano-ui-v1";

var SHELL = [
	"./",
	"./index.html",
	"./screen.css",
	"./jquery.min.js",
	"./util.js",
	"./client.js",
	"./roomSync.js",
	"./funSounds.js",
	"./NoteQuota.js",
	"./lame.min.js",
	"./color.js",
	"./sheetPlayer.js",
	"./roomMedia.js",
	"./playMp3.js",
	"./pianoLearn.js",
	"./metronome.js",
	"./blobFriend.js",
	"./desktopDoodler.js",
	"./emojiParty.js",
	"./nameColor.js",
	"./cursorLooks.js",
	"./soundBoard.js",
	"./partyGame.js",
	"./balloonPop.js",
	"./carDodge.js",
	"./reactionRoyale.js",
	"./tugOfWar.js",
	"./uselessButton.js",
	"./pixelPet.js",
	"./evilCursor.js",
	"./chaosMonkey.js",
	"./chatLogger.js",
	"./cornerBanner.js",
	"./funVideoPopup.js",
	"./screenShare.js",
	"./shareImage.js",
	"./script.js",
	"./workerTimer.js",
	"./arrow.png",
	"./crown.png",
	"./cursor.png",
	"./volume2.png",
	"./cursors/mochi-goma-arrow.png",
	"./cursors/mochi-goma-pointer.png"
];

function isLivePath(pathname) {
	if (pathname === "/health" || pathname === "/relay" || pathname === "/relay/health") return true;
	if (pathname.indexOf("/api/") === 0) return true;
	if (pathname.indexOf("/room-media/") === 0) return true;
	return false;
}

function isImmutablePath(pathname) {
	if (pathname.indexOf("/sounds/") === 0) return true;
	return /\.(png|jpg|jpeg|gif|ico|webp|woff2?|ttf|mp3|wav|ogg|m4a)$/i.test(pathname);
}

function isHtmlPath(pathname) {
	return pathname === "/" || pathname === "/index.html" || /\.html$/i.test(pathname);
}

function putInCache(request, response, cacheKey) {
	if (!response || !response.ok) return response;
	var copy = response.clone();
	caches.open(CACHE_NAME).then(function (cache) {
		cache.put(cacheKey || request, copy);
	});
	return response;
}

function cacheFirst(request) {
	return caches.match(request, { ignoreSearch: true }).then(function (cached) {
		if (cached) return cached;
		return fetch(request).then(function (res) { return putInCache(request, res); });
	});
}

// Serve cache immediately, refresh in the background. Exact URL wins so ?v=
// cache-busts still apply; ignoreSearch is only a fallback for the precache.
function staleWhileRevalidate(request, opts) {
	opts = opts || {};
	return caches.open(CACHE_NAME).then(function (cache) {
		return cache.match(request).then(function (exact) {
			var fallback = exact ? Promise.resolve(exact) : (
				opts.ignoreSearch ? cache.match(request, { ignoreSearch: true }) : Promise.resolve(undefined)
			);
			return fallback.then(function (cached) {
				var network = fetch(request).then(function (res) {
					return putInCache(request, res, opts.storeAs || request);
				}).catch(function () {
					return cached;
				});
				return cached || network;
			});
		});
	});
}

self.addEventListener("install", function (event) {
	event.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			return Promise.all(SHELL.map(function (url) {
				return cache.add(url).catch(function () {});
			}));
		}).then(function () {
			return self.skipWaiting();
		})
	);
});

self.addEventListener("activate", function (event) {
	event.waitUntil(
		caches.keys().then(function (keys) {
			return Promise.all(keys.map(function (key) {
				if (key !== CACHE_NAME) return caches.delete(key);
			}));
		}).then(function () {
			return self.clients.claim();
		})
	);
});

self.addEventListener("fetch", function (event) {
	var request = event.request;
	if (request.method !== "GET") return;

	var url;
	try { url = new URL(request.url); } catch (e) { return; }
	if (url.origin !== self.location.origin) return;
	if (isLivePath(url.pathname)) return;

	// Always take a fresh copy of this file so cache-version bumps apply.
	if (url.pathname === "/sw.js" || url.pathname.slice(-5) === "/sw.js") return;

	if (request.mode === "navigate" || isHtmlPath(url.pathname)) {
		event.respondWith(staleWhileRevalidate(request, {
			ignoreSearch: true,
			storeAs: "./index.html"
		}));
		return;
	}

	if (isImmutablePath(url.pathname)) {
		event.respondWith(cacheFirst(request));
		return;
	}

	event.respondWith(staleWhileRevalidate(request, { ignoreSearch: true }));
});
