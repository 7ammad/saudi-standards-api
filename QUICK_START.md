# Quick Start - Deploy to Render

## 1. Push to GitHub

```powershell
git init
git add .
git commit -m "Saudi Standards API - Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/saudi-standards-api.git
git push -u origin main
```

## 2. Deploy on Render

1. Go to https://render.com → "New +" → "Web Service"
2. Connect your GitHub repo
3. Render will auto-detect `render.yaml` - just click "Create Web Service"
4. Wait 5-10 minutes for deployment
5. Copy your URL: `https://saudi-standards-api.onrender.com`

## 3. Update OpenAPI & Connect GPT

1. Edit `openapi.json` - replace the server URL with your Render URL
2. In Custom GPT → Actions → Schema → Paste `openapi.json` contents
3. Set Auth to "None"
4. Save

## 4. Test

```powershell
# Test deployed API
Invoke-RestMethod -Uri "https://YOUR-APP.onrender.com/health"
```

Then test in GPT:
```
Find HCIS security requirements for perimeter fencing
```

Done!

