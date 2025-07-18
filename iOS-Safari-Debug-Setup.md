# iOS Safari调试工具安装和使用指南

## 📦 安装依赖

首先安装vConsole调试工具：

```bash
# 使用pnpm（推荐）
pnpm add vconsole

# 或使用npm
npm install vconsole

# 或使用yarn
yarn add vconsole
```

## 🔧 已集成的功能

### 1. 移动端调试工具 (`src/utils/debug.ts`)
- **vConsole**: 移动端开发者工具，显示console日志、网络请求等
- **基础错误收集**: 当vConsole不可用时的备用方案
- **网络请求监控**: 监控fetch和XMLHttpRequest请求
- **性能监控**: 监控页面加载和资源加载性能

### 2. iOS Safari兼容性修复 (`src/utils/ios-safari-fixes.ts`)
- **Viewport修复**: 解决iOS Safari的viewport和100vh问题
- **Touch事件修复**: 改善触摸响应和tap高亮
- **LocalStorage修复**: 提供localStorage不可用时的内存存储替代
- **Fetch修复**: 为iOS Safari添加超时和错误处理
- **CSS兼容性**: 添加webkit前缀和iOS特定样式
- **事件监听器修复**: 修复passive事件监听器问题

### 3. NextAuth.js iOS修复 (`src/utils/nextauth-ios-fixes.ts`)
- **Cookie修复**: 为认证cookie添加SameSite=None和Secure属性
- **SessionStorage修复**: 提供sessionStorage不可用时的localStorage替代
- **OAuth重定向监控**: 监控OAuth认证流程的重定向
- **认证请求修复**: 为认证相关的fetch请求添加特殊处理
- **WebCrypto检测**: 检测和报告WebCrypto API支持情况

## 🚀 使用方法

### 自动启用条件
调试工具会在以下情况自动启用：
- 开发环境 (`NODE_ENV === 'development'`)
- 移动设备访问
- URL包含 `?debug=true` 或 `?vconsole=true`

### 手动启用
在浏览器地址栏添加参数：
```
https://your-domain.com?debug=true
```

### vConsole主题设置
支持浅色和深色主题，可通过以下方式设置：

#### 方法1: URL参数
```
# 浅色主题
https://your-domain.com?debug=true&vconsole-theme=light

# 深色主题
https://your-domain.com?debug=true&vconsole-theme=dark
```

#### 方法2: localStorage设置
```javascript
// 在浏览器控制台执行
localStorage.setItem('vconsole-theme', 'light');  // 浅色主题
localStorage.setItem('vconsole-theme', 'dark');   // 深色主题
```

#### 方法3: 全局函数切换
```javascript
// 在vConsole控制台执行
switchVConsoleTheme('light');  // 切换到浅色主题
switchVConsoleTheme('dark');   // 切换到深色主题
```

#### 自动主题检测
- 如果没有手动设置，会自动检测系统主题偏好
- 支持 `prefers-color-scheme` 媒体查询
- 默认使用浅色主题

### 查看调试信息
1. **vConsole面板**: 页面右下角会出现vConsole按钮
2. **基础错误收集**: 页面左上角会出现🐛按钮（当vConsole不可用时）
3. **浏览器控制台**: 所有调试信息都会输出到控制台

## 📱 iOS Safari调试方法

### 方法1: 使用Mac + iPhone调试（推荐）
1. **准备工作**:
   - 用数据线连接iPhone到Mac
   - iPhone: 设置 → Safari → 高级 → Web检查器（开启）
   - Mac: Safari → 偏好设置 → 高级 → 在菜单栏中显示"开发"菜单

2. **开始调试**:
   - 在iPhone Safari中打开网站
   - Mac Safari → 开发 → [iPhone设备名] → 选择对应页面
   - 在Mac上查看完整的开发者工具

### 方法2: 使用vConsole（本项目已集成）
1. 在iPhone Safari中访问网站
2. 添加URL参数: `?debug=true`
3. 页面右下角会出现vConsole按钮
4. 点击按钮查看Console、Network、Element等信息

### 方法3: 查看iOS Safari错误日志
1. iPhone: 设置 → Safari → 高级 → JavaScript → 启用
2. 如果页面有JavaScript错误，地址栏会显示错误提示

## 🔍 常见问题诊断

### 问题1: 页面卡在"加载中"
**可能原因**:
- JavaScript执行错误
- 网络请求失败
- React组件渲染异常

**调试方法**:
```javascript
// 查看控制台输出
console.log('📱 设备信息:', getDeviceInfo());

// 检查网络请求
// 所有fetch请求都会被监控并输出到控制台
```

### 问题2: 页面卡在"验证身份中"
**可能原因**:
- NextAuth.js认证流程问题
- Cookie设置失败
- OAuth重定向问题

**调试方法**:
```javascript
// 查看认证状态
debugAuthState();

// 检查Cookie支持
checkThirdPartyCookieSupport().then(supported => {
  console.log('Third-party cookies:', supported);
});
```

### 问题3: 网络请求失败
**可能原因**:
- CORS问题
- 请求超时
- 服务器错误

**调试方法**:
- 查看vConsole的Network面板
- 检查控制台的网络请求日志

## 🛠️ 自定义配置

### 启用更详细的日志
```javascript
// 在浏览器控制台执行
localStorage.setItem('debug', 'true');
```

### 禁用某些修复
```javascript
// 在 src/utils/debug.ts 中修改
export async function initMobileDebug() {
  // 注释掉不需要的修复
  // applyIOSSafariFixes();
  // applyNextAuthIOSFixes();
}
```

### 添加自定义调试信息
```javascript
// 在任何组件中添加
useEffect(() => {
  console.log('🔧 组件调试信息:', {
    props,
    state,
    deviceInfo: getDeviceInfo()
  });
}, []);
```

## 📊 性能监控

调试工具会自动监控：
- 页面加载时间
- 资源加载时间
- 网络请求耗时
- 慢资源警告（超过1秒）

查看性能数据：
```javascript
// 在控制台查看性能日志
// 标记为 ⚡ 的日志是性能相关信息
```

## 🚨 注意事项

1. **生产环境**: 调试工具在生产环境默认不启用，除非手动添加URL参数
2. **性能影响**: vConsole会对性能有轻微影响，建议只在需要时启用
3. **隐私**: 调试工具会记录网络请求和错误信息，注意敏感数据
4. **兼容性**: 某些修复可能影响其他浏览器的行为，已做兼容性检测

## 📝 日志说明

- 🔧 初始化和配置信息
- 📱 设备和浏览器信息
- 🌐 网络请求信息
- ⚡ 性能监控信息
- 🔐 认证相关信息
- ⚠️ 警告信息
- ❌ 错误信息
- ✅ 成功信息
