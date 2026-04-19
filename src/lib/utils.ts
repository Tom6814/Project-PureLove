import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getValidImageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.includes('jmapiproxy.vip') || url.includes('nvs22.com')) {
    return url.replace(/^https?:\/\/[^\/]+/, 'https://www.cdnhjk.net');
  }
  return url;
}
