# 📚 作业打卡记录系统

一个简洁高效的作业打卡管理 Web 应用，帮助教师轻松记录和统计学生作业完成情况。

![作业打卡记录](https://img.shields.io/badge/作业打卡-管理系统-green)
![技术栈](https://img.shields.io/badge/技术栈-HTML%2FCSS%2FJS%2BSupabase-blue)

## ✨ 功能特性

- 📊 **多班级管理** - 支持多个班级，快速切换查看
- 👨‍🎓 **学生管理** - 按学号/姓名查看学生作业状态
- 📝 **作业记录** - 支持多科目、多作业的打卡记录
- 🏷️ **状态标记** - 未交/已交/优秀三种状态，一键切换
- 📈 **数据统计** - 实时统计班级作业完成率
- 🔐 **权限控制** - 管理员登录后可编辑，普通用户仅查看
- 📱 **响应式设计** - 完美适配手机、平板、电脑
- 💾 **云端同步** - 数据存储在 Supabase，多设备同步

## 🚀 快速开始

### 1. 在线访问

直接访问部署地址即可使用：

```
https://你的用户名.github.io/homework-tracker
# 或
https://homework-tracker.pages.dev
```

### 2. 本地运行

```bash
# 克隆仓库
git clone https://github.com/sly111/homework-tracker.git

# 进入目录
cd homework-tracker

# 用浏览器打开 index.html
# 或使用本地服务器
npx serve .
```

## ⚙️ 配置说明

### Supabase 配置

1. 访问 [Supabase](https://supabase.com) 创建项目
2. 在 `js/config.js` 中填写你的 Supabase 配置：

```javascript
const CONFIG = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  // ... 其他配置
};
```

### 数据库表结构

需要创建以下表：

- `classes` - 班级信息
- `students` - 学生信息
- `subjects` - 科目信息
- `homework_records` - 作业记录

详细的建表 SQL 请参考 [docs/database.sql](./docs/database.sql)（如有需要可自行添加）

## 📱 使用指南

### 管理员操作

1. 点击右上角 👤 图标登录
2. 登录后可：
   - 点击学生状态按钮切换（未交 → 已交 → 优秀）
   - 添加/删除作业
   - 修改学生姓名
   - 管理班级和科目

### 普通用户

- 无需登录即可查看
- 可按日期、班级、科目筛选
- 支持导出名单

## 🛠️ 技术栈

- **前端**：原生 HTML5 + CSS3 + JavaScript (ES6+)
- **后端**：Supabase (PostgreSQL + Auth)
- **部署**：GitHub Pages / Cloudflare Pages / Vercel

## 📁 项目结构

```
homework-tracker/
├── index.html          # 首页 - 班级概览
├── class.html          # 班级详情 - 学生作业列表
├── stats.html          # 统计页面
├── admin.html          # 管理员设置
├── css/
│   └── style.css       # 全局样式
├── js/
│   ├── config.js       # 配置文件
│   ├── supabase.js     # Supabase 客户端封装
│   ├── main.js         # 首页逻辑
│   ├── class.js        # 班级页逻辑
│   ├── stats.js        # 统计页逻辑
│   ├── admin.js        # 管理员逻辑
│   └── export.js       # 导出功能
└── README.md           # 本文件
```

## 🌐 部署方式

### 方案一：Cloudflare Pages（推荐国内访问）

1. Fork 本仓库到你的 GitHub
2. 登录 [Cloudflare](https://dash.cloudflare.com)
3. Pages → Create a project → Connect to Git
4. 选择仓库，Framework preset 选 `None`
5. 点击 Deploy

### 方案二：Vercel

1. 登录 [Vercel](https://vercel.com)
2. New Project → 导入 GitHub 仓库
3. Framework Preset 选 `Other`
4. 点击 Deploy

### 方案三：GitHub Pages

1. 仓库 Settings → Pages
2. Source 选择 `Deploy from a branch`
3. Branch 选择 `main`，文件夹选 `/ (root)`
4. 保存后即可访问

## ⚠️ 注意事项

1. **首次使用**前请务必配置 `js/config.js` 中的 Supabase 信息
2. **管理员账号**需要在 Supabase Auth 中预先创建
3. **跨域配置**：部署后需在 Supabase 中添加站点 URL 到允许列表

## 📝 更新日志

### v1.0.0 (2026-03-20)
- ✅ 基础功能完成
- ✅ 多班级、多科目支持
- ✅ 管理员权限控制
- ✅ 响应式移动端适配

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT License

---

Made with ❤️ by [sly111](https://github.com/sly111)
