# shine-api

Minimal Vercel serverless API that securely triggers a GitLab CI pipeline.

## What this does

- Exposes `POST /api/trigger-gitlab`
- Keeps GitLab secrets on Vercel (server-side only)
- Optionally restricts requests to a single frontend origin
- Optionally requires a request shared secret

## Files

- `api/trigger-gitlab.js` - Vercel Function endpoint
- `vercel.json` - Vercel function/runtime config
- `.env.example` - required environment variables

## Deploy

1. Install Vercel CLI:
   - `npm i -g vercel`
2. In this folder, run:
   - `vercel`
3. In Vercel project settings, add env vars from `.env.example`
4. Redeploy:
   - `vercel --prod`

## Endpoint

- URL: `https://<your-project>.vercel.app/api/trigger-gitlab`
- Method: `POST`
- Headers:
  - `Content-Type: application/json`
  - `X-Trigger-Secret: <CLIENT_TRIGGER_SECRET>` (only if configured)

## Example request

```bash
curl -X POST "https://<your-project>.vercel.app/api/trigger-gitlab" \
  -H "Content-Type: application/json" \
  -H "X-Trigger-Secret: <CLIENT_TRIGGER_SECRET>" \
  -d '{"variables":{"DEPLOY_ENV":"staging"}}'
```

Body fields are optional:

- `ref` - branch/tag to run (defaults to `GITLAB_REF`)
- `variables` - object of `CI/CD variables` to send to pipeline

## GitLab setup

In your GitLab project:

1. Go to `Settings -> CI/CD -> Pipeline triggers`
2. Create a trigger token
3. Use:
   - `GITLAB_TRIGGER_TOKEN` = trigger token
   - `GITLAB_PROJECT_ID` = numeric project ID
   - `GITLAB_REF` = default branch (for example `main`)