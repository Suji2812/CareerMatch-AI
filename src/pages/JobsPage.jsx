import { useEffect, useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import JobCard from '../components/JobCard'
import { getJobs } from '../services/api'

function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    getJobs()
      .then((data) => {
        if (Array.isArray(data)) {
          setJobs(data)
        }
      })
      .catch((requestError) => {
        setError(requestError.message)
      })
  }, [])

  return (
    <div className="container page-content">
      <SectionHeader
        eyebrow="Recommended roles"
        title="Match quality across your current opportunities"
        description={error ? 'Live role data is unavailable.' : 'Roles and match details are loaded from the backend analysis.'}
      />

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="job-list compact-list">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  )
}

export default JobsPage
