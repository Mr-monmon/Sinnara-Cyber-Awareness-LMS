# Phishing Campaigns Management - Implementation Guide

## ✅ COMPLETED: Database Schema

### Tables Created:
1. **phishing_campaign_quotas** - Annual quota tracking per company
2. **phishing_templates** - Email templates for simulations
3. **phishing_campaign_requests** - Support ticket system
4. **phishing_campaigns** - Actual campaign execution tracking
5. **phishing_campaign_targets** - Individual employee results
6. **phishing_domains** - Custom sending domains with DNS verification

### Features Implemented:
- ✅ Auto-generate ticket numbers (PHC-XXXXXX format)
- ✅ Auto-deduct quota when request submitted
- ✅ Auto-initialize quota for new companies (4 campaigns/year)
- ✅ RLS policies for data isolation
- ✅ Performance indexes
- ✅ Default phishing templates seeded

---

## 🚀 NEXT STEPS: UI Components

### Platform Admin Pages Needed:

#### 1. Phishing Management Dashboard (`/src/pages/platform-admin/PhishingManagementPage.tsx`)
- View all campaign requests (tickets)
- Statistics cards: Total requests, Pending, Running, Completed
- Filter by status, company, date range
- Quick approve/reject actions
- Assign to Gophish button

#### 2. Phishing Templates Manager (`/src/pages/platform-admin/PhishingTemplatesPage.tsx`)
- List all templates
- Create/Edit/Delete templates
- Preview template HTML
- Set difficulty level
- Mark active/inactive

#### 3. Company Quotas Manager (`/src/pages/platform-admin/PhishingQuotasPage.tsx`)
- List all companies with quotas
- Adjust annual quota
- View usage statistics
- Reset quota button

#### 4. Phishing Domains Manager (`/src/pages/platform-admin/PhishingDomainsPage.tsx`)
- Manage company domains
- DNS verification status
- Generate verification tokens
- Mark as verified

---

### Company Admin Pages Needed:

#### 1. Phishing Dashboard (`/src/pages/company-admin/PhishingDashboardPage.tsx`)
- Statistics cards: Quota remaining, Total campaigns, Success rate
- Recent campaigns list
- Request status tracker
- Charts: Success rate over time, Department performance

#### 2. Campaign Request Form (`/src/pages/company-admin/PhishingRequestPage.tsx`)
- Create new campaign request
- Select template (with preview)
- Select target departments
- Set schedule date
- Add notes
- Check quota before submit
- Auto-generates ticket

#### 3. Campaign History (`/src/pages/company-admin/PhishingHistoryPage.tsx`)
- List all past campaigns
- View detailed results
- Export to Excel
- Filter by department, date, status

#### 4. Campaign Results Viewer (`/src/pages/company-admin/PhishingResultsPage.tsx`)
- View campaign details
- Employee-level results
- Charts: Opened, Clicked, Reported
- Department breakdown
- Export report

---

## 🔧 Navigation Updates Needed:

### DashboardLayout.tsx modifications:
```typescript
// Add to Platform Admin menu:
{
  title: 'Phishing Campaigns',
  icon: Shield,
  href: '/platform/phishing-management',
  roles: ['PLATFORM_ADMIN']
}

// Add to Company Admin menu:
{
  title: 'Phishing Campaigns',
  icon: Shield,
  href: '/company/phishing-dashboard',
  roles: ['COMPANY_ADMIN']
}
```

### App.tsx routing additions:
```typescript
// Platform Admin routes
<Route path="/platform/phishing-management" element={<PhishingManagementPage />} />
<Route path="/platform/phishing-templates" element={<PhishingTemplatesPage />} />
<Route path="/platform/phishing-quotas" element={<PhishingQuotasPage />} />
<Route path="/platform/phishing-domains" element={<PhishingDomainsPage />} />

// Company Admin routes
<Route path="/company/phishing-dashboard" element={<PhishingDashboardPage />} />
<Route path="/company/phishing-request" element={<PhishingRequestPage />} />
<Route path="/company/phishing-history" element={<PhishingHistoryPage />} />
<Route path="/company/phishing-results/:id" element={<PhishingResultsPage />} />
```

---

## 📊 Key Features Per Role:

### Platform Admin:
1. **Campaign Requests Management**
   - View all tickets from all companies
   - Approve/Reject with notes
   - Update status (Pending → Approved → Running → Completed)
   - Assign to Gophish with one click

2. **Templates Management**
   - CRUD operations on templates
   - Categorize by difficulty
   - Rich text editor for HTML
   - Preview functionality

3. **Quota Management**
   - Set/adjust annual quota per company
   - View usage statistics
   - Bulk operations

4. **Domain Management**
   - Add custom sending domains
   - Generate DNS verification records
   - Verify domain ownership
   - Link to companies

5. **Analytics & Reports**
   - Global campaign statistics
   - Company performance comparison
   - Export to Excel/PDF
   - Success rate trends

### Company Admin:
1. **Dashboard**
   - Quota remaining indicator
   - Recent campaign results
   - Success rate metrics
   - Upcoming scheduled campaigns

2. **Request Campaign**
   - Browse available templates
   - Preview templates
   - Select target departments
   - Schedule launch date
   - Submit request (creates ticket)
   - Real-time quota check

3. **Campaign History**
   - List all past campaigns
   - View results
   - Download Excel reports
   - Filter/search

4. **Results Analysis**
   - Detailed campaign results
   - Employee-level data
   - Department breakdown
   - Visual charts
   - Export capabilities

---

## 🔗 API Integration Points:

### Gophish API Integration (Future):
```typescript
// POST /api/gophish/campaigns
- Create campaign in Gophish
- Upload target list
- Set template
- Schedule launch

// GET /api/gophish/campaigns/:id
- Fetch campaign status
- Get results
- Sync to database

// POST /api/gophish/templates
- Create template in Gophish
- Link to Sinnara template

// GET /api/gophish/results/:id
- Get detailed results
- Individual employee actions
```

### Internal API Endpoints:
```typescript
// Quota Management
GET /api/phishing/quota/:companyId - Get company quota
POST /api/phishing/quota/:companyId - Update quota

// Campaign Requests
GET /api/phishing/requests - List requests (filtered by role)
POST /api/phishing/requests - Create new request
PATCH /api/phishing/requests/:id - Update status
DELETE /api/phishing/requests/:id - Cancel request

// Templates
GET /api/phishing/templates - List templates
POST /api/phishing/templates - Create template
PUT /api/phishing/templates/:id - Update template
DELETE /api/phishing/templates/:id - Delete template

// Campaigns
GET /api/phishing/campaigns - List campaigns
GET /api/phishing/campaigns/:id - Get campaign details
POST /api/phishing/campaigns - Create campaign from request
PATCH /api/phishing/campaigns/:id - Update campaign

// Results
GET /api/phishing/campaigns/:id/results - Get campaign results
GET /api/phishing/campaigns/:id/export - Export to Excel
```

---

## 📈 Data Flow:

### Campaign Request Flow:
1. Company Admin selects "Create Campaign"
2. System checks quota (must have remaining campaigns)
3. Admin fills form: name, template, departments, schedule
4. Submit → Creates ticket (status: DRAFT → SUBMITTED)
5. Auto-deducts 1 from company quota
6. Platform Admin sees ticket in dashboard
7. Platform Admin reviews and approves/rejects
8. If approved → Assigns to Gophish
9. Campaign runs → Status: RUNNING
10. Results sync → Status: COMPLETED
11. Company Admin views results

### Quota Management Flow:
1. New company created → Auto-assigned 4 campaigns/year
2. Company submits request → -1 from quota
3. Platform Admin can adjust quota anytime
4. Annual reset (manual or automated)

---

## 🎨 UI/UX Requirements:

### Design Principles:
- Use Sinnara's existing color scheme
- Shield/Target icons for phishing theme
- Color coding for status:
  - DRAFT: Gray
  - SUBMITTED: Blue
  - APPROVED: Green
  - RUNNING: Orange
  - COMPLETED: Purple
  - REJECTED: Red

### Key Components:
- Status badges
- Progress indicators
- Charts (pie, bar, line)
- Data tables with sorting
- Modal forms
- Preview panels
- Export buttons

---

## 🔐 Security Considerations:

1. **RLS Policies** ✅ Implemented
   - Company admins see only their data
   - Platform admins see everything

2. **Quota Enforcement**
   - Validate quota before submission
   - Prevent quota bypass

3. **Domain Verification**
   - DNS record validation
   - Prevent spoofing

4. **Data Isolation**
   - Campaign data per company
   - No cross-company access

5. **Audit Logging**
   - Track all quota changes
   - Log approval/rejection
   - Record campaign actions

---

## 📦 Export Formats:

### Excel Export Columns:
**Campaign Summary:**
- Campaign Name
- Status
- Launch Date
- Total Targets
- Emails Sent
- Opened Count / %
- Clicked Count / %
- Reported Count / %
- Success Rate

**Detailed Results:**
- Employee Name
- Email
- Department
- Status
- Sent At
- Opened At
- Clicked At
- Submitted At
- Reported At

---

## ✅ Success Metrics:

- Quota system working (auto-deduct on submit)
- Request-to-completion workflow functional
- Platform admin can manage all aspects
- Company admin can request & view results
- Data isolation verified
- Reports exportable
- Gophish integration ready (API endpoints defined)

---

This implementation provides a complete phishing campaigns management system
with ticket-based request workflow, quota management, template library, and
comprehensive analytics for both platform and company administrators.
