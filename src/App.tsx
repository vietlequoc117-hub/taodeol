/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import StudentExam from './components/StudentExam';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/exam/:examId" element={<StudentExam />} />
      </Routes>
    </BrowserRouter>
  );
}
