import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Power, PowerOff, Search } from 'lucide-react';
import './SuperAdmin.css';

const MOCK_OWNERS = [
  { id: '1', name: 'Ramesh Reddy', hostels: 3, tenants: 145, status: 'active', payment: 'Paid' },
  { id: '2', name: 'Suresh Kumar', hostels: 1, tenants: 45, status: 'active', payment: 'Pending' },
  { id: '3', name: 'Priya Sharma', hostels: 2, tenants: 90, status: 'disabled', payment: 'Overdue' },
  { id: '4', name: 'Venkatesh Rao', hostels: 5, tenants: 310, status: 'active', payment: 'Paid' },
];

export const OwnerManagement: React.FC = () => {
  const [owners, setOwners] = useState(MOCK_OWNERS);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleStatus = (id: string) => {
    setOwners(owners.map(owner => {
      if (owner.id === id) {
        return { ...owner, status: owner.status === 'active' ? 'disabled' : 'active' };
      }
      return owner;
    }));
  };

  const filteredOwners = owners.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">PG Owners</h1>
          <p className="page-subtitle">Manage access and billing for all property owners</p>
        </div>
      </header>

      <div className="table-container glass-card">
        <div className="table-header-actions">
          <div className="search-bar">
            <Search size={18} className="search-icon text-muted" />
            <input 
              type="text" 
              placeholder="Search owners..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Owner Name</th>
                <th>Properties</th>
                <th>Total Tenants</th>
                <th>SaaS Payment</th>
                <th>Kill Switch</th>
              </tr>
            </thead>
            <tbody>
              {filteredOwners.map((owner, index) => (
                <motion.tr 
                  key={owner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="font-semibold">{owner.name}</td>
                  <td>{owner.hostels}</td>
                  <td>{owner.tenants}</td>
                  <td>
                    <span className={`status-badge payment-${owner.payment.toLowerCase()}`}>
                      {owner.payment}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`kill-switch ${owner.status}`}
                      onClick={() => toggleStatus(owner.id)}
                      title={owner.status === 'active' ? 'Disable Access' : 'Enable Access'}
                    >
                      {owner.status === 'active' ? <Power size={18} /> : <PowerOff size={18} />}
                      <span>{owner.status === 'active' ? 'Active' : 'Disabled'}</span>
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredOwners.length === 0 && (
            <div className="empty-state text-muted">No owners found matching your search.</div>
          )}
        </div>
      </div>
    </div>
  );
};
