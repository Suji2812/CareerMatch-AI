# CareerMatch AI

CareerMatch AI is a React/Vite application with an Express API for resume upload, PDF text extraction, OCR fallback, and job matching.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run server
```

In a second terminal:

```powershell
npm run dev
```

The frontend runs at `http://localhost:5173`. The backend defaults to `http://localhost:4000`. Vite proxies `/api` to the backend during development.

## Deploy to Render

Create one Render **Web Service** from this repository.

- Build Command: `npm install --include=dev && npm run build`
- Start Command: `npm start`
- Environment: `NODE_ENV=production`
- Node: `22.12.0` or newer

No API key or external database is required. Render supplies `PORT`; Express binds to that port on `0.0.0.0`. The production Express process serves `dist`, serves React Router routes through the SPA fallback, and handles `/api` on the same origin. Do not set `VITE_API_BASE_URL` to a localhost URL in Render; production builds use `/api` regardless of that variable.

The free service has ephemeral local storage and the application's job vectors and latest resume analysis are held in memory. Deploys/restarts clear the latest analysis; uploaded PDFs are deleted after each request. No uploaded resume is persisted.

For a local production-mode check in PowerShell, run `npm run build`, then in a separate terminal run `$env:NODE_ENV='production'; npm start`; open the printed service URL. Use `Remove-Item Env:NODE_ENV` to return that terminal to development mode.

## Configuration

See `.env.example`. `OPENAI_API_KEY` is optional and is used for embeddings only. The current application does not call an LLM for analysis. Without the key, it uses a local skill-concept vector and rule-based matching. Job vectors are held in process memory; they are not persisted in a vector database. This means matching remains available locally, but it is not a hosted RAG/LLM service.

`RESUME_MAX_FILE_SIZE_MB` defaults to 50 MB and is constrained to 1-100 MB. `RESUME_MAX_PAGES` defaults to 100 and is constrained to 1-200 pages. Uploads are first spooled to disk and removed after processing. PDF.js currently needs each accepted file in memory for parsing, so these bounds protect server memory and OCR time.

`VITE_API_BASE_URL` defaults to `/api`, which is proxied to `http://localhost:4000` by the Vite development server. Production always uses same-origin `/api` because Express serves both frontend and API.

## API

- `GET /health` (also `GET /api/health`) reports backend, embedding mode, vector store type, and upload limit.
- `GET /health/ai` reports whether optional OpenAI embeddings are configured and whether an LLM is configured.
- `GET /health/vector-db` reports vector-store availability and persistence.
- `POST /api/resume/analyze` accepts `multipart/form-data` with a PDF field named `resume`.
- `GET /api/jobs` and `GET /api/jobs/:jobId` return available job records.
- `GET /api/dashboard` returns the most recent analysis, or a seed dashboard before an upload.

PDF extraction uses PDF.js. If selectable text is insufficient, pages are rendered with `@napi-rs/canvas` and passed to Tesseract.js OCR. Tesseract downloads English trained data over HTTPS on first OCR use and caches it on the service filesystem; this requires outbound network access and the cache is ephemeral on Render's free instance. The API returns structured errors with a `stage` field for upload, validation, extraction, OCR, analysis, and response failures.

## Checks

```powershell
npm run build
npm run lint
node --test server/services/resumeMatcher.test.js
```