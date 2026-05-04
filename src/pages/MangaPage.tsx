import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Star, MessageSquareDashed, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { getValidImageUrl, cn } from '../lib/utils';

export default function MangaPage() {
  const { id } = useParams<{ id: string }>();
  const [manga, setManga] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const { user, profile, openAuthModal } = useAuth();
  const [revealR18, setRevealR18] = useState(false);
  
  // Interaction form states
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [isRating, setIsRating] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [userReview, setUserReview] = useState<any>(null);

  useEffect(() => {
    if (user && reviews.length > 0 && !userReview) {
      const existing = reviews.find(r => r.userId === user.uid);
      if (existing) {
        setUserReview(existing);
        setUserRating(existing.rating || 0);
        setUserComment(existing.comment || '');
      }
    }
  }, [user, reviews, userReview]);

  useEffect(() => {
    if (!id) return;
    
    const unsubscribeManga = onSnapshot(doc(db, 'mangas', id), (docSnap) => {
      if (docSnap.exists()) {
        setManga({ id: docSnap.id, ...docSnap.data() });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `mangas/${id}`);
    });

    const q = query(collection(db, 'reviews'), where('mangaId', '==', id), orderBy('createdAt', 'desc'));
    const unsubscribeReviews = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reviews'));

    return () => {
      unsubscribeManga();
      unsubscribeReviews();
    };
  }, [id]);

  const handleRate = async (val: number) => {
    if (!user || !id) return openAuthModal('login');
    setIsRating(true);
    setUserRating(val); // Optimistic UI update
    const isUpdating = !!userReview;

    try {
      const reviewData = {
        mangaId: id,
        userId: user.uid,
        rating: val,
        customUsername: profile?.displayName || user.displayName || '匿名用户',
        contactEmail: profile?.contactEmail || profile?.email || user.email || '',
        jmUsername: profile?.jmUsername || '',
      };

      let newReviewId = userReview?.id;

      if (isUpdating) {
        await updateDoc(doc(db, 'reviews', userReview.id), {
          ...reviewData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const docRef = await addDoc(collection(db, 'reviews'), {
          ...reviewData,
          comment: userComment || '',
          createdAt: new Date().toISOString(),
        });
        newReviewId = docRef.id;
        setUserReview({ id: newReviewId, ...reviewData, comment: userComment || '' });
      }

      // Recalculate average
      const otherReviews = reviews.filter(r => r.userId !== user.uid && r.rating > 0);
      const allRatings = [...otherReviews, { rating: val }];
      const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0);
      const newAvgRating = allRatings.length > 0 ? totalRating / allRatings.length : 0;
      
      await updateDoc(doc(db, 'mangas', id), {
        averageRating: newAvgRating,
        reviewCount: allRatings.length
      });

    } catch (err) {
      handleFirestoreError(err, isUpdating ? OperationType.UPDATE : OperationType.CREATE, 'reviews');
    } finally {
      setIsRating(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return openAuthModal('login');
    setIsCommenting(true);
    const isUpdating = !!userReview;
    
    try {
      const reviewData = {
        mangaId: id,
        userId: user.uid,
        comment: userComment,
        customUsername: profile?.displayName || user.displayName || '匿名用户',
        contactEmail: profile?.contactEmail || profile?.email || user.email || '',
        jmUsername: profile?.jmUsername || '',
      };

      if (isUpdating) {
        await updateDoc(doc(db, 'reviews', userReview.id), {
          ...reviewData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const docRef = await addDoc(collection(db, 'reviews'), {
          ...reviewData,
          rating: userRating || 0,
          createdAt: new Date().toISOString(),
        });
        setUserReview({ id: docRef.id, ...reviewData, rating: userRating || 0 });
      }
    } catch (err) {
      handleFirestoreError(err, isUpdating ? OperationType.UPDATE : OperationType.CREATE, 'reviews');
    } finally {
      setIsCommenting(false);
    }
  };

  // Calculate rating stats
  const ratedReviews = reviews.filter(r => r.rating && r.rating > 0);
  const totalRatings = ratedReviews.length;
  const avgRating = totalRatings > 0 ? ratedReviews.reduce((acc, r) => acc + r.rating, 0) / totalRatings : 0;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratedReviews.forEach(r => {
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating as keyof typeof distribution]++;
    }
  });

  const commentsList = reviews.filter(r => r.comment && r.comment.trim() !== '');

  if (!manga) return <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Detail Head */}
      <div className="flex flex-col md:flex-row gap-8 bg-white p-6 sm:p-8 rounded-[12px] shadow-theme-card border border-[#eee] relative overflow-hidden">
        <div className="w-full md:w-[220px] flex-shrink-0 relative z-10">
          <div className="relative w-full aspect-[2/3] rounded-md shadow-sm border border-[#eee] bg-[#e5e5e5] overflow-hidden">
            <img 
              src={getValidImageUrl(manga.coverUrl)} 
              alt={manga.title} 
              className={cn(
                "w-full h-full object-cover transition-all duration-500",
                manga.isR18 && !revealR18 ? "blur-xl scale-105" : ""
              )}
              referrerPolicy="no-referrer"
            />
            {manga.isR18 && !revealR18 && (
              <div className="absolute inset-0 flex items-end justify-center p-3">
                <button
                  type="button"
                  onClick={() => setRevealR18(true)}
                  className="px-4 py-2 bg-white/70 hover:bg-white/90 backdrop-blur border border-white/60 rounded-lg text-theme-ink shadow-sm text-[12px] font-medium transition-colors"
                >
                  显示封面
                </button>
              </div>
            )}
            {manga.isR18 && (
              <span className="absolute top-2 right-2 bg-red-500/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-sm pointer-events-none">
                R18
              </span>
            )}
          </div>
          {manga.submittedByName && (
            <div className="mt-3 text-center">
              <span className="text-[11px] text-theme-muted uppercase tracking-wide">推荐者</span>
              {manga.submittedBy ? (
                <Link to={`/user/${manga.submittedBy}`} className="block text-[12px] font-medium text-theme-ink mt-0.5 truncate px-2 hover:text-theme-accent transition-colors" title={manga.submittedByName}>
                  {manga.submittedByName}
                </Link>
              ) : (
                <p className="text-[12px] font-medium text-theme-ink mt-0.5 truncate px-2" title={manga.submittedByName}>
                  {manga.submittedByName}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 relative z-10 space-y-4 md:pt-4">
          <h1 className="font-serif text-[32px] font-light text-theme-ink leading-tight tracking-tight">{manga.title}</h1>
          
          <div className="flex items-center space-x-4 pb-4 border-b border-[#eee]">
            <div className="text-theme-accent text-[14px] font-medium flex items-center">
              ★ {manga.averageRating ? manga.averageRating.toFixed(1) : 'No Ratings'}
            </div>
            <span className="text-theme-muted text-[12px]">({manga.reviewCount || 0} 评分)</span>
          </div>

          <p className="text-theme-ink leading-relaxed text-[13px] whitespace-pre-wrap">{manga.description}</p>
          
          {manga.review && (
            <div className="mt-4 p-4 bg-theme-search rounded-lg border border-theme-accent/20">
              <h3 className="text-[12px] font-bold text-theme-accent mb-2">推荐语 / 阅读感想</h3>
              <p className="text-theme-ink leading-relaxed text-[13px] whitespace-pre-wrap">{manga.review}</p>
            </div>
          )}
          
          <div className="pt-4 pb-2">
            <a 
              href={`https://web.jmcomic.uk/detail/${manga.jmId}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-2.5 bg-theme-accent text-white rounded-lg text-[14px] font-medium hover:opacity-90 transition-all shadow-sm"
            >
              前往观看
            </a>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 text-[13px] border-t border-[#eee]">
            <div>
              <span className="block text-theme-muted mb-1">分类</span>
              <span className="text-theme-ink font-medium">{manga.category || '未分类'}</span>
            </div>
            <div>
              <span className="block text-theme-muted mb-1">作者</span>
              <span className="text-theme-ink font-medium">{manga.authors?.join(', ') || 'Unknown'}</span>
            </div>
            <div>
              <span className="block text-theme-muted mb-1">页面</span>
              <span className="text-theme-ink font-medium">{manga.pages || '?'}</span>
            </div>
          </div>

          <div className="pt-2">
            <span className="block text-theme-muted mb-2 text-[12px]">标签</span>
            <div className="flex flex-wrap gap-2">
              {manga.tags?.map((t: string) => (
                <span key={t} className="px-2 py-0.5 bg-theme-search text-theme-muted border border-[#eee] rounded text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rating & Reviews Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
        
        {/* Left: Rating System */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[12px] shadow-theme-card border border-[#eee]">
            <h2 className="text-[16px] font-serif text-theme-ink flex items-center mb-6">
              <Star className="w-4 h-4 mr-2 text-theme-accent fill-current" />
              作品评分
            </h2>
            
            {/* Rating Stats */}
            <div className="text-center mb-6">
              <div className="text-[48px] font-light text-theme-ink leading-none mb-2">
                {avgRating > 0 ? avgRating.toFixed(1) : '-'}
              </div>
              <div className="flex justify-center text-theme-accent mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-4 h-4 ${avgRating >= s ? 'fill-current' : avgRating >= s - 0.5 ? 'fill-current opacity-50' : 'text-[#eee]'}`} />
                ))}
              </div>
              <div className="text-[12px] text-theme-muted">{totalRatings} 人已评分</div>
            </div>

            {/* Distribution */}
            <div className="space-y-2 mb-8">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = distribution[stars as keyof typeof distribution];
                const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center text-[12px]">
                    <div className="w-8 text-theme-muted">{stars} 星</div>
                    <div className="flex-1 h-2 bg-[#eee] rounded-full overflow-hidden mx-3">
                      <div 
                        className="h-full bg-theme-accent rounded-full" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-theme-muted">{count}</div>
                  </div>
                );
              })}
            </div>

            {/* User Rating Action */}
            <div className="pt-6 border-t border-[#eee] text-center">
              <div className="text-[13px] text-theme-ink font-medium mb-3">
                {userRating > 0 ? '你的评分' : '给这部作品打分'}
              </div>
              <div className="flex justify-center space-x-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => handleRate(s)}
                    disabled={isRating}
                    className={`p-1 transition-transform hover:scale-110 ${userRating >= s ? 'text-theme-accent' : 'text-[#ddd] hover:text-theme-accent/50'}`}
                  >
                    <Star className={`w-7 h-7 ${userRating >= s ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
              {!user && (
                <p className="text-[11px] text-theme-muted mt-3">
                  <button onClick={() => openAuthModal('login')} className="text-theme-accent hover:underline">登录</button> 后即可评分
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Comments System */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-[20px] font-serif text-theme-ink flex items-center border-b border-[#eee] pb-4">
            <MessageSquareDashed className="w-5 h-5 mr-3 text-theme-accent" />
            讨论与留言
          </h2>

          {/* Comment Form */}
          {user ? (
            <form onSubmit={handleSubmitComment} className="bg-white p-6 rounded-[12px] border border-[#eee] shadow-sm">
              <textarea 
                required
                value={userComment} 
                onChange={(e) => setUserComment(e.target.value)}
                placeholder="在此留下你的评论..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-[#eee] bg-theme-search focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none text-[13px] transition-all resize-none mb-3"
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-theme-muted">
                  {userRating > 0 ? `将携带你的 ${userRating} 星评价发布` : '你尚未评分，将仅发布评论'}
                </span>
                <button 
                  type="submit" 
                  disabled={isCommenting || !userComment.trim()}
                  className="px-6 py-2 bg-theme-ink text-white rounded text-[13px] font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center"
                >
                  {isCommenting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  发布评论
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-theme-main border border-[#eee] rounded-lg p-6 text-center text-theme-muted text-[13px]">
              <p className="mb-3">登录后参与讨论</p>
              <button 
                onClick={() => openAuthModal('login')}
                className="px-6 py-2 bg-theme-accent text-white rounded text-[13px] font-medium hover:bg-theme-accent/90 transition-colors"
              >
                去登录
              </button>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4 mt-8">
            {commentsList.length === 0 ? (
              <p className="text-theme-muted text-[13px] text-center py-8 bg-white rounded-xl border border-[#eee] border-dashed">暂无评论，来做第一个发言的人吧！</p>
            ) : (
              commentsList.map((r) => (
                <div key={r.id} className="bg-white p-5 rounded-[12px] border border-[#eee] shadow-sm flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-full bg-theme-bg border border-[#eee] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <User className="w-5 h-5 text-[#ccc]" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-[14px] text-theme-ink flex items-center">
                          <Link to={`/user/${r.userId}`} className="hover:text-theme-accent transition-colors">
                            {r.customUsername || '匿名访客'}
                          </Link>
                          {r.jmUsername && <span className="ml-2 text-[11px] font-normal text-theme-muted bg-theme-bg px-2 py-0.5 rounded border border-[#eee]">JM: {r.jmUsername}</span>}
                        </h4>
                        {r.rating > 0 && (
                          <div className="flex items-center text-theme-accent mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-current' : 'text-[#eee]'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-theme-muted whitespace-nowrap ml-4">
                        {format(new Date(r.createdAt), 'yyyy-MM-dd')}
                      </span>
                    </div>
                    <p className="text-theme-ink mt-2 text-[13px] leading-relaxed whitespace-pre-wrap">{r.comment}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
