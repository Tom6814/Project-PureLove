import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Info, Send, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function SubmitPage() {
  const [jmId, setJmId] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleFetch = async () => {
    if (!jmId) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      // the input could be JM12345 or 12345
      const cleanId = jmId.replace(/\D/g, '');
      const response = await axios.get(`/api/jm/${cleanId}`);
      if (response.data.success) {
        setPreview(response.data.data);
      } else {
        setError('Failed to fetch data from JM.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview || !user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'mangas'), {
        jmId: preview.jmId,
        title: preview.title,
        description: preview.description || '',
        coverUrl: preview.coverUrl || '',
        authors: preview.authors || [],
        tags: preview.tags || [],
        pages: preview.pages || 0,
        status: 'pending',
        submittedBy: user.uid,
        createdAt: new Date().toISOString()
      });
      navigate('/');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'mangas');
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-[12px] shadow-theme-card border border-[#eee]">
        <h1 className="font-serif text-[32px] font-light text-theme-ink tracking-tight mb-2">提交解析</h1>
        <p className="text-[13px] text-theme-muted mb-8">点击下方提交JM号，AI将自动为您抓取漫画信息，管理员审核后即可上架</p>

        <div className="space-y-6">
          <div>
            <label className="block text-[13px] font-medium text-theme-ink mb-2">JM ID</label>
            <div className="flex space-x-4">
              <div className="relative flex-1">
                <span className="absolute left-[15px] top-1/2 -translate-y-1/2 text-theme-muted font-mono text-[13px]">JM</span>
                <input 
                  type="text" 
                  value={jmId}
                  onChange={(e) => setJmId(e.target.value.replace(/jm/i, ''))}
                  placeholder="请输入JM号 (如: 123456)"
                  className="w-full pl-[45px] pr-[15px] py-[10px] bg-theme-search border-none rounded-lg text-[13px] text-theme-ink focus:outline-none focus:ring-2 focus:ring-theme-accent/30 transition-all font-sans"
                />
              </div>
              <button 
                onClick={handleFetch}
                disabled={!jmId || loading}
                className="px-5 py-[10px] bg-theme-ink text-white rounded-lg text-[13px] font-medium hover:bg-black disabled:opacity-50 transition-colors flex items-center"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch"}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          {preview && (
            <div className="mt-8 p-5 bg-theme-main rounded-[12px] border border-[#eee]">
              <h3 className="font-semibold text-theme-ink mb-4 flex items-center text-[14px]">
                <Info className="w-4 h-4 mr-2 text-theme-accent" />
                预览信息
              </h3>
              
              <div className="flex gap-5">
                <img 
                  src={preview.coverUrl} 
                  alt="Cover" 
                  className="w-[100px] h-[150px] object-cover rounded-md border border-[#eee]"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-[14px] leading-tight text-theme-ink">{preview.title}</h4>
                  <p className="text-[12px] text-theme-muted line-clamp-3 leading-relaxed">{preview.description}</p>
                  <div className="pt-2">
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preview.tags.map((t: string) => (
                        <span key={t} className="text-[11px] px-2 py-0.5 bg-white text-theme-muted border border-[#eee] rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
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
    </div>
  );
}
