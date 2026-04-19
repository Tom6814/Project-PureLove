import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Check, X, Loader2, BookOpen, Trash2, LayoutDashboard, Users, BookHeart, AlertCircle } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { getValidImageUrl, cn } from '../lib/utils';
import { useSettings } from '../hooks/useSettings';

export default function AdminPage() {
  const { isAdmin, isReviewer } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'reviewers' | 'catalog'>('overview');
  const [pending, setPending] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  
  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalApproved: 0,
    totalPending: 0
  });

  useEffect(() => {
    const q = query(
      collection(db, 'mangas'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPending(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'mangas');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'reviewers' || activeTab === 'overview') {
      if (isAdmin) {
        if(activeTab === 'reviewers') setLoading(true);
        const uq = query(collection(db, 'users'));
        const unsubscribeUsers = onSnapshot(uq, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsers(data);
          setStats(s => ({...s, totalUsers: snapshot.size}));
          if(activeTab === 'reviewers') setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
          if(activeTab === 'reviewers') setLoading(false);
        });
        return () => unsubscribeUsers();
      }
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'catalog' || activeTab === 'overview') {
      if(activeTab === 'catalog') setLoading(true);
      const q = query(collection(db, 'mangas'), where('status', '==', 'approved'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCatalog(data);
        setStats(s => ({...s, totalApproved: snapshot.size}));
        if(activeTab === 'catalog') setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'mangas');
        if(activeTab === 'catalog') setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  useEffect(() => {
    setStats(s => ({...s, totalPending: pending.length}));
  }, [pending]);

  const handleUpdateStatus = async (mangaId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateDoc(doc(db, 'mangas', mangaId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mangas/${mangaId}`);
    }
  };

  const handleToggleReviewer = async (userId: string, currentRole: string) => {
    if (!isAdmin) return;
    try {
      const newRole = currentRole === 'reviewer' ? 'user' : 'reviewer';
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-theme-accent" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[32px] font-light text-theme-ink tracking-tight mb-2">Admin Dashboard</h1>
        <p className="text-[13px] text-theme-muted">Manage pending manga submissions {isAdmin && 'and admin roles'}.</p>
      </div>

      {isAdmin && (
        <div className="flex border-b border-[#eee] mb-6 space-x-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 text-[14px] transition-colors border-b-2 ${activeTab === 'overview' ? 'border-theme-accent text-theme-ink font-medium' : 'border-transparent text-theme-muted hover:text-theme-ink'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`pb-2 text-[14px] transition-colors border-b-2 ${activeTab === 'submissions' ? 'border-theme-accent text-theme-ink font-medium' : 'border-transparent text-theme-muted hover:text-theme-ink'}`}
          >
            Submissions
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-2 text-[14px] transition-colors border-b-2 ${activeTab === 'catalog' ? 'border-theme-accent text-theme-ink font-medium' : 'border-transparent text-theme-muted hover:text-theme-ink'}`}
          >
            Manage Catalog
          </button>
          <button
            onClick={() => setActiveTab('reviewers')}
            className={`pb-2 text-[14px] transition-colors border-b-2 ${activeTab === 'reviewers' ? 'border-theme-accent text-theme-ink font-medium' : 'border-transparent text-theme-muted hover:text-theme-ink'}`}
          >
            Reviewers & Roles
          </button>
        </div>
      )}

      {activeTab === 'overview' && isAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[12px] shadow-sm border border-[#eee] flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                 <Users className="w-6 h-6" />
               </div>
               <div>
                 <div className="text-[24px] font-medium text-theme-ink">{stats.totalUsers}</div>
                 <div className="text-[12px] text-theme-muted uppercase tracking-wider">Registered Users</div>
               </div>
            </div>
            
            <div className="bg-white p-6 rounded-[12px] shadow-sm border border-[#eee] flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                 <BookHeart className="w-6 h-6" />
               </div>
               <div>
                 <div className="text-[24px] font-medium text-theme-ink">{stats.totalApproved}</div>
                 <div className="text-[12px] text-theme-muted uppercase tracking-wider">Approved Mangas</div>
               </div>
            </div>

            <div className="bg-white p-6 rounded-[12px] shadow-sm border border-[#eee] flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors" onClick={() => setActiveTab('submissions')}>
               <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                 <AlertCircle className="w-6 h-6" />
               </div>
               <div>
                 <div className="text-[24px] font-medium text-theme-ink">{stats.totalPending}</div>
                 <div className="text-[12px] text-theme-muted uppercase tracking-wider">Pending Review</div>
               </div>
            </div>
          </div>
          
          <div className="bg-theme-main rounded-[12px] p-8 border border-[#eee] text-center">
             <LayoutDashboard className="w-10 h-10 text-theme-muted mx-auto mb-4 opacity-50" />
             <h3 className="text-theme-ink font-medium mb-2">Welcome to your Dashboard</h3>
             <p className="text-theme-muted text-[13px] max-w-md mx-auto leading-relaxed mb-6">
               As an administrator, you have full control over the platform's content and personnel. Keep the environment clean and pure by reviewing submissions carefully.
             </p>

             <div className="max-w-md mx-auto bg-white p-4 rounded-lg border border-[#eee] text-left">
               <div className="flex items-center justify-between">
                 <div>
                   <h4 className="text-[14px] font-medium text-theme-ink mb-1">R18 封面模糊</h4>
                   <p className="text-[12px] text-theme-muted">开启后，用户在提交时可勾选 R18 选项。勾选的作品在首页列表会模糊显示封面，详情页需点击后才可查看。</p>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer ml-4">
                   <input 
                     type="checkbox" 
                     className="sr-only peer" 
                     checked={settings.enableR18Blur}
                     onChange={(e) => updateSettings({ enableR18Blur: e.target.checked })}
                   />
                   <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
                 </label>
               </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="bg-white rounded-[12px] shadow-theme-card border border-[#eee] overflow-hidden">
        {pending.length === 0 ? (
          <div className="p-12 text-center text-theme-muted text-[13px]">
            No pending submissions right now.
          </div>
        ) : (
          <ul className="divide-y divide-[#eee]">
            {pending.map((manga) => (
              <li key={manga.id} className="p-6 flex flex-col md:flex-row gap-6 hover:bg-theme-main transition-colors">
                <div className="relative w-[100px] h-[150px] flex-shrink-0">
                  <img 
                    src={getValidImageUrl(manga.coverUrl)} 
                    alt="" 
                    className={cn(
                      "w-full h-full object-cover rounded-md border border-[#eee]",
                      settings.enableR18Blur && manga.isR18 ? "blur-md" : ""
                    )}
                    referrerPolicy="no-referrer"
                  />
                  {settings.enableR18Blur && manga.isR18 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-md">
                      <span className="bg-red-500/80 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">R18</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-[15px] leading-tight text-theme-ink">{manga.title}</h3>
                  <p className="text-[12px] text-theme-accent font-mono bg-theme-bg inline-block px-2 py-1 rounded border border-[#eee]">JM ID: {manga.jmId}</p>
                  <p className="text-[12px] text-theme-muted line-clamp-2">{manga.description}</p>
                  
                  <div className="text-[11px] text-[#aaa] mt-2">
                    推荐者: {manga.submittedByName || manga.submittedBy || 'Unknown'}
                  </div>
                </div>
                
                <div className="flex bg-theme-bg p-2 rounded-lg self-start gap-2 border border-[#eee]">
                  <button 
                    onClick={() => handleUpdateStatus(manga.id, 'approved')}
                    className="p-1.5 text-green-600 hover:bg-white rounded transition-colors group flex items-center justify-center font-medium shadow-sm border border-transparent hover:border-[#eee]"
                    title="Approve"
                  >
                    <Check className="w-4 h-4 md:mr-1.5" />
                    <span className="hidden md:block text-[12px]">Approve</span>
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(manga.id, 'rejected')}
                    className="p-1.5 text-red-600 hover:bg-white rounded transition-colors group flex items-center justify-center font-medium shadow-sm border border-transparent hover:border-[#eee]"
                    title="Reject"
                  >
                    <X className="w-4 h-4 md:mr-1.5" />
                    <span className="hidden md:block text-[12px]">Reject</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {activeTab === 'catalog' && isAdmin && (
        <div className="bg-white rounded-[12px] shadow-theme-card border border-[#eee] overflow-hidden">
        {catalog.length === 0 ? (
          <div className="p-12 text-center text-theme-muted text-[13px]">
            No approved mangas in the catalog yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#eee]">
            {catalog.map((manga) => (
              <li key={manga.id} className="p-6 flex flex-col md:flex-row gap-6 hover:bg-theme-main transition-colors">
                <div className="relative w-[80px] h-[120px] flex-shrink-0">
                  <img 
                    src={getValidImageUrl(manga.coverUrl)} 
                    alt="" 
                    className={cn(
                      "w-full h-full object-cover rounded-md border border-[#eee]",
                      settings.enableR18Blur && manga.isR18 ? "blur-md" : ""
                    )}
                    referrerPolicy="no-referrer"
                  />
                  {settings.enableR18Blur && manga.isR18 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-md">
                      <span className="bg-red-500/80 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">R18</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-[15px] leading-tight text-theme-ink">{manga.title}</h3>
                  <p className="text-[12px] text-theme-accent font-mono bg-theme-bg inline-block px-2 py-1 rounded border border-[#eee]">JM ID: {manga.jmId}</p>
                  
                  <div className="text-[11px] text-[#aaa] mt-2">
                    Published. 
                  </div>
                </div>
                
                <div className="flex bg-theme-bg p-2 rounded-lg self-start gap-2 border border-[#eee]">
                  <button 
                    onClick={() => {
                        if(confirm('Are you sure you want to unpublish this manga? It will return to pending queue.')) {
                            handleUpdateStatus(manga.id, 'pending');
                        }
                    }}
                    className="p-1.5 text-orange-600 hover:bg-white rounded transition-colors group flex items-center justify-center font-medium shadow-sm border border-transparent hover:border-[#eee]"
                    title="Unpublish"
                  >
                    <BookOpen className="w-4 h-4 md:mr-1.5" />
                    <span className="hidden md:block text-[12px]">Unpublish</span>
                  </button>
                  <button 
                    onClick={() => {
                        if(confirm('Are you sure you want to reject this manga? It will be hidden from everyone.')) {
                            handleUpdateStatus(manga.id, 'rejected');
                        }
                    }}
                    className="p-1.5 text-red-600 hover:bg-white rounded transition-colors group flex items-center justify-center font-medium shadow-sm border border-transparent hover:border-[#eee]"
                    title="Remove completely"
                  >
                    <Trash2 className="w-4 h-4 md:mr-1.5" />
                    <span className="hidden md:block text-[12px]">Remove</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {activeTab === 'reviewers' && isAdmin && (
        <div className="bg-white rounded-[12px] shadow-theme-card border border-[#eee] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-main border-b border-[#eee] text-[12px] text-theme-muted uppercase tracking-wider">
                <th className="p-4 font-medium">User</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-theme-main/50 transition-colors">
                  <td className="p-4 text-[13px] text-theme-ink flex items-center gap-3">
                    <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} alt="" className="w-8 h-8 rounded-full border border-[#eee]" referrerPolicy="no-referrer" />
                    {u.displayName || 'Anonymous'}
                  </td>
                  <td className="p-4 text-[13px] text-theme-muted">{u.email}</td>
                  <td className="p-4 text-[12px]">
                    <span className={`px-2 py-0.5 rounded-full border ${u.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' : u.role === 'reviewer' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleToggleReviewer(u.id, u.role)}
                        className={`text-[12px] px-3 py-1.5 rounded transition-colors border ${u.role === 'reviewer' ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                      >
                        {u.role === 'reviewer' ? 'Revoke Reviewer' : 'Make Reviewer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
