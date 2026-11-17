// \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t, n) => () => {
	if (n) throw n[0];
	try {
		return e && (t = e(e = 0)), t;
	} catch (e) {
		throw n = [e], e;
	}
}, s = (e, t) => () => (t || (e((t = { exports: {} }).exports, t, t.exports), e = null), t.exports), c = (e, n) => {
	let r = {};
	for (var i in e) t(r, i, {
		get: e[i],
		enumerable: !0
	});
	return n || t(r, Symbol.toStringTag, { value: "Module" }), r;
}, l = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, u = (n, r, o) => (o = n == null ? {} : e(i(n)), l(r || !n || !n.__esModule || !a.call(n, "default") ? t(o, "default", {
	value: n,
	enumerable: !0
}) : o, n)), d = (e) => a.call(e, "module.exports") ? e["module.exports"] : l(t({}, "__esModule", { value: !0 }), e), f = /* @__PURE__ */ ((e) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(e, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : e)(function(e) {
	if (typeof require < "u") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + e + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
}), p = "Xenova/clip-vit-base-patch32", m = "Xenova/opus-mt-it-en", h = .35, g = 2.5, _ = 40, v = 8, y = 960, b = null, x = null, S = null, C = null, w = null, T = null;
function E(e, t) {
	e?.(t);
}
async function D() {
	if (!b) {
		C ||= (async () => {
			let [e, t] = await Promise.all([import("./dist-ZTop5CZW.js"), import("./coco-ssd.es2017.esm.min-CqUqTu2y.js").then((e) => /* @__PURE__ */ u(e.default, 1))]);
			await e.ready(), b = await t.load({ base: "lite_mobilenet_v2" });
		})();
		try {
			await C;
		} catch (e) {
			throw C = null, e;
		}
	}
}
async function O() {
	if (!x) {
		w ||= (async () => {
			let { pipeline: e } = await import("./transformers.web-GF-3Deun.js");
			x = await e("zero-shot-image-classification", p);
		})();
		try {
			await w;
		} catch (e) {
			throw w = null, e;
		}
	}
}
function k(e) {
	let t = ` ${e.toLowerCase()} `;
	return (/* @__PURE__ */ " il . lo . la . gli . le . un . una . con . che . indossa . vestito . vestita . pantaloni . maglietta . giacca . cappello . zaino . scarpe . uomo . donna . persona . ragazzo . ragazza . rosso . rossa . giallo . gialla . nero . nera . bianco . bianca . blu . azzurro . verde . grigio ".split(".")).some((e) => t.includes(e)) || /[àèéìòù]/i.test(e);
}
async function A() {
	if (!S) {
		T ||= (async () => {
			let { pipeline: e } = await import("./transformers.web-GF-3Deun.js");
			S = await e("translation", m, { dtype: "q8" });
		})();
		try {
			await T;
		} catch (e) {
			throw T = null, e;
		}
	}
}
async function j(e, t) {
	let n = e.trim();
	if (!k(n)) return n;
	if (E(t, {
		stage: "loading",
		current: 0,
		total: 1,
		message: "Preparing Italian-to-English translation..."
	}), await A(), !S) throw Error("The translation engine could not be initialized.");
	let r = (await S(n))[0]?.translation_text?.trim();
	if (!r) throw Error("Unable to translate the search description.");
	return r;
}
async function M(e) {
	E(e, {
		stage: "loading",
		current: 0,
		total: 2,
		message: "Loading local visual detection engine..."
	}), await D(), E(e, {
		stage: "loading",
		current: 1,
		total: 2,
		message: "Loading visual matching model..."
	}), await O();
}
function N(e, t) {
	let n = document.createElement("canvas");
	return n.width = Math.max(1, Math.round(e)), n.height = Math.max(1, Math.round(t)), n;
}
function P(e) {
	return e instanceof HTMLVideoElement ? {
		width: e.videoWidth,
		height: e.videoHeight
	} : e instanceof HTMLImageElement ? {
		width: e.naturalWidth,
		height: e.naturalHeight
	} : {
		width: e.width,
		height: e.height
	};
}
function F(e) {
	let { width: t, height: n } = P(e);
	if (!t || !n) throw Error("The selected source has invalid dimensions.");
	let r = Math.min(1, y / Math.max(t, n)), i = N(t * r, n * r), a = i.getContext("2d");
	if (!a) throw Error("Unable to initialize image processing.");
	return a.drawImage(e, 0, 0, i.width, i.height), i;
}
function I(e, t, n) {
	let r = Math.max(0, Math.min(e[0], t)), i = Math.max(0, Math.min(e[1], n)), a = Math.max(r, Math.min(e[0] + e[2], t)), o = Math.max(i, Math.min(e[1] + e[3], n));
	return [
		r,
		i,
		a - r,
		o - i
	];
}
function L(e, t) {
	let [n, r, i, a] = t, o = Math.min(1, 384 / Math.max(i, a)), s = N(i * o, a * o), c = s.getContext("2d", { alpha: !1 });
	if (!c) throw Error("Unable to create person crop.");
	return c.drawImage(e, n, r, i, a, 0, 0, s.width, s.height), s.toDataURL("image/jpeg", .76);
}
function R(e, t) {
	let [n, r, i, a] = t, o = n + i * .16, s = r + a * .2, c = i * .68, l = a * .44, u = N(c, l), d = u.getContext("2d");
	if (!d) throw Error("Unable to analyze clothing colors.");
	return d.drawImage(e, o, s, c, l, 0, 0, u.width, u.height), u;
}
function z(e) {
	return e.trim().replace(/\s+/g, " ").toLowerCase();
}
var B = {
	yellow: [
		"yellow",
		"giallo",
		"gialla",
		"gialli",
		"gialle"
	],
	red: [
		"red",
		"rosso",
		"rossa",
		"rossi",
		"rosse"
	],
	pink: ["pink", "rosa"],
	blue: [
		"blue",
		"blu",
		"azzurro",
		"azzurra",
		"azzurri"
	],
	green: [
		"green",
		"verde",
		"verdi"
	],
	orange: ["orange", "arancione"],
	purple: [
		"purple",
		"violet",
		"viola"
	],
	black: [
		"black",
		"nero",
		"nera",
		"neri",
		"nere"
	],
	white: [
		"white",
		"bianco",
		"bianca",
		"bianchi",
		"bianche"
	],
	gray: [
		"gray",
		"grey",
		"grigio",
		"grigia",
		"grigi",
		"grigie"
	],
	brown: [
		"brown",
		"marrone",
		"marroni"
	]
};
function V(e) {
	let t = z(e);
	for (let [e, n] of Object.entries(B)) if (n.some((e) => RegExp(`(^|\\s)${e}($|\\s)`, "i").test(t))) return e;
	return null;
}
function H(e, t, n) {
	let r = e / 255, i = t / 255, a = n / 255, o = Math.max(r, i, a), s = o - Math.min(r, i, a), c = 0;
	return s !== 0 && (c = o === r ? 60 * ((i - a) / s % 6) : o === i ? 60 * ((a - r) / s + 2) : 60 * ((r - i) / s + 4)), c < 0 && (c += 360), {
		hue: c,
		saturation: o === 0 ? 0 : s / o,
		value: o
	};
}
function U(e, t, n, r) {
	switch (r) {
		case "yellow": return e >= 35 && e <= 72 && t > .28 && n > .32;
		case "orange": return e >= 15 && e < 40 && t > .3 && n > .3;
		case "red": return (e < 12 || e > 345) && t > .3 && n > .25;
		case "pink": return (e >= 300 || e <= 12) && t > .16 && n > .48;
		case "blue": return e >= 190 && e <= 255 && t > .2 && n > .2;
		case "green": return e >= 75 && e <= 165 && t > .22 && n > .2;
		case "purple": return e >= 255 && e < 310 && t > .2 && n > .2;
		case "black": return n < .23;
		case "white": return n > .78 && t < .25;
		case "gray": return t < .17 && n >= .22 && n <= .78;
		case "brown": return e >= 8 && e <= 40 && t > .2 && n < .58;
		default: return !1;
	}
}
function W(e, t, n) {
	let r = R(e, t), i = r.getContext("2d");
	if (!i) return 0;
	let { data: a, width: o, height: s } = i.getImageData(0, 0, r.width, r.height), c = 0, l = 0;
	for (let e = 0; e < s; e += 4) for (let t = 0; t < o; t += 4) {
		let r = (e * o + t) * 4, i = H(a[r], a[r + 1], a[r + 2]);
		l++, U(i.hue, i.saturation, i.value, n) && c++;
	}
	return l ? Math.min(100, Math.round(c / l * 250)) : 0;
}
async function G(e, t, n, r) {
	if (!x) throw Error("Visual matching engine is not initialized.");
	let i = L(e, t), a = [`A photograph of a person matching this description: ${n}`, "A photograph of a person who does not match the requested description"], o = (await x(i, a)).find((e) => e.label === a[0])?.score ?? 0;
	if (!r) return Math.round(o * 100);
	let s = W(e, t, r);
	return Math.round(s * .72 + o * 100 * .28);
}
async function K(e) {
	if (!b) throw Error("Person detection engine is not initialized.");
	return (await b.detect(e, v, h)).filter((e) => e.class === "person").map((t) => ({
		box: I(t.bbox, e.width, e.height),
		confidence: Math.round(t.score * 100)
	})).filter((e) => e.box[2] > 0 && e.box[3] > 0);
}
async function q(e, t, n, r, i, a = 0, o = 1) {
	let s = P(e), c = F(e), l = await K(c);
	l.length > 0 && await O();
	let u = V(t), d = s.width / c.width, f = s.height / c.height, p = [];
	for (let e = 0; e < l.length; e++) {
		let s = l[e];
		E(i, {
			stage: "matching",
			current: a + e,
			total: o,
			message: `Comparing detected subject ${e + 1} of ${l.length}...`
		});
		let m = await G(c, s.box, t, u);
		p.push({
			id: `frame-${n}-person-${e}`,
			frameIndex: n,
			timestamp: r,
			box: [
				s.box[0] * d,
				s.box[1] * f,
				s.box[2] * d,
				s.box[3] * f
			],
			detectionConfidence: s.confidence,
			matchConfidence: m,
			isBestMatch: !1
		});
	}
	return {
		frameIndex: n,
		timestamp: r,
		width: s.width,
		height: s.height,
		detections: p
	};
}
function J(e, t, n, r, i) {
	let a = i.flatMap((e) => e.detections), o = V(t) ? 48 : 62, s = a.filter((e) => e.matchConfidence >= o);
	for (let e of s) e.isBestMatch = !0;
	let c = [...s].sort((e, t) => t.matchConfidence - e.matchConfidence)[0] ?? null;
	return {
		description: e,
		translatedDescription: t,
		sourceType: n,
		duration: r,
		framesAnalyzed: i.length,
		peopleDetected: a.length,
		matchingPeople: s.length,
		bestMatch: c,
		frames: i
	};
}
async function Y(e, t, n) {
	await D();
	let r = await j(t, n);
	E(n, {
		stage: "detecting",
		current: 0,
		total: 1,
		message: "Detecting people in the image..."
	});
	let i = J(t, r, "image", null, [await q(e, r, 0, null, n, 0, 1)]);
	return E(n, {
		stage: "completed",
		current: 1,
		total: 1,
		message: `Analysis completed. ${i.matchingPeople} matching subjects found.`
	}), i;
}
function X(e, t) {
	return new Promise((n, r) => {
		let i = Math.max(0, Math.min(t, Math.max(0, e.duration - .05)));
		if (Math.abs(e.currentTime - i) < .02) {
			n();
			return;
		}
		let a = () => {
			s(), n();
		}, o = () => {
			s(), r(/* @__PURE__ */ Error("Unable to read a video frame."));
		}, s = () => {
			e.removeEventListener("seeked", a), e.removeEventListener("error", o);
		};
		e.addEventListener("seeked", a, { once: !0 }), e.addEventListener("error", o, { once: !0 }), e.currentTime = i;
	});
}
async function Z(e, t, n) {
	await D();
	let r = await j(t, n), i = Number.isFinite(e.duration) ? e.duration : 0;
	if (!i || !e.videoWidth || !e.videoHeight) throw Error("The selected video is not ready for analysis.");
	let a = Math.min(_, Math.max(1, Math.ceil(i / g))), o = [];
	for (let e = 0; e < a; e++) o.push(Math.min(e * g, Math.max(0, i - .05)));
	let s = [];
	for (let t = 0; t < o.length; t++) {
		let i = o[t];
		E(n, {
			stage: "detecting",
			current: t,
			total: o.length,
			message: `Scanning video frame ${t + 1} of ${o.length}...`
		}), await X(e, i);
		let a = await q(e, r, t, i, n, t, o.length);
		s.push(a);
	}
	let c = J(t, r, "video", i, s);
	return E(n, {
		stage: "completed",
		current: o.length,
		total: o.length,
		message: `Video analysis completed. ${c.matchingPeople} matching detections found.`
	}), c;
}
export { d as a, Y as analyzeSubjectImage, Z as analyzeSubjectVideo, f as i, M as initializeSubjectSearchEngine, o as n, u as o, c as r, s as t };
