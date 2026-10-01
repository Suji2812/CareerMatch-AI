import fs from 'node:fs'
import { extractTextFromPdfBuffer, analyzeResumeDocument } from '../server/services/resumeMatcher.js'

const buffer = fs.readFileSync('./sample_resume.pdf')

try {
  const extraction = await extractTextFromPdfBuffer(buffer)
  console.log('EXTRACTION', extraction)

  const jobs = [{
    id: 'job1',
    title: 'Data Engineer',
    company: 'Acme',
    summary: 'Build data pipelines',
    description: 'Need Python SQL PySpark Databricks Azure',
    requirements: ['Python', 'SQL', 'PySpark', 'Databricks', 'Azure'],
    responsibilities: ['Build ETL pipelines'],
    tags: ['data', 'cloud'],
    salary: '120k',
    location: 'Remote',
    employment: 'Full-time',
  }]

  const analysis = await analyzeResumeDocument(extraction.text, jobs)
  console.log('ANALYSIS OK', analysis.resumeProfile.skills)
} catch (error) {
  console.error('ERROR', error && error.stack ? error.stack : error)
  process.exit(1)
}
