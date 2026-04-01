import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Clock, TrendingUp, Lock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { formatLocalizedDate, formatLocalizedNumber } from '../../i18n/utils';
import { supabase } from '../../lib/supabase';
import { ExamViewerPage } from './ExamViewerPage';

interface ExamWithStatus {
  exam_id: string;
  assignment_id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  passing_score: number;
  exam_type: string;
  prerequisite_course_id: string | null;
  due_date: string | null;
  max_attempts: number;
  attempts_used: number;
  is_mandatory: boolean;
}

type Props = {
  onExamCompleted: () => void;
}


export const MyExamsPage: React.FC<Props> = ({ onExamCompleted }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['common', 'employee']);
  const [exams, setExams] = useState<ExamWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingExam, setViewingExam] = useState<ExamWithStatus | null>(null);
  const currentLanguage = i18n.resolvedLanguage;

  useEffect(() => {
    loadExams();
  }, [user]);

  const loadExams = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('employee_available_exams')
        .select('*')
        .eq('employee_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error loading exams:', error);
        return;
      }

      setExams(data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  if (viewingExam) {
    return (
      <ExamViewerPage
        examId={viewingExam.exam_id}
        examTitle={viewingExam.title}
        examType={viewingExam.exam_type}
        timeLimit={viewingExam.time_limit_minutes}
        passingScore={viewingExam.passing_score}
        onBack={() => {
          setViewingExam(null);
          loadExams();
          onExamCompleted();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalExams = exams.length;
  const examsWithAttempts = exams.filter(e => e.attempts_used > 0).length;
  const attemptsRemaining = exams.reduce((sum, e) => sum + (e.max_attempts - e.attempts_used), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {t('exams.title', { ns: 'employee' })}
        </h1>
        <p className="text-slate-600">{t('exams.subtitle', { ns: 'employee' })}</p>
        {exams.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-orange-600 mt-0.5" />
            <p className="text-sm font-medium text-orange-800">
              {t('exams.assignedBanner', { ns: 'employee' })}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <ClipboardCheck className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {formatLocalizedNumber(totalExams, currentLanguage)}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t('exams.summary.total', { ns: 'employee' })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {formatLocalizedNumber(examsWithAttempts, currentLanguage)}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t('exams.summary.inProgress', { ns: 'employee' })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {formatLocalizedNumber(attemptsRemaining, currentLanguage)}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t('exams.summary.attemptsRemaining', { ns: 'employee' })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exams.map((exam) => {
          const hasAttempted = exam.attempts_used > 0;
          const canTake = exam.attempts_used < exam.max_attempts;

          return (
            <div key={exam.exam_id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden hover:shadow-lg transition-all ${
              canTake ? 'border-blue-200' : 'border-slate-300'
            }`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${
                    canTake ? 'bg-blue-50' : 'bg-slate-100'
                  }`}>
                    {canTake ? (
                      <ClipboardCheck className="h-6 w-6 text-blue-600" />
                    ) : (
                      <Lock className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      exam.exam_type === 'PRE_ASSESSMENT'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {exam.exam_type === 'PRE_ASSESSMENT'
                        ? t('exams.types.pre', { ns: 'employee' })
                        : t('exams.types.post', { ns: 'employee' })}
                    </span>
                    {exam.is_mandatory && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        {t('labels.mandatory', { ns: 'common' })}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2">{exam.title}</h3>
                <p className="text-slate-600 text-sm mb-4">{exam.description}</p>

                <div className="flex items-center gap-4 mb-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatLocalizedNumber(exam.time_limit_minutes || 30, currentLanguage)}{' '}
                      {t('labels.minutes', { ns: 'common' })}
                    </span>
                  </div>
                  <div>
                    {t('labels.passing', { ns: 'common' })}: {formatLocalizedNumber(exam.passing_score, currentLanguage)}%
                  </div>
                </div>

                {hasAttempted && (
                  <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">
                      {t('exams.attempts.title', { ns: 'employee' })}
                    </h4>
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-slate-600">
                        {t('labels.used', { ns: 'common' })}:
                      </span>
                      <span className="text-slate-900">
                        {formatLocalizedNumber(exam.attempts_used, currentLanguage)} / {formatLocalizedNumber(exam.max_attempts, currentLanguage)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">
                        {t('labels.remaining', { ns: 'common' })}:
                      </span>
                      <span className="font-bold text-blue-600">
                        {formatLocalizedNumber(exam.max_attempts - exam.attempts_used, currentLanguage)}
                      </span>
                    </div>
                  </div>
                )}

                {exam.due_date && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <Clock className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-yellow-900">
                        {t('labels.dueDate', { ns: 'common' })}
                      </p>
                      <p className="text-xs text-yellow-800">
                        {formatLocalizedDate(exam.due_date, currentLanguage)}
                      </p>
                    </div>
                  </div>
                )}

                {!canTake && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-900">
                      {t('exams.attempts.exhaustedMessage', {
                        ns: 'employee',
                        value: formatLocalizedNumber(exam.max_attempts, currentLanguage),
                      })}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => canTake && setViewingExam(exam)}
                  disabled={!canTake}
                  className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                    canTake
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 cursor-pointer'
                      : 'bg-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {!canTake ? (
                    <>
                      <Lock className="h-4 w-4" />
                      {t('exams.attempts.noneLeft', { ns: 'employee' })}
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4" />
                      {hasAttempted
                        ? t('exams.attempts.retake', { ns: 'employee' })
                        : t('exams.attempts.start', { ns: 'employee' })}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {exams.length === 0 && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
          <ClipboardCheck className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-medium">
            {t('exams.empty.title', { ns: 'employee' })}
          </p>
          <p className="text-sm">{t('exams.empty.description', { ns: 'employee' })}</p>
        </div>
      )}
    </div>
  );
};
