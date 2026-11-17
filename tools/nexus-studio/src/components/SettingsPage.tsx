import { useEffect, useState } from 'react'
import {
  Activity,
  Check,
  ChevronRight,
  Cpu,
  HardDrive,
  LockKeyhole,
  Monitor,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import './SettingsPage.css'

export default function SettingsPage() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('nexus-reduced-motion', reduceMotion)

    return () => {
      document.documentElement.classList.remove('nexus-reduced-motion')
    }
  }, [reduceMotion])

  function restartSession() {
    const confirmed = window.confirm(
      'Restart NEXUS? The current interface session will be reset and you will return to the access screen.',
    )

    if (confirmed) window.location.reload()
  }

  return (
    <div className="nexus-settings">
      <div className="settings-heading">
        <div>
          <div className="section-overline">
            <span className="overline-line" />
            SYSTEM CONFIGURATION
          </div>
          <h1>Settings<span>.</span></h1>
          <p>Configure the interface and review how NEXUS handles session data.</p>
        </div>
        <div className="settings-mode-tag">
          <span className="engine-dot" />
          LOCAL CONFIGURATION
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div className="settings-panel-icon"><SlidersHorizontal size={19} /></div>
            <div>
              <span className="panel-kicker">PERSONALIZATION</span>
              <h2>Interface preferences</h2>
            </div>
          </div>

          <div className="settings-option">
            <div className="settings-option-copy">
              <strong>Reduce motion</strong>
              <p>Reduce interface transitions and animated effects.</p>
            </div>
            <button
              type="button"
              className={`settings-switch ${reduceMotion ? 'is-on' : ''}`}
              role="switch"
              aria-checked={reduceMotion}
              onClick={() => setReduceMotion((value) => !value)}
            >
              <span />
            </button>
          </div>

          <div className="settings-current-state">
            <Check size={15} />
            <span>{reduceMotion ? 'Reduced motion is enabled for this session.' : 'Standard interface motion is enabled.'}</span>
          </div>

          <div className="settings-note">
            <Sparkles size={16} />
            <p>This preference is temporary and returns to its default when the page is reloaded.</p>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div className="settings-panel-icon"><ShieldCheck size={19} /></div>
            <div>
              <span className="panel-kicker">PRIVACY &amp; DATA</span>
              <h2>Session protection</h2>
            </div>
          </div>

          <div className="settings-security-row">
            <div className="settings-security-icon"><LockKeyhole size={17} /></div>
            <div>
              <strong>Local-first workspace</strong>
              <p>Selected media is handled in the current browser session.</p>
            </div>
            <span className="settings-status">DESIGNED</span>
          </div>

          <div className="settings-security-row">
            <div className="settings-security-icon"><HardDrive size={17} /></div>
            <div>
              <strong>No analysis history</strong>
              <p>NEXUS is being designed not to retain photos, videos or analysis results as an operation history.</p>
            </div>
            <span className="settings-status">POLICY</span>
          </div>

          <div className="settings-privacy-disclaimer">
            <strong>Important</strong>
            <p>Browser memory and temporary files are released as modules close or the page reloads. This does not guarantee forensic deletion of every trace managed by the browser or operating system.</p>
          </div>
        </section>

        <section className="settings-panel settings-system-panel">
          <div className="settings-panel-heading">
            <div className="settings-panel-icon"><Activity size={19} /></div>
            <div>
              <span className="panel-kicker">ENVIRONMENT</span>
              <h2>System information</h2>
            </div>
          </div>

          <div className="settings-info-row">
            <span><Monitor size={15} /> Platform</span>
            <strong>Browser application</strong>
          </div>
          <div className="settings-info-row">
            <span><Smartphone size={15} /> Responsive mode</span>
            <strong>PC &amp; Mobile</strong>
          </div>
          <div className="settings-info-row">
            <span><Cpu size={15} /> AI inference engine</span>
            <strong className="settings-ready">ON-DEMAND</strong>
          </div>
          <div className="settings-info-row">
            <span><HardDrive size={15} /> Model storage</span>
            <strong className="settings-pending">FIRST-USE LOAD</strong>
          </div>

          <div className="settings-system-footnote">
            <span className="engine-dot muted" />
            Analysis models initialize only when their module is used. Some model files are fetched on first use and may be cached by the browser.
          </div>
        </section>

        <section className="settings-panel settings-reset-panel">
          <div className="settings-panel-heading">
            <div className="settings-panel-icon"><RotateCcw size={19} /></div>
            <div>
              <span className="panel-kicker">SESSION CONTROL</span>
              <h2>Restart workspace</h2>
            </div>
          </div>
          <p className="settings-reset-description">Return to the access screen and reset the current in-memory interface state.</p>
          <button className="settings-reset-button" onClick={restartSession}>
            <RotateCcw size={16} />
            Restart NEXUS session
            <ChevronRight size={16} />
          </button>
        </section>
      </div>

      <div className="settings-footer">
        <span><ShieldCheck size={14} /> NEXUS / PRIVATE VISUAL WORKSPACE</span>
        <span>CONFIGURATION IS CURRENTLY SESSION-ONLY</span>
      </div>
    </div>
  )
}
