# 代购业务管理系统 (Daigou CRM & Order System)

## 📌 零成本架构说明
- **前端**：Next.js 15 + Tailwind CSS (极致贴合现代极简审美)
- **存储**：Supabase (利用 500MB DB + 1GB Storage 终身免费配额)
- **OCR识别**：Tesseract.js (在客户浏览器运行，并启用 IndexedDB 缓存 30MB 中文字库，无需担忧云端带宽费用与隐私)
- **部署**：Vercel (全球 CDN 加速，永久免费计划)

---

## 🚀 阶段 3：自动化与一键部署指南

由于你的代码已经就绪，请按照以下步骤零成本上线系统：

### 1. 数据库初始化 (Supabase)
1. 访问 [Supabase](https://supabase.com) 并新建一个免费 Project。
2. 左侧导航栏进入 **SQL Editor**。
3. 将我们在“阶段1”定型的 SQL Schema 完整粘贴并运行（表包含：`clients`, `client_addresses`, `products`, `orders`, `order_items`）。

### 2. 本地测试运行
在你的 VSCode 终端中运行以下命令开启本地预览：
```bash
npm run dev
```
打开 `http://localhost:3000` 即可：
- ✅ 测试 Dashboard 收益看板展示。
- ✅ 进入 `/orders`（订单流转页），尝试点击虚线框后直接 **Ctrl+V** 粘贴你的微信聊天截图。首次粘贴它会静默下载识别缓存库，后续均为秒出！一键智能提取“收货信息”。

### 3. Vercel 一键发布 (自动化脚本)
Vercel 的发布极其简便，它会自动检测 Next.js 框架。打开终端运行：

```bash
# 1. 全局安装 Vercel 命令行工具
npm i -g vercel

# 2. 登录 Vercel (网页授权即可，极速完成)
vercel login

# 3. 将当前机器环境一键发布至生产环境
vercel --prod
```
运行 `vercel --prod` 时，一直敲回车（Enter）同意默认选项即可：
- **Set up and deploy?** [Y]
- **Which scope do you want to deploy to?** [选你的用户名]
- **Link to existing project?** [N]
- **What's your project's name?** [默认可不改]
- **In which directory is your code located?** [./]

结束后，进度条会显示部署完成，同时会返回一个专属于你的 `.vercel.app` 免费域名。

### 4. 环境变量配置
当需要打通并持久化真实数据时，在 Vercel 后台进入该项目的 **Settings -> Environment Variables**，填入你的服务凭证即可：
- `NEXT_PUBLIC_SUPABASE_URL` = 你的 Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 你的 Supabase API Key
