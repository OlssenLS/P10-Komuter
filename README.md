# Komuter

A modern full-stack monorepo featuring a **Flutter (Material 3)** transit companion mobile application paired with a dedicated **NestJS** backend API and **Supabase Auth**.
---

## 📁 Repository Layout

```text
Komuter/
├── mobile/                  # Flutter application root (Android & iOS)
│   ├── lib/                 # Dart source code (core theme, network, features)
│   ├── android/             # Native Android host & permissions
│   ├── ios/                 # Native iOS host & permissions
│   ├── test/                # Unit & widget test suites
│   └── pubspec.yaml         # Flutter dependencies and configuration
├── backend/                 # NestJS Authentication API root
│   ├── src/                 # Application source code (auth, stations, reports, prisma)
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

- **Flutter SDK**: 3.22+ (Dart 3.4+)
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

### 2. Mobile Setup (Flutter)

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   flutter pub get
   ```
3. Run tests and static analysis:
   ```bash
   flutter analyze
   flutter test
   ```
4. Run the mobile application:
   ```bash
   flutter run
   ```
   Pass custom backend or Supabase credentials if desired:
   ```bash
   flutter run --dart-define=API_URL=http://192.168.0.5:3000 --dart-define=SUPABASE_URL=https://<project>.supabase.co --dart-define=SUPABASE_ANON_KEY=<key>
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
