import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import Tesseract from 'tesseract.js'
import OpenAI from 'openai'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'

const standardFontDataUrl = `${fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replace(/\\/g, '/')}/`
const openai = config.openAiApiKey
  ? new OpenAI({ apiKey: config.openAiApiKey, timeout: 15000, maxRetries: 1 })
  : null
let openAiEmbeddingsEnabled = Boolean(openai)

const skillConcepts = [
  { name: 'Python', labels: ['python'] },
  { name: 'SQL', labels: ['sql', 'spark sql'] },
  { name: 'PySpark', labels: ['pyspark', 'spark'] },
  { name: 'Azure', labels: ['azure', 'microsoft azure'] },
  { name: 'Databricks', labels: ['databricks'] },
  { name: 'Apache Airflow', labels: ['apache airflow', 'airflow'] },
  { name: 'Kafka', labels: ['kafka', 'apache kafka'] },
  { name: 'Delta Lake', labels: ['delta lake', 'delta table', 'delta tables'] },
  { name: 'ETL', labels: ['etl', 'extract transform load'] },
  { name: 'Data Engineering', labels: ['data engineering', 'data pipeline', 'warehouse', 'lakehouse', 'dbt'] },
  { name: 'Product Management', labels: ['product management', 'product strategy', 'roadmap', 'roadmapping', 'customer research', 'stakeholder management', 'go to market', 'requirements gathering', 'pricing', 'user research', 'launch planning'] },
  { name: 'Operations', labels: ['operations', 'process improvement', 'workflow optimization', 'ops', 'kpi', 'metrics', 'resource planning', 'dashboarding', 'business process', 'planning cadence', 'cross functional'] },
  { name: 'Analytics', labels: ['analytics', 'dashboard', 'power bi', 'tableau', 'a/b testing', 'experimentation', 'kpis', 'forecasting', 'insights', 'visualization'] },
  { name: 'Leadership', labels: ['leadership', 'mentoring', 'team leadership', 'stakeholder alignment', 'executive communication', 'cross functional leadership', 'people management'] },
  { name: 'Customer Success', labels: ['customer success', 'account management', 'retention', 'renewals', 'onboarding', 'health scoring', 'cs'] },
  { name: 'Machine Learning', labels: ['machine learning', 'ml', 'model training', 'feature engineering', 'llm', 'recommendation systems', 'classification', 'predictive analytics'] },
]

export const vectorStore = {
  jobs: [],
  resumes: [],
}

export function getEmbeddingProviderStatus() {
  return {
    configured: Boolean(openai),
    available: true,
    provider: openAiEmbeddingsEnabled ? 'openai' : 'local-concept-vectors',
    usingFallback: !openAiEmbeddingsEnabled,
  }
}

export function getUserFriendlyErrorMessage(code = 'UNKNOWN_ERROR') {
  const messages = {
    INVALID_FILE_TYPE: 'Please upload a PDF resume.',
    NO_READABLE_TEXT: "We couldn't find readable text in this PDF. It may be heavily scanned or image-based.",
    OCR_REQUIRED: 'Your resume appears to be image-based. We\'re extracting the text now.',
    AI_SERVICE_UNAVAILABLE: 'We extracted your resume successfully, but the AI analysis service is temporarily unavailable. Please try again.',
  }

  return messages[code] || `Resume processing failed during ${String(code).toLowerCase().replaceAll('_', ' ')}.`
}

export function normalizeExtractedText(value = '') {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\r/g, '')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/-\s*\n\s*/g, '')
    .trim()
}

export function buildResumeExtractionPreview(text = '') {
  const normalizedText = String(text || '')
  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const sections = extractResumeSections(normalizedText)

  const nameMatch = normalizedText.match(/(?:^|\n)\s*(?:Name\s*[:-]?\s*)?([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,2})\s*(?:\n|$)/)
  const name = nameMatch ? nameMatch[1].trim() : 'Not detected'

  const education = (() => {
    if (sections.education) {
      return normalizeExtractedText(sections.education).slice(0, 160)
    }

    const degreeLine = lines.find((line) => /(?:B\.S\.?|B\.A\.?|M\.S\.?|M\.A\.?|MBA|MS|BA|Bachelor|Master|PhD|Diploma|Certificate)/i.test(line))
    return degreeLine ? normalizeExtractedText(degreeLine).slice(0, 160) : 'Not detected'
  })()

  const skills = extractSkills(normalizedText)
  const skillsDetected = skills.length ? skills.join(', ') : 'Not detected'

  const experienceSection = (() => {
    return sections.experience ? normalizeExtractedText(sections.experience).slice(0, 180) : 'Not detected'
  })()

  const projects = (() => {
    return sections.projects ? normalizeExtractedText(sections.projects).slice(0, 180) : 'Not detected'
  })()

  const certifications = (() => {
    return sections.certifications ? normalizeExtractedText(sections.certifications).slice(0, 180) : 'Not detected'
  })()

  return {
    name,
    education,
    skillsDetected,
    experienceDetected: experienceSection === 'Not detected' ? 'Not detected' : experienceSection,
    projectsDetected: projects === 'Not detected' ? 'Not detected' : projects,
    certificationsDetected: certifications === 'Not detected' ? 'Not detected' : certifications,
    extractedLineCount: lines.length,
  }
}

export function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countMatches(text, phrase) {
  const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  const pattern = new RegExp(`(?:^|\\s)${escapedPhrase}(?=$|\\s)`, 'gi')
  return (text.match(pattern) || []).length
}

export async function generateEmbedding(text) {
  if (openai && openAiEmbeddingsEnabled) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: String(text).slice(0, 8000),
      })

      return response.data[0].embedding
    } catch (error) {
      openAiEmbeddingsEnabled = false
      console.error('[resume-pipeline] OpenAI embeddings unavailable; switching to local skill vectors', {
        message: error.message,
        status: error.status,
      })

      vectorStore.jobs.forEach((entry) => {
        entry.embedding = buildLocalEmbedding(entry.text)
      })
    }
  }

  return buildLocalEmbedding(text)
}

function buildLocalEmbedding(text) {
  const normalizedText = normalizeText(text)
  return skillConcepts.map((concept) => {
    const score = concept.labels.reduce((total, label) => total + countMatches(normalizedText, normalizeText(label)), 0)
    return score > 0 ? 1 + Math.min(score, 5) * 0.35 : 0
  })
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0
  }

  const dotProduct = a.reduce((total, current, index) => total + current * b[index], 0)
  const magnitudeA = Math.sqrt(a.reduce((total, current) => total + current * current, 0))
  const magnitudeB = Math.sqrt(b.reduce((total, current) => total + current * current, 0))

  if (!magnitudeA || !magnitudeB) {
    return 0
  }

  return dotProduct / (magnitudeA * magnitudeB)
}

export function chunkText(text, maxChunkSize = 500) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return []
  }

  const paragraphs = normalized.split(/(?<=[.!?])\s+/)
  const chunks = []
  let current = ''

  paragraphs.forEach((paragraph) => {
    if ((current + paragraph).trim().length <= maxChunkSize) {
      current = `${current} ${paragraph}`.trim()
      return
    }

    if (current) {
      chunks.push(current)
    }

    const splitParagraphs = paragraph.match(new RegExp(`.{1,${maxChunkSize}}`, 'g')) || [paragraph]
    splitParagraphs.forEach((part) => {
      if (part.trim()) {
        chunks.push(part.trim())
      }
    })
    current = ''
  })

  if (current) {
    chunks.push(current)
  }

  return chunks.filter(Boolean)
}

export function extractResumeSections(text) {
  const lines = String(text || '').split(/\n+/)
  const sections = {
    summary: '',
    experience: '',
    projects: '',
    skills: '',
    education: '',
    certifications: '',
  }

  let currentKey = 'summary'

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    const match = trimmed.match(/^([^:]{2,50})(?::\s*(.*))?$/)
    const heading = match?.[1].trim().toLowerCase().replace(/[\s.-]+$/, '').replace(/\s+/g, ' ')
    const sectionByHeading = {
      summary: /^(professional summary|summary|profile|about(?: me)?|overview|objective)$/,
      experience: /^(work experience|experience|professional experience|employment history|work history|professional journey|career history|professional background|internships?)$/,
      projects: /^(projects?|selected projects|project work|selected work|portfolio)$/,
      skills: /^(skills|technical skills|technical expertise|areas of expertise|core competencies|competencies|tools|capabilities|tech stack)$/,
      education: /^(education|academic background|academics|qualifications?)$/,
      certifications: /^(certifications?|licenses|awards)$/,
    }
    const detectedSection = Object.entries(sectionByHeading).find(([, pattern]) => pattern.test(heading || ''))?.[0]

    if (detectedSection) {
      currentKey = detectedSection
      const inlineContent = match?.[2]?.trim()
      if (inlineContent) {
        sections[currentKey] += ` ${inlineContent}`
      }
      return
    }

    sections[currentKey] += ` ${trimmed}`
  })

  Object.keys(sections).forEach((key) => {
    sections[key] = normalizeExtractedText(sections[key])
  })

  return sections
}

export function extractSkills(text) {
  const normalized = normalizeText(text)
  const matches = skillConcepts
    .filter((concept) =>
      concept.labels.some((label) => {
        const normalizedLabel = normalizeText(label)
        const escapedLabel = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
        return new RegExp(`(?:^|\\s)${escapedLabel}(?=$|\\s)`).test(normalized)
      }),
    )
    .map((concept) => concept.name)

  return [...new Set(matches)]
}

export function buildResumeProfile(text) {
  const sections = extractResumeSections(text)
  const normalizedText = normalizeText(text)
  const skills = extractSkills(text)
  const summary = sections.summary || sections.experience || text.slice(0, 800)
  const inferredDomains = skills.length ? skills : ['General professional experience']
  const projectLines = String(sections.projects || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^(?:project|project name|title)\s+(?:technology|technologies|tools|outcome|impact)\b/i.test(line))
  const projectBullets = projectLines.filter((line) => /^[•*-]/.test(line))
  const projectCount = sections.projects ? Math.max(1, projectBullets.length || projectLines.length) : 0

  return {
    summary: String(summary).replace(/\s+/g, ' ').trim(),
    sections,
    skills,
    inferredDomains,
    projectCount,
    chunkCount: chunkText(text).length,
    textLength: normalizedText.length,
  }
}

export function buildScoreBreakdown(jobSkills, matchedSkills, missingSkills, resumeProfile, overallScore, job) {
  const skillCoverage = jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 0
  const calculateCoverage = (evidenceText) => {
    const evidenceSkills = extractSkills(evidenceText)
    return jobSkills.length
      ? Math.round((jobSkills.filter((skill) => evidenceSkills.includes(skill)).length / jobSkills.length) * 100)
      : null
  }
  const projectCoverage = resumeProfile.sections.projects ? calculateCoverage(resumeProfile.sections.projects) : null
  const experienceCoverage = resumeProfile.sections.experience ? calculateCoverage(resumeProfile.sections.experience) : null
  const educationRequirements = [job.title, job.summary, job.description, ...(job.requirements || [])]
    .join(' ')
    .match(/\b(degree|bachelor|master|ph\.d|phd|doctorate|mba|diploma|education)\b/gi) || []
  const degreeRequired = educationRequirements.length > 0
  const educationCoverage = degreeRequired
    ? resumeProfile.sections.education
      ? /\b(master|ph\.d|phd|doctorate|mba)\b/i.test(educationRequirements.join(' '))
        ? (/\b(master|ph\.d|phd|doctorate|mba)\b/i.test(resumeProfile.sections.education) ? 100 : 0)
        : 100
      : 0
    : null

  return {
    overall: overallScore,
    skillsMatch: skillCoverage,
    experienceMatch: experienceCoverage,
    projectRelevance: projectCoverage,
    educationMatch: educationCoverage,
  }
}

export function buildDynamicMatchNarratives(job, resumeProfile, matchedSkills, missingSkills, jobSkills) {
  const strongMatches = matchedSkills.slice(0, 5)
  const weakAreas = missingSkills.slice(0, 2)
  const importantSkills = jobSkills.slice(0, 10)
  const skillTotal = importantSkills.length
  const matchedCount = matchedSkills.filter((skill) => importantSkills.includes(skill)).length

  const whyThisMatches = strongMatches.length
    ? `Your ${strongMatches.join(', ')} experience closely matches the technical requirements for this role.`
    : 'No matching skills were detected in the resume text for this role yet.'

  const whyNot100 = weakAreas.length
    ? `The resume does not clearly demonstrate ${weakAreas.join(' or ')}. Add evidence only if you have that experience.`
    : 'No gaps were detected in the indexed job skills.'

  const resumeImprovement = strongMatches.length
    ? `Make your demonstrated ${strongMatches[0]} experience easier to find by surfacing its project or outcome.`
    : weakAreas.length
      ? `Consider learning ${weakAreas[0]}; do not list it as a skill until you have relevant experience.`
      : 'Add measurable outcomes to relevant experience where you can support them.'

  return {
    importantSkills,
    strongMatches,
    missingOrWeakerAreas: weakAreas,
    relevantExperience: resumeProfile.sections.experience ? 'Experience detected' : 'Not detected',
    relevantProjects: resumeProfile.projectCount ? `${resumeProfile.projectCount} project${resumeProfile.projectCount > 1 ? 's' : ''}` : 'Not detected',
    skillCount: `${matchedCount} / ${skillTotal}`,
    whyThisMatches,
    whyNot100,
    resumeImprovement,
  }
}

export async function storeVectorDocument(type, document) {
  const textSource = [document.title, document.summary, document.description, document.requirements || [], document.text]
    .flat()
    .filter(Boolean)
    .join(' ')

  const item = {
    id: document.id || `${type}-${Date.now()}`,
    type,
    text: textSource,
    metadata: document,
    embedding: await generateEmbedding(textSource),
  }

  vectorStore[type].push(item)
  return item
}

export async function ingestJobs(jobs) {
  vectorStore.jobs = []

  for (const job of jobs) {
    await storeVectorDocument('jobs', job)
  }

  return vectorStore.jobs
}

export async function semanticRetrieve(queryText, collection, topK = 5) {
  const queryVector = await generateEmbedding(queryText)

  const ranked = collection
    .map((entry) => ({
      ...entry.metadata,
      score: cosineSimilarity(queryVector, entry.embedding),
      matchedText: entry.text,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return ranked
}

function toUint8Array(buffer) {
  if (buffer instanceof Uint8Array) {
    return new Uint8Array(buffer)
  }

  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  }

  return new Uint8Array(buffer)
}

async function loadPdf(buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: toUint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl,
  })
  let pdf

  try {
    pdf = await loadingTask.promise
  } catch (error) {
    await loadingTask.destroy().catch(() => {})
    throw error
  }

  const pageCount = pdf.numPages
  if (pageCount > config.resumeMaxPages) {
    await loadingTask.destroy()
    const error = new Error(`PDF contains ${pageCount} pages; configured limit is ${config.resumeMaxPages}.`)
    error.code = 'PDF_PAGE_LIMIT'
    throw error
  }

  return { pdf, destroy: () => loadingTask.destroy() }
}

async function extractTextWithPdfJs(buffer) {
  const loadedPdf = await loadPdf(buffer)
  try {
    return await extractTextFromPdfDocument(loadedPdf.pdf)
  } finally {
    await loadedPdf.destroy()
  }
}

async function extractTextFromPdfDocument(pdf) {
  const pages = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    const items = content.items
      .filter((item) => 'str' in item && item.str.trim())
      .map((item, order) => ({
        text: item.str.trim(),
        x: Number(item.transform?.[4]) || 0,
        y: Number(item.transform?.[5]) || -order,
        width: Number(item.width) || 0,
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x)
    const rows = []

    items.forEach((item) => {
      const row = rows.at(-1)
      if (row && Math.abs(row.y - item.y) <= 2.5) {
        row.items.push(item)
        return
      }

      rows.push({ y: item.y, items: [item] })
    })

    const columnGaps = []
    rows.forEach((row, rowIndex) => {
      const orderedItems = [...row.items].sort((a, b) => a.x - b.x)
      for (let itemIndex = 1; itemIndex < orderedItems.length; itemIndex += 1) {
        const previousItem = orderedItems[itemIndex - 1]
        const currentItem = orderedItems[itemIndex]
        const gap = currentItem.x - (previousItem.x + previousItem.width)
        if (gap >= 60) {
          columnGaps.push({ boundary: currentItem.x - gap / 2, rowIndex })
        }
      }
    })

    const gapGroups = []
    columnGaps.forEach((gap) => {
      const group = gapGroups.find((candidate) => Math.abs(candidate.boundary - gap.boundary) <= 30)
      if (group) {
        group.rows.add(gap.rowIndex)
        group.boundaries.push(gap.boundary)
      } else {
        gapGroups.push({ boundary: gap.boundary, rows: new Set([gap.rowIndex]), boundaries: [gap.boundary] })
      }
    })

    const repeatedGaps = gapGroups.filter((group) => group.rows.size >= 3)
    let pageText

    if (repeatedGaps.length === 1) {
      const splitX = repeatedGaps[0].boundaries.reduce((total, boundary) => total + boundary, 0) / repeatedGaps[0].boundaries.length
      const spanningLines = []
      const leftColumn = []
      const rightColumn = []

      rows.forEach((row) => {
        const lineParts = { left: [], right: [], spanning: [] }
        row.items.forEach((item) => {
          if (item.x + item.width < splitX) lineParts.left.push(item)
          else if (item.x > splitX) lineParts.right.push(item)
          else lineParts.spanning.push(item)
        })

        const formatLine = (items) => items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ')
        if (lineParts.spanning.length) spanningLines.push(formatLine(lineParts.spanning))
        if (lineParts.left.length) leftColumn.push(formatLine(lineParts.left))
        if (lineParts.right.length) rightColumn.push(formatLine(lineParts.right))
      })

      pageText = [...spanningLines, ...leftColumn, ...rightColumn].join('\n')
    } else {
      pageText = rows
        .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '))
        .join('\n')
    }

    pages.push(pageText)
  }

  return pages.join('\n')
}

async function ocrPdfPages(buffer) {
  const loadedPdf = await loadPdf(buffer)
  try {
    return await recognizePdfPages(loadedPdf.pdf)
  } finally {
    await loadedPdf.destroy()
  }
}

async function recognizePdfPages(pdf) {
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.8 })
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    await page.render({ canvasContext: context, viewport }).promise
    const imageData = canvas.toBuffer('image/png')
    const { data } = await Tesseract.recognize(imageData, 'eng', {
      logger: () => undefined,
    })
    pages.push(data.text || '')
  }

  return pages.join('\n')
}

export async function extractTextFromPdfBuffer(buffer) {
  let extractedText = ''
  let extractionError = null

  try {
    extractedText = normalizeExtractedText(await extractTextWithPdfJs(buffer))
  } catch (error) {
    extractionError = error
  }

  if (extractionError?.code === 'PDF_PAGE_LIMIT') {
    return { text: '', method: 'limit', isFallback: false, hasReadableText: false, error: extractionError }
  }

  if (hasUsefulResumeText(extractedText)) {
    return { text: extractedText, method: 'pdf-text', isFallback: false, hasReadableText: true }
  }

  try {
    const ocrText = normalizeExtractedText(await ocrPdfPages(buffer))
    if (hasUsefulResumeText(ocrText)) {
      return { text: ocrText, method: 'ocr', isFallback: true, hasReadableText: true }
    }

    return {
      text: ocrText.length > extractedText.length ? ocrText : extractedText,
      method: 'none',
      isFallback: false,
      hasReadableText: false,
    }
  } catch (error) {
    const failure = extractionError || error
    console.error('[resume-pipeline] PDF extraction/OCR failed', {
      extractionMessage: extractionError?.message,
      ocrMessage: error.message,
      stack: error.stack,
    })

    return {
      text: extractedText,
      method: extractionError ? 'error' : 'ocr-error',
      isFallback: false,
      hasReadableText: false,
      error: failure,
    }
  }
}

function hasUsefulResumeText(text) {
  const words = String(text || '').match(/[A-Za-z0-9][A-Za-z0-9+#./-]*/g) || []
  const letters = String(text || '').match(/[A-Za-z]/g) || []
  return letters.length >= 40 && words.length >= 7
}

export function getJobKeywordSet(job) {
  const text = String([
    job.title,
    job.summary,
    job.description,
    ...(job.requirements || []),
    ...(job.responsibilities || []),
  ].join(' '))

  return extractSkills(text)
}

export function buildResumeImprovementSuggestions(jobSkills, resumeSkills) {
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill))

  const suggestions = []

  if (resumeSkills.length > 0) {
    suggestions.push({
      title: 'Already demonstrated',
      detail: `Keep evidence of ${resumeSkills.slice(0, 4).join(', ')} tied to the role, project, or outcome where you used them.`,
      focus: 'Demonstrated',
    })
  }

  if (missingSkills.length > 0) {
    suggestions.push({
      title: 'Consider learning',
      detail: `The resume does not demonstrate ${missingSkills.slice(0, 3).join(', ')}. Do not list these as skills unless you have used them; consider learning them if they fit your goals.`,
      focus: 'Learning',
    })
  }

  suggestions.push({
    title: 'Quantify outcomes',
    detail: 'Where you can support the claim, quantify the scale, reliability, or speed improvements from your work.',
    focus: 'Impact',
  })

  return suggestions.slice(0, 3)
}

export function buildMatchExplanation(jobTitle, jobSkills, matchedSkills, missingSkills, resumeSkills) {
  const demonstrated = matchedSkills.length ? matchedSkills.slice(0, 3).join(', ') : 'no indexed job skills'
  const gaps = missingSkills.length ? ` The resume does not clearly demonstrate ${missingSkills.slice(0, 2).join(' or ')}.` : ''
  const resumeEvidence = resumeSkills.length ? 'Resume evidence was found.' : 'No resume skills were detected.'
  return `${resumeEvidence} ${demonstrated} align with ${jobTitle}.${gaps} Add any missing skill only if you have relevant experience.`
}

export async function evaluateResumeAgainstJob(resumeText, job) {
  const resumeProfile = buildResumeProfile(resumeText)
  const jobSkills = getJobKeywordSet(job)
  const matchedSkills = jobSkills.filter((skill) => resumeProfile.skills.includes(skill))
  const missingSkills = jobSkills.filter((skill) => !resumeProfile.skills.includes(skill))

  const resumeEmbedding = await generateEmbedding(`${resumeProfile.summary} ${resumeProfile.skills.join(' ')}`)
  const jobEmbedding = await generateEmbedding(`${job.title} ${job.summary} ${job.description} ${(job.requirements || []).join(' ')}`)
  const semanticScore = cosineSimilarity(resumeEmbedding, jobEmbedding)
  const coverage = jobSkills.length ? matchedSkills.length / jobSkills.length : 0
  const weightedScore = Math.round((semanticScore * 0.6 + coverage * 0.4) * 100)

  const matchNarratives = buildDynamicMatchNarratives(job, resumeProfile, matchedSkills, missingSkills, jobSkills)
  const breakdown = buildScoreBreakdown(jobSkills, matchedSkills, missingSkills, resumeProfile, weightedScore, job)

  return {
    ...job,
    match: weightedScore,
    matchPercentage: weightedScore,
    matchedSkills,
    missingSkills,
    importantSkills: matchNarratives.importantSkills,
    strongMatches: matchNarratives.strongMatches,
    missingOrWeakerAreas: matchNarratives.missingOrWeakerAreas,
    relevantExperience: matchNarratives.relevantExperience,
    relevantProjects: matchNarratives.relevantProjects,
    skillCount: matchNarratives.skillCount,
    whyThisMatches: matchNarratives.whyThisMatches,
    whyNot100: matchNarratives.whyNot100,
    resumeImprovement: matchNarratives.resumeImprovement,
    recommendationReasons: buildResumeImprovementSuggestions(jobSkills, resumeProfile.skills),
    keywordRecommendations: missingSkills.slice(0, 5),
    matchExplanation: buildMatchExplanation(job.title, jobSkills, matchedSkills, missingSkills, resumeProfile.skills),
    breakdown,
    resumeProfile,
  }
}

export async function analyzeResumeDocument(resumeText, jobs) {
  const resumeProfile = buildResumeProfile(resumeText)

  const jobMatches = await Promise.all(
    jobs.map(async (job) => evaluateResumeAgainstJob(resumeText, job)),
  )

  const rankedMatches = [...jobMatches]
    .sort((a, b) => b.matchPercentage - a.matchPercentage)
    .map(({ resumeProfile: _resumeProfile, ...job }) => job)

  const topJob = rankedMatches[0]

  return {
    resumeProfile: {
      skills: resumeProfile.skills,
      inferredDomains: resumeProfile.inferredDomains,
      projectCount: resumeProfile.projectCount,
      chunkCount: resumeProfile.chunkCount,
      textLength: resumeProfile.textLength,
    },
    recommendedJobs: rankedMatches.slice(0, 3),
    allJobMatches: rankedMatches,
    strongestMatch: topJob,
    dashboard: {
      stats: [
        { label: 'Strongest fit', value: `${topJob?.matchPercentage ?? 0}%`, detail: topJob?.title || 'Target role' },
        { label: 'Open matches', value: String(rankedMatches.length), detail: 'Across active roles' },
        { label: 'Skills detected', value: String(resumeProfile.skills.length), detail: 'From extracted resume text' },
        { label: 'Sections detected', value: String(Object.values(resumeProfile.sections).filter(Boolean).length), detail: 'From extracted resume text' },
      ],
      matchSignals: [
        { label: 'Role alignment', value: `${topJob?.matchPercentage ?? 0}%` },
        { label: 'Skill overlap', value: `${Math.round((topJob?.matchedSkills.length || 0) / Math.max(1, topJob?.matchedSkills.length + (topJob?.missingSkills.length || 0)) * 100)}%` },
        { label: 'Experience evidence', value: resumeProfile.sections.experience ? 'Detected' : 'Not detected' },
        { label: 'Project evidence', value: resumeProfile.projectCount ? `${resumeProfile.projectCount} detected` : 'Not detected' },
      ],
      strengths: resumeProfile.skills,
      improvementSuggestions: topJob?.recommendationReasons || [],
      keywordRecommendations: topJob?.keywordRecommendations || [],
    },
  }
}
