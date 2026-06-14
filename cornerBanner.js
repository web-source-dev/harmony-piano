/**
 * Fixed top-right banner — edit CORNER_BANNER_MESSAGES below.
 * Use ‹ › buttons to cycle when more than one message is defined.
 */
(function (global) {
	"use strict";

	// ── Add your messages here (strings only) ──
	var CORNER_BANNER_MESSAGES = [
		"I will join you I promise. I am sorry for the delay but i have been busy with work and other things.",
		];

	// ── Corner prompt (question + input) — set enabled: false to hide ──
	var CORNER_PROMPT = {
		enabled: true,
		text: "Keep Smiling! ❤️",
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
	var gFeedbackTimer = null;

	function messageCount() {
		return CORNER_BANNER_MESSAGES.length;
	}

	function render() {
		if (!$root || !$text) return;
		var count = messageCount();
		var hasPrompt = CORNER_PROMPT.enabled && CORNER_PROMPT.text;
		if (count === 0 && !hasPrompt) {
			$root.attr("hidden", "hidden");
			return;
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
		if (typeof global.ChatLogger === "undefined" || !global.ChatLogger.logCornerPrompt) {
			showPromptFeedback("Logging is not available.", true);
			return;
		}
		ensureLoggerRoom();
		var sent = global.ChatLogger.logCornerPrompt(getUserName(), answer);
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
		messages: CORNER_BANNER_MESSAGES,
		prompt: CORNER_PROMPT,

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
			$input.on("mousedown touchstart", function (e) {
				e.stopPropagation();
			});

			setupPrompt();
			render();
		}
	};

	global.CornerBanner = CornerBanner;
})(typeof window !== "undefined" ? window : this);
