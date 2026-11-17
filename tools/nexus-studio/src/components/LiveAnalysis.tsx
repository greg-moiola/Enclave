
import {
  Activity,
  Aperture,
  Camera,
  CircleDot,
  Crosshair,
  Eye,
  Maximize,
  ScanFace,
  Settings2,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Zap,
} from 'lucide-react'
import './LiveAnalysis.css'

type LiveAnalysisProps = {
  onBack: () => void
}

function LiveAnalysis({ onBack }: LiveAnalysisProps) {
  return (
    <div className="live-analysis">
      <div className="live-heading">
        <div>
          <div className="section-overline">
            <span className="overline-line" />
            VISUAL INTELLIGENCE / LIVE
          </div>
          <h1>Live Analysis<span>.</span></h1>
          <p>Real-time visual examination environment.</p>
        </div>

        <div className="live-status">
          <span className="live-status-dot" />
          CAMERA NOT CONNECTED
        </div>
      </div>

      <div className="live-workspace">
        <section className="live-view-panel">
          <div className="live-view-topbar">
            <div className="live-view-label">
              <Camera size={16} />
              CAMERA FEED
            </div>
            <div className="live-view-tools">
              <span>1920 × 1080</span>
              <Maximize size={17} />
            </div>
          </div>

          <div className="camera-viewport">
            <div className="camera-grid" />

            <div className="camera-corner corner-tl" />
            <div className="camera-corner corner-tr" />
            <div className="camera-corner corner-bl" />
            <div className="camera-corner corner-br" />

            <div className="camera-placeholder">
              <div className="camera-placeholder-icon">
                <Aperture size={43} strokeWidth={1.2} />
              </div>
              <h2>Awaiting camera input</h2>
              <p>Connect a camera to initialize the live environment.</p>
              <span className="camera-placeholder-tag">
                <CircleDot size={12} />
                NO VIDEO SIGNAL
              </span>
            </div>

            <div className="camera-overlay-top">
              <span>INPUT 01</span>
              <span>LOCAL FEED</span>
            </div>

            <div className="camera-overlay-bottom">
              <span>00:00:00</span>
              <span>NO SIGNAL</span>
            </div>
          </div>

          <div className="camera-controls">
            <div className="camera-control-info">
              <span className="control-indicator" />
              CAMERA STANDBY
            </div>

            <div className="camera-control-actions">
              <button className="camera-action-button" disabled>
                <Camera size={16} />
                Start camera
              </button>
              <button className="camera-icon-button" disabled aria-label="Camera settings">
                <Settings2 size={17} />
              </button>
            </div>
          </div>
        </section>

        <aside className="live-side-panel">
          <section className="live-info-card">
            <div className="live-card-heading">
              <div>
                <span className="live-card-kicker">ANALYSIS ENGINE</span>
                <h2>Detection status</h2>
              </div>
              <Crosshair size={20} />
            </div>

            <div className="detection-state">
              <div className="detection-state-icon">
                <ScanFace size={25} />
              </div>
              <div>
                <strong>STANDBY</strong>
                <span>Waiting for video input</span>
              </div>
            </div>

            <div className="live-data-row">
              <span>Face detection</span>
              <strong>INACTIVE</strong>
            </div>
            <div className="live-data-row">
              <span>Expression analysis</span>
              <strong>INACTIVE</strong>
            </div>
            <div className="live-data-row">
              <span>Frame processing</span>
              <strong>INACTIVE</strong>
            </div>
          </section>

          <section className="live-info-card">
            <div className="live-card-heading">
              <div>
                <span className="live-card-kicker">VISUAL PARAMETERS</span>
                <h2>Analysis settings</h2>
              </div>
              <SlidersHorizontal size={20} />
            </div>

            <div className="parameter-row">
              <div>
                <strong>Face detection</strong>
                <span>Locate visible faces</span>
              </div>
              <span className="parameter-tag">READY</span>
            </div>

            <div className="parameter-row">
              <div>
                <strong>Expression estimation</strong>
                <span>Estimate visible expressions</span>
              </div>
              <span className="parameter-tag">READY</span>
            </div>

            <div className="parameter-row">
              <div>
                <strong>Local processing</strong>
                <span>On-device inference</span>
              </div>
              <span className="parameter-tag">PLANNED</span>
            </div>
          </section>

          <section className="live-info-card live-system-card">
            <div className="live-card-heading">
              <div>
                <span className="live-card-kicker">ENVIRONMENT</span>
                <h2>System information</h2>
              </div>
              <Activity size={20} />
            </div>

            <div className="live-system-row">
              <Signal size={15} />
              <span>Connection</span>
              <strong>LOCAL</strong>
            </div>
            <div className="live-system-row">
              <ShieldCheck size={15} />
              <span>Data storage</span>
              <strong>TEMPORARY</strong>
            </div>
            <div className="live-system-row">
              <Zap size={15} />
              <span>AI engine</span>
              <strong>PENDING</strong>
            </div>
          </section>
        </aside>
      </div>

      <div className="live-bottom-bar">
        <span> <Eye size={14} /> LIVE VISUAL ENVIRONMENT</span>
        <span>PROCESSING WILL RUN LOCALLY</span>
        <button onClick={onBack}>RETURN TO DASHBOARD</button>
      </div>
    </div>
  )
}

export default LiveAnalysis
