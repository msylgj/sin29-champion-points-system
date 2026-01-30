# H5 前端开发计划 - 移动端适配

**项目**: 射箭赛事积分统计系统 - H5 移动版  
**版本**: 1.0.0  
**目标**: 支持移动端和桌面端访问，优化移动体验

---

## 📱 移动适配策略

### 设计原则

1. **移动优先** (Mobile-First)
   - 先设计移动端界面
   - 然后逐步适配桌面端
   - 确保小屏幕最佳体验

2. **响应式布局**
   - 使用 CSS Grid 和 Flexbox
   - 支持多种屏幕尺寸
   - 流体布局

3. **触摸友好**
   - 按钮大小 ≥ 44px × 44px
   - 合理的间距
   - 快速响应

4. **性能优先**
   - 图片优化
   - 代码分割
   - 懒加载

---

## 🎨 UI 框架选择

### Vant 3 (推荐)

**优点:**
- 专为移动设计
- Vue 3 原生支持
- 丰富的组件库
- 完善的文档
- 中文支持优秀

**组件:**
- Navigation Bar
- Tab Bar
- Form 组件
- Dialog/Toast
- Loading
- Pull Refresh

---

## 📋 页面规划

### Phase 4.1: 基础页面结构

#### 1. 主仪表板 (Dashboard)
```
┌─────────────────────┐
│   顶部导航栏        │
├─────────────────────┤
│   用户欢迎信息      │
│   关键数据卡片      │
│   • 总参赛次数      │
│   • 总积分          │
│   • 排名            │
├─────────────────────┤
│   快速操作按钮      │
│   • 录入成绩        │
│   • 查看排名        │
│   • 查看赛事        │
├─────────────────────┤
│   最近成绩列表      │
│   （可滑动加载）    │
├─────────────────────┤
│   底部标签栏        │
│   • 首页 | 成绩     │
│   • 排名 | 我的     │
└─────────────────────┘
```

#### 2. 成绩管理页 (Scores)
```
┌─────────────────────┐
│   顶部过滤器        │
│   年度/季度/赛制    │
├─────────────────────┤
│   成绩列表          │
│   ┌──────────────┐  │
│   │ 赛事名称     │  │
│   │ 距离/赛制    │  │
│   │ 排名: 3  分数:19 点│
│   └──────────────┘  │
│   ┌──────────────┐  │
│   │ ...          │  │
│   └──────────────┘  │
├─────────────────────┤
│   录入成绩按钮      │
│   (悬浮按钮)       │
└─────────────────────┘
```

#### 3. 录入成绩页 (Score Form)
```
┌─────────────────────┐
│   返回/标题         │
├─────────────────────┤
│   表单字段          │
│   □ 年度            │
│   □ 季度            │
│   □ 距离            │
│   □ 赛制            │
│   □ 性别分组        │
│   □ 弓种            │
│   □ 原始成绩        │
│   □ 排名            │
│   □ 参赛人数        │
├─────────────────────┤
│   提交 | 取消       │
└─────────────────────┘
```

#### 4. 排名页 (Rankings)
```
┌─────────────────────┐
│   年度/季度选择     │
├─────────────────────┤
│   排名列表          │
│   ┌──────────────┐  │
│   │ 🥇 1. 张三   │  │
│   │    积分: 145 │  │
│   │    参赛: 5次 │  │
│   └──────────────┘  │
│   ┌──────────────┐  │
│   │ 🥈 2. 李四   │  │
│   │    积分: 138 │  │
│   │    参赛: 4次 │  │
│   └──────────────┘  │
│   ┌──────────────┐  │
│   │ 🥉 3. 王五   │  │
│   │    积分: 125 │  │
│   │    参赛: 4次 │  │
│   └──────────────┘  │
├─────────────────────┤
│   加载更多          │
└─────────────────────┘
```

#### 5. 个人页面 (My Profile)
```
┌─────────────────────┐
│   用户信息          │
│   👤 姓名           │
│   📞 电话           │
│   👫 性别           │
├─────────────────────┤
│   统计信息          │
│   • 总成绩数: 12   │
│   • 总积分: 145.5  │
│   • 最高排名: 2名   │
├─────────────────────┤
│   设置              │
│   • 语言设置        │
│   • 关于应用        │
│   • 检查更新        │
└─────────────────────┘
```

---

## 🛠️ 技术栈

### 核心库
```json
{
  "vue": "^3.5.0",
  "vue-router": "^4.6.0",
  "pinia": "^3.0.0",
  "axios": "^1.12.0",
  "vant": "^4.8.0"
}
```

### 工具库
```json
{
  "date-fns": "^3.0.0",        // 日期处理
  "lodash-es": "^4.17.0",      // 工具函数
  "qs": "^6.11.0",             // 参数序列化
  "nprogress": "^0.2.0"        // 进度条
}
```

### 开发工具
```json
{
  "postcss": "^8.4.0",
  "autoprefixer": "^10.4.0",
  "vite": "^4.5.0",
  "sass": "^1.70.0"
}
```

---

## 📐 响应式断点

```css
/* 移动优先 */
@media (min-width: 320px) { /* 小手机 */ }
@media (min-width: 480px) { /* 大手机 */ }
@media (min-width: 768px) { /* 平板 */ }
@media (min-width: 1024px) { /* 小屏桌面 */ }
@media (min-width: 1280px) { /* 大屏桌面 */ }
```

---

## 🎯 H5 特定考虑

### 1. 视口配置
```html
<meta name="viewport" 
      content="width=device-width, 
               initial-scale=1.0, 
               viewport-fit=cover">
```

### 2. 安全区域 (iPhone)
```css
.safe-area {
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 3. 触摸事件优化
```javascript
// 减少点击延迟
document.addEventListener('touchstart', function() {});

// 处理长按
const handleLongPress = () => { /* ... */ };
```

### 4. 屏幕方向
```javascript
window.addEventListener('orientationchange', () => {
  // 处理方向改变
});
```

---

## 📦 文件结构

```
frontend/src/
├── components/
│   ├── common/
│   │   ├── Header.vue          # 顶部导航
│   │   ├── BottomNav.vue       # 底部标签栏
│   │   ├── FloatingButton.vue  # 悬浮按钮
│   │   └── Loading.vue         # 加载组件
│   ├── dashboard/
│   │   ├── StatsCard.vue       # 统计卡片
│   │   ├── RecentScores.vue    # 最近成绩
│   │   └── QuickActions.vue    # 快速操作
│   ├── scores/
│   │   ├── ScoreList.vue       # 成绩列表
│   │   ├── ScoreForm.vue       # 成绩表单
│   │   └── ScoreFilter.vue     # 筛选器
│   ├── rankings/
│   │   ├── RankingList.vue     # 排名列表
│   │   ├── RankingCard.vue     # 排名卡片
│   │   └── RankingChart.vue    # 排名图表
│   └── profile/
│       ├── ProfileCard.vue     # 个人信息
│       ├── Statistics.vue      # 统计信息
│       └── Settings.vue        # 设置
├── views/
│   ├── Dashboard.vue           # 仪表板页面
│   ├── Scores.vue              # 成绩管理页面
│   ├── ScoreDetail.vue         # 成绩详情
│   ├── ScoreCreate.vue         # 新建成绩
│   ├── Rankings.vue            # 排名页面
│   ├── Profile.vue             # 个人页面
│   ├── Settings.vue            # 设置页面
│   └── NotFound.vue            # 404 页面
├── styles/
│   ├── variables.scss          # 变量定义
│   ├── responsive.scss         # 响应式样式
│   ├── components.scss         # 组件样式
│   └── animations.scss         # 动画
├── utils/
│   ├── api.js                  # API 调用
│   ├── validation.js           # 表单验证
│   ├── formatter.js            # 数据格式化
│   └── device.js               # 设备检测
├── store/
│   ├── modules/
│   │   ├── user.js             # 用户信息
│   │   ├── scores.js           # 成绩数据
│   │   └── rankings.js         # 排名数据
│   └── index.js
├── router/
│   └── index.js                # 路由配置
└── App.vue
```

---

## 🚀 开发阶段

### Phase 4.1: 基础搭建 (1-2天)
- [ ] Vant 3 集成
- [ ] 响应式基础样式
- [ ] 路由配置
- [ ] API 通讯设置

### Phase 4.2: 核心页面 (2-3天)
- [ ] 仪表板页面
- [ ] 成绩管理页面
- [ ] 排名页面
- [ ] 个人页面

### Phase 4.3: 表单和交互 (1-2天)
- [ ] 成绩录入表单
- [ ] 表单验证
- [ ] 数据提交
- [ ] 错误处理

### Phase 4.4: 优化和测试 (1天)
- [ ] 性能优化
- [ ] 移动端测试
- [ ] 浏览器兼容性
- [ ] 用户体验优化

---

## 📱 移动端考虑事项

### 1. 屏幕尺寸
```
iPhone SE: 375px × 667px
iPhone 11: 414px × 896px
iPhone 12 Pro: 390px × 844px
iPhone 14 Pro Max: 430px × 932px
```

### 2. 性能优化
- 代码分割
- 图片优化
- 缓存策略
- 首屏加载时间 < 3s

### 3. 功能适配
- 下拉刷新
- 上拉加载
- 手势操作
- 离线支持（可选）

### 4. 适配特殊设备
- 刘海屏（iPhone X+）
- 虚拟键盘
- 状态栏

---

## 📋 实现清单

### 第一阶段: 项目搭建
- [ ] 安装 Vant 3
- [ ] 配置 PostCSS
- [ ] 创建基础样式
- [ ] 设置响应式网格
- [ ] 配置路由

### 第二阶段: 通用组件
- [ ] Header 导航栏
- [ ] BottomNav 标签栏
- [ ] FloatingButton 悬浮按钮
- [ ] Loading 加载状态
- [ ] Toast 提示

### 第三阶段: 业务页面
- [ ] Dashboard 仪表板
- [ ] Scores 成绩列表
- [ ] Rankings 排名列表
- [ ] Profile 个人资料

### 第四阶段: 交互功能
- [ ] 下拉刷新
- [ ] 上拉加载
- [ ] 表单提交
- [ ] 实时验证

### 第五阶段: 优化测试
- [ ] 性能优化
- [ ] 浏览器测试
- [ ] 移动端测试
- [ ] 无障碍测试

---

## 🎨 样式指南

### 颜色方案
```scss
// 主色
$primary: #007AFF;
$primary-dark: #0051D5;

// 辅助色
$success: #34C759;
$warning: #FF9500;
$danger: #FF3B30;
$info: #5AC8FA;

// 中性色
$dark: #1F1F1F;
$gray-dark: #8E8E93;
$gray: #C7C7CC;
$gray-light: #E5E5EA;
$light: #F9F9F9;
$white: #FFFFFF;
```

### 排版
```scss
// 标题
$font-size-h1: 28px;
$font-size-h2: 24px;
$font-size-h3: 20px;
$font-size-h4: 18px;

// 正文
$font-size-body: 16px;
$font-size-small: 14px;
$font-size-xs: 12px;

// 行高
$line-height-tight: 1.2;
$line-height-normal: 1.5;
$line-height-loose: 1.8;
```

---

**文档版本**: 1.0.0  
**更新日期**: 2026-01-30  
**状态**: 开发中
