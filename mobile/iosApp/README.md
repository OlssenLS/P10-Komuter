# iosApp Placeholder

This directory is an Xcode-ready placeholder for the future iOS application target.

The shared multiplatform framework is configured in `mobile/shared/build.gradle.kts`:
- Targets: `iosX64`, `iosArm64`, `iosSimulatorArm64`
- Framework Name: `Shared`
- Static Framework: `true`

When adding iOS:
1. Open this directory or create an Xcode project (`iosApp.xcodeproj`) configured to link `Shared.framework`.
2. Access `AuthApiClient` and `SecureTokenStorage` from `import Shared`.
