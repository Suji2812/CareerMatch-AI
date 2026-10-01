import { Link } from 'react-router-dom'

function JobCard({ job }) {
  const matchScore = job.matchPercentage ?? job.match ?? 0
  const strongMatches = job.strongMatches || []
  const missingAreas = job.missingOrWeakerAreas || []
  const skillCount = job.skillCount || '0 / 0'

  let matchTone = 'low'
  if (matchScore >= 90) matchTone = 'strong'
  else if (matchScore >= 75) matchTone = 'good'
  else if (matchScore >= 60) matchTone = 'potential'

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    event.currentTarget.style.setProperty('--mouse-x', `${x}%`)
    event.currentTarget.style.setProperty('--mouse-y', `${y}%`)
  }

  return (
    <article className="job-card" onMouseMove={handlePointerMove}>
      <div className="job-card-head">
        <div>
          <p className="eyebrow">{job.company}</p>
          <h3>{job.title}</h3>
        </div>
        <span className={`match-pill ${matchTone}`}>{matchScore}% Match</span>
      </div>

      <div className="job-meta">
        <span>{job.location}</span>
        <span>{job.employment}</span>
        <span>{job.salary}</span>
      </div>

      <p className="job-summary">{job.summary}</p>

      <div className="match-summary-block">
        <p className="match-summary-label">Why this matches</p>
        <p>{job.whyThisMatches || 'Upload a resume to calculate role alignment.'}</p>
      </div>

      <div className="metric-stack">
        <div className="metric-row">
          <span>You have</span>
          <strong>{skillCount} important skills</strong>
        </div>
        <div className="metric-row">
          <span>Relevant experience</span>
          <strong>{job.relevantExperience || 'Not detected'}</strong>
        </div>
        <div className="metric-row">
          <span>Relevant projects</span>
          <strong>{job.relevantProjects || 'Not detected'}</strong>
        </div>
      </div>

      <div className="job-tag-block">
        <p className="mini-heading">Strong matches</p>
        <div className="tag-row">
          {strongMatches.length ? (
            strongMatches.map((skill) => (
              <span key={skill} className="tag">
                {skill}
              </span>
            ))
          ) : (
            <span className="tag muted-tag">Not detected</span>
          )}
        </div>
      </div>

      {missingAreas.length ? (
        <div className="job-tag-block muted-block">
          <p className="mini-heading">Missing or weaker areas</p>
          <div className="tag-row">
            {missingAreas.map((skill) => (
              <span key={skill} className="tag muted-tag">
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="match-footer-grid">
        <div>
          <p className="mini-heading">Resume improvement</p>
          <p>{job.resumeImprovement || 'No resume-specific recommendation is available yet.'}</p>
        </div>
        <div>
          <p className="mini-heading">Why not 100%?</p>
          <p>{job.whyNot100 || 'Upload a resume to identify evidence gaps for this role.'}</p>
        </div>
      </div>

      <div className="tag-row">
        {(job.tags || []).map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="job-card-footer">
        <span>{job.posted}</span>
        <Link to={`/jobs/${job.id}`} className="primary-link">
          <span>View details</span>
          <span className="detail-arrow">→</span>
        </Link>
      </div>
    </article>
  )
}

export default JobCard
