import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Heart,
  ShieldCheck,
  Sparkles,
  Star,
  Globe2,
  Quote,
  Ban,
  Rainbow,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, mapMangaRow, type Manga } from '../lib/supabase';
import { getSourceName } from '../lib/utils';
import MangaCover from '../components/MangaCover';
import heroLeft from '../assets/hero-left.png';
import heroRight from '../assets/hero-right.png';

export default function LandingPage() {
  const { user, openAuthModal } = useAuth();
  const [latest, setLatest] = useState<Manga[]>([]);
  const [stats, setStats] = useState({ approved: 0, contributors: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ data: approved }, { count: contributors }] = await Promise.all([
          supabase
            .from('mangas')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(4),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
        ]);
        if (!active) return;
        setLatest((approved ?? []).map(mapMangaRow));
        setStats({
          approved: approved?.length ?? 0,
          contributors: contributors ?? 0,
        });
      } catch {
        /* keep empty state silently */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmitClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal('login');
    }
  };

  return (
    <div className="space-y-24 pb-16 relative">
      {/* Background Decor */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[500px] bg-theme-accent/5 rounded-[100%] blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-[-10%] w-[60%] h-[600px] bg-theme-accent/5 rounded-[100%] blur-[120px] pointer-events-none z-0" />

      {/* HERO */}
      <section className="relative pt-0 lg:pt-2 z-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-4 items-center max-w-[1400px] mx-auto min-h-[520px]">
          {/* Left Mascot — JM娘 (transparent PNG, fill the column) */}
          <motion.div
            initial={{ opacity: 0, x: -50, rotate: -5 }}
            animate={{ opacity: 1, x: 0, rotate: -5 }}
            transition={{ duration: 0.9, delay: 0.15, type: 'spring' }}
            className="hidden lg:flex lg:col-span-3 justify-center items-end h-full py-4"
          >
            <img
              src={heroLeft}
              alt="JM娘"
              className="w-[280px] xl:w-[330px] h-auto object-contain drop-shadow-[0_28px_45px_rgba(212,80,150,0.32)] select-none"
              draggable={false}
            />
          </motion.div>

          {/* Center Copy */}
          <div className="lg:col-span-6 space-y-7 text-center px-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-theme-accent/20 text-theme-accent text-[11px] tracking-[0.18em] uppercase font-medium shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Project RN · Reject NTR</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="font-serif text-[44px] md:text-[60px] lg:text-[72px] xl:text-[80px] leading-[1.08] text-theme-ink tracking-[-0.02em]"
            >
              拒绝牛头人，
              <br />
              <span className="italic text-theme-accent font-light">守护每一份</span>
              <br className="hidden sm:block" />
              纯真心跳。
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-theme-muted text-[15px] md:text-[16px] leading-[1.9] max-w-xl mx-auto font-light"
            >
              Project RN 收录 10 大漫画源头的优质本子，由站长与社区双重审核，
              <br className="hidden md:block" />
              把最甜、最真、最干净的恋爱故事留给你——纯爱，始终有位置。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1"
            >
              <Link
                to="/explore"
                className="inline-flex items-center justify-center gap-2 bg-theme-ink text-white px-8 py-3.5 rounded text-[13px] font-medium hover:bg-theme-accent hover:shadow-lg hover:shadow-theme-accent/20 transition-all duration-300"
              >
                进入漫库探寻 <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/submit"
                onClick={handleSubmitClick}
                className="inline-flex items-center justify-center gap-2 bg-white text-theme-ink border border-[#ddd] px-8 py-3.5 rounded text-[13px] font-medium hover:bg-theme-bg transition-colors shadow-sm"
              >
                提交推荐
              </Link>
            </motion.div>
          </div>

          {/* Right Mascot — bika娘 (transparent PNG) */}
          <motion.div
            initial={{ opacity: 0, x: 50, rotate: 5 }}
            animate={{ opacity: 1, x: 0, rotate: 5 }}
            transition={{ duration: 0.9, delay: 0.3, type: 'spring' }}
            className="hidden lg:flex lg:col-span-3 justify-center items-end py-6"
          >
            <div className="relative flex items-end">
              <img
                src={heroRight}
                alt="bika娘"
                className="w-[240px] xl:w-[270px] h-auto object-contain drop-shadow-[0_24px_40px_rgba(212,80,150,0.30)] select-none"
                draggable={false}
              />
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur px-4 py-2.5 rounded-lg shadow-xl border border-[#eee] flex items-center gap-2.5 whitespace-nowrap"
              >
                <div className="w-8 h-8 bg-theme-accent/10 rounded-full flex items-center justify-center text-theme-accent">
                  <Star className="w-4 h-4 fill-current" />
                </div>
                <div className="text-left">
                  <div className="text-theme-ink font-serif text-[13px] font-medium leading-tight">
                    社区同好甄选
                  </div>
                  <div className="text-theme-muted text-[9px] tracking-widest uppercase">
                    Curated · Approved
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STAT STRIP */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#eee] border-y border-[#eee] -mx-4 sm:-mx-8 lg:-mx-10">
        <Stat n={stats.approved} label="已收录优质本" suffix="部" />
        <Stat n={10} label="支持漫画源" suffix="+" />
        <Stat n={stats.contributors} label="活跃投稿人" />
        <Stat n={4.8} label="平均甜度" suffix="★" decimals={1} />
      </section>

      {/* LATEST ADDITIONS */}
      {latest.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-theme-accent font-medium mb-2">
                Latest Additions
              </div>
              <h2 className="font-serif text-[28px] md:text-[32px] text-theme-ink font-light leading-tight">
                最新收录
              </h2>
            </div>
            <Link
              to="/explore"
              className="text-[12px] text-theme-muted hover:text-theme-accent transition-colors flex items-center gap-1 shrink-0"
            >
              查看全部 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {latest.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                <Link to={`/manga/${m.id}`} className="group block">
                  <MangaCover
                    src={m.coverUrl}
                    alt={m.title}
                    isR18={m.isR18}
                    className="aspect-[2/3] rounded-lg bg-[#e5e5e5] mb-3 border border-black/[0.04]"
                    imgClassName="transition-transform duration-700 group-hover:scale-105"
                    blurClassName="blur-md scale-110 group-hover:scale-125"
                  />
                  <div className="text-[13px] font-medium text-theme-ink truncate" title={m.title}>
                    {m.title}
                  </div>
                  <div className="text-[11px] text-theme-muted mt-0.5">
                    {getSourceName(m.source)}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* PILLARS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-10 border-y border-[#eee] py-16 md:py-20">
        <Pillar
          icon={<ShieldCheck className="w-5 h-5" />}
          kicker="Zero NTR"
          title="零 NTR 底线"
          desc="所有作品由站长与管理员双重审核。背德剧情、撕心裂肺的胃药——统统拒之门外，只留最纯粹的甜。"
        />
        <Pillar
          icon={<Globe2 className="w-5 h-5" />}
          kicker="10 Sources"
          title="十源一站通"
          desc="禁漫、哔咔、e-hentai、nhentai、拷贝漫画、NoyAcg、Komiic、包子、再漫画、绅士漫画，一键解析入库。"
        />
        <Pillar
          icon={<Quote className="w-5 h-5" />}
          kicker="Honest Voice"
          title="真诚交流社区"
          desc="读完留下真实感受。我们拒绝引战与剧透，让每一份心动都被温柔对待。"
        />
      </section>

      {/* CONTENT POLICY */}
      <section>
        <div className="text-center mb-10">
          <div className="text-[11px] tracking-[0.2em] uppercase text-theme-accent font-medium mb-2">
            Content Policy
          </div>
          <h2 className="font-serif text-[28px] md:text-[32px] text-theme-ink font-light mb-3">
            内容红线与态度
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Banned */}
          <div className="bg-white border border-red-200 rounded-2xl p-7 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <Ban className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-serif text-[18px] font-medium text-theme-ink">
                坚决抵制
              </h3>
            </div>
            <ul className="space-y-2.5">
              {[
                '任何形式的 NTR（牛头人）',
                '猎奇、触手、强奸',
                '已婚外遇、卖淫、凌辱',
                '父女 / 母子及以上辈分的乱伦',
                '大叔题材',
                '金钱 / 权色交易',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-theme-muted leading-relaxed">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 pt-4 border-t border-[#f2f2f2] text-[12px] text-theme-muted leading-relaxed">
              以上题材一律禁止提交与收录，由站长与管理员双重把关，零容忍。
            </p>
          </div>

          {/* Inclusive */}
          <div className="bg-white border border-[#eee] rounded-2xl p-7 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-theme-accent/10 rounded-full flex items-center justify-center text-theme-accent">
                <Rainbow className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-serif text-[18px] font-medium text-theme-ink">
                尊重与包容
              </h3>
            </div>
            <ul className="space-y-2.5">
              {[
                '同性恋（BL / GL）',
                'LGBTQ+ 多元群体',
                '福瑞（Furry）题材',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-theme-muted leading-relaxed">
                  <span className="mt-[7px] w-1 h-1 rounded-full bg-theme-accent flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 pt-4 border-t border-[#f2f2f2] text-[12px] text-theme-muted leading-relaxed">
              我们充分理解并尊重相关群体，相关站点正在建设中，敬请期待。
              <span className="block mt-1 text-[11px] text-theme-muted/80">
                目前本站内容以 Straight（异性恋）题材为主。
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* SOURCES GRID */}
      <section>
        <div className="text-center mb-10">
          <div className="text-[11px] tracking-[0.2em] uppercase text-theme-accent font-medium mb-2">
            Supported Sources
          </div>
          <h2 className="font-serif text-[28px] md:text-[32px] text-theme-ink font-light mb-3">
            十大漫画源，一次解析
          </h2>
          <p className="text-theme-muted text-[13px] max-w-md mx-auto leading-relaxed">
            选择源 → 登录（如需）→ 搜索名字 → 自动获取封面、作者、详情。结果缓存进 Supabase，下次直接取用。
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SOURCES.map(s => (
            <div
              key={s.key}
              className="bg-white border border-[#eee] rounded-lg p-4 hover:border-theme-accent/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-theme-muted tracking-[0.18em] uppercase font-medium">
                  {s.tag}
                </span>
                {s.needLogin && (
                  <span className="text-[9px] text-theme-accent border border-theme-accent/30 rounded-full px-1.5 py-0.5 tracking-wider">
                    LOGIN
                  </span>
                )}
              </div>
              <div className="font-serif text-[15px] text-theme-ink font-medium leading-tight">
                {s.name}
              </div>
              <div className="text-[11px] text-theme-muted mt-1.5">
                {s.needLogin ? '需要登录后解析' : '免登录即可解析'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white rounded-[12px] p-10 md:p-16 text-center border border-[#eee] shadow-theme-card relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-[11px] tracking-[0.2em] uppercase text-theme-accent font-medium mb-3">
            Join the Sanctuary
          </div>
          <h2 className="font-serif text-[28px] md:text-[36px] text-theme-ink mb-4 font-light leading-tight">
            把你珍藏的那本，
            <br className="md:hidden" />
            也放进这片净土
          </h2>
          <p className="text-theme-muted text-[13px] mb-8 max-w-md mx-auto leading-relaxed">
            不论是甜到掉牙的日常，还是令人屏息的初恋心境——欢迎投稿，让更多同好在漫库中与你共鸣。
          </p>
          <Link
            to="/submit"
            onClick={handleSubmitClick}
            className="inline-flex items-center gap-2 border border-theme-ink text-theme-ink px-8 py-3.5 rounded text-[13px] font-medium hover:bg-theme-ink hover:text-white transition-colors"
          >
            立刻提交解析 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-2xl opacity-[0.02] pointer-events-none">
          <Heart className="w-full h-full" />
        </div>
      </section>
    </div>
  );
}

function Stat({
  n,
  label,
  suffix,
  decimals = 0,
}: {
  n: number;
  label: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div className="bg-theme-main p-6 md:p-8 text-center">
      <div className="font-serif text-[32px] md:text-[40px] text-theme-ink font-light leading-none mb-2">
        {n.toFixed(decimals)}
        {suffix && <span className="text-theme-accent text-[20px] ml-1">{suffix}</span>}
      </div>
      <div className="text-[11px] text-theme-muted tracking-[0.18em] uppercase">
        {label}
      </div>
    </div>
  );
}

function Pillar({
  icon,
  kicker,
  title,
  desc,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="space-y-4">
      <div className="w-12 h-12 rounded bg-theme-bg border border-[#eee] flex items-center justify-center text-theme-accent">
        {icon}
      </div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-theme-muted font-medium">
        {kicker}
      </div>
      <h3 className="font-serif text-[18px] text-theme-ink font-medium tracking-wide leading-tight">
        {title}
      </h3>
      <p className="text-[13px] text-theme-muted leading-relaxed">{desc}</p>
    </div>
  );
}

const SOURCES: { key: string; name: string; tag: string; needLogin: boolean }[] = [
  { key: 'jm', name: '禁漫 (JM)', tag: 'JM', needLogin: false },
  { key: 'bika', name: '哔咔 (Bika)', tag: 'BIKA', needLogin: true },
  { key: 'ehentai', name: 'e-hentai', tag: 'EH', needLogin: false },
  { key: 'nhentai', name: 'nhentai', tag: 'NH', needLogin: false },
  { key: 'copymanga', name: '拷贝漫画', tag: 'COPY', needLogin: false },
  { key: 'noyacg', name: 'NoyAcg', tag: 'NOY', needLogin: true },
  { key: 'komiic', name: 'Komiic', tag: 'KMC', needLogin: false },
  { key: 'baozimh', name: '包子漫画', tag: 'BAO', needLogin: false },
  { key: 'zaimanhua', name: '再漫画', tag: 'ZAI', needLogin: true },
  { key: 'wnacg', name: '绅士漫画', tag: 'WN', needLogin: false },
];
