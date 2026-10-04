# SatyaSetu AI — Fact Lock

### Source-grounded content generation with factual verification

This module implements the **AI and Fact Lock component of SatyaSetu**.

Its purpose is to transform source content using generative AI while reducing factual drift during transformation.

The central principle is:

> **The presentation may change. The approved facts remain anchored to the source.**

---

## The Problem

Generative AI can transform the same information into summaries, translations, webpages and other formats.

However, during transformation, important information such as:

- numbers
- dates
- amounts
- eligibility conditions
- names
- requirements
- deadlines

may be changed, omitted or unsupported information may be introduced.

The SatyaSetu AI module addresses this through a **Canonical Fact Sheet + Fact Lock** approach.

---

## AI Workflow

```text
Source Content
      |
      v
Source Extraction
      |
      v
AI-Assisted Fact Extraction
      |
      v
Canonical Fact Sheet
      |
      v
Human Fact Review
      |
      v
Grounded AI Generation
      |
      v
Fact Lock Verification
      |
      v
Human Review
      |
      v
Approved Output
```

---

## Canonical Fact Sheet

Before content generation, important information is extracted from the source and represented as structured facts.

Each fact receives a unique ID and supporting source evidence.

Example:

```text
F1 → Award amount: INR 5,000
F2 → Applicant must be enrolled in an undergraduate course
F3 → Annual family income must be below INR 200,000
F4 → Application deadline: 20 October 2026
```

The fact sheet is reviewed before it becomes the grounding source for generation.

This separates **what is true according to the source** from **how that information is later presented**.

---

## Fact Lock

**Fact Lock is the factual verification layer of the AI module.**

After generation, the output is checked against the approved Canonical Fact Sheet.

```text
                Generated Content
                       |
                       v
              +-----------------+
              |    FACT LOCK    |
              +-----------------+
              | Fact References |
              | Numeric Checks  |
              | Semantic Checks |
              | Source Evidence |
              +--------+--------+
                       |
                +------+------+
                |             |
                v             v
           No Issue       Issue Found
                |             |
                v             v
          Human Review      BLOCKED
                |
                v
             APPROVED
```

Fact Lock currently combines:

### Deterministic Verification

Checks structured properties such as:

- referenced fact IDs
- important numerical values
- unsupported numerical information
- source/fact consistency

### Semantic Verification

Uses AI-assisted verification to identify problems that cannot be reliably detected through exact-value checks alone, including:

- contradictions
- important omissions
- semantic inconsistencies

### Source Traceability

Generated content retains references such as:

```text
Source facts: F1, F2, F3
```

This makes generated statements traceable to the facts used to produce them.

---

## Grounded Generation

Generation is performed using the **approved Canonical Fact Sheet** as the factual foundation.

For example, if the approved fact is:

```text
F1 → Award amount: INR 5,000
```

and an instruction attempts to introduce:

```text
Award amount: INR 50,000
```

the conflicting instruction should not become a new trusted fact simply because it appeared in the generation request.

The source-backed Canonical Fact Sheet remains the grounding layer.

---

## Verification Blocking

When Fact Lock detects a significant factual problem, the generated output is marked:

```text
blocked
```

A blocked output cannot pass the normal approval step.

The content must instead be reviewed, corrected or regenerated.

This creates a verification gate between **AI generation** and **human approval**.

---

## Human-in-the-Loop Design

SatyaSetu AI does not treat automated verification as a replacement for human judgement.

Human review occurs at two important stages:

```text
Extracted Facts
      ↓
Human Fact Review
      ↓
Generation + Fact Lock
      ↓
Human Output Review
```

This allows AI to perform transformation and verification assistance while keeping final factual approval under human control.

---

## Supported AI Functions

The current prototype includes:

- Source content extraction
- AI-assisted fact extraction
- Canonical Fact Sheet creation
- Evidence-linked facts
- Editable fact review
- Source-grounded generation
- Summary generation
- FAQ generation
- Document generation
- Translation
- Webpage generation
- Multilingual transformation
- Deterministic factual checks
- Semantic AI verification
- Fact-level traceability
- Verification reports
- Human approval gating

---

## Example Verification Behaviour

During testing, the AI module was evaluated with intentionally conflicting and incomplete generation instructions.

Examples included:

```text
Approved fact: INR 5,000
Requested value: INR 50,000
```

and:

```text
Approved deadline: 20 October 2026
Requested deadline: 30 November 2026
```

The generated content remained grounded in the approved facts.

The module was also tested with requests for unsupported information, such as an application URL and contact number, which were not present in the Canonical Fact Sheet.

In another test, an important approved requirement was omitted during generation. The semantic verification layer detected the omission and marked the output:

```text
blocked
```

An attempted approval of that blocked output was rejected.

---

## Core Components

```text
app/
├── main.py
├── ingest.py
├── provider.py
├── checks.py
├── schemas.py
└── render.py
```

**`ingest.py`**  
Handles source-content extraction and preparation.

**`provider.py`**  
Handles AI-assisted fact extraction, grounded generation and semantic verification.

**`checks.py`**  
Implements deterministic Fact Lock checks.

**`schemas.py`**  
Defines the structured data models used for facts and generated outputs.

**`render.py`**  
Handles rendering of generated content.

**`main.py`**  
Coordinates the AI workflow.

---

## Current Status

The current implementation is a **working prototype of the SatyaSetu AI and Fact Lock architecture**.

The implemented AI pipeline is:

```text
Source
   ↓
Canonical Facts
   ↓
Human Review
   ↓
Grounded Generation
   ↓
Fact Lock
   ↓
Human Review
```

Fact Lock currently combines deterministic verification, AI-assisted semantic verification and human review.

It is a verification and review mechanism and should not be interpreted as a mathematical guarantee of factual correctness.

---

## SatyaSetu AI

### One source. Multiple transformations. Facts remain anchored.

**Extract → Ground → Transform → Verify → Review**
