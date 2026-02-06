import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';

/**
 * 存储服务 - 管理本地数据
 */
class StorageService {
  /**
   * 保存连接 URL 到历史记录
   */
  async saveConnectionURL(url: string): Promise<void> {
    try {
      const urls = await this.getConnectionURLs();
      
      // 移除重复的 URL
      const filtered = urls.filter(u => u !== url);
      
      // 添加到开头
      filtered.unshift(url);
      
      // 只保留最近的 N 个
      const limited = filtered.slice(0, STORAGE_KEYS.MAX_URL_HISTORY || 5);
      
      await AsyncStorage.setItem(STORAGE_KEYS.CONNECTION_URLS, JSON.stringify(limited));
    } catch (error) {
      console.error('[Storage] Failed to save connection URL:', error);
    }
  }

  /**
   * 获取连接 URL 历史记录
   */
  async getConnectionURLs(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONNECTION_URLS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Storage] Failed to get connection URLs:', error);
      return [];
    }
  }

  /**
   * 删除指定的连接 URL
   */
  async removeConnectionURL(url: string): Promise<void> {
    try {
      const urls = await this.getConnectionURLs();
      const filtered = urls.filter(u => u !== url);
      await AsyncStorage.setItem(STORAGE_KEYS.CONNECTION_URLS, JSON.stringify(filtered));
    } catch (error) {
      console.error('[Storage] Failed to remove connection URL:', error);
    }
  }

  /**
   * 清空连接 URL 历史记录
   */
  async clearConnectionURLs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CONNECTION_URLS);
    } catch (error) {
      console.error('[Storage] Failed to clear connection URLs:', error);
    }
  }

  /**
   * 保存当前使用的 URL
   */
  async setCurrentURL(url: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_URL, url);
    } catch (error) {
      console.error('[Storage] Failed to save current URL:', error);
    }
  }

  /**
   * 获取上次使用的 URL
   */
  async getCurrentURL(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_URL);
    } catch (error) {
      console.error('[Storage] Failed to get current URL:', error);
      return null;
    }
  }
}

export default new StorageService();
