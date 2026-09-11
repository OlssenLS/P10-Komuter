# Contributing Guidelines & Commit Conventions

This project adheres strictly to the **Conventional Commits** specification (v1.0.0).

## Commit Format

Each commit message consists of a **type**, an optional **scope**, and a **subject**:

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature for the user or application
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies (e.g., Gradle, npm, version catalog)
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scopes

Common scopes used in this repository:
- `mobile`: General mobile changes
- `shared`: Changes in `mobile/shared`
- `android`: Changes in `mobile/androidApp`
- `ios`: Changes in `mobile/iosApp`
- `backend`: General NestJS backend changes
- `auth`: Changes to the authentication module
- `deps`: Dependency upgrades

### Examples

- `feat(auth): add refresh token rotation endpoint`
- `feat(shared): implement SecureStorage actual for Android Keystore`
- `fix(backend): validate email format in signup DTO`
- `chore(deps): bump Ktor to 3.0.1`
