# Komutin — Live Disruption Integration Guide

Welcome to the **Komutin Live Disruption** API reference and integration guide. This document details how to integrate reporting, upvoting, station status views, and global disruption feeds into the mobile/web UI.

---

## 1. Overview

### a. Visibility Levels
- **Global (`GLOBAL`)**: `DISRUPTION` and `EVENT` categories. Displayed on the main global live disruption feed and active route banners.
- **Line-Targeted (`LINE_TARGETED`)**: `DELAY` category. Indexed by line and destination station (`destinationStationId` / `destinationLabel`). Surfaced to commuters whose route overlaps with the line/section.
- **Local / Contextual (`LOCAL_CONTEXTUAL`)**: `CROWD` and `FACILITY` categories. Excluded from the main global feed. Shown only in the **Station Status** tab or when a user is physically at the station/routing through it.

### b. Expiration & Time-To-Live (TTL)
| Category | Default TTL | Behavior / Expiration Logic |
| :--- | :--- | :--- |
| **`CROWD`** | 15 Minutes | Expires automatically. 80%+ "High" reports in 30 mins trigger `CROWD_OVERFLOW`. |
| **`DELAY`** | 30 Minutes | Each upvote extends `expiresAt` by **+15 minutes**. |
| **`FACILITY`** | 7 Days | Stored under Station Details. Auto-expires if unconfirmed after 7 days. |
| **`DISRUPTION`** | 24 Hours | Critical emergency alerts (e.g., Station Closure, Signal Failure). |
| **`EVENT`** | 24 Hours | System-wide events (e.g., CFD, Protests, Concerts). |

### c. Geofencing & Location Verification
- Submitting a report requires the user to be within **500 meters** of the specified station.
- If the frontend passes `userLatitude` and `userLongitude` without a `stationId`, the backend automatically resolves the closest station within 500m.
- Upvoting is **not** geofenced and can be done straight from the feeds.

---

## 2. Enums Reference

Make sure to align your frontend types/interfaces with the following Prisma enums:

```typescript
export enum ReportCategory {
  CROWD = 'CROWD',
  DELAY = 'DELAY',
  FACILITY = 'FACILITY',
  DISRUPTION = 'DISRUPTION',
  EVENT = 'EVENT'
}

export enum ReportSubCategory {
  // CROWD
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CROWD_OVERFLOW = 'CROWD_OVERFLOW',
  
  // DELAY
  MINOR = 'MINOR',   // < 5 mins
  MEDIUM = 'MEDIUM', // 5-15 mins
  MAJOR = 'MAJOR',   // > 15 mins

  // FACILITY
  ESCALATOR = 'ESCALATOR',
  LIFT = 'LIFT',
  TAP_GATE = 'TAP_GATE',
  AC = 'AC',
  TOILET = 'TOILET',
  SAFETY_SECURITY = 'SAFETY_SECURITY',

  // DISRUPTION
  STATION_CLOSURE = 'STATION_CLOSURE',
  TRACK_FLOODING = 'TRACK_FLOODING',
  STATION_FLOODING = 'STATION_FLOODING',
  SIGNAL_FAILURE = 'SIGNAL_FAILURE',
  POWER_OUTAGE = 'POWER_OUTAGE',
  ACCIDENT = 'ACCIDENT',

  // EVENT
  DEMONSTRATION = 'DEMONSTRATION',
  CAR_FREE_DAY = 'CAR_FREE_DAY',
  CONCERT = 'CONCERT',
  ROUTE_ALTERATION = 'ROUTE_ALTERATION'
}

export enum ImpactLevel {
  SINGLE_VEHICLE = 'SINGLE_VEHICLE',
  STATION_ONLY = 'STATION_ONLY',
  LINE_SECTION = 'LINE_SECTION',
  ENTIRE_LINE = 'ENTIRE_LINE'
}

export enum TrackDirectionScope {
  DIRECTIONAL = 'DIRECTIONAL',
  BOTH_WAYS = 'BOTH_WAYS'
}

export enum ReportStatus {
  ACTIVE = 'ACTIVE',
  VERIFIED = 'VERIFIED', // Set automatically when upvoteCount >= 10
  RESOLVED = 'RESOLVED',
  EXPIRED = 'EXPIRED'
}
```

---

## 3. Directional Context UI Mapping

Do **NOT** present raw backend/internal values like `INBOUND` or `OUTBOUND` to users. Map them cleanly to destination labels:

* **KRL Bogor Line**:
  * Inbound Direction $\rightarrow$ `"Arah Jakarta Kota"`
  * Outbound Direction $\rightarrow$ `"Arah Bogor"`
  * Both Directions $\rightarrow$ Set `trackScope: "BOTH_WAYS"`
* **TransJakarta Corridor 1**:
  * Inbound Direction $\rightarrow$ `"Arah Kota"`
  * Outbound Direction $\rightarrow$ `"Arah Blok M"`

---

## 4. Endpoints Specifications

### Base Path & Headers
- Base URL Prefix: `/report` or `/reports` (or `/disruptions`)
- Auth Header: `Authorization: Bearer <JWT_TOKEN>` *(Required for POST endpoints)*

---

### a. Submit a Disruption Report
- **Endpoint**: `POST /report`
- **Auth Required**: Yes (`JwtAuthGuard`)
- **Success Status**: `201 Created`

#### Payload (`CreateReportDto`)
```json
{
  "title": "Gangguan Sinyal Kebayoran",
  "category": "DISRUPTION",
  "subCategory": "SIGNAL_FAILURE",
  "impactLevel": "LINE_SECTION",
  "stationId": "station-uuid-123",            // Optional if user coordinates are provided
  "userLatitude": -6.2384,                     // Latitude (or "latitude")
  "userLongitude": 106.7845,                   // Longitude (or "longitude")
  "radius": 500,                               // Optional, defaults to 500m
  "trackScope": "DIRECTIONAL",                 // "DIRECTIONAL" | "BOTH_WAYS"
  "destinationStationId": "station-uuid-456",  // Optional target station
  "destinationLabel": "Arah Tanah Abang",      // UI directional label
  "description": "Kereta tertahan di luar stasiun Kebayoran."
}
```

#### Success Response Example
```json
{
  "id": "report-uuid-999",
  "stationId": "station-uuid-123",
  "userId": "user-uuid-888",
  "title": "Gangguan Sinyal Kebayoran",
  "category": "DISRUPTION",
  "subCategory": "SIGNAL_FAILURE",
  "impactLevel": "LINE_SECTION",
  "trackScope": "DIRECTIONAL",
  "destinationStationId": "station-uuid-456",
  "destinationLabel": "Arah Tanah Abang",
  "description": "Kereta tertahan di luar stasiun Kebayoran.",
  "visibility": "GLOBAL",
  "status": "ACTIVE",
  "upvoteCount": 0,
  "expiresAt": "2026-11-07T13:36:00.000Z",
  "createdAt": "2026-11-06T13:36:00.000Z",
  "distanceMeters": 120,
  "station": {
    "id": "station-uuid-123",
    "name": "Stasiun Kebayoran"
  }
}
```

#### Error Responses
- **`400 Bad Request`**: Submitter is outside the 500m station radius or missing latitude/longitude pair.
- **`404 Not Found`**: Station or transit node not found.

---

### b. Fetch Global & Active Feed
Use this endpoint for loading the main **Live Disruption Home Feed** and active travel planning alerts.

- **Endpoint**: `GET /report/all`
- **Auth Required**: No
- **Query Parameters**:
  - `stationId` *(optional)*: Filter crowd status for a target station.
  - `lineId` *(optional)*: Filter line delays.
  - `destinationStationId` *(optional)*: Filter line delays bound for a specific station.

#### Response Structure
```json
{
  "globalDisruptions": [
    /* Array of DISRUPTION, EVENT, or GLOBAL visibility reports */
  ],
  "lineDelays": [
    /* Array of active DELAY reports */
  ],
  "destinationIndexedDelays": {
    "station-uuid-456": [ /* Delays grouped by target destination */ ],
    "unspecified": []
  },
  "crowdStatus": [
    /* Active CROWD reports matching query filters */
  ],
  "reports": [
    /* Complete list of active non-expired reports */
  ]
}
```

---

### c. Fetch Station Details & Facility Reports
Use this endpoint when rendering a **Station Details Page / Tab**.

- **Endpoint**: `GET /report/stations/:id/reports`
- **Auth Required**: No
- **Path Parameter**: `id` - Station UUID

#### Response Structure
```json
{
  "station": {
    "id": "station-uuid-123",
    "name": "Stasiun Manggarai"
  },
  "facilityReports": [
    {
      "id": "rep-1",
      "category": "FACILITY",
      "subCategory": "ESCALATOR",
      "title": "Eskalator Peron 3-4 Matot",
      "createdAt": "2026-11-05T10:00:00.000Z"
    }
  ],
  "crowdStats": {
    "stationId": "station-uuid-123",
    "stationName": "Stasiun Manggarai",
    "totalReports": 12,
    "recentReportsCount": 8,
    "currentCrowdLevel": "CROWD_OVERFLOW",
    "isCrowdOverflow": true,
    "breakdown": {
      "low": 0,
      "normal": 1,
      "high": 3,
      "crowdOverflow": 4
    },
    "recentCrowdReports": [ /* Reports from the past 30 mins */ ]
  },
  "reports": [ /* All non-expired reports for this station */ ]
}
```

---

### d. Toggle Report Upvote
Allows users to upvote or remove an upvote directly from any feed tab.

- **Endpoint**: `POST /report/:id/upvote`
- **Auth Required**: Yes (`JwtAuthGuard`)
- **Path Parameter**: `id` - Report UUID

#### Dynamics & Rules:
1. **Toggle Behavior**: Tapping upvote again removes your upvote (`upvoted: false`).
2. **TTL Extension**: If category is `DELAY`, every upvote extends `expiresAt` by **+15 minutes**.
3. **Verification Upgrade**: Reaching **10 upvotes** automatically changes status to `VERIFIED`.

#### Response Example
```json
// First tap:
{
  "upvoted": true,
  "message": "Report upvoted successfully"
}

// Second tap (toggle off):
{
  "upvoted": false,
  "message": "Upvote removed"
}
```

---

### e. Query / Search Reports List
General utility endpoint to query reports with pagination.

- **Endpoint**: `GET /report`
- **Auth Required**: No
- **Query Parameters**:
  - `stationId` *(optional)*
  - `category` *(optional)*: `CROWD` | `DELAY` | `FACILITY` | `DISRUPTION` | `EVENT`
  - `status` *(optional)*: `ACTIVE` | `VERIFIED` | `RESOLVED` | `EXPIRED`
  - `limit` *(optional)*: Default `20`
  - `offset` *(optional)*: Default `0`

---

## 5. Frontend UI/UX Integration Steps

```
[User Opens App / Screen]
          │
          ├──> 1. Request GPS Coordinates (Haversine Check)
          │
          ├──> 2. Render Main Feed ─────────> Call GET /report/all
          │                                  ├── Display globalDisruptions on top banner
          │                                  └── Display lineDelays in transit feed
          │
          ├──> 3. User Opens Station Page ──> Call GET /report/stations/:id/reports
          │                                  ├── Show facility status ("Masih Rusak?")
          │                                  └── Show live Crowd Gauge (LOW/NORMAL/HIGH/OVERFLOW)
          │
          └──> 4. User Submits Report ─────> Call POST /report
                                             ├── Verify proximity (< 500m)
                                             └── Award +10 Commuter Points
```