import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SectionHeader from '../components/SectionHeader'
import StatCard from '../components/StatCard'
import JobCard from '../components/JobCard'
import { hiringPipeline } from '../data/mockData'
import { getDashboard, getJobs } from '../services/api'

function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null)
  const [jobs, setJobs] = useState([])
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    Promise.allSettled([getDashboard(), getJobs()]).then(([analysisResult, jobsResult]) => {
      if (analysisResult.status === 'fulfilled') {
        setDashboardData(analysisResult.value)
      } else {
        setApiError(analysisResult.reason.message)
      }

      if (jobsResult.status === 'fulfilled' && Array.isArray(jobsResult.value)) {
        setJobs(jobsResult.value)
      } else if (jobsResult.status === 'rejected') {
        setApiError((current) => current || jobsResult.reason.message)
      }
    })
  }, [])

  const stats = dashboardData?.dashboard?.stats || []
  const signalList = dashboardData?.dashboard?.matchSignals || []
  const roleMatches = dashboardData?.recommendedJobs?.length ? dashboardData.recommendedJobs : jobs
  const resumeStrengths = dashboardData?.dashboard?.strengths || []
  const pipelineItems = hiringPipeline
  const resumePreview = dashboardData?.resumePreview || {
    name: 'Not detected',
    education: 'Not detected',
    skillsDetected: 'Not detected',
    experienceDetected: 'Not detected',
    projectsDetected: 'Not detected',
    certificationsDetected: 'Not detected',
  }

  return (
    <div className="container page-content">
      <section className="page-header-row">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Career dashboard</h1>
        </div>
        <Link to="/resume-upload" className="button secondary">
          Reanalyze resume
        </Link>
      </section>

      {apiError ? <p className="form-error" role="alert">{apiError}</p> : null}

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel-card wide-panel">
          <SectionHeader
            eyebrow="Resume read"
            title={dashboardData?.fromSeed ? 'Sample analysis' : 'Resume successfully read'}
            description={dashboardData?.processingMessage || 'No resume analysis is available yet.'}
          />

          <div className="resume-preview-grid">
            <div><span>Name</span><strong>{resumePreview.name || 'Not detected'}</strong></div>
            <div><span>Education</span><strong>{resumePreview.education || 'Not detected'}</strong></div>
            <div><span>Skills detected</span><strong>{resumePreview.skillsDetected || 'Not detected'}</strong></div>
            <div><span>Experience detected</span><strong>{resumePreview.experienceDetected || 'Not detected'}</strong></div>
            <div><span>Projects detected</span><strong>{resumePreview.projectsDetected || 'Not detected'}</strong></div>
            <div><span>Certifications detected</span><strong>{resumePreview.certificationsDetected || 'Not detected'}</strong></div>
          </div>
        </section>

        <section className="panel-card wide-panel">
          <SectionHeader
            eyebrow="Role fit"
            title="Your strongest opportunities"
            description="The roles below reflect strong alignment with your current experience, goals, and resume narrative."
          />

          <div className="job-list">
            {roleMatches.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>

        <aside className="panel-card side-panel">
          <SectionHeader
            eyebrow="Signal check"
            title="Match signals"
          />

          <div className="signal-list">
            {signalList.map((signal) => (
              <div key={signal.label} className="signal-row">
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </div>
            ))}
          </div>

          <div className="strength-list">
            <p className="eyebrow small">Your strengths</p>
            <ul>
              {resumeStrengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section className="panel-card full-width-panel">
        <SectionHeader
          eyebrow="Pipeline"
          title="Hiring momentum"
        />

        <div className="pipeline-grid">
          {pipelineItems.map((item) => (
            <div key={item.stage} className={`pipeline-item ${item.tone}`}>
              <span>{item.stage}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default DashboardPage
