# System Architecture

This document describes the deployed application structure and the data model defined in `backend-express/prisma/schema.prisma`. The backend is a Bun-hosted Express and TypeScript API, the frontend is a React application built with Vite, and PostgreSQL is accessed through Prisma 7.

## System context

```mermaid
flowchart LR
  Employee[Employee browser]
  Resident[Resident browser]
  Frontend[React + Vite frontend]
  API[Express API<br/>Bun + TypeScript]
  WS[WebSocket notification endpoint]
  DB[(PostgreSQL)]
  SMTP[SMTP mail provider]
  Proxy[Caddy reverse proxy]

  Employee -->|HTTPS| Proxy
  Resident -->|HTTPS| Proxy
  Proxy --> Frontend
  Frontend -->|HTTP JSON<br/>httpOnly cookie| API
  Frontend <-->|WebSocket<br/>single-use ticket| WS
  API -->|Prisma 7| DB
  WS --> API
  API -->|email delivery| SMTP
```

In the Compose deployment, Caddy is the public entry point; it serves the frontend and routes application traffic within the Docker network. The frontend sends API requests with browser credentials enabled. API CORS is configured from `CORS_ORIGINS`. The HTTP server also upgrades `/ws/notifications` requests to authenticated WebSocket connections.

## Application components

```mermaid
flowchart TB
  subgraph Client[Frontend: React + Vite]
    Pages[Employee and resident pages]
    Auth[AuthProvider and protected routes]
    ApiClient[API client<br/>fetch + credentials include]
    Socket[Notification WebSocket client]
    Pages --> Auth
    Pages --> ApiClient
    Pages --> Socket
  end

  subgraph Server[Backend: Bun + Express + TypeScript]
    Entry[server.ts<br/>middleware, HTTP server, route mounting]
    Routes[Express route modules]
    Guards[Authentication and permission middleware]
    Controllers[Controllers]
    Services[Audit, notification, email, settings services]
    Ticket[Single-use socket tickets]
    Entry --> Routes
    Routes --> Guards
    Guards --> Controllers
    Controllers --> Services
    Entry --> Ticket
  end

  Prisma[Prisma 7 client]
  Database[(PostgreSQL)]
  Mail[SMTP]
  Client -->|JSON over HTTP| Entry
  Client <-->|WebSocket events| Entry
  Controllers --> Prisma
  Services --> Prisma
  Prisma --> Database
  Services --> Mail
```

The API mounts routers under `/api`: auth, employees, roles, sites, permissions, locations, rooms, beds, notifications, audit logs, room allocations, residents, bookings, dashboard, and email logs. Authentication and authorization middleware protect routes according to account type and permissions. The frontend applies matching route guards for employee pages. The schema also contains complaint and rating data models.

## Request and data flows

### Authenticated API request

```mermaid
sequenceDiagram
  actor User
  participant UI as React page
  participant Client as API client
  participant API as Express route/controller
  participant Guard as Auth/permission middleware
  participant Prisma
  participant DB as PostgreSQL

  User->>UI: Perform an action or load data
  UI->>Client: Call API endpoint
  Client->>API: HTTP request with credentials
  API->>Guard: Validate session and access
  alt Session or permission is invalid
    Guard-->>Client: HTTP error response
    Client-->>UI: Reject with status and message
  else Request is allowed
    Guard->>API: Continue request
    API->>Prisma: Read or change records
    Prisma->>DB: Parameterized database operation
    DB-->>Prisma: Result
    Prisma-->>API: Typed records
    API-->>Client: JSON response
    Client-->>UI: Resolve response
  end
```

### Booking lifecycle and side effects

```mermaid
flowchart LR
  Staff[Authorized staff or resident] --> BookingAPI[Booking API]
  BookingAPI --> Check[Validate request and access]
  Check -->|valid| Booking[Create or update booking]
  Check -->|invalid| Error[Return error]
  Booking --> DB[(PostgreSQL via Prisma)]
  Booking --> Event[Booking event history]
  Booking --> Audit[Audit log where action is audited]
  Booking --> Notify[Create notification]
  Notify --> NotificationDB[(Notification records)]
  Notify --> Online{User connected?}
  Online -->|yes| Push[Push notification event over WebSocket]
  Online -->|no| Later[Notification remains available to fetch]
  Booking --> Email[Send relevant email via SMTP]
  Email --> EmailLog[Record email delivery status]
  Event --> DB
  Audit --> DB
  NotificationDB --> DB
  EmailLog --> DB
```

Booking records connect residents to beds and preserve lifecycle timestamps and status. Home-leave records and booking events capture related lifecycle information. Email, notification, and audit records provide operational history. Specific side effects depend on the endpoint and action.

### Notification connection

```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as Express API
  participant Tickets as Socket ticket store
  participant WS as WebSocket endpoint
  participant DB as PostgreSQL

  UI->>API: Request single-use socket ticket
  API->>Tickets: Issue ticket for authenticated user
  API-->>UI: Ticket
  UI->>WS: Upgrade /ws/notifications?ticket=...
  WS->>Tickets: Consume and validate ticket
  alt Ticket valid
    WS-->>UI: Connected event
    API->>DB: Persist notification
    API->>WS: Send notification:new to user's sockets
    WS-->>UI: notification:new event
  else Ticket missing or invalid
    WS-->>UI: Reject upgrade (401)
  end
```

PostgreSQL is the durable source for notifications. If a user has no active socket connection, the notification service does not push it; the user can retrieve it later through the notification API.

## Entity relationship diagram

The ERD follows Prisma relations. `||--o{` denotes one-to-many, `||--o|` one-to-zero-or-one, and `}o--o{` denotes many-to-many through the named join entity. Fields shown are identifiers and relationship keys, with selected domain fields for readability.

```mermaid
erDiagram
  USER {
    string id PK
    string email UK
    string password
    boolean isActive
  }
  SITE {
    string id PK
    string name UK
    string code UK
  }
  EMPLOYEE {
    string id PK
    string userId FK,UK
    string siteId FK
    string name
  }
  RESIDENT {
    string id PK
    string userId FK,UK
    string siteId FK
    string fullName
    string phone
  }
  ROLE {
    string id PK
    string siteId FK
    string name UK
  }
  PERMISSION {
    string id PK
    string name UK
  }
  EMPLOYEE_ROLE {
    string employeeId PK,FK
    string roleId PK,FK
  }
  ROLE_PERMISSION {
    string roleId PK,FK
    string permissionId PK,FK
  }
  EMPLOYEE_PERMISSION {
    string employeeId PK,FK
    string permissionId PK,FK
  }
  LOCATION {
    string id PK
    string siteId FK
    string name
  }
  FLOOR {
    string id PK
    string locationId FK
    int floorNumber
  }
  ROOM {
    string id PK
    string floorId FK
    string name
    boolean isBookable
  }
  BED {
    string id PK
    string roomId FK
    string name
    enum status
  }
  ROOM_ALLOCATION {
    string id PK
    string roomId FK,UK
    string purpose
  }
  BOOKING {
    string id PK
    string bookingNumber UK
    string residentId FK
    string bedId FK
    datetime startedAt
    datetime endedAt
    enum status
  }
  HOME_LEAVE {
    string id PK
    string bookingId FK
    datetime startedAt
    datetime expectedReturnAt
    enum status
  }
  BOOKING_EVENT {
    string id PK
    string bookingId FK
    string actorUserId FK
    string action
  }
  COMPLAINT {
    string id PK
    string bookingId FK
    string assignedToId FK
    enum status
    enum priority
  }
  COMPLAINT_MESSAGE {
    string id PK
    string complaintId FK
    string userId FK
    boolean isInternal
  }
  BOOKING_RATING {
    string id PK
    string bookingId FK,UK
    int score
  }
  NOTIFICATION {
    string id PK
    string userId FK
    boolean isRead
    string type
  }
  AUDIT_LOG {
    string id PK
    string actorUserId FK
    string resource
    string action
  }
  EMAIL_LOG {
    string id PK
    string userId FK
    string bookingId FK
    string siteId FK
    enum status
  }
  SYSTEM_SETTING {
    string key PK
    string value
  }

  USER ||--o| EMPLOYEE : account
  USER ||--o| RESIDENT : account
  SITE o|--o{ EMPLOYEE : scopes
  SITE o|--o{ ROLE : scopes
  SITE ||--o{ RESIDENT : serves
  SITE ||--o{ LOCATION : contains
  EMPLOYEE ||--o{ EMPLOYEE_ROLE : assigned
  ROLE ||--o{ EMPLOYEE_ROLE : includes
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : included
  EMPLOYEE ||--o{ EMPLOYEE_PERMISSION : overrides
  PERMISSION ||--o{ EMPLOYEE_PERMISSION : assigned
  LOCATION ||--o{ FLOOR : contains
  FLOOR ||--o{ ROOM : contains
  ROOM ||--o{ BED : contains
  ROOM ||--o| ROOM_ALLOCATION : allocated
  RESIDENT ||--o{ BOOKING : makes
  BED ||--o{ BOOKING : reserved
  BOOKING ||--o{ HOME_LEAVE : records
  BOOKING ||--o{ BOOKING_EVENT : records
  USER o|--o{ BOOKING_EVENT : acts
  BOOKING ||--o{ COMPLAINT : concerns
  EMPLOYEE o|--o{ COMPLAINT : assigned
  COMPLAINT ||--o{ COMPLAINT_MESSAGE : contains
  USER ||--o{ COMPLAINT_MESSAGE : writes
  BOOKING ||--o| BOOKING_RATING : receives
  USER ||--o{ NOTIFICATION : receives
  USER o|--o{ AUDIT_LOG : performs
  USER o|--o{ EMAIL_LOG : associated
  BOOKING o|--o{ EMAIL_LOG : associated
  SITE o|--o{ EMAIL_LOG : associated
```

## Data ownership and key relationships

- A `User` is an authentication account and may be linked one-to-one to an `Employee` or `Resident` profile. Users also own notifications and may be referenced as actors, authors, or email recipients.
- Employees can belong to a site and receive roles and direct permissions. Roles can be site-scoped and grant permissions. The two join models allow multiple roles/permissions per employee.
- The physical hierarchy is `Site → Location → Floor → Room → Bed`. Rooms may have one optional `RoomAllocation`; each bed can have multiple booking records over time.
- A booking belongs to one resident and one bed. It can have home leaves, lifecycle events, complaints, email records, and at most one rating. Complaint threads contain messages and may be assigned to an employee.
- `AuditLog`, `Notification`, and `EmailLog` store operational records. `SystemSetting` stores application settings as key/value entries and has no foreign-key relation.

## Runtime and deployment

`backend-express/src/server.ts` creates the Express app and HTTP server, registers JSON and cookie parsing plus credentialed CORS, mounts API routers, and initializes the notification WebSocket handler. The API defaults to port `5000`. Prisma connects to PostgreSQL using `DATABASE_URL`; SMTP configuration is supplied through environment variables.

The Compose stack defines Caddy, frontend, backend, and PostgreSQL services on a private bridge network. PostgreSQL data is persisted in a named volume. Caddy and frontend are exposed to clients; backend and database are internal services. The frontend can use `VITE_API_BASE_URL`; when unset it uses same-origin requests in production and `http://localhost:5000` in development.
