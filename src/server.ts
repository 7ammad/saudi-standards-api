import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

interface NormalizedRecord {
  standard: string;
  directiveCode: string;
  sectionCode: string;
  clauseId: string;
  title: string;
  text: string;
  facilityClass: string;
  domain: string;
  tags: string[];
  reference: string;
}

interface SearchRequirementsBody {
  standard?: string;
  directiveCode?: string;
  facilityClass?: string;
  domain?: string;
  query?: string;
  limit?: number;
}

interface GetReferenceBody {
  reference: string;
}

interface GenerateChecklistBody {
  standards: string[];
  facilityClass?: string;
  domains?: string[];
}

let normalizedData: NormalizedRecord[] = [];

// Extract standard identifier from filename
function extractStandardFromFilename(filename: string): string {
  const name = filename.replace('.json', '');
  const parts = name.split('_');
  
  // Try to extract meaningful standard code
  if (name.includes('HCIS')) return 'HCIS_SEC';
  if (name.includes('SBC_801')) return 'SBC_801';
  if (name.includes('SBC_901')) return 'SBC_901';
  if (name.includes('SASO_FIRE')) return 'SASO_FIRE';
  if (name.includes('NCA')) {
    if (name.includes('ECC')) return 'NCA_ECC';
    if (name.includes('GECC')) return 'NCA_GECC';
    return 'NCA_CYBER';
  }
  if (name.includes('NEOM')) {
    if (name.includes('Operational')) return 'NEOM_OPS_SEC';
    if (name.includes('Public Safety')) return 'NEOM_PUB_SAFETY';
    if (name.includes('SEC-SCH')) return 'NEOM_SEC_SCH';
    return 'NEOM';
  }
  if (name.includes('SAMA')) {
    if (name.includes('BCM')) return 'SAMA_BCM';
    return 'SAMA_CYBER';
  }
  if (name.includes('SDAIA') || name.includes('NDMO') || name.includes('PDPL')) {
    return 'SDAIA_DATA';
  }
  if (name.includes('Civil Defense')) {
    if (name.includes('code')) return 'CIVIL_DEFENSE_CODE';
    return 'CIVIL_DEFENSE_REG';
  }
  if (name.includes('MAWANI')) return 'MAWANI_SEC';
  
  // Fallback: use first meaningful parts
  return parts.slice(0, 2).join('_').toUpperCase() || 'UNKNOWN';
}

// Extract domain from filename or content
function extractDomain(filename: string, content: any): string {
  const name = filename.toLowerCase();
  
  if (name.includes('fire') || name.includes('civil_defense')) return 'fire';
  if (name.includes('cyber') || name.includes('nca') || name.includes('sama_cyber')) return 'cyber';
  if (name.includes('data') || name.includes('pdpl') || name.includes('ndmo')) return 'data_protection';
  if (name.includes('security') || name.includes('hcis') || name.includes('mawani') || name.includes('neom')) return 'security';
  if (name.includes('building') || name.includes('sbc')) return 'building';
  if (name.includes('bcm') || name.includes('business_continuity')) return 'business_continuity';
  if (name.includes('maritime')) return 'maritime';
  if (name.includes('operational')) return 'operational';
  if (name.includes('public_safety')) return 'public_safety';
  
  // Try to extract from content if available
  if (content?.domain) return String(content.domain).toLowerCase();
  
  return 'general';
}

// Normalize a record from various JSON structures
function normalizeRecord(
  record: any,
  standard: string,
  domain: string,
  filename: string
): NormalizedRecord[] {
  const results: NormalizedRecord[] = [];
  
  // Handle HCIS structure: { directives: [{ directive_code, structured_sections: [{ clauses: [...] }] }] }
  if (record.directives && Array.isArray(record.directives)) {
    record.directives.forEach((directive: any) => {
      const directiveCode = directive.directive_code || '';
      
      if (directive.structured_sections && Array.isArray(directive.structured_sections)) {
        directive.structured_sections.forEach((section: any) => {
          const sectionCode = section.section_code || '';
          
          // First, try to extract from clauses if they exist
          if (section.clauses && Array.isArray(section.clauses) && section.clauses.length > 0) {
            section.clauses.forEach((clause: any, index: number) => {
              const normalized: NormalizedRecord = {
                standard: standard,
                directiveCode: directiveCode,
                sectionCode: sectionCode,
                clauseId: clause.clause_id || clause.id || String(index + 1),
                title: clause.title || clause.heading || section.section_title || '',
                text: clause.text || clause.content || clause.requirement || clause.description || '',
                facilityClass: clause.facility_class || clause.facilityClass || clause.class || '',
                domain: domain,
                tags: Array.isArray(clause.tags) ? clause.tags : (clause.tag ? [clause.tag] : []),
                reference: clause.reference || 
                          `${standard} ${directiveCode} ${sectionCode} ${clause.clause_id || index + 1}`.trim()
              };
              
              if (normalized.title || normalized.text) {
                results.push(normalized);
              }
            });
          }
          
          // If section has content (even if clauses array exists but is empty), create a record from the section
          if (section.content && section.content.trim().length > 0) {
            const normalized: NormalizedRecord = {
              standard: standard,
              directiveCode: directiveCode,
              sectionCode: sectionCode,
              clauseId: '',
              title: section.section_title || directive.official_title || '',
              text: section.content,
              facilityClass: '',
              domain: domain,
              tags: [],
              reference: `${standard} ${directiveCode} ${sectionCode}`.trim()
            };
            
            results.push(normalized);
          }
        });
      }
    });
    return results;
  }
  
  // Handle SBC structure: { document: { structured_sections: [{ clauses: [...] }] } }
  if (record.document && record.document.structured_sections && Array.isArray(record.document.structured_sections)) {
    record.document.structured_sections.forEach((section: any) => {
      const sectionCode = section.section_code || '';
      
      // First, try to extract from clauses if they exist
      if (section.clauses && Array.isArray(section.clauses) && section.clauses.length > 0) {
        section.clauses.forEach((clause: any, index: number) => {
          const normalized: NormalizedRecord = {
            standard: standard,
            directiveCode: '',
            sectionCode: sectionCode,
            clauseId: clause.clause_id || clause.id || String(index + 1),
            title: clause.title || clause.heading || section.section_title || '',
            text: clause.text || clause.content || clause.requirement || clause.description || '',
            facilityClass: clause.facility_class || clause.facilityClass || clause.class || '',
            domain: domain,
            tags: Array.isArray(clause.tags) ? clause.tags : (clause.tag ? [clause.tag] : []),
            reference: clause.reference || 
                      `${standard} ${sectionCode} ${clause.clause_id || index + 1}`.trim()
          };
          
          if (normalized.title || normalized.text) {
            results.push(normalized);
          }
        });
      }
      
      // If section has content (even if clauses array exists but is empty), create a record from the section
      if (section.content && section.content.trim().length > 0) {
        const normalized: NormalizedRecord = {
          standard: standard,
          directiveCode: '',
          sectionCode: sectionCode,
          clauseId: '',
          title: section.section_title || record.document?.document_title || '',
          text: section.content,
          facilityClass: '',
          domain: domain,
          tags: [],
          reference: `${standard} ${sectionCode}`.trim()
        };
        
        results.push(normalized);
      }
    });
    return results;
  }
  
  // Handle array of records
  if (Array.isArray(record)) {
    record.forEach((item) => {
      results.push(...normalizeRecord(item, standard, domain, filename));
    });
    return results;
  }
  
  // Handle single record object (fallback)
  const normalized: NormalizedRecord = {
    standard: standard,
    directiveCode: record.directiveCode || record.directive_code || record.directive || record.chapter || record.section || record.code || '',
    sectionCode: record.sectionCode || record.section_code || record.subsection || record.article || record.clause || '',
    clauseId: record.clauseId || record.clause_id || record.id || record.clauseNumber || record.number || record.articleNumber || '',
    title: record.title || record.heading || record.name || record.description || '',
    text: record.text || record.content || record.requirement || record.clause || record.description || '',
    facilityClass: record.facilityClass || record.facility_class || record.class || record.occupancy || record.category || '',
    domain: record.domain || domain,
    tags: Array.isArray(record.tags) ? record.tags : (record.tag ? [record.tag] : []),
    reference: record.reference || 
               record.ref || 
               `${standard} ${record.directiveCode || record.directive_code || ''} ${record.sectionCode || record.section_code || ''} ${record.clauseId || record.clause_id || ''}`.trim() ||
               ''
  };
  
  if (normalized.title || normalized.text) {
    results.push(normalized);
  }
  
  // Handle nested structures (fallback)
  if (record.requirements && Array.isArray(record.requirements)) {
    record.requirements.forEach((req: any) => {
      results.push(...normalizeRecord(req, standard, domain, filename));
    });
  }
  
  if (record.sections && Array.isArray(record.sections)) {
    record.sections.forEach((sec: any) => {
      results.push(...normalizeRecord(sec, standard, domain, filename));
    });
  }
  
  if (record.clauses && Array.isArray(record.clauses)) {
    record.clauses.forEach((clause: any) => {
      results.push(...normalizeRecord(clause, standard, domain, filename));
    });
  }
  
  if (record.items && Array.isArray(record.items)) {
    record.items.forEach((item: any) => {
      results.push(...normalizeRecord(item, standard, domain, filename));
    });
  }
  
  return results;
}

// Load and normalize all JSON files
async function loadData(): Promise<void> {
  try {
    const dataDir = join(__dirname, '..', 'data');
    const files = await readdir(dataDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} JSON files to load`);
    
    for (const file of jsonFiles) {
      try {
        const filePath = join(dataDir, file);
        const fileContent = await readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        
        const standard = extractStandardFromFilename(file);
        const domain = extractDomain(file, jsonData);
        
        const normalized = normalizeRecord(jsonData, standard, domain, file);
        normalizedData.push(...normalized);
        
        console.log(`Loaded ${normalized.length} records from ${file}`);
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
      }
    }
    
    console.log(`Total normalized records: ${normalizedData.length}`);
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
}

// Fuzzy text matching
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact match
  if (lowerText.includes(lowerQuery)) return true;
  
  // Word boundary match
  const words = lowerQuery.split(/\s+/);
  return words.every(word => lowerText.includes(word));
}

// POST /standards/searchRequirements
app.post('/standards/searchRequirements', (req: Request<{}, {}, SearchRequirementsBody>, res: Response) => {
  try {
    const { standard, directiveCode, facilityClass, domain, query, limit = 50 } = req.body;
    
    // Require at least one filter
    if (!standard && !directiveCode && !facilityClass && !domain && !query) {
      return res.status(400).json({ 
        error: 'At least one filter is required (standard, directiveCode, facilityClass, domain, or query)' 
      });
    }
    
    let results = normalizedData;
    
    // Filter by standard
    if (standard) {
      results = results.filter(r => r.standard.toLowerCase().includes(standard.toLowerCase()));
    }
    
    // Filter by directiveCode
    if (directiveCode) {
      results = results.filter(r => 
        r.directiveCode.toLowerCase().includes(directiveCode.toLowerCase())
      );
    }
    
    // Filter by facilityClass
    if (facilityClass) {
      results = results.filter(r => 
        r.facilityClass.toLowerCase().includes(facilityClass.toLowerCase())
      );
    }
    
    // Filter by domain
    if (domain) {
      results = results.filter(r => 
        r.domain.toLowerCase().includes(domain.toLowerCase())
      );
    }
    
    // Filter by query (fuzzy match in title and text)
    if (query) {
      results = results.filter(r => 
        fuzzyMatch(r.title, query) || fuzzyMatch(r.text, query)
      );
    }
    
    // Apply limit
    results = results.slice(0, limit);
    
    res.json({ results });
  } catch (error) {
    console.error('Error in searchRequirements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /standards/getReference
app.post('/standards/getReference', (req: Request<{}, {}, GetReferenceBody>, res: Response) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({ error: 'reference is required' });
    }
    
    const result = normalizedData.find(r => 
      r.reference.toLowerCase() === reference.toLowerCase()
    );
    
    if (!result) {
      return res.status(404).json({ 
        error: `Reference "${reference}" not found` 
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in getReference:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /standards/generateChecklist
app.post('/standards/generateChecklist', (req: Request<{}, {}, GenerateChecklistBody>, res: Response) => {
  try {
    const { standards, facilityClass, domains } = req.body;
    
    if (!standards || !Array.isArray(standards) || standards.length === 0) {
      return res.status(400).json({ error: 'standards array is required and must not be empty' });
    }
    
    let results = normalizedData;
    
    // Filter by standards (must match at least one)
    results = results.filter(r => 
      standards.some(s => r.standard.toLowerCase().includes(s.toLowerCase()))
    );
    
    // Filter by facilityClass (if provided)
    if (facilityClass) {
      results = results.filter(r => 
        r.facilityClass.toLowerCase().includes(facilityClass.toLowerCase())
      );
    }
    
    // Filter by domains (if provided, must match at least one)
    if (domains && domains.length > 0) {
      results = results.filter(r => 
        domains.some(d => r.domain.toLowerCase().includes(d.toLowerCase()))
      );
    }
    
    res.json({ checklist: results });
  } catch (error) {
    console.error('Error in generateChecklist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    recordsLoaded: normalizedData.length,
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    await loadData();
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Loaded ${normalizedData.length} normalized records`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

