# Deployment Guide

## Phase 1: Local Setup and Testing

### 1. Move JSON Files to /data Directory

Run the PowerShell script:
```powershell
.\scripts\move-files.ps1
```

Or manually copy all JSON files from `json_files/` to `data/`.

### 2. Install Dependencies

```powershell
npm install
```

### 3. Start Development Server

```powershell
npm run dev
```

You should see:
```
Found 20 JSON files to load
Loaded X records from [filename]
Total normalized records: [total]
Server running on http://localhost:3000
```

### 4. Test searchRequirements Endpoint

```powershell
curl -X POST http://localhost:3000/standards/searchRequirements `
  -H "Content-Type: application/json" `
  -d '{\"standard\": \"HCIS_SEC\", \"directiveCode\": \"SEC-05\", \"facilityClass\": \"Class 2\", \"domain\": \"perimeter\", \"query\": \"fence\", \"limit\": 5}'
```

Expected response:
```json
{
  "results": [
    {
      "standard": "HCIS_SEC",
      "directiveCode": "SEC-05",
      "text": "...",
      "reference": "HCIS SEC-05 4.3.2",
      ...
    }
  ]
}
```

If you get errors:
- Check that JSON files are in `/data` directory
- Check console logs for normalization errors
- Verify JSON file structure matches expected format

## Phase 2: Deploy to Render

### 1. Push to GitHub

```powershell
git init
git add .
git commit -m "Initial commit: Saudi Standards API"
git remote add origin [your-github-repo-url]
git push -u origin main
```

### 2. Deploy on Render

1. Go to https://render.com
2. Sign up/Login
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: saudi-standards-api
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run build; npm start`
   - **Environment**: Production
6. Click "Create Web Service"

Render will automatically:
- Install dependencies
- Build TypeScript
- Start the server

### 3. Get Your Public URL

After deployment, Render will provide a URL like:
```
https://saudi-standards-api.onrender.com
```

### 4. Test Deployed API

```powershell
curl -X POST https://saudi-standards-api.onrender.com/standards/searchRequirements `
  -H "Content-Type: application/json" `
  -d '{\"query\": \"perimeter fence\", \"standard\": \"HCIS_SEC\", \"limit\": 3}'
```

## Phase 3: Connect to Custom GPT

### 1. Update OpenAPI Schema

Edit `openapi.json` and update the production server URL:

```json
"servers": [
  {
    "url": "https://saudi-standards-api.onrender.com"
  }
]
```

### 2. Add to Custom GPT

1. Open your Custom GPT in ChatGPT
2. Go to **Configure** → **Actions** → **Schema**
3. Copy the entire contents of `openapi.json`
4. Paste into the schema field
5. Set **Authentication** to "None" (or add API key later)
6. Click **Save**

### 3. Test in GPT

In the GPT chat, try:
```
Use the standards API to list the top 5 HCIS perimeter fence requirements for a Class 2 facility, including clause references. Call searchRequirements explicitly.
```

You should see in the right sidebar that the GPT is calling the `searchRequirements` action.

## Troubleshooting

### Server won't start locally
- Check Node.js version: `node --version` (needs 18+)
- Check that `/data` directory exists and has JSON files
- Check console for specific error messages

### No results from search
- Verify JSON files are properly formatted
- Check that normalization is working (see console logs)
- Try a broader query without filters

### Render deployment fails
- Check build logs in Render dashboard
- Ensure `render.yaml` is in root directory
- Verify `package.json` has correct scripts
- Check that TypeScript compiles: `npm run build`

### GPT can't call API
- Verify the URL in `openapi.json` matches your Render URL
- Check that API is accessible (test with curl)
- Ensure CORS is enabled (already configured)
- Check GPT action logs for error messages

