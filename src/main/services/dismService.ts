import { exec } from 'child_process';
import util from 'util';
import { DismAnalysisResult, DismCleanResult } from '../../shared/types';

const execPromise = util.promisify(exec);

export class DismService {
  /**
   * Analyzes the Windows Component Store (WinSxS)
   */
  public async analyzeComponentStore(): Promise<DismAnalysisResult> {
    try {
      const { stdout } = await execPromise(
        'dism.exe /Online /Cleanup-Image /AnalyzeComponentStore',
        { timeout: 120000 } // 2 min timeout
      );

      return this.parseDismAnalysis(stdout);
    } catch (err: any) {
      return {
        reportedSizeMB: 0,
        actualSizeMB: 0,
        sharedSizeMB: 0,
        backupsSizeMB: 0,
        reclaimablePackages: 0,
        cleanupRecommended: false,
        rawOutput: err.message || 'DISM execution failed.',
      };
    }
  }

  /**
   * Performs deep component store cleanup
   */
  public async cleanComponentStore(): Promise<DismCleanResult> {
    try {
      const { stdout } = await execPromise(
        'dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase',
        { timeout: 300000 } // 5 min timeout
      );

      return {
        success: true,
        output: stdout,
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: err.message || 'Failed to execute DISM Component Cleanup. Requires Administrator privileges.',
      };
    }
  }

  private parseDismAnalysis(output: string): DismAnalysisResult {
    const parseSizeMB = (pattern: RegExp): number => {
      const match = output.match(pattern);
      if (!match) return 0;
      const val = parseFloat(match[1]);
      const unit = match[2]?.toUpperCase() || 'GB';
      if (unit.includes('GB')) return Math.round(val * 1024);
      if (unit.includes('MB')) return Math.round(val);
      return Math.round(val);
    };

    const reportedSizeMB = parseSizeMB(/Windows Explorer Reported Size of Component Store\s*:\s*([\d.]+)\s*(GB|MB)/i);
    const actualSizeMB = parseSizeMB(/Actual Size of Component Store\s*:\s*([\d.]+)\s*(GB|MB)/i);
    const sharedSizeMB = parseSizeMB(/Shared with Windows\s*:\s*([\d.]+)\s*(GB|MB)/i);
    const backupsSizeMB = parseSizeMB(/Backups and Disabled Features\s*:\s*([\d.]+)\s*(GB|MB)/i);

    const pkgsMatch = output.match(/Number of Reclaimable Packages\s*:\s*(\d+)/i);
    const reclaimablePackages = pkgsMatch ? parseInt(pkgsMatch[1], 10) : 0;

    const cleanupRecommended = /Component Store Cleanup Recommended\s*:\s*Yes/i.test(output);

    return {
      reportedSizeMB,
      actualSizeMB,
      sharedSizeMB,
      backupsSizeMB,
      reclaimablePackages,
      cleanupRecommended,
      rawOutput: output,
    };
  }
}

