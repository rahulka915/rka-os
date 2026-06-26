import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/tauri';
import type { ProjectConfig, ProjectHealth } from '../lib/types';

export function useProject() {
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    api.getProjectConfig().then(c => setConfig(c));
  }, []);

  const selectPath = useCallback(async (path: string) => {
    const newConfig = await api.setProjectPath(path);
    setConfig(newConfig);
    return newConfig;
  }, []);

  const updateConfig = useCallback(async (updated: ProjectConfig) => {
    await api.saveProjectConfig(updated);
    setConfig(updated);
  }, []);

  const refreshHealth = useCallback(async () => {
    if (!config) return;
    setLoadingHealth(true);
    try {
      const h = await api.checkEnvironment();
      setHealth(h);
    } finally {
      setLoadingHealth(false);
    }
  }, [config]);

  return { config, health, loadingHealth, selectPath, updateConfig, refreshHealth };
}
