"use client";

import { toast } from 'react-hot-toast';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  DoorOpen, 
  IndianRupee, 
  TrendingDown, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle,
  Download,
  Calendar,
  ChevronDown
} from 'lucide-react';
import styles from './reports.module.css';
import { rpcCall } from '@/lib/rpc';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { CustomSelect } from '@/components/CustomSelect';
import { useHostel, usePermissions } from '@/context/HostelContext';
import { PERMISSIONS } from '@/constants/permissions';
import ProtectedRoute from '@/components/ProtectedRoute';
import { perfLogger } from '@/lib/perfLogger';
import { useHostelData } from '@/hooks/useHostelData';

const reportTypes = [
  {
    id: 'tenants',
    title: 'Tenants Report',
    description: 'Detailed list of all active and vacated tenants',
    icon: Users,
    colorClass: styles.iconPurple
  },
  {
    id: 'rooms',
    title: 'Rooms Report',
    description: 'Current occupancy and room status overview',
    icon: DoorOpen,
    colorClass: styles.iconBlue
  },
  {
    id: 'payments',
    title: 'Payments Report',
    description: 'Record of all rent payments received',
    icon: IndianRupee,
    colorClass: styles.iconGreen
  },
  {
    id: 'expenses',
    title: 'Expenses Report',
    description: 'Breakdown of all PG maintenance expenses',
    icon: TrendingDown,
    colorClass: styles.iconOrange
  },
  {
    id: 'profit',
    title: 'Profit Report',
    description: 'Monthly profit and loss statement',
    icon: TrendingUp,
    colorClass: styles.iconTeal
  },
  {
    id: 'security_deposit',
    title: 'Security Deposit Report',
    description: 'Tracker for collected and refunded deposits',
    icon: ShieldCheck,
    colorClass: styles.iconIndigo
  },
  {
    id: 'dues',
    title: 'Dues Report',
    description: 'List of all pending and overdue payments',
    icon: AlertCircle,
    colorClass: styles.iconRed
  }
];

const months = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ReportsPage() {
  const { properties: storeProperties } = useHostel();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear - i);

  const [properties, setProperties] = useState<any[]>(storeProperties || []);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [downloadFormat, setDownloadFormat] = useState<'csv' | 'pdf'>('csv');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const [siteName, setSiteName] = useState('A1 Hostels');
  const [siteLogo, setSiteLogo] = useState('/himalaya_logo_premium.png');
  const [logoBase64, setLogoBase64] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    rpcCall('getLandingSettings').then((res) => {
      if (res?.success && res?.data) {
        if (res.data.siteName) setSiteName(res.data.siteName);
        if (res.data.logoUrl) {
          setSiteLogo(res.data.logoUrl);
          fetch(res.data.logoUrl)
            .then(r => r.blob())
            .then(blob => {
              const reader = new FileReader();
              reader.onloadend = () => {
                setLogoBase64(reader.result as string);
              };
              reader.readAsDataURL(blob);
            }).catch(() => {});
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!logoBase64) {
      fetch('/himalaya_logo_premium.png')
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setLogoBase64(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }).catch(() => {});
    }
  }, [logoBase64]);

  const [selectedTenantFilter, setSelectedTenantFilter] = useState('All');
  const [selectedCollectorFilter, setSelectedCollectorFilter] = useState('All');
  const [paymentsTenantFilter, setPaymentsTenantFilter] = useState('All');
  
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'yearly' | 'overall'>('monthly');
  const [tenantReportMode, setTenantReportMode] = useState<'all' | 'custom'>('all');
  const [paymentTenantMode, setPaymentTenantMode] = useState<'all' | 'custom'>('all');
  const [paymentCollectorMode, setPaymentCollectorMode] = useState<'all' | 'custom'>('all');

  const { data: hostelData } = useHostelData(selectedProperty);
  
  const tenantsList = hostelData?.tenants || [];
  const paymentsList = hostelData?.payments || [];
  const uniqueCollectors = Array.from(new Set(paymentsList.map((p: any) => p.collected_by_name || p.collectedByName || 'Owner'))).filter(Boolean);

  useEffect(() => {
    perfLogger.logNavigationStart('/pgowner/reports');
    perfLogger.logRenderStart('ReportsPage');
    perfLogger.logPageSummary('Reports');
    return () => {
      perfLogger.logRenderEnd('ReportsPage');
    };
  }, []);

  useEffect(() => {
    if (storeProperties && storeProperties.length > 0) {
      setProperties(storeProperties);
      const currentId = localStorage.getItem('activePgId');
      if (currentId && storeProperties.some((p: any) => p.pg_id === currentId)) {
        setSelectedProperty(currentId);
      } else if (storeProperties.length > 0) {
        setSelectedProperty((storeProperties[0] as any).pg_id);
      }
    }
  }, [storeProperties]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setOwnerId(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const { hasPermission } = usePermissions();
  const canExportReports = hasPermission('exportReports');

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = async (
    filename: string,
    pgName: string,
    reportType: string,
    periodStr: string,
    metrics: { label: string, value: string | number, valueColor?: string }[],
    headers: string[],
    rows: (string | number)[][]
  ) => {
    const element = document.createElement('div');
    element.style.fontFamily = "'Inter', 'Segoe UI', sans-serif";
    element.style.color = '#333';
    element.style.backgroundColor = '#f8fafc';
    element.style.width = '100%';

    // Header Section (Dark Blue)
    const header = document.createElement('div');
    header.style.backgroundColor = '#1e3a8a';
    header.style.color = '#ffffff';
    header.style.padding = '24px 32px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const headerLeft = document.createElement('div');
    headerLeft.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="${logoBase64 || siteLogo}" alt="Logo" style="width: 32px; height: 32px; object-fit: contain; border-radius: 6px;" />
        <div>
          <h1 style="margin:0; font-size: 24px; font-weight: bold;">${siteName}</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">Powered by Raliven Innovations</p>
        </div>
      </div>
    `;

    header.appendChild(headerLeft);
    element.appendChild(header);

    // Title Section (Light Gray/Blue)
    const titleSection = document.createElement('div');
    titleSection.style.backgroundColor = '#e2e8f0';
    titleSection.style.padding = '24px 32px';
    titleSection.innerHTML = `
      <p style="margin: 0; font-size: 12px; font-weight: bold; color: #64748b; letter-spacing: 1px;">REPORT</p>
      <h2 style="margin: 4px 0 12px 0; font-size: 28px; font-weight: 800; color: #1e293b; text-transform: uppercase;">${reportType} REPORT</h2>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 14px; color: #64748b;">${pgName} &bull; ${reportType} Summary</span>
        <span style="background-color: #1e3a8a; color: white; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: bold;">📅 ${periodStr}</span>
      </div>
    `;
    element.appendChild(titleSection);

    // Main Content wrapper
    const mainContent = document.createElement('div');
    mainContent.style.padding = '32px';

    // Metrics Row
    if (metrics && metrics.length > 0) {
      const metricsRow = document.createElement('div');
      metricsRow.style.display = 'flex';
      metricsRow.style.gap = '16px';
      metricsRow.style.marginBottom = '32px';
      
      metrics.forEach(m => {
        const card = document.createElement('div');
        card.style.flex = '1';
        card.style.backgroundColor = '#ffffff';
        card.style.border = '1px solid #e2e8f0';
        card.style.borderRadius = '8px';
        card.style.padding = '16px';
        card.style.textAlign = 'center';
        
        card.innerHTML = `
          <div style="font-size: 28px; font-weight: 800; color: ${m.valueColor || '#1e3a8a'}; margin-bottom: 4px;">${m.value}</div>
          <div style="font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">${m.label}</div>
        `;
        metricsRow.appendChild(card);
      });
      mainContent.appendChild(metricsRow);
    }

    // Data Table
    const tableWrapper = document.createElement('div');
    tableWrapper.style.backgroundColor = '#ffffff';
    tableWrapper.style.borderRadius = '8px';
    tableWrapper.style.overflow = 'hidden';
    tableWrapper.style.border = '1px solid #e2e8f0';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const thNum = document.createElement('th');
    thNum.innerText = '#';
    thNum.style.backgroundColor = '#1e3a8a';
    thNum.style.color = '#ffffff';
    thNum.style.padding = '12px 16px';
    thNum.style.textAlign = 'left';
    thNum.style.fontWeight = '600';
    thNum.style.fontSize = '11px';
    headerRow.appendChild(thNum);

    headers.forEach(h => {
      const th = document.createElement('th');
      th.innerText = h.toUpperCase();
      th.style.backgroundColor = '#1e3a8a';
      th.style.color = '#ffffff';
      th.style.padding = '12px 16px';
      th.style.textAlign = 'left';
      th.style.fontWeight = '600';
      th.style.fontSize = '11px';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';
      tr.style.pageBreakInside = 'avoid';
      
      const tdNum = document.createElement('td');
      tdNum.innerText = String(idx + 1);
      tdNum.style.padding = '12px 16px';
      tdNum.style.color = '#64748b';
      tr.appendChild(tdNum);

      row.forEach((cell, cellIdx) => {
        const td = document.createElement('td');
        td.style.padding = '12px 16px';
        td.style.color = '#334155';
        td.style.fontWeight = cellIdx === 1 ? '600' : '400';
        
        const cellStr = String(cell ?? '');
        if (cellStr.toUpperCase() === 'ACTIVE') {
          td.innerHTML = `<span style="background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">ACTIVE</span>`;
        } else if (cellStr.toUpperCase() === 'INACTIVE' || cellStr.toUpperCase() === 'VACATED') {
          td.innerHTML = `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${cellStr.toUpperCase()}</span>`;
        } else {
          td.innerText = cellStr;
        }
        
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    mainContent.appendChild(tableWrapper);

    element.appendChild(mainContent);
    
    // Footer Section
    const footerSummary = document.createElement('div');
    footerSummary.style.textAlign = 'right';
    footerSummary.style.padding = '16px 32px';
    footerSummary.style.fontSize = '11px';
    footerSummary.style.color = '#64748b';
    footerSummary.style.fontWeight = 'bold';
    
    let summaryText = '';
    if (metrics && metrics.length > 0) {
      summaryText = metrics.map(m => `${m.value} ${m.label}`).join(' | ');
    }
    footerSummary.innerHTML = `${summaryText}<br/><span style="font-weight:normal; font-size:10px; color:#94a3b8; margin-top:4px; display:block;">Generated on: ${new Date().toLocaleString()} | Powered by Raliven Innovations</span>`;
    element.appendChild(footerSummary);

    const darkFooter = document.createElement('div');
    darkFooter.style.backgroundColor = '#1e3a8a';
    darkFooter.style.color = '#ffffff';
    darkFooter.style.padding = '16px';
    darkFooter.style.textAlign = 'center';
    darkFooter.innerHTML = `
      <p style="margin: 0; font-size: 12px; font-weight: bold;">Raliven Innovations | Hostel Management Platform</p>
    `;
    element.appendChild(darkFooter);

    const opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as const },
      pagebreak:    { mode: ['css', 'legacy'], avoid: 'tr' }
    };
    
    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf().from(element).set(opt).save();
  };

  const handleDownload = async (reportId: string) => {
    if (!ownerId || !selectedProperty) {
      toast.error("Please select a hostel first.");
      return;
    }

    setIsGenerating(reportId);
    const pgName = properties.find(p => p.pg_id === selectedProperty)?.name || 'Hostel';
    const monthName = months[parseInt(selectedMonth)];
    const periodLabel = reportPeriod === 'yearly' ? selectedYear : reportPeriod === 'overall' ? 'Overall' : `${monthName}_${selectedYear}`;
    const filenamePrefix = `${reportId}_${pgName.replace(/[^a-z0-9]/gi, '_')}_${periodLabel}`;
    const finalDownloadFormat = (reportPeriod === 'yearly' || reportPeriod === 'overall') ? 'csv' : downloadFormat;

    try {
      if (reportId === 'tenants') {
        const res = await rpcCall('getTenants', ownerId, selectedProperty);
        const duesRes = await rpcCall('getPendingDues', ownerId, selectedProperty);
        const duesMap = (duesRes.success && duesRes.data) ? duesRes.data.reduce((acc: any, d: any) => {
          acc[d.tenant_id] = (acc[d.tenant_id] || 0) + Number(d.amount);
          return acc;
        }, {}) : {};

        if (res.success && res.data) {
          let finalTenants = res.data;
          if (tenantReportMode === 'custom' && selectedTenantFilter !== 'All') {
            finalTenants = finalTenants.filter((t: any) => t.tenant_id === selectedTenantFilter || t.id === selectedTenantFilter);
          }
          
          const headers = ['Name', 'Phone', 'Room', 'Status', 'Move-in Date', 'Rent Amount', 'Security Deposit', 'Due Amount'];
          const rows = finalTenants.map((t: any) => [
            t.full_name || 'N/A', 
            t.mobile || 'N/A', 
            t.rooms?.room_number || 'N/A', 
            t.is_active ? 'Active' : 'Inactive', 
            t.move_in_date ? new Date(t.move_in_date).toLocaleDateString() : 'N/A',
            t.rent_amount || 0, 
            t.security_deposit || 0,
            duesMap[t.tenant_id] || 0
          ]);
          if (finalDownloadFormat === 'csv') downloadCSV(`${filenamePrefix}.csv`, headers, rows);
          else {
            const active = finalTenants.filter((t: any) => t.is_active).length;
            const inactive = finalTenants.length - active;
            const roomsUsed = new Set(finalTenants.filter((t: any) => t.is_active && t.rooms?.room_number).map((t: any) => t.rooms.room_number)).size;
            const metrics = [
              { label: 'TOTAL TENANTS', value: finalTenants.length, valueColor: '#1e3a8a' },
              { label: 'INACTIVE', value: inactive, valueColor: '#ef4444' },
              { label: 'ACTIVE', value: active, valueColor: '#22c55e' },
              { label: 'ROOMS USED', value: roomsUsed, valueColor: '#eab308' }
            ];
            downloadPDF(`${filenamePrefix}.pdf`, pgName, tenantReportMode === 'custom' && selectedTenantFilter !== 'All' ? 'TENANT SPECIFIC' : 'TENANTS', periodLabel.replace('_', ' '), metrics, headers, rows);
          }
        } else {
          toast.error('Failed to fetch tenants data.');
        }
      } 
      else if (reportId === 'payments') {
        const res = await rpcCall('getPaymentHistory', ownerId, selectedProperty);
        const duesRes = await rpcCall('getPendingDues', ownerId, selectedProperty);
        
        const duesMap = (duesRes.success && duesRes.data) ? duesRes.data.reduce((acc: any, d: any) => {
          acc[d.tenant_id] = (acc[d.tenant_id] || 0) + Number(d.amount);
          return acc;
        }, {}) : {};

        if (res.success && res.data) {
          const headers = ['Tenant Name', 'Receipt No', 'Room', 'Amount', 'Due', 'Method', 'Date', 'Month For', 'Collected By'];
          
          let finalPayments = res.data.filter((p: any) => {
            const d = new Date(p.created_at || Date.now());
            if (reportPeriod === 'monthly') return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
            if (reportPeriod === 'yearly') return d.getFullYear() === parseInt(selectedYear);
            return true;
          });
          
          if (paymentCollectorMode === 'custom' && selectedCollectorFilter !== 'All') {
            finalPayments = finalPayments.filter((p: any) => (p.collected_by_name || p.collectedByName || 'Owner') === selectedCollectorFilter);
          }
          if (paymentTenantMode === 'custom' && paymentsTenantFilter !== 'All') {
            finalPayments = finalPayments.filter((p: any) => p.tenant_id === paymentsTenantFilter);
          }

          const rows = finalPayments
            .sort((a: any, b: any) => new Date(b.created_at || Date.now()).getTime() - new Date(a.created_at || Date.now()).getTime())
            .map((p: any) => [
              p.tenant_name,
              p.payment_id ? p.payment_id.slice(-6).toUpperCase() : 'N/A',
              p.room_number, 
              p.amount,
              duesMap[p.tenant_id] || 0,
              p.method || 'Cash', 
              new Date(p.created_at).toLocaleDateString(), 
              p.month || 'N/A',
              p.collected_by_name || p.collectedByName || 'Owner'
            ]);
          if (rows.length === 0) toast.error('No payments found for this period.');
          else if (finalDownloadFormat === 'csv') downloadCSV(`${filenamePrefix}.csv`, headers, rows);
          else {
            const totalAmount = rows.reduce((sum: number, r: any) => sum + Number(r[3] || 0), 0);
            const metrics = [
              { label: 'TOTAL PAYMENTS', value: rows.length, valueColor: '#1e3a8a' },
              { label: 'TOTAL COLLECTED', value: '₹' + totalAmount.toLocaleString('en-IN'), valueColor: '#22c55e' }
            ];
            downloadPDF(`${filenamePrefix}.pdf`, pgName, 'PAYMENTS', periodLabel.replace('_', ' '), metrics, headers, rows);
          }
        } else {
          toast.error('Failed to fetch payments data.');
        }
      }
      else if (reportId === 'dues') {
        const res = await rpcCall('getPendingDues', ownerId, selectedProperty);
        if (res.success && res.data) {
          const now = Date.now();
          const rowsWithDays = res.data.map((d: any) => {
            const dueDate = new Date(d.created_at);
            const diffTime = now - dueDate.getTime();
            const overdueDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
            return { ...d, overdueDays, due_date_str: dueDate.toLocaleDateString() };
          });
          
          // Sort descending by overdue days
          rowsWithDays.sort((a: any, b: any) => b.overdueDays - a.overdueDays);

          const headers = ['Tenant Name', 'Room', 'Amount Due', 'Due Date', 'Overdue Days'];
          const rows = rowsWithDays.map((d: any) => [
            d.tenant_name, d.room_number, d.amount, 
            d.due_date_str, d.overdueDays
          ]);
          if (downloadFormat === 'csv') downloadCSV(`${filenamePrefix}.csv`, headers, rows);
          else {
            const totalPending = rows.reduce((sum: number, r: any) => sum + Number(r[3] || 0), 0);
            const metrics = [
              { label: 'TENANTS WITH DUES', value: rows.length, valueColor: '#1e3a8a' },
              { label: 'TOTAL PENDING', value: '₹' + totalPending.toLocaleString('en-IN'), valueColor: '#ef4444' }
            ];
            downloadPDF(`${filenamePrefix}.pdf`, pgName, 'DUES', `${monthName} ${selectedYear}`, metrics, headers, rows);
          }
        } else {
          toast.error('Failed to fetch dues data.');
        }
      }
      else if (reportId === 'rooms') {
        const propsRes = await rpcCall('getPropertiesWithRooms', ownerId);
        const tenantsRes = await rpcCall('getTenants', ownerId, selectedProperty);
        if (propsRes.success && propsRes.data && tenantsRes.success && tenantsRes.data) {
          const prop = propsRes.data.find((p: any) => p.pg_id === selectedProperty);
          if (prop && prop.rooms) {
            const tenantsByRoom = tenantsRes.data.reduce((acc: any, t: any) => {
              const isActive = t.is_active === true || t.status === 'active' || t.status === 'Active';
              const roomNumber = t.rooms?.room_number || t.room;
              if (isActive && roomNumber) acc[roomNumber] = (acc[roomNumber] || 0) + 1;
              return acc;
            }, {});
            
            const headers = ['Room Number', 'Floor', 'Sharing (Beds)', 'Occupied Beds', 'Vacant Beds', 'Sharing Price'];
            
            let pricing: any = {};
            if (prop.theme_primary_color) {
              try { pricing = JSON.parse(prop.theme_primary_color); } catch (e) {}
            }

            const sortedRooms = [...prop.rooms].sort((a: any, b: any) => {
              const floorA = parseInt(String(a.floor || '0').replace(/[^0-9]/g, ''), 10) || 0;
              const floorB = parseInt(String(b.floor || '0').replace(/[^0-9]/g, ''), 10) || 0;
              if (floorA !== floorB) return floorA - floorB;
              
              const numA = parseInt(String(a.room_number || a.num || a.id || '').replace(/[^0-9]/g, ''), 10);
              const numB = parseInt(String(b.room_number || b.num || b.id || '').replace(/[^0-9]/g, ''), 10);
              if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
              
              return String(a.room_number || '').localeCompare(String(b.room_number || ''), undefined, { numeric: true, sensitivity: 'base' });
            });

            const rows = sortedRooms.map((r: any) => {
              const occupied = tenantsByRoom[r.room_number] || 0;
              const totalBeds = r.total_beds || r.beds || 1;
              const vacant = Math.max(0, parseInt(totalBeds) - occupied);
              const roomPrice = pricing[totalBeds] || 'N/A';
              
              return [r.room_number || 'N/A', r.floor || 'N/A', totalBeds, occupied, vacant, roomPrice !== 'N/A' ? `₹${roomPrice}` : 'N/A'];
            });
            if (downloadFormat === 'csv') downloadCSV(`${filenamePrefix}.csv`, headers, rows);
            else {
              const totalBeds = rows.reduce((sum: number, r: any) => sum + Number(r[2] || 0), 0);
              const totalOccupied = rows.reduce((sum: number, r: any) => sum + Number(r[3] || 0), 0);
              const totalVacant = rows.reduce((sum: number, r: any) => sum + Number(r[4] || 0), 0);
              const metrics = [
                { label: 'TOTAL ROOMS', value: rows.length, valueColor: '#1e3a8a' },
                { label: 'TOTAL BEDS', value: totalBeds, valueColor: '#64748b' },
                { label: 'OCCUPIED', value: totalOccupied, valueColor: '#22c55e' },
                { label: 'VACANT', value: totalVacant, valueColor: '#eab308' }
              ];
              downloadPDF(`${filenamePrefix}.pdf`, pgName, 'ROOMS', `${monthName} ${selectedYear}`, metrics, headers, rows);
            }
          } else {
            toast.error('No rooms found.');
          }
        } else {
          toast.error('Failed to fetch rooms data.');
        }
      }
      else if (reportId === 'security_deposit') {
        const res = await rpcCall('getTenants', ownerId, selectedProperty);
        if (res.success && res.data) {
          const headers = ['Tenant Name', 'Room', 'Status', 'Security Deposit'];
          const rows = res.data
            .filter((t: any) => parseFloat(t.security_deposit) > 0)
            .map((t: any) => [t.name, t.room, t.status, t.security_deposit]);
          if (downloadFormat === 'csv') downloadCSV(`${filenamePrefix}.csv`, headers, rows);
          else {
            const totalDeposits = rows.reduce((sum: number, r: any) => sum + Number(r[3] || 0), 0);
            const metrics = [
              { label: 'TENANTS WITH DEPOSITS', value: rows.length, valueColor: '#1e3a8a' },
              { label: 'TOTAL COLLECTED', value: '₹' + totalDeposits.toLocaleString('en-IN'), valueColor: '#6366f1' }
            ];
            downloadPDF(`${filenamePrefix}.pdf`, pgName, 'SECURITY DEPOSIT', `${monthName} ${selectedYear}`, metrics, headers, rows);
          }
        } else {
          toast.error('Failed to fetch tenants data for security deposit.');
        }
      }
      else {
        toast.error(`The ${reportId} report requires a data source (e.g. expenses table) which is not yet fully implemented in the backend.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while generating the report.');
    } finally {
      setIsGenerating(null);
    }
  };

  if (!isMounted) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}>
      <div className={styles.pageContainer}>
      {/* Hostel & Format Selection */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <CustomSelect 
            value={selectedProperty}
            onChange={(val) => {
              setSelectedProperty(val);
              localStorage.setItem('activePgId', val);
            }}
            options={properties.map((p: any) => ({
              value: p.pg_id,
              label: p.name
            }))}
            placeholder={properties.length === 0 ? "Loading hostels..." : "Select Hostel"}
          />
        </div>
        <div style={{ width: '130px' }}>
          <CustomSelect 
            value={reportPeriod === 'yearly' || reportPeriod === 'overall' ? 'csv' : downloadFormat}
            onChange={(val) => setDownloadFormat(val as 'csv'|'pdf')}
            disabled={reportPeriod === 'yearly' || reportPeriod === 'overall'}
            options={[
              { value: 'csv', label: 'CSV Excel' },
              { value: 'pdf', label: 'PDF Report' }
            ]}
          />
        </div>
      </div>

      {/* Rectangular Top Bar with Filters */}
      <div className={styles.headerBar}>
        <h2 className={styles.headerTitle}>Select Period</h2>
        <div className={styles.filterControls}>
          <div style={{ width: '140px' }}>
            <CustomSelect
              value={reportPeriod}
              onChange={(val) => setReportPeriod(val as any)}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Full Year' },
                { value: 'overall', label: 'Overall' }
              ]}
            />
          </div>
          
          {reportPeriod === 'monthly' && (
            <div style={{ width: '140px' }}>
              <CustomSelect
                value={String(selectedMonth)}
                onChange={(val) => setSelectedMonth(val)}
                options={months.map((m, idx) => ({ value: String(idx), label: m }))}
              />
            </div>
          )}
          
          {(reportPeriod === 'monthly' || reportPeriod === 'yearly') && (
            <div style={{ width: '110px' }}>
              <CustomSelect
                value={String(selectedYear)}
                onChange={(val) => setSelectedYear(val)}
                options={years.map((y) => ({ value: String(y), label: String(y) }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Reports Grid */}
      <div className={styles.reportsGrid}>
        {reportTypes.map((report, index) => {
          const Icon = report.icon;
          return (
            <motion.div 
              key={report.id}
              className={styles.reportCard}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={styles.reportCardTop}>
                <div className={`${styles.iconContainer} ${report.colorClass}`}>
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div className={styles.reportInfo}>
                  <h3 className={styles.reportTitle}>{report.title}</h3>
                  <p className={styles.reportDesc}>{report.description}</p>
                </div>
              </div>
              
              {report.id === 'tenants' ? (
                <div style={{ marginTop: '12px', marginBottom: '8px', zIndex: 10 }}>
                  <CustomSelect
                    value={tenantReportMode}
                    onChange={(val) => {
                      setTenantReportMode(val as any);
                      if (val === 'all') setSelectedTenantFilter('All');
                    }}
                    options={[
                      { value: 'all', label: 'All Tenants' },
                      { value: 'custom', label: 'Custom Tenant' }
                    ]}
                  />
                  {tenantReportMode === 'custom' && (
                    <div style={{ marginTop: '8px' }}>
                      <CustomSelect 
                        searchable
                        value={selectedTenantFilter}
                        onChange={(val) => setSelectedTenantFilter(val)}
                        options={[
                          { value: 'All', label: 'Select a Tenant', disabled: true },
                          ...tenantsList.map((t: any) => ({
                            value: t.tenant_id || t.id,
                            label: `${t.full_name || t.name || 'Unnamed'} (${t.rooms?.room_number || t.room_number || t.room || 'N/A'})`
                          }))
                        ]}
                        placeholder="Search Tenant..."
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {report.id === 'payments' ? (
                <div style={{ marginTop: '12px', marginBottom: '8px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Tenant Filter */}
                  <div>
                    <CustomSelect
                      value={paymentTenantMode}
                      onChange={(val) => {
                        setPaymentTenantMode(val as any);
                        if (val === 'all') setPaymentsTenantFilter('All');
                      }}
                      options={[
                        { value: 'all', label: 'All Tenants' },
                        { value: 'custom', label: 'Custom Tenant' }
                      ]}
                    />
                    {paymentTenantMode === 'custom' && (
                      <div style={{ marginTop: '8px' }}>
                        <CustomSelect 
                          searchable
                          value={paymentsTenantFilter}
                          onChange={(val) => setPaymentsTenantFilter(val)}
                          options={[
                            { value: 'All', label: 'Select a Tenant', disabled: true },
                            ...tenantsList.map((t: any) => ({
                              value: t.tenant_id || t.id,
                              label: `${t.full_name || t.name || 'Unnamed'} (${t.rooms?.room_number || t.room_number || t.room || 'N/A'})`
                            }))
                          ]}
                          placeholder="Search Tenant..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Collector Filter */}
                  {uniqueCollectors.length > 0 && (
                    <div>
                      <CustomSelect
                        value={paymentCollectorMode}
                        onChange={(val) => {
                          setPaymentCollectorMode(val as any);
                          if (val === 'all') setSelectedCollectorFilter('All');
                        }}
                        options={[
                          { value: 'all', label: 'All Collectors' },
                          { value: 'custom', label: 'Custom Collector' }
                        ]}
                      />
                      {paymentCollectorMode === 'custom' && (
                        <div style={{ marginTop: '8px' }}>
                          <CustomSelect 
                            searchable
                            value={selectedCollectorFilter}
                            onChange={(val) => setSelectedCollectorFilter(val)}
                            options={[
                              { value: 'All', label: 'Select a Collector', disabled: true },
                              ...uniqueCollectors.map((c: any) => ({
                                value: c,
                                label: c
                              }))
                            ]}
                            placeholder="Search Collector..."
                          />
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : null}
              
              {canExportReports && (
                <button 
                  className={styles.downloadBtn}
                  onClick={() => handleDownload(report.id)}
                  disabled={isGenerating === report.id}
                  style={{ opacity: isGenerating === report.id ? 0.7 : 1 }}
                >
                  {isGenerating === report.id ? (
                    <>Generating...</>
                  ) : (
                    <>
                      <Download size={16} />
                      Generate Report
                    </>
                  )}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
      </div>
    </ProtectedRoute>
  );
}
