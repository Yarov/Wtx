import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Agent from './pages/Agent'
import Inventory from './pages/Inventory'
import Appointments from './pages/Appointments'
import Conversations from './pages/Conversations'
import Schedule from './pages/Schedule'
import Contactos from './pages/Contactos'
import Campanas from './pages/Campanas'
import Setup from './pages/Setup'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="agent" element={<Agent />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="contactos" element={<Contactos />} />
            <Route path="campanas" element={<Campanas />} />
            <Route path="schedule" element={<Schedule />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
