import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeResume } from '../services/api'

const analysisStages = [
  'Reading your resume',
  'Understanding your experience',
  'Finding relevant skills',
  'Searching matching jobs',
  'Comparing opportunities',
  'Preparing your insights',
]

function ResumeUploadPage() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState('')
  const [errorStage, setErrorStage] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const validateFile = (file) => {
    if (!file) {
      setError('Please select a PDF resume to continue.')
      setErrorStage('')
      return false
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Please upload a PDF resume.')
      setErrorStage('file_validation')
      return false
    }

    setError('')
    setErrorStage('')
    return true
  }

  const currentStage =
    progress < 20
      ? analysisStages[0]
      : progress < 40
        ? analysisStages[1]
        : progress < 60
          ? analysisStages[2]
          : progress < 80
            ? analysisStages[3]
            : progress < 95
              ? analysisStages[4]
              : analysisStages[5]

  const handleFileSelection = (file) => {
    if (!validateFile(file)) {
      return
    }

    setSelectedFile(file)
  }

  const handleInputChange = (event) => {
    handleFileSelection(event.target.files[0])
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    handleFileSelection(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!selectedFile) {
      setError('Please choose a PDF resume before continuing.')
      return
    }

    if (!validateFile(selectedFile)) {
      return
    }

    setIsAnalyzing(true)
    setProgress(12)

    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(current + 16, 90))
    }, 200)

    try {
      const formData = new FormData()
      formData.append('resume', selectedFile)
      await analyzeResume(formData)
      setProgress(100)
      window.setTimeout(() => navigate('/dashboard'), 400)
    } catch (submitError) {
      setError(submitError.message || 'Upload failed before analysis started.')
      setErrorStage(submitError.stage || '')
      setProgress(0)
      setIsAnalyzing(false)
      window.clearInterval(timer)
    } finally {
      window.clearInterval(timer)
      if (progress >= 100) {
        setIsAnalyzing(false)
      }
    }
  }

  return (
    <div className="container page-content narrow-container">
      <section className="upload-panel">
        <div className="section-header align-left">
          <p className="eyebrow">Resume analysis</p>
          <h2>Upload your resume</h2>
          <p>We will review the document for role fit, skills, and improvement opportunities.</p>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          <label
            className={`dropzone ${selectedFile ? 'dropzone-filled' : ''} ${isDragging ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input type="file" accept="application/pdf" onChange={handleInputChange} />
            <div className="dropzone-content">
              <span className="upload-icon">PDF</span>
              <p className="dropzone-title">{selectedFile ? selectedFile.name : 'Drop your resume here'}</p>
              <p className="dropzone-copy">PDF resumes supported</p>
            </div>
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
              {errorStage ? <span className="error-stage">Stage: {errorStage.replaceAll('_', ' ')}</span> : null}
            </p>
          ) : null}

          {isAnalyzing ? (
            <div className="progress-panel">
              <div className="progress-header">
                <span>{currentStage}</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          <button type="submit" className="button primary full-width" disabled={isAnalyzing}>
            {isAnalyzing ? 'Analyzing resume...' : 'Analyze resume'}
          </button>
        </form>

      </section>
    </div>
  )
}

export default ResumeUploadPage
