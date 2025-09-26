import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { useEffect } from "react";

import { api } from "@/utils/api";
import { RefreshProvider } from "@/contexts/RefreshContext";
import { NotificationProvider } from "@/components/Layout/NotificationProvider";
import { VersionProvider } from "@/contexts/VersionContext";
import { initMobileDebug } from "@/utils/debug";

import "@/styles/globals.css";
// Toast UI Editor global styles (fix: ensure editor UI renders correctly)
import "@toast-ui/editor/dist/toastui-editor.css";
import "@toast-ui/editor/dist/toastui-editor-viewer.css";
import "@toast-ui/editor/dist/theme/toastui-editor-dark.css";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  // 初始化移动端调试工具
  useEffect(() => {
    // 只在客户端执行
    if (typeof window !== "undefined") {
      initMobileDebug().catch(console.error);
    }
  }, []);

  return (
    <SessionProvider session={session}>
      <VersionProvider>
        <RefreshProvider>
          <NotificationProvider position="top-center">
            <Component {...pageProps} />
          </NotificationProvider>
        </RefreshProvider>
      </VersionProvider>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
