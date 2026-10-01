import { useEffect, useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import { getDashboard } from '../services/api'

function ResumeImprovementPage() {
  const [suggestions, setSuggestions] = useState([])
  const [strengths, setStrengths] = useState([])
  const [fromSeed, setFromSeed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDashboard()
      .then((data) => {
        setSuggestions(data?.dashboard?.improvementSuggestions || [])
        setStrengths(data?.dashboard?.strengths || [])
        setFromSeed(Boolean(data?.fromSeed))
      })
      .catch((requestError) => {
        setError(requestError.message)
      })
  }, [])

  return (
    <div className="container page-content">
      <SectionHeader
        eyebrow="Resume improvement"
        title="Where your resume can be sharper"
        description={error || (fromSeed ? 'Sample recommendations; upload a resume for personalized analysis.' : 'Recommendations are based on the latest resume analysis.')}
      />

      <div className="improvement-layout">
        <section className="panel-card">
          <h3>Recommended improvements</h3>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="suggestion-list">
            {suggestions.map((suggestion) => (
              <article key={suggestion.title} className="suggestion-item">
                <div className="suggestion-header">
                  <strong>{suggestion.title}</strong>
                  <span>{suggestion.focus}</span>
                </div>
                <p>{suggestion.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel-card side-panel compact-side">
          <p className="eyebrow small">Resume strengths</p>
          <ul className="strength-panel-list">
            {strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
          {!strengths.length && !error ? <p>Not detected</p> : null}
        </aside>
      </div>
    </div>
  )
}

export default ResumeImprovementPage
