import fs from 'node:fs';
import path from 'node:path';

const task = process.env.ADVISORY_TASK?.trim();
const contextFilesRaw = process.env.CONTEXT_FILES || 'index.html';
const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.6';
const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const outputDir = process.env.OUTPUT_DIR || 'docs/ai-reviews';
const openaiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!task) throw new Error('ADVISORY_TASK is required.');
if (!openaiKey) throw new Error('OPENAI_API_KEY is required.');
if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is required.');

const contextFiles = contextFilesRaw
  .split(/[\n,]/)
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_FILE_CHARS = 120_000;
const MAX_TOTAL_CONTEXT_CHARS = 320_000;

function readContext(files) {
  let total = 0;
  const chunks = [];

  for (const file of files) {
    const safePath = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, '');
    if (!fs.existsSync(safePath)) {
      chunks.push(`\n--- FILE: ${file} ---\n[File not found]\n`);
      continue;
    }

    const stat = fs.statSync(safePath);
    if (!stat.isFile()) {
      chunks.push(`\n--- FILE: ${file} ---\n[Not a regular file]\n`);
      continue;
    }

    let text = fs.readFileSync(safePath, 'utf8');
    if (text.length > MAX_FILE_CHARS) {
      text = `${text.slice(0, MAX_FILE_CHARS)}\n\n[TRUNCATED: file exceeded ${MAX_FILE_CHARS.toLocaleString()} characters]`;
    }

    if (total + text.length > MAX_TOTAL_CONTEXT_CHARS) {
      const remaining = Math.max(0, MAX_TOTAL_CONTEXT_CHARS - total);
      if (remaining > 0) {
        text = `${text.slice(0, remaining)}\n\n[TRUNCATED: total context limit reached]`;
        chunks.push(`\n--- FILE: ${file} ---\n${text}\n`);
      }
      chunks.push('\n[Additional context files omitted because the total context limit was reached.]\n');
      break;
    }

    total += text.length;
    chunks.push(`\n--- FILE: ${file} ---\n${text}\n`);
  }

  return chunks.join('\n');
}

function extractOpenAIText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function callOpenAI(input, maxOutputTokens = 5000) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiModel,
      input,
      max_output_tokens: maxOutputTokens,
      store: false,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${JSON.stringify(data)}`);
  }

  const text = extractOpenAIText(data);
  if (!text) throw new Error('OpenAI returned no text output.');
  return text;
}

async function callAnthropic(system, user, maxTokens = 5000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(data)}`);
  }

  const text = (data.content || [])
    .filter((x) => x.type === 'text' && typeof x.text === 'string')
    .map((x) => x.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Anthropic returned no text output.');
  return text;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'strategy-review';
}

const context = readContext(contextFiles);

const primaryPrompt = `You are the primary business strategist for ClientSteady.

ORIGINAL TASK
${task}

SOURCE CONTEXT FROM THE CLIENTSTEADY REPOSITORY
${context}

Evaluate the task independently and rigorously. Do not defend an existing strategy merely because work has already been invested in it.

Analyze:
- customer problem and urgency
- market size and willingness to pay
- competitors and substitutes
- differentiation and defensibility
- pricing and unit economics
- technical/integration difficulty
- operational burden and automation potential
- founder/skill fit
- customer acquisition path
- major risks and hidden assumptions
- cheapest useful validation experiment

Clearly distinguish facts supported by the supplied context from assumptions that still need external validation.

End with a clear preliminary recommendation: GO, TEST, or PASS.`;

console.log('1/3 Running OpenAI primary analysis...');
const primary = await callOpenAI(primaryPrompt);

const skepticSystem = `You are an independent investment committee skeptic. Your job is NOT to agree with the primary analysis. You are reviewing a proposed business strategy before the founder spends meaningful time or money on it.

Look aggressively for:
1. Existing products that already solve the problem
2. Unrealistic pricing or willingness-to-pay assumptions
3. Weak differentiation
4. Integration or technical assumptions that have not been validated
5. Customer acquisition difficulty
6. Hidden manual labor or poor gross margins
7. Low true automation potential
8. Regulatory, privacy, or contractual risk
9. Reasons incumbents can copy or bundle the idea cheaply
10. Reasons the founder may be poorly positioned to execute it
11. Evidence the primary analysis is using wishful thinking or sunk-cost reasoning

Separate fatal flaws, manageable risks, and unknowns requiring validation. Be specific and adversarial, but fair. End with exactly one recommendation: STRONG GO, TEST, WEAK, or PASS.`;

const skepticUser = `ORIGINAL TASK
${task}

SOURCE CONTEXT
${context}

PRIMARY OPENAI ANALYSIS
${primary}`;

console.log('2/3 Running Claude adversarial critique...');
const critique = await callAnthropic(skepticSystem, skepticUser);

const finalPrompt = `You are the final investment committee for ClientSteady.

ORIGINAL TASK
${task}

SOURCE CONTEXT
${context}

PRIMARY OPENAI ANALYSIS
${primary}

CLAUDE ADVERSARIAL CRITIQUE
${critique}

Reconcile these analyses. Do not automatically favor the first analysis, and do not split the difference just because the models disagree. Evaluate the evidence and assumptions behind each argument.

Return this exact structure:

# Decision
GO / TEST / PASS

# Confidence
0-100%

# Executive conclusion
A concise decision-oriented summary.

# What survived the critique
The strongest parts of the original case.

# What the critique correctly invalidated
Claims or assumptions that should no longer be relied on.

# Biggest remaining uncertainties
Rank the unresolved questions by importance.

# Cheapest validation test
The smallest real-world test that would materially reduce uncertainty.

# Success threshold
Specific measurable result that warrants continuing.

# Kill threshold
Specific measurable result that should cause us to stop or pivot.

# Next 7 days
Concrete ordered actions.

# Do not build yet
Anything that should explicitly wait until validation.

Be willing to recommend PASS even after substantial prior work.`;

console.log('3/3 Running OpenAI final synthesis...');
const finalDecision = await callOpenAI(finalPrompt, 6000);

const now = new Date();
const date = now.toISOString().slice(0, 10);
const stamp = now.toISOString().replace(/[:.]/g, '-');
const filename = `${date}-${slugify(task)}-${stamp.slice(11, 19)}.md`;
const outputPath = path.join(outputDir, filename);
fs.mkdirSync(outputDir, { recursive: true });

const markdown = `# ClientSteady AI Advisory Board Review

**Date:** ${now.toISOString()}  
**OpenAI model:** ${openaiModel}  
**Anthropic model:** ${anthropicModel}  
**Context files:** ${contextFiles.join(', ')}

## Original Task

${task}

---

## OpenAI Primary Analysis

${primary}

---

## Claude Adversarial Critique

${critique}

---

## Final Investment Committee Decision

${finalDecision}
`;

fs.writeFileSync(outputPath, markdown, 'utf8');
console.log(`Review written to ${outputPath}`);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `review_path=${outputPath}\n`);
}
