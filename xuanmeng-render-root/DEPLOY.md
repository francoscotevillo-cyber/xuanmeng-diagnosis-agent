# 宣盟获客诊断 Agent 上线说明

## 推荐部署方式

这个版本是 Node 后端应用，不是纯静态站。推荐部署到：

- Render
- Railway
- Fly.io
- 阿里云/腾讯云轻量服务器
- Docker 容器平台

## 本地运行

```bash
cd xuanmeng-diagnosis-agent
npm start
```

打开：

```text
http://127.0.0.1:3000
```

## Render / Railway

配置：

- Build Command: 留空或 `npm install`
- Start Command: `npm start`
- Node Version: 20 或更高

部署后访问平台生成的网址即可。

## Docker

```bash
docker build -t xuanmeng-diagnosis-agent .
docker run -p 3000:3000 xuanmeng-diagnosis-agent
```

## 当前能力

- `POST /api/analyze`
- 服务端抓取官网首页和站内重点页面
- 自动提取 SEO/GEO/信任/询盘信号
- 前端自动回填并生成诊断报告

## 重要说明

部分网站可能会屏蔽服务端抓取，或需要浏览器渲染 JavaScript 才能看到正文。后续正式商用版可升级 Playwright 渲染抓取、代理池、站点地图解析和付费 SEO API。
