import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'
import OAuthCallback from './pages/Auth/OAuthCallback'
import MentorDashboard from './pages/Mentor/MentorDashboard'
import MenteeDashboard from './pages/Mentee/MenteeDashboard'
import MentorInfoRegister from './pages/Mentor/MentorRegister'
import MentorSearch from './pages/Mentee/MentorSearch'
import MentorApply from './pages/Mentee/MentorApply'
import InterviewSession from './pages/Interview/InterviewSession'
import InterviewRobby from './pages/Interview/InterviewLobby'
import MentoringSessionPage from './pages/Interview/MentoringSession'
import AIReportPage from './pages/Report/AIReport'
import ReportWaitingPage from './pages/Report/ReportWaiting'
import MentorReviewPage from './pages/Report/MentorReview'
import FinalReportPage from './pages/Report/FinalReport'
import MentorFeedbackPage from './pages/Report/MentorFeedback'
import ReportGeneratingPage from './pages/Report/ReportGenerating'
import MyPage from './pages/MyPage'
import MentorMyPage from './pages/MyPage/MentorMypage'
import MenteeMyPage from './pages/MyPage/MenteeMypage'
import ResumeManage from './pages/MyPage/ResumeManage'
import { getAuthUser } from './store/authStore'

/* 로그인 필요 + 역할 체크 */
function ProtectedRoute({ element, role }) {
  const user = getAuthUser();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'mentor' ? '/dashboard/mentor' : '/dashboard/mentee'} replace />;
  }
  return element;
}

export default function App() {
  return (
    <Routes>
      {/* 공개 */}
      <Route path="/" element={<Home />} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />

      {/* 멘토 전용 */}
      <Route path="/dashboard/mentor"        element={<ProtectedRoute role="mentor" element={<MentorDashboard />} />} />
      <Route path="/mentor/register"         element={<ProtectedRoute role="mentor" element={<MentorInfoRegister />} />} />
      <Route path="/mentor/mypage"           element={<ProtectedRoute role="mentor" element={<MentorMyPage />} />} />
      <Route path="/interview/ready-mentor/:id" element={<ProtectedRoute role="mentor" element={<InterviewRobby role="mentor" />} />} />
      <Route path="/interview/mentor/:id"    element={<ProtectedRoute role="mentor" element={<InterviewSession role="mentor" />} />} />
      <Route path="/mentoring/mentor/:sessionId" element={<ProtectedRoute role="mentor" element={<MentoringSessionPage />} />} />
      <Route path="/mentor/feedback/:sessionId" element={<ProtectedRoute role="mentor" element={<MentorFeedbackPage />} />} />

      {/* 멘티 전용 */}
      <Route path="/dashboard/mentee"        element={<ProtectedRoute role="mentee" element={<MenteeDashboard />} />} />
      <Route path="/mentor/search"           element={<ProtectedRoute element={<MentorSearch />} />} />
      <Route path="/mentor/apply/:id"        element={<ProtectedRoute role="mentee" element={<MentorApply />} />} />
      <Route path="/mentee/mypage"           element={<ProtectedRoute role="mentee" element={<MenteeMyPage />} />} />
      <Route path="/mentee/resume"           element={<ProtectedRoute role="mentee" element={<ResumeManage />} />} />
      <Route path="/interview/ready/:id"     element={<ProtectedRoute role="mentee" element={<InterviewRobby role="mentee" />} />} />
      <Route path="/interview/mentee/:id"    element={<ProtectedRoute role="mentee" element={<InterviewSession role="mentee" />} />} />
      <Route path="/mentoring/mentee/:sessionId" element={<ProtectedRoute role="mentee" element={<MentoringSessionPage />} />} />
      <Route path="/report/generating/:sessionId" element={<ProtectedRoute element={<ReportGeneratingPage />} />} />
      <Route path="/report/ai/:sessionId"    element={<ProtectedRoute element={<AIReportPage />} />} />
      <Route path="/report/ai-stream/:sessionId" element={<ProtectedRoute element={<ReportWaitingPage />} />} />
      <Route path="/report/mentor-review/:sessionId" element={<ProtectedRoute element={<MentorReviewPage />} />} />
      <Route path="/report/final"            element={<ProtectedRoute element={<FinalReportPage />} />} />
      <Route path="/report/final/:sessionId" element={<ProtectedRoute element={<FinalReportPage />} />} />

      {/* 로그인만 필요 (공통) */}
      <Route path="/mypage" element={<ProtectedRoute element={<MyPage />} />} />
    </Routes>
  )
}
