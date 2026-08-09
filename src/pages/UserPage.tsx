import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, mapProfileRow, mapMangaRow, getPublicFavorites, UserFavorite } from '../lib/supabase';
import { UserProfile } from '../contexts/AuthContext';
import { Loader2, Bookmark } from 'lucide-react';
import { getValidImageUrl, getSourceName } from '../lib/utils';
import { format } from 'date-fns';
import { useSettings } from '../hooks/useSettings';
import MangaCover from '../components/MangaCover';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mangas, setMangas] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  useEffect(() => {
    if (!id) return;
    
    const fetchUserAndMangas = async () => {
      try {
        const { data: userSnap, error: userError } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (userError) throw userError;

        setProfile(userSnap ? mapProfileRow(userSnap) : null);

        // Fetch mangas recommended by this user
        const { data: mangaSnap, error: mangaError } = await supabase
          .from('mangas')
          .select('*')
          .eq('submitted_by', id)
          .eq('status', 'approved');
        if (mangaError) throw mangaError;
        setMangas((mangaSnap ?? []).map(mapMangaRow));

        // Fetch favorites snapshot (public, populated by the server cron)
        const favs = await getPublicFavorites(id);
        setFavorites(favs);

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
      className="min-h-[calc(100vh-80px)] relative w-full overflow-hidden"
    >
      {profile.customCss && (
        <style dangerouslySetInnerHTML={{ __html: profile.customCss }} />
      )}
      
      {/* Background Layer */}
      {profile.backgroundUrl ? (
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat w-full h-full" 
          style={{ backgroundImage: `url(${profile.backgroundUrl})`, opacity: 0.3 }}
        />
      ) : (
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-theme-accent/5 to-transparent w-full h-full" />
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

            {profile.bio && (
              <p className="mt-4 text-[14px] text-theme-ink/80 whitespace-pre-wrap leading-relaxed">
                {profile.bio}
              </p>
            )}

            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-3 justify-center md:justify-start">
                {profile.socialLinks.map((link) => (
                  <a 
                    key={link.id} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/60 hover:bg-white border border-[#eee] rounded-full text-[13px] font-medium text-theme-ink transition-all hover:shadow-sm hover:-translate-y-0.5"
                    title={link.label}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Favorites (public snapshot, synced daily from connected sources) */}
        {favorites.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-serif text-theme-ink mb-6 pb-2 border-b border-[#eee] border-opacity-50 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-theme-accent" />
              TA 的收藏 ({favorites.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {favorites.map((fav) => (
                <a
                  key={`${fav.source}-${fav.itemId}`}
                  href={favSourceUrl(fav)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block bg-white/80 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm border border-[#eee] transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="aspect-[2/3] overflow-hidden bg-[#e5e5e5] relative">
                    {fav.coverUrl ? (
                      <img
                        src={getValidImageUrl(fav.coverUrl)}
                        alt={fav.title}
                        className="w-full h-full object-cover group-hover:opacity-90 transition-all duration-500"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-theme-muted text-[11px]">
                        无封面
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-[13px] text-theme-ink mb-1 whitespace-nowrap overflow-hidden text-ellipsis" title={fav.title}>
                      {fav.title}
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-theme-accent">
                      <span className="text-theme-muted">{getSourceName(fav.source)}</span>
                      {fav.authors?.length > 0 && (
                        <span className="truncate ml-2 text-theme-muted" title={fav.authors.join(', ')}>
                          {fav.authors.join(' / ')}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

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
                  <MangaCover
                    src={manga.coverUrl}
                    alt={manga.title}
                    isR18={manga.isR18}
                    className="aspect-[2/3]"
                    imgClassName="group-hover:opacity-90 transition-all duration-500"
                  />
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

/** 收藏条目跳转到源站详情页 */
function favSourceUrl(fav: UserFavorite): string {
  const id = encodeURIComponent(fav.itemId);
  switch (fav.source) {
    case 'jm': return `https://18comic.vip/album/${id}`;
    case 'bika': return `https://www.picacomic.com/comics/${id}`;
    case 'ehentai': {
      const [gid, token] = String(fav.itemId).split('-');
      return gid ? `https://e-hentai.org/g/${gid}/${token || ''}/` : 'https://e-hentai.org/';
    }
    case 'nhentai': return `https://nhentai.net/g/${id}/`;
    case 'copymanga': return `https://www.copymanga.tv/comic/${id}`;
    case 'noyacg': return `https://noy.ac/${id}/`;
    case 'komiic': return `https://komiic.com/comic/${id}`;
    case 'baozimh': return `https://www.baozimh.com/comic/${id}`;
    case 'zaimanhua': return `https://www.zaimanhua.com/comic/${id}`;
    case 'wnacg': return `https://wnacg.com/photos-index-aid-${id}.html`;
    default: return '#';
  }
}
