import Admin from './pages/Admin';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import MisDatos from './pages/MisDatos';
import Turnos from './pages/Turnos';
import ReservaPublica from './pages/ReservaPublica';
import GestionReserva from './pages/GestionReserva';

const RutaProtegida = ({ children }) => {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="min-h-screen bg-white flex items-center justify-center"><span className="text-slate-600 text-sm">Cargando tu espacio…</span></div>;
  return usuario ? children : <Navigate to="/" />;
};

const RutaAdmin = ({ children }) => {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="min-h-screen bg-white flex items-center justify-center text-slate-600 text-sm">Cargando tu espacio…</div>;
  return usuario?.rol === 'admin' ? children : <Navigate to="/home" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/b/:slug" element={<ReservaPublica />} />
          <Route path="/cancelar/:token" element={<GestionReserva />} />
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<RutaProtegida><Home /></RutaProtegida>} />
          <Route path="/mis-datos" element={<RutaProtegida><MisDatos /></RutaProtegida>} />
          <Route path="/turnos" element={<RutaProtegida><Turnos /></RutaProtegida>} />
          <Route path="/admin" element={<RutaAdmin><Admin /></RutaAdmin>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
