function setCorsHeaders(req, res, allowedOrigin) {
  if (!allowedOrigin) {
    return;
  }

  const requestOrigin = req.headers.origin;
  if (requestOrigin && requestOrigin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function unauthorized(res, message) {
  return res.status(401).json({ ok: false, error: message || "Unauthorized" });
}

function parseAllowedUsernames(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return "";
  return header.slice(prefix.length).trim();
}

async function fetchGitLabJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  setCorsHeaders(req, res, allowedOrigin);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (allowedOrigin) {
    const requestOrigin = req.headers.origin;
    if (!requestOrigin || requestOrigin !== allowedOrigin) {
      return unauthorized(res, "Origin not allowed");
    }
  }

  if (!process.env.GITLAB_PROJECT_ID || !process.env.GITLAB_TRIGGER_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Server is missing required environment variables",
    });
  }

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) {
    return unauthorized(res, "Missing Bearer token");
  }

  const gitlabHost = process.env.GITLAB_HOST || "gitlab.com";
  const userCheckUrl = `https://${gitlabHost}/api/v4/user`;
  const userCheck = await fetchGitLabJson(userCheckUrl, bearerToken);
  if (!userCheck.response.ok || !userCheck.data || !userCheck.data.username) {
    return unauthorized(res, "Invalid or expired GitLab access token");
  }

  const allowedUsernames = parseAllowedUsernames(process.env.ALLOWED_GITLAB_USERNAMES);
  const username = String(userCheck.data.username).toLowerCase();
  if (allowedUsernames.length > 0 && !allowedUsernames.includes(username)) {
    return unauthorized(res, "GitLab user is not allowed to trigger pipelines");
  }

  const authProjectId = process.env.GITLAB_AUTH_PROJECT_ID || process.env.GITLAB_PROJECT_ID;
  if (authProjectId) {
    const projectCheckUrl = `https://${gitlabHost}/api/v4/projects/${encodeURIComponent(authProjectId)}`;
    const projectCheck = await fetchGitLabJson(projectCheckUrl, bearerToken);
    if (!projectCheck.response.ok) {
      return unauthorized(res, "GitLab user has no access to required project");
    }
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const ref = body.ref || process.env.GITLAB_REF || "main";
  const inputVariables = body.variables && typeof body.variables === "object" ? body.variables : {};

  const form = new URLSearchParams();
  form.set("token", process.env.GITLAB_TRIGGER_TOKEN);
  form.set("ref", ref);

  for (const [key, value] of Object.entries(inputVariables)) {
    form.set(`variables[${key}]`, String(value));
  }

  const url = `https://${gitlabHost}/api/v4/projects/${encodeURIComponent(
    process.env.GITLAB_PROJECT_ID
  )}/trigger/pipeline`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: "Failed to trigger GitLab pipeline",
        details: data,
      });
    }

    return res.status(200).json({
      ok: true,
      triggeredBy: userCheck.data.username,
      pipelineId: data.id,
      pipelineUrl: data.web_url,
      ref: data.ref,
      status: data.status,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Unexpected error while calling GitLab",
      details: error && error.message ? error.message : String(error),
    });
  }
}
