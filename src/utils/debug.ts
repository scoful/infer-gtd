/**
 * 移动端调试工具集成
 * 用于在iOS Safari等移动浏览器中进行调试
 */

import { applyIOSSafariFixes, isIOSDevice, isSafari } from "./ios-safari-fixes";
import { applyNextAuthIOSFixes } from "./nextauth-ios-fixes";

// 获取设备信息
export function getDeviceInfo() {
  if (typeof window === "undefined") return null;

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    screenWidth: screen.width,
    screenHeight: screen.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    isMobile:
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ),
    isIOS: isIOSDevice(),
    isSafari: isSafari(),
  };
}

// 初始化vConsole调试工具
export async function initVConsole() {
  // 只在特定条件下启用
  const shouldEnable =
    process.env.NODE_ENV === "development" ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) ||
    window.location.search.includes("debug=true") ||
    window.location.search.includes("vconsole=true");

  if (!shouldEnable) return;

  try {
    // 动态导入vConsole
    const VConsole = await import("vconsole");
    const vConsole = new VConsole.default({
      defaultPlugins: ["system", "network", "element", "storage"],
      theme: "dark",
    });

    // 输出设备信息到控制台
    console.log("🔧 vConsole已启用");
    console.log("📱 设备信息:", getDeviceInfo());

    return vConsole;
  } catch (error) {
    console.warn("⚠️ vConsole加载失败:", error);
    // 如果vConsole加载失败，启用基础错误收集
    initBasicErrorCollection();
  }
}

// 基础错误收集（备用方案）
export function initBasicErrorCollection() {
  if (typeof window === "undefined") return;

  // 创建错误显示容器
  const errorContainer = document.createElement("div");
  errorContainer.id = "mobile-debug-errors";
  errorContainer.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 300px;
    max-height: 200px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    font-size: 12px;
    padding: 10px;
    border-radius: 5px;
    z-index: 10000;
    overflow-y: auto;
    display: none;
    font-family: monospace;
  `;
  document.body.appendChild(errorContainer);

  // 创建切换按钮
  const toggleButton = document.createElement("button");
  toggleButton.textContent = "🐛";
  toggleButton.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    width: 40px;
    height: 40px;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 50%;
    z-index: 10001;
    font-size: 16px;
    cursor: pointer;
  `;

  let errorCount = 0;
  let isVisible = false;

  toggleButton.onclick = () => {
    isVisible = !isVisible;
    errorContainer.style.display = isVisible ? "block" : "none";
    toggleButton.style.background = isVisible ? "#44ff44" : "#ff4444";
  };

  document.body.appendChild(toggleButton);

  // 添加错误到容器
  function addError(
    message: string,
    type: "error" | "warn" | "info" = "error",
  ) {
    errorCount++;
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
      margin-bottom: 5px;
      padding: 5px;
      border-left: 3px solid ${type === "error" ? "#ff4444" : type === "warn" ? "#ffaa44" : "#4444ff"};
      background: rgba(255, 255, 255, 0.1);
    `;
    errorDiv.innerHTML = `
      <div style="font-weight: bold; color: ${type === "error" ? "#ff6666" : type === "warn" ? "#ffcc66" : "#6666ff"};">
        [${type.toUpperCase()}] ${new Date().toLocaleTimeString()}
      </div>
      <div>${message}</div>
    `;
    errorContainer.appendChild(errorDiv);
    errorContainer.scrollTop = errorContainer.scrollHeight;

    // 更新按钮显示错误数量
    toggleButton.textContent = `🐛${errorCount}`;

    // 如果错误太多，清理旧的
    if (errorContainer.children.length > 20) {
      errorContainer.removeChild(errorContainer.firstChild!);
    }
  }

  // 监听全局错误
  window.addEventListener("error", (event) => {
    addError(
      `${event.message}\n位置: ${event.filename}:${event.lineno}:${event.colno}`,
      "error",
    );
  });

  // 监听Promise拒绝
  window.addEventListener("unhandledrejection", (event) => {
    addError(`Promise拒绝: ${event.reason}`, "error");
  });

  // 重写console方法来捕获日志
  const originalConsole = {
    error: console.error,
    warn: console.warn,
    log: console.log,
  };

  console.error = (...args) => {
    originalConsole.error(...args);
    addError(args.join(" "), "error");
  };

  console.warn = (...args) => {
    originalConsole.warn(...args);
    addError(args.join(" "), "warn");
  };

  // 输出初始化信息
  addError("🔧 基础错误收集已启用", "info");
  addError(`📱 设备: ${navigator.userAgent}`, "info");
}

// 网络请求监控
export function initNetworkMonitoring() {
  if (typeof window === "undefined") return;

  // 监控fetch请求
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const startTime = Date.now();
    const url = args[0] instanceof Request ? args[0].url : args[0];

    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - startTime;

      console.log(`🌐 Fetch ${response.status}: ${url} (${duration}ms)`);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`🌐 Fetch Error: ${url} (${duration}ms)`, error);
      throw error;
    }
  };

  // 监控XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open.bind(
    XMLHttpRequest.prototype,
  );
  const originalXHRSend = XMLHttpRequest.prototype.send.bind(
    XMLHttpRequest.prototype,
  );

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    (this as any)._debugInfo = { method, url: url.toString(), startTime: 0 };
    return originalXHROpen.call(
      this,
      method,
      url,
      async ?? true,
      username,
      password,
    );
  };

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const debugInfo = (this as any)._debugInfo;
    if (debugInfo) {
      debugInfo.startTime = Date.now();

      this.addEventListener("loadend", () => {
        const duration = Date.now() - debugInfo.startTime;
        console.log(
          `🌐 XHR ${this.status}: ${debugInfo.method} ${debugInfo.url} (${duration}ms)`,
        );
      });
    }

    return originalXHRSend.call(this, body);
  };
}

// 性能监控
export function initPerformanceMonitoring() {
  if (typeof window === "undefined" || !window.performance) return;

  // 监控页面加载性能
  window.addEventListener("load", () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      if (perfData) {
        console.log("⚡ 页面性能数据:", {
          DNS查询: Math.round(
            perfData.domainLookupEnd - perfData.domainLookupStart,
          ),
          TCP连接: Math.round(perfData.connectEnd - perfData.connectStart),
          请求响应: Math.round(perfData.responseEnd - perfData.requestStart),
          DOM解析: Math.round(
            perfData.domContentLoadedEventEnd - perfData.responseEnd,
          ),
          页面加载: Math.round(perfData.loadEventEnd - perfData.fetchStart),
        });
      }
    }, 1000);
  });

  // 监控资源加载
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 1000) {
        // 只记录超过1秒的资源
        console.warn(
          `⚡ 慢资源: ${entry.name} (${Math.round(entry.duration)}ms)`,
        );
      }
    }
  });

  observer.observe({ entryTypes: ["resource"] });
}

// 统一初始化函数
export async function initMobileDebug() {
  if (typeof window === "undefined") return;

  console.log("🔧 初始化移动端调试工具...");

  // 首先应用iOS Safari修复（如果是iOS设备）
  if (isIOSDevice() && isSafari()) {
    console.log("📱 检测到iOS Safari，应用兼容性修复...");
    applyIOSSafariFixes();
    applyNextAuthIOSFixes();
  }

  // 输出设备信息
  console.log("📱 设备信息:", getDeviceInfo());

  // 尝试初始化vConsole
  await initVConsole();

  // 初始化网络监控
  initNetworkMonitoring();

  // 初始化性能监控
  initPerformanceMonitoring();

  console.log("✅ 移动端调试工具初始化完成");
}
