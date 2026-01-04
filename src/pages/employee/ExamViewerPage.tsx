import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ExamQuestion {
  id: string;
  exam_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  order_index: number;
}

interface ExamViewerProps {
  examId: string;
  examTitle: string;
  examType: string;
  timeLimit: number;
  passingScore: number;
  onBack: () => void;
}

export const ExamViewerPage: React.FC<ExamViewerProps> = ({
  examId,
  examTitle,
  examType,
  timeLimit,
  passingScore,
  onBack
}) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(timeLimit * 60);
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(0);

  useEffect(() => {
    checkAccessAndLoad();
  }, [examId, user]);

  const checkAccessAndLoad = async () => {
    if (!user?.id || !examId) return;

    try {
      const { data, error } = await supabase
        .rpc('employee_has_exam_access', {
          p_employee_id: user.id,
          p_exam_id: examId
        })
        .maybeSingle();

      if (error || !data) {
        alert('Error checking exam access. Please try again.');
        onBack();
        return;
      }

      if (!data.can_take_exam) {
        if (data.has_passed) {
          alert('You have already passed this exam!');
        } else {
          alert(`You have used all your attempts for this exam. Contact your admin for more.`);
        }
        onBack();
        return;
      }

      setAssignmentId(data.assignment_id);
      setAttemptsRemaining(data.max_attempts - data.attempts_used);
      await loadQuestions();
    } catch (err) {
      console.error('Error checking access:', err);
      alert('Error checking exam access. Please try again.');
      onBack();
    }
  };

  useEffect(() => {
    if (examStarted && !examSubmitted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [examStarted, examSubmitted, timeRemaining]);

  const loadQuestions = async () => {
    try {
      const { data } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_index');

      if (data) setQuestions(data);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    setExamStarted(true);
  };

  const handleAnswerSelect = (answer: string) => {
    setAnswers({ ...answers, [questions[currentQuestionIndex].id]: answer });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleAutoSubmit = () => {
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!user) return;

    let correctCount = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) {
        correctCount++;
      }
    });

    const finalScore = Math.round((correctCount / questions.length) * 100);
    const didPass = finalScore >= passingScore;

    setScore(finalScore);
    setPassed(didPass);
    setExamSubmitted(true);

    try {
      await supabase.from('exam_results').insert([{
        employee_id: user.id,
        exam_id: examId,
        assignment_id: assignmentId,
        score: correctCount,
        total_questions: questions.length,
        percentage: finalScore,
        passed: didPass,
        answers: questions.map(q => ({
          question: q.question,
          selected_answer: answers[q.id] || 'Not answered',
          correct_answer: q.correct_answer,
          is_correct: answers[q.id] === q.correct_answer
        })),
        started_at: new Date(Date.now() - (timeLimit * 60 - timeRemaining) * 1000).toISOString(),
        completed_at: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Error saving exam result:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-900 mb-2">No Questions Found</p>
          <p className="text-slate-600 mb-4">This assessment has no questions. Please contact your admin.</p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Assessments
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{examTitle}</h1>
              <span className={`inline-block px-4 py-1 rounded-full text-sm font-medium ${
                examType === 'PRE_ASSESSMENT'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {examType === 'PRE_ASSESSMENT' ? 'Pre-Assessment' : 'Post-Assessment'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-lg p-6 mb-8 space-y-4">
              <h3 className="font-semibold text-slate-900 mb-4">Assessment Instructions:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{questions.length}</div>
                  <div className="text-sm text-slate-600">Questions</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{timeLimit}</div>
                  <div className="text-sm text-slate-600">Minutes</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{passingScore}%</div>
                  <div className="text-sm text-slate-600">Passing Score</div>
                </div>
              </div>

              <div className="mt-6 space-y-2 text-slate-700">
                <p className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  Answer all questions
                </p>
                <p className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  Navigate between questions before submitting
                </p>
                <p className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  Assessment will auto-submit when time expires
                </p>
                <p className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  Cannot pause assessment once started
                </p>
              </div>
            </div>

            <button
              onClick={handleStartExam}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all duration-300 text-lg"
            >
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (examSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 bg-blue-100">
              <Check className="h-10 w-10 text-blue-600" />
            </div>

            <h1 className="text-4xl font-bold mb-4 text-slate-900">
              Assessment Submitted Successfully
            </h1>

            <div className="bg-blue-50 rounded-lg p-6 mb-8 border border-blue-200">
              <p className="text-lg text-blue-900 font-medium mb-2">
                Your answers have been recorded
              </p>
              <p className="text-blue-700">
                Your company administrator will review your results and provide feedback soon.
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-3">What happens next?</h3>
              <div className="space-y-2 text-sm text-slate-700">
                <p className="flex items-center gap-2 justify-center">
                  <Check className="h-4 w-4 text-green-600" />
                  Your administrator will review your responses
                </p>
                <p className="flex items-center gap-2 justify-center">
                  <Check className="h-4 w-4 text-green-600" />
                  Results will be available in your assessment history
                </p>
                <p className="flex items-center gap-2 justify-center">
                  <Check className="h-4 w-4 text-green-600" />
                  You may receive additional feedback or training recommendations
                </p>
              </div>
            </div>

            <button
              onClick={onBack}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Return to Assessments
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-sm text-slate-600">
                Answered: {getAnsweredCount()} / {questions.length}
              </span>
            </div>

            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold ${
              timeRemaining < 300 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-900'
            }`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeRemaining)}
            </div>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">
            {currentQuestion.question}
          </h2>

          <div className="space-y-4 mb-8">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className={`w-full text-right p-4 rounded-lg border-2 transition-all duration-200 ${
                  answers[currentQuestion.id] === option
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    answers[currentQuestion.id] === option
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-300'
                  }`}>
                    {answers[currentQuestion.id] === option && (
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
              disabled={currentQuestionIndex === 0}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="h-5 w-5" />
              Previous
            </button>

            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={getAnsweredCount() !== questions.length}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                Submit Assessment
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                Next
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Quick Navigation:</h3>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`aspect-square rounded-lg font-medium text-sm transition-all ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : answers[questions[index].id]
                    ? 'bg-green-100 text-green-800 border-2 border-green-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
