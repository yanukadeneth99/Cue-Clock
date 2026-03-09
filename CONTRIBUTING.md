# Contributing to Broadcast Clock

Thank you for your interest in contributing. This guide explains how to get involved.

## Code of Conduct

By participating, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before contributing.

## How to Contribute

### Reporting Bugs

Open a [GitHub Issue](https://github.com/yanukadeneth99/Broadcast-Clock/issues) with:

- A clear description of the bug
- Steps to reproduce it
- Expected vs actual behavior
- Platform and device info (iOS, Android, Web, screen size)

### Suggesting Features

Open an issue and describe:

- What the feature would do
- Why it's useful for broadcast professionals
- Any implementation ideas you have

### Submitting Code

1. **Fork** the repository.
2. **Clone** your fork and install dependencies (`npm install`).
3. **Create a branch** from `main`:
   - `feature/short-description` for new features
   - `fix/short-description` for bug fixes
4. **Make your changes.** Keep them focused -- one feature or fix per PR.
5. **Test** on at least one platform (web is the easiest to verify).
6. **Run the linter** with `npm run lint` and fix any issues.
7. **Push** to your fork and open a pull request.

### Pull Request Guidelines

- Keep the PR title concise and descriptive.
- In the PR description, explain:
  - What changes you made and why
  - How to test the changes
  - Link to any related issues
- Small, focused PRs are reviewed faster than large ones.

## Development Principles

This app prioritizes **speed** and **simplicity** above all else. When contributing, keep these principles in mind:

- **Minimal overhead** -- avoid unnecessary re-renders, heavy libraries, or complex abstractions.
- **Obvious UX** -- controls must be immediately clear to a stressed broadcast operator.
- **No new dependencies** without strong justification. The bundle must stay lean.
- **TypeScript strict mode** -- no `any` types, no suppression without explanation.
- **NativeWind / Tailwind** for styling. Use inline styles only for dynamic/computed values.

## Questions?

Open an issue or reach out at [hello@yashura.music](mailto:hello@yashura.music).
