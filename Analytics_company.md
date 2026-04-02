# Company Admin Analytics Calculations

This document explains how each analytics metric is calculated in `src/pages/company-admin/AnalyticsPage.tsx`.

> **Scope:** All data is filtered to the current company (`user.company_id`).

---

## Top Summary Cards

### 1. Employees Passed

**Calculation:**
```typescript
const passedCount = performance.filter(p => p.status === 'Passed').length;
```
Counts employees whose `status` is "Passed" (based on post-assessment score >= 70%).

---

### 2. Avg Improvement

**Calculation:**
```typescript
const avgImprovement = performance.length > 0
  ? Math.round(performance.reduce((sum, p) => sum + p.improvement, 0) / performance.length)
  : 0;
```
Average of all employees' improvement scores.

**Where improvement is:**
```typescript
const improvement = (postScore && preScore) ? postScore - preScore : 0;
```
Difference between post-assessment and pre-assessment percentage scores.

---

### 3. Pass Rate

**Calculation:**
```typescript
const passRate = performance.length > 0 
  ? Math.round((passedCount / performance.length) * 100) 
  : 0;
```
Percentage of employees who passed out of total employees.

---

## Employee Performance Table

### Per-Employee Data

| Column | Calculation |
|--------|-------------|
| **Employee** | `users.full_name` where `role = 'EMPLOYEE'` and `company_id` matches |
| **Courses Progress** | `coursesCompleted / totalCourses` |
| **Exams Taken** | Count of `exam_results` for this employee |
| **Pre-Assessment** | Latest `exam_results.percentage` where `exam_type = 'PRE_ASSESSMENT'` |
| **Post-Assessment** | Latest `exam_results.percentage` where `exam_type = 'POST_ASSESSMENT'` |
| **Improvement** | `postScore - preScore` (0 if either is missing) |
| **Status** | Based on assessment scores (see below) |

### Status Logic

```typescript
const status = postScore
  ? postScore >= 70
    ? 'Passed'
    : 'Failed'
  : preScore
    ? 'In Progress'
    : 'Not Started';
```

| Condition | Status |
|-----------|--------|
| Has post-assessment score >= 70% | **Passed** |
| Has post-assessment score < 70% | **Failed** |
| Has pre-assessment but no post-assessment | **In Progress** |
| No assessments taken | **Not Started** |

### Courses Completed (per employee)

```typescript
const coursesCompleted = courseProgress?.filter(cp => cp.completed_at !== null).length || 0;
```
Count of `employee_courses` where `completed_at` is not null.

### Total Courses

```typescript
const { data: allCourses } = await supabase
  .from('courses')
  .select('id')
  .eq('company_id', user.company_id);

const totalCoursesCount = allCourses?.length || 0;
```
Count of courses assigned to this company.

### Total Exams

```typescript
const { data: allExams } = await supabase
  .from('exams')
  .select('id');

const totalExamsCount = allExams?.length || 0;
```
Count of all exams in the system.

---

## Course Completion Statistics

### Total Assigned

```typescript
const employeeIds = allEmployees.map(e => e.id);

const { count: assignedCount } = await supabase
  .from('employee_courses')
  .select('id', { count: 'exact', head: true })
  .in('employee_id', employeeIds);
```
Total count of course assignments for employees in this company.

### Total Completed

```typescript
const { count: completedCount } = await supabase
  .from('employee_courses')
  .select('...', { count: 'exact' })
  .in('employee_id', employeeIds)
  .eq('status', 'COMPLETED');
```
Count of `employee_courses` where `status = 'COMPLETED'` for employees in this company.

### Completion Rate

```typescript
const completionRate = assignedCount && assignedCount > 0
  ? (completedCount || 0) / assignedCount * 100
  : 0;
```
`(completedCount / assignedCount) * 100`

### Employees Completed

List of `employee_courses` records with `status = 'COMPLETED'`, including employee name and course title.

### Incomplete Employees

```typescript
const completedEmployeeIds = [...new Set(completions?.map(c => c.employee_id))];
const incompleteEmployees = allEmployees.filter(
  emp => !completedEmployeeIds.includes(emp.id)
);
```
Employees in this company who have NOT completed any course.

---

## Exam Performance Statistics

### Total Attempts

```typescript
const employeeIds = employees.map(e => e.id);

const { data: attempts } = await supabase
  .from('exam_results')
  .select('id, employee_id, exam_id, passed, percentage')
  .in('employee_id', employeeIds);

totalAttempts: attempts.length
```
Count of `exam_results` records for employees in this company.

### Unique Employees (Employees Tested)

```typescript
const uniqueEmployees = [...new Set(attempts.map(a => a.employee_id))].length;
```
Count of distinct `employee_id` values in `exam_results`.

### Passed Count

```typescript
const passedCount = attempts.filter(a => a.passed).length;
```
Count of `exam_results` where `passed = true`.

### Failed Count

```typescript
const failedCount = attempts.length - passedCount;
```
Total attempts minus passed count.

### Pass Rate

```typescript
const passRate = attempts.length > 0 ? (passedCount / attempts.length) * 100 : 0;
```
`(passedCount / totalAttempts) * 100`

### Avg Score

```typescript
const avgScore = attempts.length > 0
  ? attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length
  : 0;
```
Average of `exam_results.percentage` across all attempts.

> **Note:** Uses `percentage` (not raw `score`) for accurate representation.

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     Company Scope Filter                         │
│                    (user.company_id)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│     users     │    │    courses    │    │     exams     │
│ role=EMPLOYEE │    │  company_id   │    │   exam_type   │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
   Employees            Total Courses         Pre/Post Exams
        │                     │                     │
        └──────────┬──────────┘                     │
                   ▼                                │
          ┌────────────────┐                        │
          │employee_courses│                        │
          └────────────────┘                        │
                   │                                │
        ┌──────────┴──────────┐                     │
        ▼                     ▼                     ▼
   Assigned              Completed           ┌─────────────┐
   Courses               Courses             │exam_results │
                                             └─────────────┘
                                                    │
                              ┌──────────┬──────────┼──────────┐
                              ▼          ▼          ▼          ▼
                          Attempts   Pass Rate   Avg Score   Status
```

---

## Key Differences from Platform Admin Analytics

| Aspect | Company Admin | Platform Admin |
|--------|---------------|----------------|
| **Scope** | Single company | All companies |
| **Focus** | Pre/Post assessment comparison | Platform-wide metrics |
| **Employee View** | Individual performance table | Aggregated by company |
| **Courses** | Company's assigned courses | All platform courses |
