import { apiClient } from "../../../services/api";
import type { CommandItem, CommandListResponse } from "../types/command";

export class CommandService {
  private static instance: CommandService;
  private cache: CommandItem[] | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_TTL = 30000; // 30秒缓存

  private constructor() {}

  static getInstance(): CommandService {
    if (!CommandService.instance) {
      CommandService.instance = new CommandService();
    }
    return CommandService.instance;
  }

  async listCommands(forceRefresh = false): Promise<CommandItem[]> {
    const now = Date.now();

    if (!forceRefresh && this.cache && now - this.cacheTime < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      const response = await apiClient.get<CommandListResponse>("commands");
      this.cache = response.commands;
      this.cacheTime = now;
      console.log("[CommandService] Loaded commands:", this.cache.length);
      return this.cache;
    } catch (error) {
      console.error("[CommandService] Failed to list commands:", error);
      throw error;
    }
  }

  async getCommand(type: string, id: string): Promise<any> {
    try {
      return await apiClient.get<any>(`commands/${type}/${id}`);
    } catch (error) {
      console.error(
        `[CommandService] Failed to get command ${type}/${id}:`,
        error,
      );
      throw error;
    }
  }

  clearCache() {
    this.cache = null;
    this.cacheTime = 0;
  }
}
