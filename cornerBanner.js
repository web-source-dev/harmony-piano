/**
 * Top-right note box — edit CORNER_PROMPT below for your short message + reply input.
 * Set SHOW_MESSAGES true and fill CORNER_BANNER_MESSAGES to also show scrollable notes.
 */
(function (global) {
	"use strict";

	// Set false to hide the whole box (logging + API still work).
	var SHOW_UI = true;

	// Set true to show the scrollable note list above the input (off = input only).
	var SHOW_MESSAGES = false;

	// ── Optional scrollable notes (only when SHOW_MESSAGES is true) ──
	var CORNER_BANNER_MESSAGES = [];

	// ── Your short message + reply box — edit text / placeholder / buttonLabel ──
	var CORNER_PROMPT = {
		enabled: true,
		text: "Keep Smiling!",
		placeholder: "I'm here for you...",
		buttonLabel: "Noob is Here"
	};

	var index = 0;
	var $root;
	var $text;
	var $nav;
	var $prev;
	var $next;
	var $indexLabel;
	var $promptBlock;
	var $promptText;
	var $input;
	var $submit;
	var $feedback;
	var $body;
	var $head;
	var gFeedbackTimer = null;
	var gLayoutObserver = null;

	function messageCount() {
		return CORNER_BANNER_MESSAGES.length;
	}

	function logPromptReply(answer) {
		answer = (answer || "").trim();
		if (!answer || !CORNER_PROMPT.enabled || !CORNER_PROMPT.text) {
			return Promise.resolve(false);
		}
		if (typeof global.ChatLogger === "undefined" || !global.ChatLogger.logCornerPrompt) {
			return Promise.resolve(false);
		}
		ensureLoggerRoom();
		return global.ChatLogger.logCornerPrompt(getUserName(), answer);
	}

	function syncLayout() {
		var body = document.body;
		if (!body || !$root || !$root.length) return;
		var visible = SHOW_UI && !$root.is("[hidden]");
		if (visible) {
			body.classList.add("corner-banner-open");
			var rect = $root[0].getBoundingClientRect();
			var h = Math.ceil(rect.height);
			var stack = Math.ceil(rect.top + rect.height + 5);
			document.documentElement.style.setProperty("--corner-banner-h", h + "px");
			document.documentElement.style.setProperty("--corner-banner-stack", stack + "px");
		} else {
			body.classList.remove("corner-banner-open");
			document.documentElement.style.removeProperty("--corner-banner-h");
			document.documentElement.style.removeProperty("--corner-banner-stack");
		}
	}

	function render() {
		if (!$root || !$text) return;
		if (!SHOW_UI) {
			$root.attr("hidden", "hidden");
			syncLayout();
			return;
		}
		var count = SHOW_MESSAGES ? messageCount() : 0;
		var hasPrompt = CORNER_PROMPT.enabled && CORNER_PROMPT.text;
		if (count === 0 && !hasPrompt) {
			$root.attr("hidden", "hidden");
			syncLayout();
			return;
		}
		var promptOnly = hasPrompt && count === 0;
		$root.toggleClass("corner-banner-prompt-only", promptOnly);
		if ($head) {
			if (promptOnly) $head.attr("hidden", "hidden");
			else $head.removeAttr("hidden");
		}
		if ($body) {
			if (count === 0) $body.attr("hidden", "hidden");
			else $body.removeAttr("hidden");
		}
		if (count === 0) {
			$text.text("");
			if ($nav) $nav.attr("hidden", "hidden");
			$indexLabel.text("");
		} else {
			index = ((index % count) + count) % count;
			$text.text(CORNER_BANNER_MESSAGES[index]);
			var multi = count > 1;
			if ($nav) {
				if (multi) $nav.removeAttr("hidden");
				else $nav.attr("hidden", "hidden");
			}
			$indexLabel.text(multi ? (index + 1) + " / " + count : "");
		}
		$root.removeAttr("hidden");
		syncLayout();
	}

	function step(delta) {
		if (messageCount() <= 1) return;
		index += delta;
		render();
	}

	function getUserName() {
		var c = global.MPP && global.MPP.client;
		if (!c || !c.getOwnParticipant) return "?";
		var p = c.getOwnParticipant();
		return (p && p.name) ? p.name : "?";
	}

	function ensureLoggerRoom() {
		if (typeof global.ChatLogger === "undefined") return;
		var ch = global.MPP && global.MPP.client && global.MPP.client.channel;
		if (ch && ch._id) global.ChatLogger.setRoom(ch._id);
	}

	function showPromptFeedback(message, isError) {
		if(!$feedback || !$feedback.length) return;
		$feedback.text(message || "");
		$feedback.toggleClass("is-error", !!isError);
		$feedback.removeAttr("hidden");
		if(gFeedbackTimer) clearTimeout(gFeedbackTimer);
		gFeedbackTimer = setTimeout(function() {
			$feedback.attr("hidden", "hidden").text("");
		}, isError ? 5000 : 3500);
	}

	function submitPrompt(e) {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		if (!CORNER_PROMPT.enabled || !CORNER_PROMPT.text) return;
		var answer = ($input.val() || "").trim();
		if (!answer) {
			showPromptFeedback("Please type a reply first.", true);
			return;
		}
		var sent = logPromptReply(answer);
		if (!sent) {
			showPromptFeedback("Logging is not available.", true);
			return;
		}
		$input.val("");
		if (sent && sent.then) {
			sent.then(function(ok) {
				if(ok) {
					showPromptFeedback("Thank you — your reply was saved.");
				} else {
					showPromptFeedback("Could not save reply. Check that chat-save-server is running.", true);
				}
			}).catch(function() {
				showPromptFeedback("Could not save reply. Check that chat-save-server is running.", true);
			});
		} else {
			showPromptFeedback("Thank you — your reply was sent.");
		}
	}

	function setupPrompt() {
		if (!$promptBlock || !$promptText || !$input || !$submit) return;
		if (!CORNER_PROMPT.enabled || !CORNER_PROMPT.text) {
			$promptBlock.attr("hidden", "hidden");
			return;
		}
		$promptText.text(CORNER_PROMPT.text);
		$input.attr("placeholder", CORNER_PROMPT.placeholder || "");
		$submit.text(CORNER_PROMPT.buttonLabel || "Send");
		$promptBlock.removeAttr("hidden");
	}

	var CornerBanner = {
		showUi: SHOW_UI,
		showMessages: SHOW_MESSAGES,
		messages: CORNER_BANNER_MESSAGES,
		prompt: CORNER_PROMPT,

		logReply: logPromptReply,

		getIndex: function () {
			return index;
		},

		setIndex: function (i) {
			index = i;
			render();
		},

		next: function () {
			step(1);
		},

		prev: function () {
			step(-1);
		},

		init: function () {
			$root = $("#corner-banner");
			if (!$root.length) return;
			$head = $root.find(".corner-banner-head");
			$body = $root.find(".corner-banner-body");
			$text = $root.find(".corner-banner-text");
			$nav = $root.find(".corner-banner-nav");
			$prev = $root.find(".corner-banner-prev");
			$next = $root.find(".corner-banner-next");
			$indexLabel = $root.find(".corner-banner-index");
			$promptBlock = $root.find(".corner-banner-prompt");
			$promptText = $root.find(".corner-banner-prompt-text");
			$input = $root.find(".corner-banner-input");
			$submit = $root.find(".corner-banner-submit");
			$feedback = $root.find(".corner-banner-feedback");

			$prev.on("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				step(-1);
			});
			$next.on("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				step(1);
			});

			$root.find(".corner-banner-form").on("submit", submitPrompt);
			$submit.on("click", submitPrompt);
			$input.on("keydown", function (e) {
				e.stopPropagation();
			});
			$input.on("mousedown touchstart pointerdown", function (e) {
				e.stopPropagation();
			});
			$submit.on("mousedown touchstart pointerdown", function (e) {
				e.stopPropagation();
			});
			$root.on("mousedown touchstart pointerdown", ".corner-banner-form, .corner-banner-submit", function (e) {
				e.stopPropagation();
			});

			setupPrompt();
			render();
			if (!SHOW_UI) {
				$root.attr("hidden", "hidden");
			}
			if (typeof ResizeObserver !== "undefined") {
				gLayoutObserver = new ResizeObserver(function () {
					syncLayout();
				});
				gLayoutObserver.observe($root[0]);
			}
			$(global).on("resize.cornerBanner", syncLayout);
		}
	};

	global.CornerBanner = CornerBanner;
})(typeof window !== "undefined" ? window : this);
