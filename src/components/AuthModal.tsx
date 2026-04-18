import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, Loader2, ShieldCheck, Github } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loginWithGoogle, loginWithGithub } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultMode }) => {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaTarget, setCaptchaTarget] = useState('');
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let cap = '';
    for(let i=0; i<4; i++) cap += chars.charAt(Math.floor(Math.random() * chars.length));
    setCaptchaTarget(cap);
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#faf9f6';
      ctx.fillRect(0, 0, width, height);
      
      // Increased Noise & Interference
      // 1. Interference Lines
      for(let i=0; i<12; i++) {
         ctx.beginPath();
         ctx.moveTo(Math.random() * width, Math.random() * height);
         ctx.lineTo(Math.random() * width, Math.random() * height);
         ctx.strokeStyle = `rgba(${Math.random()*100 + 100}, ${Math.random()*100 + 100}, ${Math.random()*100 + 100}, 0.5)`;
         ctx.lineWidth = Math.random() * 1.5;
         ctx.stroke();
      }
      // 2. Bezier Curves for complex interference
      for(let i=0; i<5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.bezierCurveTo(
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height
        );
        ctx.strokeStyle = `rgba(217, 162, 154, ${Math.random() * 0.4})`;
        ctx.lineWidth = Math.random() * 2 + 1;
        ctx.stroke();
      }
      // 3. Noise Dots
      for(let i=0; i<60; i++) {
         ctx.beginPath();
         ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.5, 0, 2 * Math.PI);
         ctx.fillStyle = `rgba(163, 155, 148, ${Math.random() * 0.8})`;
         ctx.fill();
      }
      
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillStyle = '#d9a29a';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const startX = width / 2 - 30;
      for(let i=0; i<cap.length; i++) {
          ctx.save();
          ctx.translate(startX + i * 20, height / 2);
          ctx.rotate((Math.random() - 0.5) * 0.4);
          ctx.fillText(cap[i], 0, 0);
          ctx.restore();
      }
    }
  };

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setCaptchaInput('');
      setError('');
    }
  }, [isOpen, defaultMode]);

  // Generate captcha when mode becomes register
  React.useEffect(() => {
    if (isOpen && mode === 'register') {
      // Add a slight delay to ensure canvas is mounted
      setTimeout(() => generateCaptcha(), 50);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      if (captchaInput.toLowerCase() !== captchaTarget.toLowerCase()) {
        setError('图形验证码错误，请重新输入');
        generateCaptcha();
        setCaptchaInput('');
        return;
      }
    }

    if (!email || !password) return;
    setLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      // Very basic error parsing
      let msg = 'Authentication failed';
      if (err.code === 'auth/email-already-in-use') msg = '邮箱已被注册';
      else if (err.code === 'auth/weak-password') msg = '密码太弱 (至少6位)';
      else if (err.code === 'auth/invalid-email') msg = '无效的邮箱格式';
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = '邮箱或密码不正确';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (error) {
      setError('Google 登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubAuth = async () => {
    setLoading(true);
    try {
      await loginWithGithub();
      onClose();
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        setError('GitHub 登录尚未开启，请在 Firebase 控制台中启用。');
      } else {
        setError('GitHub 登录失败，请重试。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-theme-ink/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-[12px] shadow-2xl border border-[#eee] w-full max-w-sm p-8 overflow-hidden"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-theme-muted hover:text-theme-ink transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-serif text-[28px] font-light text-theme-ink tracking-tight mb-6 mt-2 text-center">
          {mode === 'login' ? '欢迎回来' : '加入净化计划'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] text-theme-muted ml-1">邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input 
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-theme-search border border-transparent rounded focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none text-[13px] transition-all"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] text-theme-muted ml-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input 
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-theme-search border border-transparent rounded focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none text-[13px] transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-[12px] text-theme-muted ml-1">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                  <input 
                    type="password" required={mode === 'register'}
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-theme-search border border-transparent rounded focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none text-[13px] transition-all"
                    placeholder="请再次输入密码"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-theme-muted ml-1">人机验证</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                    <input 
                      type="text" required={mode === 'register'}
                      value={captchaInput} onChange={e => setCaptchaInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-theme-search border border-transparent rounded focus:bg-white focus:border-theme-accent focus:ring-1 focus:ring-theme-accent outline-none text-[13px] transition-all uppercase"
                      placeholder="看不清？点击右侧图片刷新"
                      maxLength={4}
                    />
                  </div>
                  <div 
                    className="w-[100px] h-[40px] rounded border border-[#eee] overflow-hidden cursor-pointer shrink-0 bg-theme-bg flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
                    onClick={generateCaptcha}
                    title="看不清？点击刷新"
                  >
                    <canvas ref={canvasRef} width={100} height={40} className="w-full h-full" />
                  </div>
                </div>
              </div>
            </>
          )}

          {error && <div className="text-[12px] text-red-500 bg-red-50 p-2 rounded">{error}</div>}

          <button 
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-theme-ink text-white rounded-[6px] text-[13px] font-medium hover:bg-black transition-colors flex justify-center items-center h-10 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === 'login' ? '登录' : '注册并进入')}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#eee] space-y-3">
          <button 
            type="button" 
            onClick={handleGoogleAuth} disabled={loading}
            className="w-full py-2.5 bg-theme-search text-theme-ink border border-[#eee] rounded-[6px] text-[13px] font-medium hover:bg-[#f5f5f5] transition-colors flex justify-center items-center h-10 gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            使用 Google 继续
          </button>

          <button 
            type="button" 
            onClick={handleGithubAuth} disabled={loading}
            className="w-full py-2.5 bg-[#24292e] text-white rounded-[6px] text-[13px] font-medium hover:bg-[#1a1e22] transition-colors flex justify-center items-center h-10 gap-2"
          >
            <Github className="w-4 h-4" />
            使用 GitHub 继续
          </button>
        </div>

        <div className="mt-6 text-center text-[12px] text-theme-muted">
          {mode === 'login' ? (
            <span>还没有账号? <button type="button" onClick={() => setMode('register')} className="text-theme-ink hover:underline">立即注册</button></span>
          ) : (
            <span>已经有账号了? <button type="button" onClick={() => setMode('login')} className="text-theme-ink hover:underline">直接登录</button></span>
          )}
        </div>
      </motion.div>
    </div>
  );
};
