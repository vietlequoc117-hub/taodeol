import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { Exam, ExamData, Result } from '../types';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function StudentExam() {
  const { examId } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Student Info State
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [started, setStarted] = useState(false);

  // Exam State
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (examId) {
      fetchExam();
    }
  }, [examId]);

  const fetchExam = async () => {
    try {
      const docRef = doc(db, 'exams', examId!);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const examObj = { id: docSnap.id, ...docSnap.data() } as Exam;
        setExam(examObj);
        setExamData(JSON.parse(examObj.data));
      } else {
        setError('Exam not found.');
      }
    } catch (err) {
      console.error('Error fetching exam:', err);
      setError('Failed to load exam.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !className.trim()) {
      alert('Please enter your name and class.');
      return;
    }
    setStarted(true);
  };

  const handleAnswerSelect = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (!examData || !exam) return;

    // Check if all questions are answered
    const unanswered = examData.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      if (!window.confirm(`You have ${unanswered.length} unanswered questions. Are you sure you want to submit?`)) {
        return;
      }
    }

    setSubmitting(true);

    // Calculate score
    let totalScore = 0;
    examData.questions.forEach(q => {
      if (answers[q.id] === q.correctAnswerIndex) {
        totalScore += 1; // 1 point per question
      }
    });

    try {
      const result: Result = {
        examId: exam.id!,
        name: name.trim(),
        className: className.trim(),
        score: totalScore,
        correctP1: totalScore, // Just storing total score in correctP1 for now
        correctP2: 0,
        correctP3: 0,
        date: new Date().toISOString(),
        answers,
        examType: exam.examType
      };

      await addDoc(collection(db, 'results'), result);
      setScore(totalScore);
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting result:', err);
      alert('Failed to submit exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading exam...</div>;
  }

  if (error || !exam || !examData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">{error || 'Exam not found'}</h2>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-6" />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Exam Submitted!</h2>
          <p className="text-gray-600 mb-6">Thank you, {name}. Your responses have been recorded.</p>
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Your Score</p>
            <p className="text-4xl font-bold text-blue-600">
              {score} <span className="text-xl text-gray-400">/ {examData.questions.length}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{exam.title}</h1>
          <p className="text-gray-600 mb-8">Please enter your details to begin the exam.</p>
          
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g. Nguyen Van A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g. 10A1"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors font-medium mt-4"
            >
              Start Exam
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 sticky top-4 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{exam.title}</h1>
              <p className="text-sm text-gray-500">Student: {name} - {className}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Progress</p>
              <p className="font-medium text-blue-600">
                {Object.keys(answers).length} / {examData.questions.length}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 mb-8">
          {examData.questions.map((q, qIndex) => (
            <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                <span className="text-gray-400 mr-2">{qIndex + 1}.</span>
                {q.text}
              </h3>
              <div className="space-y-3">
                {q.options.map((opt, optIndex) => (
                  <label
                    key={optIndex}
                    className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                      answers[q.id] === optIndex
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={optIndex}
                      checked={answers[q.id] === optIndex}
                      onChange={() => handleAnswerSelect(q.id, optIndex)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-3 text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors font-medium text-lg disabled:opacity-50 shadow-sm"
          >
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </div>
    </div>
  );
}
