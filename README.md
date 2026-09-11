# Komuter

A modern full-stack monorepo featuring a **Kotlin Multiplatform (KMP)** mobile application paired with a dedicated **NestJS** authentication backend service.

---

## 📁 Repository Layout

```text
Komuter/
├── mobile/                  # Kotlin Multiplatform project root
│   ├── androidApp/          # Android target UI (Jetpack Compose, Material 3)
│   ├── shared/              # Common business logic, models, Ktor HTTP client, and platform security
│   ├── iosApp/              # Xcode-ready structure for future iOS target
│   ├── gradle/              # Gradle wrapper and version catalog (libs.versions.toml)
│   ├── build.gradle.kts     # Root build script for KMP
│   └── settings.gradle.kts  # Gradle project inclusions
├── backend/                 # NestJS Authentication API root
│   ├── src/                 # Application source code (auth module, users, guards, strategies)
│   ├── prisma/              # Prisma schema for PostgreSQL database
│   ├── test/                # End-to-end and unit tests
│   ├── .env.example         # Template for required environment variables
│   ├── package.json         # Backend dependencies and scripts
│   └── tsconfig.json        # TypeScript configuration
├── CONTRIBUTING.md          # Commit message conventions & workflow
├── .gitignore               # Multi-ecosystem ignore definitions
└── README.md                # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Java**: JDK 17 or JDK 21 (bundled with Android Studio JBR: `C:\Program Files\Android\Android Studio\jbr`)
- **Android SDK**: API Level 34/35 installed via Android Studio
- **Node.js**: v18+ (tested on v22.x) and `npm` v9+
- **PostgreSQL**: Local or containerized PostgreSQL instance (default port 5432)

---

### 1. Backend Setup (NestJS)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Configure your database URL and JWT secrets in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/komuter_db?schema=public"
   JWT_ACCESS_SECRET="your-secure-access-secret"
   JWT_ACCESS_EXPIRES_IN="15m"
   JWT_REFRESH_SECRET="your-secure-refresh-secret"
   JWT_REFRESH_EXPIRES_IN="7d"
   PORT=3000
   ```
5. Run database migrations or push schema:
   ```bash
   npx prisma db push
   ```
6. Start development server:
   ```bash
   npm run start:dev
   ```
   API endpoints will be available at `http://localhost:3000/auth`.

---

### 2. Mobile Setup (Kotlin Multiplatform)

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
2. Build all modules and run verification:
   ```bash
   ./gradlew build
   # or on Windows PowerShell:
   .\gradlew.bat build
   ```
3. Run the Android application:
   - Open the `mobile` directory in **Android Studio**.
   - Select the `androidApp` run configuration and click **Run**, or run via CLI:
     ```bash
     .\gradlew.bat :androidApp:installDebug
     ```

---

## 🔒 Shared API Contracts

Authentication request and response contracts are synchronized between NestJS DTOs and Kotlin `@Serializable` data classes:

| Operation | Method | Endpoint | Request Body | Response Body |
| :--- | :--- | :--- | :--- | :--- |
| **Sign Up** | `POST` | `/auth/signup` | `SignupRequest` | `AuthTokenResponse` |
| **Login** | `POST` | `/auth/login` | `LoginRequest` | `AuthTokenResponse` |
| **Refresh** | `POST` | `/auth/refresh` | `RefreshTokenRequest` | `AuthTokenResponse` |
| **Logout** | `POST` | `/auth/logout` | *(Bearer Access Token)* | `{ "success": true }` |

---

## 📜 Commit Conventions

We enforce [Conventional Commits](CONTRIBUTING.md). Please use standard prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, and `chore:`.
