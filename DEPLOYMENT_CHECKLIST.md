# Deployment Checklist - Phase 3

## Pre-Deployment Verification

- [x] All JSON files in `/data` directory (21 files)
- [x] Server loads and normalizes data (31 records)
- [x] All endpoints tested locally
- [x] `render.yaml` configured
- [x] `openapi.json` ready
- [x] TypeScript builds successfully

## Step 1: Push to GitHub

```powershell
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Saudi Standards API with 31 normalized records"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/saudi-standards-api.git

# Push to main branch
git push -u origin main
```

## Step 2: Deploy on Render

1. Go to https://render.com and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `saudi-standards-api`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: (leave empty)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run build; npm start`
   - **Environment**: `Production`
5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. Copy your service URL (e.g., `https://saudi-standards-api.onrender.com`)

## Step 3: Update OpenAPI Schema

1. Open `openapi.json`
2. Update the production server URL:
   ```json
   "servers": [
     {
       "url": "https://YOUR-APP-NAME.onrender.com"
     }
   ]
   ```
3. Save the file

## Step 4: Test Deployed API

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://YOUR-APP-NAME.onrender.com/health"

# Test search endpoint
$body = @{query='facility'; limit=3} | ConvertTo-Json
Invoke-RestMethod -Uri "https://YOUR-APP-NAME.onrender.com/standards/searchRequirements" -Method POST -Body $body -ContentType "application/json"
```

## Step 5: Connect to Custom GPT

1. Open your Custom GPT in ChatGPT
2. Go to **Configure** → **Actions**
3. Click **Create new action**
4. In the **Schema** field, paste the entire contents of `openapi.json`
5. Set **Authentication** to "None" (or add API key later)
6. Click **Save**

## Step 6: Test in GPT

In the GPT chat, try:
```
Use the standards API to find HCIS security requirements for perimeter fencing. Call searchRequirements with standard='HCIS_SEC' and query='fence'.
```

You should see the GPT calling your API and returning results.

## Troubleshooting

### Build fails on Render
- Check build logs in Render dashboard
- Ensure `package.json` has correct scripts
- Verify TypeScript compiles: `npm run build` locally

### API returns 404
- Check that server started successfully
- Verify `/data` directory exists in deployment
- Check Render logs for errors

### GPT can't call API
- Verify URL in `openapi.json` matches Render URL
- Check CORS is enabled (already configured)
- Test API directly with curl/Postman first

## Files Ready for Deployment

- ✅ `package.json` - Dependencies and scripts
- ✅ `tsconfig.json` - TypeScript config
- ✅ `src/server.ts` - Main server file
- ✅ `render.yaml` - Render deployment config
- ✅ `openapi.json` - GPT Actions schema
- ✅ `data/` - All 21 JSON files (will be deployed)

## Environment Variables (Optional)

If needed, you can set these in Render:
- `PORT` - Server port (default: 10000 on Render)
- `NODE_ENV` - Set to `production`

