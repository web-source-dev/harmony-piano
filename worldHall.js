/**
 * Harmony World — the hallway behind the lounge, through the door by the dining table.
 *
 * Local coordinates (origin at world 13.35, 10.35): x -1.15..1.15, z -2..2, ceiling 3 m.
 * Doors: north back to the lounge (its French doors are this hallway's), west to the game room
 * (worldGameRoom.js) and east to the spa (worldSpa.js) - those two rooms own their doors.
 *
 *   a runner down the middle, signs over each door, a couple of framed pictures, a plant and a wall light.
 */
const W = 2.3, D = 4.0, H = 3.0, HW = W / 2, HD = D / 2;
const SIDE_Z = 0.8;   // where the side doors are (to the game room, to the spa)

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex } = k;

	// ---------------------------------------------------------------- the room
	k.shell({
		w: W, d: D, h: H,
		floor: mat("#ffffff", 0.5, 0, { map: tex.wood(["#8a5a3c", "#94633f", "#7f5236", "#9a6a45"], W / 3, D / 3, 63) }),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#efe4d4", "panel", "rgba(160,130,100,0.10)", D / 2, H / 2) }),
		ceil: mat("#f3ece2", 0.95),
		holes: [
			{ wall: "n", at: 0, w: 1.5, y1: 2.3 },         // back to the lounge
			{ wall: "w", at: SIDE_Z, w: 1.5, y1: 2.3 },    // the game room
			{ wall: "e", at: SIDE_Z, w: 1.5, y1: 2.3 }     // the spa
		]
	});
	k.floor(() => 0);
	k.walk(-HW, HW, -HD, HD);
	k.walk(-0.7, 0.7, -HD - 0.9, -HD + 1.0);                  // to the lounge
	k.walk(-HW - 0.9, -HW + 1.0, SIDE_Z - 0.7, SIDE_Z + 0.7);   // to the game room
	k.walk(HW - 1.0, HW + 0.9, SIDE_Z - 0.7, SIDE_Z + 0.7);     // to the spa
	k.cam = { minX: -HW + 0.15, maxX: HW - 0.15, minZ: -HD + 0.15, maxZ: HD - 0.15, maxY: H - 0.2 };
	k.frenchDoor("halllounge", { x: 0, z: -HD - 0.1, ry: Math.PI, w: 1.46, h: 2.3, depth: 0.45, side: -1, curtain: "#8b7bb0" }, [-0.75, 0.75, -HD - 0.25, -HD + 0.05], [[0, -HD + 0.8], [0, -HD - 1.0]]);
	k.lightSwitch(0.95, 1.25, -HD + 0.02, 0);

	// signs over the doors
	for (const [x, y, z, ry, text, icon] of [[0, 2.62, -HD + 0.04, 0, "Lounge", "sofa"], [-HW + 0.04, 2.62, SIDE_Z, Math.PI / 2, "Game Room", "games"], [HW - 0.04, 2.62, SIDE_Z, -Math.PI / 2, "Spa", "bath"]]) {
		const st = tex.sign(text, icon);
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), x, y, z, { ry, cast: false });
	}
	// little arrows on the end wall: games this way, spa that way (looking at it from the lounge door, the game room is on the right)
	{
		const c = tex.text("← Spa     Games →", { w: 1024, h: 160, color: "#6b4f3a", font: "800 84px 'Nunito', sans-serif" });
		add(g, new THREE.PlaneGeometry(1.7, 0.27), new THREE.MeshBasicMaterial({ map: c, transparent: true, depthWrite: false }), 0, 1.95, HD - 0.03, { ry: Math.PI, cast: false, receive: false });
	}

	// ---------------------------------------------------------------- a runner, pictures, a plant, a console table
	const run = add(g, new THREE.PlaneGeometry(1.0, D - 0.3), mat("#ffffff", 1, 0, { map: tex.runner("#7a3b4f", "#e8c27a") }), 0, 0.006, 0, { rx: -Math.PI / 2, cast: false });
	run.userData.floor = true;
	[[-HW + 0.03, 1.6, -1.0, Math.PI / 2, 3], [HW - 0.03, 1.6, -1.0, -Math.PI / 2, 1]].forEach(([x, y, z, ry, seed]) => {
		const pg = group(g, x, y, z, ry);
		add(pg, rbox(0.55, 0.7, 0.03, 0.01), mat("#c9a05a", 0.35, 0.7), 0, 0, 0, { cast: false });
		add(pg, new THREE.PlaneGeometry(0.47, 0.62), new THREE.MeshStandardMaterial({ map: tex.art(seed), roughness: 0.6 }), 0, 0, 0.017, { cast: false });
	});
	// a narrow console table on the end wall, with a vase of flowers
	const ct = group(g, 0, 0, HD - 0.22);
	const woodM = mat("#6b4a33", 0.5);
	add(ct, rbox(1.1, 0.04, 0.3, 0.01), woodM, 0, 0.8, 0);
	for (const sx of [-0.5, 0.5]) add(ct, new THREE.BoxGeometry(0.04, 0.8, 0.26), woodM, sx, 0.4, 0);
	add(ct, new THREE.CylinderGeometry(0.06, 0.045, 0.22, 14), mat("#bde0fe", 0.2), 0.25, 0.93, 0, { cast: false });
	for (let i = 0; i < 7; i++) {
		const a = i / 7 * Math.PI * 2;
		add(ct, new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), mat("#3d6b35", 0.6), 0.25 + Math.cos(a) * 0.02, 1.12, Math.sin(a) * 0.02, { cast: false });
		add(ct, new THREE.SphereGeometry(0.035, 8, 6), mat(["#ff6b8b", "#ffd166", "#ffffff", "#c77dff"][i % 4], 0.5), 0.25 + Math.cos(a) * 0.05, 1.23, Math.sin(a) * 0.05, { cast: false });
	}
	k.box(-0.6, 0.6, HD - 0.4, HD);
	// a wall light over the table
	const glow = new THREE.MeshStandardMaterial({ color: "#fff4dc", emissive: "#ffcf8a", emissiveIntensity: 1.6 });
	add(g, new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow, 0, 2.3, HD - 0.05, { rx: -Math.PI / 2, cast: false });

	// ---------------------------------------------------------------- light
	k.light(0, 2.6, -0.8, "#ffe2c0", 2.2, 5);
	k.light(0, 2.2, HD - 0.5, "#ffcf8a", 1.6, 4);
	k.key.pos.copy(k.V(0, H - 0.15, 0)); k.key.target.copy(k.V(0, 0, 0));
	k.key.angle = 1.2; k.key.intensity = 10; k.key.distance = 9; k.key.color.set("#ffe6cc");
	k.fill.pos.copy(k.V(0, 2.3, 0)); k.fill.intensity = 3; k.fill.distance = 10;
	k.hemi = 0.4; k.env = 0.25; k.exposure = 1.05;

	return {};
}
