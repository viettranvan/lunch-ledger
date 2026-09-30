const allowedExpression = /^[\d\s.,()+*/-]*$/;
const tokenPattern = /\d+(?:\.\d*)?|\.\d+|[()+*/-]/g;

/** Evaluate a basic arithmetic expression without executing user-provided code. */
export function evaluateArithmeticExpression(expression: string): number | null {
  const normalized = expression.replace(/,/g, ".");
  if (!allowedExpression.test(normalized)) return null;

  const source = normalized.replace(/\s/g, "");
  if (!source) return null;

  const tokens = source.match(tokenPattern) ?? [];
  if (tokens.join("") !== source) return null;

  let position = 0;

  function parseExpression(): number {
    let value = parseTerm();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const next = parseTerm();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const next = parseFactor();
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  }

  function parseFactor(): number {
    const token = tokens[position++];
    if (token === "+") return parseFactor();
    if (token === "-") return -parseFactor();
    if (token === "(") {
      const value = parseExpression();
      if (tokens[position++] !== ")") throw new Error("Missing closing parenthesis");
      return value;
    }
    if (token === undefined || token === ")") throw new Error("Expected a number");

    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return value;
  }

  try {
    const result = parseExpression();
    if (position !== tokens.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

export function containsOnlyArithmeticCharacters(value: string): boolean {
  return allowedExpression.test(value);
}
