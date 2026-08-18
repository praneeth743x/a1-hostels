"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getTenants, getProperties } from '@/app/actions/pgowner';
import { getTeamMembersAction } from '@/app/actions/teamActions';
import { useHostel } from '@/context/HostelContext';
import { 
  Folder, FileText, Download, Loader2, Search, Filter, 
  FolderOpen, Eye, X, User, Building, Phone, DoorOpen, 
  Sparkles, CheckCircle2, ShieldAlert, Archive, FileImage, Image as ImageIcon,
  ChevronLeft, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import JSZip from 'jszip';
import styles from './documents.module.css';

export interface DocItem {
  id: string;
  type: string;
  title: string;
  url: string;
  filename: string;
}

export interface FolderItem {
  id: string;
  type: 'tenant' | 'team';
  name: string;
  phone: string;
  room: string;
  pg_name: string;
  pg_id: string;
  status: string;
  avatar?: string | null;
  docs: DocItem[];
}

function extractTenantDocuments(t: any): DocItem[] {
  const docs: DocItem[] = [];

  const addDoc = (id: string, type: string, title: string, urlCandidate?: string | null) => {
    if (!urlCandidate || typeof urlCandidate !== 'string' || !urlCandidate.trim()) return;
    const url = urlCandidate.trim();
    if (docs.some(d => d.url === url)) return;

    let ext = 'jpg';
    if (url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('application/pdf')) ext = 'pdf';
    else if (url.toLowerCase().includes('.png')) ext = 'png';

    const cleanName = (t.full_name || t.name || 'Tenant').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanName}_${id}.${ext}`;

    docs.push({ id, type, title, url, filename });
  };

  // 1. Face Picture / Photo
  const facePic = t.face_picture || t.facePicture || t.photo_url || t.photoUrl || t.avatar || t.documents?.photo || t.documents?.facePicture || t.documents?.photo_url;
  addDoc('face_picture', 'image', 'Face Picture / Photo', facePic);

  // 2. Govt ID Front (Aadhaar / Passport / Voter ID)
  const govtFront = t.govt_id_url || t.govt_id_front || t.documents?.govtFront || t.documents?.govtId || t.documents?.govt_id_url || t.documents?.aadhaar_front || t.documents?.aadhaarFront;
  addDoc('govt_id_front', 'document', 'Govt ID (Front)', govtFront);

  // 3. Govt ID Back
  const govtBack = t.govt_id_back_url || t.govt_id_back || t.documents?.govtBack || t.documents?.govt_id_back_url || t.documents?.aadhaar_back || t.documents?.aadhaarBack;
  addDoc('govt_id_back', 'document', 'Govt ID (Back)', govtBack);

  // 4. College / Work / Employee ID (Front)
  const collegeFront = t.college_id_url || t.college_id || t.work_id_url || t.work_id || t.documents?.collegeFront || t.documents?.collegeId || t.documents?.college_id || t.documents?.empFront || t.documents?.work_id || t.documents?.id_card;
  addDoc('college_id_front', 'document', 'College / Work ID (Front)', collegeFront);

  // 5. College / Work ID (Back)
  const collegeBack = t.documents?.collegeBack || t.documents?.empBack || t.documents?.college_id_back;
  addDoc('college_id_back', 'document', 'College / Work ID (Back)', collegeBack);

  // 6. Rental Agreement
  const agreement = t.agreement_url || t.documents?.agreement || t.documents?.contract;
  addDoc('rental_agreement', 'document', 'Rental Agreement', agreement);

  // 7. Police Verification
  const police = t.police_verification_url || t.documents?.police;
  addDoc('police_verification', 'document', 'Police Verification', police);

  return docs;
}

function extractTeamDocuments(m: any): DocItem[] {
  const docs: DocItem[] = [];

  const addDoc = (id: string, type: string, title: string, urlCandidate?: string | null) => {
    if (!urlCandidate || typeof urlCandidate !== 'string' || !urlCandidate.trim()) return;
    const url = urlCandidate.trim();
    if (docs.some(d => d.url === url)) return;

    let ext = 'jpg';
    if (url.toLowerCase().includes('.pdf')) ext = 'pdf';
    else if (url.toLowerCase().includes('.png')) ext = 'png';

    const cleanName = (m.full_name || m.name || 'Staff').replace(/[^a-zA-Z0-9_-]/g, '_');
    docs.push({ id, type, title, url, filename: `${cleanName}_${id}.${ext}` });
  };

  addDoc('profile_photo', 'image', 'Profile Photo', m.photo_url || m.avatar);
  addDoc('govt_id_front', 'document', 'Govt ID (Front)', m.govt_id_url);
  addDoc('govt_id_back', 'document', 'Govt ID (Back)', m.govt_id_back_url);

  return docs;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { properties: contextProps } = useHostel();

  const [loading, setLoading] = useState(true);
  const [selectedHostel, setSelectedHostel] = useState<string>('all');

  const [tenants, setTenants] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Search & Status Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Notice Period' | 'Paused' | 'Vacated' | 'Team'>('ALL');

  // Currently opened tenant folder (null = root directory list view)
  const [openedFolder, setOpenedFolder] = useState<FolderItem | null>(null);

  // Lightbox Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch Team Members & Tenants in parallel to reduce load time
          const [teamRes, tenantsRes] = await Promise.all([
            getTeamMembersAction(user.uid).catch(e => ({ success: false, data: [] })),
            getTenants(user.uid, 'all').catch(e => ({ success: false, data: [] }))
          ]);

          if (teamRes.success && teamRes.data) {
            setTeamMembers(teamRes.data);
          }
          
          if (tenantsRes.success && tenantsRes.data) {
            setTenants(tenantsRes.data);
          }
        } catch (error) {
          console.error("Error fetching file manager data", error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Combine and format folders list
  const allFolders: FolderItem[] = useMemo(() => {
    const list: FolderItem[] = [];

    // Add Tenants
    tenants.forEach(t => {
      const statusRaw = t.status || (t.is_active === false ? 'Vacated' : 'Active');
      let statusNorm = 'Active';
      if (statusRaw === 'Notice Period' || statusRaw === 'notice_period') statusNorm = 'Notice Period';
      else if (statusRaw === 'Paused' || statusRaw === 'PAUSED') statusNorm = 'Paused';
      else if (statusRaw === 'Vacated' || statusRaw === 'VACATED' || t.is_active === false) statusNorm = 'Vacated';

      list.push({
        id: t.id || t.tenant_id || `tenant_${t.phone}`,
        type: 'tenant',
        name: t.full_name || t.name || 'Tenant',
        phone: t.phone || t.mobile || t.phone_number || 'N/A',
        room: t.room_number || t.room || t.rooms?.room_number || 'N/A',
        pg_name: t.pg_name || 'Hostel',
        pg_id: t.pg_id || '',
        status: statusNorm,
        avatar: t.face_picture || t.facePicture || t.documents?.photo || t.documents?.facePicture || t.photo_url || t.photoUrl || t.avatar,
        docs: extractTenantDocuments(t)
      });
    });

    // Add Team Members
    teamMembers.forEach(m => {
      list.push({
        id: m.id || `team_${m.email}`,
        type: 'team',
        name: m.full_name || 'Staff Member',
        phone: m.phone || 'N/A',
        room: m.role || 'Staff',
        pg_name: m.pg_name || 'All Hostels',
        pg_id: m.pg_id || 'all',
        status: 'Team',
        avatar: m.photo_url || m.avatar,
        docs: extractTeamDocuments(m)
      });
    });

    return list;
  }, [tenants, teamMembers]);

  // Filtered Folders based on Search & Hostel & Status Pills
  const filteredFolders = useMemo(() => {
    return allFolders.filter(folder => {
      // 1. Hostel Filter
      if (selectedHostel !== 'all' && folder.pg_id && folder.pg_id !== 'all' && folder.pg_id !== selectedHostel) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Team' && folder.type !== 'team') return false;
        if (statusFilter !== 'Team' && folder.status !== statusFilter) return false;
      }

      // 3. Search Query (Name, Phone, Room Number, Hostel)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = folder.name.toLowerCase().includes(q);
        const matchesPhone = folder.phone.toLowerCase().includes(q);
        const matchesRoom = folder.room.toLowerCase().includes(q);
        const matchesPg = folder.pg_name.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesRoom && !matchesPg) {
          return false;
        }
      }

      return true;
    });
  }, [allFolders, selectedHostel, statusFilter, searchQuery]);

  // ZIP Download Generator
  const downloadFolderAsZip = async (folder: FolderItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!folder.docs || folder.docs.length === 0) {
      toast.error(`No documents uploaded for ${folder.name}`);
      return;
    }

    setDownloadingZipId(folder.id);
    const toastId = toast.loading(`Creating ZIP for ${folder.name}...`);
    try {
      const zip = new JSZip();
      const cleanFolderName = folder.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const zipFolder = zip.folder(`${cleanFolderName}_Documents`);

      for (let i = 0; i < folder.docs.length; i++) {
        const docItem = folder.docs[i];
        try {
          const res = await fetch(docItem.url);
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          const blob = await res.blob();

          let ext = 'jpg';
          if (blob.type.includes('pdf') || docItem.url.toLowerCase().includes('.pdf')) ext = 'pdf';
          else if (blob.type.includes('png') || docItem.url.toLowerCase().includes('.png')) ext = 'png';
          else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = 'jpg';

          const filename = `${docItem.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
          zipFolder?.file(filename, blob);
        } catch (fetchErr) {
          console.warn(`Direct fetch failed for ${docItem.url}:`, fetchErr);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(zipBlob);
      downloadLink.download = `${cleanFolderName}_Documents.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      toast.success(`Downloaded ${cleanFolderName}_Documents.zip`, { id: toastId });
    } catch (err: any) {
      console.error('ZIP Error:', err);
      toast.error(`Failed to generate ZIP: ${err.message || 'Error'}`, { id: toastId });
    } finally {
      setDownloadingZipId(null);
    }
  };

  const getFolderBadgeColor = (status: string) => {
    switch (status) {
      case 'Active': return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
      case 'Notice Period': return { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' };
      case 'Paused': return { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
      case 'Vacated': return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      case 'Team': return { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' };
      default: return { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' };
    }
  };

  return (
    <div className={styles.container}>
      
      {/* ── HEADER BAR ── */}
      <div className={styles.headerBar}>
        <div className={styles.headerTop}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconBox}>
              <Folder size={24} />
            </div>
            <div>
              <h1 className={styles.mainTitle}>Tenant Document Vault</h1>
              <div className={styles.subTitle}>
                File Manager directory view for tenant face pictures, govt IDs, & college IDs
              </div>
            </div>
          </div>

          <select 
            className={styles.hostelSelect}
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
          >
            <option value="all">🏢 All Hostels</option>
            {contextProps && contextProps.map(p => (
              <option key={p.pg_id || p.id} value={p.pg_id || p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* CONTROLS (SEARCH BAR + STATUS FILTER PILLS) */}
        <div className={styles.controlsRow}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search tenant name, room number, or phone..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterPills}>
            {[
              { id: 'ALL', label: 'All Folders' },
              { id: 'Active', label: '🟢 Active' },
              { id: 'Notice Period', label: '🟣 Notice Period' },
              { id: 'Paused', label: '🟡 Paused' },
              { id: 'Vacated', label: '⚪ Vacated' },
              { id: 'Team', label: '👥 Staff' }
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id as any)}
                className={`${styles.filterPill} ${statusFilter === pill.id ? styles.filterPillActive : ''}`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BREADCRUMB BAR (MATCHING ATTACHED IMAGE 1) ── */}
      {openedFolder && (
        <div className={styles.modernFolderHeader}>
          <div className={styles.folderHeaderTop}>
            <button className={styles.backBtnModern} onClick={() => setOpenedFolder(null)}>
              <ArrowLeft size={16} /> Back to Folders
            </button>

            <button
              onClick={() => downloadFolderAsZip(openedFolder)}
              disabled={downloadingZipId === openedFolder.id}
              className={styles.tableZipBtn}
            >
              {downloadingZipId === openedFolder.id ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Archive size={14} />
              )}
              Download ZIP
            </button>
          </div>

          <div className={styles.folderHeaderBottom}>
            <h2 className={styles.folderTitleLarge}>
              <Folder size={26} color="#D97706" fill="#D97706" />
              {openedFolder.name}
            </h2>
            <span className={styles.statusTag} style={getFolderBadgeColor(openedFolder.status)}>
              {openedFolder.status}
            </span>
          </div>
        </div>
      )}

      {/* ── MAIN DIRECTORY TABLE VIEW (MATCHING ATTACHED IMAGE 1 EXACTLY) ── */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748B', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <Loader2 className="animate-spin" size={36} color="#4F46E5" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Loading Tenant Documents Directory...</div>
        </div>
      ) : !openedFolder ? (
        /* LEVEL 1: ROOT FOLDERS DIRECTORY TABLE LIST */
        filteredFolders.length === 0 ? (
          <div className={styles.emptyFolderState} style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <Folder size={54} color="#CBD5E1" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>No Tenant Folders Found</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '6px' }}>
              No tenants or staff members matched your current search or filter.
            </p>
          </div>
        ) : (
          <div className={styles.fileTableContainer}>
            <table className={styles.fileTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Room & Hostel</th>
                  <th>Status</th>
                  <th>Files Count</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFolders.map(folder => {
                  const badgeStyle = getFolderBadgeColor(folder.status);
                  return (
                    <tr key={folder.id} style={{ cursor: 'pointer' }} onClick={() => setOpenedFolder(folder)}>
                      <td>
                        <div className={styles.fileNameCell}>
                          <div className={styles.iconBoxFolder}>
                            <Folder size={20} fill="#D97706" color="#D97706" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>{folder.name}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>📞 {folder.phone}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                          {folder.type === 'team' ? folder.room : `Room ${folder.room}`}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{folder.pg_name}</div>
                      </td>

                      <td>
                        <span className={styles.statusTag} style={badgeStyle}>
                          {folder.status}
                        </span>
                      </td>

                      <td>
                        <strong style={{ color: folder.docs.length > 0 ? '#4F46E5' : '#94A3B8', fontSize: '0.88rem' }}>
                          {folder.docs.length} {folder.docs.length === 1 ? 'file' : 'files'}
                        </strong>
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className={styles.tableActionBtn}
                          onClick={() => setOpenedFolder(folder)}
                        >
                          <FolderOpen size={14} /> Open
                        </button>

                        <button 
                          className={styles.tableZipBtn}
                          disabled={downloadingZipId === folder.id}
                          onClick={(e) => downloadFolderAsZip(folder, e)}
                        >
                          {downloadingZipId === folder.id ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Archive size={14} />
                          )}
                          ZIP
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* LEVEL 2: INSIDE OPENED TENANT FOLDER FILES DIRECTORY TABLE */
        <div className={styles.modernFileGrid}>
          {openedFolder.docs.length === 0 ? (
            <div className={styles.emptyFolderState} style={{ gridColumn: '1 / -1' }}>
              <ShieldAlert size={48} color="#CBD5E1" style={{ margin: '0 auto 14px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>No Uploaded Documents</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '6px' }}>
                This tenant folder currently has no uploaded face picture, govt ID, or college ID.
              </p>
            </div>
          ) : (
            openedFolder.docs.map((docItem) => {
              const isPdf = docItem.url.toLowerCase().includes('.pdf') || docItem.filename.toLowerCase().endsWith('.pdf');
              return (
                <div key={docItem.id} className={styles.modernFileCard}>
                  <div className={styles.modernFileCardHeader}>
                    <div className={`${styles.modernFileIconBox} ${isPdf ? styles.pdfType : styles.imageType}`}>
                      {isPdf ? <FileText size={24} /> : <ImageIcon size={24} />}
                    </div>
                    <div className={styles.modernFileInfo}>
                      <div className={styles.modernFileTitle} title={docItem.title}>{docItem.title}</div>
                      <div className={styles.modernFileSubtitle} title={docItem.filename}>{docItem.filename}</div>
                    </div>
                  </div>

                  <div className={styles.modernFileMeta}>
                    <div className={`${styles.modernFileTypeBadge} ${isPdf ? styles.pdfBadge : styles.imageBadge}`}>
                      {isPdf ? 'PDF Document' : 'Image (JPEG/PNG)'}
                    </div>

                    <div className={styles.modernFileActions}>
                      <button 
                        className={styles.modernActionBtn}
                        title="Preview Document"
                        onClick={() => {
                          if (!isPdf) {
                            setPreviewImage({ url: docItem.url, title: docItem.title });
                          } else {
                            window.open(docItem.url, '_blank');
                          }
                        }}
                      >
                        <Eye size={16} />
                      </button>

                      <a 
                        href={docItem.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        download={docItem.filename}
                        className={`${styles.modernActionBtn} ${styles.primary}`}
                        title="Download Document"
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── LIGHTBOX IMAGE PREVIEW MODAL ── */}
      {previewImage && (
        <div className={styles.lightboxOverlay} onClick={() => setPreviewImage(null)}>
          <div style={{ position: 'relative', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewImage(null)}
              style={{ position: 'absolute', top: '-14px', right: '-14px', background: '#ffffff', color: '#000000', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10 }}
            >
              <X size={20} />
            </button>

            <img src={previewImage.url} alt={previewImage.title} className={styles.lightboxImg} />
            
            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', marginTop: '12px' }}>
              {previewImage.title}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
