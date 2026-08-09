import React from 'react';
import { cn, getValidImageUrl } from '../lib/utils';
import { useSettings } from '../hooks/useSettings';

interface MangaCoverProps {
  /** 封面图 URL（自动经过 getValidImageUrl 处理） */
  src: string;
  alt?: string;
  isR18?: boolean;
  /** 追加到外层容器 div 的类（尺寸 / 圆角 / 背景等） */
  className?: string;
  /** 追加到 <img> 的类（如 hover 缩放效果） */
  imgClassName?: string;
  /** R18 模糊时 <img> 使用的额外类，默认 blur-md scale-105 */
  blurClassName?: string;
  /** 角标文案，默认 R18；传空字符串则不显示角标 */
  badgeText?: string;
}

/**
 * 封面图公共组件：统一 R18 模糊（跟随全局 enableR18Blur 设置）+ R18 角标。
 * 用于首页最新收录、漫库列表、个人主页、管理后台等所有展示封面的地方。
 */
export default function MangaCover({
  src,
  alt = '',
  isR18 = false,
  className = '',
  imgClassName = '',
  blurClassName = 'blur-md scale-105',
  badgeText = 'R18',
}: MangaCoverProps) {
  const { settings } = useSettings();
  const shouldBlur = settings.enableR18Blur && isR18;

  return (
    <div className={cn('relative overflow-hidden bg-[#e5e5e5]', className)}>
      {src ? (
        <img
          src={getValidImageUrl(src)}
          alt={alt}
          loading="lazy"
          className={cn(
            'w-full h-full object-cover',
            shouldBlur && blurClassName,
            imgClassName
          )}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-theme-muted text-[11px]">
          No Cover
        </div>
      )}
      {isR18 && badgeText && (
        <span className="absolute top-2 right-2 bg-red-500/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shadow-sm pointer-events-none">
          {badgeText}
        </span>
      )}
    </div>
  );
}
