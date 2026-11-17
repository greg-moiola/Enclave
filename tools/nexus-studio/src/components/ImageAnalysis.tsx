import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileImage,
  ImagePlus,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'

import type { ImageAnalysisResult } from '../ai/humanEngine'

import './ImageAnalysis.css'

type ImageAnalysisProps = {
  onBack: () => void
}

function getExpressionName(expression: string | null) {
  if (!expression) return 'Stima incerta'

  const names: Record<string, string> = {
    happy: 'Felicità',
    sad: 'Tristezza',
    angry: 'Rabbia',
    fearful: 'Paura',
    disgusted: 'Disgusto',
    surprised: 'Sorpresa',
    neutral: 'Neutrale',
  }

  return names[expression.toLowerCase()] ?? expression
}

function getDominantExpression(result: ImageAnalysisResult) {
  const counts: Record<string, number> = {}

  result.faces.forEach((face) => {
    if (!face.mainExpression) return

    counts[face.mainExpression] = (counts[face.mainExpression] ?? 0) + 1
  })

  const dominant = Object.entries(counts).sort(
    (a, b) => b[1] - a[1],
  )[0]

  return dominant ? dominant[0] : null
}

function getAverageConfidence(result: ImageAnalysisResult) {
  const availableFaces = result.faces.filter(
    (face) => face.mainExpression !== null,
  )

  if (availableFaces.length === 0) return 0

  const total = availableFaces.reduce(
    (sum, face) => sum + face.confidence,
    0,
  )

  return Math.round(total / availableFaces.length)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function ImageAnalysis({ onBack }: ImageAnalysisProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [imageSize, setImageSize] = useState('')
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  })

  const [result, setResult] = useState<ImageAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [analysisTime, setAnalysisTime] = useState<number | null>(null)
  const [engineReady, setEngineReady] = useState(false)

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imageUrl])

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Il file selezionato non è un’immagine supportata.')
      event.target.value = ''
      return
    }

    const nextUrl = URL.createObjectURL(file)

    setImageUrl(nextUrl)
    setImageName(file.name)
    setImageSize(formatFileSize(file.size))
    setImageDimensions({ width: 0, height: 0 })
    setResult(null)
    setAnalysisTime(null)
    setError('')

    event.target.value = ''
  }

  function handleImageLoad() {
    const image = imageRef.current

    if (!image) return

    setImageDimensions({
      width: image.naturalWidth,
      height: image.naturalHeight,
    })
  }

  async function runAnalysis() {
    const image = imageRef.current

    if (!image || !image.complete || !image.naturalWidth) {
      setError('Seleziona prima un’immagine valida.')
      return
    }

    setIsAnalyzing(true)
    setError('')
    setResult(null)
    setAnalysisTime(null)

    const startTime = performance.now()

    try {
      const { analyzeImage, isHumanEngineReady } = await import('../ai/humanEngine')
      const analysisResult = await analyzeImage(image)

      setEngineReady(isHumanEngineReady())
      setResult(analysisResult)
      setAnalysisTime(Math.round(performance.now() - startTime))
    } catch (analysisError) {
      console.error('NEXUS image analysis error:', analysisError)

      setError(
        analysisError instanceof Error
          ? analysisError.message
          : 'Si è verificato un errore durante l’analisi.',
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  function removeImage() {
    setImageUrl(null)
    setImageName('')
    setImageSize('')
    setImageDimensions({ width: 0, height: 0 })
    setResult(null)
    setAnalysisTime(null)
    setError('')

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const dominantExpression = result
    ? getDominantExpression(result)
    : null

  const averageConfidence = result
    ? getAverageConfidence(result)
    : 0

  return (
    <div className="image-analysis nexus-image-analysis">
      <div className="image-analysis-heading">
        <div>
          <div className="section-overline">
            <span className="overline-line" />
            VISUAL INTELLIGENCE / IMAGE
          </div>

          <h1>
            Image Analysis<span>.</span>
          </h1>

          <p>
            Examine a photograph using local visual intelligence.
          </p>
        </div>

        <div className="image-mode-tag">
          <span className="engine-dot" />
          LOCAL PROCESSING
        </div>
      </div>

      {!imageUrl ? (
        <section className="nexus-image-empty">
          <div className="nexus-image-empty-icon">
            <ImagePlus size={34} />
          </div>

          <span className="panel-kicker">SOURCE INPUT</span>

          <h2>Initialize image examination</h2>

          <p>
            Select a photograph from this device to begin facial
            detection and visual expression analysis.
          </p>

          <button
            className="nexus-image-primary-button"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={17} />
            Select image
          </button>

          <input
            ref={inputRef}
            className="image-file-input"
            type="file"
            accept="image/*"
            onChange={handleImageSelection}
          />

          <div className="nexus-image-supported">
            JPG <span /> PNG <span /> WEBP
          </div>
        </section>
      ) : (
        <>
          <div className="nexus-image-toolbar">
            <div className="nexus-image-file">
              <div className="nexus-image-file-icon">
                <FileImage size={18} />
              </div>

              <div>
                <strong title={imageName}>{imageName}</strong>
                <span>
                  {imageSize}
                  {imageDimensions.width > 0 &&
                    ` · ${imageDimensions.width} × ${imageDimensions.height}`}
                </span>
              </div>
            </div>

            <button
              className="nexus-image-remove"
              onClick={removeImage}
              title="Remove image"
            >
              <Trash2 size={15} />
              <span>Remove</span>
            </button>
          </div>

          {result && (
            <section className="nexus-image-summary">
              <div className="nexus-summary-heading">
                <div>
                  <span className="panel-kicker">
                    ANALYSIS REPORT / OVERVIEW
                  </span>
                  <h2>Visual intelligence summary</h2>
                </div>

                <div className="nexus-summary-complete">
                  <CheckCircle2 size={15} />
                  ANALYSIS COMPLETE
                </div>
              </div>

              <div className="nexus-summary-grid">
                <div className="nexus-summary-metric">
                  <div className="nexus-summary-icon">
                    <ScanFace size={19} />
                  </div>
                  <div>
                    <span>DETECTED FACES</span>
                    <strong>{result.faceCount}</strong>
                  </div>
                </div>

                <div className="nexus-summary-metric">
                  <div className="nexus-summary-icon">
                    <Activity size={19} />
                  </div>
                  <div>
                    <span>DOMINANT EXPRESSION</span>
                    <strong className="nexus-summary-expression">
                      {getExpressionName(dominantExpression)}
                    </strong>
                  </div>
                </div>

                <div className="nexus-summary-metric">
                  <div className="nexus-summary-icon">
                    <Target size={19} />
                  </div>
                  <div>
                    <span>AVERAGE CONFIDENCE</span>
                    <strong>{averageConfidence}%</strong>
                  </div>
                </div>

                <div className="nexus-summary-metric">
                  <div className="nexus-summary-icon">
                    <Zap size={19} />
                  </div>
                  <div>
                    <span>PROCESSING TIME</span>
                    <strong>
                      {analysisTime !== null
                        ? `${analysisTime} ms`
                        : '--'}
                    </strong>
                  </div>
                </div>
              </div>

              {result.faceCount === 0 && (
                <div className="nexus-no-faces">
                  <Eye size={17} />
                  No faces were detected in this image.
                </div>
              )}
            </section>
          )}

          <section className="nexus-image-visual-panel">
            <div className="nexus-image-visual-heading">
              <div>
                <span className="panel-kicker">VISUAL SCAN / LIVE OVERLAY</span>
                <h2>Detection viewport</h2>
              </div>

              <div className="nexus-viewport-status">
                <span className="engine-dot" />
                {result ? 'MAPPING COMPLETE' : 'SOURCE LOADED'}
              </div>
            </div>

            <div className="nexus-image-viewport">
              <div className="nexus-image-corners" />

              <div className="nexus-image-frame">
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Image selected for NEXUS analysis"
                  onLoad={handleImageLoad}
                />

                {result &&
                  imageDimensions.width > 0 &&
                  imageDimensions.height > 0 && (
                    <svg
                      className="nexus-detection-overlay"
                      viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                      preserveAspectRatio="none"
                      aria-label="Face detection overlay"
                    >
                      {result.faces.map((face, index) => {
                        if (!face.box) return null

                        const [x, y, width, height] = face.box

                        if (
                          !Number.isFinite(x) ||
                          !Number.isFinite(y) ||
                          !Number.isFinite(width) ||
                          !Number.isFinite(height) ||
                          width <= 0 ||
                          height <= 0
                        ) {
                          return null
                        }

                        const points = [
                          [x, y],
                          [x + width, y],
                          [x, y + height],
                          [x + width, y + height],
                          [x + width / 2, y + height / 2],
                        ]

                        return (
                          <g
                            key={`face-${index}`}
                            className="nexus-face-detection"
                          >
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              rx={Math.max(4, width * 0.025)}
                              className="nexus-face-box"
                            />

                            {points.map(([pointX, pointY], pointIndex) => (
                              <g key={pointIndex}>
                                <circle
                                  cx={pointX}
                                  cy={pointY}
                                  r={Math.max(3, width * 0.012)}
                                  className="nexus-face-point-glow"
                                />
                                <circle
                                  cx={pointX}
                                  cy={pointY}
                                  r={Math.max(1.5, width * 0.006)}
                                  className="nexus-face-point"
                                />
                              </g>
                            ))}

                            <text
                              x={x}
                              y={Math.max(20, y - 12)}
                              className="nexus-face-label"
                            >
                              SUBJECT {String(index + 1).padStart(2, '0')}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  )}
              </div>

              <div className="nexus-viewport-crosshair">
                <span />
                <span />
              </div>

              <div className="nexus-viewport-caption">
                <span>INPUT / LOCAL IMAGE</span>
                <span>
                  {result
                    ? `${result.faceCount} SUBJECT(S) MAPPED`
                    : 'AWAITING ANALYSIS'}
                </span>
              </div>
            </div>

            <div className="nexus-image-legend">
              <span>
                <i className="nexus-legend-dot" />
                FACE DETECTION
              </span>
              <span>
                <i className="nexus-legend-outline" />
                BOUNDING REGION
              </span>
              <span>
                <i className="nexus-legend-center" />
                REFERENCE POINT
              </span>
            </div>
          </section>

          {result && result.faces.length > 0 && (
            <section className="nexus-face-results">
              <div className="nexus-face-results-heading">
                <div>
                  <span className="panel-kicker">SUBJECT BREAKDOWN</span>
                  <h2>Detected subjects</h2>
                </div>

                <span className="nexus-face-count">
                  {result.faces.length.toString().padStart(2, '0')} FOUND
                </span>
              </div>

              <div className="nexus-face-grid">
                {result.faces.map((face, index) => (
                  <article
                    className="nexus-face-card"
                    key={`face-result-${index}`}
                  >
                    <div className="nexus-face-card-top">
                      <div className="nexus-face-number">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <span className="nexus-face-detected">
                        <span className="engine-dot" />
                        DETECTED
                      </span>
                    </div>

                    <span className="nexus-face-card-label">
                      SUBJECT {String(index + 1).padStart(2, '0')}
                    </span>

                    <h3>
                      {getExpressionName(face.mainExpression)}
                    </h3>

                    <div className="nexus-face-confidence">
                      <div>
                        <span>EXPRESSION CONFIDENCE</span>
                        <strong>{face.confidence}%</strong>
                      </div>

                      <div className="nexus-confidence-track">
                        <span
                          style={{
                            width: `${face.confidence}%`,
                          }}
                        />
                      </div>
                    </div>

                    {face.expressions.length > 1 && (
                      <div className="nexus-expression-list">
                        {face.expressions.slice(0, 3).map((expression) => (
                          <div
                            className="nexus-expression-row"
                            key={expression.expression}
                          >
                            <span>
                              {getExpressionName(expression.expression)}
                            </span>
                            <strong>{expression.confidence}%</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="nexus-image-actions">
            <button
              className="nexus-image-secondary-button"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus size={16} />
              Replace image
            </button>

            <button
              className="nexus-image-primary-button"
              onClick={runAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="nexus-button-spinner" />
                  Analyzing image...
                </>
              ) : (
                <>
                  <Sparkles size={17} />
                  {result ? 'Run analysis again' : 'Run analysis'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <input
              ref={inputRef}
              className="image-file-input"
              type="file"
              accept="image/*"
              onChange={handleImageSelection}
            />
          </div>
        </>
      )}

      {isAnalyzing && (
        <div className="nexus-analysis-progress">
          <div className="nexus-progress-line">
            <span />
          </div>

          <div>
            <Activity size={15} />
            INITIALIZING LOCAL VISUAL ANALYSIS
          </div>
        </div>
      )}

      {error && (
        <div className="nexus-image-error">
          <X size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="image-analysis-footer">
        <span>
          <ShieldCheck size={14} />
          TEMPORARY IMAGE SESSION
        </span>

        <span className="nexus-image-engine-status">
          <span className="engine-dot" />
          {engineReady ? 'LOCAL ENGINE READY' : 'LOCAL ENGINE STANDBY'}
        </span>

        <button onClick={onBack}>
          <ArrowRight size={15} />
          RETURN TO DASHBOARD
        </button>
      </div>
    </div>
  )
}
