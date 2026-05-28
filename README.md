# ai-qa-pipeline

Minimal production-ready Node.js QA pipeline with Jest tests, Groq-driven PR analysis, and automated PR comments via GitHub Actions.

## Stack

- Node.js 20
- Jest
- GitHub Actions
- Groq API via OpenAI-compatible SDK

## Project Structure

```text
.
├── .github/workflows/ai-qa.yml
├── scripts/ai-review.js
├── src/app.js
├── tests/app.test.js
└── package.json
```

## Setup

```bash
npm install
```

## Local Usage

Run tests:

```bash
npm test
```

Run AI review script locally:

```bash
set GROQ_API_KEY=your_key_here
set GROQ_MODEL=llama-3.3-70b-versatile
set PR_TITLE=Example PR
set PR_BODY=This is a sample PR description.
set CHANGED_FILES=- src/app.js
set TEST_STATUS=failure
npm run ai:review
```

PowerShell:

```powershell
$env:GROQ_API_KEY="your_key_here"
$env:GROQ_MODEL="llama-3.3-70b-versatile"
$env:PR_TITLE="Example PR"
$env:PR_BODY="This is a sample PR description."
$env:CHANGED_FILES="- src/app.js"
$env:TEST_STATUS="failure"
npm run ai:review
```

## GitHub Actions Configuration

Set repository secret:

- `GROQ_API_KEY`

Optional repository variable:

- `GROQ_MODEL` (default in script: `llama-3.3-70b-versatile`)

The workflow runs on pull requests, executes Jest, generates AI QA analysis, and upserts a bot comment on the PR.

## Notes

- `tests/app.test.js` includes one intentional failing test (`sample failing test`) to validate CI failure behavior.
