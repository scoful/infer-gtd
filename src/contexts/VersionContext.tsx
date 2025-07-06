import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  environment: string;
}

interface VersionContextType {
  versionInfo: VersionInfo | null;
  isLoading: boolean;
  error: string | null;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

interface VersionProviderProps {
  children: ReactNode;
}

export function VersionProvider({ children }: VersionProviderProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 只在客户端执行一次版本信息获取
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const fetchVersionInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/version');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data: VersionInfo = await response.json();
        
        if (isMounted) {
          setVersionInfo(data);
        }
      } catch (err) {
        console.warn('无法获取版本信息:', err);
        
        if (isMounted) {
          setError(err instanceof Error ? err.message : '获取版本信息失败');
          // 设置默认版本信息作为后备
          setVersionInfo({
            version: '1.0.0',
            major: 1,
            minor: 0,
            patch: 0,
            buildTime: new Date().toISOString(),
            gitCommit: '',
            gitBranch: '',
            environment: 'development'
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchVersionInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <VersionContext.Provider value={{ versionInfo, isLoading, error }}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion(): VersionContextType {
  const context = useContext(VersionContext);
  if (context === undefined) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
}
