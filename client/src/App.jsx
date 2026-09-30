import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Confirmation from './pages/Confirmation';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import BackgroundLayout from './components/BackgroundLayout';

function App() {
  return (
    <BrowserRouter>
      <BackgroundLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/confirmation" element={<Confirmation />} />
          {/* Admin routes - outside BackgroundLayout? We'll keep inside but BackgroundLayout will handle admin separately */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </BackgroundLayout>
    </BrowserRouter>
  );
}

export default App;