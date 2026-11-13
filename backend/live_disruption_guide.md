# Komutin — Live Disruption Integration Guide
**Architecture: Station-Centric Materialized State Engine (Event Sourcing + Live Profile)**

Welcome to the **Komutin Live Disruption** backend integration guide for the Flutter migration (`feat/live-disruptions-flutter`). This document outlines how live station states, reporting, symmetric resolution, and global feeds work.

> [!NOTE]
> **EVENT Section Status**: The `EVENT` category (mass gatherings, car-free days, concerts, protests) is currently **WIP (Work In Progress)** and is omitted from active station state processing. The live reporting engine currently focuses on operational states: `CROWD`, `DELAY`, `FACILITY`, and `DISRUPTION`.

---

## 1. Architectural Model

Rather than running slow, duplicated aggregation queries over raw report tickets on every read, Komutin uses a **Station-Centric Materialized State Engine**:
1. **Immutable Audit Log (`DisruptionReport`)**: Stores raw commuter submissions with geocoordinates, line context, and resolution flags.
2. **Materialized Live Profile (`StationLiveStatus`)**: Maintains an $O(1)$ materialized JSON profile for each station:
   - `crowdState`: Commuter crowd voting counts `{ low, medium, high, very_high, updatedAt }`.
   - `delayState`: Destination-indexed delay counts, top notes, and dynamic expiration.
   - `facilityState`: Subcategory-keyed facility health with 3-user consensus quorum (`PENDING_QUORUM` vs `BROKEN`).
   - `disruptionState`: Critical emergency alerts with 3-user quorum (`PENDING_QUORUM` vs `ACTIVE`), affected lines, and station bypass flags.

```
[ Commuter Submits Report ]
            │
            ├──> 1. Haversine Check (<= 500m radius)
            ├──> 2. Idempotency & Cooldown Verification
            ├──> 3. Write DisruptionReport (Audit Row)
            └──> 4. Atomic O(1) Upsert into StationLiveStatus (Materialized State)
```

---

## 2. Enums Reference

```typescript
export enum ReportCategory {
  CROWD = 'CROWD',
  DELAY = 'DELAY',
  FACILITY = 'FACILITY',
  DISRUPTION = 'DISRUPTION',
  // Note: EVENT is currently WIP
}

export enum ReportSubCategory {
  // CROWD
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',

  // DELAY
  MINOR = 'MINOR',   // < 5 minutes
  MEDIUM = 'MEDIUM', // 5 - 15 minutes
  MAJOR = 'MAJOR',   // > 15 minutes

  // FACILITY
  ESCALATOR = 'ESCALATOR',
  LIFT = 'LIFT',
  TAP_IN_OUT_GATE = 'TAP_IN_OUT_GATE',
  TOILET = 'TOILET',

  // DISRUPTION
  FLOOD_WEATHER = 'FLOOD_WEATHER',
  POWER_SIGNAL = 'POWER_SIGNAL',
  TRACK_INCIDENT = 'TRACK_INCIDENT',
  FIRE_SMOKE = 'FIRE_SMOKE',
  STATION_CLOSED = 'STATION_CLOSED',
  MEDICAL_SECURITY = 'MEDICAL_SECURITY',
}

export enum ReportStatus {
  PENDING_QUORUM = 'PENDING_QUORUM', // 1-2 reports (waiting for quorum)
  ACTIVE = 'ACTIVE',                 // 3+ reports confirmed live
  RESOLVED = 'RESOLVED',             // Cleared by consensus
  EXPIRED = 'EXPIRED',               // Passed TTL window
}
```

---

## 3. Anti-Spam Windows & State Quorum Rules

### a. Time-to-Live (TTL) & Anti-Spam Windows
| Category | Window / TTL | Idempotency / Anti-Spam Behavior |
| :--- | :--- | :--- |
| **`CROWD`** | 15 Minutes | If a user votes again within 15 minutes, their vote bucket is updated and the station counters are shifted (decrement old bucket, increment new bucket). Single vote per user. |
| **`DELAY`** | 45 Minutes | Single report per user per line and destination direction within 45m. Duplicate reports return `200 OK` with `{ status: "ALREADY_REPORTED" }`. |
| **`FACILITY`** | 2 Hours | Single report per user per facility subcategory within 2h. Duplicate reports return `200 OK` with `{ status: "ALREADY_REPORTED" }`. |
| **`DISRUPTION`** | 2 Hours | Single report per user per emergency subcategory within 2h. Duplicate reports return `200 OK` with `{ status: "ALREADY_REPORTED" }`. |

### b. Quorum Consensus
- **Activation Quorum**:
  - `FACILITY`: Starts as `PENDING_QUORUM`. When `reportCount >= 3`, flips to `BROKEN`.
  - `DISRUPTION`: Starts as `PENDING_QUORUM`. When `reportCount >= 3`, flips to `ACTIVE` and is broadcast on the global feed.
- **Resolution Quorum**:
  - When users submit `POST /stations/:id/resolve`, `resolvedCount` increments.
  - When `resolvedCount >= 3` (or `resolvedCount >= reportCount`), the active issue is **immediately purged** from `StationLiveStatus`.

### c. 15-Minute Crowd Decay
- `crowdState` automatically decays on read: if `updatedAt` is older than 15 minutes, crowd counters zero out and `currentCrowdLevel` defaults back to `NORMAL`.

### d. Deduplicated `topNotes`
- All notes across `DELAY`, `FACILITY`, and `DISRUPTION` are standardized as `topNotes: string[]` capped to the **3 most recent distinct notes** (case-insensitively deduplicated).

---

## 4. Endpoints Specifications

### Base URL & Authentication
- Base URL: `http://<SERVER_IP>:3000`
- Auth Header: `Authorization: Bearer <JWT_ACCESS_TOKEN>` *(Required on POST)*

---

### A. Submit a Live Disruption Report
- **Method & Route**: `POST /report`
- **Auth**: Required (`JwtAuthGuard`)
- **Geofence Check**: User coordinates must be within **500 meters** of the station; otherwise returns `400 Bad Request`.

#### Request Body (`CreateReportDto`)
```json
{
  "stationId": "cmw4tswkz0005vpj4cngldh1x",
  "category": "DELAY",
  "subCategory": "MEDIUM",
  "userLatitude": -6.186,
  "userLongitude": 106.8326,
  "lineName": "Bogor Line",
  "destinationStationId": "cmw4tswml000nvpj4v0r3196m",
  "note": "Antrean sinyal masuk stasiun",
  "isSkippedOrClosed": false
}
```

#### Category-Specific Field Rules:
- **`CROWD`**: Requires `stationId`, `category`, `subCategory` (`LOW` | `NORMAL` | `HIGH` | `VERY_HIGH`), `userLatitude`, `userLongitude`.
- **`DELAY`**: Strictly requires `destinationStationId` and `lineName` (or `lineId`). Rejects `"ALL:ALL"` fallbacks. Validates destination against `Station.validDestinations` and line against `Station.lineNames`.
- **`FACILITY`**: Requires facility `subCategory` (`ESCALATOR`, `LIFT`, `TAP_IN_OUT_GATE`, `TOILET`).
- **`DISRUPTION`**: Requires disruption `subCategory`. Optional `isSkippedOrClosed: true` flags train bypasses.

#### Success Responses
1. **Fresh Report**:
   ```json
   {
     "status": "SUCCESS",
     "report": {
       "id": "cmw50ab...",
       "stationId": "cmw4tswkz0005vpj4cngldh1x",
       "userId": "usr-123",
       "category": "DELAY",
       "subCategory": "MEDIUM",
       "note": "Antrean sinyal masuk stasiun",
       "lineId": "Bogor Line",
       "destinationStationId": "cmw4tswml000nvpj4v0r3196m",
       "isSkippedOrClosed": false,
       "isResolution": false,
       "status": "ACTIVE",
       "expiresAt": "2026-11-12T16:00:00.000Z",
       "createdAt": "2026-11-12T15:15:00.000Z"
     }
   }
   ```
2. **Crowd Vote Shift**:
   ```json
   {
     "status": "SUCCESS",
     "action": "CROWD_VOTE_UPDATED",
     "report": { ... }
   }
   ```
3. **Duplicate Submission Within Window**:
   ```json
   {
     "status": "ALREADY_REPORTED",
     "message": "You have already submitted an active delay report for this target."
   }
   ```

---

### B. Fetch Station Live Profile ($O(1)$ Flutter Tab View)
- **Canonical Endpoint**: `GET /stations/:id`
- **Alias Endpoint**: `GET /stations/:id/status` (or `GET /report/stations/:id/status`)
- **Auth**: None (Public)
- **Path Parameter**: `id` - Station ID
- **Design Note**: Consolidated into `GET /stations/:id` so Flutter gets the complete station metadata and computed live status (`crowd`, `delays`, `facilities`, `disruptions`) in a single network round-trip.

#### Success Response Example
```json
{
  "station": {
    "id": "cmw4tswkz0005vpj4cngldh1x",
    "name": "Stasiun Gondangdia",
    "isTransitHub": false,
    "supportedTypes": ["KRL"],
    "lineNames": ["Bogor Line"],
    "latitude": -6.186,
    "longitude": 106.8326,
    "validDestinations": ["cmw4tswml000nvpj4v0r3196m"],
    "createdAt": "2026-11-06T10:22:47.027Z",
    "updatedAt": "2026-11-12T03:58:50.130Z"
  },
  "crowd": {
    "currentCrowdLevel": "NORMAL",
    "isCrowdOverflow": false,
    "breakdown": {
      "low": 0,
      "medium": 4,
      "high": 1,
      "very_high": 0
    },
    "totalVotes": 5,
    "updatedAt": "2026-11-12T15:20:00.000Z"
  },
  "delays": {
    "Bogor Line:cmw4tswml000nvpj4v0r3196m": {
      "lineName": "Bogor Line",
      "lineId": "Bogor Line",
      "destinationStationId": "cmw4tswml000nvpj4v0r3196m",
      "destinationName": "Stasiun Bogor",
      "minorCount": 0,
      "mediumCount": 3,
      "majorCount": 0,
      "resolvedCount": 0,
      "topNotes": ["Antrean sinyal masuk stasiun", "Tertahan 10 menit"],
      "expiresAt": "2026-11-12T16:00:00.000Z"
    }
  },
  "facilities": {
    "ESCALATOR": {
      "subCategory": "ESCALATOR",
      "reportCount": 3,
      "resolvedCount": 0,
      "status": "BROKEN",
      "topNote": "Eskalator peron utara mati",
      "topNotes": ["Eskalator peron utara mati"],
      "lastReportedAt": "2026-11-12T15:10:00.000Z"
    }
  },
  "disruptions": {}
}
```

---

### C. Symmetric Issue Resolution ("Sudah Normal")
- **Method & Route**: `POST /stations/:id/resolve`
- **Auth**: Required (`JwtAuthGuard`)
- **Path Parameter**: `id` - Station ID

#### Request Body (`ResolveIssueDto`)
```json
{
  "category": "FACILITY",
  "targetKey": "ESCALATOR"
}
```
*Note on `targetKey`*:
- For `FACILITY` / `DISRUPTION`: Send the enum subCategory (e.g. `"ESCALATOR"`, `"FLOOD_WEATHER"`).
- For `DELAY`: Send the compound key `"{lineName}:{destinationStationId}"` (e.g. `"Bogor Line:cmw4tswml000nvpj4v0r3196m"`).

#### Success Responses
1. **Vote Counted towards Quorum**:
   ```json
   {
     "status": "SUCCESS",
     "action": "VOTED_NORMAL",
     "cleared": false,
     "targetKey": "ESCALATOR"
   }
   ```
2. **Issue Resolved & Cleared Immediately**:
   ```json
   {
     "status": "SUCCESS",
     "action": "CLEARED",
     "cleared": true,
     "targetKey": "ESCALATOR"
   }
   ```
3. **Already Resolved Within Active Window**:
   ```json
   {
     "status": "ALREADY_RESOLVED",
     "message": "You have already submitted a resolution for this issue."
   }
   ```

#### Error Responses
- **`400 Bad Request`**: Sent if `category === 'CROWD'` or invalid subcategory enum.
- **`404 Not Found`**: Sent if the station or target issue is not currently active in `StationLiveStatus`.

---

### D. Global Disruption Feed (Active Broadcasts)
- **Method & Route**: `GET /report/feed/global`
- **Auth**: None (Public)
- **Logic**: Returns flattened alert cards for issues with `status === "ACTIVE"` and `expiresAt > now`. Does not dump raw report tickets.

#### Success Response Example
```json
[
  {
    "id": "cmw4tswkz0005vpj4cngldh1x-FLOOD_WEATHER",
    "stationId": "cmw4tswkz0005vpj4cngldh1x",
    "stationName": "Stasiun Gondangdia",
    "category": "DISRUPTION",
    "subCategory": "FLOOD_WEATHER",
    "headline": "Banjir / Cuaca Ekstrem di Stasiun Gondangdia",
    "isSkippedOrClosed": true,
    "reportCount": 5,
    "topNote": "Genangan air di area peron 1",
    "topNotes": ["Genangan air di area peron 1", "Kereta berjalan lambat"],
    "affectedLineIds": ["Bogor Line"],
    "status": "ACTIVE",
    "startedAt": "2026-11-12T14:30:00.000Z",
    "expiresAt": "2026-11-12T16:30:00.000Z",
    "updatedAt": "2026-11-12T15:00:00.000Z"
  }
]
```

---

## 5. Flutter Integration Flow

```
[ Commuter at Station / Checking Line ]
           │
           ├── 1. Get Live Station View:
           │      └── Call GET /stations/:id (or GET /stations/:id/status)
           │          ├── Display Crowd Density Gauge (LOW/NORMAL/HIGH/VERY_HIGH)
           │          ├── Display Directional Delays by Terminus (Bogor Line -> Stasiun Bogor)
           │          └── Display Broken Facilities with topNotes
           │
           ├── 2. User Submits Report:
           │      ├── Ensure device GPS is within 500m
           │      └── Call POST /report with coordinates & category payload
           │
           ├── 3. User Confirms Issue Normal ("Sudah Normal"):
           │      └── Call POST /stations/:id/resolve
           │          └── UI clears issue card when cleared: true
           │
           └── 4. Main App Bar / Emergency Banner:
                  └── Call GET /report/feed/global
                      └── Displays active alerts (headline + isSkippedOrClosed badge)
```
