import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Circle, PlayCircle, FileText, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  section_type: 'VIDEO' | 'ARTICLE' | 'QUIZ';
  content: string;
  content_data: any;
  duration_minutes: number;
  order_index: number;
}

interface SectionProgress {
  id: string;
  section_id: string;
  completed: boolean;
  completed_at: string | null;
}

interface CourseViewerProps {
  courseId: string;
  courseTitle: string;
  onBack: () => void;
}

export const CourseViewerPage: React.FC<CourseViewerProps> = ({ courseId, courseTitle, onBack }) => {
  const { user } = useAuth();
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [progress, setProgress] = useState<Record<string, SectionProgress>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    loadCourseData();
  }, [courseId, user?.id]);

  const loadCourseData = async () => {
    if (!user) return;

    const [sectionsRes, progressRes, newProgressRes] = await Promise.all([
      supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index'),
      supabase
        .from('employee_section_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId),
      supabase
        .from('course_section_progress')
        .select('*')
        .eq('employee_id', user.id)
        .eq('course_id', courseId)
    ]);

    if (sectionsRes.data) setSections(sectionsRes.data);

    const progressMap: Record<string, SectionProgress> = {};

    if (progressRes.data) {
      progressRes.data.forEach((p: any) => {
        progressMap[p.section_id] = {
          id: p.id,
          section_id: p.section_id,
          completed: p.completed,
          completed_at: p.completed_at
        };
      });
    }

    if (newProgressRes.data) {
      newProgressRes.data.forEach((p: any) => {
        progressMap[p.section_id] = {
          id: p.id,
          section_id: p.section_id,
          completed: p.completed,
          completed_at: p.completed_at
        };
      });
    }

    setProgress(progressMap);
  };

  const currentSection = sections[currentSectionIndex];
  const totalSections = sections.length;
  const completedSections = Object.values(progress).filter(p => p.completed).length;
  const progressPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  const markSectionComplete = async (sectionId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('course_section_progress')
      .upsert({
        employee_id: user.id,
        course_id: courseId,
        section_id: sectionId,
        completed: true,
        completed_at: new Date().toISOString()
      }, {
        onConflict: 'employee_id,section_id'
      });

    if (error) {
      console.error('Error marking section complete:', error);
      alert('Failed to mark section as complete');
      return;
    }

    await supabase
      .from('employee_section_progress')
      .upsert({
        user_id: user.id,
        course_id: courseId,
        section_id: sectionId,
        completed: true,
        completed_at: new Date().toISOString()
      });

    await loadCourseData();
    await updateCourseProgress();

    if (sections[currentSectionIndex + 1]?.section_type === 'QUIZ') {
      setQuizSubmitted(false);
      setQuizAnswers({});
    }
  };

  const updateCourseProgress = async () => {
    if (!user) return;

    const completedCount = Object.values(progress).filter(p => p.completed).length + 1;
    const progressPercent = Math.round((completedCount / totalSections) * 100);

    await Promise.all([
      supabase
        .from('employee_courses')
        .update({ progress: progressPercent })
        .eq('user_id', user.id)
        .eq('course_id', courseId),

      supabase
        .from('employee_courses')
        .update({
          progress_percentage: progressPercent,
          completed_at: progressPercent === 100 ? new Date().toISOString() : null,
          last_accessed_at: new Date().toISOString()
        })
        .eq('employee_id', user.id)
        .eq('course_id', courseId)
    ]);
  };

  const handleNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setQuizSubmitted(false);
      setQuizAnswers({});
      setQuizScore(0);
    } else {
      updateCourseCompletion();
    }
  };

  const updateCourseCompletion = async () => {
    if (!user) return;

    const allCompleted = sections.every(section => progress[section.id]?.completed);

    if (!allCompleted) {
      alert('Please complete all sections before finishing the course');
      return;
    }

    const completedDate = new Date().toISOString();

    const { data: existing, error: checkError } = await supabase
      .from('employee_courses')
      .select('id, status')
      .eq('employee_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking course enrollment:', checkError);
      alert('Error: ' + checkError.message);
      return;
    }

    if (existing?.status === 'COMPLETED') {
      alert('You have already completed this course!');
      onBack();
      return;
    }

    const { error: updateError } = await supabase
      .from('employee_courses')
      .update({
        status: 'COMPLETED',
        progress_percentage: 100,
        completed_at: completedDate,
        last_accessed_at: completedDate,
        completed_sections: sections.length,
        total_sections: sections.length
      })
      .eq('employee_id', user.id)
      .eq('course_id', courseId);

    if (updateError) {
      console.error('Error completing course:', updateError);
      alert('Failed to mark course as complete: ' + updateError.message);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: certificate } = await supabase
      .from('issued_certificates')
      .select('*')
      .eq('employee_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    if (certificate) {
      alert('🎉 Congratulations! Course completed successfully. Your certificate is ready!');
    } else {
      const { data: employeeData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const { data: courseData } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .maybeSingle();

      const certNumber = `CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`;

      await supabase
        .from('issued_certificates')
        .insert({
          certificate_number: certNumber,
          employee_id: user.id,
          course_id: courseId,
          employee_name: employeeData?.full_name || user.full_name,
          course_name: courseData?.title || 'Course',
          completion_date: new Date().toISOString().split('T')[0],
          issued_at: new Date().toISOString(),
          issued_by: user.id
        });

      alert('🎉 Congratulations! You have successfully completed the course! Your certificate has been generated.');
    }

    onBack();
  };

  const handleSubmitQuiz = () => {
    if (!currentSection || currentSection.section_type !== 'QUIZ') return;

    const questions = currentSection.content_data?.questions || [];
    let correct = 0;

    questions.forEach((q: any, index: number) => {
      if (quizAnswers[index] === q.correct_answer) {
        correct++;
      }
    });

    const score = Math.round((correct / questions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);

    if (score >= 60) {
      markSectionComplete(currentSection.id);
    }
  };

  const isSectionCompleted = (sectionId: string) => {
    return progress[sectionId]?.completed || false;
  };

  const canAccessSection = (index: number) => {
    if (index === 0) return true;
    return isSectionCompleted(sections[index - 1]?.id);
  };

  const convertYouTubeUrl = (url: string) => {
    if (!url) return url;

    // Handle youtube.com/watch?v=VIDEO_ID
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('watch?v=')[1].split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    // Handle youtu.be/VIDEO_ID
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }

    // Already in embed format
    if (url.includes('youtube.com/embed/')) {
      return url;
    }

    return url;
  };

  if (!currentSection) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-slate-600">جاري تحميل الدورة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              العودة للدورات
            </button>
            <div className="text-sm text-slate-600">
              التقدم: {progressPercentage}%
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">{courseTitle}</h1>

          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <h2 className="font-semibold text-slate-900 mb-3">محتويات الدورة</h2>
            {sections.map((section, index) => {
              const Icon = section.section_type === 'VIDEO' ? PlayCircle : section.section_type === 'ARTICLE' ? FileText : ClipboardCheck;
              const completed = isSectionCompleted(section.id);
              const accessible = canAccessSection(index);
              const isCurrent = index === currentSectionIndex;

              return (
                <button
                  key={section.id}
                  onClick={() => accessible && setCurrentSectionIndex(index)}
                  disabled={!accessible}
                  className={`w-full text-right p-3 rounded-lg transition-all ${
                    isCurrent
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : completed
                      ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                      : accessible
                      ? 'bg-white border border-slate-200 hover:bg-slate-50'
                      : 'bg-slate-100 border border-slate-200 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${
                      completed ? 'bg-green-100' : 'bg-slate-100'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        completed ? 'text-green-600' : 'text-slate-600'
                      }`} />
                    </div>
                    <div className="flex-1 text-sm">
                      <div className="font-medium text-slate-900">{section.title}</div>
                      <div className="text-xs text-slate-600">{section.duration_minutes} دقيقة</div>
                    </div>
                    {completed ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                {currentSection.section_type === 'VIDEO' && <PlayCircle className="h-6 w-6 text-blue-600" />}
                {currentSection.section_type === 'ARTICLE' && <FileText className="h-6 w-6 text-blue-600" />}
                {currentSection.section_type === 'QUIZ' && <ClipboardCheck className="h-6 w-6 text-blue-600" />}
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{currentSection.title}</h2>
                  <p className="text-sm text-slate-600">
                    القسم {currentSectionIndex + 1} من {totalSections}
                  </p>
                </div>
              </div>

              {currentSection.section_type === 'VIDEO' && (
                <div>
                  <div className="aspect-video bg-slate-900 rounded-lg mb-6 overflow-hidden">
                    {currentSection.content.includes('youtube.com') || currentSection.content.includes('youtu.be') ? (
                      <iframe
                        src={convertYouTubeUrl(currentSection.content)}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white">
                        <div className="text-center">
                          <PlayCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                          <p>رابط الفيديو:</p>
                          <a href={currentSection.content} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            {currentSection.content}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isSectionCompleted(currentSection.id) && (
                    <button
                      onClick={() => markSectionComplete(currentSection.id)}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                    >
                      Mark as Complete
                    </button>
                  )}
                </div>
              )}

              {currentSection.section_type === 'ARTICLE' && (
                <div>
                  <div className="prose max-w-none mb-6">
                    <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {currentSection.content}
                    </div>
                  </div>

                  {!isSectionCompleted(currentSection.id) && (
                    <button
                      onClick={() => markSectionComplete(currentSection.id)}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                    >
                      Mark as Complete
                    </button>
                  )}
                </div>
              )}

              {currentSection.section_type === 'QUIZ' && (
                <div>
                  {!quizSubmitted ? (
                    <div className="space-y-6">
                      {currentSection.content_data?.questions?.map((q: any, qIndex: number) => (
                        <div key={qIndex} className="bg-slate-50 rounded-lg p-6">
                          <p className="font-semibold text-slate-900 mb-4">
                            {qIndex + 1}. {q.question}
                          </p>
                          <div className="space-y-2">
                            {q.options.map((option: string, oIndex: number) => (
                              <label
                                key={oIndex}
                                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                              >
                                <input
                                  type="radio"
                                  name={`question-${qIndex}`}
                                  value={option}
                                  checked={quizAnswers[qIndex] === option}
                                  onChange={(e) => setQuizAnswers({ ...quizAnswers, [qIndex]: e.target.value })}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-slate-900">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={handleSubmitQuiz}
                        disabled={Object.keys(quizAnswers).length !== currentSection.content_data?.questions?.length}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                      >
                        إرسال الإجابات
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                        quizScore >= 60 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <span className={`text-3xl font-bold ${
                          quizScore >= 60 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {quizScore}%
                        </span>
                      </div>
                      <h3 className={`text-2xl font-bold mb-2 ${
                        quizScore >= 60 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {quizScore >= 60 ? 'ممتاز! نجحت في الاختبار' : 'للأسف، لم تنجح'}
                      </h3>
                      <p className="text-slate-600 mb-6">
                        {quizScore >= 60
                          ? 'يمكنك المتابعة للقسم التالي'
                          : 'يجب الحصول على 60% على الأقل للمتابعة'
                        }
                      </p>
                      {quizScore < 60 && (
                        <button
                          onClick={() => {
                            setQuizSubmitted(false);
                            setQuizAnswers({});
                          }}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          إعادة المحاولة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isSectionCompleted(currentSection.id) && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  {currentSectionIndex < sections.length - 1 ? (
                    <button
                      onClick={handleNextSection}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      الانتقال للقسم التالي
                    </button>
                  ) : (
                    <button
                      onClick={updateCourseCompletion}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                    >
                      إنهاء الدورة 🎉
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
