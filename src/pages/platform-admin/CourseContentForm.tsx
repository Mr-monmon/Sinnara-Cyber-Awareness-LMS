import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Course } from '../../lib/types';

export interface CourseSection {
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

interface CourseContentFormProps {
  course: Course;
  sectionsCount: number;
  editingSection: CourseSection | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const defaultFormData = {
  title: '',
  section_type: 'VIDEO' as 'VIDEO' | 'ARTICLE' | 'QUIZ',
  content: '',
  duration_minutes: 10
};

const defaultQuestion = {
  question: '',
  option1: '',
  option2: '',
  option3: '',
  option4: '',
  correct_answer: ''
};

export const CourseContentForm: React.FC<CourseContentFormProps> = ({
  course,
  sectionsCount,
  editingSection,
  open,
  onClose,
  onSaved
}) => {
  const [formData, setFormData] = useState(defaultFormData);
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    question: string;
    options: string[];
    correct_answer: string;
  }>>([]);
  const [currentQuestion, setCurrentQuestion] = useState(defaultQuestion);

  useEffect(() => {
    if (!open) return;

    if (editingSection) {
      setFormData({
        title: editingSection.title,
        section_type: editingSection.section_type,
        content: editingSection.content || '',
        duration_minutes: editingSection.duration_minutes
      });
      if (editingSection.section_type === 'QUIZ' && editingSection.content_data?.questions) {
        setQuizQuestions(editingSection.content_data.questions);
      } else {
        setQuizQuestions([]);
      }
    } else {
      setFormData(defaultFormData);
      setQuizQuestions([]);
    }

    setCurrentQuestion(defaultQuestion);
  }, [editingSection, open]);

  if (!open) return null;

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
        order_index: editingSection ? editingSection.order_index : sectionsCount
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

      onClose();
      onSaved();
    } catch (error) {
      console.error('Error saving section:', error);
      alert('فشل حفظ القسم');
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

    setCurrentQuestion(defaultQuestion);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
  };

  return (
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
                setFormData({ ...formData, section_type: e.target.value as 'VIDEO' | 'ARTICLE' | 'QUIZ' });
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
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value, 10) })}
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
              onClick={onClose}
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
  );
};
