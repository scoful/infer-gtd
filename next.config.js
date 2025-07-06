/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  transpilePackages: ["next-auth"],

  // Docker 部署优化
  output: "standalone",

  // 版本管理配置
  async rewrites() {
    return [
      {
        source: "/version.json",
        destination: "/api/version",
      },
    ];
  },
};

export default config;
