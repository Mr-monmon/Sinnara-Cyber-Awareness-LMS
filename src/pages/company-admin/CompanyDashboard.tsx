import { useState, useEffect } from "react";
import { Users, TrendingUp, Award, AlertCircle } from "lucide-react";
import { DashboardLayout } from "../../components/layouts/DashboardLayout";
import { EmployeesPage } from "./EmployeesPage";
import { AnalyticsPage } from "./AnalyticsPage";
import { DepartmentsPage } from "./DepartmentsPage";
import { ExamAssignmentPage } from "./ExamAssignmentPage";
import { EmployeeDetailPage } from "./EmployeeDetailPage";
import { PhishingDashboardPage } from "./PhishingDashboardPage";
import { PhishingRequestPage } from "./PhishingRequestPage";
import { CourseAssignmentPage } from "./CourseAssignmentPage";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Company } from "../../lib/types";
import LoadingScreen from "../../components/LoadingScreen";
import InactivatedSubscription from "../../components/InactivatedSubscription";

export const CompanyDashboard = () => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState("dashboard");
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );

  const [stats, setStats] = useState({
    totalEmployees: 0,
    completedTraining: 0,
    averageScore: 0,
    pendingAssessments: 0,
  });
  const [topEmployees, setTopEmployees] = useState<
    {
      id: string;
      name: string;
      email: string;
      averageScore: number;
      examsTaken: number;
    }[]
  >([]);

  useEffect(() => {
    loadCompany();
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user?.company_id) return;

    try {
      const { data: employees } = await supabase
        .from("users")
        .select("id, full_name, email")
        .eq("company_id", user.company_id)
        .eq("role", "EMPLOYEE");

      const employeeIds = employees?.map((e) => e.id) || [];

      if (employeeIds.length === 0) {
        setStats({
          totalEmployees: 0,
          completedTraining: 0,
          averageScore: 0,
          pendingAssessments: 0,
        });
        return;
      }

      const [resultsRes, courseProgressRes] = await Promise.all([
        supabase
          .from("exam_results")
          .select("employee_id, percentage, passed")
          .in("employee_id", employeeIds),
        supabase
          .from("employee_courses")
          .select("employee_id, completed_at")
          .in("employee_id", employeeIds)
          .not("completed_at", "is", null),
      ]);

      const employeesWithCompletedCourses = new Set(
        courseProgressRes.data?.map((ec) => ec.employee_id) || []
      );

      const employeesWithPassedExams = new Set(
        resultsRes.data?.filter((r) => r.passed).map((r) => r.employee_id) || []
      );

      const totalCompleted = new Set([
        ...employeesWithCompletedCourses,
        ...employeesWithPassedExams,
      ]).size;

      const { data: topEmployeesData } = await supabase.functions.invoke(
        "get_top_performance",
        {
          method: "POST",
          body: { company_id: user.company_id },
        }
      );

      const { avgScore, rankedEmployees } = topEmployeesData;

      setStats({
        totalEmployees: employees?.length || 0,
        completedTraining: totalCompleted,
        averageScore: avgScore,
        pendingAssessments: (employees?.length || 0) - totalCompleted,
      });

      setTopEmployees(rankedEmployees || []);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading stats:", error);
      setIsLoading(false);
    }
  };

  const loadCompany = async () => {
    setIsLoading(true);
    if (!user?.company_id) return;
    try {
      const { data: company } = await supabase
        .from("companies")
        .select("id , name, is_active")
        .eq("id", user.company_id)
        .single();
      setCompany(company);
    } catch (error) {
      console.error("Error loading company:", error);
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (activePage === "employee-detail" && selectedEmployeeId) {
      return (
        <EmployeeDetailPage
          employeeId={selectedEmployeeId}
          onBack={() => {
            setActivePage("employees");
            setSelectedEmployeeId(null);
          }}
        />
      );
    }

    switch (activePage) {
      case "employees":
        return (
          <EmployeesPage
            onViewEmployee={(id) => {
              setSelectedEmployeeId(id);
              setActivePage("employee-detail");
            }}
          />
        );
      case "departments":
        return <DepartmentsPage />;
      case "exam-assignment":
        return <ExamAssignmentPage />;
      case "course-assignment":
        return <CourseAssignmentPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "phishing-dashboard":
        return <PhishingDashboardPage />;
      case "phishing-request":
        return <PhishingRequestPage />;
      default:
        const completionRate =
          stats.totalEmployees > 0
            ? Math.round((stats.completedTraining / stats.totalEmployees) * 100)
            : 0;
        const pendingRate = stats.totalEmployees > 0 ? 100 - completionRate : 0;

        const toneStyles = {
          blue: {
            bar: "from-blue-500/70 via-blue-500 to-blue-600",
            iconBg: "bg-blue-50",
            icon: "text-blue-600",
          },
          green: {
            bar: "from-green-500/70 via-green-500 to-green-600",
            iconBg: "bg-green-50",
            icon: "text-green-600",
          },
          indigo: {
            bar: "from-indigo-500/70 via-indigo-500 to-indigo-600",
            iconBg: "bg-indigo-50",
            icon: "text-indigo-600",
          },
          orange: {
            bar: "from-orange-500/70 via-orange-500 to-orange-600",
            iconBg: "bg-orange-50",
            icon: "text-orange-600",
          },
        } as const;

        const statCards = [
          {
            label: "Total Employees",
            value: stats.totalEmployees,
            icon: Users,
            tone: "blue",
            subtext: "Active accounts",
          },
          {
            label: "Completed Training",
            value: stats.completedTraining,
            icon: Award,
            tone: "green",
            subtext: "Certified or passed",
          },
          {
            label: "Average Score",
            value: `${stats.averageScore}%`,
            icon: TrendingUp,
            tone: "indigo",
            subtext: "Across assessments",
          },
          {
            label: "Pending Assessments",
            value: stats.pendingAssessments,
            icon: AlertCircle,
            tone: "orange",
            subtext: "Needs attention",
          },
        ] as const;

        return (
          <div className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    Company Dashboard
                  </h1>
                  <p className="text-slate-600">
                    Overview of your organization&apos;s training progress
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Completion
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {completionRate}%
                    </div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Avg. Score
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {stats.averageScore}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                const tone = toneStyles[card.tone];
                return (
                  <div
                    key={card.label}
                    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.bar}`}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-600">
                          {card.label}
                        </div>
                        <div className="text-3xl font-bold text-slate-900">
                          {card.value}
                        </div>
                        <div className="text-xs text-slate-500">
                          {card.subtext}
                        </div>
                      </div>
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.iconBg}`}
                      >
                        <Icon className={`h-6 w-6 ${tone.icon}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Completion Mix
                  </h3>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Last 30 days
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-1 items-center gap-6 2xl:grid-cols-[180px_1fr]">
                  <div className="flex items-center justify-center">
                    <div className="relative h-36 w-36">
                      <div
                        className="h-full w-full rounded-full"
                        style={{
                          background: `conic-gradient(#22c55e 0deg ${
                            completionRate * 3.6
                          }deg, #f97316 ${completionRate * 3.6}deg 360deg)`,
                        }}
                      />
                      <div className="absolute inset-4 rounded-full bg-white shadow-[inset_0_0_18px_rgba(15,23,42,0.08)]" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-900">
                          {completionRate}%
                        </span>
                        <span className="text-xs text-slate-500">
                          Completed
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <div>
                          <div className="text-xs font-semibold text-emerald-800">
                            Completed Training
                          </div>
                          <div className="text-sm font-semibold text-slate-900">
                            {stats.completedTraining} employees
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                        <div>
                          <div className="text-xs font-semibold text-orange-800">
                            Pending Assessments
                          </div>
                          <div className="text-sm font-semibold text-slate-900">
                            {stats.pendingAssessments} employees
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs text-slate-500">
                        Overall Progress
                      </div>
                      <div className="text-lg font-semibold text-slate-900">
                        {pendingRate}% remaining
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Assessment Breakdown
                  </h3>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Snapshot
                  </span>
                </div>
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Completed</span>
                      <span className="font-semibold text-slate-900">
                        {stats.completedTraining}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Pending</span>
                      <span className="font-semibold text-slate-900">
                        {stats.pendingAssessments}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-orange-500"
                        style={{ width: `${pendingRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-4">
                    <div className="text-xs text-slate-500">Average Score</div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="text-2xl font-bold text-slate-900">
                        {stats.averageScore}%
                      </div>
                      <div className="h-2 flex-1 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${stats.averageScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Top Performers
                </h3>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Highest scores
                </span>
              </div>
              <div className="mt-6 space-y-3">
                {topEmployees.length > 0 ? (
                  topEmployees.map((employee, index) => (
                    <div
                      key={employee.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {employee.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {employee.email || "No email on file"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-slate-500">
                          Exams:{" "}
                          <span className="font-semibold text-slate-900">
                            {employee.examsTaken}
                          </span>
                        </div>
                        <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                          {employee.averageScore}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No assessment results yet. Once employees complete exams,
                    top scores will appear here.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Quick Actions
                  </h3>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Manage
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    onClick={() => setActivePage("employees")}
                    className="group text-left rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 transition-all hover:border-blue-200 hover:bg-blue-100"
                  >
                    <div className="font-semibold text-blue-900">
                      Manage Employees
                    </div>
                    <div className="text-xs text-blue-700">
                      Add or edit employee accounts
                    </div>
                  </button>
                  <button
                    onClick={() => setActivePage("course-assignment")}
                    className="group text-left rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 transition-all hover:border-emerald-200 hover:bg-emerald-100"
                  >
                    <div className="font-semibold text-emerald-900">
                      Assign Courses
                    </div>
                    <div className="text-xs text-emerald-700">
                      Launch new training plans
                    </div>
                  </button>
                  <button
                    onClick={() => setActivePage("exam-assignment")}
                    className="group text-left rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 transition-all hover:border-amber-200 hover:bg-amber-100"
                  >
                    <div className="font-semibold text-amber-900">
                      Assign Exams
                    </div>
                    <div className="text-xs text-amber-700">
                      Schedule assessments
                    </div>
                  </button>
                  <button
                    onClick={() => setActivePage("analytics")}
                    className="group text-left rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 transition-all hover:border-indigo-200 hover:bg-indigo-100"
                  >
                    <div className="font-semibold text-indigo-900">
                      View Analytics
                    </div>
                    <div className="text-xs text-indigo-700">
                      Detailed performance reports
                    </div>
                  </button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-600 p-6 text-white shadow-lg">
                <div className="absolute -left-16 -top-20 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="relative space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Training Overview</h3>
                    <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      Live
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/80">Completion Rate</span>
                      <span className="text-2xl font-semibold">
                        {completionRate}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/20">
                      <div
                        className="h-2 rounded-full bg-white transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80">Completed</span>
                      <span className="text-lg font-semibold">
                        {stats.completedTraining}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80">Pending</span>
                      <span className="text-lg font-semibold">
                        {stats.pendingAssessments}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-sm text-white/80">
                        Average Score
                      </span>
                      <span className="text-xl font-semibold">
                        {stats.averageScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen />
      ) : company?.is_active ? (
        <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
          {renderContent()}
        </DashboardLayout>
      ) : (
        <InactivatedSubscription />
      )}
    </>
  );
};
