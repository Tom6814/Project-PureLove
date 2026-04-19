import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { getValidImageUrl } from '../lib/utils';
import { format } from 'date-fns';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mangas, setMangas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const fetchUserAndMangas = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', id));
        if (userSnap.exists()) {
          setProfile({ id: userSnap.id, ...userSnap.data() } as any);
        } else {
          setProfile(null);
        }

        // Fetch mangas recommended by this user
        const q = query(
          collection(db, 'mangas'),
          where('submittedBy', '==', id),
          where('status', '==', 'approved')
        );
        const mangaSnap = await getDocs(q);
        setMangas(mangaSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
      } catch (err) {
        console.error("Failed to load user profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndMangas();
  }, [id]);

  if (loading) {
    return <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-theme-accent" /></div>;
  }

  if (!profile) {
    return <div className="p-20 text-center text-theme-muted">该用户不存在或已被删除</div>;
  }

  return (
    <div 
      id="user-profile-container" 
      className="min-h-[calc(100vh-160px)] relative"
    >
      {profile.customCss && (
        <style dangerouslySetInnerHTML={{ __html: profile.customCss }} />
      )}
      
      {/* Background Layer */}
      {profile.backgroundUrl ? (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20" 
          style={{ backgroundImage: `url(${profile.backgroundUrl})` }}
        />
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-theme-accent/5 to-transparent" />
      )}

      {/* Content Layer */}
      <div className="relative z-10 max-w-4xl mx-auto pt-12 pb-20 px-4">
        {/* User Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-[#eee] shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
          <img 
            src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} 
            alt={profile.displayName} 
            className="w-24 h-24 rounded-full border-4 border-white shadow-sm object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-serif text-theme-ink mb-1">{profile.displayName || '匿名用户'}</h1>
            <div className="text-theme-muted text-[13px] font-mono mb-3">UID: {profile.uid}</div>
            
            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
              <span className={`px-2.5 py-1 rounded-full text-[11px] border ${profile.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' : profile.role === 'reviewer' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {profile.role.toUpperCase()}
              </span>
              {profile.jmUsername && (
                <span className="px-2.5 py-1 rounded-full text-[11px] border bg-theme-bg text-theme-ink border-[#eee]">
                  JM: {profile.jmUsername}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full text-[11px] border bg-theme-bg text-theme-muted border-[#eee]">
                加入于 {format(new Date(profile.createdAt), 'yyyy-MM-dd')}
              </span>
            </div>
          </div>
        </div>

        {/* Recommended Mangas */}
        <div className="mt-12">
          <h2 className="text-xl font-serif text-theme-ink mb-6 pb-2 border-b border-[#eee] border-opacity-50">
            TA 的推荐 ({mangas.length})
          </h2>
          
          {mangas.length === 0 ? (
            <div className="text-center py-10 text-theme-muted text-[13px] bg-white/50 backdrop-blur-sm rounded-xl border border-[#eee]">
              该用户尚未推荐过已通过审核的漫画
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {mangas.map((manga) => (
                <Link key={manga.id} to={`/manga/${manga.id}`} className="group block bg-white/80 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm border border-[#eee] transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="aspect-[2/3] overflow-hidden bg-[#e5e5e5] relative">
                    <img 
                      src={getValidImageUrl(manga.coverUrl)} 
                      alt={manga.title}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-[13px] text-theme-ink mb-1 whitespace-nowrap overflow-hidden text-ellipsis" title={manga.title}>
                      {manga.title}
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-theme-accent">
                      <span>★ {manga.averageRating ? manga.averageRating.toFixed(1) : '无'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
