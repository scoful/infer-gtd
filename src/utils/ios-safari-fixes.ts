/**
 * iOS Safari兼容性修复工具
 * 解决iOS Safari特有的问题
 */

// 检测iOS版本
export function getIOSVersion(): number | null {
  if (typeof window === "undefined") return null;

  const match = /OS (\d+)_(\d+)_?(\d+)?/.exec(navigator.userAgent);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// 检测Safari版本
export function getSafariVersion(): number | null {
  if (typeof window === "undefined") return null;

  const match = /Version\/(\d+)\.(\d+)/.exec(navigator.userAgent);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// 修复iOS Safari的viewport问题
export function fixIOSViewport() {
  if (typeof window === "undefined") return;

  // 防止iOS Safari在横屏时缩放
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );
  }

  // 修复iOS Safari的100vh问题
  function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }

  setVH();
  window.addEventListener("resize", setVH);
  window.addEventListener("orientationchange", () => {
    setTimeout(setVH, 100);
  });
}

// 修复iOS Safari的touch事件问题
export function fixIOSTouchEvents() {
  if (typeof window === "undefined") return;

  // 添加touch-action样式来改善触摸响应
  const style = document.createElement("style");
  style.textContent = `
    * {
      -webkit-tap-highlight-color: transparent;
    }
    
    button, a, [role="button"] {
      touch-action: manipulation;
    }
    
    input, textarea, select {
      -webkit-appearance: none;
      border-radius: 0;
    }
  `;
  document.head.appendChild(style);
}

// 修复iOS Safari的localStorage问题
export function fixIOSLocalStorage() {
  if (typeof window === "undefined") return;

  // 检测localStorage是否可用
  try {
    const testKey = "__localStorage_test__";
    localStorage.setItem(testKey, "test");
    localStorage.removeItem(testKey);
  } catch (e) {
    console.warn("localStorage不可用，使用内存存储替代");

    // 创建内存存储替代方案
    const memoryStorage: Record<string, string> = {};

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (key: string) => memoryStorage[key] || null,
        setItem: (key: string, value: string) => {
          memoryStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete memoryStorage[key];
        },
        clear: () => {
          Object.keys(memoryStorage).forEach(
            (key) => delete memoryStorage[key],
          );
        },
        get length() {
          return Object.keys(memoryStorage).length;
        },
        key: (index: number) => Object.keys(memoryStorage)[index] || null,
      },
      writable: false,
    });
  }
}

// 修复iOS Safari的fetch问题
export function fixIOSFetch() {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // 为iOS Safari添加额外的headers
    const enhancedInit: RequestInit = {
      ...init,
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...init?.headers,
      },
    };

    // 添加超时处理
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 30000);
    });

    try {
      return await Promise.race([
        originalFetch(input, enhancedInit),
        timeoutPromise,
      ]);
    } catch (error) {
      console.error("Fetch error in iOS Safari:", error);
      throw error;
    }
  };
}

// 修复iOS Safari的CSS问题
export function fixIOSCSS() {
  if (typeof window === "undefined") return;

  const style = document.createElement("style");
  style.textContent = `
    /* 修复iOS Safari的滚动问题 */
    body {
      -webkit-overflow-scrolling: touch;
    }
    
    /* 修复iOS Safari的flexbox问题 */
    .flex {
      display: -webkit-box;
      display: -webkit-flex;
      display: flex;
    }
    
    /* 修复iOS Safari的position: fixed问题 */
    .fixed {
      position: -webkit-sticky;
      position: fixed;
    }
    
    /* 修复iOS Safari的transform问题 */
    .transform {
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
    }
    
    /* 修复iOS Safari的backdrop-filter问题 */
    .backdrop-blur {
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
    }
    
    /* 修复iOS Safari的grid问题 */
    .grid {
      display: -ms-grid;
      display: grid;
    }
    
    /* 修复iOS Safari的min-height: 100vh问题 */
    .min-h-screen {
      min-height: 100vh;
      min-height: calc(var(--vh, 1vh) * 100);
    }
    
    /* 修复iOS Safari的input样式问题 */
    input[type="text"],
    input[type="email"],
    input[type="password"],
    textarea {
      -webkit-appearance: none;
      -webkit-border-radius: 0;
      border-radius: 0;
    }
    
    /* 修复iOS Safari的button样式问题 */
    button {
      -webkit-appearance: none;
      -webkit-border-radius: 0;
      border-radius: 0;
    }
  `;
  document.head.appendChild(style);
}

// 修复iOS Safari的事件监听问题
export function fixIOSEventListeners() {
  if (typeof window === "undefined") return;

  // 修复iOS Safari的passive事件监听器问题
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    // 为touch事件添加passive选项
    if (type.startsWith("touch") && typeof options === "object") {
      options = { ...options, passive: true };
    } else if (type.startsWith("touch") && typeof options === "undefined") {
      options = { passive: true };
    }

    return originalAddEventListener.call(this, type, listener, options);
  };
}

// 修复iOS Safari的Promise问题
export function fixIOSPromise() {
  if (typeof window === "undefined") return;

  // 检测Promise是否正常工作
  try {
    new Promise((resolve) => resolve(1)).then((value) => value).catch(() => {});
  } catch (e) {
    console.warn("Promise可能存在问题，加载polyfill");
    // 这里可以动态加载Promise polyfill
  }
}

// 修复iOS Safari的console问题
export function fixIOSConsole() {
  if (typeof window === "undefined") return;

  // 确保console对象存在
  if (!window.console) {
    window.console = {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
      group: () => {},
      groupEnd: () => {},
      time: () => {},
      timeEnd: () => {},
    } as Console;
  }
}

// 检测并报告iOS Safari的兼容性问题
export function detectIOSCompatibilityIssues() {
  if (typeof window === "undefined") return [];

  const issues: string[] = [];
  const iosVersion = getIOSVersion();
  const safariVersion = getSafariVersion();

  console.log(`📱 iOS版本: ${iosVersion}, Safari版本: ${safariVersion}`);

  // 检测已知的兼容性问题
  if (iosVersion && iosVersion < 14) {
    issues.push("iOS版本过低，可能存在兼容性问题");
  }

  if (safariVersion && safariVersion < 14) {
    issues.push("Safari版本过低，可能存在兼容性问题");
  }

  // 检测localStorage支持
  try {
    localStorage.setItem("test", "test");
    localStorage.removeItem("test");
  } catch (e) {
    issues.push("localStorage不可用");
  }

  // 检测fetch支持
  if (!window.fetch) {
    issues.push("fetch API不支持");
  }

  // 检测Promise支持
  if (!window.Promise) {
    issues.push("Promise不支持");
  }

  // 检测ES6特性支持
  try {
    eval("const test = () => {};");
  } catch (e) {
    issues.push("ES6语法不支持");
  }

  if (issues.length > 0) {
    console.warn("⚠️ 检测到兼容性问题:", issues);
  } else {
    console.log("✅ 未检测到明显的兼容性问题");
  }

  return issues;
}

// 统一的iOS Safari修复函数
export function applyIOSSafariFixes() {
  if (typeof window === "undefined") return;

  console.log("🔧 应用iOS Safari兼容性修复...");

  // 检测兼容性问题
  const issues = detectIOSCompatibilityIssues();

  // 应用各种修复
  fixIOSConsole();
  fixIOSViewport();
  fixIOSTouchEvents();
  fixIOSLocalStorage();
  fixIOSFetch();
  fixIOSCSS();
  fixIOSEventListeners();
  fixIOSPromise();

  console.log("✅ iOS Safari兼容性修复完成");

  return issues;
}
