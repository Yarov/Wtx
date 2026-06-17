import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Agent from './pages/Agent'
import Conversations from './pages/Conversations'
import Contactos from './pages/Contactos'
import Campanas from './pages/Campanas'
import CampanaNueva from './pages/CampanaNueva'
import Setup from './pages/Setup'
import WhatsAppConfig from './pages/WhatsAppConfig'
import Conocimiento from './pages/Conocimiento'
import Funnel from './pages/Funnel'

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
            <Route path="agent" element={<Agent />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="contactos" element={<Contactos />} />
            <Route path="campanas" element={<Campanas />} />
            <Route path="campanas/nueva" element={<CampanaNueva />} />
            <Route path="whatsapp" element={<WhatsAppConfig />} />
            <Route path="conocimiento" element={<Conocimiento />} />
            <Route path="funnel" element={<Funnel />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
