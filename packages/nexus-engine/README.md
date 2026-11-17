# NEXUS Engine for Enclave (integration preview)

This package extracts the existing browser-side NEXUS AI engines into a small public API. It does not replace Enclave's current EnclaveAI Worker or chat code.

## Build

Run from this directory:

```bash
npm install
npm run build
```

The build writes the browser bundle and Human model files to `../../nexus-engine/` at the Enclave repository root.

## Public API

- `initializeSubjectSearchEngine(onProgress?)`
- `analyzeSubjectImage(image, description, onProgress?)`
- `analyzeSubjectVideo(video, description, onProgress?)`
- `initializeHumanEngine()`
- `analyzeImage(imageOrCanvas)`
- `isHumanEngineReady()`

All inference runs in the browser. The module does not upload source images or videos. The caller is responsible for obtaining user consent and passing a valid browser image/video element.

## Important

This is an integration foundation, not yet connected to the EnclaveAI chat UI. Do not wire automatic analysis of private chat attachments until the UI consent flow, performance limits, and Worker/tool contract are reviewed.
