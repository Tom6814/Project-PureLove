import React, { useState, useEffect } from 'react';
import { useAuth, SocialLink } from '../contexts/AuthContext';
import { supabase, getSourceAccounts, upsertSourceAccount, deleteSourceAccount } from '../lib/supabase';
import { handleSupabaseError, OperationType } from '../lib/supabase-errors';
import { Save, Loader2, Plus, Trash2, BookmarkPlus, RefreshCw, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { getSourceName } from '../lib/utils';

interface SourceOption {
  id: string;
  name: string;
  needsLogin: boolean;
  supportsFavorites: boolean;
}

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [jmUsername, setJmUsername] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 源账号 + 收藏夹
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [accounts, setAccounts] = useState<Record<string, { username: string; favoritesEnabled: boolean }>>({});
  const [favSource, setFavSource] = useState('');
  const [favUsername, setFavUsername] = useState('');
  const [favPassword, setFavPassword] = useState('');
  const [favEnabled, setFavEnabled] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [favMsg, setFavMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setJmUsername(profile.jmUsername || '');
      setContactEmail(profile.contactEmail || profile.email || '');
      setBio(profile.bio || '');
      setSocialLinks(profile.socialLinks || []);
      setBackgroundUrl(profile.backgroundUrl || '');
      setCustomCss(profile.customCss || '');
    }
  }, [profile]);

  useEffect(() => {
    axios
      .get('/api/sources')
      .then((res) => {
        if (res.data.success) setSources(res.data.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    getSourceAccounts().then((list) => {
      const map: Record<string, { username: string; favoritesEnabled: boolean }> = {};
      for (const acc of list) {
        map[acc.source] = { username: acc.username, favoritesEnabled: acc.favoritesEnabled };
      }
      setAccounts(map);
    });
  }, [user]);

  if (!user || !profile) {
    return <div className="p-20 text-center text-theme-muted">请先登录</div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          jm_username: jmUsername,
          contact_email: contactEmail,
          bio,
          social_links: socialLinks,
          background_url: backgroundUrl,
          custom_css: customCss,
        })
        .eq('id', user.uid);
      if (error) throw error;
      setMessage('个人资料保存成功！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, 'users');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSocialLink = () => {
    setSocialLinks([...socialLinks, { id: Date.now().toString(), icon: '🌐', label: '', url: '' }]);
  };

  const handleUpdateSocialLink = (id: string, field: keyof SocialLink, value: string) => {
    setSocialLinks(socialLinks.map(link => link.id === id ? { ...link, [field]: value } : link));
  };

  const handleRemoveSocialLink = (id: string) => {
    setSocialLinks(socialLinks.filter(link => link.id !== id));
  };

  const handleSaveFavorite = async () => {
    if (!favSource) return;
    if (!favUsername.trim() || !favPassword.trim()) {
      setFavMsg('请填写用户名和密码');
      return;
    }
    setSavingFav(true);
    setFavMsg('');
    try {
      const res = await upsertSourceAccount(user.uid, favSource, {
        username: favUsername.trim(),
        password: favPassword.trim(),
        favoritesEnabled: favEnabled,
      });
      setAccounts((prev) => ({
        ...prev,
        [favSource]: { username: favUsername.trim(), favoritesEnabled: favEnabled },
      }));
      setFavUsername('');
      setFavPassword('');
      setFavEnabled(false);
      setFavSource('');
      setFavMsg(
        res.serverStored
          ? '已保存并开启收藏夹：用户名密码已存服务器，每日自动同步收藏到你的个人主页。'
          : '已保存到本地缓存（未开启收藏夹，密码不存服务器）。'
      );
      setTimeout(() => setFavMsg(''), 5000);
    } catch (err: any) {
      setFavMsg('保存失败：' + (err.message || '请重试'));
    } finally {
      setSavingFav(false);
    }
  };

  const handleRemoveAccount = async (source: string) => {
    try {
      await deleteSourceAccount(user.uid, source);
      setAccounts((prev) => {
        const next = { ...prev };
        delete next[source];
        return next;
      });
    } catch (err: any) {
      setFavMsg('删除失败：' + (err.message || '请重试'));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setFavMsg('');
    try {
      await axios.post('/api/favorites/sync');
      setFavMsg('已触发收藏同步，稍后刷新个人主页即可看到最新收藏。');
      setTimeout(() => setFavMsg(''), 5000);
    } catch (err: any) {
      setFavMsg('同步失败：' + (err.message || '请检查服务端是否配置了同步密钥'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-[12px] border border-[#eee] shadow-sm">
      <h1 className="text-2xl font-serif font-light text-theme-ink mb-6">个人设置</h1>
      
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-[13px] font-medium text-theme-ink mb-2">显示名称 (评论时展示)</label>
          <input 
            type="text" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2 bg-theme-search border border-[#eee] rounded-lg text-[14px] focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none transition-all"
            placeholder="例如: 优质同好"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-theme-ink mb-2">JM 用户名 (选填)</label>
          <input 
            type="text" 
            value={jmUsername} 
            onChange={(e) => setJmUsername(e.target.value)}
            className="w-full px-4 py-2 bg-theme-search border border-[#eee] rounded-lg text-[14px] focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none transition-all"
            placeholder="@jmuser"
          />
          <p className="text-[12px] text-theme-muted mt-1">如果你在 JM 也有账号，可以在此填写</p>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-theme-ink mb-2">联系邮箱</label>
          <input 
            type="email" 
            value={contactEmail} 
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full px-4 py-2 bg-theme-search border border-[#eee] rounded-lg text-[14px] focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none transition-all"
            placeholder="name@example.com"
          />
          <p className="text-[12px] text-theme-muted mt-1">仅管理员可见，用于联系</p>
        </div>

        <div className="border-t border-[#eee] pt-6 mt-6">
          <h2 className="text-lg font-serif font-light text-theme-ink mb-4">主页展示资料</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-[13px] font-medium text-theme-ink mb-2">个性签名 / 简介</label>
              <textarea 
                value={bio} 
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-theme-search border border-[#eee] rounded-lg text-[14px] focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none transition-all resize-none"
                placeholder="向大家介绍一下你自己吧..."
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-theme-ink mb-2">社交链接 & 外部站点</label>
              <div className="space-y-3 mb-3">
                {socialLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={link.icon} 
                      onChange={(e) => handleUpdateSocialLink(link.id, 'icon', e.target.value)}
                      className="w-12 px-2 py-2 text-center bg-theme-search border border-[#eee] rounded-lg text-[14px] focus:bg-white focus:border-theme-accent outline-none"
                      placeholder="🐦"
                      title="输入Emoji作为图标"
                    />
                    <input 
                      type="text" 
                      value={link.label} 
                      onChange={(e) => handleUpdateSocialLink(link.id, 'label', e.target.value)}
                      className="w-24 md:w-32 px-3 py-2 bg-theme-search border border-[#eee] rounded-lg text-[13px] focus:bg-white focus:border-theme-accent outline-none"
                      placeholder="如: 推特"
                    />
                    <input 
                      type="text" 
                      value={link.url} 
                      onChange={(e) => handleUpdateSocialLink(link.id, 'url', e.target.value)}
                      className="flex-1 px-3 py-2 bg-theme-search border border-[#eee] rounded-lg text-[13px] focus:bg-white focus:border-theme-accent outline-none"
                      placeholder="https://"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleRemoveSocialLink(link.id)}
                      className="p-2 text-theme-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      title="移除链接"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                type="button" 
                onClick={handleAddSocialLink}
                className="flex items-center text-[12px] font-medium text-theme-accent hover:opacity-80 transition-opacity"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加链接
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#eee] pt-6 mt-6">
          <h2 className="text-lg font-serif font-light text-theme-ink mb-4">主页个性化装扮</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[13px] font-medium text-theme-ink mb-2">背景图片 URL</label>
              <input 
                type="text" 
                value={backgroundUrl} 
                onChange={(e) => setBackgroundUrl(e.target.value)}
                className="w-full px-4 py-2 bg-theme-search border border-[#eee] rounded-lg text-[14px] focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none transition-all"
                placeholder="https://example.com/bg.jpg"
              />
              <p className="text-[12px] text-theme-muted mt-1">留空则使用默认背景</p>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-theme-ink mb-2">自定义 CSS</label>
              <textarea 
                value={customCss} 
                onChange={(e) => setCustomCss(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-theme-search border border-[#eee] rounded-lg text-[13px] font-mono focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none transition-all"
                placeholder={`#user-profile-container {
  /* 在此输入你的自定义 CSS */
  color: #ff0000;
}`}
              />
              <p className="text-[12px] text-theme-muted mt-1">你可以在此为你的个人主页添加自定义样式，作用域为 <code className="bg-[#eee] px-1 py-0.5 rounded">#user-profile-container</code></p>
            </div>
          </div>
        </div>

        {/* 源账号与收藏夹 */}
        <div className="border-t border-[#eee] pt-6 mt-6">
          <h2 className="text-lg font-serif font-light text-theme-ink mb-1 flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-theme-accent" />
            源账号与收藏夹
          </h2>
          <p className="text-[12px] text-theme-muted mb-5 leading-relaxed">
            为漫画源添加你的账号（可添加多个）。开启「收藏夹显示」后，本站会将用户名和密码存入服务器，
            每日自动从各源拉取你的收藏并公开显示在个人主页（每天覆盖更新）。
            未开启收藏夹时，用户名密码仅保存在你的浏览器缓存中，不存服务器。
          </p>

          {Object.keys(accounts).length > 0 && (
            <div className="space-y-2 mb-5">
              {Object.entries(accounts).map(([src, acc]: [string, { username: string; favoritesEnabled: boolean }]) => (
                <div key={src} className="flex items-center justify-between gap-3 bg-theme-main rounded-lg border border-[#eee] px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-serif text-[14px] text-theme-ink whitespace-nowrap">{getSourceName(src)}</span>
                    <span className="text-[12px] text-theme-muted truncate">@{acc.username}</span>
                    {acc.favoritesEnabled ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-theme-accent/10 text-theme-accent border border-theme-accent/20 whitespace-nowrap">收藏夹已开启</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">仅本地</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAccount(src)}
                    className="p-1.5 text-theme-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 shrink-0"
                    title="移除该源账号"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 p-4 bg-theme-main rounded-[12px] border border-[#eee]">
            <div>
              <label className="block text-[12px] font-medium text-theme-ink mb-1.5">选择漫画源</label>
              <select
                value={favSource}
                onChange={(e) => {
                  const sid = e.target.value;
                  setFavSource(sid);
                  const existing = accounts[sid];
                  setFavUsername(existing?.username || '');
                  setFavPassword('');
                  setFavEnabled(existing?.favoritesEnabled || false);
                }}
                className="w-full px-3 py-2 bg-white border border-[#eee] rounded-lg text-[13px] text-theme-ink focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none"
              >
                <option value="">请选择源...</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.supportsFavorites ? '' : '（暂不支持收藏）'}</option>
                ))}
              </select>
            </div>

            {favSource && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-theme-ink mb-1.5">用户名 / 账号</label>
                    <input
                      type="text"
                      value={favUsername}
                      onChange={(e) => setFavUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#eee] rounded-lg text-[13px] focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none"
                      placeholder="你的账号"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-theme-ink mb-1.5">密码</label>
                    <input
                      type="password"
                      value={favPassword}
                      onChange={(e) => setFavPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#eee] rounded-lg text-[13px] focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none"
                      placeholder="你的密码"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-[#eee] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={favEnabled}
                    onChange={(e) => setFavEnabled(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-theme-accent bg-white border-[#ddd] rounded focus:ring-theme-accent focus:ring-2"
                  />
                  <span className="text-[12px] text-theme-muted leading-relaxed">
                    <span className="text-theme-ink font-medium">开启收藏夹显示</span>
                    <br />
                    开启后用户名密码将存入服务器，每日自动拉取该源收藏并公开展示在你的个人主页。
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveFavorite}
                    disabled={savingFav}
                    className="px-4 py-2 bg-theme-ink text-white rounded-lg text-[13px] font-medium hover:bg-black disabled:opacity-50 transition-colors flex items-center"
                  >
                    {savingFav ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                    保存账号
                  </button>
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncing}
                    className="px-4 py-2 bg-white text-theme-ink border border-[#eee] rounded-lg text-[13px] font-medium hover:border-theme-accent hover:text-theme-accent disabled:opacity-50 transition-colors flex items-center"
                    title="立即拉取所有已开启收藏夹账号的最新收藏"
                  >
                    {syncing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                    立即同步收藏
                  </button>
                </div>
              </>
            )}

            {favMsg && <p className="text-[12px] text-theme-accent flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />{favMsg}</p>}
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between">
          {message ? <span className="text-theme-accent text-[13px]">{message}</span> : <span></span>}
          
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-theme-ink text-white rounded-lg text-[14px] font-medium hover:bg-black transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            保存设置
          </button>
        </div>
      </form>
    </div>
  );
}
