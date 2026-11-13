# Komutin Backend API Endpoint Reference

This document provides a clean, consolidated reference for all active endpoints in the Komutin backend after the Step 1 & 2 Station-Centric Materialized State refactor and legacy route pruning.

---

## 1. Route Summary Table

| Module | Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **App** | `GET` | `/` | Public | System health check ("Hello World!") |
| **Auth** | `POST` | `/auth/signup` | Public | Register a new commuter account |
| **Auth** | `POST` | `/auth/login` | Public | Login with credentials and receive JWT Access & Refresh tokens |
| **Auth** | `POST` | `/auth/refresh` | Public | Rotate / refresh an expired access token |
| **Auth** | `POST` | `/auth/logout` | JWT | Logout and invalidate active refresh session |
| **Auth** | `GET` | `/auth/me` | JWT | Get current authenticated user profile & role |
| **Stations** | `POST` | `/stations/nearby` | Public | Locate stations within geofence radius ($500\text{m}$) of user GPS coordinates |
| **Stations** | `GET` | `/stations` | Public | List all 115 transit stations across Jabodetabek |
| **Stations** | `GET` | `/stations/:id` | Public | **Canonical Station Profile**: Metadata (`validDestinations`) + live status (`crowd`, `delays`, `facilities`, `disruptions`) |
| **Stations** | `POST` | `/stations/:id/resolve` | JWT | **Symmetric Resolution**: Vote issue resolved ("Sudah Normal") with quorum threshold |
| **Stations** | `GET` | `/stations/:id/reports` | Public | Station audit log history of reports |
| **Stations** | `POST` | `/stations` | JWT/Admin | Create new station (admin) |
| **Report** | `POST` | `/report` | JWT | **Atomic Write Engine**: Submit report with 500m geofence, anti-spam TTL, quorum, & materialization |
| **Report** | `GET` | `/report/feed/global` | Public | **Active Alerts Feed**: Global ticker banner of active emergencies, closures, and disruptions |
| **Report** | `GET` | `/report` | Public | Query raw disruption report audit logs (optional filters: `stationId`, `category`, `status`, pagination) |
| **Report** | `GET` | `/report/:id` | Public | Fetch a single disruption report audit log row by ID |

---

## 2. Core Flutter Consumer Flows

### A. Geolocation & Home Nearby Detection
```http
POST /stations/nearby
Content-Type: application/json

{
  "latitude": -6.2099,
  "longitude": 106.8497,
  "radius": 500
}
```

### B. View Station Live Status Profile ($O(1)$)
```http
GET /stations/:id
```
Returns:
- Complete station metadata (including `validDestinations` formatted with `lineName`, `destinationStationId`, and `destinationName`).
- Materialized `crowd` breakdown and level (`LOW`, `NORMAL`, `HIGH`, `VERY_HIGH`).
- Materialized `delays` keyed strictly by `${lineName}:${destinationStationId}`.
- Materialized `facilities` keyed by subcategory (e.g. `ESCALATOR`, `ELEVATOR`).
- Materialized `disruptions` keyed by emergency subcategory (e.g. `FLOOD_WEATHER`, `SIGNAL_POWER`).

### C. Submit Live Report
```http
POST /report
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "stationId": "cmw4tswm2000hvpj4qpddhzcf",
  "category": "DELAY",
  "subCategory": "MAJOR",
  "userLatitude": -6.3691,
  "userLongitude": 106.8321,
  "lineName": "Bogor Line",
  "destinationStationId": "cmw4tswml000nvpj4v0r3196m",
  "note": "kereta tertahan"
}
```

### D. Vote Issue Resolved
```http
POST /stations/:id/resolve
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "category": "FACILITY",
  "targetKey": "ESCALATOR"
}
```

### E. Global Emergency Alert Ticker
```http
GET /report/feed/global
```
Returns array of active emergency alert cards for the app bar or banner.
