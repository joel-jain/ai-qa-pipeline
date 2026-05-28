const Anthropic = require("@anthropic-ai/sdk");

const BOT_MARKER = "<!-- ai-qa-pipeline -->";

function env(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeBlock(value, maxLength = 8000) {
  const normalized = String(value || "").replace(/\0/g, "");
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}\n...truncated...`
    : normalized;
}

function buildPrompt(context) {
  return [
    "You are reviewing pull request quality signals for a Node.js QA pipeline.",
    "Respond with concise markdown under these headings only:",
    "## Risk Summary",
    "## Test Signal",
    "## Recommended Actions",
    "Keep output brief and actionable.",
    "",
    `PR Title: ${context.prTitle || "N/A"}`,
    `PR Body: ${context.prBody || "N/A"}`,
    `Changed Files:\n${context.changedFiles || "N/A"}`,
    `Test Status: ${context.testStatus || "unknown"}`
  ].join("\n");
}

function fallbackComment(context, reason) {
  return [
    BOT_MARKER,
    "## AI QA Review",
    "",
    "## Risk Summary",
    `Anthropic analysis unavailable: ${reason}.`,
    "",
    "## Test Signal",
    `Jest status: ${context.testStatus || "unknown"}.`,
    "",
    "## Recommended Actions",
    "- Verify failing tests are intentional before merge.",
    "- Re-run CI after addressing failures."
  ].join("\n");
}

async function generateReview(context) {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return fallbackComment(context, "missing ANTHROPIC_API_KEY");
  }

  const anthropic = new Anthropic({ apiKey });
  const model = env("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest");
  const prompt = buildPrompt(context);

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 700,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    });

    const text = (response.content || [])
      .filter((item) => item && item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (!text) {
      return fallbackComment(context, "empty response from model");
    }

    return [BOT_MARKER, "## AI QA Review", "", text].join("\n");
  } catch (error) {
    return fallbackComment(context, error.message || "unknown error");
  }
}

async function main() {
  const context = {
    prTitle: sanitizeBlock(env("PR_TITLE", "N/A"), 1000),
    prBody: sanitizeBlock(env("PR_BODY", "N/A"), 4000),
    changedFiles: sanitizeBlock(env("CHANGED_FILES", "N/A"), 4000),
    testStatus: env("TEST_STATUS", "unknown")
  };

  const review = await generateReview(context);
  process.stdout.write(`${review}\n`);
}

main().catch((error) => {
  process.stderr.write(`Failed to generate AI review: ${error.message}\n`);
  process.exitCode = 1;
});
