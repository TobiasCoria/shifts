import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/* eslint-disable react-refresh/only-export-components */

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const refrescarSesion = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUsuario(data.usuario);
      return data.usuario;
    } catch {
      setUsuario(null);
      return null;
    } finally { setCargando(false); }
  }, []);

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    void refrescarSesion();
  }, [refrescarSesion]);

  const login = (usuarioData) => setUsuario(usuarioData);
  const logout = async () => {
    try { await api.post('/auth/logout'); } finally { setUsuario(null); }
  };
  const actualizarUsuario = (datos) => setUsuario((actual) => ({ ...actual, ...datos }));

  return <AuthContext.Provider value={{ usuario, login, logout, cargando, actualizarUsuario, refrescarSesion }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
