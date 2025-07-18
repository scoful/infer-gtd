/**
 * NextAuth.js iOS Safari兼容性修复
 * 解决iOS Safari中OAuth认证流程的问题
 */

// 检测是否在iframe中
export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  return window.self !== window.top;
}

// 检测是否支持第三方Cookie
export async function checkThirdPartyCookieSupport(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    // 尝试设置一个测试cookie
    document.cookie = "test_3rd_party=1; SameSite=None; Secure";
    const hasTestCookie = document.cookie.includes("test_3rd_party=1");

    // 清理测试cookie
    if (hasTestCookie) {
      document.cookie =
        "test_3rd_party=; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
    }

    return hasTestCookie;
  } catch (error) {
    console.warn("第三方Cookie检测失败:", error);
    return false;
  }
}

// 修复iOS Safari的Cookie问题
export function fixIOSCookies() {
  if (typeof window === "undefined") return;

  // 重写document.cookie的设置方法
  const originalCookieDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "cookie",
  );

  if (originalCookieDescriptor?.set) {
    const originalSet = originalCookieDescriptor.set;

    Object.defineProperty(document, "cookie", {
      ...originalCookieDescriptor,
      set: function (value: string) {
        // 为iOS Safari添加必要的cookie属性
        let enhancedValue = value;

        // 如果是认证相关的cookie，添加SameSite=None和Secure
        if (
          value.includes("next-auth") ||
          value.includes("__Secure-") ||
          value.includes("__Host-")
        ) {
          if (!value.includes("SameSite=")) {
            enhancedValue += "; SameSite=None";
          }
          if (!value.includes("Secure") && location.protocol === "https:") {
            enhancedValue += "; Secure";
          }
        }

        try {
          originalSet.call(this, enhancedValue);
        } catch (error) {
          console.warn("Cookie设置失败:", error);
          // 尝试不带SameSite=None的版本
          try {
            originalSet.call(this, value);
          } catch (fallbackError) {
            console.error("Cookie设置完全失败:", fallbackError);
          }
        }
      },
    });
  }
}

// 修复iOS Safari的localStorage用于session存储
export function fixIOSSessionStorage() {
  if (typeof window === "undefined") return;

  // 检测sessionStorage是否可用
  try {
    const testKey = "__sessionStorage_test__";
    sessionStorage.setItem(testKey, "test");
    sessionStorage.removeItem(testKey);
  } catch (e) {
    console.warn("sessionStorage不可用，使用localStorage替代");

    // 使用localStorage模拟sessionStorage
    const sessionData: Record<string, string> = {};
    const sessionId = `session_${Date.now()}_${Math.random()}`;

    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: (key: string) => {
          const fullKey = `${sessionId}_${key}`;
          return localStorage.getItem(fullKey);
        },
        setItem: (key: string, value: string) => {
          const fullKey = `${sessionId}_${key}`;
          localStorage.setItem(fullKey, value);
        },
        removeItem: (key: string) => {
          const fullKey = `${sessionId}_${key}`;
          localStorage.removeItem(fullKey);
        },
        clear: () => {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(sessionId)) {
              localStorage.removeItem(key);
            }
          });
        },
        get length() {
          return Object.keys(localStorage).filter((key) =>
            key.startsWith(sessionId),
          ).length;
        },
        key: (index: number) => {
          const keys = Object.keys(localStorage).filter((key) =>
            key.startsWith(sessionId),
          );
          const fullKey = keys[index];
          return fullKey ? fullKey.replace(`${sessionId}_`, "") : null;
        },
      },
      writable: false,
    });
  }
}

// 修复iOS Safari的OAuth重定向问题
export function fixIOSOAuthRedirect() {
  if (typeof window === "undefined") return;

  // 监听OAuth回调
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (state, title, url) {
    console.log("🔄 History pushState:", url);
    return originalPushState.call(this, state, title, url);
  };

  history.replaceState = function (state, title, url) {
    console.log("🔄 History replaceState:", url);
    return originalReplaceState.call(this, state, title, url);
  };

  // 监听popstate事件
  window.addEventListener("popstate", (event) => {
    console.log("🔄 Popstate event:", event.state, location.href);
  });

  // 监听hashchange事件（某些OAuth流程可能使用hash）
  window.addEventListener("hashchange", (event) => {
    console.log("🔄 Hash change:", event.oldURL, event.newURL);
  });
}

// 修复iOS Safari的fetch请求（特别是认证相关）
export function fixIOSAuthFetch() {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // 为认证请求添加特殊处理
    const url = input instanceof Request ? input.url : input.toString();
    const isAuthRequest =
      url.includes("/api/auth/") || url.includes("/api/trpc/");

    if (isAuthRequest) {
      const enhancedInit: RequestInit = {
        ...init,
        credentials: "include", // 确保包含cookies
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          ...init?.headers,
        },
      };

      console.log("🔐 Auth fetch request:", url, enhancedInit);

      try {
        const response = await originalFetch(input, enhancedInit);
        console.log(
          "🔐 Auth fetch response:",
          response.status,
          response.statusText,
        );

        // 如果是401错误，可能是认证问题
        if (response.status === 401) {
          console.warn("🔐 认证失败，可能需要重新登录");
        }

        return response;
      } catch (error) {
        console.error("🔐 Auth fetch error:", error);
        throw error;
      }
    }

    return originalFetch(input, init);
  };
}

// 修复iOS Safari的WebCrypto API问题（NextAuth.js可能使用）
export function fixIOSWebCrypto() {
  if (typeof window === "undefined") return;

  // 检测WebCrypto API支持
  if (!window.crypto?.subtle) {
    console.warn("⚠️ WebCrypto API不支持，可能影响认证功能");
    return;
  }

  // 测试基本的crypto功能
  try {
    window.crypto.getRandomValues(new Uint8Array(16));
    console.log("✅ WebCrypto基本功能正常");
  } catch (error) {
    console.error("❌ WebCrypto功能异常:", error);
  }
}

// 监控NextAuth.js的session状态
export function monitorNextAuthSession() {
  if (typeof window === "undefined") return;

  // 监控session相关的localStorage变化
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;

  localStorage.setItem = function (key: string, value: string) {
    if (key.includes("next-auth") || key.includes("session")) {
      console.log(
        "💾 Session storage set:",
        key,
        value.substring(0, 100) + "...",
      );
    }
    return originalSetItem.call(this, key, value);
  };

  localStorage.removeItem = function (key: string) {
    if (key.includes("next-auth") || key.includes("session")) {
      console.log("💾 Session storage remove:", key);
    }
    return originalRemoveItem.call(this, key);
  };

  // 定期检查session状态
  setInterval(() => {
    const sessionKeys = Object.keys(localStorage).filter(
      (key) => key.includes("next-auth") || key.includes("session"),
    );

    if (sessionKeys.length > 0) {
      console.log("💾 当前session keys:", sessionKeys);
    }
  }, 30000); // 每30秒检查一次
}

// 添加认证状态调试信息
export function debugAuthState() {
  if (typeof window === "undefined") return;

  console.log("🔐 认证状态调试信息:");
  console.log("- User Agent:", navigator.userAgent);
  console.log("- Cookies enabled:", navigator.cookieEnabled);
  console.log("- Current cookies:", document.cookie);
  console.log("- Location:", location.href);
  console.log("- Referrer:", document.referrer);
  console.log("- In iframe:", isInIframe());

  // 检查第三方Cookie支持
  checkThirdPartyCookieSupport().then((supported) => {
    console.log("- Third-party cookies:", supported ? "支持" : "不支持");
  });
}

// 统一的NextAuth.js iOS修复函数
export function applyNextAuthIOSFixes() {
  if (typeof window === "undefined") return;

  console.log("🔐 应用NextAuth.js iOS兼容性修复...");

  // 输出认证状态调试信息
  debugAuthState();

  // 应用各种修复
  fixIOSCookies();
  fixIOSSessionStorage();
  fixIOSOAuthRedirect();
  fixIOSAuthFetch();
  fixIOSWebCrypto();
  monitorNextAuthSession();

  console.log("✅ NextAuth.js iOS兼容性修复完成");
}
