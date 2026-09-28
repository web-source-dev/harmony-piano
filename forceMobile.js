/**
 * Phone in "Desktop site" mode → still show the phone layout.
 *
 * With "Desktop site" on, phone browsers ignore <meta name="viewport"> and lay
 * the page out ~980px wide, then shrink it to fit the screen, so our phone
 * media queries never match and everything is tiny. A page can't turn that
 * browser setting off, but it can notice it: a touch screen whose real width
 * (screen.width) is much smaller than the layout width (innerWidth).
 *
 * When that happens we:
 *   1. zoom the page back up so 1 CSS px is about 1 real px again, and
 *   2. switch on the phone-width @media blocks of the page's stylesheets in
 *      place (appendMedium keeps their position in the cascade), and
 *   3. add html.force-mobile so scripts can tell (see isMobileLayout()).
 *
 * Load this synchronously in <head>, AFTER the stylesheets it should adjust.
 */
(function () {
	"use strict";
	var de = document.documentElement;
	var lastScreenW = -1;

	function isForcedDesktop() {
		var touch = (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
		var sw = screen.width;
		if (!touch || !sw || Math.min(sw, screen.height) > 820) return false;
		// Normal phone: innerWidth ≈ screen.width. Desktop site: ~980+ vs ~400.
		return window.innerWidth > sw * 1.25;
	}

	// Turn on every phone-width @media block (max-width at least the screen's
	// real width, and no height/orientation/min-width conditions).
	function enablePhoneMedia(sheets) {
		var sw = screen.width;
		for (var i = 0; i < sheets.length; i++) {
			var rules;
			try { rules = sheets[i].cssRules; } catch (e) { continue; }
			if (!rules) continue;
			for (var j = 0; j < rules.length; j++) {
				var r = rules[j];
				if (!r.media || r.type !== 4 || r._harmonyForced) continue; // 4 = CSSRule.MEDIA_RULE
				var text = r.media.mediaText || "";
				var m = /max-width:\s*(\d+)px/.exec(text);
				if (!m || +m[1] < sw) continue;
				if (/min-width|height|orientation|prefers-|print/.test(text)) continue;
				try { r.media.appendMedium("screen"); r._harmonyForced = true; } catch (e) {}
			}
		}
	}

	// Page zoom doesn't shrink vw/vh units (a 94vw dialog would come out 2.5×
	// too wide), so divide every viewport unit in the stylesheets by the zoom.
	// Original values are kept so a new zoom (phone rotated) rescales cleanly.
	var VIEWPORT_UNIT = /(-?\d*\.?\d+)([dsl]?v(?:w|h|min|max))\b/g;
	function scaleViewportUnits(rules, zoom) {
		for (var i = 0; i < rules.length; i++) {
			var r = rules[i];
			if (r.cssRules && !r.style) { scaleViewportUnits(r.cssRules, zoom); continue; }
			if (!r.style) continue;
			var orig = r._harmonyVp;
			if (!orig) {
				orig = [];
				for (var k = 0; k < r.style.length; k++) {
					var prop = r.style[k];
					var val = r.style.getPropertyValue(prop);
					VIEWPORT_UNIT.lastIndex = 0;
					if (VIEWPORT_UNIT.test(val)) orig.push([prop, val, r.style.getPropertyPriority(prop)]);
				}
				r._harmonyVp = orig;
			}
			for (var n = 0; n < orig.length; n++) {
				var scaled = zoom === 1 ? orig[n][1] : orig[n][1].replace(VIEWPORT_UNIT, function (all) {
					return "calc(" + all + " / " + zoom + ")";
				});
				try { r.style.setProperty(orig[n][0], scaled, orig[n][2]); } catch (e) {}
			}
			if (r.cssRules) scaleViewportUnits(r.cssRules, zoom);
		}
	}
	function scaleAllSheets(zoom) {
		for (var i = 0; i < document.styleSheets.length; i++) {
			var rules;
			try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
			if (rules) scaleViewportUnits(rules, zoom);
		}
	}

	var scaled = false;
	function apply() {
		if (screen.width === lastScreenW) return;
		lastScreenW = screen.width;
		de.style.zoom = "";
		var forced = isForcedDesktop();
		de.classList.toggle("force-mobile", forced);
		window.gForceMobile = forced;
		if (!forced) {
			if (scaled) { scaleAllSheets(1); scaled = false; }
			return;
		}
		var zoom = Math.round(window.innerWidth / screen.width * 100) / 100;
		de.style.zoom = String(zoom);
		enablePhoneMedia(document.styleSheets);
		scaleAllSheets(zoom);
		scaled = true;
	}

	apply();
	// Rotating the phone changes screen.width; re-check (the browser settles late).
	window.addEventListener("orientationchange", function () { setTimeout(apply, 300); });
	window.addEventListener("resize", apply);
})();
