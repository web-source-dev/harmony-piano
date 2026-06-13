/**
 * Top-center "Open this" button → popup with an embedded YouTube Short.
 * Paste your link in FUN_VIDEO.youtubeUrl below.
 */
(function (global) {
	"use strict";

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

	var FunVideoPopup = {
		init: function (options) {
			options = options || {};
			$btn = $("#fun-video-open-btn");
			$dialog = $("#fun-video");
			$iframe = $dialog.find("iframe");

			if (!FUN_VIDEO.enabled || !parseYouTubeId(FUN_VIDEO.youtubeUrl)) {
				$btn.attr("hidden", "hidden");
				return;
			}

			$btn.text(FUN_VIDEO.buttonLabel || "Open this");
			$btn.removeAttr("hidden");

			$btn.on("click", function () {
				FunVideoPopup.open(options.openModal);
			});

			$dialog.find(".fun-video-close").on("click", function () {
				if (options.closeModal) options.closeModal();
			});
		},

		open: function (openModalFn) {
			var id = parseYouTubeId(FUN_VIDEO.youtubeUrl);
			if (!id || !openModalFn) return;
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
