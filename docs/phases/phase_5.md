PHASE 5 — ADMIN AUTHENTICATION, PERMISSIONS AND ORDER MANAGEMENT

The previous four phases have been approved and completed.

Extend the existing “Bếp Nhà Mình” Next.js application with a secure,
lightweight admin site for managing customer orders.

Do not rebuild the public website.
Do not replace the existing technology stack.
Do not introduce a separate backend server.

Continue using:

- Next.js App Router
- TypeScript strict mode
- PostgreSQL
- pg
- node-pg-migrate
- Zod
- Tailwind CSS
- Docker and Docker Compose
- npm

Use an established authentication library compatible with Next.js App Router.
Prefer Auth.js unless the existing project already has another approved
authentication solution.

Do not implement a custom cryptographic session system from scratch.

==================================================
1. PHASE GOALS
==================================================

Build a protected admin area that allows authorized staff to:

- Sign in securely
- View an admin dashboard
- View customer information
- View and search orders
- Filter orders by status and date
- View order details
- Approve an order
- Reject or cancel an order with a reason
- Update order preparation and delivery status
- View order charts for:
  - Last 1 day
  - Last 3 days
  - Last 7 days
  - Custom date range
- View order count
- View approved order count
- View cancelled order count
- View gross revenue
- View average order value
- View recent order activity
- View audit history for sensitive actions

Keep the scope operational and lightweight.

Do not build:

- Full accounting
- Inventory management
- Payroll
- Delivery-driver application
- Advanced CRM
- Complex promotion engine
- Customer authentication
- Multi-store support
- Real-time WebSocket infrastructure
- Refund gateway integration
- Automatic payment reconciliation
- Complex analytics warehouse

==================================================
2. ADMIN ROUTES
==================================================

Create these page routes:

/admin/login

/admin

/admin/orders

/admin/orders/[orderId]

/admin/customers

/admin/customers/[customerId]

/admin/audit-logs

Optional:

/admin/profile

Protected route behavior:

- Unauthenticated users visiting /admin/* must be redirected to /admin/login
- Authenticated users without sufficient permissions must receive a 403 page
- Authenticated authorized users may access only permitted pages
- Already authenticated users visiting /admin/login should be redirected to /admin

Use a protected admin layout:

src/app/admin/layout.tsx

The layout should include:

- Sidebar
- Header
- Current admin identity
- Role badge
- Navigation items filtered by permission
- Sign-out action
- Responsive mobile drawer

==================================================
3. AUTHENTICATION
==================================================

Use Auth.js or the existing approved authentication library.

For the first version, support:

- Email and password admin login
- Secure password hashing
- Database-backed admin users
- Secure session cookies
- Logout
- Disabled-user handling
- Last-login timestamp

Do not store plain-text passwords.

Use a recognized password hashing algorithm supported by a maintained library,
such as Argon2id or bcrypt with an appropriate work factor.

Required protections:

- Generic login failure message
- Rate-limit login attempts
- Session expiration
- Secure cookies in production
- HttpOnly cookies
- SameSite protection
- No credentials in client-side JavaScript
- No raw auth errors returned to the browser

Do not allow public admin registration.

Admin users must be created through:

- a secure seed for local development, or
- a CLI command

Add a CLI script:

npm run admin:create -- --email=admin@example.com --name="Admin Name"

The CLI must:

- prompt securely for a password when possible
- validate email
- validate password strength
- hash the password
- prevent duplicate email
- assign a role
- never log the plain password

==================================================
4. ROLE-BASED ACCESS CONTROL
==================================================

Implement role-based access control with permissions.

Initial roles:

SUPER_ADMIN
ADMIN
ORDER_MANAGER
VIEWER

Suggested permissions:

admin.dashboard.view

orders.view
orders.approve
orders.reject
orders.cancel
orders.update_status

customers.view

analytics.view

audit_logs.view

admins.manage

Role mapping:

SUPER_ADMIN:
- all permissions

ADMIN:
- dashboard view
- order view
- approve
- reject
- cancel
- update status
- customer view
- analytics view
- audit log view

ORDER_MANAGER:
- dashboard view
- order view
- approve
- reject
- update status
- customer view
- analytics view

VIEWER:
- dashboard view
- order view
- customer view
- analytics view

Authorization rules:

- Never rely only on hiding UI elements
- Every protected API route must verify the authenticated session
- Every protected API route must verify the required permission
- Every sensitive database query must pass through a server-side authorization layer
- Centralize permission checks
- Return 401 for unauthenticated requests
- Return 403 for authenticated users without permission

Create helpers such as:

requireSession()
requirePermission(permission)
hasPermission(session, permission)

Create a server-only Data Access Layer for admin operations.

==================================================
5. ORDER DOMAIN
==================================================

Create or extend these entities:

customers
orders
order_items
order_status_history
audit_logs

Suggested order statuses:

PENDING
APPROVED
PREPARING
READY
DELIVERING
COMPLETED
REJECTED
CANCELLED

Allowed transitions:

PENDING → APPROVED
PENDING → REJECTED
PENDING → CANCELLED

APPROVED → PREPARING
APPROVED → CANCELLED

PREPARING → READY
PREPARING → CANCELLED only with elevated permission

READY → DELIVERING
READY → COMPLETED for pickup orders

DELIVERING → COMPLETED

COMPLETED must be terminal
REJECTED must be terminal
CANCELLED must be terminal

Do not permit arbitrary status changes.

Create a centralized transition map and validate every transition server-side.

==================================================
6. DATABASE MIGRATIONS
==================================================

Create focused node-pg-migrate migrations.

Table: admin_users

Columns:

- id UUID primary key
- email varchar(255) unique not null
- name varchar(120) not null
- password_hash text not null
- role varchar(40) not null
- is_active boolean not null default true
- last_login_at timestamptz nullable
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Table: customers

Columns:

- id UUID primary key
- full_name varchar(120) not null
- phone varchar(30) nullable
- email varchar(255) nullable
- address_line text nullable
- ward varchar(120) nullable
- district varchar(120) nullable
- city varchar(120) nullable
- notes text nullable
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Table: orders

Columns:

- id UUID primary key
- order_code varchar(30) unique not null
- customer_id UUID not null references customers(id)
- status varchar(30) not null default 'PENDING'
- fulfillment_type varchar(30) not null default 'DELIVERY'
- delivery_date date nullable
- delivery_time_slot varchar(80) nullable
- subtotal_amount integer not null default 0
- delivery_fee integer not null default 0
- discount_amount integer not null default 0
- total_amount integer not null
- currency char(3) not null default 'VND'
- customer_note text nullable
- internal_note text nullable
- approved_at timestamptz nullable
- approved_by UUID nullable references admin_users(id)
- rejected_at timestamptz nullable
- rejected_by UUID nullable references admin_users(id)
- rejection_reason text nullable
- cancelled_at timestamptz nullable
- cancelled_by UUID nullable references admin_users(id)
- cancellation_reason text nullable
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Store VND amounts as integer values.
Do not use floating-point columns for money.

Table: order_items

Columns:

- id UUID primary key
- order_id UUID not null references orders(id) on delete cascade
- item_name varchar(180) not null
- item_snapshot jsonb nullable
- quantity integer not null
- unit_price integer not null
- line_total integer not null
- created_at timestamptz not null default now()

Table: order_status_history

Columns:

- id UUID primary key
- order_id UUID not null references orders(id) on delete cascade
- from_status varchar(30) nullable
- to_status varchar(30) not null
- reason text nullable
- changed_by UUID nullable references admin_users(id)
- created_at timestamptz not null default now()

Table: audit_logs

Columns:

- id UUID primary key
- actor_admin_id UUID nullable references admin_users(id)
- action varchar(120) not null
- entity_type varchar(80) not null
- entity_id UUID nullable
- metadata jsonb nullable
- ip_address varchar(80) nullable
- user_agent text nullable
- created_at timestamptz not null default now()

Create indexes for:

- orders.created_at
- orders.status
- orders.customer_id
- orders.delivery_date
- orders.order_code
- customers.phone
- customers.email
- order_status_history.order_id
- audit_logs.actor_admin_id
- audit_logs.created_at
- admin_users.email

Every migration must include a valid down method.

==================================================
7. APPROVE ORDER WORKFLOW
==================================================

Implement an explicit order approval action.

Endpoint:

POST /api/admin/orders/[orderId]/approve

Required permission:

orders.approve

Request body:

{
  "internalNote": "optional string"
}

Approval rules:

- Order must exist
- Current status must be PENDING
- Order must contain at least one item
- Quantity must be positive
- All prices must be valid
- total_amount must match the expected calculated total
- Delivery information must be valid when fulfillment type is DELIVERY
- Approval must occur inside a database transaction
- Lock the order row before changing status
- Prevent concurrent double approval
- Set status to APPROVED
- Set approved_at
- Set approved_by
- Insert order_status_history row
- Insert audit_logs row
- Return updated order DTO

Use a PostgreSQL transaction and row-level lock where appropriate.

The operation must be idempotency-aware:

- If already APPROVED, return a clear conflict response
- Do not create duplicate status-history rows
- Do not approve from REJECTED, CANCELLED or COMPLETED

Success response:

HTTP 200

{
  "success": true,
  "data": {
    "order": {}
  },
  "message": "Đơn hàng đã được duyệt."
}

Conflict response:

HTTP 409

{
  "success": false,
  "error": {
    "code": "INVALID_ORDER_TRANSITION",
    "message": "Đơn hàng không thể được duyệt ở trạng thái hiện tại."
  }
}

==================================================
8. REJECT AND CANCEL WORKFLOWS
==================================================

Create:

POST /api/admin/orders/[orderId]/reject

Body:

{
  "reason": "required string"
}

Required permission:

orders.reject

Only PENDING orders may be rejected.

Create:

POST /api/admin/orders/[orderId]/cancel

Body:

{
  "reason": "required string"
}

Required permission:

orders.cancel

Validate allowed cancellation states.

All state changes must:

- run inside a transaction
- validate the status transition
- update the order
- insert status history
- insert audit log
- return the updated order DTO

==================================================
9. UPDATE ORDER STATUS
==================================================

Create:

PATCH /api/admin/orders/[orderId]/status

Request body:

{
  "status": "PREPARING",
  "reason": "optional string"
}

Required permission:

orders.update_status

Validate against the centralized transition map.

Never accept an arbitrary status string.

==================================================
10. ADMIN ORDER APIs
==================================================

Create:

GET /api/admin/orders

Query parameters:

- page
- pageSize
- status
- search
- dateFrom
- dateTo
- customerId
- sortBy
- sortDirection

Search should match:

- order code
- customer name
- customer phone
- customer email

Rules:

- Validate all query parameters with Zod
- Default page size: 20
- Maximum page size: 100
- Use parameterized SQL
- Use stable sorting
- Return total count
- Return pagination metadata
- Return only required customer fields

Response:

{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 0,
      "totalPages": 0
    }
  }
}

Create:

GET /api/admin/orders/[orderId]

Return:

- order information
- customer information
- items
- status history
- approval information
- pricing summary

Do not expose password hashes or unrelated admin data.

==================================================
11. CUSTOMER APIs
==================================================

Create:

GET /api/admin/customers

Filters:

- page
- pageSize
- search
- dateFrom
- dateTo

Create:

GET /api/admin/customers/[customerId]

Return:

- customer profile
- total order count
- total completed order value
- latest orders
- first order date
- latest order date

Required permission:

customers.view

==================================================
12. ANALYTICS API
==================================================

Create:

GET /api/admin/analytics/orders

Required permission:

analytics.view

Supported query modes:

?range=1d
?range=3d
?range=7d
?dateFrom=2026-07-01&dateTo=2026-07-15

Rules:

- range and custom dates are mutually exclusive
- custom range requires both dateFrom and dateTo
- dateFrom must not be after dateTo
- maximum custom range: 366 days
- timezone must be handled explicitly
- use the configured business timezone
- default timezone: Asia/Ho_Chi_Minh

Add environment variable:

BUSINESS_TIMEZONE=Asia/Ho_Chi_Minh

Return summary:

- totalOrders
- pendingOrders
- approvedOrders
- completedOrders
- rejectedOrders
- cancelledOrders
- grossRevenue
- averageOrderValue
- approvalRate

Return time-series data:

[
  {
    "bucket": "2026-07-20",
    "orderCount": 12,
    "approvedCount": 9,
    "completedCount": 6,
    "grossRevenue": 1450000
  }
]

Date grouping rules:

- 1d: group by hour
- 3d: group by hour or suitable fixed interval
- 7d: group by day
- custom range up to 31 days: group by day
- custom range longer than 31 days: group by week or month

Document the selected bucketing behavior.

Gross revenue must include only statuses approved for revenue reporting.

Define explicitly:

Revenue statuses:
APPROVED
PREPARING
READY
DELIVERING
COMPLETED

Optionally expose completedRevenue separately.

Use PostgreSQL aggregation rather than calculating the entire dataset in JavaScript.

==================================================
13. ADMIN DASHBOARD UI
==================================================

Create a polished admin dashboard using the existing brand palette,
but make it more operational and data-focused.

Route:

/admin

Dashboard cards:

- Tổng đơn
- Chờ duyệt
- Đã duyệt
- Hoàn tất
- Đã hủy
- Doanh thu
- Giá trị đơn trung bình

Dashboard controls:

- 1 ngày
- 3 ngày
- 7 ngày
- Tùy chọn

Custom range:

- date from
- date to
- apply button
- reset button

Charts:

1. Orders over time
2. Revenue over time

Use a lightweight chart library only if necessary.

Prefer one maintained chart library.
Do not create a custom canvas chart implementation.

Chart requirements:

- responsive
- accessible labels
- loading skeleton
- empty state
- error state
- tooltip
- localized VND formatting
- localized dates
- no heavy animation
- respect reduced motion

Recent orders section:

- order code
- customer
- created time
- total
- status
- action

Pending approval section:

- show the newest PENDING orders
- approve action
- view detail action

==================================================
14. ORDER LIST UI
==================================================

Route:

/admin/orders

Create:

- search input
- status filter
- date-range filter
- pagination
- sortable columns
- desktop table
- mobile card layout
- loading state
- empty state
- error state

Columns:

- Order code
- Customer
- Phone
- Created date
- Delivery date
- Total
- Status
- Actions

Actions:

- View
- Approve
- Reject
- Cancel
- Update status

Only render actions allowed by:

- current permission
- current order status

The UI permission check is for usability only.
The API must still enforce authorization.

==================================================
15. ORDER DETAIL UI
==================================================

Route:

/admin/orders/[orderId]

Sections:

- order summary
- customer details
- delivery details
- item list
- pricing breakdown
- customer note
- internal note
- status timeline
- audit metadata
- admin actions

Approval interaction:

- explicit approve button
- confirmation dialog
- optional internal note
- disable button while submitting
- prevent double submit
- show success toast
- refresh order data after success

Reject interaction:

- confirmation dialog
- required rejection reason

Cancel interaction:

- confirmation dialog
- required cancellation reason

Never perform approve, reject or cancel using GET requests.

==================================================
16. AUDIT LOG UI
==================================================

Route:

/admin/audit-logs

Required permission:

audit_logs.view

Filters:

- actor
- action
- entity type
- date range

Columns:

- timestamp
- actor
- action
- entity
- metadata summary

Audit logs must be append-only through application behavior.

Do not expose secrets, password hashes, raw session tokens or full sensitive
request bodies in audit metadata.

==================================================
17. FILE STRUCTURE
==================================================

Suggested additions:

src/
  app/
    admin/
      login/
        page.tsx
      orders/
        [orderId]/
          page.tsx
        page.tsx
      customers/
        [customerId]/
          page.tsx
        page.tsx
      audit-logs/
        page.tsx
      forbidden/
        page.tsx
      layout.tsx
      page.tsx

    api/
      auth/
        [...nextauth]/
          route.ts
      admin/
        orders/
          [orderId]/
            approve/
              route.ts
            reject/
              route.ts
            cancel/
              route.ts
            status/
              route.ts
            route.ts
          route.ts
        customers/
          [customerId]/
            route.ts
          route.ts
        analytics/
          orders/
            route.ts
        audit-logs/
          route.ts

  components/
    admin/
      admin-sidebar.tsx
      admin-header.tsx
      dashboard-stat-card.tsx
      order-chart.tsx
      order-table.tsx
      order-status-badge.tsx
      order-status-timeline.tsx
      approve-order-dialog.tsx
      reject-order-dialog.tsx
      cancel-order-dialog.tsx
      date-range-filter.tsx

  auth/
    auth.ts
    permissions.ts
    session.ts

  dal/
    admin-users.ts
    orders.ts
    customers.ts
    analytics.ts
    audit-logs.ts

  repositories/
    order-repository.ts
    customer-repository.ts
    analytics-repository.ts
    audit-log-repository.ts

  services/
    order-service.ts
    analytics-service.ts
    audit-service.ts

  lib/
    order-status.ts
    money.ts
    date-range.ts

scripts/
  create-admin.ts

migrations/
  xxx_create_admin_users.ts
  xxx_create_customers.ts
  xxx_create_orders.ts
  xxx_create_order_items.ts
  xxx_create_order_status_history.ts
  xxx_create_audit_logs.ts

==================================================
18. SECURITY REQUIREMENTS
==================================================

Implement defense in depth.

Required:

- Route protection
- Server-side session validation
- Permission validation at API boundary
- Permission validation in Data Access Layer for sensitive operations
- Parameterized SQL
- Database transactions
- Row locking for approval
- Safe DTOs
- Input validation
- Rate limiting design
- CSRF protection appropriate to the auth library
- Secure cookies
- Generic login errors
- Password hashing
- No public admin registration
- Audit logging
- No sensitive logs
- No secrets sent to the browser
- No trust in client-provided role or user ID
- No mass assignment
- Prevent duplicate form submission
- Validate UUID route parameters
- Verify affected row counts

Do not treat middleware or route-level redirects as the only security boundary.

==================================================
19. CONCURRENCY AND DATA INTEGRITY
==================================================

Approval, rejection, cancellation and status updates must:

- use database transactions
- lock the order row before transition
- verify current state inside the transaction
- validate transition inside the transaction
- write status history inside the same transaction
- write audit log inside the same transaction
- commit only when all steps succeed
- rollback on any failure

Do not use a read-then-write flow outside a transaction.

Recalculate order totals from order items where required.
Do not trust totals supplied by the browser.

==================================================
20. SEED DATA
==================================================

Extend the seed process with:

- one local SUPER_ADMIN
- sample customers
- sample orders across multiple statuses
- sample order items
- sample status history
- chart-friendly order timestamps covering more than 7 days

Development credentials must:

- be clearly marked development-only
- be sourced from environment variables where possible
- not be used in production
- never be committed with a real password

Do not seed fake customer reviews.

==================================================
21. PACKAGE COMMANDS
==================================================

Add:

"admin:create": "tsx scripts/create-admin.ts"

Optional:

"admin:seed": "tsx scripts/seed-admin.ts"

Ensure every script is fully functional.

==================================================
22. TESTING REQUIREMENTS
==================================================

Add tests or executable verification examples for:

Authentication:

- valid login
- invalid password
- inactive admin
- unauthenticated admin route
- unauthorized role
- successful logout

Authorization:

- VIEWER cannot approve
- ORDER_MANAGER can approve
- ADMIN can cancel
- SUPER_ADMIN has all permissions

Order approval:

- PENDING → APPROVED succeeds
- APPROVED → APPROVED fails
- CANCELLED → APPROVED fails
- empty order fails
- invalid totals fail
- concurrent approval creates only one transition
- status history is created
- audit log is created

Analytics:

- 1d range
- 3d range
- 7d range
- custom range
- invalid range
- reversed dates
- empty dataset
- timezone boundary

UI:

- desktop order table
- mobile order cards
- permission-based action visibility
- loading state
- empty state
- error state
- approval dialog
- prevent double submit

==================================================
23. OUTPUT RULES
==================================================

At the beginning, state:

“Starting Phase 5 — Admin Authentication, Permissions and Order Management”

Before coding:

1. Inspect the existing project structure
2. Identify reusable components and conventions
3. Identify existing database tables
4. Identify migration numbering
5. Identify current API response format
6. Identify current environment-variable validation
7. Identify current Docker setup
8. Present a Phase 5 implementation plan

Do not overwrite existing working files unnecessarily.

For every changed or created file:

FILE: path/to/file

Provide complete runnable content.

For Phase 5, deliver in these internal steps:

5.1 Authentication and permissions
5.2 Database schema and migrations
5.3 Order APIs and approval workflow
5.4 Analytics APIs and chart aggregation
5.5 Admin UI
5.6 Seeds, CLI, tests and documentation

Complete only one internal step at a time.
Stop after each internal step and wait for approval.

Start with:

PHASE 5.1 — AUTHENTICATION AND PERMISSIONS ONLY

Do not implement order management or analytics yet.