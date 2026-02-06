import { DEFAULT_WS_URL } from '../constants/config';

/**
 * 格式化 WebSocket URL
 * - 自动添加 ws:// 或 wss:// 前缀
 * - 移除 /ws 后缀（如有）
 */
export function formatWebSocketURL(url: string): string {
  let formattedUrl = url.trim();
  
  // 移除末尾的斜杠和 /ws
  formattedUrl = formattedUrl.replace(/\/ws\/?$/, '');
  formattedUrl = formattedUrl.replace(/\/$/, '');
  
  // 如果已经是 ws:// 或 wss://，直接返回
  if (formattedUrl.startsWith('ws://') || formattedUrl.startsWith('wss://')) {
    return formattedUrl;
  }
  
  // 如果是 https://，转换为 wss://
  if (formattedUrl.startsWith('https://')) {
    return formattedUrl.replace('https://', 'wss://');
  }
  
  // 如果是 http://，转换为 ws://
  if (formattedUrl.startsWith('http://')) {
    return formattedUrl.replace('http://', 'ws://');
  }
  
  // 默认添加 ws://
  return `ws://${formattedUrl}`;
}

/**
 * 验证 WebSocket URL 格式
 */
export function isValidWebSocketURL(url: string): boolean {
  try {
    const formatted = formatWebSocketURL(url);
    const parsed = new URL(formatted);
    
    // 只允许 ws:// 和 wss:// 协议
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

/**
 * 从服务器 URL（https://xxx/ws）提取 WebSocket URL
 */
export function extractWebSocketURL(serverURL: string): string {
  // 移除末尾的 /ws
  const url = serverURL.replace(/\/ws\/?$/, '');
  
  // 转换为 wss:// 或 ws://
  if (url.startsWith('https://')) {
    return url.replace('https://', 'wss://');
  }
  if (url.startsWith('http://')) {
    return url.replace('http://', 'ws://');
  }
  
  return url;
}
