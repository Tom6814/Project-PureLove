import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Search } from 'lucide-react';
import { cn, getValidImageUrl } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useSettings } from '../hooks/useSettings';

export default function HomePage() {
  const { settings } = useSettings();
  const [mangas, setMangas] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minRating, setMinRating] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'mangas'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMangas(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'mangas');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = mangas.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) || 
                          m.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;

    const rating = m.averageRating || 0;
    const matchesRating = minRating === 0 || rating >= minRating;

    return matchesSearch && matchesCategory && matchesRating;
  });

  return (
    <div className="space-y-8">
      {/* Title & Search Section */}
      <section className="flex flex-col md:flex-row gap-6 md:items-end justify-between border-b border-[#eee] pb-6">
        <div>
          <h2 className="font-serif text-[32px] font-light text-theme-ink tracking-tight leading-none mb-2">本周纯爱推荐</h2>
          <p className="text-[13px] text-theme-muted">精选高画质、剧情唯美的诚意之作</p>
        </div>
        
        <div className="relative w-full max-w-[400px]">
          <Search className="absolute left-[15px] top-1/2 -translate-y-1/2 text-theme-muted w-4 h-4" />
          <input 
            type="text"
            placeholder="搜索漫画名、作者、JM号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-theme-search border-none rounded-lg text-[13px] text-theme-ink placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-theme-accent/30 transition-all font-sans"
          />
        </div>
      </section>

      {/* Filter Tags */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {['All', '日漫', '韩漫', '其他'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors border",
                selectedCategory === cat
                  ? "bg-theme-ink text-white border-theme-ink shadow-sm"
                  : "bg-white text-theme-muted border-[#eee] hover:border-theme-accent hover:text-theme-accent shadow-sm"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-theme-muted whitespace-nowrap">评分筛选:</span>
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="px-2 py-1.5 border border-[#eee] rounded text-[12px] text-theme-ink focus:outline-none focus:ring-1 focus:ring-theme-accent bg-white"
          >
            <option value={0}>全部评价</option>
            <option value={4}>4星及以上</option>
            <option value={4.5}>4.5星及以上</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <section>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="animate-pulse bg-[#e5e5e5] rounded-xl aspect-[2/3] w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-theme-muted text-[13px]">
            No pure love mangas found. Check back later or submit one!
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {filtered.map((manga, idx) => (
              <motion.div
                key={manga.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link to={`/manga/${manga.id}`} className="group block h-full bg-white rounded-xl overflow-hidden shadow-theme-card border border-black/[0.03] transition-all hover:-translate-y-1">
                  <div className="aspect-[2/3] overflow-hidden bg-[#e5e5e5] relative">
                    <img 
                      src={getValidImageUrl(manga.coverUrl)} 
                      alt={manga.title}
                      className={cn(
                        "w-full h-full object-cover group-hover:opacity-90 transition-all duration-500",
                        settings.enableR18Blur && manga.isR18 ? "blur-md scale-105" : ""
                      )}
                      referrerPolicy="no-referrer"
                    />
                    {settings.enableR18Blur && manga.isR18 && (
                      <span className="absolute top-2 right-2 bg-red-500/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-sm pointer-events-none">R18</span>
                    )}
                  </div>
                  <div className="p-[15px]">
                    <div className="font-semibold text-[14px] text-theme-ink mb-1 whitespace-nowrap overflow-hidden text-ellipsis" title={manga.title}>
                      {manga.title}
                    </div>
                    <div className="text-[12px] text-theme-muted">
                      作者: {manga.authors?.join(', ') || 'Unknown'}
                    </div>
                    <div className="flex justify-between mt-[10px] text-[11px] text-theme-accent">
                      <span>★ {manga.averageRating ? manga.averageRating.toFixed(1) : '暂无评分'} ({manga.reviewCount || 0} 评分)</span>
                      <span>JM{manga.jmId}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 p-5 border border-dashed border-[#ddd] rounded-xl flex items-center justify-center text-theme-muted font-sans text-[13px]">
        点击上方 Submit Manga 提交JM号，管理员审核通过后即可在此发现您的珍藏
      </div>
    </div>
  );
}
