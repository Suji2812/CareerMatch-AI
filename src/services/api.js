const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

class ApiError extends Error {
  constructor(message, { stage = 'request', status = 0 } = {}) {
    super(message)
    this.name = 'ApiError'
    this.stage = stage
    this.status = status
  }
}

async function handleResponse(response) {
  const body = await response.text()
  let payload = null

  try {
    payload = body ? JSON.parse(body) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const isGatewayFailure = response.status === 502 || response.status === 504
    const message = payload?.message || (isGatewayFailure
      ? 'The backend is unavailable. Start the backend and try again.'
      : `The request failed with status ${response.status}.`)
    throw new ApiError(message, { stage: payload?.stage || 'http_request', status: response.status })
  }

  if (payload === null) {
    throw new ApiError('The backend returned an invalid response.', { stage: 'response_validation', status: response.status })
  }

  return payload
}

async function request(path, options) {
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options)
  } catch {
    throw new ApiError('The backend is unavailable. Start the backend and try again.', { stage: 'backend_unavailable' })
  }

  return handleResponse(response)
}

export async function analyzeResume(formData) {
  return request('/resume/analyze', {
    method: 'POST',
    body: formData,
  })
}

export async function getJobs() {
  return request('/jobs')
}

export async function getJobById(jobId) {
  return request(`/jobs/${jobId}`)
}

export async function getDashboard() {
  return request('/dashboard')
}
