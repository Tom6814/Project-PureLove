import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Heart, Shield, Sparkles, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

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

      {/* Hero */}
      <section className="relative flex flex-col lg:flex-row items-center gap-12 lg:gap-16 pt-12 lg:pt-24 z-10">
         {/* Text Content */}
         <div className="flex-1 space-y-6 lg:space-y-8 w-full">
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-accent/5 border border-theme-accent/20 text-theme-accent mb-6 lg:mb-8 text-[11px] tracking-[0.1em] uppercase font-medium shadow-sm">
               <Sparkles className="w-3.5 h-3.5" />
               <span>Artistic Flair Theme</span>
             </div>
             <h1 className="font-serif text-[42px] md:text-[56px] lg:text-[76px] leading-[1.1] text-theme-ink mb-6 tracking-[-0.02em]">
               守护纯爱的 <br className="hidden lg:block" />
               <span className="italic text-theme-accent font-light">最后净土</span>
             </h1>
             <p className="text-theme-muted text-[15px] md:text-[16px] leading-[1.8] max-w-md font-light">
               在这个喧闹的世界里，我们为您甄选最高质量的甜美纯爱本。<br className="hidden lg:block"/>告别胃痛与纠结，只保留最纯粹、最温暖的恋爱心跳。每一本都由社区热爱者精心提交与严格审核。
             </p>
           </motion.div>
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
             <Link to="/explore" className="inline-flex items-center justify-center gap-2 bg-theme-ink text-white px-8 py-3.5 rounded text-[13px] font-medium hover:bg-theme-accent hover:shadow-lg hover:shadow-theme-accent/20 transition-all duration-300 w-full sm:w-auto">
               进入漫库探寻 <ArrowRight className="w-4 h-4" />
             </Link>
             <Link to="/submit" onClick={handleSubmitClick} className="inline-flex items-center justify-center gap-2 bg-white text-theme-ink border border-[#ddd] px-8 py-3.5 rounded text-[13px] font-medium hover:bg-theme-bg transition-colors duration-300 w-full sm:w-auto shadow-sm">
               提交推荐
             </Link>
           </motion.div>
         </div>
         
         {/* Hero Imagery - Editorial Collage */}
         <div className="flex-1 w-full relative h-[400px] lg:h-[600px] hidden lg:block z-10 shrink-0">
            <div className="relative w-full h-full max-w-[550px] mx-auto">
              <motion.img 
                initial={{ opacity: 0, x: 30, y: 20, rotate: -4 }} animate={{ opacity: 1, x: 0, y: 0, rotate: -4 }} transition={{ duration: 1, delay: 0.2, type: "spring" }}
                src="https://images.unsplash.com/photo-1544640808-32cb4ceaa014?auto=format&fit=crop&q=80&w=600" 
                alt="Comic cover back" 
                className="absolute left-[0%] top-[15%] w-[45%] aspect-[2/3] object-cover rounded shadow-theme-card border-[8px] border-white z-10"
                referrerPolicy="no-referrer"
              />
              <motion.img 
                initial={{ opacity: 0, x: -30, y: -20, rotate: 6 }} animate={{ opacity: 1, x: 0, y: 0, rotate: 6 }} transition={{ duration: 1, delay: 0.4, type: "spring" }}
                src="https://images.unsplash.com/photo-1560930950-5cc20e80e392?auto=format&fit=crop&q=80&w=600" 
                alt="Comic cover front" 
                className="absolute right-[5%] top-[5%] w-[50%] aspect-[2/3] object-cover rounded shadow-2xl border-[8px] border-white z-20"
                referrerPolicy="no-referrer"
              />
              <motion.img 
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.6, type: "spring" }}
                src="https://images.unsplash.com/photo-1580459314319-0604fc2982d5?auto=format&fit=crop&q=80&w=600" 
                alt="Detail shot" 
                className="absolute bottom-[5%] left-[15%] w-[55%] h-[160px] object-cover rounded shadow-xl border-[6px] border-white z-30 rotate-[-2deg]"
                referrerPolicy="no-referrer"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.8 }}
                className="absolute -bottom-4 -right-4 bg-white/95 backdrop-blur p-4 rounded-lg shadow-xl border border-[#eee] z-40 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-theme-accent/10 rounded-full flex items-center justify-center text-theme-accent">
                   <Star className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="text-theme-ink font-serif text-[15px] font-medium">百万同好推荐</div>
                  <div className="text-theme-muted text-[11px] tracking-wide uppercase">Community Choice</div>
                </div>
              </motion.div>
            </div>
         </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-10 border-y border-[#eee] py-16 md:py-20">
        <FeatureCard 
          icon={<Shield className="w-5 h-5 text-theme-accent" />}
          title="100% 纯爱保证"
          desc="所有提交作品均经过管理员及社区联合审核，零雷区，让你放心食用高质量甜脆狗粮。"
        />
        <FeatureCard 
          icon={<Sparkles className="w-5 h-5 text-theme-accent" />}
          title="JM 同步解析"
          desc="只需输入JM号即可一键自动解析封面、标题与标签，告别繁琐的手动录入体验。"
        />
        <FeatureCard 
          icon={<Heart className="w-5 h-5 text-theme-accent" />}
          title="高雅交流社区"
          desc="在阅读后留下你的真实感受。我们崇尚文明、友善的评论氛围，在这里分享爱与感动。"
        />
      </section>

      {/* Bottom Call to Action */}
      <section className="bg-white rounded-[12px] p-10 md:p-16 text-center border border-[#eee] shadow-theme-card relative overflow-hidden">
         <div className="relative z-10">
           <h2 className="font-serif text-[28px] md:text-[32px] text-theme-ink mb-4 font-light">有发现令人心动的神作吗？</h2>
           <p className="text-theme-muted text-[13px] mb-8 max-w-md mx-auto leading-relaxed">
             为这片净土添砖加瓦。提交你珍藏的纯爱本子，让更多同好在漫库中感受这份美好。
           </p>
           <Link to="/submit" onClick={handleSubmitClick} className="inline-flex items-center gap-2 border border-theme-ink text-theme-ink px-8 py-3.5 rounded text-[13px] font-medium hover:bg-theme-ink hover:text-white transition-colors duration-300">
             立刻提交解析 <ArrowRight className="w-4 h-4" />
           </Link>
         </div>
         {/* Subtle background decoration */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-2xl opacity-[0.02] pointer-events-none">
           <Heart className="w-full h-full" />
         </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="space-y-4">
      <div className="w-12 h-12 rounded bg-theme-bg border border-[#eee] flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-serif text-[18px] text-theme-ink font-medium tracking-wide">{title}</h3>
      <p className="text-[13px] text-theme-muted leading-relaxed">
        {desc}
      </p>
    </div>
  );
}
