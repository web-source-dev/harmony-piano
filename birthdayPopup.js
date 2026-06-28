/**
 * Birthday welcome popup — shows on page load with a Celebrate button
 * that opens the birthday surprise in a new tab.
 */
(function (global) {
	"use strict";

	var BIRTHDAY = {
		enabled: true,
		title: "Happy Birthday!",
		message: "The great day has come back again — another year of joy, music, and wonderful moments. Wishing you a day filled with happiness, laughter, and love!",
		buttonLabel: "Celebrate 🎉",
		url: "https://happybirthday-kiz.netlify.app/"
	};

	var gOpenModal = null;
	var gCloseModal = null;

	var BirthdayPopup = {
		config: BIRTHDAY,

		init: function (options) {
			options = options || {};
			gOpenModal = options.openModal || null;
			gCloseModal = options.closeModal || null;

			var $dialog = $("#birthday-popup");
			if (!$dialog.length || !BIRTHDAY.enabled) return;

			$dialog.find(".birthday-popup-title").text(BIRTHDAY.title);
			$dialog.find(".birthday-popup-message").text(BIRTHDAY.message);
			$dialog.find(".birthday-popup-celebrate").text(BIRTHDAY.buttonLabel);

			$dialog.find(".birthday-popup-celebrate").on("click", function () {
				window.open(BIRTHDAY.url, "_blank", "noopener,noreferrer");
				if (gCloseModal) gCloseModal();
			});

			$dialog.find(".birthday-popup-close").on("click", function () {
				if (gCloseModal) gCloseModal();
			});

			if (global.gDontShow) return;

			setTimeout(function () {
				if (gOpenModal) gOpenModal("#birthday-popup", ".birthday-popup-celebrate");
			}, 800);
		}
	};

	global.BirthdayPopup = BirthdayPopup;
})(typeof window !== "undefined" ? window : this);
