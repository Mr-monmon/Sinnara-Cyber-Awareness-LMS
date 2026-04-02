# Platform Analytics Calculations

This document explains how each analytics metric is calculated in `src/pages/platform-admin/AnalyticsPage.tsx`.

---

## 1. Total Companies

**Source:** `companies` table

**Calculation:**
```typescript
totalCompanies: companies.length
```
Counts all records in the `companies` table.

---

## 2. Active Companies

**Source:** `companies` table

**Calculation:**
```typescript
const activeCompanies = companies.filter(c => c.is_active !== false).length;
```
Filters companies where `is_active` is not explicitly `false` (defaults to active if undefined).

---

## 3. Total Employees

**Source:** `users` table

**Calculation:**
```typescript
const employees = users.filter(u => u.role === 'EMPLOYEE');
totalEmployees: employees.length
```
Filters users with `role === 'EMPLOYEE'` and counts them.

---

## 4. Total Users

**Source:** `users` table

**Calculation:**
```typescript
totalUsers: users.length
```
Counts all records in the `users` table (includes all roles: EMPLOYEE, COMPANY_ADMIN, PLATFORM_ADMIN).

---

## 5. Completed Courses

**Source:** `employee_courses` table

**Calculation:**
```typescript
const completedCourses = employeeCourses.filter(ec => ec.status === 'COMPLETED').length;
```
Counts records in `employee_courses` table where `status === 'COMPLETED'`.

---

## 6. Total Courses

**Source:** `courses` table

**Calculation:**
```typescript
totalCourses: courses.length
```
Counts all records in the `courses` table.

---

## 7. Total Exams

**Source:** `exams` table

**Calculation:**
```typescript
totalExams: exams.length
```
Counts all records in the `exams` table.

---

## 8. Passed Exams

**Source:** `exam_results` table

**Calculation:**
```typescript
const passedExams = examResults.filter(er => er.passed).length;
```
Counts records in `exam_results` table where `passed === true`.

---

## 9. General Awareness Level

**Source:** `exam_results` table

**Calculation:**
```typescript
const avgScore = examResults.length > 0
  ? examResults.reduce((sum, er) => sum + (er.percentage || 0), 0) / examResults.length
  : 0;
```
Calculates the average `percentage` from all exam results.

> **Note:** Uses `percentage` instead of `score` because raw score doesn't account for total questions (e.g., score 1/1 = 100% vs score 1/10 = 10%).

**Label Thresholds:**
| Score Range | Label |
|-------------|-------|
| ≥ 90% | Excellent |
| ≥ 70% | Good |
| ≥ 50% | Average |
| < 50% | Poor |

---

## 10. Total Activities

**Source:** `employee_courses` + `exam_results` tables

**Calculation:**
```typescript
platformUsage: employeeCourses.length + examResults.length
```
Sum of all `employee_courses` records + all `exam_results` records.

---

## 11. Company Statistics

A per-company breakdown table with the following columns:

| Column | Calculation |
|--------|-------------|
| **Employees** | Count of users with `role === 'EMPLOYEE'` and matching `company_id` |
| **Completed Courses** | Count of `employee_courses` with `status === 'COMPLETED'` for employees in that company |
| **Passed Exams** | Count of `exam_results` with `passed === true` for employees in that company |
| **Average Score** | Average of all `exam_results.percentage` for employees in that company |
| **Awareness Level** | Same thresholds as general awareness (≥90=Excellent, ≥70=Good, ≥50=Average, <50=Poor) |

---

## Data Flow Summary

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  companies  │     │    users    │     │   courses   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
 Total Companies    Total Users          Total Courses
 Active Companies   Total Employees

┌──────────────────┐     ┌──────────────┐
│ employee_courses │     │ exam_results │
└──────────────────┘     └──────────────┘
         │                      │
         ▼                      ▼
  Completed Courses       Passed Exams
                          Total Exams
                          Average Score
                          Awareness Level

Total Activities = employee_courses.count + exam_results.count
```
