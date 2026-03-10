# shine-api

Minimal Vercel serverless API that securely triggers a GitLab CI pipeline.

## What this does

- Exposes `POST /api/trigger-gitlab`
- Keeps GitLab secrets on Vercel (server-side only)
- Optionally restricts requests to a single frontend origin
- Validates GitLab OAuth bearer token before triggering CI

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
  - `Authorization: Bearer <gitlab_oauth_access_token>`

## Example request

```bash
curl -X POST "https://<your-project>.vercel.app/api/trigger-gitlab" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <gitlab_oauth_access_token>" \
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

## Authorization model

- Frontend users authenticate with GitLab OAuth PKCE.
- Frontend calls this endpoint with `Authorization: Bearer ...`.
- Endpoint validates token using `GET /api/v4/user`.
- Endpoint optionally checks:
  - `GITLAB_AUTH_PROJECT_ID` access (defaults to `GITLAB_PROJECT_ID`)
  - `ALLOWED_GITLAB_USERNAMES` allowlist
- Only then it uses server-side `GITLAB_TRIGGER_TOKEN` to start pipeline.