# Copilot instructions

## Project context

This project has intentionally underspecified requirements.

The goal is to turn ambiguous requirements into a clear, maintainable implementation while making reasonable engineering decisions explicit.

Prioritize:
- correctness
- simplicity
- maintainability
- testability
- clear architecture
- understandable code

Avoid unnecessary complexity or overengineering.

## Working style

Do not immediately start coding when given an ambiguous requirement.

Before implementing a significant feature:

1. Inspect the existing code and project structure.
2. Identify ambiguities and important assumptions.
3. Explain the proposed approach and relevant tradeoffs.
4. Wait for approval when a decision could materially affect the architecture or behavior.
5. Implement incrementally.
6. Run relevant tests and validation.
7. Review the implementation for unnecessary complexity.

Do not rewrite unrelated code.

## Technology constraints

The frontend must use:

- React
- TypeScript

Do not replace React or TypeScript without discussing it first.

Backend, database, styling, and other tooling choices are intentionally undecided until the requirements and architecture have been analyzed.

## Handling ambiguity

Do not silently invent important business requirements.

When something is ambiguous:

- identify the ambiguity;
- explain reasonable options;
- make a low-risk assumption when appropriate;
- ask for clarification when the decision materially affects the product or architecture.

Important decisions and assumptions should eventually be documented.

## Code quality

Prefer:

- clear names
- small functions
- explicit behavior
- strong typing
- simple data structures
- focused components
- meaningful tests

Avoid:

- premature abstraction
- unnecessary design patterns
- speculative features
- dead code
- unnecessary dependencies

## Testing

Important business logic should have automated tests.

After making changes, run relevant:

- tests
- type checks
- linting

Do not change tests simply to make the implementation pass unless the test is demonstrably incorrect.

## UI

Keep the UI simple and functional.

Prioritize:

1. usability
2. information hierarchy
3. accessibility
4. consistency

Do not spend excessive effort on visual polish unless it meaningfully contributes to the assignment.

## Dependencies

Before adding a dependency, consider whether the existing stack can reasonably solve the problem.

If a dependency is added, explain why it is useful.

## Communication

When making a significant change, briefly explain:

- what is being changed;
- why;
- important assumptions;
- how it was validated.

After implementation, summarize:

- files changed;
- behavior added;
- tests or validation performed;
- remaining limitations.
