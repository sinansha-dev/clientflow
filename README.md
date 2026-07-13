# ClientFlow 🚀

ClientFlow is an enterprise-grade, all-in-one Agency Management and Client Collaboration portal. Designed as a high-performance monorepo, ClientFlow streamlines agency operations by uniting Customer Relationship Management (CRM), project planning, tasks execution, financial invoicing, team scheduling, and interactive client communication within a unified platform.

---

## 🏗️ Project Architecture

ClientFlow is structured as a TypeScript monorepo using **npm workspaces**. This setup ensures that types, database schemas, and business logic are shared seamlessly between the client interface and server.

```mermaid
graph TD
    ClientApp[React Web App <br> apps/web] -->|HTTP / Cookies| ExpressAPI[Express Rest API <br> apps/api]
    ExpressAPI -->|Prisma Client| PostgreSQL[(PostgreSQL <br> DB)]

    SharedTypes[Types package <br> packages/types] -.-> ClientApp
    SharedTypes -.-> ExpressAPI

    SharedValidation[Shared Package <br> packages/shared <br> RBAC & Zod Schemas] -.-> ClientApp
    SharedValidation -.-> ExpressAPI

    SharedUI[UI package <br> packages/ui] -.-> ClientApp
```

### Monorepo Workspaces Layout

```
clientflow/
├── apps/
│   ├── api/                 # Express backend REST API (TypeScript + Prisma)
│   └── web/                 # React frontend SPA (Vite + TS + TailwindCSS)
├── packages/
│   ├── shared/              # Shared Zod validation schemas & RBAC utilities
│   ├── types/               # Common TypeScript interface definitions
│   └── ui/                  # Shared UI styling and Tailwind helpers
├── prisma/
│   ├── schema.prisma        # Centralized Prisma Database Schema
│   └── migrations/          # PostgreSQL schema migrations
├── docker/                  # Docker files for microservices deployment
└── docker-compose.yml       # Docker Compose setup for localized PostgreSQL & services
```

---

## ⚡ Tech Stack Summary

| Layer                  | Technologies & Libraries                       | Description                                                        |
| :--------------------- | :--------------------------------------------- | :----------------------------------------------------------------- |
| **Frontend**           | React 18, Vite 8, React Router v6, TailwindCSS | Fast single-page application with reactive design.                 |
| **State & Queries**    | Zustand, TanStack React Query, Axios           | client-side cache management, global store, and api fetching.      |
| **Animation & Icons**  | Framer Motion, Lucide React                    | Micro-interactions, transitions, and sleek icon assets.            |
| **Backend API**        | Node.js, Express, TSX, TypeScript              | REST API server with strong typing and fast execution.             |
| **Database & ORM**     | PostgreSQL 16, Prisma ORM                      | Secure relational database mapping and migrations.                 |
| **Security & Logging** | Helmet, CORS, Express-Rate-Limit, Pino, Bcrypt | Standard security headers, request protection, and secure logging. |
| **Validation**         | Zod                                            | Runtime type safety and form validators shared end-to-end.         |

---

## 🌟 Core Features

### 👤 1. Identity & Workforce Management

- **Universal Authentication**: Cookie-based authentication using HTTP-only, secure, and signed tokens. Integrates Refresh Token Rotation (RTR) to block replay attacks.
- **Workforce Directory**: Track team members with details such as Department, Skills, Hourly Rate, Employment Type (Full-time, Freelancer, Contractor), Timezone, and Join Date.
- **Organization Hierarchy**: Configure reporting lines with Manager-Subordinate relationships.
- **Availability Matrix**: Live status indicators (`AVAILABLE`, `BUSY`, `IN_MEETING`, `ON_LEAVE`, `OFFLINE`).

### 🤝 2. Client Relationship Management (CRM)

- **Client Workspace**: Complete profiles for client companies, featuring custom logos, industry metrics, billing addresses, and assigned account managers.
- **Key Contacts**: Maintain list of client contacts, identifying primary representatives.
- **Client Records**: Track internal logs, meeting logs, notes, uploaded documentation, and activities.
- **Client Portal Invites**: Simple invitation system triggering client-portal access permissions.

### 📅 3. Interactive Planner & Calendar

- **Shared Calendar**: Consolidated dashboard rendering meetings, task deadlines, and team leaves.
- **Meetings Manager**: Schedule sprints, reviews, or syncs linking to Google Meet, Zoom, or Microsoft Teams with attendee tracking.

### 🛠️ 4. Project & Task Execution (Agile Boards)

- **Project Workspaces**: Budget tracking, estimated vs. actual hours, progress tracking, and health status indicators (`HEALTHY`, `AT_RISK`, `CRITICAL`).
- **Milestones Checklist**: Map project deliverables to milestones with progress percentages.
- **Task Boards**: Nested tasks supporting subtasks, story points, checklists, labels, status lanes (`TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`), and attachments.
- **Time Sheets & Tracking**: Precise timer module allowing team members to record hours. Time logs support a review cycle (`DRAFT` ➔ `SUBMITTED` ➔ `APPROVED`/`REJECTED`) for billing.

### 🛡️ 5. Client Portal & Collaboration Space

- **Portal URL (`/portal`)**: Secure space for clients to view active projects, access folder structures, and download files.
- **Deliverables Workflow**: Client-facing approvals cycle:
  - **Draft** ➔ **Under Review** ➔ **Approved** (Or **Revision Requested**).
- **Revision Request Ticket System**: Clients can flag change requests directly on file deliverables with priority ratings.
- **Secured Downloads**: Download logs auditing file access, utilizing signed URL logic.
- **Portal Messages**: Direct project-specific discussions between clients and developers (with option to flag posts as `Internal Only`).

### 💰 6. Financial Billing Engine

- **Quotes**: Generate itemized pricing estimates, apply custom taxes/discounts, and track validation timelines.
- **Invoices**: Convert estimates to invoice worksheets displaying subtotal, balance due, and amount paid.
- **Payments Ledger**: Record partial payments, method of payment, and transaction references.
- **Expense Tracker**: Track project expenses with categories and receipts.
- **Advanced Billing Plans**: Supports billing configurations:
  - `FULL_PAYMENT` | `ADVANCE_BALANCE` | `MILESTONE` | `MONTHLY_RETAINER` | `AMC` | `CUSTOM`
- **Recurring Subscriptions**: Automatic invoicing scheduling for retainer or AMC services (Daily, Weekly, Monthly, Yearly).

---

## 🔒 Security & Authorization (RBAC)

ClientFlow enforces **Role-Based Access Control (RBAC)** across the frontend and backend routes using unified configuration tokens defined in `@clientflow/shared`.

### Role Permissions Matrix

| Permission                              | ADMIN | DEVELOPER | CLIENT |
| :-------------------------------------- | :---: | :-------: | :----: |
| Full Control (`*`)                      |  ✅   |    ❌     |   ❌   |
| Dashboard View (`dashboard:view`)       |  ✅   |    ✅     |   ✅   |
| Profile Edit (`profile:update`)         |  ✅   |    ✅     |   ✅   |
| View Assigned Work (`assigned:view`)    |  ✅   |    ✅     |   ❌   |
| View Own Projects (`own-projects:view`) |  ✅   |    ❌     |   ✅   |

### Security Measures

- **HTTP-Only Cookies**: JWT tokens are signed using a cookie secret and transmitted via HTTP-only flags.
- **Rate Limiting**: Defends API routes from brute-force attempts.
- **Helmet Headers**: Configures security-focused HTTP headers to protect against typical web vulnerabilities.
- **Zod Data Sanitization**: Strict request schema validation rejects unrecognized inputs before database queries run.

---

## ⚙️ Environment Variables Configuration

To run ClientFlow, configure variables for both workspaces:

### Backend: `apps/api/.env`

```env
DATABASE_URL=postgresql://clientflow:clientflow@localhost:5435/clientflow?schema=public
JWT_SECRET=your-secure-jwt-access-token-secret
JWT_REFRESH_SECRET=your-secure-jwt-refresh-token-secret
COOKIE_SECRET=your-secure-cookie-signing-secret
PORT=4000
WEB_ORIGIN=http://localhost:5173
NODE_ENV=development

# SMTP Email Settings (Optional)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@clientflow.local
```

### Frontend: `apps/web/.env`

```env
VITE_API_URL=http://localhost:4000
```

---

## 🚀 Getting Started & Local Development

Follow these steps to spin up the local development environment:

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ or v20+ recommended)
- [Docker & Docker Compose](https://www.docker.com/)

### Step 1: Initialize Workspace Environment

Clone the repository and copy the environment template configurations:

```bash
# Copy env templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

_Note: Set the `DATABASE_URL` port in your `apps/api/.env` to `5435` to match the local Docker PostgreSQL service._

### Step 2: Install Project Dependencies

Run the installation script in the root directory:

```bash
npm install
```

### Step 3: Launch Local PostgreSQL

Start the PostgreSQL container service:

```bash
docker compose up postgres -d
```

_This launches a database running locally on `localhost:5435` with login `clientflow`._

### Step 4: Run Prisma Migrations & Seed Data

Generate client library files, apply db migrations, and load initial seeds:

```bash
# Generate Prisma client structures
npm run prisma:generate -w apps/api

# Run PostgreSQL database migrations
npm run prisma:migrate -w apps/api

# Seed database with mock agency data and default users
npm run prisma:seed -w apps/api
```

### Step 5: Start the Development Server

Run the monorepo dev server:

```bash
npm run dev
```

- **Web App UI URL**: [http://localhost:5173](http://localhost:5173)
- **API Engine URL**: [http://localhost:4000](http://localhost:4000)

### Default Development Credentials

You can log in to the system immediately using these seeded credentials:

- **Admin Login**:
  - **Email**: `admin@clientflow.local`
  - **Password**: `Admin123!`

---

## 📡 API Endpoint Reference

The backend routing system is structured into modules. The key entry points include:

### 🔑 Authentication (`/auth`)

- `POST /auth/register` - Create a new account profile
- `POST /auth/login` - Authenticate and establish cookies
- `POST /auth/logout` - Revoke sessions and clear client cookies
- `POST /auth/refresh` - Request a new access token via refresh token rotation
- `POST /auth/forgot-password` - Request a password reset email link
- `POST /auth/reset-password` - Update password credentials using a secret token

### 👥 Client & CRM Actions (`/clients`)

- `GET /clients` - Retrieve all client profiles
- `POST /clients` - Create a new client workspace
- `GET /clients/:id` - Detailed company workspace
- `PUT /clients/:id` - Edit company attributes
- `DELETE /clients/:id` - Soft-delete a client organization
- `POST /clients/:id/contacts` - Add contact profiles to a company record
- `POST /clients/:id/notes` - Write internal progress notes

### 📂 Projects & Sprints (`/projects`)

- `GET /projects` - View overall project portfolios
- `POST /projects` - Initialize new project workspaces
- `GET /projects/:id` - Access detailed milestone planning, managers, and status values
- `POST /projects/:id/team` - Bind developers and specific roles to a project team
- `POST /projects/:id/milestones` - Schedule delivery deadlines
- `POST /projects/:id/deployments` - Track development, staging, or production server URLs

### 📝 Task Tracking (`/tasks` & `/labels`)

- `GET /tasks` - Retrieve tasks lists
- `POST /tasks` - Register new tasks under a project workspace
- `PUT /tasks/:id` - Update status coordinates, assignees, or details
- `POST /tasks/:id/comments` - Post status logs or discussions
- `POST /tasks/:id/attachments` - Upload related files and specs
- `POST /tasks/:id/checklist` - Add checklist validation items

### 💰 Financial Operations (`/quotations`, `/invoices`, `/payments`, `/expenses`)

- `GET /quotations` - View estimates directory
- `POST /invoices` - Generate request invoices
- `POST /payments` - Log payment receipt transactions
- `POST /expenses` - Record external receipts and balance expenses
- `GET /reports/summary` - Aggregate total earnings, expenses, unpaid values, and margins

### ⏱️ Time Logs & Timer (`/timelogs` & `/timer`)

- `POST /timer/start` - Trigger active duration tracking
- `POST /timer/stop` - Terminate active timers and save results
- `GET /timelogs` - View timesheet history
- `PUT /timelogs/:id/status` - Approve or reject logged items for invoice processes

---

## 🛠️ Code Standards & Linting

ClientFlow maintains strict code standards enforced via git hooks:

- **Formatting**: Automatically managed using `prettier --write` for all ts, tsx, js, json, css, and md files.
- **Linting Rules**: Enforced via ESLint using workspace policies.
- **Pre-commit Checks**: Configured with `husky` and `lint-staged` to run code verification before commits are recorded.

To format code manually across the entire workspace:

```bash
npm run format
```

To run typecheck tests manually:

```bash
npm run typecheck
```

---

## 🐳 Docker Deployment

The codebase is prepared for Docker deployment. The root `docker-compose.yml` file is configured to run the web interface, Express API, and database in container structures:

```bash
# Build and launch all services in background daemon mode
docker compose up --build -d
```

The Docker network automatically binds dependencies so that the database, API service, and front-end interface start up in sequence.
