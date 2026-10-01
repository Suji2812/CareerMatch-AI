import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Analyze Resume', to: '/resume-upload' },
  { label: 'Recommended Jobs', to: '/jobs' },
  { label: 'Resume Insights', to: '/resume-improvement' },
  { label: 'About', to: '/#about' },
]

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/" className="brand" aria-label="CareerMatch AI home">
            <span className="brand-mark">C</span>
            <span className="brand-text">CareerMatch AI</span>
          </NavLink>

          <nav className={`nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            className="menu-toggle"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
