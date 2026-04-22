import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { Overview } from './pages/SuperAdmin/Overview';
import { OwnerManagement } from './pages/SuperAdmin/OwnerManagement';
import { GlobalBroadcast } from './pages/SuperAdmin/GlobalBroadcast';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* SuperAdmin Routes */}
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="/superadmin/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="owners" element={<OwnerManagement />} />
          <Route path="broadcast" element={<GlobalBroadcast />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
