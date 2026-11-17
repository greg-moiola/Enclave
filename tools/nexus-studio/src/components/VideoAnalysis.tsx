import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileVideo,
  Film,
  ImagePlus,
  RotateCcw,
  ShieldCheck,
  Upload,
  Video,
} from 'lucide-react'
import './VideoAnalysis.css'

type VideoAnalysisProps = {
  onBack: () => void
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  const hours = Math.floor(minutes / 60)
  const displayMinutes = minutes % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(displayMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function VideoAnalysis({ onBack }: VideoAnalysisProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoName, setVideoName] = useState('')
  const [videoSize, setVideoSize] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoReady, setVideoReady] = useState(false)
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  function handleVideoSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setError('The selected file is not a supported video.')
      event.target.value = ''
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setVideoUrl(nextUrl)
    setVideoName(file.name)
    setVideoSize(formatFileSize(file.size))
    setDuration(0)
    setCurrentTime(0)
    setVideoReady(false)
    setCapturedFrame(null)
    setError('')
    event.target.value = ''
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return

    const maxDimension = 1600
    const scale = Math.min(
      1,
      maxDimension / Math.max(video.videoWidth, video.videoHeight),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      setError('Unable to capture this frame on the current device.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setCapturedFrame(canvas.toDataURL('image/jpeg', 0.84))
    setError('')
  }

  function removeVideo() {
    setVideoUrl(null)
    setVideoName('')
    setVideoSize('')
    setDuration(0)
    setCurrentTime(0)
    setVideoReady(false)
    setCapturedFrame(null)
    setError('')
  }

  return (
    <div className="video-analysis">
      <div className="video-analysis-heading">
        <div>
          <div className="section-overline">
            <span className="overline-line" />
            VISUAL INTELLIGENCE / VIDEO
          </div>
          <h1>Video Analysis<span>.</span></h1>
          <p>Load a video, inspect its timeline and capture individual frames.</p>
        </div>

        <div className="video-mode-tag">
          <span className="engine-dot" />
          LOCAL WORKSPACE
        </div>
      </div>

      <div className="video-analysis-layout">
        <section className="video-workspace-panel">
          <div className="video-panel-heading">
            <div>
              <span className="panel-kicker">SOURCE INPUT</span>
              <h2>Video workspace</h2>
            </div>
            <Film size={21} />
          </div>

          {videoUrl ? (
            <>
              <div className="video-preview-area">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  onLoadedMetadata={(event) => {
                    setDuration(event.currentTarget.duration || 0)
                    setVideoReady(true)
                  }}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onError={() => setError('This video could not be opened by the browser.')}
                />
                <div className="video-loaded-label">
                  <span className="engine-dot" />
                  VIDEO LOADED
                </div>
              </div>

              <div className="video-file-details">
                <div className="video-file-name">
                  <FileVideo size={17} />
                  <span title={videoName}>{videoName}</span>
                </div>
                <div className="video-file-meta">
                  <span>{videoSize}</span>
                  <span><Clock3 size={13} /> {formatTime(duration)}</span>
                </div>
              </div>

              <div className="video-timeline-readout">
                <span>PLAYHEAD POSITION</span>
                <strong>{formatTime(currentTime)} <small>/ {formatTime(duration)}</small></strong>
              </div>

              <div className="video-actions">
                <button
                  className="video-capture-button"
                  onClick={captureFrame}
                  disabled={!videoReady}
                >
                  <ImagePlus size={17} />
                  Capture current frame
                </button>
                <button className="video-remove-button" onClick={removeVideo}>
                  <RotateCcw size={16} />
                  Replace video
                </button>
              </div>
            </>
          ) : (
            <div className="video-drop-area">
              <div className="video-upload-icon">
                <Video size={30} />
              </div>
              <h3>Upload a video</h3>
              <p>Select a video stored on this device. It will be previewed locally in this workspace.</p>
              <label className="video-select-button" htmlFor="nexus-video-input">
                <Upload size={17} />
                Select video
              </label>
              <input
                id="nexus-video-input"
                type="file"
                accept="video/*"
                onChange={handleVideoSelection}
                hidden
              />
              <span className="video-format-note">SUPPORTED FORMATS DEPEND ON YOUR BROWSER</span>
            </div>
          )}

          {error && <div className="video-error-message">{error}</div>}
        </section>

        <aside className="video-frame-panel">
          <div className="video-panel-heading">
            <div>
              <span className="panel-kicker">FRAME EXTRACTION</span>
              <h2>Captured frame</h2>
            </div>
            <ImagePlus size={21} />
          </div>

          {capturedFrame ? (
            <div className="captured-frame-preview">
              <img src={capturedFrame} alt="Captured video frame" />
              <div className="captured-frame-label">
                <CheckCircle2 size={15} />
                FRAME CAPTURED
              </div>
            </div>
          ) : (
            <div className="frame-empty-state">
              <div className="frame-empty-icon">
                <Film size={27} />
              </div>
              <strong>No frame captured</strong>
              <p>Play or pause the video at the moment you want, then capture the current frame.</p>
            </div>
          )}

          <div className="frame-info">
            <span>ANALYSIS STATUS</span>
            <strong><span className="engine-dot muted" /> AI ENGINE NOT INITIALIZED</strong>
            <p>Frame capture is available now. Visual AI examination will be connected in a later stage.</p>
          </div>
        </aside>
      </div>

      <div className="video-analysis-footer">
        <span><ShieldCheck size={14} /> TEMPORARY VIDEO SESSION</span>
        <button onClick={onBack}>
          <ArrowRight size={15} />
          RETURN TO DASHBOARD
        </button>
      </div>
    </div>
  )
}
