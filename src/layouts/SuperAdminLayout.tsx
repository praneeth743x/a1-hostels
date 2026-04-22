import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, Radio, LogOut } from 'lucide-react';
import './SuperAdminLayout.css';

export const SuperAdminLayout: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/login');
  };

  const navItems = [
    { path: '/superadmin/overview', label: 'Overview', icon: LayoutDashboard },
    { path: '/superadmin/owners', label: 'PG Owners', icon: Users },
    { path: '/superadmin/broadcast', label: 'Global Broadcast', icon: Radio },
  ];

  return (
    <div className="superadmin-layout">
      <motion.aside 
        className="sidebar glass"
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="sidebar-header">
          <div className="logo-small pulse-ring"></div>
          <span className="brand-text">StaySync <span className="role-badge">Admin</span></span>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item, index) => (
            <motion.div 
              key={item.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
            >
              <NavLink 
                to={item.path} 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <item.icon size={20} className="nav-icon" />
                <span>{item.label}</span>
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} className="nav-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      <main className="main-content">
        <motion.div
          className="content-wrapper"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
};
