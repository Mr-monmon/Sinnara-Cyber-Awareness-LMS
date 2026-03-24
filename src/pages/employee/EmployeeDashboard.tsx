import { useState, useEffect } from "react";
import { BookOpen, ClipboardCheck, Award } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "../../components/layouts/DashboardLayout";
import { MyCoursesPage } from "./MyCoursesPage";
import { MyExamsPage } from "./MyExamsPage";
import { CertificatesPage } from "./CertificatesPage";
import { FraudAlertsPage } from "./FraudAlertsPage";
import { FraudAlertWidget } from "../../components/FraudAlertWidget";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Company } from "../../lib/types";
import {
  formatLocalizedNumber,
} from "../../i18n/utils";
import LoadingScreen from "../../components/LoadingScreen";
import InactivatedSubscription from "../../components/InactivatedSubscription";
import AccountSettings from "../company-admin/AccountSettings";

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("employee");
  const [activePage, setActivePage] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState({
    assignedCourses: 0,
    completedCourses: 0,
    pendingExams: 0,
    certificates: 0,
  });

  const [userRank, setUserRank] = useState(0);
  const currentLanguage = i18n.resolvedLanguage;
  const isRtl = i18n.dir() === "rtl";

  useEffect(() => {
    loadCompany();
    loadStats();
  }, [user]);

  const loadCompany = async () => {
    if (!user?.company_id) return;
    setIsLoading(true);
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

  const loadStats = async () => {
    if (!user?.id) return;

    try {
      const { data: courses } = await supabase
        .from("employee_courses")
        .select("*")
        .eq("employee_id", user.id);

      const assignedToEmployee = await supabase
        .from("assigned_exams")
        .select("id, exam_id")
        .eq("assigned_to_employee", user.id)
        .eq("status", "active");

      const assignedToDepartment = user.department_id
        ? await supabase
            .from("assigned_exams")
            .select("id, exam_id")
            .eq("assigned_to_department", user.department_id)
            .eq("status", "active")
        : { data: null };

      const allAssignedExams = [
        ...(assignedToEmployee.data || []),
        ...(assignedToDepartment.data || []),
      ];

      const assignedExamIds = [
        ...new Set(allAssignedExams.map((ae) => ae.exam_id)),
      ];

      let availableExamsQuery = supabase.from("exams").select("id");

      if (assignedExamIds.length > 0) {
        availableExamsQuery = availableExamsQuery.or(
          `exam_type.in.(PRE_ASSESSMENT,POST_ASSESSMENT),id.in.(${assignedExamIds.join(
            ","
          )})`
        );
      } else {
        availableExamsQuery = availableExamsQuery.in("exam_type", [
          "PRE_ASSESSMENT",
          "POST_ASSESSMENT",
        ]);
      }

      const { data: availableExams } = await availableExamsQuery;
      const allExamIds = availableExams?.map((e) => e.id) || [];

      const { data: examAttempts } = await supabase
        .from("exam_attempts")
        .select("exam_id, passed")
        .eq("employee_id", user.id);

      const completedExamIds = new Set(
        examAttempts?.filter((a) => a.passed).map((a) => a.exam_id) || []
      );

      const pendingExamsCount = allExamIds.filter(
        (id) => !completedExamIds.has(id)
      ).length;

      const { data: certificates } = await supabase
        .from("exam_attempts")
        .select("id")
        .eq("employee_id", user.id)
        .eq("passed", true);

      const { data: userRankData } = await supabase.functions.invoke(
        "get_user_rank",
        {
          method: "POST",
          body: { company_id: user.company_id, employee_id: user.id },
        }
      );

      setUserRank(userRankData?.index || 0);

      setStats({
        assignedCourses: courses?.length || 0,
        completedCourses:
          courses?.filter((c) => c.status === "COMPLETED").length || 0,
        pendingExams: pendingExamsCount,
        certificates: certificates?.length || 0,
      });
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading stats:", error);
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case "my-courses":
        return <MyCoursesPage navigateToCertificates={() => setActivePage("certificates")} />;
      case "my-exams":
        return <MyExamsPage />;
      case "fraud-alerts":
        return <FraudAlertsPage />;
      case "certificates":
        return <CertificatesPage />;
      case "account":
        return <AccountSettings />;
      default:
        return (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  {t("dashboard.title")}
                </h1>
                <p className="text-slate-600 mb-8">
                  {t("dashboard.subtitle")}
                </p>
              </div>

              <div className="group flex items-center gap-3 rounded-2xl border border-blue-100/70 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                  <span className="text-lg font-semibold">
                    {formatLocalizedNumber(userRank, currentLanguage)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t("dashboard.rankLabel")}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {t("dashboard.rankHint")}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">
                    {formatLocalizedNumber(stats.assignedCourses, currentLanguage)}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {t("dashboard.stats.assignedCourses")}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <ClipboardCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">
                    {formatLocalizedNumber(stats.completedCourses, currentLanguage)}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {t("dashboard.stats.completedCourses")}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <ClipboardCheck className="h-6 w-6 text-orange-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">
                    {formatLocalizedNumber(stats.pendingExams, currentLanguage)}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {t("dashboard.stats.pendingAssessments")}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <Award className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-bold text-slate-900">
                    {formatLocalizedNumber(stats.certificates, currentLanguage)}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {t("dashboard.stats.certificatesEarned")}
                </div>
              </div>
            </div>

            <FraudAlertWidget onNavigate={setActivePage} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  {t("dashboard.quickActions.title")}
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActivePage("my-courses")}
                    className={`w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors ${
                      isRtl ? "text-right" : "text-left"
                    }`}
                  >
                    <div className="font-medium text-blue-900">
                      {t("dashboard.quickActions.continueLearning.title")}
                    </div>
                    <div className="text-sm text-blue-700">
                      {t("dashboard.quickActions.continueLearning.subtitle")}
                    </div>
                  </button>
                  <button
                    onClick={() => setActivePage("my-exams")}
                    className={`w-full px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors ${
                      isRtl ? "text-right" : "text-left"
                    }`}
                  >
                    <div className="font-medium text-orange-900">
                      {t("dashboard.quickActions.takeAssessments.title")}
                    </div>
                    <div className="text-sm text-orange-700">
                      {t("dashboard.quickActions.takeAssessments.subtitle")}
                    </div>
                  </button>
                  <button
                    onClick={() => setActivePage("certificates")}
                    className={`w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors ${
                      isRtl ? "text-right" : "text-left"
                    }`}
                  >
                    <div className="font-medium text-purple-900">
                      {t("dashboard.quickActions.viewCertificates.title")}
                    </div>
                    <div className="text-sm text-purple-700">
                      {t("dashboard.quickActions.viewCertificates.subtitle")}
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">
                  {t("dashboard.progressCard.title")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>{t("dashboard.progressCard.courseCompletion")}</span>
                      <span>
                        {formatLocalizedNumber(
                          stats.assignedCourses > 0
                            ? Math.round(
                                (stats.completedCourses / stats.assignedCourses) *
                                  100
                              )
                            : 0,
                          currentLanguage
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="bg-white h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            stats.assignedCourses > 0
                              ? (stats.completedCourses /
                                  stats.assignedCourses) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/20 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm opacity-90">
                        {t("dashboard.progressCard.completedCourses")}
                      </span>
                      <span className="font-bold">
                        {formatLocalizedNumber(stats.completedCourses, currentLanguage)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm opacity-90">
                        {t("dashboard.progressCard.certificates")}
                      </span>
                      <span className="font-bold">
                        {formatLocalizedNumber(stats.certificates, currentLanguage)}
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
  
