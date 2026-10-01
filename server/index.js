import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { config } from './config.js'
import { sampleJobs } from './data/jobs.js'
import {
  analyzeResumeDocument,
  buildResumeExtractionPreview,
  extractTextFromPdfBuffer,
  getEmbeddingProviderStatus,
  getUserFriendlyErrorMessage,
  ingestJobs,
  semanticRetrieve,
  vectorStore,
} from './services/resumeMatcher.js'

function buildStructuredError(stage, message, statusCode = 500) {
  return {
    success: false,
    stage,
    message,
    statusCode,
  }
}

async function cleanupUploadedFile(req) {
  const filePath = req.file?.path
  if (!filePath) return

  req.file.path = null
  await fs.promises.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') {
      console.error('[resume-analysis] temporary upload cleanup failed', error.message)
    }
  })
}

const app = express()
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const uploadDir = path.join(projectRoot, 'tmp', 'uploads')
const distDir = path.join(projectRoot, 'dist')
const distIndexPath = path.join(distDir, 'index.html')

if (config.nodeEnv === 'production' && !fs.existsSync(distIndexPath)) {
  throw new Error(`Production frontend build not found at ${distIndexPath}. Run npm run build before starting the server.`)
}

fs.mkdirSync(uploadDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
      callback(null, `${Date.now()}-${safeName}`)
    },
  }),
  limits: { files: 1, fileSize: config.resumeMaxFileSizeBytes },
})

if (config.nodeEnv !== 'production') {
  app.use(cors())
}
app.use(express.json({ limit: '25mb' }))

let latestResumeAnalysis = null

const publicJobs = [...sampleJobs]

async function bootstrapJobs() {
  const ingestedJobs = await ingestJobs(publicJobs)
  return ingestedJobs
}

const healthPaths = ['/health', '/api/health']

app.get(healthPaths, (_req, res) => {
  const embeddingStatus = getEmbeddingProviderStatus()
  res.json({
    ok: true,
    backend: 'available',
    embeddings: embeddingStatus,
    llm: 'not-configured',
    vectorStore: 'in-memory',
    indexedJobs: vectorStore.jobs.length,
    uploadLimitMb: config.resumeMaxFileSizeMb,
    pageLimit: config.resumeMaxPages,
  })
})

app.get(['/health/ai', '/api/health/ai'], (_req, res) => {
  const embeddingStatus = getEmbeddingProviderStatus()
  res.json({
    embeddings: embeddingStatus,
    llm: { configured: false, provider: null },
    analysisMode: 'local-heuristic-analysis',
  })
})

app.get(['/health/vector-db', '/api/health/vector-db'], (_req, res) => {
  res.json({
    available: true,
    provider: 'in-memory',
    persistent: false,
    indexedJobs: vectorStore.jobs.length,
  })
})

app.get('/api/jobs', async (req, res) => {
  const jobs = latestResumeAnalysis?.allJobMatches || (vectorStore.jobs.length > 0
    ? vectorStore.jobs.map((entry) => entry.metadata)
    : publicJobs)
  res.json(jobs)
})

app.get('/api/jobs/:jobId', async (req, res) => {
  const jobs = latestResumeAnalysis?.allJobMatches || (vectorStore.jobs.length > 0
    ? vectorStore.jobs.map((entry) => entry.metadata)
    : publicJobs)
  const job = jobs.find((item) => item.id === req.params.jobId)

  if (!job) {
    res.status(404).json({ message: 'Job not found' })
    return
  }

  res.json(job)
})

app.post('/api/resume/analyze', upload.single('resume'), async (req, res) => {
  const respond = async (statusCode, body) => {
    await cleanupUploadedFile(req)
    res.status(statusCode).json(body)
  }

  try {
    if (!req.file) {
      const error = buildStructuredError('file_upload', 'A PDF resume is required.', 400)
      await respond(400, error)
      return
    }

    let fileBuffer
    try {
      fileBuffer = await fs.promises.readFile(req.file.path)
    } catch (fileReadError) {
      console.error('[resume-analysis] file read failed', {
        message: fileReadError.message,
        stack: fileReadError.stack,
      })

      await respond(500, buildStructuredError('file_read', 'The PDF could not be read.', 500))
      return
    }

    if (!fileBuffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      await respond(415, buildStructuredError('file_validation', 'This file does not appear to be a valid PDF. Please export it as a PDF and try again.', 415))
      return
    }

    let extraction
    try {
      extraction = await extractTextFromPdfBuffer(fileBuffer)
    } catch (extractionError) {
      console.error('[resume-analysis] PDF extraction error', {
        message: extractionError.message,
        stack: extractionError.stack,
      })

      await respond(500, buildStructuredError('pdf_extraction', 'The PDF could not be read.', 500))
      return
    }

    if (extraction.error) {
      if (extraction.method === 'limit') {
        const message = `This PDF exceeds the server limit of ${config.resumeMaxPages} pages.`
        await respond(413, buildStructuredError('pdf_validation', message, 413))
        return
      }

      const message = extraction.method === 'error'
        ? 'The PDF could not be opened. It may be damaged, encrypted, or unsupported.'
        : 'Text extraction failed. If this is a scanned PDF, OCR could not read it.'
      const stage = extraction.method === 'error' ? 'pdf_extraction' : 'ocr'
      const statusCode = stage === 'ocr' ? 503 : 422
      await respond(statusCode, buildStructuredError(stage, message, statusCode))
      return
    }

    if (!extraction.hasReadableText) {
      await respond(422, buildStructuredError('text_extraction', 'No readable resume text was found. This PDF may be image-based or password-protected.', 422))
      return
    }

    const jobs = vectorStore.jobs.length > 0 ? vectorStore.jobs.map((entry) => entry.metadata) : publicJobs
    let analysis

    try {
      analysis = await analyzeResumeDocument(extraction.text, jobs)
    } catch (aiError) {
      console.error('[resume-analysis] AI analysis failed', {
        message: aiError.message,
        stack: aiError.stack,
      })

      await respond(500, buildStructuredError('match_calculation', 'The resume was read, but job matching could not be calculated.', 500))
      return
    }

    const resumePreview = buildResumeExtractionPreview(extraction.text)
    const processingMessage = extraction.isFallback ? getUserFriendlyErrorMessage('OCR_REQUIRED') : 'Resume successfully read'

    latestResumeAnalysis = {
      ...analysis,
      resumePreview,
      processingMessage,
      extractionMethod: extraction.method,
    }

    let vectorMatches
    try {
      const query = analysis.resumeProfile.skills.join(' ')
      vectorMatches = await semanticRetrieve(query, vectorStore.jobs, 3)
    } catch (ragError) {
      console.error('[resume-analysis] RAG processing failed', {
        message: ragError.message,
        stack: ragError.stack,
      })

      vectorMatches = []
    }

    await respond(200, {
      success: true,
      ...analysis,
      resumePreview,
      processingMessage,
      extractionMethod: extraction.method,
      vectorMatches,
      document: {
        name: req.file.originalname,
        size: req.file.size,
      },
    })
  } catch (error) {
    console.error('[resume-analysis] request failed', {
      stage: 'response_generation',
      message: error.message,
      stack: error.stack,
    })

    await respond(500, buildStructuredError('response_generation', 'The resume was received, but the analysis response could not be prepared. Check the backend log for the request details.', 500))
  } finally {
    await cleanupUploadedFile(req)
  }
})

app.get('/api/dashboard', async (req, res) => {
  if (!latestResumeAnalysis) {
    const jobs = vectorStore.jobs.length > 0 ? vectorStore.jobs.map((entry) => entry.metadata) : publicJobs
    const fallbackText = [
      'Senior product leader with experience in roadmap planning, customer discovery, operations, stakeholder management, and analytics.',
      'Built data workflows using PySpark, Spark SQL, Delta tables, and orchestration systems to improve reporting and operational visibility.',
      'Led cross functional product work with engineering, design, and GTM teams.',
    ].join(' ')

    const fallbackAnalysis = await analyzeResumeDocument(fallbackText, jobs)
    res.json({
      ...fallbackAnalysis,
      processingMessage: 'No resume has been uploaded. This is a sample analysis.',
      resumePreview: {
        name: 'Not detected',
        education: 'Not detected',
        skillsDetected: 'Not detected',
        experienceDetected: 'Not detected',
        projectsDetected: 'Not detected',
        certificationsDetected: 'Not detected',
      },
      fromSeed: true,
    })
    return
  }

  res.json(latestResumeAnalysis)
})

app.post('/api/jobs/ingest', async (req, res) => {
  const jobs = Array.isArray(req.body) ? req.body : []

  if (!jobs.length) {
    res.status(400).json({ message: 'No jobs were provided.' })
    return
  }

  const ingested = await ingestJobs(jobs)
  res.json({ count: ingested.length, jobs: ingested.map((entry) => entry.metadata) })
})

if (config.nodeEnv === 'production') {
  app.use(express.static(distDir, { index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path === '/api' || req.path.startsWith('/api/') || req.path === '/health' || req.path.startsWith('/health/')) {
      return next()
    }

    res.sendFile(distIndexPath, (error) => {
      if (error) next(error)
    })
  })
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const isSizeLimit = error.code === 'LIMIT_FILE_SIZE'
    const statusCode = isSizeLimit ? 413 : 400
    const message = isSizeLimit
      ? `The PDF exceeds the server upload limit of ${config.resumeMaxFileSizeMb} MB.`
      : 'The upload could not be accepted. Please submit one PDF resume.'
    console.error('[upload] rejected', { code: error.code, message: error.message })
    res.status(statusCode).json(buildStructuredError('file_upload', message, statusCode))
    return
  }

  console.error('[server] unhandled request error', { message: error.message, stack: error.stack })
  res.status(500).json(buildStructuredError('request', 'The server could not process this request. Check the backend log for details.', 500))
})

await bootstrapJobs()

app.listen(config.port, config.host, () => {
  console.log(`CareerMatch AI backend listening on ${config.host}:${config.port} (${config.nodeEnv})`)
})
