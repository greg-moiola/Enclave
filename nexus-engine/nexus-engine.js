// src/index.ts
var e = !1;
async function t() {
	await (await import("./assets/humanEngine-I5UjYiTY.js")).initializeHumanEngine(), e = !0;
}
async function n(t) {
	let n = await import("./assets/humanEngine-I5UjYiTY.js");
	return await n.initializeHumanEngine(), e = !0, n.analyzeImage(t);
}
function r() {
	return e;
}
async function i(e) {
	await (await import("./assets/subjectSearchEngine-BAwZycqC.js")).initializeSubjectSearchEngine(e);
}
async function a(e, t, n) {
	return (await import("./assets/subjectSearchEngine-BAwZycqC.js")).analyzeSubjectImage(e, t, n);
}
async function o(e, t, n) {
	return (await import("./assets/subjectSearchEngine-BAwZycqC.js")).analyzeSubjectVideo(e, t, n);
}
var s = "1.0.0-integration-preview";
export { s as NEXUS_ENGINE_VERSION, n as analyzeImage, a as analyzeSubjectImage, o as analyzeSubjectVideo, t as initializeHumanEngine, i as initializeSubjectSearchEngine, r as isHumanEngineReady };
