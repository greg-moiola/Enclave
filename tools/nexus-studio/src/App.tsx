import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'

import {
  Activity,
  Aperture,
  ArrowRight,
  Camera,
  ChartNoAxesCombined,
  ChevronLeft,
  Cpu,
  Database,
  Eye,
  FileImage,
  Fingerprint,
  Gauge,
  LayoutDashboard,
  Menu,
  ScanFace,
  ScanSearch,
  Settings,
  ShieldCheck,
  Video,
  X,
  Zap,
} from 'lucide-react'
import './App.css'

// Keep the application shell lightweight: each analysis module is downloaded
// only when the user opens it. Heavy AI dependencies stay outside the first load.
const LiveAnalysis = lazy(() => import('./components/LiveAnalysis'))
const SubjectSearch = lazy(() => import('./components/SubjectSearch'))
const VideoAnalysis = lazy(() => import('./components/VideoAnalysis'))
const SettingsPage = lazy(() => import('./components/SettingsPage'))
const ImageAnalysis = lazy(() => import('./components/ImageAnalysis'))

type Phase = 'access' | 'boot' | 'app'

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Live Analysis', icon: ScanFace },
  { name: 'Image Analysis', icon: FileImage },
  { name: 'Subject Search', icon: ScanSearch },
  { name: 'Video Analysis', icon: Video },
]

function App() {
  const [phase, setPhase] = useState<Phase>('access')
  const [accessKey, setAccessKey] = useState('')
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (phase !== 'boot') return

    const timer = window.setTimeout(() => {
      setPhase('app')
    }, 1450)

    return () => window.clearTimeout(timer)
  }, [phase])

  function handleAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!accessKey.trim()) return

    setPhase('boot')
  }

  if (phase === 'access') {
    return (
      <main className="access-screen">
        <form className="access-form" onSubmit={handleAccess}>
          <div className="access-symbol">
            <Fingerprint size={27} strokeWidth={1.25} />
          </div>

          <div className="access-heading">
            <span className="access-overline">PRIVATE SYSTEM</span>
            <h1>Restricted access</h1>
            <p>Enter your authorization key to continue.</p>
          </div>

          <label className="access-label" htmlFor="access-key">
            ACCESS KEY
          </label>

          <input
            id="access-key"
            className="access-input"
            type="password"
            placeholder="Enter access key"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            autoComplete="off"
          />

          <button className="access-button" type="submit">
            Continue <ArrowRight size={16} />
          </button>

          <span className="access-footer">
            AUTHORIZED PERSONNEL ONLY
          </span>
        </form>
      </main>
    )
  }

  if (phase === 'boot') {
    return (
      <main className="boot-screen">
        <div className="boot-orbit boot-orbit-one" />
        <div className="boot-orbit boot-orbit-two" />

        <div className="boot-core">
          <Aperture size={66} strokeWidth={1} />
        </div>

        <div className="boot-title">NEXUS</div>
        <div className="boot-subtitle">INITIALIZING VISUAL INTELLIGENCE</div>

        <div className="boot-progress">
          <div className="boot-progress-fill" />
        </div>

        <div className="boot-status">ESTABLISHING LOCAL ENVIRONMENT</div>
      </main>
    )
  }

  const currentPage = navigation.find((item) => item.name === activePage)
  const CurrentPageIcon = currentPage?.icon ?? Settings

  return (
    <main className="nexus-app">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Aperture size={25} />
          </div>
          <div>
            <div className="brand-name">NEXUS</div>
            <div className="brand-caption">VISUAL INTELLIGENCE</div>
          </div>
          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-label">MAIN MENU</div>

        <nav className="sidebar-navigation">
          {navigation.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.name}
                className={`nav-item ${activePage === item.name ? 'nav-active' : ''}`}
                onClick={() => {
                  setActivePage(item.name)
                  setSidebarOpen(false)
                }}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.name}</span>
                {activePage === item.name && <span className="nav-indicator" />}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">SYSTEM</div>
          <button
            className={`nav-item ${activePage === 'Settings' ? 'nav-active' : ''}`}
            onClick={() => {
              setActivePage('Settings')
              setSidebarOpen(false)
            }}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="engine-card">
            <div className="engine-card-top">
              <span className="engine-dot" />
              <span>LOCAL ENVIRONMENT</span>
            </div>
            <div className="engine-state">INTERFACE ACTIVE</div>
            <div className="engine-description">AI modules initialize on demand</div>
          </div>

          <div className="sidebar-version">NEXUS / DEVELOPMENT BUILD</div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            <span>NEXUS</span>
            <ChevronLeft size={13} className="breadcrumb-arrow" />
            <strong>{activePage.toUpperCase()}</strong>
          </div>

          <div className="topbar-right">
            <span className="system-indicator">
              <span className="engine-dot" /> SYSTEM ONLINE
            </span>
            <div className="topbar-avatar">
              <ShieldCheck size={17} />
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <Suspense
            fallback={
              <div className="nexus-module-loading" role="status" aria-live="polite">
                <span className="nexus-loading-orbit" />
                <span className="nexus-loading-kicker">NEXUS / MODULE INITIALIZATION</span>
                <strong>Preparing workspace</strong>
                <span className="nexus-loading-caption">Loading the selected local interface…</span>
              </div>
            }
          >
          {activePage === 'Dashboard' ? (
            <>
              <div className="welcome-section">
                <div>
                  <div className="section-overline">
                    <span className="overline-line" />
                    SYSTEM OVERVIEW
                  </div>
                  <h1>Command Center<span>.</span></h1>
                  <p>Welcome to your visual intelligence environment.</p>
                </div>

                <div className="session-tag">
                  <Activity size={15} />
                  CURRENT SESSION
                </div>
              </div>

              <section className="metrics-grid">
                <article className="metric-card">
                  <div className="metric-top">
                    <span>SESSION ANALYSES</span>
                    <Eye size={19} />
                  </div>
                  <div className="metric-value">00</div>
                  <div className="metric-bottom">Operations this session</div>
                </article>

                <article className="metric-card">
                  <div className="metric-top">
                    <span>PROCESSING TIME</span>
                    <Zap size={19} />
                  </div>
                  <div className="metric-value">--<small> ms</small></div>
                  <div className="metric-bottom">Awaiting first analysis</div>
                </article>

                <article className="metric-card">
                  <div className="metric-top">
                    <span>AI ENGINE</span>
                    <Cpu size={19} />
                  </div>
                  <div className="metric-status">ON-DEMAND</div>
                  <div className="metric-bottom">Models load when an analysis starts</div>
                </article>

                <article className="metric-card">
                  <div className="metric-top">
                    <span>SESSION STORAGE</span>
                    <Database size={19} />
                  </div>
                  <div className="metric-status">TEMPORARY</div>
                  <div className="metric-bottom">No operation history retained</div>
                </article>
              </section>

              <section className="dashboard-main-grid">
                <div className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="panel-kicker">INTELLIGENCE TOOLS</div>
                      <h2>Analysis modules</h2>
                    </div>
                    <ScanSearch size={21} />
                  </div>

                  <div className="module-list">
                    {[
                      {
                        name: 'Live Analysis',
                        description: 'Real-time camera examination',
                        icon: Camera,
                        number: '01',
                      },
                      {
                        name: 'Image Analysis',
                        description: 'Photographic examination',
                        icon: FileImage,
                        number: '02',
                      },
                      {
                        name: 'Subject Search',
                        description: 'Visual attribute-based search',
                        icon: ScanSearch,
                        number: '03',
                      },
                      {
                        name: 'Video Analysis',
                        description: 'Video and frame examination',
                        icon: Video,
                        number: '04',
                      },
                    ].map((module) => {
                      const Icon = module.icon

                      return (
                        <button
                          className="module-item"
                          key={module.name}
                          onClick={() => setActivePage(module.name)}
                        >
                          <div className="module-icon">
                            <Icon size={21} />
                          </div>
                          <div className="module-info">
                            <strong>{module.name}</strong>
                            <span>{module.description}</span>
                          </div>
                          <span className="module-number">{module.number}</span>
                          <ArrowRight className="module-arrow" size={17} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="right-panels">
                  <div className="panel engine-panel">
                    <div className="panel-heading">
                      <div>
                        <div className="panel-kicker">CORE TECHNOLOGY</div>
                        <h2>System status</h2>
                      </div>
                      <Gauge size={21} />
                    </div>

                    <div className="status-row">
                      <span>Application</span>
                      <strong className="status-ready">OPERATIONAL</strong>
                    </div>
                    <div className="status-row">
                      <span>Local interface</span>
                      <strong className="status-ready">ACTIVE</strong>
                    </div>
                    <div className="status-row">
                      <span>AI inference</span>
                      <strong className="status-ready">ON-DEMAND</strong>
                    </div>
                    <div className="status-row">
                      <span>Camera access</span>
                      <strong className="status-pending">NOT REQUESTED</strong>
                    </div>
                  </div>

                  <div className="panel activity-panel">
                    <div className="panel-heading">
                      <div>
                        <div className="panel-kicker">LIVE MONITOR</div>
                        <h2>Session activity</h2>
                      </div>
                      <Activity size={21} />
                    </div>

                    <div className="activity-entry">
                      <span className="activity-marker" />
                      <div>
                        <strong>Interface initialized</strong>
                        <span>NEXUS environment started</span>
                      </div>
                      <time>NOW</time>
                    </div>

                    <div className="activity-entry">
                      <span className="activity-marker muted" />
                      <div>
                        <strong>Local AI modules</strong>
                        <span>Loaded only when an analysis is requested</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="dashboard-footer">
                <span><ChartNoAxesCombined size={14} /> LOCAL PROCESSING ENVIRONMENT</span>
                <span>ALL SESSION DATA IS TEMPORARY</span>
              </div>
            </>
          ) : activePage === 'Live Analysis' ? (
            <LiveAnalysis onBack={() => setActivePage('Dashboard')} />
          ) : activePage === 'Image Analysis' ? (
            <ImageAnalysis onBack={() => setActivePage('Dashboard')} />
          ) : activePage === 'Subject Search' ? (
            <SubjectSearch onBack={() => setActivePage('Dashboard')} />
          ) : activePage === 'Video Analysis' ? (
            <VideoAnalysis onBack={() => setActivePage('Dashboard')} />
          ) : activePage === 'Settings' ? (
            <SettingsPage />
          ) : (
            <div className="placeholder-panel">
              <div className="placeholder-icon">
                <CurrentPageIcon size={34} />
              </div>
              <div className="section-overline">NEXUS / MODULE</div>
              <h1>{activePage}<span>.</span></h1>
              <p>This module is part of the NEXUS interface architecture.</p>
              <div className="placeholder-status">
                <span className="engine-dot" />
                INTERFACE READY — AI INTEGRATION PENDING
              </div>
              <button
                className="back-button"
                onClick={() => setActivePage('Dashboard')}
              >
                <ArrowRight size={16} /> Return to Dashboard
              </button>
            </div>
          )}
          </Suspense>
        </div>
      </section>
    </main>
  )
}

export default App
