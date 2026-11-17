/**
 * NEXUS Engine public API for Enclave.
 * Browser-only inference: image/video inputs are never uploaded by this module.
 */

import type {
  DetectedExpression,
  DetectedFace,
  ImageAnalysisResult,
} from './humanEngine'

import type {
  SubjectDetection,
  SubjectSearchFrame,
  SubjectSearchProgress,
  SubjectSearchResult,
} from './subjectSearchEngine'

let humanEngineInitialized = false

export async function initializeHumanEngine(): Promise<void> {
  const engine = await import('./humanEngine')
  await engine.initializeHumanEngine()
  humanEngineInitialized = true
}

export async function analyzeImage(
  input: HTMLImageElement | HTMLCanvasElement,
): Promise<ImageAnalysisResult> {
  const engine = await import('./humanEngine')
  await engine.initializeHumanEngine()
  humanEngineInitialized = true
  return engine.analyzeImage(input)
}

export function isHumanEngineReady(): boolean {
  return humanEngineInitialized
}

export async function initializeSubjectSearchEngine(
  onProgress?: (progress: SubjectSearchProgress) => void,
): Promise<void> {
  const engine = await import('./subjectSearchEngine')
  await engine.initializeSubjectSearchEngine(onProgress)
}

export async function analyzeSubjectImage(
  image: HTMLImageElement,
  description: string,
  onProgress?: (progress: SubjectSearchProgress) => void,
): Promise<SubjectSearchResult> {
  const engine = await import('./subjectSearchEngine')
  return engine.analyzeSubjectImage(image, description, onProgress)
}

export async function analyzeSubjectVideo(
  video: HTMLVideoElement,
  description: string,
  onProgress?: (progress: SubjectSearchProgress) => void,
): Promise<SubjectSearchResult> {
  const engine = await import('./subjectSearchEngine')
  return engine.analyzeSubjectVideo(video, description, onProgress)
}

export type {
  DetectedExpression,
  DetectedFace,
  ImageAnalysisResult,
  SubjectDetection,
  SubjectSearchFrame,
  SubjectSearchProgress,
  SubjectSearchResult,
}

export const NEXUS_ENGINE_VERSION = '1.0.0-integration-preview'
