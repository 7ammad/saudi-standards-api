# Saudi Standards API

A minimal Node.js + Express API for searching and retrieving Saudi standards and regulations. Designed for use with Custom GPTs and other integrations.

## Features

- Search requirements across multiple Saudi standard documents
- Retrieve specific references by reference code
- Generate compliance checklists based on selected standards
- Normalized data structure across all standards

## Setup

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Move JSON files to the `/data` directory:

   If your files are currently in `json_files`, run:
   ```powershell
   .\scripts\move-files.ps1
   ```
   
   Or manually copy all JSON files to the `/data` directory:
   - Civil Defense_Fire Safety_civil_defense_fire_code.json
   - Civil Defense_Fire Safety_civil_defense_regulations.json
   - HCIS_Industrial Security_hcis_sec_structured.json
   - MAWANI_Maritime Security_mawani_security_standards.json
   - NCA_Cybersecurity_nca_cyber_framework.json
   - NCA_Cybersecurity_nca_ecc_2024_ar.json
   - NCA_Cybersecurity_nca_ecc_2024_en.json
   - NCA_Cybersecurity_nca_gecc.json
   - NEOM_Operational Security_NEOM Operational Site Security_0.2.json
   - NEOM_Public Safety_NEOM Public Safety System Requirements_2.2.json
   - NEOM_Security Requirements_SEC-SCH-002_1.0.json
   - SAMA_Business Continuity_sama_bcm_framework.json
   - SAMA_Cybersecurity_sama_cybersecurity_controls.json
   - SASO_Fire Safety_saso_fire_equipment_tr.json
   - SASO_Fire Safety_saso_fire_safety_standards.json
   - SBC_Building Code_sbc_801.json
   - SBC_Building Code_sbc_901.json
   - SDAIA_Data Protection_ndmo_guidelines.json
   - SDAIA_Data Protection_pdpl_data_standards.json
   - SDAIA_Data Protection_pdpl_exec_regulations.json
   - SDAIA_Data Protection_pdpl_law.json

3. Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` by default. You can change the port by setting the `PORT` environment variable.

## API Endpoints

### POST /standards/searchRequirements

Search for requirements across all standards with optional filters.

**Request Body:**
```json
{
  "standard": "HCIS_SEC",
  "directiveCode": "SEC-05",
  "facilityClass": "Class A",
  "domain": "security",
  "query": "fire detection",
  "limit": 20
}
```

All fields are optional except that at least one filter should be provided.

**Response:**
```json
{
  "results": [
    {
      "standard": "HCIS_SEC",
      "directiveCode": "SEC-05",
      "sectionCode": "4.3",
      "clauseId": "2",
      "title": "Fire Detection Systems",
      "text": "All facilities must have...",
      "facilityClass": "Class A",
      "domain": "security",
      "tags": ["fire", "detection"],
      "reference": "HCIS SEC-05 4.3.2"
    }
  ]
}
```

**Example curl:**
```bash
curl -X POST http://localhost:3000/standards/searchRequirements \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"fire detection\", \"limit\": 10}"
```

### POST /standards/getReference

Retrieve a specific requirement by its reference code.

**Request Body:**
```json
{
  "reference": "HCIS SEC-05 4.3.2"
}
```

**Response:**
```json
{
  "standard": "HCIS_SEC",
  "directiveCode": "SEC-05",
  "sectionCode": "4.3",
  "clauseId": "2",
  "title": "Fire Detection Systems",
  "text": "All facilities must have...",
  "facilityClass": "Class A",
  "domain": "security",
  "tags": ["fire", "detection"],
  "reference": "HCIS SEC-05 4.3.2"
}
```

**Example curl:**
```bash
curl -X POST http://localhost:3000/standards/getReference \
  -H "Content-Type: application/json" \
  -d "{\"reference\": \"HCIS SEC-05 4.3.2\"}"
```

### POST /standards/generateChecklist

Generate a compliance checklist based on selected standards, optionally filtered by facility class and domains.

**Request Body:**
```json
{
  "standards": ["HCIS_SEC", "SBC_801"],
  "facilityClass": "Class A",
  "domains": ["security", "fire"]
}
```

The `standards` array is required. `facilityClass` and `domains` are optional filters.

**Response:**
```json
{
  "checklist": [
    {
      "standard": "HCIS_SEC",
      "directiveCode": "SEC-05",
      "sectionCode": "4.3",
      "clauseId": "2",
      "title": "Fire Detection Systems",
      "text": "All facilities must have...",
      "facilityClass": "Class A",
      "domain": "security",
      "tags": ["fire", "detection"],
      "reference": "HCIS SEC-05 4.3.2"
    }
  ]
}
```

**Example curl:**
```bash
curl -X POST http://localhost:3000/standards/generateChecklist \
  -H "Content-Type: application/json" \
  -d "{\"standards\": [\"HCIS_SEC\", \"SBC_801\"], \"facilityClass\": \"Class A\"}"
```

### GET /health

Health check endpoint that returns server status and number of loaded records.

**Response:**
```json
{
  "status": "ok",
  "recordsLoaded": 1234,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Example curl:**
```bash
curl http://localhost:3000/health
```

## Data Normalization

All records are normalized into a common structure:

- `standard`: Standard identifier (e.g., 'HCIS_SEC', 'SBC_801')
- `directiveCode`: Directive/chapter/section code
- `sectionCode`: Sub-section or article code
- `clauseId`: Internal ID or clause number
- `title`: Short heading
- `text`: Full requirement/clause text
- `facilityClass`: Class/occupancy when available
- `domain`: Logical domain (perimeter, fire, cyber, data_protection, etc.)
- `tags`: Array of tags
- `reference`: Human-readable reference (e.g., "HCIS SEC-05 4.3.2")

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run type-check` - Type check without building

## Environment Variables

- `PORT` - Server port (default: 3000)

## Testing Locally

After starting the server with `npm run dev`, test the endpoints:

### Test searchRequirements

```powershell
curl -X POST http://localhost:3000/standards/searchRequirements `
  -H "Content-Type: application/json" `
  -d '{\"standard\": \"HCIS_SEC\", \"query\": \"perimeter fence\", \"limit\": 5}'
```

### Test getReference

```powershell
curl -X POST http://localhost:3000/standards/getReference `
  -H "Content-Type: application/json" `
  -d '{\"reference\": \"HCIS SEC-05 4.3.2\"}'
```

### Test generateChecklist

```powershell
curl -X POST http://localhost:3000/standards/generateChecklist `
  -H "Content-Type: application/json" `
  -d '{\"standards\": [\"HCIS_SEC\", \"SBC_801\"], \"facilityClass\": \"Class A\"}'
```

### Health Check

```powershell
curl http://localhost:3000/health
```

## Deployment

### Deploy to Render

1. Push your code to GitHub
2. Go to [Render](https://render.com) → "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run build; npm start` (or use the `render.yaml` file)
5. Set environment variables if needed (PORT defaults to 10000 on Render)
6. Deploy

The `render.yaml` file in the root directory can be used for automatic configuration.

### Update OpenAPI Schema

After deployment, update the `servers` URL in `openapi.json` with your actual Render URL:

```json
"servers": [
  {
    "url": "https://your-app-name.onrender.com"
  }
]
```

## Custom GPT Integration

1. Open your Custom GPT in ChatGPT
2. Go to **Actions** → **Schema**
3. Copy the contents of `openapi.json` and paste it into the schema field
4. Set Authentication to **None** (or add API key authentication later)
5. Save the GPT

The GPT will now be able to call the API endpoints to search and retrieve Saudi standards.

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad request (missing required fields)
- `404` - Not found (for getReference)
- `500` - Internal server error

Error responses include a JSON object with an `error` field describing the issue.

