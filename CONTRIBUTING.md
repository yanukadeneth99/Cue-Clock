# Contributing to Cue Clock

Thank you for your interest in contributing to Cue Clock! This project is a monorepo containing both the mobile application and its landing page.

## Code of Conduct

By participating, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Project Structure

- **`app/`**: The React Native (Expo) mobile application.
- **`website/`**: The Next.js landing page and documentation site.

---

## How to Contribute

### 1. Reporting Bugs & Features

Open a [GitHub Issue](https://github.com/yanukadeneth99/Cue-Clock/issues) for:
- **Bugs**: Provide steps to reproduce, expected vs actual behavior, and your platform (iOS/Android/Web).
- **Features**: Describe the utility for broadcast professionals and any implementation ideas.

### 2. Development Setup

1. **Fork** and **Clone** the repository.
2. Choose the project you want to work on:

#### Working on the Mobile App (`app/`)
```bash
cd app
npm install
npx expo start
```
*Note: We prioritize **inline styles** for layout to ensure reliability on Android native.*

#### Working on the Website (`website/`)
```bash
cd website
npm install
npm run dev
```
*Note: Built with Next.js 16.2.1 and Tailwind CSS 4.*

### 3. Submitting Code

1. **Create a branch**: `feature/description` or `fix/description`.
2. **Focus**: Keep PRs small and focused on a single change.
3. **Linting**: Run the linter in the respective directory (`npm run lint`).
4. **Test**: Verify changes on at least one target platform.
5. **Push** and open a Pull Request against `master`.

---

## Development Principles

Cue Clock is built for high-pressure broadcast environments. All contributions must respect these core mandates:

1. **Speed is Priority**: Avoid heavy libraries, unnecessary re-renders, or deep abstractions.
2. **Intuitive UX**: Controls must be immediately obvious. No hidden gestures or complex flows.
3. **Zero Friction**: Minimize background processing. The main thread is for the clock.
4. **TypeScript Strict**: No `any` types. Ensure full type safety.

## Questions?

Reach out at [hello@yashura.io](mailto:hello@yashura.io) or open a discussion on GitHub.
