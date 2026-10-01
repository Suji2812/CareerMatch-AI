import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getJobById } from '../services/api'

function JobDetailPage() {
  const { jobId } = useParams()
  const [result, setResult] = useState(null)

  useEffect(() => {
    let isCurrent = true
    getJobById(jobId)
      .then((jobData) => {
        if (isCurrent) setResult({ jobId, job: jobData, error: '' })
      })
      .catch((requestError) => {
        if (isCurrent) setResult({ jobId, job: null, error: requestError.message })
      })
    return () => {
      isCurrent = false
    }
  }, [jobId])

  const currentResult = result?.jobId === jobId ? result : null
  const job = currentResult?.job
  const error = currentResult?.error || ''
  const isLoading = !currentResult

  if (!job) {
    return (
      <div className="container page-content empty-state">
        <h2>{isLoading ? 'Loading role' : 'Role details unavailable'}</h2>
        <p>{error || 'The selected role could not be found in the current job list.'}</p>
        <Link to="/jobs" className="button primary">
          Back to jobs
        </Link>
      </div>
    )
  }

  const responsibilities = job.responsibilities || []
  const requirements = job.requirements || []
  const fitScore = job.matchPercentage ?? job.match ?? null
  const priority = job.priority || (fitScore === null ? 'Not analyzed' : 'Resume-based match')
  const breakdown = job.breakdown || {}
  const breakdownRows = [
    ['Overall Match', breakdown.overall ?? fitScore],
    ['Skills Match', breakdown.skillsMatch],
    ['Experience Match', breakdown.experienceMatch],
    ['Project Relevance', breakdown.projectRelevance],
    ['Education Match', breakdown.educationMatch],
  ]

  return (
    <div className="container page-content job-detail-page">
      <div className="job-detail-header">
        <div>
          <p className="eyebrow">{job.company}</p>
          <h1>{job.title}</h1>
        </div>
        <div className="job-detail-meta">
          <span>{job.location}</span>
          <span>{job.employment}</span>
          <span>{job.salary}</span>
        </div>
      </div>

      <div className="detail-grid">
        <article className="panel-card detail-card">
          <h3>Why this role fits</h3>
          <p>{job.summary}</p>

          <div className="match-summary-block detail-match-block">
            <p className="match-summary-label">Why this matches</p>
            <p>{job.whyThisMatches || 'Upload a resume to calculate role alignment.'}</p>
          </div>

          <div className="breakdown-list">
            {breakdownRows.map(([label, value]) => (
              <div key={label} className="breakdown-row">
                <div className="breakdown-label-row">
                  <span>{label}</span>
                  <strong>{value === null || value === undefined ? 'Not assessed' : `${value}%`}</strong>
                </div>
                <div className="breakdown-bar">
                  <span style={{ width: `${value ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="detail-section">
            <h4>Key responsibilities</h4>
            <ul>
              {responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="detail-section">
            <h4>Requirements</h4>
            <ul>
              {requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>

        <aside className="panel-card detail-aside">
          <div className="match-panel">
            <p className="eyebrow small">Fit score</p>
            <strong>{fitScore === null ? 'Not analyzed' : `${fitScore}%`}</strong>
            <span>{priority}</span>
          </div>

          <div className="match-summary-block detail-side-block">
            <p className="match-summary-label">Why not 100%?</p>
            <p>{job.whyNot100 || 'Upload a resume to identify evidence gaps for this role.'}</p>
          </div>

          <div className="tag-row detail-tags">
            {(job.strongMatches || []).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>

          <div className="detail-actions">
            <Link to="/jobs" className="button secondary">
              Back to jobs
            </Link>
            <button type="button" className="button primary">
              Save role
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default JobDetailPage
