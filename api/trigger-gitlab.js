function setCorsHeaders(req, res, allowedOrigin) {
  if (!allowedOrigin) {
    return;
  }

  const requestOrigin = req.headers.origin;
  if (requestOrigin && requestOrigin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Trigger-Secret");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function unauthorized(res, message) {
  return res.status(401).json({ ok: false, error: message || "Unauthorized" });
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

  const configuredClientSecret = process.env.CLIENT_TRIGGER_SECRET;
  if (configuredClientSecret) {
    const providedSecret = req.headers["x-trigger-secret"];
    if (!providedSecret || providedSecret !== configuredClientSecret) {
      return unauthorized(res, "Invalid trigger secret");
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

  const gitlabHost = process.env.GITLAB_HOST || "gitlab.com";
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
