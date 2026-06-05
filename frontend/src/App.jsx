import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ClientApp from './pages/ClientApp'
import DriverApp from './pages/DriverApp'
import AdminApp from './pages/AdminApp'
import RatingTest from './pages/RatingTest'
import FareDemo from './pages/FareDemo'
import AuthCallback from './pages/AuthCallback'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Login />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/client"    element={<ClientApp />} />
        <Route path="/driver"    element={<DriverApp />} />
        <Route path="/admin"     element={<AdminApp />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/rating-test"  element={<RatingTest />} />
        <Route path="/fare-demo"   element={<FareDemo />} />
        <Route path="*"          element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
