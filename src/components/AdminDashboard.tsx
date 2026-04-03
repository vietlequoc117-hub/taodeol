import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { Exam, Result } from '../types';
import { LogOut, Plus, FileText, Trash2, Users } from 'lucide-react';

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">Admin Login</h1>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/admin" className="text-xl font-bold text-gray-800">
                Quiz Admin
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<ExamList user={user} />} />
          <Route path="/create" element={<CreateExam user={user} />} />
          <Route path="/results/:examId" element={<ExamResults />} />
        </Routes>
      </main>
    </div>
  );
}

function ExamList({ user }: { user: User }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchExams();
  }, [user]);

  const fetchExams = async () => {
    try {
      const q = query(collection(db, 'exams'), where('adminId', '==', user.uid));
      const snapshot = await getDocs(q);
      const examsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(examsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (examId: string) => {
    if (window.confirm('Are you sure you want to delete this exam?')) {
      try {
        await deleteDoc(doc(db, 'exams', examId));
        setExams(exams.filter(e => e.id !== examId));
      } catch (error) {
        console.error('Error deleting exam:', error);
        alert('Failed to delete exam');
      }
    }
  };

  if (loading) return <div>Loading exams...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Your Exams</h2>
        <Link
          to="/admin/create"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Create Exam
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No exams yet</h3>
          <p className="text-gray-500 mt-1">Get started by creating a new exam.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map(exam => (
            <div key={exam.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-xl font-semibold text-gray-800 mb-2 truncate" title={exam.title}>{exam.title}</h3>
              <p className="text-sm text-gray-500 mb-4">
                Created: {new Date(exam.createdAt).toLocaleDateString()}
              </p>
              <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                <div className="flex gap-2">
                  <Link
                    to={`/admin/results/${exam.id}`}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Users size={16} />
                    Results
                  </Link>
                  <button
                    onClick={() => {
                      // Replace ais-dev with ais-pre to ensure the public share link is copied
                      const publicOrigin = window.location.origin.replace('ais-dev-', 'ais-pre-');
                      const url = `${publicOrigin}/exam/${exam.id}`;
                      navigator.clipboard.writeText(url);
                      alert('Đã copy link bài thi! Bạn có thể gửi link này cho học sinh.');
                    }}
                    className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800 ml-2"
                  >
                    Copy Link
                  </button>
                </div>
                <button
                  onClick={() => handleDelete(exam.id!)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete Exam"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateExam({ user }: { user: User }) {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([{ id: '1', text: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleAddQuestion = () => {
    setQuestions([...questions, { id: Date.now().toString(), text: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    const newQuestions = [...questions];
    (newQuestions[index] as any)[field] = value;
    setQuestions(newQuestions);
  };

  const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[optIndex] = value;
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    if (!title.trim()) return alert('Please enter a title');
    if (questions.some(q => !q.text.trim() || q.options.some(o => !o.trim()))) {
      return alert('Please fill in all question texts and options');
    }

    setSaving(true);
    try {
      const examData = { questions };
      const newExam: Exam = {
        adminId: user.uid,
        createdAt: new Date().toISOString(),
        data: JSON.stringify(examData),
        title: title.trim(),
        examType: 'multiple_choice'
      };

      await addDoc(collection(db, 'exams'), newExam);
      navigate('/admin');
    } catch (error) {
      console.error('Error saving exam:', error);
      alert('Failed to save exam');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Create New Exam</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Exam'}
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Exam Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="e.g. Midterm Math Exam"
        />
      </div>

      <div className="space-y-6">
        {questions.map((q, qIndex) => (
          <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-800">Question {qIndex + 1}</h3>
              {questions.length > 1 && (
                <button
                  onClick={() => handleRemoveQuestion(qIndex)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>

            <textarea
              value={q.text}
              onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-4"
              placeholder="Enter question text..."
              rows={3}
            />

            <div className="space-y-3">
              {q.options.map((opt, optIndex) => (
                <div key={optIndex} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctAnswerIndex === optIndex}
                    onChange={() => handleQuestionChange(qIndex, 'correctAnswerIndex', optIndex)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder={`Option ${optIndex + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddQuestion}
        className="mt-6 w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
      >
        <Plus size={20} />
        Add Question
      </button>
    </div>
  );
}

import { useParams } from 'react-router-dom';

function ExamResults() {
  const { examId } = useParams();
  const [results, setResults] = useState<Result[]>([]);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (examId) {
      fetchData();
    }
  }, [examId]);

  const fetchData = async () => {
    try {
      const examDoc = await getDoc(doc(db, 'exams', examId!));
      if (examDoc.exists()) {
        setExam({ id: examDoc.id, ...examDoc.data() } as Exam);
      }

      const q = query(collection(db, 'results'), where('examId', '==', examId));
      const snapshot = await getDocs(q);
      const resultsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result));
      setResults(resultsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading results...</div>;
  if (!exam) return <div>Exam not found</div>;

  return (
    <div>
      <div className="mb-6">
        <Link to="/admin" className="text-blue-600 hover:underline mb-2 inline-block">&larr; Back to Exams</Link>
        <h2 className="text-2xl font-bold text-gray-800">Results: {exam.title}</h2>
        <p className="text-gray-600">Total submissions: {results.length}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 font-semibold text-gray-700">Student Name</th>
                <th className="p-4 font-semibold text-gray-700">Class</th>
                <th className="p-4 font-semibold text-gray-700">Score</th>
                <th className="p-4 font-semibold text-gray-700">Date Submitted</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">No results yet</td>
                </tr>
              ) : (
                results.map(result => (
                  <tr key={result.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{result.name}</td>
                    <td className="p-4 text-gray-600">{result.className}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        {result.score} pts
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{new Date(result.date).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
