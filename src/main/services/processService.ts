import { exec } from 'child_process';
import util from 'util';
import { RunningAppInfo } from '../../shared/types';

const execPromise = util.promisify(exec);

const CATEGORY_PROCESS_MAP: Record<string, { name: string; processName: string }> = {
  browser_chrome: { name: 'Google Chrome', processName: 'chrome.exe' },
  browser_edge: { name: 'Microsoft Edge', processName: 'msedge.exe' },
  browser_brave: { name: 'Brave Browser', processName: 'brave.exe' },
  browser_firefox: { name: 'Mozilla Firefox', processName: 'firefox.exe' },
  browser_opera: { name: 'Opera', processName: 'opera.exe' },
  app_discord: { name: 'Discord', processName: 'Discord.exe' },
  app_vscode: { name: 'Visual Studio Code', processName: 'Code.exe' },
  app_spotify: { name: 'Spotify', processName: 'Spotify.exe' },
  app_teams: { name: 'Microsoft Teams', processName: 'ms-teams.exe' },
  app_steam: { name: 'Steam', processName: 'steam.exe' },
  app_epic_games: { name: 'Epic Games Launcher', processName: 'EpicGamesLauncher.exe' },
  app_zoom: { name: 'Zoom', processName: 'Zoom.exe' },
};

export async function getRunningAppsForCategories(categoryIds: string[]): Promise<RunningAppInfo[]> {
  const targets = categoryIds
    .map((id) => {
      const match = CATEGORY_PROCESS_MAP[id];
      return match ? { id, name: match.name, processName: match.processName } : null;
    })
    .filter((t): t is RunningAppInfo => t !== null);

  if (targets.length === 0) {
    return [];
  }

  try {
    // Quick process snapshot on Windows (typically ~100-250ms)
    const { stdout } = await execPromise('tasklist /FO CSV /NH', { timeout: 2500 });
    const outputLower = stdout.toLowerCase();

    return targets.filter((target) => outputLower.includes(target.processName.toLowerCase()));
  } catch (err) {
    console.warn('Failed to inspect running tasks:', err);
    return [];
  }
}

export async function closeRunningApps(processNames: string[]): Promise<void> {
  for (const proc of processNames) {
    // Sanitize process name (must be a valid .exe filename)
    if (!/^[a-z0-9_.-]+\.exe$/i.test(proc)) continue;
    try {
      await execPromise(`taskkill /F /IM "${proc}"`, { timeout: 3000 });
    } catch {
      // Process might already be closed or access denied
    }
  }
}
