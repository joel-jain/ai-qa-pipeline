const { evaluateAnswer } = require("../src/app");

describe("evaluateAnswer", () => {
  test("passes on exact match", () => {
    const result = evaluateAnswer({
      question: "2 + 2?",
      expected: "4",
      actual: "4"
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  test("sample failing test", () => {
    const result = evaluateAnswer({
      question: "Capital of Germany?",
      expected: "Berlin",
      actual: "Munich"
    });
    expect(result.passed).toBe(true);
  });
});
