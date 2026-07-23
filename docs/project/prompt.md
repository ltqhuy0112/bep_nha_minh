# Bếp Nhà Mình Bio Project Prompt

You are a senior full-stack engineer, software architect, UI/UX designer,
DevOps engineer, and technical writer.

Your task is to build a production-quality but lightweight website project
for a Vietnamese healthy food brand named:

“Bếp Nhà Mình”

The website is primarily a smooth brand bio website that introduces the brand,
shows sample dishes, explains the pre-order workflow, links social media,
and collects opening waitlist leads.

The project must be developed in 4 strictly separated phases:

1. Project workflow and architecture design
2. Frontend design and implementation
3. Backend and database implementation
4. Docker, PostgreSQL, migrations, seeds and local deployment

Do not implement future phases before the current phase is completed,
reviewed, and explicitly approved.

## 1. Project Goals

Build a modern, elegant and fast website that:

- Introduces the “Bếp Nhà Mình” healthy food brand
- Feels warm, natural, trustworthy and handcrafted
- Explains the made-to-order and pre-order model
- Shows upcoming dishes and meal concepts
- Collects customer waitlist information
- Links Instagram, Facebook and TikTok
- Works beautifully on mobile, tablet and desktop
- Has smooth animation without becoming heavy
- Is SEO-friendly and accessible
- Uses simple business logic
- Is easy to maintain and deploy
- Uses one Next.js project for both frontend and backend

This is NOT an e-commerce platform.

Do not build:

- Authentication
- User accounts
- Payment
- Shopping cart
- Order management
- Inventory management
- Admin dashboard
- Complex CMS
- Coupons
- Loyalty system
- Real-time chat
- Separate Express or NestJS server

## 2. Required Tech Stack

Use:

- Next.js latest stable version
- Next.js App Router
- TypeScript with strict mode
- React Server Components by default
- Client Components only when interaction is required
- Tailwind CSS
- Motion for React imported from "motion/react"
- PostgreSQL
- node-postgres package "pg"
- node-pg-migrate
- Zod
- Docker
- Docker Compose
- npm

Do not use:

- Prisma
- Sequelize
- TypeORM
- NestJS
- Express
- Redux unless truly necessary
- Heavy animation frameworks
- Unnecessary UI libraries
- Overengineered clean architecture

## 3. Brand And Design System

Brand name:

Bếp Nhà Mình

Category:

Healthy food
Made-to-order meals
Pre-order meal service

Brand personality:

- Warm
- Natural
- Calm
- Trustworthy
- Friendly
- Homemade
- Clean
- Modern but not corporate

Primary color palette:

- Olive green
- Cream
- Soft beige
- Natural wood brown
- Dark forest green for text

Suggested color tokens:

--color-olive-900: #26351F
--color-olive-700: #4F643D
--color-olive-500: #7C8F5A
--color-cream-100: #FFF9ED
--color-beige-200: #EFE6D4
--color-wood-500: #A57A50
--color-text: #24301F
--color-muted: #6E7568

Typography:

- Editorial serif or soft handwritten style for headings
- Clean sans-serif for body text
- Maximum two font families
- Use next/font
- Avoid difficult-to-read decorative text

UI style:

- Large natural whitespace
- Rounded cards between 20px and 28px
- Thin botanical line illustrations
- Soft paper-like backgrounds
- Very light shadows
- Natural food photography
- Clear buttons
- Minimal visual noise
- No glassmorphism
- No aggressive gradients
- No generic SaaS dashboard appearance

## 4. Animation And Performance Rules

The site must feel smooth but remain lightweight.

Allowed animations:

- Fade-in
- Slide-up
- Small image reveal
- Button hover
- Card hover
- Section transition
- Very subtle parallax
- Smooth anchor scrolling

Rules:

- Respect prefers-reduced-motion
- Do not use continuous looping animation
- Do not animate every element
- Avoid large background videos
- Avoid Lottie unless essential
- Use LazyMotion or an equivalent optimized approach
- Avoid hydration-heavy layouts
- Prevent layout shift
- Keep animation duration between 200ms and 700ms
- Prioritize Core Web Vitals

Performance budget:

- Mobile Lighthouse target above 90
- No unnecessary client components
- No JavaScript-heavy carousel
- Use CSS scroll snapping if possible
- Optimize all images with next/image
- Use modern image formats
- Lazy load below-the-fold images
- Keep initial page bundle small

## 5. Website Information Architecture

Build a single-page bio website.

Required sections:

1. Sticky header
2. Hero
3. Brand values
4. Story of the kitchen
5. Upcoming dishes
6. Pre-order workflow
7. A day in the kitchen
8. Waitlist section
9. Social media section
10. Footer

Navigation:

- Trang chủ
- Câu chuyện
- Món ăn
- Quy trình
- Liên hệ

Hero headline:

“Bữa ăn lành mạnh từ căn bếp nhỏ”

Hero supporting text:

“Healthy food làm mới theo đơn, dành cho những ngày bận rộn.”

Primary CTA:

“Theo dõi hành trình”

Secondary CTA:

“Nhận thông báo mở bán”

Brand values:

- Tươi mới mỗi ngày
- Làm theo đơn
- Hạn chế lãng phí
- Tiện cho người bận rộn

Upcoming dishes:

- Cơm gà ức nướng sốt tiêu chanh
- Cơm bò xào rau củ
- Salad ức gà trứng
- Cơm cá hồi áp chảo

These are preview dishes only.
Do not create a shopping cart or checkout.

Pre-order workflow:

1. Xem menu
2. Nhắn tin hoặc đăng ký
3. Bếp xác nhận
4. Chuẩn bị và nấu mới
5. Giao món

Social links:

- Instagram
- Facebook
- TikTok

## 6. User Journey

The main user journey is:

Landing page
→ understand the brand
→ explore the story
→ preview dishes
→ understand pre-order workflow
→ submit waitlist form
→ receive confirmation
→ follow Instagram or Facebook

Secondary user journey:

Landing page
→ click social media
→ visit Instagram or Facebook

The page should prioritize clarity and conversion without aggressive sales tactics.

## 7. Frontend Requirements

Use Next.js App Router.

Suggested structure:

src/
  app/
    api/
    globals.css
    layout.tsx
    page.tsx
  components/
    layout/
    sections/
    ui/
    motion/
    forms/
  data/
    site-content.ts
  db/
  lib/
  types/
  styles/

Use React Server Components by default.

Only use Client Components for:

- Mobile menu
- Waitlist form
- Interactive gallery
- Motion wrappers
- Small interactive buttons

Frontend requirements:

- Fully responsive
- Mobile-first
- Accessible semantic HTML
- Keyboard navigation
- Visible focus states
- Proper heading hierarchy
- Good color contrast
- Loading state
- Success state
- Error state
- Empty state where relevant
- Reusable components without excessive abstraction
- No lorem ipsum
- Vietnamese content
- No fake business claims

Suggested components:

- Header
- MobileNavigation
- HeroSection
- BrandValues
- StorySection
- DishPreviewCard
- DishGrid
- PreorderWorkflow
- KitchenGallery
- WaitlistForm
- SocialLinks
- Footer
- SectionHeading
- Button
- Container
- MotionReveal

## 8. Seo Requirements

Add:

- Metadata in layout.tsx
- Page title
- Meta description
- Open Graph metadata
- Twitter card metadata
- Canonical URL placeholder
- Favicon placeholder
- Open Graph image configuration
- JSON-LD for a local food business or food service
- Semantic section structure
- Descriptive alt text
- Sitemap
- robots.txt

Suggested title:

“Bếp Nhà Mình | Healthy Food Làm Mới Theo Đơn”

Suggested description:

“Bếp Nhà Mình là căn bếp healthy nhỏ, phục vụ các bữa ăn tươi mới theo hình thức pre-order dành cho người bận rộn.”

Do not add fake address, phone number or opening hours.
Use clearly marked placeholders for missing business information.

## 9. Waitlist Form

Create a waitlist form with these fields:

- name
- phone
- email, optional
- district
- preferredMeal
- source

Suggested options for preferredMeal:

- Bữa trưa
- Bữa tối
- Combo nhiều ngày
- Chưa xác định

Validation rules:

- name is required
- district is required
- at least phone or email is required
- trim all text
- normalize email
- normalize Vietnamese phone number
- reject obviously invalid input
- maximum safe input lengths
- do not allow raw HTML
- prevent duplicate submissions where possible

Success message:

“Bếp đã nhận được thông tin của bạn. Khi menu mở bán, Bếp Nhà Mình sẽ gửi thông báo sớm nhất 🌿”

## 10. Backend Requirements

Use Next.js Route Handlers.

Required endpoints:

GET /api/health

POST /api/waitlist

GET /api/site-content

Use:

- pg
- node-pg-migrate
- Zod
- TypeScript

Create:

src/db/client.ts
src/db/queries/
src/lib/env.ts
src/lib/api-response.ts
src/lib/validation.ts
src/lib/logger.ts if needed

Rules:

- Use one reusable PostgreSQL connection pool
- Database modules must be server-only
- Never expose DATABASE_URL to the client
- Use parameterized SQL only
- Never concatenate user values into SQL
- Return consistent JSON responses
- Do not expose stack traces
- Do not expose raw database errors
- Add safe server logging
- Use correct HTTP status codes

POST /api/waitlist must:

- validate with Zod
- normalize input
- prevent obvious duplicate submissions
- return 201 on success
- return 400 for invalid input
- return 409 for duplicates
- return 500 with a generic safe message
- not reveal internal details

Example response format:

{
  "success": true,
  "data": {},
  "message": "..."
}

Error response:

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  }
}

## 11. Database Design

Use PostgreSQL.

Create table:

waitlist

Columns:

- id UUID primary key
- name varchar(120) not null
- phone varchar(30) nullable
- email varchar(255) nullable
- district varchar(120) not null
- preferred_meal varchar(80) nullable
- source varchar(80) not null default 'website'
- status varchar(30) not null default 'new'
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Create table:

site_content

Columns:

- id UUID primary key
- section_key varchar(120) unique not null
- content_json jsonb not null
- is_published boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

Indexes:

- normalized phone lookup
- normalized email lookup
- status
- created_at
- section_key unique index

Use PostgreSQL extensions only if necessary.

## 12. Migration Requirements

Use node-pg-migrate.

Create migration files with explicit up and down methods.

Required migrations:

1. enable required PostgreSQL extension if needed
2. create waitlist table
3. create site_content table
4. create indexes
5. add updated_at trigger only if justified

Migration rules:

- Every migration must have a safe down method
- Never delete data silently in production notes
- Clearly document destructive rollback behavior
- Use sequential migration naming
- Keep migrations small and focused

## 13. Seed Requirements

Create a TypeScript seed script.

Seed only safe demo content:

site_content records for:

- hero
- brand_values
- story
- dishes
- workflow
- social_links

Do not seed fake customer reviews.

Seed must be idempotent.

Running the seed twice must not create duplicate rows.

## 14. Package Commands

Create package.json scripts:

"dev": "next dev"
"build": "next build"
"start": "next start"
"lint": "next lint"
"typecheck": "tsc --noEmit"

"db:create": "node-pg-migrate create"
"db:up": "node-pg-migrate up"
"db:down": "node-pg-migrate down"
"db:redo": "npm run db:down && npm run db:up"
"db:seed": "tsx scripts/seed.ts"

"docker:up": "docker compose up -d"
"docker:down": "docker compose down"
"docker:logs": "docker compose logs -f"
"docker:reset": "docker compose down -v && docker compose up -d"

Add scripts only if they are fully functional.

## 15. Environment Variables

Create .env.example.

Suggested variables:

NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000

DATABASE_URL=postgresql://bep_user:bep_password@localhost:5432/bep_nha_minh

POSTGRES_USER=bep_user
POSTGRES_PASSWORD=bep_password
POSTGRES_DB=bep_nha_minh

NEXT_PUBLIC_INSTAGRAM_URL=
NEXT_PUBLIC_FACEBOOK_URL=
NEXT_PUBLIC_TIKTOK_URL=

Validate server environment variables with Zod.

Do not expose database credentials using NEXT_PUBLIC_ prefixes.

## 16. Docker Requirements

Create:

- Multi-stage Dockerfile
- docker-compose.yml
- .dockerignore
- optional wait-for-db script
- health checks
- named PostgreSQL volume
- internal Docker network

Services:

postgres:
- PostgreSQL Alpine image
- persistent volume
- environment variables
- health check
- restart policy

web:
- build from local Dockerfile
- use production build
- run as non-root user
- depend on healthy PostgreSQL
- expose port 3000
- use environment variables
- avoid hardcoded secrets

Docker rules:

- Keep final image reasonably small
- Use npm ci
- Copy only required files
- Do not run development server in production image
- Use Next.js standalone output if appropriate
- Add proper signal handling
- Avoid running as root
- Do not expose PostgreSQL publicly in production notes

## 17. Local Startup Flow

The final local workflow must support:

1. Copy .env.example to .env
2. Install packages
3. Start PostgreSQL with Docker
4. Run migrations
5. Run seed
6. Start Next.js
7. Visit homepage
8. Verify /api/health
9. Submit waitlist form
10. Confirm data exists in PostgreSQL

Example:

cp .env.example .env
npm install
docker compose up -d postgres
npm run db:up
npm run db:seed
npm run dev

## 18. Security Rules

Implement:

- Server-side validation
- Parameterized SQL
- Safe error messages
- Input length limits
- Basic duplicate prevention
- No client-side secret exposure
- No raw SQL errors returned
- No unsafe HTML rendering
- No eval
- No hardcoded production passwords
- Basic rate limiting design note
- CSRF risk explanation where relevant
- Secure headers recommendation
- Security checklist in README

Do not add unnecessary security packages unless justified.

## 19. Code Quality Rules

Use:

- TypeScript strict mode
- Clear naming
- Small focused functions
- Typed API responses
- No any unless clearly justified
- No unused code
- No dead abstractions
- No massive component files
- No excessive comments
- Comments only when intent is not obvious
- Consistent formatting
- Predictable folder boundaries
- Centralized design tokens
- Centralized environment parsing
- Centralized API response helpers

Do not overengineer.

## 20. Testing Requirements

At minimum include:

- Validation test examples
- API curl examples
- Manual QA checklist
- Responsive checklist
- Accessibility checklist
- Database migration verification
- Seed verification
- Docker verification

Optional automated tests may be added only if they do not bloat the project.

Test cases for waitlist:

- valid phone only
- valid email only
- missing both phone and email
- invalid phone
- invalid email
- missing district
- duplicate phone
- duplicate email
- unsafe long input
- successful submission

## 21. Four-Phase Execution Rules

The project must be built in exactly four phases.

For every phase:

1. Explain major decisions briefly
2. Show the affected file tree
3. Generate complete runnable files
4. Show install and run commands
5. Add verification checklist
6. Mention assumptions
7. Stop after the phase
8. Wait for explicit approval before continuing

Never output the entire project in one response.

## Phase 1 — WORKFLOW AND ARCHITECTURE

Do not create application code yet.

Produce:

- Product scope
- Assumptions
- User journey
- Information architecture
- Responsive text wireframe
- Design tokens
- Component inventory
- Server versus client component decisions
- API contract
- Database schema
- Folder structure
- Environment variable plan
- Docker architecture
- Security checklist
- Performance budget
- Development milestones
- Risk list
- Acceptance checklist

Keep the scope small.

Stop after completing Phase 1.

## Phase 2 — FRONTEND

After approval, implement frontend only.

Requirements:

- Use mock data from src/data
- Do not connect PostgreSQL yet
- Do not create real API routes yet
- Build all website sections
- Build waitlist form UI
- Add client-side validation
- Add responsive design
- Add subtle animations
- Add metadata
- Add accessibility
- Add polished loading, success and error states
- Use complete runnable files

Stop after completing Phase 2.

## Phase 3 — BACKEND AND DATABASE

After approval, implement:

- PostgreSQL connection pool
- Migrations
- Seed
- API routes
- Validation
- Repository functions
- Safe error handling
- Waitlist frontend integration
- README API documentation
- curl examples

Stop after completing Phase 3.

## Phase 4 — DOCKER AND END-TO-END

After approval, implement:

- Production Dockerfile
- docker-compose.yml
- PostgreSQL service
- Web service
- Health checks
- Named volume
- Migration workflow
- Seed workflow
- Local deployment instructions
- Production notes
- Troubleshooting
- End-to-end verification checklist

Final flow:

copy env
→ install
→ start database
→ migrate
→ seed
→ start app
→ test health
→ submit form
→ verify database

## 22. Output Format

At the beginning of every phase, state:

“Starting Phase X of 4”

For code files, always display:

FILE: path/to/file

Then include the complete file content.

Do not provide partial snippets where a complete file is required.

Do not silently omit configuration files.

Do not claim the project works unless all generated files are consistent.

When uncertain, state the assumption clearly.

Start now with:

PHASE 1 — PROJECT WORKFLOW AND ARCHITECTURE ONLY
