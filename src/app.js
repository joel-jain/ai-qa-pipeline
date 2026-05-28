function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenSet(value) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function overlapScore(expected, actual) {
  const expectedTokens = tokenSet(expected);
  const actualTokens = tokenSet(actual);
  if (expectedTokens.size === 0) {
    return 0;
  }

  let matched = 0;
  for (const token of expectedTokens) {
    if (actualTokens.has(token)) {
      matched += 1;
    }
  }
  return matched / expectedTokens.size;
}

function evaluateAnswer({ question, expected, actual, threshold = 0.7 }) {
  if (!question || !expected) {
    throw new Error("question and expected are required");
  }

  const exactMatch = normalize(expected) === normalize(actual);
  const score = exactMatch ? 1 : overlapScore(expected, actual);
  return {
    question,
    passed: score >= threshold,
    score: Number(score.toFixed(2))
  };
}

function runSample() {
  const result = evaluateAnswer({
    question: "What is the capital of France?",
    expected: "Paris",
    actual: "Paris"
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  runSample();
}

module.exports = {
  evaluateAnswer,
  normalize,
  overlapScore
};
