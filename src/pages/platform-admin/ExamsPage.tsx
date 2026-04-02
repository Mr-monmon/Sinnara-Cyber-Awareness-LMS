import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Edit2, Trash2, List } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Exam, ExamQuestion } from '../../lib/types';

export const ExamsPage: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    exam_type: 'GENERAL' as 'PRE_ASSESSMENT' | 'POST_ASSESSMENT' | 'GENERAL',
    passing_score: 70,
    time_limit_minutes: 30
  });

  const [questionForm, setQuestionForm] = useState({
    question: '',
    option1: '',
    option2: '',
    option3: '',
    option4: '',
    correct_answer: '',
    explanation: ''
  });

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    const { data } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setExams(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingExam) {
        const { error } = await supabase
          .from('exams')
          .update(formData)
          .eq('id', editingExam.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('exams')
          .insert([formData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingExam(null);
      setFormData({ title: '', description: '', exam_type: 'GENERAL', passing_score: 70, time_limit_minutes: 30 });
      await loadExams();
    } catch (error) {
      console.error('Error saving exam:', error);
      alert('Failed to save exam');
    }
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      title: exam.title,
      description: exam.description,
      exam_type: exam.exam_type,
      passing_score: exam.passing_score,
      time_limit_minutes: exam.time_limit_minutes || 30
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;

    try {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
      await loadExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      alert('Failed to delete exam');
    }
  };

  const handleManageQuestions = async (exam: Exam) => {
    setSelectedExam(exam);
    const { data } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', exam.id)
      .order('order_index');

    if (data) setQuestions(data);
    setShowQuestionsModal(true);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;

    const options = [
      questionForm.option1,
      questionForm.option2,
      questionForm.option3,
      questionForm.option4
    ].filter(o => o.trim());

    if (options.length < 2) {
      alert('At least two options are required');
      return;
    }

    if (!options.includes(questionForm.correct_answer)) {
      alert('The correct answer must be one of the options');
      return;
    }

    try {
      const { error } = await supabase.from('exam_questions').insert([{
        exam_id: selectedExam.id,
        question: questionForm.question,
        options: options,
        correct_answer: questionForm.correct_answer,
        explanation: questionForm.explanation,
        order_index: questions.length
      }]);

      if (error) throw error;

      setQuestionForm({
        question: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        correct_answer: '',
        explanation: ''
      });

      const { data } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', selectedExam.id)
        .order('order_index');

      if (data) setQuestions(data);
    } catch (error) {
      console.error('Error adding question:', error);
      alert('Failed to add question');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const { error } = await supabase.from('exam_questions').delete().eq('id', id);
      if (error) throw error;

      if (selectedExam) {
        const { data } = await supabase
          .from('exam_questions')
          .select('*')
          .eq('exam_id', selectedExam.id)
          .order('order_index');

        if (data) setQuestions(data);
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Exams and Assessments</h1>
          <p className="text-slate-600">Exam Template Management and Question Bank</p>
        </div>
        <button
          onClick={() => {
            setEditingExam(null);
            setFormData({ title: '', description: '', exam_type: 'GENERAL', passing_score: 70, time_limit_minutes: 30 });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Exam
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => (
          <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <ClipboardCheck className="h-6 w-6 text-blue-600" />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                exam.exam_type === 'PRE_ASSESSMENT'
                  ? 'bg-yellow-100 text-yellow-800'
                  : exam.exam_type === 'POST_ASSESSMENT'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {exam.exam_type === 'PRE_ASSESSMENT' ? 'Pre-Assessment' : exam.exam_type === 'POST_ASSESSMENT' ? 'Post-Assessment' : 'General'}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mb-2">{exam.title}</h3>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">{exam.description}</p>

            <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
              <span>Success Threshold: {exam.passing_score}%</span>
              {exam.time_limit_minutes && <span>{exam.time_limit_minutes} minutes</span>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleManageQuestions(exam)}
                className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1"
              >
                <List className="h-4 w-4" />
                Questions
              </button>
              <button
                onClick={() => handleEdit(exam)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(exam.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {exams.length === 0 && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
          No exams yet. Click the "Add Exam" button to create one.
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingExam ? 'Edit Exam' : 'Add New Exam'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Exam Type *
                </label>
                <select
                  value={formData.exam_type}
                  onChange={(e) => setFormData({ ...formData, exam_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="GENERAL">General</option>
                  <option value="PRE_ASSESSMENT">Pre-Assessment</option>
                  <option value="POST_ASSESSMENT">Post-Assessment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Success Threshold (%) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={formData.passing_score}
                  onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Time Limit (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.time_limit_minutes}
                  onChange={(e) => setFormData({ ...formData, time_limit_minutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingExam(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingExam ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuestionsModal && selectedExam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Question Management - {selectedExam.title}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Question</h3>
                <form onSubmit={handleAddQuestion} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Question *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={questionForm.question}
                      onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Option 1 *
                    </label>
                    <input
                      type="text"
                      required
                      value={questionForm.option1}
                      onChange={(e) => setQuestionForm({ ...questionForm, option1: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Option 2 *
                    </label>
                    <input
                      type="text"
                      required
                      value={questionForm.option2}
                      onChange={(e) => setQuestionForm({ ...questionForm, option2: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Option 3
                    </label>
                    <input
                      type="text"
                      value={questionForm.option3}
                      onChange={(e) => setQuestionForm({ ...questionForm, option3: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Option 4
                    </label>
                    <input
                      type="text"
                      value={questionForm.option4}
                      onChange={(e) => setQuestionForm({ ...questionForm, option4: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Correct Answer *
                    </label>
                    <input
                      type="text"
                      required
                      value={questionForm.correct_answer}
                      onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="The correct answer must be one of the options"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Explanation (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={questionForm.explanation}
                      onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Add Question
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Current Questions ({questions.length})
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {questions.map((q, index) => (
                    <div key={q.id} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          {index + 1}. {q.question}
                        </span>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
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

                  {questions.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      No questions yet. Add the first question!
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t mt-6">
              <button
                onClick={() => {
                  setShowQuestionsModal(false);
                  setSelectedExam(null);
                  setQuestions([]);
                }}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
