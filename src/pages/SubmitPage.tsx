import React, { useEffect, useState } from 'react';
import { supabase, getSourceCredentials, saveSourceCredentials, getSourceCache, saveSourceCache } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Info, Send, Loader2, CheckCircle, Search as SearchIcon, KeyRound } from 'lucide-react';
import { handleSupabaseError, OperationType } from '../lib/supabase-errors';
import { getValidImageUrl, cn } from '../lib/utils';

interface SourceInfo {
  id: string;
  name: string;
  needsLogin: boolean;
}

interface SearchItem {
  id: string;
  title: string;
  coverUrl: string;
  authors: string[];
}

export default function SubmitPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // source management
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [source, setSource] = useState('jm');
  const sourceInfo = sources.find((s) => s.id === source);

  // search
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searched, setSearched] = useState(false);

  // login
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loggingIn, setLoggingIn] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // jm id input (only for jm source)
  const [jmId, setJmId] = useState('');

  // detail / form
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isR18, setIsR18] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    review: '',
    coverUrl: '',
    authors: '',
    tags: '',
    category: '',
  });

  useEffect(() => {
    axios
      .get('/api/sources')
      .then((res) => {
        if (res.data.success) {
          setSources(res.data.data);
          if (!res.data.data.some((s: SourceInfo) => s.id === 'jm')) {
            setSource(res.data.data[0]?.id || 'jm');
          }
        }
      })
      .catch(() => {});
  }, []);

  const switchSource = (id: string) => {
    setSource(id);
    setSearchQ('');
    setResults([]);
    setSearched(false);
    setNeedsLogin(false);
    setError('');
  };

  const withCredentials = async (): Promise<Record<string, string> | undefined> => {
    if (!sourceInfo?.needsLogin) return undefined;
    return (await getSourceCredentials(source)) || undefined;
  };

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setError('');
    setNeedsLogin(false);
    setSearched(false);
    try {
      const cacheKey = `${source}:search:${q.trim()}`;
      const cached = await getSourceCache<SearchItem[]>(cacheKey);
      if (cached && cached.length > 0) {
        setResults(cached);
        setSearched(true);
        return;
      }
      const cred = await withCredentials();
      const res = await axios.post('/api/sources/search', { source, q: q.trim(), cred });
      if (res.data.success) {
        setResults(res.data.data || []);
        setSearched(true);
        saveSourceCache(cacheKey, res.data.data || []);
      } else if (res.data.needsLogin) {
        setNeedsLogin(true);
      } else {
        setError(res.data.error || '搜索失败');
      }
    } catch (err: any) {
      setError(err.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleLogin = async () => {
    setLoggingIn(true);
    setError('');
    try {
      const res = await axios.post('/api/sources/login', {
        source,
        username: loginForm.username,
        password: loginForm.password,
      });
      if (res.data.success) {
        await saveSourceCredentials(source, res.data.data || {});
        setNeedsLogin(false);
        setLoginForm({ username: '', password: '' });
        if (pendingId) {
          const pid = pendingId;
          setPendingId(null);
          await handleSelectResult(pid);
        } else if (searchQ.trim()) {
          await runSearch(searchQ);
        }
      } else {
        setError(res.data.error || '登录失败');
      }
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSelectResult = async (itemId: string) => {
    setLoading(true);
    setError('');
    try {
      const cacheKey = `${source}:detail:${itemId}`;
      const cached = await getSourceCache<any>(cacheKey);
      if (cached) {
        applyDetail(cached);
        return;
      }
      const cred = await withCredentials();
      const res = await axios.post('/api/sources/detail', { source, id: itemId, cred });
      if (res.data.success) {
        applyDetail(res.data.data);
        saveSourceCache(cacheKey, res.data.data);
      } else if (res.data.needsLogin) {
        setPendingId(itemId);
        setNeedsLogin(true);
      } else {
        setError(res.data.error || '解析失败');
      }
    } catch (err: any) {
      setError(err.message || '解析失败');
    } finally {
      setLoading(false);
    }
  };

  const applyDetail = (data: any) => {
    setPreview(data);
    setIsR18(false);
    setFormData({
      title: data.title || '',
      description: data.description || '',
      review: '',
      coverUrl: data.coverUrl || '',
      authors: Array.isArray(data.authors) ? data.authors.join(', ') : data.authors || '',
      tags: Array.isArray(data.tags) ? data.tags.join(', ') : data.tags || '',
      category: '',
    });
    setToastMessage('解析成功，请补充阅读感想后提交');
    setTimeout(() => setToastMessage(''), 3000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 仅 jm 源：输入 JM 号直接解析
  const handleFetch = async () => {
    if (!jmId) return;
    setLoading(true);
    setError('');
    try {
      const cleanId = jmId.replace(/\D/g, '');
      const response = await axios.get(`/api/jm/${cleanId}`);
      if (response.data.success) {
        applyDetail({ ...response.data.data, id: response.data.data.jmId });
      } else {
        setError(response.data.error || '解析失败，未找到该JM号的数据');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || '解析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview || !user) return;
    if (!formData.category) {
      setError('请选择作品分类 (日漫/韩漫/其他)');
      return;
    }
    setSubmitting(true);
    try {
      const authorsArr = formData.authors.split(',').map((s) => s.trim()).filter(Boolean);
      const tagsArr = formData.tags.split(',').map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase
        .from('mangas')
        .insert({
          source,
          jm_id: preview.id || preview.jmId,
          title: formData.title,
          description: formData.description,
          review: formData.review,
          cover_url: formData.coverUrl,
          authors: authorsArr.length ? authorsArr : ['Unknown'],
          tags: tagsArr.length ? tagsArr : [],
          pages: preview.pages || 0,
          category: formData.category,
          is_r18: isR18,
          status: 'pending',
          submitted_by: user.uid,
          submitted_by_name: user.displayName || '匿名用户',
          created_at: new Date().toISOString(),
        });
      if (error) throw error;
      setToastMessage('提交成功，请等待审核');
      setTimeout(() => {
        setToastMessage('');
        navigate('/');
      }, 2000);
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'mangas');
      setError('提交失败，请重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-[12px] shadow-theme-card border border-[#eee]">
        <h1 className="font-serif text-[32px] font-light text-theme-ink tracking-tight mb-2">提交解析</h1>
        <p className="text-[13px] text-theme-muted mb-8">选择来源 → 搜索漫画名 → 自动抓取封面、作者、详情，管理员审核后即可上架</p>

        <div className="space-y-6">
          {/* Source selector */}
          <div>
            <label className="block text-[13px] font-medium text-theme-ink mb-2">选择来源</label>
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => switchSource(s.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border',
                    source === s.id
                      ? 'bg-theme-ink text-white border-theme-ink shadow-sm'
                      : 'bg-white text-theme-muted border-[#eee] hover:border-theme-accent hover:text-theme-accent'
                  )}
                  title={s.needsLogin ? '该源部分内容需要登录' : undefined}
                >
                  {s.name}
                  {s.needsLogin && <span className="ml-1 text-[10px] opacity-70">🔒</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Search area */}
          <div>
            <div className="flex space-x-3">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-[13px] top-1/2 -translate-y-1/2 text-theme-muted w-4 h-4" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch(searchQ)}
                  placeholder={`在 ${sourceInfo?.name || source} 中搜索漫画名...`}
                  className="w-full pl-10 pr-4 py-2.5 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30 transition-all font-sans"
                />
              </div>
              <button
                onClick={() => runSearch(searchQ)}
                disabled={!searchQ.trim() || searching}
                className="px-5 py-2.5 bg-theme-ink text-white rounded-lg text-[13px] font-medium hover:bg-black disabled:opacity-50 transition-colors flex items-center"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
              </button>
            </div>

            {/* jm source: or input jm id */}
            {source === 'jm' && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[12px] text-theme-muted whitespace-nowrap">或输入 JM 号添加：</span>
                <div className="relative flex-1">
                  <span className="absolute left-[13px] top-1/2 -translate-y-1/2 text-theme-muted font-mono text-[12px]">JM</span>
                  <input
                    type="text"
                    value={jmId}
                    onChange={(e) => setJmId(e.target.value.replace(/jm/i, ''))}
                    placeholder="如: 123456"
                    className="w-full pl-[42px] pr-3 py-2 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30 transition-all font-sans"
                  />
                </div>
                <button
                  onClick={handleFetch}
                  disabled={!jmId || loading}
                  className="px-4 py-2 bg-theme-accent text-white rounded-lg text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center whitespace-nowrap"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '解析'}
                </button>
              </div>
            )}
            {error && <p className="text-red-500 text-[13px] mt-2">{error}</p>}
          </div>

          {/* Login form for sources that require it */}
          {needsLogin && sourceInfo?.needsLogin && (
            <div className="p-5 bg-theme-main rounded-[12px] border border-theme-accent/20">
              <h3 className="font-semibold text-theme-ink mb-3 flex items-center text-[14px]">
                <KeyRound className="w-4 h-4 mr-2 text-theme-accent" />
                {sourceInfo.name} 需要登录
              </h3>
              <p className="text-[12px] text-theme-muted mb-4">登录后凭证会安全保存，之后可直接搜索/解析（结果也会缓存到本站）。</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="账号 / 用户名"
                  className="w-full px-4 py-2.5 bg-white border border-[#eee] rounded-lg text-[13px] focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none"
                />
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="密码"
                  className="w-full px-4 py-2.5 bg-white border border-[#eee] rounded-lg text-[13px] focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none"
                />
                <button
                  onClick={handleLogin}
                  disabled={loggingIn || !loginForm.username || !loginForm.password}
                  className="w-full py-2.5 bg-theme-accent text-white rounded-lg text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : '登录并继续'}
                </button>
              </div>
            </div>
          )}

          {/* Search results */}
          {searched && (
            <div>
              <h3 className="font-semibold text-theme-ink mb-3 text-[14px]">
                搜索结果 ({results.length})
              </h3>
              {results.length === 0 ? (
                <p className="text-[13px] text-theme-muted text-center py-8 bg-theme-main rounded-lg border border-[#eee] border-dashed">
                  没有找到相关漫画，换个关键词试试
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectResult(item.id)}
                      disabled={loading}
                      className="group text-left bg-theme-main rounded-xl overflow-hidden border border-[#eee] hover:border-theme-accent transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60"
                    >
                      <div className="aspect-[2/3] overflow-hidden bg-[#e5e5e5] relative">
                        {item.coverUrl ? (
                          <img
                            src={getValidImageUrl(item.coverUrl)}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-theme-muted text-[11px]">无封面</div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="font-medium text-[12px] text-theme-ink leading-snug line-clamp-2" title={item.title}>
                          {item.title}
                        </div>
                        {item.authors.length > 0 && (
                          <div className="text-[11px] text-theme-muted mt-1 truncate">{item.authors.join(' / ')}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detail preview & form */}
          {preview && (
            <div className="mt-8 p-5 bg-theme-main rounded-[12px] border border-[#eee]">
              <h3 className="font-semibold text-theme-ink mb-4 flex items-center text-[14px]">
                <Info className="w-4 h-4 mr-2 text-theme-accent" />
                确认并补充信息
              </h3>

              <div className="flex gap-5 mb-6">
                <img
                  src={getValidImageUrl(formData.coverUrl || preview.coverUrl)}
                  alt="Cover"
                  className="w-[100px] h-[150px] object-cover rounded-md border border-[#eee]"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-theme-ink mb-1">封面 (已转 base64 存储)</label>
                    <input
                      type="text"
                      value={formData.coverUrl}
                      onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-theme-ink mb-1">标题</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-theme-ink mb-1">
                    作品分类 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    {['日漫', '韩漫', '其他'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat })}
                        className={cn(
                          'px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border',
                          formData.category === cat
                            ? 'bg-theme-ink text-white border-theme-ink shadow-sm'
                            : 'bg-white text-theme-muted border-[#eee] hover:border-theme-accent hover:text-theme-accent'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start space-x-3 bg-theme-bg p-4 rounded-lg border border-[#eee]">
                  <div className="flex items-center h-5">
                    <input
                      id="isR18"
                      type="checkbox"
                      checked={isR18}
                      onChange={(e) => setIsR18(e.target.checked)}
                      className="w-4 h-4 text-theme-accent bg-white border-[#ddd] rounded focus:ring-theme-accent focus:ring-2"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="isR18" className="text-[13px] font-medium text-theme-ink">
                      R18 封面模糊
                    </label>
                    <p className="text-[12px] text-theme-muted mt-1">
                      如果封面包含成人/露骨内容，请勾选此项（上架后将对封面做轻度模糊处理）。
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-theme-ink mb-1">作者 (多个用逗号分隔)</label>
                  <input
                    type="text"
                    value={formData.authors}
                    onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                    className="w-full px-3 py-2 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-theme-ink mb-1">标签 (多个用逗号分隔)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-3 py-2 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-theme-ink mb-1">简介</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-theme-ink mb-1">阅读感想 / 推荐语</label>
                  <textarea
                    value={formData.review}
                    onChange={(e) => setFormData({ ...formData, review: e.target.value })}
                    rows={4}
                    placeholder="分享一下你的阅读感想吧..."
                    className="w-full px-3 py-2 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30 resize-none"
                  />
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-[#eee] flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-[10px] bg-theme-accent text-white rounded-lg text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  提交审核
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center text-[14px] font-medium animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-5 h-5 mr-2" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
