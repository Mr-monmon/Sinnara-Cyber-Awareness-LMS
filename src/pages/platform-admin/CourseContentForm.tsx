import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Quill from 'quill';
import { supabase } from '../../lib/supabase';
import { Course } from '../../lib/types';

type SectionType = 'VIDEO' | 'ARTICLE' | 'QUIZ';

type QuizQuestion = {
  question: string;
  options: string[];
  correct_answer: string;
};

type CourseSectionContentData = {
  questions?: QuizQuestion[];
  [key: string]: unknown;
};

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  section_type: SectionType;
  content: string;
  content_data: CourseSectionContentData;
  content_data_ar: CourseSectionContentData | null;
  title_ar: string | null;
  content_ar: string | null;
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
  title_ar: '',
  section_type: 'VIDEO' as SectionType,
  content: '',
  content_ar: '',
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
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [arabicQuizQuestions, setArabicQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(defaultQuestion);
  const [currentArabicQuestion, setCurrentArabicQuestion] = useState(defaultQuestion);
  const [articlePlainText, setArticlePlainText] = useState('');
  const [arabicArticlePlainText, setArabicArticlePlainText] = useState('');
  const quillContainerRef = useRef<HTMLDivElement | null>(null);
  const quillInstanceRef = useRef<Quill | null>(null);
  const arabicQuillContainerRef = useRef<HTMLDivElement | null>(null);
  const arabicQuillInstanceRef = useRef<Quill | null>(null);

  useEffect(() => {
    if (!open) return;

    if (editingSection) {
      setFormData({
        title: editingSection.title,
        title_ar: editingSection.title_ar || '',
        section_type: editingSection.section_type,
        content: editingSection.content || '',
        content_ar: editingSection.content_ar || '',
        duration_minutes: editingSection.duration_minutes
      });
      if (editingSection.section_type === 'QUIZ' && editingSection.content_data?.questions) {
        setQuizQuestions(editingSection.content_data.questions);
      } else {
        setQuizQuestions([]);
      }
      if (editingSection.section_type === 'QUIZ' && editingSection.content_data_ar?.questions) {
        setArabicQuizQuestions(editingSection.content_data_ar.questions);
      } else {
        setArabicQuizQuestions([]);
      }
    } else {
      setFormData(defaultFormData);
      setQuizQuestions([]);
      setArabicQuizQuestions([]);
    }

    setCurrentQuestion(defaultQuestion);
    setCurrentArabicQuestion(defaultQuestion);
  }, [editingSection, open]);

  useEffect(() => {
    if (open && formData.section_type === 'ARTICLE') return;

    quillInstanceRef.current = null;
    arabicQuillInstanceRef.current = null;
    setArticlePlainText('');
    setArabicArticlePlainText('');
  }, [formData.section_type, open]);

  useEffect(() => {
    if (!open || formData.section_type !== 'ARTICLE') return;
    if (!quillContainerRef.current) return;

    if (!quillInstanceRef.current) {
      quillInstanceRef.current = new Quill(quillContainerRef.current, {
        theme: 'snow',
        placeholder: 'Write article content here...',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'blockquote', 'code-block'],
            ['clean']
          ]
        }
      });

      quillInstanceRef.current.on('text-change', () => {
        const quill = quillInstanceRef.current;
        if (!quill) return;
        const html = quill.root.innerHTML;
        const plainText = quill.getText().trim();
        setFormData((prev) => (prev.content === html ? prev : { ...prev, content: html }));
        setArticlePlainText(plainText);
      });
    }

    const quill = quillInstanceRef.current;
    if (!quill) return;

    const incomingHtml = formData.content || '';
    const currentHtml = quill.root.innerHTML;

    if (incomingHtml && incomingHtml !== currentHtml) {
      quill.clipboard.dangerouslyPasteHTML(incomingHtml);
      setArticlePlainText(quill.getText().trim());
      return;
    }

    if (!incomingHtml && currentHtml !== '<p><br></p>') {
      quill.setText('');
      setArticlePlainText('');
    }
  }, [formData.content, formData.section_type, open]);

  useEffect(() => {
    if (!open || formData.section_type !== 'ARTICLE') return;
    if (!arabicQuillContainerRef.current) return;

    if (!arabicQuillInstanceRef.current) {
      arabicQuillInstanceRef.current = new Quill(arabicQuillContainerRef.current, {
        theme: 'snow',
        placeholder: 'Write Arabic article content here...',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'blockquote', 'code-block'],
            ['clean']
          ]
        }
      });
      arabicQuillInstanceRef.current.root.setAttribute('dir', 'rtl');
      arabicQuillInstanceRef.current.root.style.textAlign = 'right';

      arabicQuillInstanceRef.current.on('text-change', () => {
        const quill = arabicQuillInstanceRef.current;
        if (!quill) return;
        const html = quill.root.innerHTML;
        const plainText = quill.getText().trim();
        setFormData((prev) => (prev.content_ar === html ? prev : { ...prev, content_ar: html }));
        setArabicArticlePlainText(plainText);
      });
    }

    const quill = arabicQuillInstanceRef.current;
    if (!quill) return;

    const incomingHtml = formData.content_ar || '';
    const currentHtml = quill.root.innerHTML;

    if (incomingHtml && incomingHtml !== currentHtml) {
      quill.clipboard.dangerouslyPasteHTML(incomingHtml);
      setArabicArticlePlainText(quill.getText().trim());
      return;
    }

    if (!incomingHtml && currentHtml !== '<p><br></p>') {
      quill.setText('');
      setArabicArticlePlainText('');
    }
  }, [formData.content_ar, formData.section_type, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let contentData: CourseSectionContentData = {};

      if (formData.section_type === 'ARTICLE' && articlePlainText.trim().length === 0) {
        alert('Article content is required');
        return;
      }

      if (formData.section_type === 'QUIZ') {
        if (quizQuestions.length === 0) {
          alert('At least one question is required for the quiz');
          return;
        }
        contentData = { questions: quizQuestions };
      }

      const contentDataAr = formData.section_type === 'QUIZ' && arabicQuizQuestions.length > 0
        ? { questions: arabicQuizQuestions }
        : contentData;
      const contentAr = formData.section_type === 'ARTICLE'
        ? (arabicArticlePlainText.trim().length > 0 ? formData.content_ar : formData.content)
        : (formData.content_ar.trim() || formData.content);

      const sectionData = {
        ...formData,
        title_ar: formData.title_ar.trim() || formData.title.trim(),
        content_ar: contentAr,
        course_id: course.id,
        content_data: contentData,
        content_data_ar: contentDataAr,
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
      alert('Failed to save section');
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
      alert('At least two options are required');
      return;
    }

    if (!currentQuestion.question.trim()) {
      alert('Question is required');
      return;
    }

    if (!options.includes(currentQuestion.correct_answer)) {
      alert('The correct answer must be one of the options');
      return;
    }

    setQuizQuestions([...quizQuestions, {
      question: currentQuestion.question,
      options: options,
      correct_answer: currentQuestion.correct_answer
    }]);

    setCurrentQuestion(defaultQuestion);
  };

  const handleAddArabicQuestion = () => {
    const options = [
      currentArabicQuestion.option1,
      currentArabicQuestion.option2,
      currentArabicQuestion.option3,
      currentArabicQuestion.option4
    ].filter(o => o.trim());

    if (options.length < 2) {
      alert('At least two Arabic options are required');
      return;
    }

    if (!currentArabicQuestion.question.trim()) {
      alert('Arabic question is required');
      return;
    }

    if (!options.includes(currentArabicQuestion.correct_answer)) {
      alert('The Arabic correct answer must be one of the Arabic options');
      return;
    }

    setArabicQuizQuestions([...arabicQuizQuestions, {
      question: currentArabicQuestion.question,
      options: options,
      correct_answer: currentArabicQuestion.correct_answer
    }]);

    setCurrentArabicQuestion(defaultQuestion);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
  };

  const handleRemoveArabicQuestion = (index: number) => {
    setArabicQuizQuestions(arabicQuizQuestions.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {editingSection ? 'Edit Section' : 'Add New Section'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Section Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Example: Introduction to Cybersecurity"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Arabic Section Title
            </label>
            <input
              type="text"
              dir="rtl"
              value={formData.title_ar}
              onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Uses Section Title when left blank"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Section Type *
            </label>
            <select
              value={formData.section_type}
              onChange={(e) => {
                setFormData({ ...formData, section_type: e.target.value as SectionType });
                setQuizQuestions([]);
                setArabicQuizQuestions([]);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="VIDEO">Video</option>
              <option value="ARTICLE">Article</option>
              <option value="QUIZ">Quiz</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Duration (minutes) *
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
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Video Link (YouTube, Vimeo, etc.) *
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arabic Video Link
                </label>
                <input
                  type="url"
                  value={formData.content_ar}
                  onChange={(e) => setFormData({ ...formData, content_ar: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Uses Video Link when left blank"
                />
              </div>
            </div>
          )}

          {formData.section_type === 'ARTICLE' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Article Content *
                </label>
                <div className="w-full border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                  <div ref={quillContainerRef} className="min-h-[240px] [&_.ql-editor]:min-h-[200px]" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arabic Article Content
                </label>
                <div className="w-full border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                  <div
                    ref={arabicQuillContainerRef}
                    dir="rtl"
                    className="min-h-[240px] [&_.ql-editor]:min-h-[200px] [&_.ql-editor]:text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {formData.section_type === 'QUIZ' && (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Question</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Question *
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
                      Option 1 *
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
                      Option 2 *
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
                      Option 3
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
                      Option 4
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
                    Correct Answer *
                  </label>
                  <input
                    type="text"
                    value={currentQuestion.correct_answer}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, correct_answer: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="The correct answer must match one of the options"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Add Question to List
                </button>
              </div>

              {quizQuestions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">
                    Added Questions ({quizQuestions.length})
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

              <div className="border-t border-slate-200 pt-6 space-y-6">
                <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Arabic Question</h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Arabic Question *
                    </label>
                    <textarea
                      rows={2}
                      dir="rtl"
                      value={currentArabicQuestion.question}
                      onChange={(e) => setCurrentArabicQuestion({ ...currentArabicQuestion, question: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                      placeholder="Uses English quiz questions when left blank"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Arabic Option 1 *
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={currentArabicQuestion.option1}
                        onChange={(e) => setCurrentArabicQuestion({ ...currentArabicQuestion, option1: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Arabic Option 2 *
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={currentArabicQuestion.option2}
                        onChange={(e) => setCurrentArabicQuestion({ ...currentArabicQuestion, option2: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Arabic Option 3
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={currentArabicQuestion.option3}
                        onChange={(e) => setCurrentArabicQuestion({ ...currentArabicQuestion, option3: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Arabic Option 4
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        value={currentArabicQuestion.option4}
                        onChange={(e) => setCurrentArabicQuestion({ ...currentArabicQuestion, option4: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Arabic Correct Answer *
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={currentArabicQuestion.correct_answer}
                      onChange={(e) => setCurrentArabicQuestion({ ...currentArabicQuestion, correct_answer: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="The correct answer must match one of the Arabic options"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddArabicQuestion}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Add Arabic Question to List
                  </button>
                </div>

                {arabicQuizQuestions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">
                      Added Arabic Questions ({arabicQuizQuestions.length})
                    </h3>
                    <div className="space-y-3">
                      {arabicQuizQuestions.map((q, index) => (
                        <div key={index} className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="font-semibold text-slate-900 text-sm text-right flex-1" dir="rtl">
                              {index + 1}. {q.question}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveArabicQuestion(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="space-y-1 text-xs text-right" dir="rtl">
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
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {editingSection ? 'Update Section' : 'Save Section'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
