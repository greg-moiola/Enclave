
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  ArrowLeft,
  Check,
  Crosshair,
  FileImage,
  ImagePlus,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
  LoaderCircle,
  Video,
  AlertTriangle,
} from 'lucide-react'
import type {
  SubjectSearchProgress,
  SubjectSearchResult,
  SubjectSearchFrame,
} from '../ai/subjectSearchEngine'
import './SubjectSearch.css'

interface SubjectSearchProps {
  onBack: () => void
}

const suggestions = [
  'Person wearing a black hoodie',
  'Person carrying a red backpack',
  'Person wearing light-coloured trousers',
  'Person with a blue jacket',
  'Person wearing a hat',
]

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}



function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load the selected image.'))
    image.src = url
  })
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => resolve(video)
    video.onerror = () => reject(new Error('Unable to load the selected video.'))

    video.src = url
    video.load()
  })
}

function captureVideoFrame(
  video: HTMLVideoElement,
  timestamp: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeTime = Math.max(0, Math.min(timestamp, video.duration - 0.05))

    const capture = () => {
      try {
        const maxDimension = 1280
        const scale = Math.min(
          1,
          maxDimension / Math.max(video.videoWidth, video.videoHeight),
        )
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))

        const context = canvas.getContext('2d', { alpha: false })

        if (!context) {
          reject(new Error('Unable to create the video preview.'))
          return
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.84))
      } catch {
        reject(new Error('Unable to capture the selected video frame.'))
      }
    }

    if (Math.abs(video.currentTime - safeTime) < 0.01) {
      capture()
      return
    }

    video.addEventListener('seeked', capture, { once: true })
    video.currentTime = safeTime
  })
}


function getDisplayFrame(
  result: SubjectSearchResult,
): SubjectSearchFrame | null {
  if (!result.frames.length) return null

  return [...result.frames].sort((a, b) => {
    const matchesA = a.detections.filter((d) => d.isBestMatch).length
    const matchesB = b.detections.filter((d) => d.isBestMatch).length

    if (matchesA !== matchesB) return matchesB - matchesA

    const scoreA = Math.max(0, ...a.detections
      .filter((d) => d.isBestMatch)
      .map((d) => d.matchConfidence))

    const scoreB = Math.max(0, ...b.detections
      .filter((d) => d.isBestMatch)
      .map((d) => d.matchConfidence))

    return scoreB - scoreA
  })[0]
}


export default function SubjectSearch({ onBack }: SubjectSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lastProgressRef = useRef<SubjectSearchProgress | null>(null)

  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<'image' | 'video' | null>(null)
  const [imageName, setImageName] = useState('')
  const [imageSize, setImageSize] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState<SubjectSearchProgress | null>(null)
  const [result, setResult] = useState<SubjectSearchResult | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [displayFrame, setDisplayFrame] = useState<SubjectSearchFrame | null>(null)

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    }
  }, [sourceUrl])

  function loadFile(file: File) {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setError('Please select a supported image or video.')
      return
    }

    const newUrl = URL.createObjectURL(file)

    setSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return newUrl
    })

    setSourceType(isImage ? 'image' : 'video')
    setImageName(file.name)
    setImageSize(formatFileSize(file.size))
    setError('')
    setResult(null)
    setResultImage(null)
    setDisplayFrame(null)
    setProgress(null)
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) loadFile(file)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  function removeSource() {
    setSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })

    setSourceType(null)
    setImageName('')
    setImageSize('')
    setResult(null)
    setResultImage(null)
    setDisplayFrame(null)
    setProgress(null)
    setError('')

    if (inputRef.current) inputRef.current.value = ''
  }

  function addSuggestion(value: string) {
    setDescription((current) => {
      if (!current.trim()) return value

      return `${current.trim().replace(/[.,;]+$/, '')}, ${value
        .replace(/^Person /, '')
        .toLowerCase()}`
    })
  }

  async function startSearch() {
    if (!sourceUrl || !sourceType || !description.trim() || isAnalyzing) {
      return
    }

    setError('')
    setResult(null)
    setResultImage(null)
    setDisplayFrame(null)
    setProgress({
      stage: 'loading',
      current: 0,
      total: 1,
      message: 'Preparing local visual engines…',
    })
    lastProgressRef.current = null
    setIsAnalyzing(true)

    const updateProgress = (value: SubjectSearchProgress) => {
      const previous = lastProgressRef.current
      const stageChanged = previous?.stage !== value.stage
      const meaningfulStep =
        value.current === 0
        || value.current === value.total
        || value.current % 3 === 0

      lastProgressRef.current = value

      // Keep progress useful without forcing a React render for every
      // individual person detected in a long video.
      if (stageChanged || meaningfulStep) {
        setProgress(value)
      }
    }

    try {
      // The detector, TensorFlow.js, CLIP and translation model are fetched
      // only after the user actually starts a visual search.
      const { analyzeSubjectImage, analyzeSubjectVideo } = await import(
        '../ai/subjectSearchEngine'
      )

      let searchResult: SubjectSearchResult
      let videoForCapture: HTMLVideoElement | null = null

      if (sourceType === 'image') {
        const image = await loadImage(sourceUrl)

        searchResult = await analyzeSubjectImage(
          image,
          description,
          updateProgress,
        )
      } else {
        videoForCapture = await loadVideo(sourceUrl)

        searchResult = await analyzeSubjectVideo(
          videoForCapture,
          description,
          updateProgress,
        )
      }

      const selectedFrame = getDisplayFrame(searchResult)

      if (selectedFrame && sourceType === 'image') {
        setResultImage(sourceUrl)
      } else if (
        selectedFrame &&
        videoForCapture &&
        selectedFrame.timestamp !== null
      ) {
        const captured = await captureVideoFrame(
          videoForCapture,
          selectedFrame.timestamp,
        )

        setResultImage(captured)
      }

      setDisplayFrame(selectedFrame)
      setResult(searchResult)
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'An unexpected error occurred during visual search.'

      setError(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const canSearch = Boolean(sourceUrl && description.trim())
  const bestMatch = result?.bestMatch ?? null
  const visibleDetections = displayFrame?.detections ?? []

  return (
    <section className="subject-search nexus-subject-search">
      <div className="subject-heading">
        <div>
          <div className="subject-eyebrow">
            <Crosshair size={14} />
            VISUAL INTELLIGENCE / SUBJECT SEARCH
          </div>

          <h1>
            Subject Search<span>.</span>
          </h1>

          <p>
            Locate visual subjects through descriptive attributes.
          </p>
        </div>

        <div className="subject-mode-tag">
          <span />
          LOCAL VISUAL SEARCH
        </div>
      </div>

      <div className="subject-workspace">
        <div className="subject-main-panel">
          <div className="subject-panel-heading">
            <div>
              <span className="subject-step">01 / SOURCE INPUT</span>
              <h2>Image or video source</h2>
            </div>

            {sourceType === 'video' ? <Video size={19} /> : <ImagePlus size={19} />}
          </div>

          {!sourceUrl ? (
            <div
              className={`subject-upload-area ${
                isDragging ? 'subject-upload-dragging' : ''
              }`}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setIsDragging(false)
                }
              }}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  inputRef.current?.click()
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Select or drop an image or video"
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleImageSelection}
                onClick={(event) => event.stopPropagation()}
                hidden
              />

              <div className="subject-upload-icon">
                <Upload size={27} />
              </div>

              <span className="subject-upload-overline">
                {isDragging ? 'RELEASE TO UPLOAD' : 'SOURCE ACQUISITION'}
              </span>

              <h3>
                {isDragging ? 'Drop your source file' : 'Upload image or video'}
              </h3>

              <p>
                Select a photograph or video, or drag a file into this area
                to prepare a visual search.
              </p>

              <span className="subject-upload-button">
                <ImagePlus size={16} />
                Select source
              </span>

              <span className="subject-format">
                JPG · PNG · WEBP · MP4 · WEBM · LOCAL PROCESSING
              </span>
            </div>
          ) : (
            <>
              <div className="subject-image-preview">
  <div className="subject-media-stage">
    {sourceType === 'image' ? (
      <img
        src={sourceUrl}
        alt="Selected visual search source"
      />
    ) : (
      <video
        src={sourceUrl}
        controls
        playsInline
        preload="metadata"
      />
    )}

    {displayFrame && (
      <div className="subject-result-overlay">
        {visibleDetections.map((detection) => {
          const [x, y, width, height] = detection.box

          return (
            <div
              key={detection.id}
              className={`subject-detection-box ${
                detection.isBestMatch ? 'subject-detection-best' : ''
              }`}
              style={{
                left: `${(x / displayFrame.width) * 100}%`,
                top: `${(y / displayFrame.height) * 100}%`,
                width: `${(width / displayFrame.width) * 100}%`,
                height: `${(height / displayFrame.height) * 100}%`,
              }}
            >
              <span>
                  {detection.isBestMatch
                    ? `MATCH · ${detection.matchConfidence}%`
                    : 'SUBJECT'}
                </span>
            </div>
          )
        })}
      </div>
    )}

    {isAnalyzing && (
      <div className="subject-live-scan-line" />
    )}
  </div>

  <div className="subject-image-top">
    <span>
      <span className="subject-image-indicator" />
      {sourceType === 'video'
        ? 'VIDEO SOURCE / LOADED'
        : 'IMAGE SOURCE / LOADED'}
    </span>

    <button
      type="button"
      onClick={removeSource}
      aria-label="Remove source"
      title="Remove source"
      disabled={isAnalyzing}
    >
      <X size={17} />
    </button>
  </div>

  <div className="subject-image-bottom">
    <span title={imageName}>{imageName}</span>

    <span className="subject-image-ready">
      <Check size={12} />
      READY
    </span>
  </div>
</div>

              <div className="subject-file-details">
                <div>
                  <FileImage size={16} />
                  <span>{sourceType === 'video' ? 'VIDEO SOURCE' : 'IMAGE SOURCE'}</span>
                </div>

                <strong>{imageSize}</strong>

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isAnalyzing}
                >
                  Replace source
                </button>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleImageSelection}
                hidden
              />
            </>
          )}

          <div className="subject-description-section">
            <div className="subject-panel-heading">
              <div>
                <span className="subject-step">02 / SEARCH PARAMETERS</span>
                <h2>Describe the subject</h2>
              </div>

              <ScanSearch size={19} />
            </div>

            <div className="subject-description-box">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={
                  'Describe visible characteristics...\n\nExample: Person wearing a black hoodie, light trousers and carrying a red backpack.'
                }
                maxLength={500}
                aria-label="Description of the subject"
                disabled={isAnalyzing}
              />

              <div className="subject-description-footer">
                <span>VISIBLE ATTRIBUTES ONLY</span>
                <span>{description.length}/500</span>
              </div>
            </div>

            <div className="subject-suggestions">
              <span>QUICK ATTRIBUTES</span>

              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => addSuggestion(suggestion)}
                  disabled={isAnalyzing}
                >
                  + {suggestion.replace('Person ', '')}
                </button>
              ))}
            </div>

            {description.trim() && (
              <button
                type="button"
                className="subject-clear-description"
                onClick={() => setDescription('')}
                disabled={isAnalyzing}
              >
                <X size={13} />
                Clear description
              </button>
            )}
          </div>
        </div>

        <aside className="subject-side-panel">
          <div className="subject-status-card">
            <div className="subject-status-icon">
              {isAnalyzing
                ? <LoaderCircle className="subject-spin" size={21} />
                : <Sparkles size={21} />}
            </div>

            <span className="subject-step">SYSTEM STATUS</span>

            <h3>
              {isAnalyzing
                ? 'Visual analysis active'
                : result
                  ? 'Analysis completed'
                  : 'Local engine ready'}
            </h3>

            <p>
              {isAnalyzing
                ? progress?.message ?? 'Preparing visual analysis...'
                : result
                  ? 'The source has been analyzed. Review the detected subjects and the best visual match.'
                  : 'The local detection and visual matching engines are ready to analyze your source.'}
            </p>

            <div className="subject-status-line">
              <span className={isAnalyzing ? 'is-scanning' : result ? 'is-complete' : ''} />
              {isAnalyzing
                ? 'ANALYSIS IN PROGRESS'
                : result
                  ? 'ANALYSIS COMPLETED'
                  : 'ENGINE AVAILABLE'}
            </div>

            {isAnalyzing && progress && (
              <div className="subject-progress">
                <div className="subject-progress-track">
                  <span
                    style={{
                      width: `${progress.total > 0
                        ? Math.min(100, (progress.current / progress.total) * 100)
                        : 0}%`,
                    }}
                  />
                </div>

                <div>
                  <span>{progress.stage.toUpperCase()}</span>
                  <strong>
                    {progress.current}/{progress.total}
                  </strong>
                </div>
              </div>
            )}
          </div>

          <div className="subject-info-card">
            <div className="subject-info-title">
              <ShieldCheck size={18} />
              Search principles
            </div>

            <div className="subject-info-item">
              <span>01</span>
              <p>Clothing, colours and patterns</p>
            </div>

            <div className="subject-info-item">
              <span>02</span>
              <p>Accessories and carried objects</p>
            </div>

            <div className="subject-info-item">
              <span>03</span>
              <p>Position and visual context</p>
            </div>
          </div>

          <div className="subject-notice">
            <Crosshair size={16} />
            <p>
              Search is based on visible characteristics, never on facial
              identity or biometric recognition.
            </p>
          </div>

          <div className="subject-readiness-card">
            <div className="subject-readiness-heading">
              <Zap size={15} />
              SEARCH CONFIGURATION
            </div>

            <div className="subject-readiness-row">
              <span>Source file</span>
              <strong className={sourceUrl ? 'is-ready' : ''}>
                {sourceUrl ? sourceType?.toUpperCase() : 'MISSING'}
              </strong>
            </div>

            <div className="subject-readiness-row">
              <span>Search description</span>
              <strong className={description.trim() ? 'is-ready' : ''}>
                {description.trim() ? 'READY' : 'MISSING'}
              </strong>
            </div>

            <div className="subject-readiness-row">
              <span>AI engine</span>
              <strong className="is-ready">
                {result ? 'COMPLETED' : 'LOCAL'}
              </strong>
            </div>
          </div>
        </aside>
      </div>

      {error && (
        <div className="subject-error" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {result && displayFrame && resultImage && (
        <div className="subject-results">
          <div className="subject-results-heading">
            <div>
              <span className="subject-step">03 / VISUAL SEARCH RESULTS</span>
              <h2>Detection overview</h2>
              <p>
                {result.peopleDetected} person detections across {result.framesAnalyzed} analyzed
                {result.sourceType === 'video' ? ' video frames' : ' image'}.
              </p>
            </div>

            <span className="subject-results-status">
              <Check size={13} />
              COMPLETED
            </span>
          </div>


          <div className="subject-result-summary">
                    <div>
                      <span>PEOPLE DETECTED</span>
                      <strong>{result.peopleDetected}</strong>
                    </div>

                    <div>
                      <span>FRAMES ANALYZED</span>
                      <strong>{result.framesAnalyzed}</strong>
                    </div>

                    <div>
                      <span>MATCHES FOUND</span>
                      <strong className={result.matchingPeople > 0 ? 'is-match' : 'is-no-match'}>
                        {result.matchingPeople}
                      </strong>
                    </div>
                  </div>

          <div className="subject-result-legend">
                  <span><i className="legend-cyan" /> Detected subjects</span>
                  <span><i className="legend-red" /> Matching subjects</span>
                </div>

          {result.matchingPeople > 0 ? (
                <div className="subject-best-match">
                  <div>
                    <Crosshair size={18} />
                    <div>
                      <strong>
                        {result.matchingPeople} matching subject
                        {result.matchingPeople === 1 ? '' : 's'} detected
                      </strong>
                      <span>
                        All sufficiently convincing matches are highlighted in red.
                      </span>
                    </div>
                  </div>

                  <strong>{bestMatch?.matchConfidence ?? 0}%</strong>
                </div>
              ) : (
                <div className="subject-no-match">
                  <Search size={18} />
                  No sufficiently convincing visual match was found.
                  All detected people remain outlined in cyan.
                </div>
              )}

          {result.sourceType === 'video' && (
            <p className="subject-video-disclaimer">
              Video search samples frames at intervals. The highlighted frame
              indicates where the strongest match was detected; continuous
              tracking between frames is not enabled yet.
            </p>
          )}
        </div>
      )}

      <div className="subject-footer">
        <button
          type="button"
          className="subject-back-button"
          onClick={onBack}
          disabled={isAnalyzing}
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>

        <button
          type="button"
          className="subject-scan-button"
          disabled={!canSearch || isAnalyzing}
          onClick={startSearch}
        >
          {isAnalyzing
            ? <LoaderCircle className="subject-spin" size={17} />
            : <Search size={17} />}

          {isAnalyzing
            ? 'Scanning source...'
            : result
              ? 'Run search again'
              : 'Start visual search'}

          <span className="subject-button-status">
            {isAnalyzing ? 'ANALYZING' : 'LOCAL AI'}
          </span>
        </button>
      </div>
    </section>
  )
}
