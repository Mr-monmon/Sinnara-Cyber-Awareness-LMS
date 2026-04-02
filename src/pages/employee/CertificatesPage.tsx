import React, { useState, useEffect } from 'react';
import { Award, Download, Calendar, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { formatLocalizedDate, formatLocalizedNumber } from '../../i18n/utils';
import { supabase } from '../../lib/supabase';

interface Certificate {
  id: string;
  certificate_number: string;
  course_id: string;
  employee_id: string;
  issued_at: string;
  completion_date: string;
  score: number | null;
  employee_name: string;
  course_name: string;
  courses: {
    title: string;
    description: string;
  };
}

export const CertificatesPage: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['common', 'employee']);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const currentLanguage = i18n.resolvedLanguage;

  useEffect(() => {
    loadCertificates();
  }, [user]);

  const loadCertificates = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('issued_certificates')
        .select(`
          *,
          courses(title, description)
        `)
        .eq('employee_id', user.id)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setCertificates(data as any);
      }
    } catch (error) {
      console.error('Error loading certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (cert: Certificate) => {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const certificateText = `
${divider}
          ${t('certificates.downloadTemplate.title', { ns: 'employee' })}
${divider}

${t('certificates.downloadTemplate.certifies', { ns: 'employee' })}

${user?.full_name || t('certificates.downloadTemplate.employeeFallback', { ns: 'employee' })}

${t('certificates.downloadTemplate.completedCourse', { ns: 'employee' })}

"${cert.courses.title}"

${t('certificates.downloadTemplate.certificateNumber', {
      ns: 'employee',
      value: cert.certificate_number,
    })}
${t('certificates.downloadTemplate.issueDate', {
      ns: 'employee',
      value: formatLocalizedDate(cert.issued_at, currentLanguage),
    })}
${t('certificates.downloadTemplate.completionDate', {
      ns: 'employee',
      value: formatLocalizedDate(cert.completion_date, currentLanguage),
    })}
${cert.score !== null
      ? t('certificates.downloadTemplate.score', {
          ns: 'employee',
          value: cert.score.toFixed(1),
        })
      : ''}

${divider}

${t('certificates.downloadTemplate.summaryLine1', { ns: 'employee' })}
${t('certificates.downloadTemplate.summaryLine2', { ns: 'employee' })}
${t('certificates.downloadTemplate.summaryLine3', { ns: 'employee' })}

${divider}
    `;

    const blob = new Blob([certificateText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Certificate_${cert.certificate_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
      <div>
        <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {t('certificates.title', { ns: 'employee' })}
        </h1>
        <p className="text-slate-600">{t('certificates.subtitle', { ns: 'employee' })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Award className="h-6 w-6 text-amber-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {formatLocalizedNumber(certificates.length, currentLanguage)}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t('certificates.summary.total', { ns: 'employee' })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {formatLocalizedNumber(certificates.length, currentLanguage)}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t('certificates.summary.active', { ns: 'employee' })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">
              {certificates.length > 0
                ? formatLocalizedNumber(new Date(certificates[0].issued_at).getFullYear(), currentLanguage)
                : '-'}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {t('labels.latestYear', { ns: 'common' })}
          </div>
        </div>
      </div>

      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => {
            return (
              <div key={cert.id} className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 rounded-xl shadow-md border-2 p-6 hover:shadow-xl transition-all">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-4 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500">
                    <Award className="h-10 w-10 text-white" />
                  </div>
                </div>

                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {cert.courses.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {cert.courses.description}
                  </p>
                </div>

                <div className="bg-white/80 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {t('labels.certificateNumber', { ns: 'common' })}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 text-xs">
                      {cert.certificate_number}
                    </span>
                  </div>
                  {cert.score !== null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {t('labels.score', { ns: 'common' })}:
                      </span>
                      <span className="font-bold text-green-600">
                        {formatLocalizedNumber(Number(cert.score.toFixed(1)), currentLanguage)}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {t('labels.issued', { ns: 'common' })}:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatLocalizedDate(cert.issued_at, currentLanguage)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {t('labels.completed', { ns: 'common' })}:
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatLocalizedDate(cert.completion_date, currentLanguage)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(cert)}
                  className="w-full py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-sm hover:shadow-md"
                >
                  <Download className="h-4 w-4" />
                  {t('certificates.download', { ns: 'employee' })}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 rounded-full mb-4">
            <Award className="h-10 w-10 text-amber-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            {t('certificates.empty.title', { ns: 'employee' })}
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {t('certificates.empty.description', { ns: 'employee' })}
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>{t('certificates.empty.completeCourse', { ns: 'employee' })}</span>
            </div>
            <div className="text-slate-300">→</div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              <span>{t('certificates.empty.earnCertificate', { ns: 'employee' })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
