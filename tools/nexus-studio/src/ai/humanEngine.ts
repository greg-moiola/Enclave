
import * as H from '@vladmandic/human'

export interface DetectedExpression {
  expression: string
  confidence: number
}

export interface DetectedFace {
  expressions: DetectedExpression[]
  mainExpression: string | null
  confidence: number
  box: [number, number, number, number] | null
}

export interface ImageAnalysisResult {
  faceCount: number
  faces: DetectedFace[]
}

interface HumanDetectionResult {
  face?: Array<{
    box?: number[]
    emotion?: Array<{
      emotion: string
      score: number
    }>
  }>
}

const humanConfig: Partial<H.Config> = {
  backend: 'webgl',
  modelBasePath: `${import.meta.env.BASE_URL}models/`,
  cacheModels: true,

  filter: {
    enabled: true,
    equalization: true,
  },

  face: {
    enabled: true,

    detector: {
      modelPath: 'blazeface.json',

      // Correzione per volti ruotati o inclinati
      rotation: true,

      // Consente di rilevare più persone
      maxDetected: 10,

      // Soglia leggermente più permissiva
      // per non perdere volti meno evidenti
      minConfidence: 0.12,

      minSize: 20,
    },

    mesh: {
      enabled: false,
    },

    attention: {
      enabled: false,
    },

    iris: {
      enabled: false,
    },

    description: {
      enabled: false,
    },

    emotion: {
      enabled: true,
      modelPath: 'emotion.json',
      minConfidence: 0.1,
    },
  },

  body: {
    enabled: false,
  },

  hand: {
    enabled: false,
  },

  object: {
    enabled: false,
  },

  segmentation: {
    enabled: false,
  },

  gesture: {
    enabled: false,
  },
}

let humanInstance: H.Human | null = null
let loadingPromise: Promise<void> | null = null

export async function initializeHumanEngine(): Promise<void> {
  if (humanInstance) return

  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const engine = new H.Human(humanConfig)

    await engine.load()

    humanInstance = engine
  })()

  try {
    await loadingPromise
  } catch (error) {
    humanInstance = null
    loadingPromise = null

    throw error
  }
}

export async function analyzeImage(
  input: HTMLImageElement | HTMLCanvasElement,
): Promise<ImageAnalysisResult> {
  if (!humanInstance) {
    await initializeHumanEngine()
  }

  if (!humanInstance) {
    throw new Error('Il motore IA non è stato inizializzato.')
  }

  // Large phone photos can be several thousand pixels wide. A bounded
  // processing surface reduces tensor allocation and inference time while
  // keeping the returned face boxes aligned with the original image.
  const originalWidth = input instanceof HTMLImageElement
    ? input.naturalWidth
    : input.width
  const originalHeight = input instanceof HTMLImageElement
    ? input.naturalHeight
    : input.height

  if (!originalWidth || !originalHeight) {
    throw new Error('L’immagine selezionata non ha dimensioni valide.')
  }

  const maxDimension = 1600
  const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight))
  const processingWidth = Math.max(1, Math.round(originalWidth * scale))
  const processingHeight = Math.max(1, Math.round(originalHeight * scale))

  let processingInput: HTMLImageElement | HTMLCanvasElement = input

  if (scale < 1) {
    const canvas = document.createElement('canvas')
    canvas.width = processingWidth
    canvas.height = processingHeight

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      throw new Error('Impossibile preparare l’immagine per l’analisi.')
    }

    context.drawImage(input, 0, 0, processingWidth, processingHeight)
    processingInput = canvas
  }

  const result = (
    await humanInstance.detect(processingInput)
  ) as unknown as HumanDetectionResult

  const detectedFaces = result.face ?? []
  const coordinateScaleX = originalWidth / processingWidth
  const coordinateScaleY = originalHeight / processingHeight

  const faces: DetectedFace[] = detectedFaces.map((face) => {
    const expressions = (face.emotion ?? [])
      .map((item) => ({
        expression: item.emotion,
        confidence: Math.round(item.score * 100),
      }))
      .sort((a, b) => b.confidence - a.confidence)

    const rawBox = face.box

    const box =
      rawBox && rawBox.length >= 4
        ? ([
            rawBox[0] * coordinateScaleX,
            rawBox[1] * coordinateScaleY,
            rawBox[2] * coordinateScaleX,
            rawBox[3] * coordinateScaleY,
          ] as [number, number, number, number])
        : null

    const confidence = expressions[0]?.confidence ?? 0

    // Evitiamo di presentare una classificazione debole
    // come se fosse una previsione attendibile.
    const mainExpression =
      confidence >= 45
        ? expressions[0]?.expression ?? null
        : null

    return {
      expressions,
      mainExpression,
      confidence,
      box,
    }
  })

  return {
    faceCount: faces.length,
    faces,
  }
}

export function isHumanEngineReady(): boolean {
  return humanInstance !== null
}
