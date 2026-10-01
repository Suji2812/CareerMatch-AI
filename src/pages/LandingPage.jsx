import { Link } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'

const featureList = [
  'Resume fit scoring against target roles',
  'Role specific keyword and skill alignment',
  'Career direction recommendations with clarity',
]

const proofPoints = [
  { value: '4.9/5', label: 'Candidate experience' },
  { value: '2x', label: 'Faster interview prep' },
  { value: '36 hours', label: 'Saved per search' },
]

function LandingPage() {
  return (
    <div className="container page-content">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Career strategy for modern professionals</p>
          <h1>
            Find Jobs That <span className="gradient-text">Actually Fit</span> Your Resume.
          </h1>
          <p className="lead">
            CareerMatch AI helps professionals identify the best opportunities, strengthen their resume,
            and move through the job search with confidence.
          </p>

          <div className="cta-row">
            <Link to="/resume-upload" className="button primary">
              <span>Analyze my resume</span>
              <span className="button-arrow">→</span>
            </Link>
            <Link to="/jobs" className="button secondary">
              Explore roles
            </Link>
          </div>

          <ul className="feature-list">
            {featureList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="hero-card">
          <div className="mini-card top">
            <p className="eyebrow small">Best fit</p>
            <h3>Senior Product Manager</h3>
            <p>92% role match</p>
          </div>

          <div className="mini-card highlighted">
            <div>
              <p className="eyebrow small">Resume score</p>
              <h3>88</h3>
            </div>
            <div className="score-ring">
              <span>Strong</span>
            </div>
          </div>

          <div className="mini-card grid-card">
            {proofPoints.map((point) => (
              <div key={point.label}>
                <strong>{point.value}</strong>
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="info-strip">
        <div>
          <p className="eyebrow small">Search efficiency</p>
          <h3>Shortlist the roles that fit.</h3>
        </div>
        <div>
          <p className="eyebrow small">Resume quality</p>
          <h3>Improve language before you apply.</h3>
        </div>
        <div>
          <p className="eyebrow small">Actionable insight</p>
          <h3>Know where to focus next.</h3>
        </div>
      </section>

      <section id="about" className="section-block">
        <SectionHeader
          eyebrow="How it works"
          title="A clear path from profile to opportunity"
          description="The platform is designed to help thoughtful professionals move faster without sacrificing quality."
        />

        <div className="three-col-grid">
          <article className="info-card">
            <span className="step-badge">01</span>
            <h3>Upload your resume</h3>
            <p>Share a PDF and let the analysis engine review your strengths, gaps, and target-fit signals.</p>
          </article>

          <article className="info-card">
            <span className="step-badge">02</span>
            <h3>Review the match</h3>
            <p>Measure role fit, skill overlap, and resume quality against your current job search goals.</p>
          </article>

          <article className="info-card">
            <span className="step-badge">03</span>
            <h3>Apply with confidence</h3>
            <p>Prioritize the roles with the strongest alignment and tighten your story before each application.</p>
          </article>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
