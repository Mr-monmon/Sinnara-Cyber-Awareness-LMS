# Sinnara Cybersecurity Training Platform - Complete Documentation

## Platform Overview

Sinnara is a multi-tenant B2B cybersecurity awareness training platform designed for organizations to train their employees on security best practices through interactive courses, assessments, and phishing simulations.

### Key Features

#### 1. **Course Management & Learning**
- **Course Library**: Comprehensive library of cybersecurity training courses
- **Content Types**: Support for video, slides, and text-based content
- **Interactive Quizzes**: In-course quizzes to reinforce learning
- **Progress Tracking**: Real-time tracking of employee progress through courses
- **Auto-Completion**: Automatic marking of course completion
- **Course Assignment**: Assign courses to individuals or entire departments

#### 2. **Assessment & Examination System**
- **Pre-Assessment**: Test employee knowledge before training
- **Post-Assessment**: Validate learning outcomes after training
- **Timed Exams**: Optional time limits for assessments
- **Multiple Attempts**: Configurable retry limits
- **Passing Scores**: Customizable passing thresholds
- **Instant Results**: Immediate feedback with detailed explanations
- **Result Analytics**: Comprehensive exam result tracking

#### 3. **Certificate Management**
- **Auto-Generation**: Automatic certificate generation upon course completion
- **Custom Templates**: Customizable certificate templates with company branding
- **Certificate Numbers**: Unique certificate numbering system
- **PDF Generation**: Professional PDF certificates
- **Digital Storage**: Secure storage and retrieval of certificates

#### 4. **Phishing Simulation System**
- **Campaign Quotas**: Annual phishing campaign limits per company (default: 4 campaigns/year)
- **Template Library**: Pre-built phishing email templates with varying difficulty levels
- **Campaign Requests**: Ticket-based system for requesting phishing campaigns
- **Gophish Integration**: Integration with Gophish platform for campaign execution
- **Target Management**: Select specific departments or employees for campaigns
- **Real-Time Tracking**: Track email opens, link clicks, data submissions, and reports
- **Analytics Dashboard**: Comprehensive campaign performance metrics
- **Custom Domains**: Support for custom sending domains with DNS verification

#### 5. **Department & Organizational Structure**
- **Department Hierarchy**: Multi-level department organization
- **Employee Assignment**: Link employees to departments
- **Department-Wide Actions**: Assign training to entire departments
- **Departmental Analytics**: Track performance by department
- **Vulnerability Scoring**: Department-level security vulnerability metrics

#### 6. **Subscription & Billing Management**
- **Subscription Types**:
  - POC_3M: 3-month proof of concept
  - MONTHLY_6: 6-month monthly billing
  - YEARLY_1: 1-year subscription
  - YEARLY_2: 2-year subscription
  - CUSTOM: Custom subscription terms
- **License Management**: Track license limits and usage
- **Invoice Generation**: Automatic invoice creation with unique numbers
- **Payment Tracking**: Monitor payment status and history
- **Subscription Status**: Active, expired, suspended, or cancelled subscriptions

#### 7. **Analytics & Reporting**
- **Company Dashboard**: Overview of training metrics per company
- **Employee Progress**: Individual employee performance tracking
- **Course Analytics**: Course completion rates and average scores
- **Exam Analytics**: Pass rates and score distributions
- **Phishing Analytics**: Campaign success rates and employee vulnerability
- **Department Analytics**: Department-level security posture
- **Audit Logs**: Complete activity tracking for compliance

#### 8. **Audit & Compliance**
- **Activity Logging**: Track all user actions (logins, assignments, completions)
- **Entity Tracking**: Monitor changes to companies, users, courses, exams
- **User Attribution**: Record who made what changes and when
- **IP Tracking**: Log IP addresses for security monitoring
- **Audit Trail**: Complete audit trail for compliance requirements

#### 9. **Public Features**
- **Public Assessment**: Free security awareness test for visitors
- **Demo Requests**: Landing page for demo request submissions
- **Partner Carousel**: Display partner logos on landing page
- **Lead Generation**: Capture leads through public assessments

#### 10. **User Management**
- **Bulk User Import**: CSV upload for adding multiple employees
- **Role Assignment**: Platform admin, company admin, or employee roles
- **Employee ID Management**: Support for custom employee identifiers
- **User Status**: Active/inactive user management
- **Department Assignment**: Link users to organizational departments

---

## Roles & Permissions

### 1. Platform Administrator (PLATFORM_ADMIN)

**Access Level**: Full platform access across all companies

**Capabilities**:

#### Company Management
- Create, edit, and delete companies
- View all companies and their data
- Manage company subscriptions and licenses
- Set package types (TYPE_A: Full Courses, TYPE_B: Exam Only)
- Configure license limits per company
- Activate/deactivate companies

#### User Management
- Create, edit, and delete users across all companies
- Assign roles to users
- View all user activity and progress
- Reset user passwords
- Manage user access

#### Content Management
- Create, edit, and delete courses
- Upload course content (videos, slides, text)
- Create and manage course quizzes
- Create, edit, and delete exams
- Create and manage exam questions
- Set passing scores and time limits

#### Phishing Campaign Management
- Create and manage phishing email templates
- View all phishing campaign requests from all companies
- Approve or reject campaign requests
- Execute campaigns via Gophish integration
- Adjust annual phishing quotas per company
- View all campaign results and analytics

#### Certificate Management
- Create and manage certificate templates
- View all issued certificates
- Customize certificate designs
- Manage certificate numbering

#### Analytics & Reporting
- View platform-wide analytics
- Access all company dashboards
- View all employee progress
- Generate comprehensive reports
- Monitor platform usage metrics

#### Subscription & Billing
- Create and manage subscriptions
- Generate invoices
- Track payments
- Set pricing and billing terms
- View financial reports

#### Audit & Compliance
- View complete audit logs
- Monitor all user activity
- Track system changes
- Export audit data

#### Configuration
- Manage platform settings
- Configure partner logos
- Manage landing page content
- Set system-wide defaults

**Data Access**:
- Full read/write access to all tables
- Can view and modify data for any company
- Access to all audit logs and analytics

---

### 2. Company Administrator (COMPANY_ADMIN)

**Access Level**: Full access within their own company only

**Capabilities**:

#### Employee Management
- Add, edit, and remove employees in their company
- View employee profiles and progress
- Assign employee IDs
- Bulk import employees via CSV
- Manage employee department assignments
- Reset employee passwords

#### Department Management
- Create and manage company departments
- Organize department hierarchy
- Assign employees to departments
- View department-level analytics

#### Course & Exam Assignment
- Assign courses to individual employees
- Assign courses to entire departments
- Assign exams to employees or departments
- Set assignment due dates
- Configure exam attempt limits
- Mark assignments as mandatory

#### Training Monitoring
- View employee course progress
- Monitor exam results
- Track completion rates
- View employee certificates
- Generate progress reports

#### Phishing Campaign Management
- View company phishing quota (remaining campaigns)
- Create phishing campaign requests
- Select phishing templates
- Choose target departments/employees
- Set campaign schedule
- View campaign request status (draft, submitted, approved, running, completed)
- View phishing campaign results for their company
- Monitor employee phishing susceptibility
- View department vulnerability scores

#### Analytics & Reports
- View company dashboard
- Access employee analytics
- Monitor training completion rates
- View exam pass/fail rates
- Track phishing simulation results
- Export company reports
- View department performance

#### Subscription Information
- View company subscription details
- View license usage
- View invoices
- Check subscription expiration dates

**Data Access**:
- Read/write access to their company's data only
- Can view all employees in their company
- Can view assigned courses and exams
- Can view phishing campaigns for their company
- Can view company subscriptions and invoices
- Cannot access other companies' data
- Cannot modify platform-wide settings

---

### 3. Employee (EMPLOYEE)

**Access Level**: Access to their own training materials and progress only

**Capabilities**:

#### Course Access
- View courses assigned to them
- Start and complete assigned courses
- Watch videos, view slides, read text content
- Progress through course materials
- Complete in-course quizzes
- Track their own course completion

#### Exam Taking
- View exams assigned to them
- Take assigned exams
- View time limits and passing scores
- Submit exam answers
- View exam results immediately
- Review correct answers and explanations
- Retry exams (if allowed by admin)

#### Phishing Awareness
- Receive phishing simulation emails
- Participate in phishing campaigns
- (Ideally) Report suspicious emails
- View their phishing simulation history

#### Progress Tracking
- View their own dashboard
- Monitor their course progress
- Track completed courses
- View exam scores
- Check pending assignments

#### Certificates
- View earned certificates
- Download certificate PDFs
- Access certificate history

#### Profile
- View their profile information
- Update contact details (if permitted)
- View their employee ID and department

**Data Access**:
- Read-only access to courses and exams assigned to them
- Read/write access to their own course progress
- Write access to submit exam answers
- Read access to their own exam results
- Read access to their own certificates
- Cannot view other employees' data
- Cannot access company-wide analytics

---

## Integration Aspects

### 1. Gophish Integration (Phishing Campaigns)

**Purpose**: Execute phishing simulation campaigns

**Integration Points**:
- API connection to Gophish server
- Campaign creation and management
- Template synchronization
- Target list management
- Result tracking and statistics

**Data Flow**:
1. Company admin creates campaign request in Sinnara
2. Platform admin reviews and approves request
3. Sinnara creates campaign in Gophish via API
4. Gophish sends phishing emails to targets
5. Gophish tracks opens, clicks, and submissions
6. Results sync back to Sinnara database
7. Analytics displayed in Sinnara dashboard

**Required Configuration**:
- Gophish API URL
- API key authentication
- Webhook endpoints for real-time updates
- Custom domain configuration (DNS records)

**Tables Involved**:
- `phishing_campaigns` (stores campaign data and Gophish campaign ID)
- `phishing_campaign_targets` (individual employee results)
- `phishing_templates` (email templates)
- `phishing_domains` (custom sending domains)

---

### 2. Email Service Integration

**Purpose**: Send system notifications and certificates

**Use Cases**:
- Welcome emails for new users
- Password reset emails
- Assignment notifications
- Certificate delivery
- Campaign completion notifications
- Invoice notifications

**Recommended Service**: SendGrid, AWS SES, or Postmark

**Required Configuration**:
- SMTP credentials or API keys
- From email address and domain
- Email templates
- Delivery tracking

---

### 3. File Storage Integration

**Purpose**: Store uploaded content and generated files

**Content Types**:
- Course videos and slides
- Certificate PDFs
- Company logos
- Partner logos
- Template backgrounds

**Recommended Service**: Supabase Storage, AWS S3, or Cloudflare R2

**Required Configuration**:
- Storage bucket
- Access credentials
- CDN configuration for content delivery
- Signed URLs for secure access

---

### 4. Certificate Generation

**Purpose**: Generate professional PDF certificates

**Options**:
- Server-side PDF generation library (e.g., PDFKit, Puppeteer)
- Third-party API (e.g., DocuSeal, PDFMonkey)
- HTML-to-PDF conversion

**Data Sources**:
- Certificate templates from database
- Employee information
- Course completion data
- Certificate numbers

---

### 5. Analytics & Reporting

**Purpose**: Generate insights and reports

**Integration Points**:
- Dashboard visualizations (charts, graphs)
- Export to Excel/CSV
- PDF report generation
- Real-time metrics

**Recommended Libraries**:
- Chart.js or Recharts for visualizations
- ExcelJS for Excel exports
- Custom PDF generation for reports

---

## Database Architecture

### Database Type: **PostgreSQL (via Supabase)**

**Why PostgreSQL?**
- Robust relational database with advanced features
- Strong ACID compliance
- Excellent JSON support (jsonb type)
- Row Level Security (RLS) for multi-tenancy
- Powerful query capabilities
- Open-source and scalable

**Supabase Features Used**:
- Managed PostgreSQL database
- Automatic API generation
- Real-time subscriptions
- Row Level Security (RLS)
- Built-in authentication system
- Storage for files

---

## Database Schema Overview

### Core Tables

#### 1. **companies**
Multi-tenant company information
- Company profile (name, package type, license limit)
- Subscription details (type, start, end dates)
- Status (active, suspended, expired, cancelled)
- Admin contact information

#### 2. **users**
All platform users (platform admins, company admins, employees)
- Authentication (email, hashed password)
- Profile (name, phone, employee ID)
- Role (PLATFORM_ADMIN, COMPANY_ADMIN, EMPLOYEE)
- Company association
- Department assignment

#### 3. **courses**
Training course library
- Course metadata (title, description, duration)
- Content type (VIDEO, SLIDES, TEXT)
- Content URL or embedded data
- Display order

#### 4. **quizzes**
In-course quiz questions
- Associated course
- Question text and options
- Correct answer and explanation
- Display order

#### 5. **exams**
Assessment templates
- Exam type (PRE_ASSESSMENT, POST_ASSESSMENT, GENERAL)
- Passing score threshold
- Time limit (optional)

#### 6. **exam_questions**
Questions in each exam
- Associated exam
- Question text and options
- Correct answer and explanation
- Display order

#### 7. **employee_courses**
Course assignment and progress tracking
- Employee and course link
- Assignment date
- Start and completion timestamps
- Status (ASSIGNED, IN_PROGRESS, COMPLETED)

#### 8. **assigned_exams**
Exam assignments
- Assigned to employee or department
- Due dates and mandatory flag
- Maximum attempts allowed
- Assignment status

#### 9. **exam_attempts**
Individual exam attempts
- Attempt number tracking
- Score and pass/fail status
- Time spent and answers
- Start and completion timestamps

#### 10. **exam_results**
Historical exam results
- Employee exam performance
- Score and percentage
- Pass/fail status
- Answer details

#### 11. **departments**
Company organizational structure
- Department name and description
- Parent department (hierarchy)
- Company association

#### 12. **employee_departments**
Employee-department relationships
- Links employees to departments
- Assignment tracking

#### 13. **certificate_templates**
Certificate design templates
- HTML template with variables
- Styling and branding
- Background and signature images

#### 14. **issued_certificates**
Generated certificates
- Unique certificate number
- Employee and course details
- Completion date and score
- PDF URL

#### 15. **phishing_campaign_quotas**
Annual phishing campaign limits
- Company quota (default: 4/year)
- Used campaigns counter
- Quota year tracking
- Last reset date

#### 16. **phishing_templates**
Phishing email templates
- Template content (subject, HTML)
- Category and difficulty level
- Language support
- Active/inactive status

#### 17. **phishing_campaign_requests**
Campaign request tickets
- Unique ticket number
- Requested by company admin
- Template and target selection
- Status tracking (DRAFT → SUBMITTED → APPROVED → RUNNING → COMPLETED)
- Admin approval/rejection

#### 18. **phishing_campaigns**
Executed phishing campaigns
- Gophish campaign ID
- Campaign metrics (sent, opened, clicked, reported)
- Launch and completion dates
- Associated request

#### 19. **phishing_campaign_targets**
Individual employee campaign results
- Email delivery status
- Opened, clicked, submitted, reported timestamps
- Per-employee tracking

#### 20. **phishing_domains**
Custom sending domains
- Domain name
- DNS verification status
- Verification token

#### 21. **subscriptions**
Subscription history
- Subscription type and dates
- License count
- Amount and currency
- Status tracking

#### 22. **invoices**
Billing invoices
- Unique invoice number
- Amount, tax, total
- Due dates
- Payment status and details

#### 23. **audit_logs**
Activity and change tracking
- User actions (CREATE, UPDATE, DELETE, LOGIN, etc.)
- Entity tracking (USER, COMPANY, COURSE, EXAM)
- Old and new values (JSONB)
- IP address and user agent
- Timestamp

#### 24. **public_assessments**
Public visitor test submissions
- Visitor information
- Test score and answers
- Lead generation data

#### 25. **demo_requests**
Demo request submissions from landing page
- Contact information
- Company details
- Request message

---

## What Needs to Be Developed by the Programmer

### 1. Backend Development (Supabase Edge Functions)

#### Required Edge Functions:

**a) User Management**
- `create-user`: Create new users with hashed passwords
- `update-user`: Update user information
- `bulk-import-employees`: Parse CSV and create multiple employees
- `reset-password`: Handle password reset logic

**b) Course & Exam Management**
- `assign-course-to-department`: Assign course to all department employees
- `assign-exam-to-department`: Assign exam to all department employees
- `submit-exam`: Process exam submission and calculate results
- `calculate-course-progress`: Update course completion status

**c) Certificate Generation**
- `generate-certificate`: Create certificate PDF from template
- `issue-certificate`: Generate certificate number and store certificate
- `send-certificate-email`: Email certificate to employee

**d) Phishing Campaign Integration**
- `create-gophish-campaign`: Create campaign in Gophish via API
- `sync-campaign-results`: Pull campaign results from Gophish
- `process-campaign-webhook`: Handle Gophish webhooks for real-time updates
- `deduct-phishing-quota`: Manage campaign quota tracking

**e) Subscription & Billing**
- `generate-invoice`: Create invoice with auto-generated number
- `process-payment`: Record payment information
- `check-subscription-expiry`: Monitor and notify about expiring subscriptions

**f) Analytics & Reporting**
- `generate-company-report`: Create comprehensive company analytics
- `export-employee-data`: Export employee data to CSV/Excel
- `calculate-department-vulnerability`: Calculate security scores

**g) Audit Logging**
- `log-user-action`: Record user activities in audit logs
- `track-login`: Record login attempts and sessions

---

### 2. Frontend Development (React Components)

#### Platform Admin Pages (Already Exist - May Need Enhancement)
- ✅ Companies management
- ✅ Users management
- ✅ Courses management
- ✅ Exams management
- ✅ Phishing templates management
- ✅ Phishing campaign management
- ✅ Subscriptions management
- ✅ Certificate templates
- ✅ Analytics dashboard
- ✅ Audit logs
- ✅ Demo requests
- ✅ Public submissions
- ✅ Partners management

#### Company Admin Pages (Already Exist - May Need Enhancement)
- ✅ Company dashboard
- ✅ Employees management
- ✅ Departments management
- ✅ Course assignment
- ✅ Exam assignment
- ✅ Employee detail view
- ✅ Phishing dashboard
- ✅ Phishing request creation
- ✅ Analytics

#### Employee Pages (Already Exist - May Need Enhancement)
- ✅ Employee dashboard
- ✅ My courses
- ✅ Course viewer
- ✅ My exams
- ✅ Exam viewer
- ✅ Certificates

#### Additional Frontend Work Needed:
- **File Upload Components**: For course videos, images, certificates
- **Rich Text Editor**: For course content creation
- **Chart Components**: For analytics visualization (Chart.js/Recharts)
- **CSV Import Modal**: For bulk employee import
- **PDF Viewer**: For certificate preview
- **Notification System**: Real-time notifications for assignments
- **Email Template Editor**: For phishing template creation
- **Calendar/Scheduling**: For campaign scheduling
- **Data Export**: Excel/CSV export functionality
- **Search & Filtering**: Advanced search across data

---

### 3. Authentication & Security

#### Required Implementation:
- **Password Hashing**: bcrypt or similar for password security
- **Session Management**: JWT tokens or session cookies
- **Password Reset Flow**: Email-based password reset
- **Login Rate Limiting**: Prevent brute force attacks
- **Role-Based Access Control**: Enforce permissions based on role
- **RLS Policy Testing**: Verify all RLS policies work correctly

---

### 4. File Management

#### Required Features:
- **File Upload**: Upload videos, PDFs, images
- **File Storage**: Store files in Supabase Storage or S3
- **File Serving**: Serve files via CDN with signed URLs
- **File Validation**: Check file types and sizes
- **Thumbnail Generation**: Generate thumbnails for images/videos

---

### 5. Email System

#### Required Emails:
- Welcome email for new users
- Password reset email
- Course/exam assignment notification
- Certificate delivery email
- Invoice email
- Campaign request status updates
- Subscription expiry warnings

**Implementation**: Use SendGrid, AWS SES, or similar service

---

### 6. Gophish Integration

#### Required API Calls:
- **Create Campaign**: POST to Gophish API with campaign data
- **Update Campaign**: PATCH campaign status
- **Get Results**: GET campaign statistics
- **List Templates**: GET available templates
- **Webhook Handler**: Receive real-time events

**Authentication**: API key-based authentication

---

### 7. Analytics & Reporting

#### Required Reports:
- Company training summary (completion rates, average scores)
- Employee progress report (individual or bulk)
- Department performance report
- Phishing campaign effectiveness report
- Subscription and billing report
- Audit trail report

**Export Formats**: PDF, Excel, CSV

---

### 8. Testing & Quality Assurance

#### Required Testing:
- **Unit Tests**: Test edge functions and utilities
- **Integration Tests**: Test database operations and RLS
- **E2E Tests**: Test complete user flows
- **Security Testing**: Verify RLS policies and authentication
- **Performance Testing**: Test with large datasets
- **Cross-browser Testing**: Ensure compatibility

---

### 9. Deployment & DevOps

#### Required Setup:
- **Environment Variables**: Configure for dev/staging/prod
- **Database Migrations**: Version control for schema changes
- **CI/CD Pipeline**: Automated testing and deployment
- **Monitoring**: Application performance monitoring (APM)
- **Error Tracking**: Sentry or similar error tracking
- **Backup Strategy**: Regular database backups
- **SSL Certificates**: HTTPS for all environments
- **Domain Configuration**: Custom domain setup

---

### 10. Performance Optimization

#### Required Optimizations:
- **Database Indexing**: Already added indexes in migrations
- **Query Optimization**: Use proper joins and aggregations
- **Caching**: Cache frequently accessed data
- **Lazy Loading**: Load course content on demand
- **Image Optimization**: Compress and optimize images
- **Code Splitting**: Split JavaScript bundles
- **CDN Integration**: Serve static assets via CDN

---

## Development Priority Roadmap

### Phase 1: Core Authentication & User Management
1. Implement secure password hashing
2. Build login/logout functionality
3. Create password reset flow
4. Test RLS policies for users table

### Phase 2: Course & Exam System
1. Build course content viewer
2. Implement quiz functionality
3. Build exam taking interface
4. Implement exam result calculation
5. Test course/exam assignment

### Phase 3: Certificate Generation
1. Design certificate templates
2. Implement PDF generation
3. Build certificate delivery system
4. Test certificate numbering

### Phase 4: Phishing Campaigns
1. Set up Gophish API connection
2. Build campaign request workflow
3. Implement campaign creation
4. Build result tracking
5. Test quota management

### Phase 5: Analytics & Reporting
1. Build dashboard visualizations
2. Implement data export
3. Create PDF reports
4. Build audit log viewer

### Phase 6: Subscription & Billing
1. Implement subscription management
2. Build invoice generation
3. Add payment tracking
4. Test expiry notifications

### Phase 7: Polish & Production
1. Comprehensive testing
2. Performance optimization
3. Security audit
4. Documentation
5. Deployment

---

## Technical Stack Summary

- **Frontend**: React, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Database**: PostgreSQL with Row Level Security
- **Authentication**: Custom auth (email/password)
- **File Storage**: Supabase Storage or AWS S3
- **Email**: SendGrid or AWS SES
- **PDF Generation**: PDFKit or Puppeteer
- **Phishing**: Gophish API integration
- **Analytics**: Chart.js or Recharts
- **Hosting**: Netlify, Vercel, or similar
- **Version Control**: Git

---

## Security Considerations

1. **Multi-tenancy**: Strict RLS policies prevent cross-company data access
2. **Password Security**: Bcrypt hashing with salt
3. **SQL Injection**: Parameterized queries via Supabase client
4. **XSS Protection**: React's built-in escaping
5. **CSRF Protection**: Token-based authentication
6. **Audit Trail**: Complete logging of sensitive actions
7. **Data Encryption**: HTTPS/TLS for all communications
8. **Access Control**: Role-based permissions enforced at database level

---

This documentation provides a complete overview of the platform, its features, roles, integrations, database structure, and development requirements. Use this as a guide for development planning and team coordination.
