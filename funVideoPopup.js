/**
 * Top-center "Open this" button → popup with an embedded YouTube Short.
 * Paste your link in FUN_VIDEO.youtubeUrl below.
 */
(function (global) {
	"use strict";

	// Set false to hide the top button (FunVideoPopup.open() still works).
	var SHOW_BUTTON = false;

	// ── Edit your YouTube / Shorts / youtu.be link here ──
	var FUN_VIDEO = {
		enabled: true,
		buttonLabel: "Open this",
		youtubeUrl: "https://www.youtube.com/shorts/ELN83Ce8zWo?feature=share"
	};

	var $btn;
	var $iframe;
	var $dialog;

	function parseYouTubeId(url) {
		if (!url) return null;
		var m = String(url).match(
			/(?:youtube\.com\/(?:shorts\/|embed\/|live\/|watch\?(?:.*&)?v=)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/
		);
		return m ? m[1] : null;
	}

	function embedUrl(id) {
		return "https://www.youtube.com/embed/" + id;
	}

	var gOpenModal = null;

	var FunVideoPopup = {
		showButton: SHOW_BUTTON,
		config: FUN_VIDEO,

		init: function (options) {
			options = options || {};
			gOpenModal = options.openModal || null;
			$btn = $("#fun-video-open-btn");
			$dialog = $("#fun-video");
			$iframe = $dialog.find("iframe");

			if ($btn.length) {
				$btn.attr("hidden", "hidden");
			}

			if (SHOW_BUTTON && FUN_VIDEO.enabled && parseYouTubeId(FUN_VIDEO.youtubeUrl)) {
				$btn.text(FUN_VIDEO.buttonLabel || "Open this");
				$btn.removeAttr("hidden");
				$btn.on("click", function () {
					FunVideoPopup.open();
				});
			}

			$dialog.find(".fun-video-close").on("click", function () {
				if (options.closeModal) options.closeModal();
			});
		},

		open: function (openModalFn) {
			var id = parseYouTubeId(FUN_VIDEO.youtubeUrl);
			openModalFn = openModalFn || gOpenModal;
			if (!id || !openModalFn || !FUN_VIDEO.enabled) return;
			if (!$iframe || !$iframe.length) {
				$iframe = $("#fun-video iframe");
			}
			$iframe.attr("src", embedUrl(id) + "?autoplay=1&rel=0");
			openModalFn("#fun-video");
		},

		stop: function () {
			if ($iframe && $iframe.length) {
				$iframe.attr("src", "about:blank");
			}
		}
	};

	global.FunVideoPopup = FunVideoPopup;
})(typeof window !== "undefined" ? window : this);
