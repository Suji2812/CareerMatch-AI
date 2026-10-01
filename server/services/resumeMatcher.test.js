import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  buildResumeProfile,
  buildScoreBreakdown,
  buildResumeExtractionPreview,
  analyzeResumeDocument,
  extractResumeSections,
  extractSkills,
  extractTextFromPdfBuffer,
  getUserFriendlyErrorMessage,
  normalizeExtractedText,
} from './resumeMatcher.js'

test('buildResumeExtractionPreview infers fields from real resume content', () => {
  const preview = buildResumeExtractionPreview(`
    Alex Chen
    PROFESSIONAL JOURNEY
    Built real-time data pipelines with Python, SQL, and PySpark.
    TECHNICAL EXPERTISE
    Python, SQL, PySpark, Databricks, Azure
    ACADEMIC BACKGROUND
    B.S. in Computer Science
  `)

  assert.equal(preview.name, 'Alex Chen')
  assert.equal(preview.education, 'B.S. in Computer Science')
  assert.match(preview.skillsDetected, /Python|SQL|PySpark|Databricks|Azure/)
  assert.match(preview.experienceDetected, /Python|PySpark|data pipelines/i)
  assert.equal(preview.projectsDetected, 'Not detected')
  assert.equal(preview.certificationsDetected, 'Not detected')
})

test('getUserFriendlyErrorMessage returns actionable messages for known upload problems', () => {
  assert.equal(getUserFriendlyErrorMessage('INVALID_FILE_TYPE'), 'Please upload a PDF resume.')
  assert.equal(getUserFriendlyErrorMessage('NO_READABLE_TEXT'), "We couldn't find readable text in this PDF. It may be heavily scanned or image-based.")
  assert.equal(getUserFriendlyErrorMessage('OCR_REQUIRED'), 'Your resume appears to be image-based. We\'re extracting the text now.')
  assert.equal(getUserFriendlyErrorMessage('AI_SERVICE_UNAVAILABLE'), 'We extracted your resume successfully, but the AI analysis service is temporarily unavailable. Please try again.')
})

test('section extraction preserves layout and recognizes alternate section names', () => {
  const normalized = normalizeExtractedText('Technical Expertise: Python, SQL\nProfessional Journey\nBuilt data pipelines.\nAcademic Background: B.S. Computer Science')
  const sections = extractResumeSections(normalized)

  assert.equal(sections.skills, 'Python, SQL')
  assert.equal(sections.experience, 'Built data pipelines.')
  assert.equal(sections.education, 'B.S. Computer Science')
})

test('skill detection matches whole phrases instead of substrings', () => {
  const skills = extractSkills('Analytics reporting with technical skills and MySQL experience.')

  assert.ok(skills.includes('Analytics'))
  assert.ok(!skills.includes('Customer Success'))
  assert.ok(!skills.includes('SQL'))
})

test('a real text PDF extracts readable content and preserves line boundaries', async () => {
  const pdf = await readFile(new URL('../../sample_resume.pdf', import.meta.url))
  const extraction = await extractTextFromPdfBuffer(pdf)

  assert.equal(extraction.method, 'pdf-text')
  assert.equal(extraction.hasReadableText, true)
  assert.match(extraction.text, /Technical Skills: Python, SQL/)
  assert.match(extraction.text, /\nExperience:/)
})

test('missing resume sections remain absent instead of inventing projects', () => {
  const profile = buildResumeProfile('Taylor Reed\nTECHNICAL EXPERTISE: Python, SQL\nPROFESSIONAL JOURNEY\nBuilt reliable analytics workflows.')

  assert.equal(profile.sections.skills, 'Python, SQL')
  assert.match(profile.sections.experience, /Built reliable analytics workflows/)
  assert.equal(profile.sections.education, '')
  assert.equal(profile.projectCount, 0)
})

test('match breakdown reports only evidence-supported section scores', () => {
  const profile = buildResumeProfile('TECHNICAL EXPERTISE: Python, SQL\nACADEMIC BACKGROUND: Bachelor of Science')
  const breakdown = buildScoreBreakdown(['Python', 'SQL'], ['Python'], ['SQL'], profile, 50, { requirements: [] })
  const degreeRequired = buildScoreBreakdown(['Python'], ['Python'], [], profile, 100, { requirements: ['Bachelor degree required'] })

  assert.equal(breakdown.skillsMatch, 50)
  assert.equal(breakdown.experienceMatch, null)
  assert.equal(breakdown.projectRelevance, null)
  assert.equal(breakdown.educationMatch, null)
  assert.equal(degreeRequired.educationMatch, 100)
})

test('analysis results do not return raw resume text or parsed section contents', async () => {
  const privateResume = 'Alex Morgan\nEmail: private@example.test\nTECHNICAL EXPERTISE: Python, SQL'
  const job = { id: 'test-role', title: 'Data Engineer', summary: '', description: '', requirements: ['Python'] }
  const result = await analyzeResumeDocument(privateResume, [job])

  assert.equal(result.resumeProfile.rawText, undefined)
  assert.equal(result.resumeProfile.sections, undefined)
  assert.doesNotMatch(JSON.stringify(result), /private@example\.test/)
})
