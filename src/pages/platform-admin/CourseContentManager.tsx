import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Video, FileText, ClipboardCheck, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Course } from '../../types';

interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  section_type: 'VIDEO' | 'ARTICLE' | 'QUIZ';
  content: string;
  content_data: any;
  duration_minutes: number;
  order_index: number;
  created_at: string;
}

interface CourseContentManagerProps {
  course: Course;
  onBack: () => void;
}

export const CourseContentManager: React.FC<CourseContentManagerProps> = ({ course, onBack }) => {
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    section_type: 'VIDEO' as 'VIDEO' | 'ARTICLE' | 'QUIZ',
    content: '',
    duration_minutes: 10
  });

  const [quizQuestions, setQuizQuestions] = useState<Array<{
    question: string;
    options: string[];
    correct_answer: string;
  }>>([]);

  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: ''
  });

  useEffect(() => {
    loadSections();
  }, [course.id]);

  const loadSections = async () => {
    const { data } = await supabase
      .from('course_sections')
      .select('*')
      .eq('course_id', course.id)
      .order('order_index');

    if (data) setSections(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let contentData = {};

      if (formData.section_type === 'QUIZ') {
        if (quizQuestions.length === 0) {
          alert('يجب إضافة سؤال واحد على الأقل للاختبار');
          return;
        }
        contentData = { questions: quizQuestions };
      }

      const sectionData = {
        ...formData,
        course_id: course.id,
        content_data: contentData,
        order_index: editingSection ? editingSection.order_index : sections.length
      };

      if (editingSection) {
        const { error } = await supabase
          .from('course_sections')
          .update(sectionData)
          .eq('id', editingSection.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('course_sections')
          .insert([sectionData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingSection(null);
      setFormData({ title: '', section_type: 'VIDEO', content: '', duration_minutes: 10 });
      setQuizQuestions([]);
      setCurrentQuestion({ question: '', option1: '', option2: '', option3: '', option4: '', correct_answer: '' });
      await loadSections();
    } catch (error) {
      console.error('Error saving section:', error);
      alert('فشل حفظ القسم');
    }
  };

  const handleEdit = (section: CourseSection) => {
    setEditingSection(section);
    setFormData({
      title: section.title,
      section_type: section.section_type,
      content: section.content || '',
      duration_minutes: section.duration_minutes
    });

    if (section.section_type === 'QUIZ' && section.content_data?.questions) {
      setQuizQuestions(section.content_data.questions);
    }

    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;

    try {
      const { error } = await supabase.from('course_sections').delete().eq('id', id);
      if (error) throw error;
      await loadSections();
    } catch (error) {
      console.error('Error deleting section:', error);
      alert('فشل حذف القسم');
    }
  };

  const handleAddQuestion = () => {
    const options = [
      currentQuestion.option1,
      currentQuestion.option2,
      currentQuestion.option3,
      currentQuestion.option4
    ].filter(o => o.trim());

    if (options.length < 2) {
      alert('يجب إضافة خيارين على الأقل');
      return;
    }

    if (!currentQuestion.question.trim()) {
      alert('يجب كتابة السؤال');
      return;
    }

    if (!options.includes(currentQuestion.correct_answer)) {
      alert('الإجابة الصحيحة يجب أن تكون من ضمن الخيارات');
      return;
    }

    setQuizQuestions([...quizQuestions, {
      question: currentQuestion.question,
      options: options,
      correct_answer: currentQuestion.correct_answer
    }]);

    setCurrentQuestion({ question: '', option1: '', option2: '', option3: '', option4: '', correct_answer: '' });
  };

  const handleRemoveQuestion = (index: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'VIDEO': return Video;
      case 'ARTICLE': return FileText;
      case 'QUIZ': return ClipboardCheck;
      default: return FileText;
    }
  };

  const getSectionTypeLabel = (type: string) => {
    switch (type) {
      case 'VIDEO': return 'فيديو';
      case 'ARTICLE': return 'مقال';
      case 'QUIZ': return 'اختبار';
      default: return type;
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        العودة للدورات
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">إدارة محتوى الدورة</h1>
          <p className="text-slate-600">{course.title}</p>
        </div>
        <button
          onClick={() => {
            setEditingSection(null);
            setFormData({ title: '', section_type: 'VIDEO', content: '', duration_minutes: 10 });
            setQuizQuestions([]);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          إضافة قسم
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => {
          const Icon = getSectionIcon(section.section_type);
          return (
            <div key={section.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="h-5 w-5 text-slate-400 cursor-move" />
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-slate-900">
                        {index + 1}. {section.title}
                      </span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                        {getSectionTypeLabel(section.section_type)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {section.duration_minutes} دقيقة
                      {section.section_type === 'QUIZ' && section.content_data?.questions && (
                        <span className="mr-3">• {section.content_data.questions.length} سؤال</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(section)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(section.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {section.section_type === 'VIDEO' && section.content && (
                <div className="mt-4 text-sm text-slate-600">
                  <span className="font-medium">رابط الفيديو:</span> {section.content}
                </div>
              )}

              {section.section_type === 'ARTICLE' && section.content && (
                <div className="mt-4 text-sm text-slate-600 line-clamp-2">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
            No sections yet. Click "Add Section" to create content.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingSection ? 'تعديل القسم' : 'إضافة قسم جديد'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  عنوان القسم *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="مثال: مقدمة في الأمن السيبراني"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  نوع القسم *
                </label>
                <select
                  value={formData.section_type}
                  onChange={(e) => {
                    setFormData({ ...formData, section_type: e.target.value as any });
                    setQuizQuestions([]);
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="VIDEO">فيديو</option>
                  <option value="ARTICLE">مقال</option>
                  <option value="QUIZ">اختبار</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  المدة (دقائق) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {formData.section_type === 'VIDEO' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رابط الفيديو (YouTube, Vimeo, etc.) *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
              )}

              {formData.section_type === 'ARTICLE' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    محتوى المقال *
                  </label>
                  <textarea
                    required
                    rows={10}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="اكتب محتوى المقال هنا..."
                  />
                </div>
              )}

              {formData.section_type === 'QUIZ' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">إضافة سؤال</h3>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        السؤال *
                      </label>
                      <textarea
                        rows={2}
                        value={currentQuestion.question}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          الخيار 1 *
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.option1}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, option1: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          الخيار 2 *
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.option2}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, option2: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          الخيار 3
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.option3}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, option3: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          الخيار 4
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.option4}
                          onChange={(e) => setCurrentQuestion({ ...currentQuestion, option4: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        الإجابة الصحيحة *
                      </label>
                      <input
                        type="text"
                        value={currentQuestion.correct_answer}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, correct_answer: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="يجب أن تطابق أحد الخيارات"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      إضافة السؤال للقائمة
                    </button>
                  </div>

                  {quizQuestions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-3">
                        الأسئلة المضافة ({quizQuestions.length})
                      </h3>
                      <div className="space-y-3">
                        {quizQuestions.map((q, index) => (
                          <div key={index} className="bg-slate-50 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <span className="font-semibold text-slate-900 text-sm">
                                {index + 1}. {q.question}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(index)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="space-y-1 text-xs">
                              {q.options.map((opt, i) => (
                                <div
                                  key={i}
                                  className={`px-2 py-1 rounded ${
                                    opt === q.correct_answer
                                      ? 'bg-green-100 text-green-800 font-medium'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  • {opt} {opt === q.correct_answer && '✓'}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingSection(null);
                    setQuizQuestions([]);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingSection ? 'تحديث القسم' : 'حفظ القسم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
