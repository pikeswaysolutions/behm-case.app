# Behm Funeral Home Case & Sales Management System

## Original Problem Statement
Build a funeral home case and sales management application with:
- User roles (Admin, Funeral Director)
- Admin-controlled permissions per director
- Case management (CRUD)
- Director/User/ServiceType/SaleType management
- Reporting with date filters, grouping, and charts
- PDF/CSV export
- Excel import for data migration

## User Personas
1. **Administrator**: Full system access, manages users, directors, lookup tables, and can view all reports
2. **Funeral Director**: Individual login, can only view their own cases/reports, may have edit permissions

## Core Requirements (Static)
- JWT-based email/password authentication
- Role-based access control (Admin vs Director)
- Per-director case editing permissions
- Cases with case number, date of death, customer info, service type, sale type, director, payments, totals
- Dashboard with metrics, charts, and director breakdown
- Date range filtering and period grouping (weekly/monthly/quarterly/yearly)
- PDF and CSV export
- Excel import with duplicate detection

## Architecture
- **Backend**: FastAPI (Python) on port 8001 with /api prefix
- **Frontend**: React with Tailwind CSS, Shadcn/UI components
- **Database**: MongoDB
- **Charts**: Chart.js with react-chartjs-2
- **PDF**: ReportLab (server-side)
- **Excel Import**: openpyxl

## What's Been Implemented (January 28, 2026)
✅ Authentication system (JWT, login/logout)
✅ Role-based access control (Admin/Director)
✅ Per-director permissions (can_edit_cases flag)
✅ Dashboard with 5 key metrics + 2 charts
✅ Cases page with search, filters, pagination
✅ Case detail/edit form with financials
✅ Directors management (CRUD, reassign cases)
✅ Users management (CRUD, permissions)
✅ Service Types management (CRUD)
✅ Sale Types management (CRUD)
✅ Reports page with date range filters and charts
✅ CSV export functionality
✅ PDF export functionality
✅ Excel import with column mapping
✅ Data seeding (demo users, sample cases)
✅ Responsive design with Behm Funeral Home aesthetic

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ Authentication
- ✅ Case management
- ✅ Dashboard with metrics
- ✅ Role-based access

### P1 (Important) - DONE
- ✅ Reports with charts
- ✅ Export (PDF/CSV)
- ✅ Import (Excel)
- ✅ Admin management pages

### P2 (Nice to Have) - Future
- [ ] Audit logging for all changes
- [ ] Advanced report templates
- [ ] Email notifications
- [ ] Mobile-optimized views
- [ ] Bulk case operations

## Demo Credentials
- Admin: admin@behmfuneral.com / admin123
- Director: eric@behmfuneral.com / director123

## Next Tasks
1. Add audit logging for compliance
2. Implement print-friendly report views
3. Add email notifications for balance due reminders
4. Create advanced report templates
