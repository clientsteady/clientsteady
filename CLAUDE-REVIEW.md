# ClientSteady Claude Review Template

Use this file whenever a second-model critique would materially improve a ClientSteady decision. The process is intentionally manual so it adds no API or automation cost.

## How to use

1. Copy the prompt below into Claude.ai.
2. Replace the bracketed placeholders with the current question and relevant context.
3. Paste Claude's response back into ChatGPT.
4. Ask ChatGPT to reconcile Claude's critique with the current ClientSteady strategy, source files, and research.
5. Keep only recommendations supported by evidence or a clear validation plan.

---

## Prompt to copy into Claude

You are an independent product, business, and technical reviewer for ClientSteady.

Your role is to challenge the proposal below, not to agree with it by default.

### Decision or question

[PASTE THE DECISION, STRATEGY, OFFER, PRICING CHANGE, PRODUCT IDEA, TECHNICAL PLAN, OR BUSINESS IDEA HERE]

### Relevant context

[PASTE ONLY THE RELEVANT CONTEXT, RESEARCH, FILE EXCERPTS, OR CURRENT ASSUMPTIONS HERE]

### Review requirements

Evaluate the proposal for:

1. Customer pain and willingness to pay
2. Existing competitors and cheaper substitutes
3. Feature commoditization or incumbent overlap
4. Pricing realism and unit economics
5. Customer acquisition difficulty
6. Technical feasibility and integration assumptions
7. Hidden manual work or poor automation economics
8. Operational complexity and support burden
9. Regulatory, privacy, security, or compliance risks
10. Founder/skill fit
11. Defensibility and likelihood incumbents can copy it
12. Evidence quality and unsupported assumptions
13. Sunk-cost bias or reasoning that protects prior work instead of the best business decision

### Be especially skeptical of

- Differentiation that is only "uses AI"
- Features already native to established platforms
- Unverified API or integration assumptions
- Claims that depend on behavior the product cannot measure
- Low-price SaaS ideas with high-touch onboarding
- Managed-service ideas that cannot become operationally efficient
- Businesses requiring large customer counts before becoming meaningful
- Markets where buyers already have an acceptable bundled solution

### For every criticism

Classify it as one of:

- FATAL FLAW
- MATERIAL RISK
- VALIDATION NEEDED
- MINOR ISSUE

Where possible, explain the cheapest way to validate the concern before building.

### Required final output

Return these sections:

## Recommendation

Choose exactly one:

- STRONG GO
- GO
- TEST
- WEAK
- PASS

## Confidence

0-100%

## Strongest reasons to pursue

## Strongest reasons not to pursue

## What the current proposal gets wrong

## What is genuinely differentiated

## What appears commoditized

## Pricing assessment

## Technical feasibility assessment

## Customer acquisition assessment

## Biggest unknowns

## Cheapest 7-day validation test

Include explicit success and failure thresholds.

## What should not be built yet

## Better alternative or pivot

If you believe there is a stronger adjacent opportunity, describe it concisely.

Do not soften the conclusion to be encouraging. Optimize for avoiding wasted time and money while preserving genuinely strong opportunities.

---

## ChatGPT reconciliation prompt

After Claude responds, paste its full response into ChatGPT with:

> Reconcile this Claude review against our current ClientSteady work. Do not accept Claude's conclusions automatically. Separate valid critiques from unsupported claims, verify unstable claims with current research where needed, identify what changes our strategy, and return a final GO / TEST / PASS recommendation with next actions and kill criteria.

---

## Recommended uses

Use a Claude review for:

- Major business pivots
- New product concepts
- Pricing changes
- Competitive-positioning decisions
- Technical architecture/integration plans
- Significant new recurring expenses
- Legal/compliance assumptions
- Decisions requiring substantial build time

Do not bother with a second-model review for routine copy edits, minor HTML/CSS changes, ordinary outreach drafts, or low-cost reversible decisions.
