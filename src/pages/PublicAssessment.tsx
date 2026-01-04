import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ExamQuestion } from '../types';

interface PublicAssessmentProps {
  onNavigate: (page: string) => void;
}

interface VisitorInfo {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  job_title: string;
}

export const PublicAssessment: React.FC<PublicAssessmentProps> = ({ onNavigate }) => {
  const [step, setStep] = useState<'info' | 'test' | 'results'>('info');
  const [visitorInfo, setVisitorInfo] = useState<VisitorInfo>({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    job_title: ''
  });
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const { data: examData } = await supabase
        .from('exams')
        .select('id')
        .eq('exam_type', 'GENERAL')
        .maybeSingle();

      if (examData) {
        const { data: questionsData } = await supabase
          .from('exam_questions')
          .select('*')
          .eq('exam_id', examData.id)
          .order('order_index');

        if (questionsData) {
          setQuestions(questionsData);
          setTotalQuestions(questionsData.length);
        }
      }
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('test');
  };

  const handleAnswerSelect = (answer: string) => {
    setAnswers({ ...answers, [questions[currentQuestion].id]: answer });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    const detailedAnswers = questions.map(q => {
      const isCorrect = answers[q.id] === q.correct_answer;
      if (isCorrect) correctCount++;
      return {
        question: q.question,
        selected_answer: answers[q.id] || 'Not answered',
        correct_answer: q.correct_answer,
        is_correct: isCorrect
      };
    });

    setScore(correctCount);

    try {
      await supabase.from('public_assessments').insert([{
        ...visitorInfo,
        score: correctCount,
        total_questions: questions.length,
        answers: detailedAnswers
      }]);
    } catch (error) {
      console.error('Error saving assessment:', error);
    }

    setStep('results');
  };

  const getPerformanceLevel = () => {
    const percentage = (score / totalQuestions) * 100;
    if (percentage >= 90) return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
    if (percentage >= 70) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (percentage >= 50) return { level: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Needs Improvement', color: 'text-red-600', bg: 'bg-red-50' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (step === 'info') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Home
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Free Cybersecurity Awareness Test
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Discover your current level of cybersecurity awareness. This quick assessment will help you understand your strengths and areas for improvement.
            </p>

            <form onSubmit={handleInfoSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={visitorInfo.full_name}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={visitorInfo.email}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, email: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={visitorInfo.phone}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={visitorInfo.company_name}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, company_name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  value={visitorInfo.job_title}
                  onChange={(e) => setVisitorInfo({ ...visitorInfo, job_title: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
              >
                Start Assessment
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'test' && questions.length > 0) {
    const question = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-600 to-cyan-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              {question.question}
            </h2>

            <div className="space-y-4 mb-8">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                    answers[question.id] === option
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      answers[question.id] === option
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-slate-300'
                    }`}>
                      {answers[question.id] === option && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <span className="text-slate-900">{option}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between gap-4">
              <button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="h-5 w-5 inline mr-2" />
                Previous
              </button>

              {currentQuestion === questions.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={!answers[question.id]}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  Submit Assessment
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!answers[question.id]}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ArrowRight className="h-5 w-5 inline ml-2" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'results') {
    const performance = getPerformanceLevel();
    const percentage = Math.round((score / totalQuestions) * 100);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full mb-6">
              <Check className="h-12 w-12 text-blue-600" />
            </div>

            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Assessment Complete!
            </h1>

            <div className="mb-8">
              <div className="text-6xl font-bold text-blue-600 mb-2">
                {score}/{totalQuestions}
              </div>
              <div className="text-2xl text-slate-600">
                {percentage}% Correct
              </div>
            </div>

            <div className={`inline-block px-6 py-3 rounded-full ${performance.bg} mb-8`}>
              <span className={`text-lg font-semibold ${performance.color}`}>
                {performance.level}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-slate-900 mb-3">Recommendations:</h3>
              <ul className="space-y-2 text-slate-600">
                {percentage < 70 && (
                  <>
                    <li>• Consider enrolling in comprehensive cybersecurity training</li>
                    <li>• Review basic security concepts and best practices</li>
                    <li>• Stay updated on latest security threats</li>
                  </>
                )}
                {percentage >= 70 && percentage < 90 && (
                  <>
                    <li>• Good foundation! Consider advanced training modules</li>
                    <li>• Focus on emerging threats and trends</li>
                    <li>• Practice identifying phishing attempts</li>
                  </>
                )}
                {percentage >= 90 && (
                  <>
                    <li>• Excellent knowledge! Help train others in your organization</li>
                    <li>• Stay current with evolving security landscape</li>
                    <li>• Consider specialized security certifications</li>
                  </>
                )}
              </ul>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => onNavigate('landing')}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all duration-300"
              >
                Request a Demo to Improve Your Skills
              </button>
              <button
                onClick={() => onNavigate('landing')}
                className="w-full py-4 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
