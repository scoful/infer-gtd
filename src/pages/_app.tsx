import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { Geist } from "next/font/google";

import { api } from "@/utils/api";
import { RefreshProvider } from "@/contexts/RefreshContext";
import { NotificationProvider } from "@/components/Layout/NotificationProvider";
import { VersionProvider } from "@/contexts/VersionContext";

import "@/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <VersionProvider>
        <RefreshProvider>
          <NotificationProvider position="top-center">
            <div className={geist.className}>
              <Component {...pageProps} />
            </div>
          </NotificationProvider>
        </RefreshProvider>
      </VersionProvider>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
