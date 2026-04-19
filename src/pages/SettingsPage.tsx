import React, { useState, useEffect } from 'react';
import { useAuth, SocialLink } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';

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

  if (!user || !profile) {
    return <div className="p-20 text-center text-theme-muted">请先登录</div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName,
        jmUsername,
        contactEmail,
        bio,
        socialLinks,
        backgroundUrl,
        customCss
      });
      setMessage('个人资料保存成功！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
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
            placeholder="例如: 纯爱战士"
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
