/**
 * Harmony World — the language the Escape House and the Parkour Park talk in (English or Turkish), each viewer's own:
 * kept in this browser, Turkish to start with if the browser is set to Turkish. Both places share it, so switching it
 * in one switches it in the other.
 */
let lang = (() => {
	try { const v = localStorage.getItem("harmonyEscLang"); if (v === "tr" || v === "en") return v; } catch (e) { /* no storage */ }
	return /^tr/i.test((typeof navigator !== "undefined" && navigator.language) || "") ? "tr" : "en";
})();
export const getLang = () => lang;
export function setLang(l) { lang = l === "tr" ? "tr" : "en"; try { localStorage.setItem("harmonyEscLang", lang); } catch (e) { /* no storage */ } }
// L("English", "Türkçe"); TX(["English", "Türkçe"])
export const L = (en, tr) => lang === "tr" ? tr : en;
export const TX = p => Array.isArray(p) ? p[lang === "tr" ? 1 : 0] : p;
// the TR / EN switch (buttons with data-lang)
export const langBtns = () => `<span class="esc-lang"><button data-lang="en"${lang === "en" ? ' class="on"' : ""}>EN</button><button data-lang="tr"${lang === "tr" ? ' class="on"' : ""}>TR</button></span>`;
