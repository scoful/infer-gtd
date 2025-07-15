import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";

import { api } from "@/utils/api";
import { RefreshProvider } from "@/contexts/RefreshContext";
import { NotificationProvider } from "@/components/Layout/NotificationProvider";
import { VersionProvider } from "@/contexts/VersionContext";

import "@/styles/globals.css";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
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
