# NEXUS integration status

## Current stage: engine extraction foundation

- Enclave remains the primary application and its existing files are unchanged by this package.
- The original NEXUS Studio source is retained under `tools/nexus-studio/`.
- The two browser-side NEXUS engines are extracted under `packages/nexus-engine/` with a stable public API in `src/index.ts`.
- `npm run build` in `packages/nexus-engine/` is configured to emit the browser bundle into the repository-root `nexus-engine/` folder and copy the Human face/emotion model files alongside it.
- The existing EnclaveAI chat and Cloudflare Worker are intentionally not modified or connected yet. That is a separate step after the current Worker contract and attachment consent flow are reviewed.

## Build the browser engine

From the repository root:

```bash
cd packages/nexus-engine
npm install
npm run build
cd ../..
```

Expected output includes `nexus-engine/nexus-engine.js` and `nexus-engine/models/`.

## Public API

- `initializeSubjectSearchEngine(onProgress?)`
- `analyzeSubjectImage(image, description, onProgress?)`
- `analyzeSubjectVideo(video, description, onProgress?)`
- `initializeHumanEngine()`
- `analyzeImage(imageOrCanvas)`
- `isHumanEngineReady()`

All inference runs in the browser. The engine does not upload source images or videos. Callers must obtain user consent before analyzing any private Enclave attachment.

## Important

This is not yet an end-user EnclaveAI integration. Do not deploy this stage expecting new AI features to appear in the EnclaveAI chat. First build and validate the engine on a separate branch; then connect explicit EnclaveAI tools and UI flows.
