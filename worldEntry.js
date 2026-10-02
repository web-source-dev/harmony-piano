/**
 * "Enter World" — opens the shared 3D room (world.html) for this piano room.
 *
 * Adds a toolbar button next to the others plus a floating call-to-action, and
 * carries the room (?c=) and your piano name across so everyone in the same
 * piano room lands in the same world.
 */
(function () {
	"use strict";

	function roomName() {
		try {
			var c = new URLSearchParams(location.search).get("c");
			if (c) return c;
		} catch (e) {}
		try {
			if (window.gClient && gClient.channel && gClient.channel._id) return gClient.channel._id;
		} catch (e) {}
		return "lobby";
	}
	function myName() {
		try {
			var p = window.gClient && gClient.getOwnParticipant && gClient.getOwnParticipant();
			if (p && p.name) return p.name;
		} catch (e) {}
		return "";
	}
	function go() {
		var url = "./world.html?c=" + encodeURIComponent(roomName());
		var n = myName();
		if (n) url += "&n=" + encodeURIComponent(n.slice(0, 24));
		location.href = url;
	}

	var css = document.createElement("style");
	css.textContent =
		"#world-btn{color:#ffe1b8!important;border-color:rgba(255,170,110,.55)!important;background:rgba(255,140,90,.16)!important;font-weight:700}" +
		"#world-btn:hover{background:rgba(255,140,90,.3)!important;color:#fff!important}" +
		"#world-cta{position:fixed;right:16px;top:50%;transform:translateY(-50%);z-index:9000;display:flex;align-items:center;gap:10px;padding:12px 18px 12px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);" +
		"background:linear-gradient(135deg,#ff7aa2,#ffb86b);color:#2a0f1c;font:800 15px/1 'Nunito','Segoe UI',system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 34px rgba(255,122,162,.45),inset 0 1px 0 rgba(255,255,255,.5);transition:transform .18s,box-shadow .18s;animation:worldCtaIn .5s cubic-bezier(.2,1.3,.4,1)}" +
		"#world-cta:hover{transform:translateY(-50%) scale(1.05);box-shadow:0 16px 40px rgba(255,122,162,.6),inset 0 1px 0 rgba(255,255,255,.5)}" +
		"#world-cta .wc-ic{width:34px;height:34px;border-radius:50%;background:rgba(42,15,28,.85);display:grid;place-items:center;flex:none}" +
		"#world-cta .wc-ic svg{width:20px;height:20px}" +
		"#world-cta small{display:block;font-weight:700;font-size:11px;opacity:.75;margin-top:3px}" +
		"#world-cta .wc-x{margin-left:4px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:13px;background:rgba(42,15,28,.15)}" +
		"@keyframes worldCtaIn{from{opacity:0;transform:translateY(-50%) translateX(40px)}}" +
		"@media (max-width:700px){#world-cta{top:auto;bottom:calc(env(safe-area-inset-bottom) + 76px);transform:none;padding:10px 14px 10px 10px;font-size:14px}#world-cta:hover{transform:scale(1.04)}#world-cta small{display:none}@keyframes worldCtaIn{from{opacity:0;transform:translateX(40px)}}}";
	document.head.appendChild(css);

	var HOUSE = '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd2a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9v11h14V9"/><path d="M10 20v-6h4v6"/></svg>';

	function addToolbarButton() {
		if (document.getElementById("world-btn")) return;
		var anchor = document.getElementById("love-btn") || document.getElementById("kiss-btn");
		if (!anchor || !anchor.parentNode) return;
		var b = document.createElement("div");
		b.id = "world-btn";
		b.className = "ugly-button";
		b.setAttribute("role", "button");
		b.setAttribute("tabindex", "0");
		b.title = "Enter the shared 3D world for this room";
		b.textContent = "Enter World";
		b.addEventListener("click", go);
		b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
		anchor.parentNode.insertBefore(b, anchor.nextSibling);
	}

	function addCta() {
		if (document.getElementById("world-cta")) return;
		var hidden = false;
		try { hidden = sessionStorage.getItem("worldCtaHidden") === "1"; } catch (e) {}
		if (hidden) return;
		var b = document.createElement("button");
		b.id = "world-cta";
		b.type = "button";
		b.innerHTML = '<span class="wc-ic">' + HOUSE + '</span><span>Enter World<small>our little 3D room</small></span><span class="wc-x" title="Hide">&times;</span>';
		b.addEventListener("click", function (e) {
			if (e.target.closest(".wc-x")) {
				b.remove();
				try { sessionStorage.setItem("worldCtaHidden", "1"); } catch (err) {}
				return;
			}
			go();
		});
		document.body.appendChild(b);
	}

	function init() {
		addToolbarButton();
		addCta();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	window.HarmonyWorld = { enter: go };
})();
