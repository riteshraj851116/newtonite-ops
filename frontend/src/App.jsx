import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/ToastContainer';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkItemList from './pages/WorkItemList';
import CreateWorkItem from './pages/CreateWorkItem';
import WorkItemDetail from './pages/WorkItemDetail';
import EditWorkItem from './pages/EditWorkItem';
import TeamManagement from './pages/TeamManagement';
import Profile from './pages/Profile';
import AccessDenied from './pages/AccessDenied';
import NotFound from './pages/NotFound';

import './styles/index.css';
import './styles/components.css';

// Authenticated Layout Scaffold
const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      <div className="app-main-layout">
        <Sidebar isOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="app-content-area">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes (No sign-up / register flow) */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Protected Routes inside AppLayout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* 1. Dashboard */}
              <Route path="/" element={<Dashboard />} />

              {/* 2. All Work Items */}
              <Route path="/work-items" element={<WorkItemList viewMode="all" />} />

              {/* 3. My Assigned Items */}
              <Route path="/work-items/my-assigned" element={<WorkItemList viewMode="my-assigned" />} />

              {/* 4. Unassigned Urgent Items */}
              <Route path="/work-items/unassigned-urgent" element={<WorkItemList viewMode="unassigned-urgent" />} />

              {/* 5. Awaiting My Approval */}
              <Route path="/work-items/awaiting-approval" element={<WorkItemList viewMode="awaiting-approval" />} />

              {/* 6. Create Work Item */}
              <Route path="/work-items/create" element={<CreateWorkItem />} />

              {/* 7. Work Item Details & Edit */}
              <Route path="/work-items/:id" element={<WorkItemDetail />} />
              <Route path="/work-items/:id/edit" element={<EditWorkItem />} />

              {/* 8. Team Work Items */}
              <Route path="/teams" element={<TeamManagement />} />

              {/* 9. Profile */}
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* 10. Not Found / Catch-all */}
            <Route path="/not-found" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
