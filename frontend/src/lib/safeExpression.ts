/**
 * Safe arithmetic evaluator for the `sandbox` harness primitive.
 *
 * The primitive is documented to the model as "STRICTLY FOR PURE MATH OR ARITHMETIC ONLY"
 * (harnessPrompt.ts), so it does not need a JavaScript engine. The previous implementation
 * ran model-written code with `new Function` in the host page's realm behind a regex
 * blocklist; string-built property names bypass such blocklists, and model output can be
 * steered by untrusted page text. This parser has no access to any object at all: it only
 * understands numbers, booleans, operators, a whitelist of Math functions and read-only
 * numeric/boolean fields of the caller-supplied `context`. Anything else is a parse error.
 */

const MAX_SOURCE_LENGTH = 500;
const MAX_DEPTH = 64;

const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  trunc: Math.trunc,
  sign: Math.sign,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  exp: Math.exp,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  hypot: Math.hypot,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
};

const MATH_CONSTANTS: Record<string, number> = { PI: Math.PI, E: Math.E };

type Value = number | boolean;
type Token = { kind: "num" | "id" | "op" | "eof"; text: string };

export class SafeExpressionError extends Error {
  /** true when the input tried to reach something outside arithmetic (identifier, string, bracket) */
  readonly security: boolean;

  constructor(message: string, security = false) {
    super(message);
    this.security = security;
  }
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const ops = ["===", "!==", "**", "<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "!", "(", ")", ",", ".", "?", ":"];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { tokens.push({ kind: "num", text: num[0] }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { tokens.push({ kind: "id", text: id[0] }); i += id[0].length; continue; }
    const op = ops.find((o) => src.startsWith(o, i));
    if (op) { tokens.push({ kind: "op", text: op }); i += op.length; continue; }
    throw new SafeExpressionError(`Unsupported character '${c}'. The sandbox evaluates arithmetic only (no strings, brackets or statements).`, true);
  }
  tokens.push({ kind: "eof", text: "" });
  return tokens;
}

class Parser {
  private pos = 0;
  private depth = 0;
  private tokens: Token[];
  private context: Record<string, unknown>;

  constructor(tokens: Token[], context: Record<string, unknown>) {
    this.tokens = tokens;
    this.context = context;
  }

  parse(): Value {
    const v = this.ternary();
    if (this.peek().kind !== "eof") throw new SafeExpressionError(`Unexpected '${this.peek().text}'`);
    return v;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private next(): Token { return this.tokens[this.pos++]; }
  private accept(text: string): boolean {
    if (this.peek().kind === "op" && this.peek().text === text) { this.pos++; return true; }
    return false;
  }
  private expect(text: string): void {
    if (!this.accept(text)) throw new SafeExpressionError(`Expected '${text}' but found '${this.peek().text || "end of input"}'`);
  }
  private num(v: Value): number {
    if (typeof v !== "number") throw new SafeExpressionError("Expected a number");
    return v;
  }
  private enter(): void {
    if (++this.depth > MAX_DEPTH) throw new SafeExpressionError("Expression is nested too deeply");
  }

  private ternary(): Value {
    this.enter();
    const cond = this.or();
    if (this.accept("?")) {
      const a = this.ternary();
      this.expect(":");
      const b = this.ternary();
      this.depth--;
      return cond ? a : b;
    }
    this.depth--;
    return cond;
  }

  private or(): Value {
    let v = this.and();
    while (this.accept("||")) { const r = this.and(); v = Boolean(v) || Boolean(r); }
    return v;
  }

  private and(): Value {
    let v = this.cmp();
    while (this.accept("&&")) { const r = this.cmp(); v = Boolean(v) && Boolean(r); }
    return v;
  }

  private cmp(): Value {
    const left = this.add();
    for (const op of ["===", "!==", "==", "!=", "<=", ">=", "<", ">"]) {
      if (this.accept(op)) {
        const right = this.add();
        switch (op) {
          case "===": case "==": return left === right;
          case "!==": case "!=": return left !== right;
          case "<=": return this.num(left) <= this.num(right);
          case ">=": return this.num(left) >= this.num(right);
          case "<": return this.num(left) < this.num(right);
          default: return this.num(left) > this.num(right);
        }
      }
    }
    return left;
  }

  private add(): Value {
    let v = this.mul();
    for (;;) {
      if (this.accept("+")) v = this.num(v) + this.num(this.mul());
      else if (this.accept("-")) v = this.num(v) - this.num(this.mul());
      else return v;
    }
  }

  private mul(): Value {
    let v = this.pow();
    for (;;) {
      if (this.accept("*")) v = this.num(v) * this.num(this.pow());
      else if (this.accept("/")) v = this.num(v) / this.num(this.pow());
      else if (this.accept("%")) v = this.num(v) % this.num(this.pow());
      else return v;
    }
  }

  private pow(): Value {
    const base = this.unary();
    if (this.accept("**")) return Math.pow(this.num(base), this.num(this.pow()));
    return base;
  }

  private unary(): Value {
    this.enter();
    let v: Value;
    if (this.accept("-")) v = -this.num(this.unary());
    else if (this.accept("+")) v = this.num(this.unary());
    else if (this.accept("!")) v = !this.unary();
    else v = this.primary();
    this.depth--;
    return v;
  }

  private primary(): Value {
    const t = this.next();
    if (t.kind === "num") return Number(t.text);
    if (t.kind === "op" && t.text === "(") {
      const v = this.ternary();
      this.expect(")");
      return v;
    }
    if (t.kind === "id") {
      if (t.text === "true") return true;
      if (t.text === "false") return false;
      if (t.text === "Math") {
        this.expect(".");
        const name = this.next();
        if (name.kind !== "id") throw new SafeExpressionError("Expected a Math function name");
        return this.mathMember(name.text);
      }
      if (t.text === "context") {
        this.expect(".");
        const name = this.next();
        if (name.kind !== "id") throw new SafeExpressionError("Expected a context field name");
        return this.contextField(name.text);
      }
      if (this.peek().kind === "op" && this.peek().text === "(" && MATH_FUNCTIONS[t.text]) {
        return this.mathMember(t.text);
      }
      if (MATH_CONSTANTS[t.text] !== undefined) return MATH_CONSTANTS[t.text];
      if (Object.prototype.hasOwnProperty.call(this.context, t.text)) return this.contextField(t.text);
      throw new SafeExpressionError(`'${t.text}' is not allowed. The sandbox evaluates arithmetic only: numbers, operators, Math functions and context fields.`, true);
    }
    throw new SafeExpressionError(`Unexpected '${t.text || "end of input"}'`);
  }

  private mathMember(name: string): Value {
    if (MATH_CONSTANTS[name] !== undefined) return MATH_CONSTANTS[name];
    const fn = MATH_FUNCTIONS[name];
    if (!fn) throw new SafeExpressionError(`'Math.${name}' is not allowed`, true);
    this.expect("(");
    const args: number[] = [];
    if (!this.accept(")")) {
      do { args.push(this.num(this.ternary())); } while (this.accept(","));
      this.expect(")");
    }
    return fn(...args);
  }

  private contextField(name: string): Value {
    if (!Object.prototype.hasOwnProperty.call(this.context, name)) {
      throw new SafeExpressionError(`context.${name} is not defined`);
    }
    const v = this.context[name];
    if (typeof v === "number" || typeof v === "boolean") return v;
    throw new SafeExpressionError(`context.${name} must be a number or boolean`);
  }
}

/** Evaluates an arithmetic expression; throws SafeExpressionError on anything else. */
export function evaluateSafeExpression(source: string, context: Record<string, unknown> = {}): Value {
  if (source.length > MAX_SOURCE_LENGTH) {
    throw new SafeExpressionError(`Expression longer than ${MAX_SOURCE_LENGTH} characters`);
  }
  const ctx = context && typeof context === "object" ? context : {};
  return new Parser(tokenize(source), ctx).parse();
}

/** Harness-facing wrapper: returns the result or an error string, never throws. */
export function runSandboxExpression(source: string, context: Record<string, unknown> = {}): string {
  if (!source.trim()) return "Error: No code provided to sandbox.";
  try {
    return String(evaluateSafeExpression(source, context));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof SafeExpressionError) return err.security ? `SecurityError: ${msg}` : `Sandbox syntax error: ${msg}`;
    return `Sandbox runtime error: ${msg}`;
  }
}
