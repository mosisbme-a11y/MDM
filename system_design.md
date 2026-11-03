# System Design Document: Medical Device & Health Supply Chain Management Information System (MOH-SCMIS)

## 1. System Vision & Objectives
The Medical Device & Health Supply Chain Management Information System (MOH-SCMIS) is an enterprise-grade platform engineered to provide absolute visibility, zero-loss data persistence, and end-to-end traceability across national healthcare supply chains, medical equipment lifecycles, and health facility master rosters.

---

## 2. Architectural Design Principles
- **Modularity & Separation of Concerns**: Clean isolation between client-side rendering views, state management hooks, IndexedDB local caching, and backend API storage.
- **Resilient Persistence**: Multi-tier data architecture ensuring that bulk data uploads (such as Health Facility Master Lists) never clear or overwrite existing records without intelligent merge/upsert operations.
- **Enterprise UX/UI Standards**: Built using React 18, TypeScript, and Tailwind CSS adhering to zero-pill typographic hierarchy, crisp contrast ratios, and intuitive executive dashboards.

---

## 3. High-Level Component & Layered Design

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

## 4. Core Functional Subsystems

### A. Health Facility (HF) Master List & Roster Management
- **Entity Model (`HealthFacilityRecord`)**: Contains facility code, facility name, region, district, contact details, operational status, and `facilityType` (Hospital, Health Center, Clinic, Dispensary).
- **Safe Upload & Persistence Engine**: Automatically parses CSV/Excel/JSON bulk uploads, infers facility types, and executes smart upserts/merges to guarantee zero accidental data deletion.

### B. Stock on Hand (SOH) & Inventory Analytics
- Real-time aggregation of medical devices, consumables, and pharmaceuticals across warehouses and regional health facilities.
- Threshold-based low-stock alerts and expiry notification modals.

### C. Procurement & Contract Lifecycle Management
- Tracking supplier agreements, delivery milestones, funding sources, and fulfillment rates.

### D. Distribution Service Provider (DSP) & Pipeline Tracking
- End-to-end shipment monitoring from central medical stores to regional distribution points.

### E. Maintenance, Breakdown & Installation Management
- Logging medical equipment deliveries, commissioning status, maintenance schedules, and rapid breakdown repair requests.

---

## 5. Security, Authentication & Compliance
- **Authentication**: Firebase Authentication supporting secure user sessions and role-based permissions (RBAC).
- **API Security**: Server-side proxy endpoints protecting sensitive operations and preventing token leakage.
- **Auditability**: Immutable activity tracking for all master data uploads, inventory adjustments, and procurement approvals.

---

## 6. Deployment & Scalability
- **Runtime Environment**: Node.js backend with Vite middleware in development, compiled to optimized static assets and server entry point for production deployment.
- **Cloud Readiness**: Fully configured for cloud hosting platforms with persistent disk storage volumes and Firebase cloud database scalability.
