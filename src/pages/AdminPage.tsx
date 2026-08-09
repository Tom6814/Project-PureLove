import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, mapMangaRow, mapProfileRow, subscribeToTable } from '../lib/supabase';
import { Check, X, Loader2, BookOpen, Trash2, LayoutDashboard, Users, BookHeart, AlertCircle, ShieldAlert, Plus, Minus } from 'lucide-react';
import { handleSupabaseError, OperationType } from '../lib/supabase-errors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import MangaCover from '../components/MangaCover';
import { getValidImageUrl } from '../lib/utils';
import { findDuplicates, type DuplicateMatch } from '../lib/duplicates';
import { detectSubmissionSensitive, fieldLabel } from '../lib/sensitiveWords';

export default function AdminPage() {
  const { isAdmin, isReviewer, isRoot } = useAuth();
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

  // 查重：每条待审核本子 vs 已审核库（approved），找出可能撞车的本子
  const duplicateMap = useMemo(() => {
    const map: Record<string, DuplicateMatch[]> = {};
    for (const p of pending) {
      map[p.id] = findDuplicates(p, catalog);
    }
    return map;
  }, [pending, catalog]);

  // 敏感词检测：每条待审核本子的信息中命中哪些敏感字段
  const sensitiveMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof detectSubmissionSensitive>> = {};
    for (const p of pending) {
      map[p.id] = detectSubmissionSensitive(
        { title: p.title, description: p.description, review: p.review, authors: p.authors, tags: p.tags },
        {
          general: settings.sensitiveWords,
          review: settings.sensitiveWordsReview,
          authors: settings.sensitiveWordsAuthors,
        }
      );
    }
    return map;
  }, [pending, settings.sensitiveWords, settings.sensitiveWordsReview, settings.sensitiveWordsAuthors]);

  // 敏感词管理：三个分类（通用/推荐语/作者）各自的输入
  const [newWord, setNewWord] = useState('');
  const [newWordCategory, setNewWordCategory] = useState<'general' | 'review' | 'authors'>('general');

  const wordLists: Record<'general' | 'review' | 'authors', string[]> = {
    general: settings.sensitiveWords,
    review: settings.sensitiveWordsReview,
    authors: settings.sensitiveWordsAuthors,
  };

  const addSensitiveWord = (category: 'general' | 'review' | 'authors' = newWordCategory) => {
    const word = newWord.trim();
    if (!word) return;
    const list = wordLists[category];
    if (list.includes(word)) {
      setNewWord('');
      return;
    }
    if (category === 'general') updateSettings({ sensitiveWords: [...list, word] });
    else if (category === 'review') updateSettings({ sensitiveWordsReview: [...list, word] });
    else updateSettings({ sensitiveWordsAuthors: [...list, word] });
    setNewWord('');
  };

  const removeSensitiveWord = (category: 'general' | 'review' | 'authors', word: string) => {
    const list = wordLists[category].filter((w) => w !== word);
    if (category === 'general') updateSettings({ sensitiveWords: list });
    else if (category === 'review') updateSettings({ sensitiveWordsReview: list });
    else updateSettings({ sensitiveWordsAuthors: list });
  };

  // R18 模糊示例：取库内第一本有封面的已审核本子作为示例图
  const sampleCover = catalog.find((m) => m.coverUrl)?.coverUrl ?? '';
  // 占位示例（库为空时）：渐变 + 示例文字
  const samplePlaceholder =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="208"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6e0"/><stop offset="1" stop-color="#ff9db8"/></linearGradient></defs><rect width="144" height="208" fill="url(#g)"/><text x="72" y="104" fill="#ffffff" font-size="22" font-family="sans-serif" text-anchor="middle" font-weight="bold">示例</text></svg>`
    );

  // 撞车级别对应颜色
  const levelStyles: Record<DuplicateMatch['level'], string> = {
    high: 'bg-red-50 border-red-200 text-red-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    low: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };

  useEffect(() => {
    let active = true;

    const fetchPending = async () => {
      const { data, error } = await supabase
        .from('mangas')
        .select('*')
        .eq('status', 'pending');
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'mangas');
        return;
      }
      if (active) {
        setPending((data ?? []).map(mapMangaRow));
        setLoading(false);
      }
    };

    fetchPending();
    const unsubscribe = subscribeToTable('mangas', fetchPending);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'reviewers' || activeTab === 'overview') {
      if (isAdmin) {
        if(activeTab === 'reviewers') setLoading(true);
        let active = true;
        const fetchUsers = async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) {
            handleSupabaseError(error, OperationType.LIST, 'users');
            if(activeTab === 'reviewers') setLoading(false);
            return;
          }
          if (active) {
            setUsers((data ?? []).map(mapProfileRow));
            setStats(s => ({...s, totalUsers: data?.length ?? 0}));
            if(activeTab === 'reviewers') setLoading(false);
          }
        };
        fetchUsers();
        const unsubscribe = subscribeToTable('profiles', fetchUsers);
        return () => {
          active = false;
          unsubscribe();
        };
      }
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    let active = true;
    // 常驻加载已审核库（供查重比对 + catalog/overview 统计）
    const fetchCatalog = async () => {
      if (activeTab === 'catalog') setLoading(true);
      const { data, error } = await supabase
        .from('mangas')
        .select('*')
        .eq('status', 'approved');
      if (error) {
        handleSupabaseError(error, OperationType.LIST, 'mangas');
        if (activeTab === 'catalog') setLoading(false);
        return;
      }
      if (active) {
        setCatalog((data ?? []).map(mapMangaRow));
        setStats(s => ({...s, totalApproved: data?.length ?? 0}));
        if (activeTab === 'catalog') setLoading(false);
      }
    };
    fetchCatalog();
    const unsubscribe = subscribeToTable('mangas', fetchCatalog);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setStats(s => ({...s, totalPending: pending.length}));
  }, [pending]);

  const handleUpdateStatus = async (mangaId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      const { error } = await supabase
        .from('mangas')
        .update({ status })
        .eq('id', mangaId);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, `mangas/${mangaId}`);
    }
  };

  const handleSetR18 = async (mangaId: string, isR18: boolean) => {
    try {
      const { error } = await supabase
        .from('mangas')
        .update({ is_r18: isR18 })
        .eq('id', mangaId);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, `mangas/${mangaId}`);
    }
  };

  const handleSetRole = async (userId: string, role: 'admin' | 'reviewer' | 'user') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, `users/${userId}`);
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
                     checked={!!settings.enableR18Blur}
                     onChange={(e) => updateSettings({ enableR18Blur: e.target.checked })}
                   />
                   <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent pointer-events-none"></div>
                 </label>
               </div>

               {/* 模糊强度调节 + 示例预览 */}
               <div className="mt-4 border-t border-[#eee] pt-4">
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-[12px] font-medium text-theme-ink">模糊强度</span>
                   <span className="text-[12px] font-mono text-theme-accent bg-theme-bg px-2 py-0.5 rounded border border-[#eee]">
                     {settings.r18BlurAmount}px
                   </span>
                 </div>
                 <input
                   type="range"
                   min={0}
                   max={30}
                   step={1}
                   value={settings.r18BlurAmount}
                   onChange={(e) => updateSettings({ r18BlurAmount: Number(e.target.value) })}
                   className="w-full accent-[#d9a29a]"
                   disabled={!settings.enableR18Blur}
                 />
                 <div className="flex justify-between text-[10px] text-theme-muted mt-0.5">
                   <span>0px 清晰</span>
                   <span>30px 最强</span>
                 </div>

                 {/* 示例：原图 vs 当前模糊强度 */}
                 <div className="mt-4 flex items-center gap-4">
                   <div className="text-center">
                     <div className="w-[72px] h-[104px] rounded overflow-hidden border border-[#eee] bg-[#e5e5e5]">
                       <img
                         src={sampleCover ? getValidImageUrl(sampleCover) : samplePlaceholder}
                         alt="示例-原图"
                         className="w-full h-full object-cover"
                         referrerPolicy="no-referrer"
                       />
                     </div>
                     <div className="text-[10px] text-theme-muted mt-1">原图</div>
                   </div>
                   <span className="text-theme-muted text-[16px]">→</span>
                   <div className="text-center">
                     <div className="w-[72px] h-[104px] rounded overflow-hidden border border-[#eee] bg-[#e5e5e5]">
                       <img
                         src={sampleCover ? getValidImageUrl(sampleCover) : samplePlaceholder}
                         alt="示例-模糊效果"
                         className="w-full h-full object-cover"
                         style={{ filter: `blur(${settings.r18BlurAmount}px)` }}
                         referrerPolicy="no-referrer"
                       />
                     </div>
                     <div className="text-[10px] text-theme-muted mt-1">当前效果</div>
                   </div>
                 </div>
                 <p className="text-[11px] text-theme-muted mt-2">
                   {settings.enableR18Blur
                     ? '所有 R18 封面将按此强度模糊。'
                     : '当前未开启 R18 模糊，调整不会生效。'}
                 </p>
               </div>
             </div>

             {/* 敏感词管理（分类：通用/推荐语/作者） */}
              <div className="max-w-md mx-auto bg-white p-4 rounded-lg border border-[#eee] text-left">
                <h4 className="text-[14px] font-medium text-theme-ink mb-1">敏感词过滤</h4>
                <p className="text-[12px] text-theme-muted mb-3">
                  用户提交的本子信息命中敏感词时，需二次确认才能提交；管理员审核界面会显示警告。不同分类的敏感词分别检测对应字段。
                </p>

                {(
                  [
                    { key: 'general', label: '通用（标题/简介/标签）', desc: '' },
                    { key: 'review', label: '推荐语专用', desc: '仅检测"阅读感想 / 推荐语"字段' },
                    { key: 'authors', label: '作者专用', desc: '仅检测"作者"字段' },
                  ] as const
                ).map((cat) => (
                  <div key={cat.key} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-semibold text-theme-ink">{cat.label}</span>
                      {cat.desc && <span className="text-[10px] text-theme-muted">{cat.desc}</span>}
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newWordCategory === cat.key ? newWord : ''}
                        onChange={(e) => { setNewWordCategory(cat.key); setNewWord(e.target.value); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') addSensitiveWord(cat.key); }}
                        placeholder="输入敏感词，回车或点击添加"
                        className="flex-1 px-3 py-1.5 bg-theme-search border border-[#eee] rounded-lg text-[12px] text-theme-ink focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent"
                      />
                      <button
                        onClick={() => addSensitiveWord(cat.key)}
                        className="shrink-0 px-3 py-1.5 bg-theme-ink text-white rounded-lg text-[12px] font-medium hover:bg-black transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> 添加
                      </button>
                    </div>
                    {wordLists[cat.key].length === 0 ? (
                      <p className="text-[12px] text-theme-muted">未设置。</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {wordLists[cat.key].map((w) => (
                          <span key={w} className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded-full text-[12px]">
                            {w}
                            <button
                              onClick={() => removeSensitiveWord(cat.key, w)}
                              className="hover:text-red-500 transition-colors"
                              title={`移除 ${w}`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
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
                  <MangaCover
                    src={manga.coverUrl}
                    isR18={manga.isR18}
                    badgeText={settings.enableR18Blur && manga.isR18 ? 'R18' : ''}
                    className="w-full h-full rounded-md border border-[#eee]"
                    imgClassName="rounded-md"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-[15px] leading-tight text-theme-ink">{manga.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] text-theme-accent font-mono bg-theme-bg inline-block px-2 py-1 rounded border border-[#eee]">JM ID: {manga.jmId}</p>
                    <label className="flex items-center gap-2 text-[12px] text-theme-muted bg-theme-bg px-2 py-1 rounded border border-[#eee] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!manga.isR18}
                        onChange={(e) => handleSetR18(manga.id, e.target.checked)}
                        className="w-4 h-4 text-theme-accent bg-white border-[#ddd] rounded focus:ring-theme-accent focus:ring-2"
                      />
                      R18
                    </label>
                  </div>
                  <p className="text-[12px] text-theme-muted line-clamp-2">{manga.description}</p>

                  {/* 撞车提示：与库内已有本子可能重复 */}
                  {(duplicateMap[manga.id] ?? []).length > 0 && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-red-700 mb-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        可能与以下本子撞车
                      </div>
                      <ul className="space-y-1.5">
                        {duplicateMap[manga.id].map((d) => (
                          <li key={d.manga.id} className="flex items-center gap-2 text-[12px]">
                            <Link
                              to={`/manga/${d.manga.id}`}
                              className="font-medium text-theme-ink hover:text-theme-accent hover:underline truncate"
                              title={d.manga.title}
                            >
                              {d.manga.title}
                            </Link>
                            <span className="text-[11px] text-theme-muted shrink-0">
                              {d.manga.jmId ? `JM${d.manga.jmId}` : ''}
                            </span>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${levelStyles[d.level]}`}>
                              {d.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 敏感词警告：提交信息命中管理员设置的敏感词 */}
                  {(sensitiveMap[manga.id] ?? []).length > 0 && (
                    <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-orange-700 mb-2">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        命中敏感词（用户已二次确认提交）
                      </div>
                      <ul className="space-y-1">
                        {sensitiveMap[manga.id].map((h, i) => (
                          <li key={i} className="flex items-center justify-between text-[12px]">
                            <span className="text-orange-800 font-medium">{fieldLabel(h.field)}</span>
                            <span className="text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded text-[11px] font-mono">
                              {h.word}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                  <MangaCover
                    src={manga.coverUrl}
                    isR18={manga.isR18}
                    badgeText={settings.enableR18Blur && manga.isR18 ? 'R18' : ''}
                    className="w-full h-full rounded-md border border-[#eee]"
                    imgClassName="rounded-md"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-[15px] leading-tight text-theme-ink">{manga.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] text-theme-accent font-mono bg-theme-bg inline-block px-2 py-1 rounded border border-[#eee]">JM ID: {manga.jmId}</p>
                    <label className="flex items-center gap-2 text-[12px] text-theme-muted bg-theme-bg px-2 py-1 rounded border border-[#eee] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!manga.isR18}
                        onChange={(e) => handleSetR18(manga.id, e.target.checked)}
                        className="w-4 h-4 text-theme-accent bg-white border-[#ddd] rounded focus:ring-theme-accent focus:ring-2"
                      />
                      R18
                    </label>
                  </div>
                  
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
                    <div className="flex flex-wrap gap-2 justify-end">
                      {u.role === 'user' && (
                        <>
                          {isRoot && (
                            <button
                              onClick={() => handleSetRole(u.id, 'admin')}
                              className="text-[12px] px-3 py-1.5 rounded transition-colors border text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Make Admin
                            </button>
                          )}
                          <button
                            onClick={() => handleSetRole(u.id, 'reviewer')}
                            className="text-[12px] px-3 py-1.5 rounded transition-colors border text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            Make Reviewer
                          </button>
                        </>
                      )}
                      {u.role === 'reviewer' && (
                        <>
                          {isRoot && (
                            <button
                              onClick={() => handleSetRole(u.id, 'admin')}
                              className="text-[12px] px-3 py-1.5 rounded transition-colors border text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Make Admin
                            </button>
                          )}
                          <button
                            onClick={() => handleSetRole(u.id, 'user')}
                            className="text-[12px] px-3 py-1.5 rounded transition-colors border text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Revoke Reviewer
                          </button>
                        </>
                      )}
                      {u.role === 'admin' && isRoot && (
                        <button
                          onClick={() => handleSetRole(u.id, 'user')}
                          className="text-[12px] px-3 py-1.5 rounded transition-colors border text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Revoke Admin
                        </button>
                      )}
                    </div>
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
