const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const BOT_MARKER = "<!-- ai-qa-pipeline -->";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

function env(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeBlock(value, maxLength = 12000) {
  const normalized = String(value || "").replace(/\0/g, "");
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}\n...truncated...`
    : normalized;
}

function readTestResults() {
  const reportPath = path.resolve(process.cwd(), "test-results.json");
  if (!fs.existsSync(reportPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    return null;
  }
}

function extractFailures(results) {
  if (!results || !Array.isArray(results.testResults)) {
    return [];
  }
  return results.testResults
    .flatMap((suite) =>
      Array.isArray(suite.assertionResults) ? suite.assertionResults : []
    )
    .filter((test) => test.status === "failed")
    .map((test) => {
      const message = Array.isArray(test.failureMessages)
        ? test.failureMessages.join("\n")
        : "No failure message available.";
      return `Test: ${test.fullName || "unknown"}\nError:\n${sanitizeBlock(message, 5000)}`;
    });
}

function buildPrompt(context, failures) {
  return [
    "You are a senior JavaScript engineer reviewing CI test failures for a Node.js project.",
    "Return concise markdown with these headings exactly:",
    "## Root Cause",
    "## Suggested Fixes",
    "## Example Code Changes",
    "Focus on actionable, implementation-level guidance.",
    "",
    `PR Title: ${context.prTitle || "N/A"}`,
    `PR Body: ${context.prBody || "N/A"}`,
    `Changed Files:\n${context.changedFiles || "N/A"}`,
    `Test Status: ${context.testStatus || "unknown"}`,
    "",
    "Failures:",
    failures.join("\n\n---\n\n")
  ].join("\n");
}

function fallbackComment(context, reason) {
  const hasFailures = context.failedCount > 0;
  return [
    BOT_MARKER,
    "## Groq AI QA Review",
    "",
    "## Root Cause",
    `Groq analysis unavailable: ${reason}.`,
    "",
    "## Suggested Fixes",
    hasFailures
      ? "- Inspect `test-results.json` and fix failing assertions.\n- Re-run CI after applying changes."
      : "- No failing tests detected.",
    "",
    "## Example Code Changes",
    hasFailures
      ? "- Update implementation or expectations to match intended behavior."
      : "- No code change needed for test stability."
  ].join("\n");
}

function successNoFailureComment(context) {
  return [
    BOT_MARKER,
    "## Groq AI QA Review",
    "",
    "## Root Cause",
    "No failing Jest tests were detected in this run.",
    "",
    "## Suggested Fixes",
    "- Keep current test coverage baseline.",
    "",
    "## Example Code Changes",
    "- None required."
  ].join("\n");
}

async function generateReview(context, failures) {
  const apiKey = env("GROQ_API_KEY");
  if (!apiKey) {
    return fallbackComment(context, "missing GROQ_API_KEY");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: env("GROQ_BASE_URL", DEFAULT_BASE_URL)
  });
  const model = env("GROQ_MODEL", DEFAULT_MODEL);
  const prompt = buildPrompt(context, failures);

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a senior JavaScript engineer reviewing CI test failures."
        },
        { role: "user", content: prompt }
      ]
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      return fallbackComment(context, "empty response from model");
    }

    return [BOT_MARKER, "## Groq AI QA Review", "", text].join("\n");
  } catch (error) {
    return fallbackComment(context, error.message || "unknown error");
  }
}

async function main() {
  const results = readTestResults();
  const failures = extractFailures(results);
  const context = {
    prTitle: sanitizeBlock(env("PR_TITLE", "N/A"), 1000),
    prBody: sanitizeBlock(env("PR_BODY", "N/A"), 4000),
    changedFiles: sanitizeBlock(env("CHANGED_FILES", "N/A"), 4000),
    testStatus: env("TEST_STATUS", "unknown"),
    failedCount: failures.length
  };

  const review =
    failures.length === 0
      ? successNoFailureComment(context)
      : await generateReview(context, failures);

  fs.writeFileSync(path.resolve(process.cwd(), "ai-analysis.md"), `${review}\n`);
  process.stdout.write(`${review}\n`);
}

main().catch((error) => {
  process.stderr.write(`Failed to generate AI review: ${error.message}\n`);
  process.exitCode = 1;
});
