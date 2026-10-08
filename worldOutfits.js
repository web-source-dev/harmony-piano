/**
 * Harmony World — what people can wear (plain data, no three.js), shared by the characters (worldAvatar.js) and the
 * character screen / network code (world.js).
 *
 * An outfit is a set of garments; each garment is coloured by one of the outfit's parts, and every part has its own
 * colour (pick the outfit, then recolour each piece of it). A look is:
 *   { gender, skin, hair, hairStyle, eyes, outfit, colors: { <part key>: "#rrggbb" }, name }
 * plus top / bottom (the outfit's two main colours: the name tag's dot, the chat colour, and what older clients draw).
 *
 * Part keys (what each garment builder in worldAvatar.js reads):
 *   top     the shirt / T-shirt / hoodie / sweater / blouse / dress / gown
 *   trim    accents: a hoodie's strings and cuffs, a sweater's ribbing, a dress's bow, a gown's sash
 *   over    a jacket or cardigan worn over the top
 *   tie     a necktie
 *   bottom  jeans / trousers / joggers / shorts / skirt
 *   belt    a belt
 *   shoes   shoes, boots, sandals, heels
 */

export const SKIN_TONES = ["#f8dcc8", "#eec4a2", "#dba57f", "#bd8058", "#8f5b3b", "#5f3c27"];
export const HAIR_COLORS = ["#1c1411", "#4a2c1a", "#8a5a2b", "#e0bb6e", "#b5402f", "#ece6dd", "#5b3a7a", "#e889a8"];
export const EYE_COLORS = ["#5a3a2a", "#3d2a1f", "#6b8e4e", "#3f7cac", "#7a8a99", "#9a6b2f"];
// (the old single outfit palette: still what the swatches offered before, and what older looks use)
export const OUTFIT_COLORS = ["#c0395a", "#e07a5f", "#f2cc8f", "#81b29a", "#3d5a80", "#5e60ce", "#2b2d42", "#f4f1de", "#a8dadc", "#ffafcc"];
// every garment's palette
export const CLOTH_COLORS = [
	"#f5f2ea", "#c9c5bd", "#6e6a72", "#26242b", "#1f2a44", "#3d5a80", "#4f7cac", "#a8dadc",
	"#2a9d8f", "#4f7a4a", "#7a7a3a", "#f2cc8f", "#e9a23b", "#e07a5f", "#c0392b", "#8c1c3a",
	"#ffafcc", "#e05a9a", "#b8a1ff", "#5e3a8c", "#8a5a3c", "#5a3a26"
];

// g: who it's for ("f" women, "m" men)
export const HAIR_STYLES = [
	{ id: "curtainlong", name: "Curtain bangs", g: "f" },
	{ id: "sleek", name: "Sleek & straight", g: "f" },
	{ id: "beach", name: "Beach waves", g: "f" },
	{ id: "wolf", name: "Wolf cut", g: "f" },
	{ id: "lob", name: "Long bob", g: "f" },
	{ id: "highpony", name: "High ponytail", g: "f" },
	{ id: "messybun", name: "Messy bun", g: "f" },
	{ id: "halfup", name: "Half up", g: "f" },
	{ id: "textured", name: "Textured crop", g: "m" },
	{ id: "curtain", name: "Curtain fringe", g: "m" },
	{ id: "fluffy", name: "Fluffy fringe", g: "m" },
	{ id: "undercut", name: "Side-swept undercut", g: "m" },
	{ id: "slick", name: "Slicked back", g: "m" },
	{ id: "curls", name: "Curly top", g: "m" }
];
// glasses (anyone can wear any)
export const GLASSES = [
	{ id: "none", name: "None" },
	{ id: "round", name: "Round" },
	{ id: "square", name: "Square" },
	{ id: "cat", name: "Cat-eye" },
	{ id: "heart", name: "Heart" },
	{ id: "sun", name: "Sunglasses" }
];

// g: who wears it ("f" women, "m" men): each only sees their own
// parts: [key, label, default colour]
// build: which garment of each kind (worldAvatar.js draws them)
export const OUTFITS = [
	{ id: "tee", name: "T-shirt & jeans", g: "m", parts: [["top", "T-shirt", "#c0392b"], ["bottom", "Jeans", "#3d5a80"], ["belt", "Belt", "#5a3a26"], ["shoes", "Sneakers", "#f5f2ea"]],
		build: { top: "tee", bottom: "jeans", shoes: "sneakers", belt: true } },
	{ id: "hoodie", name: "Hoodie & joggers", g: "m", parts: [["top", "Hoodie", "#6e6a72"], ["trim", "Strings & cuffs", "#f5f2ea"], ["bottom", "Joggers", "#26242b"], ["shoes", "Sneakers", "#f5f2ea"]],
		build: { top: "hoodie", bottom: "joggers", shoes: "sneakers" } },
	{ id: "shirt", name: "Shirt & chinos", g: "m", parts: [["top", "Shirt", "#a8dadc"], ["bottom", "Chinos", "#c9b48a"], ["belt", "Belt", "#5a3a26"], ["shoes", "Loafers", "#5a3a26"]],
		build: { top: "shirt", bottom: "trousers", shoes: "loafers", belt: true } },
	{ id: "suit", name: "Suit & tie", g: "m", parts: [["over", "Jacket", "#1f2a44"], ["top", "Shirt", "#f5f2ea"], ["tie", "Tie", "#8c1c3a"], ["bottom", "Trousers", "#1f2a44"], ["shoes", "Shoes", "#26242b"]],
		build: { top: "shirt", over: "blazer", tie: true, bottom: "trousers", shoes: "loafers" } },
	{ id: "shirtjeans", name: "Shirt & jeans", g: "m", parts: [["top", "Shirt", "#f5f2ea"], ["bottom", "Jeans", "#1f2a44"], ["belt", "Belt", "#26242b"], ["shoes", "Sneakers", "#26242b"]],
		build: { top: "shirt", bottom: "jeans", shoes: "sneakers", belt: true } },
	{ id: "kurta", name: "Kurta & pajama", g: "m", parts: [["top", "Kurta", "#f5f2ea"], ["bottom", "Pajama", "#f5f2ea"], ["shoes", "Shoes", "#5a3a26"]],
		build: { top: "kurta", bottom: "trousers", shoes: "loafers" } },
	{ id: "summer", name: "Tank & shorts", g: "m", parts: [["top", "Tank top", "#f5f2ea"], ["bottom", "Shorts", "#2a9d8f"], ["shoes", "Sandals", "#8a5a3c"]],
		build: { top: "tank", bottom: "shorts", shoes: "sandals" } },
	{ id: "polo", name: "Polo & chinos", g: "m", parts: [["top", "Polo", "#2a9d8f"], ["bottom", "Chinos", "#c9b48a"], ["belt", "Belt", "#5a3a26"], ["shoes", "Loafers", "#5a3a26"]],
		build: { top: "polo", bottom: "trousers", shoes: "loafers", belt: true } },
	{ id: "bomber", name: "Bomber jacket", g: "m", parts: [["over", "Jacket", "#4f7a4a"], ["top", "T-shirt", "#26242b"], ["bottom", "Joggers", "#26242b"], ["shoes", "Sneakers", "#f5f2ea"]],
		build: { top: "tee", over: "bomber", bottom: "joggers", shoes: "sneakers" } },
	{ id: "turtle", name: "Turtleneck & blazer", g: "m", parts: [["over", "Blazer", "#6e6a72"], ["top", "Turtleneck", "#26242b"], ["bottom", "Trousers", "#26242b"], ["shoes", "Shoes", "#26242b"]],
		build: { top: "turtle", over: "blazer", bottom: "trousers", shoes: "loafers" } },
	{ id: "denim", name: "Denim jacket", g: "m", parts: [["over", "Jacket", "#4f7cac"], ["top", "T-shirt", "#f5f2ea"], ["bottom", "Trousers", "#26242b"], ["shoes", "Boots", "#8a5a3c"]],
		build: { top: "tee", over: "denim", bottom: "trousers", shoes: "boots" } },
	{ id: "sweater", name: "Cozy sweater", g: "m", parts: [["top", "Sweater", "#e9a23b"], ["trim", "Ribbing", "#c97f1e"], ["bottom", "Jeans", "#26242b"], ["shoes", "Boots", "#8a5a3c"]],
		build: { top: "sweater", bottom: "jeans", shoes: "boots" } },
	{ id: "leather", name: "Leather jacket", g: "m", parts: [["over", "Jacket", "#26242b"], ["top", "T-shirt", "#f5f2ea"], ["bottom", "Jeans", "#4f7cac"], ["shoes", "Boots", "#26242b"]],
		build: { top: "tee", over: "leather", bottom: "jeans", shoes: "boots" } },
	{ id: "sundress", name: "Sundress", g: "f", parts: [["top", "Dress", "#c0395a"], ["trim", "Waist bow", "#f5f2ea"], ["shoes", "Flats", "#3d5a80"]],
		build: { top: "dress", shoes: "flats" } },
	{ id: "blouse", name: "Blouse & skirt", g: "f", parts: [["top", "Blouse", "#f5f2ea"], ["bottom", "Skirt", "#1f2a44"], ["shoes", "Heels", "#26242b"]],
		build: { top: "blouse", bottom: "skirt", shoes: "heels" } },
	{ id: "gown", name: "Evening gown", g: "f", parts: [["top", "Gown", "#8c1c3a"], ["trim", "Sash", "#f2cc8f"], ["shoes", "Heels", "#f2cc8f"]],
		build: { top: "gown", shoes: "heels" } },
	{ id: "ftee", name: "T-shirt & jeans", g: "f", parts: [["top", "T-shirt", "#f5f2ea"], ["bottom", "Jeans", "#4f7cac"], ["shoes", "Sneakers", "#f5f2ea"]],
		build: { top: "tee", bottom: "jeans", shoes: "sneakers" } },
	{ id: "wrap", name: "Wrap midi dress", g: "f", parts: [["top", "Dress", "#e07a5f"], ["trim", "Belt", "#26242b"], ["shoes", "Heels", "#26242b"]],
		build: { top: "wrapdress", shoes: "heels" } },
	{ id: "offsh", name: "Off-shoulder maxi", g: "f", parts: [["top", "Dress", "#b8a1ff"], ["trim", "Sash", "#f5f2ea"], ["shoes", "Heels", "#f5f2ea"]],
		build: { top: "offsh", shoes: "heels" } },
	{ id: "knitdress", name: "Sweater dress", g: "f", parts: [["top", "Dress", "#c9c5bd"], ["shoes", "Boots", "#26242b"]],
		build: { top: "sweaterdress", shoes: "boots" } },
	{ id: "denimdress", name: "Dress & denim jacket", g: "f", parts: [["over", "Jacket", "#4f7cac"], ["top", "Dress", "#f2cc8f"], ["trim", "Waist bow", "#f5f2ea"], ["shoes", "Sneakers", "#f5f2ea"]],
		build: { top: "dress", over: "denim", shoes: "sneakers" } },
	{ id: "maxi", name: "Maxi dress", g: "f", parts: [["top", "Dress", "#2a9d8f"], ["trim", "Belt", "#f2cc8f"], ["shoes", "Flats", "#f2cc8f"]],
		build: { top: "maxi", shoes: "flats" } },
	{ id: "fshirt", name: "Shirt & trousers", g: "f", parts: [["top", "Shirt", "#ffafcc"], ["bottom", "Trousers", "#26242b"], ["belt", "Belt", "#26242b"], ["shoes", "Heels", "#26242b"]],
		build: { top: "shirt", bottom: "trousers", shoes: "heels", belt: true } },
	{ id: "kameez", name: "Kameez & trousers", g: "f", parts: [["top", "Kameez", "#e05a9a"], ["bottom", "Trousers", "#f5f2ea"], ["shoes", "Flats", "#c9a85c"]],
		build: { top: "kurta", bottom: "trousers", shoes: "flats" } },
	{ id: "cardigan", name: "Cardigan & skirt", g: "f", parts: [["over", "Cardigan", "#b8a1ff"], ["top", "Top", "#f5f2ea"], ["bottom", "Skirt", "#5e3a8c"], ["shoes", "Flats", "#26242b"]],
		build: { top: "tee", over: "cardigan", bottom: "midi", shoes: "flats" } },
	{ id: "fsweater", name: "Sweater & skirt", g: "f", parts: [["top", "Sweater", "#f2cc8f"], ["trim", "Ribbing", "#e0b06a"], ["bottom", "Skirt", "#8a5a3c"], ["shoes", "Boots", "#5a3a26"]],
		build: { top: "sweater", bottom: "midi", shoes: "boots" } },
	{ id: "fleather", name: "Leather jacket & jeans", g: "f", parts: [["over", "Jacket", "#26242b"], ["top", "Top", "#ffafcc"], ["bottom", "Jeans", "#3d5a80"], ["shoes", "Boots", "#26242b"]],
		build: { top: "tee", over: "leather", bottom: "hijeans", shoes: "boots" } }
];
const BY_ID = Object.fromEntries(OUTFITS.map(o => [o.id, o]));
export const outfitById = id => BY_ID[id] || null;
export const defaultOutfit = gender => gender === "male" ? "tee" : "sundress";
export const defaultHairStyle = gender => gender === "male" ? "textured" : "curtainlong";

const COLOR_RE = /^#[0-9a-f]{6}$/i;
const okColor = c => typeof c === "string" && COLOR_RE.test(c);

// a complete colour set for an outfit: what's given (by part key), else the outfit's own defaults
export function outfitColors(outfitId, given) {
	const o = outfitById(outfitId) || BY_ID.tee;
	const out = {};
	for (const [k, , d] of o.parts) out[k] = given && okColor(given[k]) ? given[k].toLowerCase() : d;
	return out;
}

// Any look (new, old - just top / bottom - or from the network) -> a complete, safe look.
export function normalizeLook(l) {
	l = l || {};
	const gender = l.gender === "male" ? "male" : "female";
	const g = gender === "male" ? "m" : "f";
	let outfit = outfitById(l.outfit) && outfitById(l.outfit).g === g ? l.outfit : null;
	let given = l.colors && typeof l.colors === "object" ? l.colors : null;
	if (!outfit) {
		// an older look: the dress (top, its belt and shoes bottom) or the shirt and trousers
		outfit = defaultOutfit(gender);
		const t = okColor(l.top) ? l.top : null, b = okColor(l.bottom) ? l.bottom : null;
		given = gender === "male" ? { top: t, bottom: b } : { top: t, shoes: b, trim: b };
	}
	const colors = outfitColors(outfit, given);
	const hs = HAIR_STYLES.some(h => h.id === l.hairStyle && h.g === g) ? l.hairStyle : defaultHairStyle(gender);
	return {
		gender,
		skin: okColor(l.skin) ? l.skin : SKIN_TONES[1],
		hair: okColor(l.hair) ? l.hair : HAIR_COLORS[1],
		hairStyle: hs,
		eyes: okColor(l.eyes) ? l.eyes : (gender === "male" ? EYE_COLORS[1] : EYE_COLORS[0]),
		glasses: GLASSES.some(x => x.id === l.glasses) ? l.glasses : "none",
		outfit, colors,
		top: colors.top || colors.over,
		bottom: colors.bottom || colors.shoes || colors.top,
		name: typeof l.name === "string" ? l.name : ""
	};
}
