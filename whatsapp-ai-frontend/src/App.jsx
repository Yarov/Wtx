import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ApiKeys from './pages/ApiKeys'
import Tools from './pages/Tools'
import Prompt from './pages/Prompt'
import Inventory from './pages/Inventory'
import Appointments from './pages/Appointments'
import Conversations from './pages/Conversations'
import Payments from './pages/Payments'
import Schedule from './pages/Schedule'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="api-keys" element={<ApiKeys />} />
            <Route path="tools" element={<Tools />} />
            <Route path="prompt" element={<Prompt />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="payments" element={<Payments />} />
            <Route path="schedule" element={<Schedule />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
