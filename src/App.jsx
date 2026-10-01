import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import ResumeUploadPage from './pages/ResumeUploadPage'
import DashboardPage from './pages/DashboardPage'
import JobsPage from './pages/JobsPage'
import JobDetailPage from './pages/JobDetailPage'
import ResumeImprovementPage from './pages/ResumeImprovementPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/resume-upload" element={<ResumeUploadPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/resume-improvement" element={<ResumeImprovementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
