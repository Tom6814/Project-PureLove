import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Save, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [jmUsername, setJmUsername] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setJmUsername(profile.jmUsername || '');
      setContactEmail(profile.contactEmail || profile.email || '');
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
        contactEmail
      });
      setMessage('个人资料保存成功！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    } finally {
      setSaving(false);
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
