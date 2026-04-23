import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Power, PowerOff, Search, Plus, X } from 'lucide-react';
import './SuperAdmin.css';

const MOCK_OWNERS = [
  { id: '1', name: 'Ramesh Reddy', phone: '+91 98765 43210', pgName: 'Reddy Premium Hostels', hostels: 3, tenants: 145, status: 'active', payment: 'Paid' },
  { id: '2', name: 'Suresh Kumar', phone: '+91 87654 32109', pgName: 'Suresh Co-living Space', hostels: 1, tenants: 45, status: 'active', payment: 'Pending' },
  { id: '3', name: 'Priya Sharma', phone: '+91 76543 21098', pgName: 'Priya Girls PG', hostels: 2, tenants: 90, status: 'disabled', payment: 'Overdue' },
  { id: '4', name: 'Venkatesh Rao', phone: '+91 65432 10987', pgName: 'Venkatesh Executive Stays', hostels: 5, tenants: 310, status: 'active', payment: 'Paid' },
];

export const OwnerManagement: React.FC = () => {
  const [owners, setOwners] = useState(MOCK_OWNERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOwner, setNewOwner] = useState({
    name: '',
    pgName: '',
    phone: '',
    hostels: 0,
    tenants: 0,
    status: 'active',
    payment: 'Pending'
  });

  const toggleStatus = (id: string) => {
    setOwners(owners.map(owner => {
      if (owner.id === id) {
        return { ...owner, status: owner.status === 'active' ? 'disabled' : 'active' };
      }
      return owner;
    }));
  };

  const filteredOwners = owners.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.pgName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.phone.replace(/\s+/g, '').includes(searchTerm.replace(/\s+/g, ''))
  );

  const handleAddOwner = (e: React.FormEvent) => {
    e.preventDefault();
    const id = (owners.length + 1).toString();
    setOwners([...owners, { id, ...newOwner }]);
    setIsModalOpen(false);
    setNewOwner({
      name: '',
      pgName: '',
      phone: '',
      hostels: 0,
      tenants: 0,
      status: 'active',
      payment: 'Pending'
    });
  };

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">PG Owners</h1>
          <p className="page-subtitle">Manage access and billing for all property owners</p>
        </div>
      </header>

      <div className="table-container glass-card">
        <div className="table-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--primary-indigo)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={18} />
            Add Owner
          </button>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>PG & Owner Name</th>
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
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="font-semibold">{owner.pgName}</span>
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                        {owner.name} • {owner.phone}
                      </span>
                    </div>
                  </td>
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

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New PG Owner</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <form className="modal-form" onSubmit={handleAddOwner}>
              <div className="form-group">
                <label>Owner Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Ramesh Reddy"
                  value={newOwner.name}
                  onChange={e => setNewOwner({...newOwner, name: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>PG/Business Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Reddy Premium Hostels"
                  value={newOwner.pgName}
                  onChange={e => setNewOwner({...newOwner, pgName: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={newOwner.phone}
                  onChange={e => setNewOwner({...newOwner, phone: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" style={{
                  backgroundColor: 'var(--primary-indigo)',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer'
                }}>
                  Save Owner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
