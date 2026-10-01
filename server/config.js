import dotenv from 'dotenv'

dotenv.config()

const requestedUploadLimitMb = Number(process.env.RESUME_MAX_FILE_SIZE_MB || 50)
const resumeMaxFileSizeMb = Number.isFinite(requestedUploadLimitMb)
  ? Math.min(100, Math.max(1, requestedUploadLimitMb))
  : 50
const requestedPageLimit = Number(process.env.RESUME_MAX_PAGES || 100)
const resumeMaxPages = Number.isFinite(requestedPageLimit)
  ? Math.min(200, Math.max(1, Math.floor(requestedPageLimit)))
  : 100

export const config = {
  port: Number(process.env.PORT || 4000),
  host: '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  resumeMaxFileSizeMb,
  resumeMaxFileSizeBytes: resumeMaxFileSizeMb * 1024 * 1024,
  resumeMaxPages,
}
