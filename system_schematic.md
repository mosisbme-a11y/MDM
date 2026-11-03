# Detailed System Schematic & Architecture Blueprint

## 1. High-Level Enterprise System Architecture

```
+------------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER                                    |
|              React 18 SPA | TypeScript | Tailwind CSS (Zero-Pill Typography)             |
+------------------------------------------------------------------------------------------+
                                              |
                     +------------------------+------------------------+
                     |                        |                        |
                     v                        v                        v
+--------------------------+  +----------------------+  +--------------------------+
|     UI VIEW MODULES      |  |   CLIENT STATE &     |  |    GOOGLE WORKSPACE      |
| - Health Facility Master |  |   INDEXEDDB CACHE    |  |    INTEGRATION SDK       |
| - SOH & Inventory        |  | - Client-side SOH    |  | - Google Sheets Sync     |
| - Procurement & DSP      |  | - Master Roster Cache|  | - Gmail Notifications    |
| - Executive Dashboards   |  | - Offline Resilience |  | - Drive Document Archive |
+--------------------------+  +----------------------+  +--------------------------+
                     |                        |                        |
                     +------------------------+------------------------+
                                              |
                                              v
+------------------------------------------------------------------------------------------+
|                                     API & ROUTING LAYER                                  |
|                         Node.js / Express Server (Port 3000)                             |
|          Vite Middleware Integration (Dev) | RESTful Endpoints (`/api/*`)                |
+------------------------------------------------------------------------------------------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
+------------------------------------------+    +------------------------------------------+
|         SERVER DISK PERSISTENCE          |    |       FIREBASE AUTH & FIRESTORE          |
| - `/api/hf-master-list` (Smart Merge)    |    | - User Authentication & Sessions         |
| - `/api/inventory` / `/api/receiving`    |    | - Realtime Cloud Security Rules          |
| - JSON-backed robust file storage        |    | - Enterprise RBAC Enforcements           |
+------------------------------------------+    +------------------------------------------+
```

---

## 2. Health Facility Master List & Data Persistence Pipeline

*This schematic illustrates how data flows from user uploads into persistent storage without data loss or accidental overwrites.*

```
+-------------------+
| Spreadsheet Upload|  (.xlsx / .csv / .json)
+-------------------+
          |
          v
+-------------------+
|  Auto-Mapping &   |  -> Detects facilityCode, facilityName, region, facilityType
| Inference Engine  |  -> Infers missing 'facilityType' (Hospital, Health Center, Clinic)
+-------------------+
          |
          v
+-------------------------------------------------------------------+
|                     SMART MERGE & UPSERT LOGIC                    |
|  - Compares incoming records with existing system records         |
|  - Updates matching entries (by Code/Name)                        |
|  - Appends new entries without truncating existing data           |
+-------------------------------------------------------------------+
          |
          +---------------------------------+
          |                                 |
          v                                 v
+-------------------------+       +-------------------------+
|     CLIENT INDEXEDDB    |       |   SERVER DISK STORAGE   |
|   `hf_master_list`      |       |   `/api/hf-master-list` |
|   Offline Fast Cache    |       |   Durable JSON Backend  |
+-------------------------+       +-------------------------+
```

---

## 3. Core Functional Module Interconnected Schema

```
                    +------------------------------------+
                    |    Health Facility Master List     |
                    |  (Hospitals, Health Centers, etc.) |
                    +------------------------------------+
                       /             |             \
                      /              |              \
                     v               v               v
        +-------------------+ +-------------+ +--------------------+
        | Stock on Hand     | | Procurement | | Installation &     |
        | & Inventory (SOH) | | & Contracts | | Maintenance (Bkd)  |
        +-------------------+ +-------------+ +--------------------+
                 \                   |                   /
                  \                  |                  /
                   v                 v                 v
            +--------------------------------------------------+
            |        DSP (Distribution Service Provider)       |
            |        & Supply Chain Pipeline Tracking          |
            +--------------------------------------------------+
                                     |
                                     v
            +--------------------------------------------------+
            |        Executive & Management Analytics          |
            |   (KPI Cards, Expiry Alerts, Regional Matrices)  |
            +--------------------------------------------------+
```

---

## 4. Key Technical & Architectural Benefits for Presentation

1. **Decoupled Client-Server Reliability**: The frontend communicates via robust REST endpoints while maintaining local IndexedDB snapshots to ensure uninterrupted operations even under intermittent network connectivity.
2. **Zero-Loss Data Preservation**: Eliminates traditional risk of table truncation during bulk data uploads through intelligent server-side and client-side merge routines.
3. **Enterprise Scalability**: Modular React architecture permits independent scaling and feature expansion across inventory, procurement, and clinical engineering workflows without performance degradation.
4. **Secure Cloud & Workspace Interoperability**: Direct API connections for Google Workspace and Firebase auth provide seamless collaboration without exposing database credentials.
