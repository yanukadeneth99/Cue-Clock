---
description: Initialization workflow to analyze codebase flavor and update CLAUDE.md
---

# Workflow: Codebase Initialization & Flavor Extraction

**Trigger:** `/helloworld`
**GOAL:** Scan the entire codebase to understand its unique coding style, architectural patterns, and testing conventions, then immortalize these findings in `CLAUDE.md` to ensure consistent future development.

## Phase 1: Global Codebase Scan

**Goal:** Ingest and read all relevant source files to build a comprehensive mental map of the project.

1.  **Identify Target Files**
    - Recursively traverse the project directory to locate all source code files, tests, and configurations.
    - **Action:** Ignore standard exclusion directories such as `node_modules`, `.next`, `dist`, `build`, and `.git`.
2.  **Read and Ingest Content**
    - Read the contents of the identified files to prepare for pattern recognition.

## Phase 2: Flavor Extraction & Pattern Recognition

**Goal:** Analyze the ingested code to deduce the "Flavor" (style, conventions, and architectural preferences) of the codebase. You must actively evaluate and list findings for the following categories:

1.  **Naming Conventions**
    - **Variables:** Are they `camelCase`, `snake_case`, or something else? How are boolean variables named (e.g., `isReady`, `hasData`)?
    - **Constants:** Are global/magic constants written in `UPPER_SNAKE_CASE`?
    - **Functions:** How are functions named? Are action verbs used (e.g., `get...`, `fetch...`, `handle...`)?
    - **Classes/Types:** Are classes, TypeScript Interfaces, and Types using `PascalCase`?
2.  **Function & Class Structures**
    - **Function Creation:** Is the codebase leaning towards Arrow Functions (`const myFunc = () => {}`) or standard Function Declarations (`function myFunc() {}`)?
    - **Class Creation:** How are classes constructed? Check for the use of ES6 classes, constructors, public/private access modifiers, and inheritance patterns.
    - **Export/Import Styles:** Are default exports preferred over named exports? Are imports absolute (aliased) or relative?
3.  **Testing Conventions**
    - **Test Presence:** Are there test files? (e.g., `.test.ts`, `.spec.tsx`).
    - **Tooling:** What testing frameworks are used (e.g., Jest, Vitest, React Testing Library, Cypress)?
    - **Test Structure:** How are tests organized? Look for nested `describe` blocks, Arrange-Act-Assert patterns, mock setups, and teardown procedures.
4.  **Coding Paradigms & Quirks**
    - Identify error handling patterns (e.g., `try/catch` blocks, `.catch()` chains, custom error classes).
    - Check for early returns (guard clauses) vs. deeply nested `if/else` statements.
    - Analyze the comment style (JSDoc, inline comments, or self-documenting code).

## Phase 3: Documentation via CLAUDE.md

**Goal:** Synthesize the extracted "Flavor" into a permanent rulebook for the AI.

1.  **Format the Findings**
    - Compile the observations from Phase 2 into a clear, structured format.
2.  **Update `CLAUDE.md`**
    - Locate the `CLAUDE.md` file in the root directory (or create it if it does not exist).
    - Append or update the file with a section explicitly titled **"Codebase Flavor & Conventions"**.
    - Ensure the updated `CLAUDE.md` clearly lists all the discovered rules (Naming, Structure, Testing, Paradigms) so that any future code generation strictly adheres to this established baseline.

---

## Initialization Checklist

- [ ] Codebase completely scanned (excluding build/node_modules directories).
- [ ] Naming conventions extracted and documented.
- [ ] Function/Class structures and testing paradigms analyzed.
- [ ] `CLAUDE.md` successfully created or updated with the specific "Flavor" rules.
