
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import { pipeline } from '@huggingface/transformers'

export interface SubjectSearchProgress {
  stage: 'loading' | 'detecting' | 'matching' | 'completed'
  current: number
  total: number
  message: string
}

export interface SubjectDetection {
  id: string
  frameIndex: number
  timestamp: number | null
  box: [number, number, number, number]
  detectionConfidence: number
  matchConfidence: number
  isBestMatch: boolean
}

export interface SubjectSearchFrame {
  frameIndex: number
  timestamp: number | null
  width: number
  height: number
  detections: SubjectDetection[]
}

export interface SubjectSearchResult {
  description: string
  translatedDescription: string
  sourceType: 'image' | 'video'
  duration: number | null
  framesAnalyzed: number
  peopleDetected: number
  matchingPeople: number
  bestMatch: SubjectDetection | null
  frames: SubjectSearchFrame[]
}

type VisualSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement

interface CocoPrediction {
  class: string
  score: number
  bbox: [number, number, number, number]
}

interface ClassificationResult {
  label: string
  score: number
}

type ImageClassifier = (
  image: string,
  candidateLabels: string[],
) => Promise<ClassificationResult[]>

type Translator = (
  text: string,
) => Promise<{ translation_text: string }[]>

type PersonDetector = cocoSsd.ObjectDetection

type TargetColor =
  | 'yellow' | 'red' | 'pink' | 'blue' | 'green'
  | 'orange' | 'purple' | 'black' | 'white'
  | 'gray' | 'brown'

const CLIP_MODEL = 'Xenova/clip-vit-base-patch32'
const TRANSLATION_MODEL = 'Xenova/opus-mt-it-en'

const DETECTION_THRESHOLD = 0.35
const VIDEO_FRAME_INTERVAL = 2.5
const MAX_VIDEO_FRAMES = 40
const MAX_PEOPLE_PER_FRAME = 8
const MAX_ANALYSIS_DIMENSION = 960

let detector: PersonDetector | null = null
let classifier: ImageClassifier | null = null
let translator: Translator | null = null

let detectorPromise: Promise<void> | null = null
let classifierPromise: Promise<void> | null = null
let translatorPromise: Promise<void> | null = null

function report(
  callback: ((progress: SubjectSearchProgress) => void) | undefined,
  progress: SubjectSearchProgress,
) {
  callback?.(progress)
}

async function initializeDetector() {
  if (detector) return

  if (!detectorPromise) {
    detectorPromise = (async () => {
      await tf.ready()

      detector = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      })
    })()
  }

  try {
    await detectorPromise
  } catch (error) {
    detectorPromise = null
    throw error
  }
}

async function initializeClassifier() {
  if (classifier) return

  if (!classifierPromise) {
    classifierPromise = (async () => {
      const loaded = await pipeline(
        'zero-shot-image-classification',
        CLIP_MODEL,
      )

      classifier = loaded as unknown as ImageClassifier
    })()
  }

  try {
    await classifierPromise
  } catch (error) {
    classifierPromise = null
    throw error
  }
}

function looksItalian(text: string): boolean {
  const value = ` ${text.toLowerCase()} `

  const markers = [
    ' il ', ' lo ', ' la ', ' gli ', ' le ',
    ' un ', ' una ', ' con ', ' che ', ' indossa ',
    ' vestito ', ' vestita ', ' pantaloni ',
    ' maglietta ', ' giacca ', ' cappello ',
    ' zaino ', ' scarpe ', ' uomo ', ' donna ',
    ' persona ', ' ragazzo ', ' ragazza ',
    ' rosso ', ' rossa ', ' giallo ', ' gialla ',
    ' nero ', ' nera ', ' bianco ', ' bianca ',
    ' blu ', ' azzurro ', ' verde ', ' grigio ',
  ]

  return markers.some((marker) => value.includes(marker))
    || /[àèéìòù]/i.test(text)
}

async function initializeTranslator() {
  if (translator) return

  if (!translatorPromise) {
    translatorPromise = (async () => {
      const loaded = await pipeline(
        'translation',
        TRANSLATION_MODEL,
        { dtype: 'q8' },
      )

      translator = loaded as unknown as Translator
    })()
  }

  try {
    await translatorPromise
  } catch (error) {
    translatorPromise = null
    throw error
  }
}

async function prepareDescription(
  description: string,
  onProgress?: (progress: SubjectSearchProgress) => void,
): Promise<string> {
  const original = description.trim()

  if (!looksItalian(original)) {
    return original
  }

  report(onProgress, {
    stage: 'loading',
    current: 0,
    total: 1,
    message: 'Preparing Italian-to-English translation...',
  })

  await initializeTranslator()

  if (!translator) {
    throw new Error('The translation engine could not be initialized.')
  }

  const result = await translator(original)
  const translated = result[0]?.translation_text?.trim()

  if (!translated) {
    throw new Error('Unable to translate the search description.')
  }

  return translated
}

export async function initializeSubjectSearchEngine(
  onProgress?: (progress: SubjectSearchProgress) => void,
): Promise<void> {
  report(onProgress, {
    stage: 'loading',
    current: 0,
    total: 2,
    message: 'Loading local visual detection engine...',
  })

  await initializeDetector()

  report(onProgress, {
    stage: 'loading',
    current: 1,
    total: 2,
    message: 'Loading visual matching model...',
  })

  await initializeClassifier()
}

function createCanvas(
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function getDimensions(source: VisualSource) {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth,
      height: source.videoHeight,
    }
  }

  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth,
      height: source.naturalHeight,
    }
  }

  return {
    width: source.width,
    height: source.height,
  }
}

function drawSource(source: VisualSource): HTMLCanvasElement {
  const { width, height } = getDimensions(source)

  if (!width || !height) {
    throw new Error('The selected source has invalid dimensions.')
  }

  const scale = Math.min(
    1,
    MAX_ANALYSIS_DIMENSION / Math.max(width, height),
  )

  const canvas = createCanvas(
    width * scale,
    height * scale,
  )

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to initialize image processing.')
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  return canvas
}

function clampBox(
  box: [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] {
  const x = Math.max(0, Math.min(box[0], width))
  const y = Math.max(0, Math.min(box[1], height))
  const right = Math.max(x, Math.min(box[0] + box[2], width))
  const bottom = Math.max(y, Math.min(box[1] + box[3], height))

  return [x, y, right - x, bottom - y]
}

function cropPerson(
  canvas: HTMLCanvasElement,
  box: [number, number, number, number],
): string {
  const [x, y, width, height] = box
  const maxCropDimension = 384
  const scale = Math.min(1, maxCropDimension / Math.max(width, height))

  // CLIP ultimately resizes inputs to its own compact image size. Avoid
  // encoding full-resolution person crops as large base64 strings.
  const crop = createCanvas(width * scale, height * scale)
  const context = crop.getContext('2d', { alpha: false })

  if (!context) {
    throw new Error('Unable to create person crop.')
  }

  context.drawImage(
    canvas,
    x, y, width, height,
    0, 0, crop.width, crop.height,
  )

  return crop.toDataURL('image/jpeg', 0.76)
}

function cropTorso(
  canvas: HTMLCanvasElement,
  box: [number, number, number, number],
): HTMLCanvasElement {
  const [x, y, width, height] = box

  const torsoX = x + width * 0.16
  const torsoY = y + height * 0.20
  const torsoWidth = width * 0.68
  const torsoHeight = height * 0.44

  const crop = createCanvas(torsoWidth, torsoHeight)
  const context = crop.getContext('2d')

  if (!context) {
    throw new Error('Unable to analyze clothing colors.')
  }

  context.drawImage(
    canvas,
    torsoX, torsoY, torsoWidth, torsoHeight,
    0, 0, crop.width, crop.height,
  )

  return crop
}

function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const colorTerms: Record<TargetColor, string[]> = {
  yellow: ['yellow', 'giallo', 'gialla', 'gialli', 'gialle'],
  red: ['red', 'rosso', 'rossa', 'rossi', 'rosse'],
  pink: ['pink', 'rosa'],
  blue: ['blue', 'blu', 'azzurro', 'azzurra', 'azzurri'],
  green: ['green', 'verde', 'verdi'],
  orange: ['orange', 'arancione'],
  purple: ['purple', 'violet', 'viola'],
  black: ['black', 'nero', 'nera', 'neri', 'nere'],
  white: ['white', 'bianco', 'bianca', 'bianchi', 'bianche'],
  gray: ['gray', 'grey', 'grigio', 'grigia', 'grigi', 'grigie'],
  brown: ['brown', 'marrone', 'marroni'],
}

function findTargetColor(description: string): TargetColor | null {
  const normalized = normalizeDescription(description)

  for (const [color, terms] of Object.entries(colorTerms)) {
    if (terms.some((term) =>
      new RegExp(`(^|\\s)${term}($|\\s)`, 'i').test(normalized),
    )) {
      return color as TargetColor
    }
  }

  return null
}

function rgbToHsv(red: number, green: number, blue: number) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let hue = 0

  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6)
    else if (max === g) hue = 60 * ((b - r) / delta + 2)
    else hue = 60 * ((r - g) / delta + 4)
  }

  if (hue < 0) hue += 360

  return {
    hue,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  }
}

function pixelMatchesColor(
  hue: number,
  saturation: number,
  value: number,
  color: TargetColor,
): boolean {
  switch (color) {
    case 'yellow':
      return hue >= 35 && hue <= 72 && saturation > 0.28 && value > 0.32
    case 'orange':
      return hue >= 15 && hue < 40 && saturation > 0.30 && value > 0.30
    case 'red':
      return (hue < 12 || hue > 345) && saturation > 0.30 && value > 0.25
    case 'pink':
      return (hue >= 300 || hue <= 12) && saturation > 0.16 && value > 0.48
    case 'blue':
      return hue >= 190 && hue <= 255 && saturation > 0.20 && value > 0.20
    case 'green':
      return hue >= 75 && hue <= 165 && saturation > 0.22 && value > 0.20
    case 'purple':
      return hue >= 255 && hue < 310 && saturation > 0.20 && value > 0.20
    case 'black':
      return value < 0.23
    case 'white':
      return value > 0.78 && saturation < 0.25
    case 'gray':
      return saturation < 0.17 && value >= 0.22 && value <= 0.78
    case 'brown':
      return hue >= 8 && hue <= 40 && saturation > 0.20 && value < 0.58
    default:
      return false
  }
}

function calculateColorMatch(
  canvas: HTMLCanvasElement,
  box: [number, number, number, number],
  targetColor: TargetColor,
): number {
  const torso = cropTorso(canvas, box)
  const context = torso.getContext('2d')

  if (!context) return 0

  const { data, width, height } = context.getImageData(
    0, 0, torso.width, torso.height,
  )

  let matchingPixels = 0
  let validPixels = 0

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const index = (y * width + x) * 4

      const hsv = rgbToHsv(
        data[index],
        data[index + 1],
        data[index + 2],
      )

      validPixels++

      if (pixelMatchesColor(
        hsv.hue,
        hsv.saturation,
        hsv.value,
        targetColor,
      )) {
        matchingPixels++
      }
    }
  }

  if (!validPixels) return 0

  return Math.min(
    100,
    Math.round((matchingPixels / validPixels) * 250),
  )
}

async function comparePerson(
  canvas: HTMLCanvasElement,
  box: [number, number, number, number],
  description: string,
  targetColor: TargetColor | null,
): Promise<number> {
  if (!classifier) {
    throw new Error('Visual matching engine is not initialized.')
  }

  const image = cropPerson(canvas, box)

  const labels = [
    `A photograph of a person matching this description: ${description}`,
    'A photograph of a person who does not match the requested description',
  ]

  const predictions = await classifier(image, labels)

  const matching = predictions.find(
    (prediction) => prediction.label === labels[0],
  )

  const semanticScore = matching?.score ?? 0

  if (!targetColor) {
    return Math.round(semanticScore * 100)
  }

  const colorScore = calculateColorMatch(
    canvas,
    box,
    targetColor,
  )

  return Math.round(
    colorScore * 0.72 + semanticScore * 100 * 0.28,
  )
}

async function detectPeople(canvas: HTMLCanvasElement) {
  if (!detector) {
    throw new Error('Person detection engine is not initialized.')
  }

  const predictions = await detector.detect(
    canvas,
    MAX_PEOPLE_PER_FRAME,
    DETECTION_THRESHOLD,
  ) as CocoPrediction[]

  return predictions
    .filter((prediction) => prediction.class === 'person')
    .map((prediction) => ({
      box: clampBox(prediction.bbox, canvas.width, canvas.height),
      confidence: Math.round(prediction.score * 100),
    }))
    .filter((person) => person.box[2] > 0 && person.box[3] > 0)
}

async function analyzeFrame(
  source: VisualSource,
  description: string,
  frameIndex: number,
  timestamp: number | null,
  onProgress?: (progress: SubjectSearchProgress) => void,
  progressOffset = 0,
  progressTotal = 1,
): Promise<SubjectSearchFrame> {
  const originalDimensions = getDimensions(source)
  const canvas = drawSource(source)
  const people = await detectPeople(canvas)
  const targetColor = findTargetColor(description)

  const scaleX = originalDimensions.width / canvas.width
  const scaleY = originalDimensions.height / canvas.height

  const detections: SubjectDetection[] = []

  for (let index = 0; index < people.length; index++) {
    const person = people[index]

    report(onProgress, {
      stage: 'matching',
      current: progressOffset + index,
      total: progressTotal,
      message: `Comparing detected subject ${index + 1} of ${people.length}...`,
    })

    const score = await comparePerson(
      canvas,
      person.box,
      description,
      targetColor,
    )

    detections.push({
      id: `frame-${frameIndex}-person-${index}`,
      frameIndex,
      timestamp,
      box: [
        person.box[0] * scaleX,
        person.box[1] * scaleY,
        person.box[2] * scaleX,
        person.box[3] * scaleY,
      ],
      detectionConfidence: person.confidence,
      matchConfidence: score,
      isBestMatch: false,
    })
  }

  return {
    frameIndex,
    timestamp,
    width: originalDimensions.width,
    height: originalDimensions.height,
    detections,
  }
}

function finalizeResults(
  description: string,
  translatedDescription: string,
  sourceType: 'image' | 'video',
  duration: number | null,
  frames: SubjectSearchFrame[],
): SubjectSearchResult {
  const allDetections = frames.flatMap((frame) => frame.detections)
  const targetColor = findTargetColor(translatedDescription)

  const minimumScore = targetColor ? 48 : 62

  // Every sufficiently convincing person becomes a match.
  // No arbitrary single winner is selected.
  const matches = allDetections.filter(
    (detection) => detection.matchConfidence >= minimumScore,
  )

  for (const match of matches) {
    match.isBestMatch = true
  }

  const bestMatch = [...matches].sort(
    (a, b) => b.matchConfidence - a.matchConfidence,
  )[0] ?? null

  return {
    description,
    translatedDescription,
    sourceType,
    duration,
    framesAnalyzed: frames.length,
    peopleDetected: allDetections.length,
    matchingPeople: matches.length,
    bestMatch,
    frames,
  }
}

export async function analyzeSubjectImage(
  image: HTMLImageElement,
  description: string,
  onProgress?: (progress: SubjectSearchProgress) => void,
): Promise<SubjectSearchResult> {
  await initializeDetector()
  await initializeClassifier()

  const translatedDescription = await prepareDescription(
    description,
    onProgress,
  )

  report(onProgress, {
    stage: 'detecting',
    current: 0,
    total: 1,
    message: 'Detecting people in the image...',
  })

  const frame = await analyzeFrame(
    image,
    translatedDescription,
    0,
    null,
    onProgress,
    0,
    1,
  )

  const result = finalizeResults(
    description,
    translatedDescription,
    'image',
    null,
    [frame],
  )

  report(onProgress, {
    stage: 'completed',
    current: 1,
    total: 1,
    message: `Analysis completed. ${result.matchingPeople} matching subjects found.`,
  })

  return result
}

function waitForVideoSeek(
  video: HTMLVideoElement,
  timestamp: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const safeTime = Math.max(
      0,
      Math.min(timestamp, Math.max(0, video.duration - 0.05)),
    )

    if (Math.abs(video.currentTime - safeTime) < 0.02) {
      resolve()
      return
    }

    const onSeeked = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error('Unable to read a video frame.'))
    }

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }

    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })

    video.currentTime = safeTime
  })
}

export async function analyzeSubjectVideo(
  video: HTMLVideoElement,
  description: string,
  onProgress?: (progress: SubjectSearchProgress) => void,
): Promise<SubjectSearchResult> {
  await initializeDetector()
  await initializeClassifier()

  const translatedDescription = await prepareDescription(
    description,
    onProgress,
  )

  const duration = Number.isFinite(video.duration)
    ? video.duration
    : 0

  if (!duration || !video.videoWidth || !video.videoHeight) {
    throw new Error('The selected video is not ready for analysis.')
  }

  const frameCount = Math.min(
    MAX_VIDEO_FRAMES,
    Math.max(1, Math.ceil(duration / VIDEO_FRAME_INTERVAL)),
  )

  const timestamps: number[] = []

  for (let index = 0; index < frameCount; index++) {
    timestamps.push(
      Math.min(
        index * VIDEO_FRAME_INTERVAL,
        Math.max(0, duration - 0.05),
      ),
    )
  }

  const frames: SubjectSearchFrame[] = []

  for (let index = 0; index < timestamps.length; index++) {
    const timestamp = timestamps[index]

    report(onProgress, {
      stage: 'detecting',
      current: index,
      total: timestamps.length,
      message: `Scanning video frame ${index + 1} of ${timestamps.length}...`,
    })

    await waitForVideoSeek(video, timestamp)

    const frame = await analyzeFrame(
      video,
      translatedDescription,
      index,
      timestamp,
      onProgress,
      index,
      timestamps.length,
    )

    frames.push(frame)
  }

  const result = finalizeResults(
    description,
    translatedDescription,
    'video',
    duration,
    frames,
  )

  report(onProgress, {
    stage: 'completed',
    current: timestamps.length,
    total: timestamps.length,
    message: `Video analysis completed. ${result.matchingPeople} matching detections found.`,
  })

  return result
}
