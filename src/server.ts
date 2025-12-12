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
  if (name.includes('SASO_FIRE')) {
    if (name.includes('equipment')) return 'SASO_FIRE_TR';
    return 'SASO_FIRE_TECH_REG';
  }
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

// Parse content string into individual clauses/requirements
// Looks for numbered patterns like "4.1.1", "4.2.3", "Article (1)", etc.
function parseContentIntoClauses(
  content: string,
  standard: string,
  directiveCode: string,
  sectionCode: string,
  domain: string
): NormalizedRecord[] {
  const results: NormalizedRecord[] = [];
  
  if (!content || content.trim().length === 0) {
    return results;
  }
  
  // Pattern 1: Numbered clauses like "4.1.1", "4.2.3.1", etc. (most specific)
  // Matches: "4.1.1. Text content here" or "4.1.1 Text content here"
  const numberedPattern = /(\d+\.\d+(?:\.\d+)*(?:\.\d+)?)\s+([^\d]+?)(?=\d+\.\d+(?:\.\d+)*|Article\s*\(|$)/gs;
  
  // Pattern 2: Article patterns like "Article (1):", "Article (2)", etc.
  const articlePattern = /Article\s*\((\d+)\)(?:\s*[:])?\s*([^A]+?)(?=Article\s*\(|$)/gis;
  
  // Pattern 3: Section patterns like "4.1.", "4.2.", etc. (without sub-clauses)
  const sectionPattern = /(\d+\.\d+)\s+([^\d]+?)(?=\d+\.\d+|Article\s*\(|$)/gs;
  
  let matches: RegExpMatchArray[] = [];
  
  // Try numbered pattern first (most specific) - matches like "4.1.1", "4.2.3.1"
  const numberedMatches = Array.from(content.matchAll(numberedPattern));
  if (numberedMatches.length > 1) { // Need at least 2 matches to be useful
    matches = numberedMatches;
  } else {
    // Try article pattern
    const articleMatches = Array.from(content.matchAll(articlePattern));
    if (articleMatches.length > 1) {
      matches = articleMatches;
    } else {
      // Fallback to section pattern
      const sectionMatches = Array.from(content.matchAll(sectionPattern));
      if (sectionMatches.length > 1) {
        matches = sectionMatches;
      }
    }
  }
  
  // If we found matches, create records for each
  if (matches.length > 0) {
    matches.forEach((match, index) => {
      const clauseId = match[1] || String(index + 1);
      let text = (match[2] || '').trim();
      
      // Clean up text - remove excessive whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      if (text.length > 20) { // Only create record if text is meaningful
        // Extract title from first sentence or first 200 chars
        const sentences = text.split(/[.!?]+/);
        const firstSentence = sentences[0]?.trim() || '';
        const title = firstSentence.substring(0, 200) || `Clause ${clauseId}`;
        
        results.push({
          standard,
          directiveCode,
          sectionCode,
          clauseId,
          title: title.length > 0 ? title : `Clause ${clauseId}`,
          text: text.substring(0, 10000), // Limit text length but allow more
          facilityClass: '',
          domain,
          tags: [],
          reference: `${standard} ${directiveCode} ${sectionCode} ${clauseId}`.trim()
        });
      }
    });
  }
  
  // If no structured matches found, split by paragraphs and create records
  // This is a fallback for content that doesn't follow standard numbering
  if (results.length === 0 && content.length > 200) {
    // Split by double newlines or by lines starting with numbers
    const paragraphs = content
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 100); // Only meaningful paragraphs
    
    // If we have many paragraphs, they're likely separate requirements
    if (paragraphs.length > 3) {
      paragraphs.forEach((para, index) => {
        const trimmed = para.trim().replace(/\s+/g, ' ');
        if (trimmed.length > 100) {
          const sentences = trimmed.split(/[.!?]+/);
          const firstSentence = sentences[0]?.trim() || '';
          const title = firstSentence.substring(0, 200) || `Requirement ${index + 1}`;
          
          results.push({
            standard,
            directiveCode,
            sectionCode,
            clauseId: String(index + 1),
            title,
            text: trimmed.substring(0, 10000),
            facilityClass: '',
            domain,
            tags: [],
            reference: `${standard} ${directiveCode} ${sectionCode} ${index + 1}`.trim()
          });
        }
      });
    } else {
      // If few paragraphs, create one record per paragraph
      paragraphs.forEach((para, index) => {
        const trimmed = para.trim().replace(/\s+/g, ' ');
        if (trimmed.length > 50) {
          const sentences = trimmed.split(/[.!?]+/);
          const firstSentence = sentences[0]?.trim() || '';
          const title = firstSentence.substring(0, 200) || `Requirement ${index + 1}`;
          
          results.push({
            standard,
            directiveCode,
            sectionCode,
            clauseId: String(index + 1),
            title,
            text: trimmed.substring(0, 10000),
            facilityClass: '',
            domain,
            tags: [],
            reference: `${standard} ${directiveCode} ${sectionCode} ${index + 1}`.trim()
          });
        }
      });
    }
  }
  
  // If still no results and content is substantial, create at least one record
  if (results.length === 0 && content.length > 100) {
    const trimmed = content.trim().replace(/\s+/g, ' ').substring(0, 10000);
    const sentences = trimmed.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim() || '';
    const title = firstSentence.substring(0, 200) || sectionCode || 'Requirement';
    
    results.push({
      standard,
      directiveCode,
      sectionCode,
      clauseId: '1',
      title,
      text: trimmed,
      facilityClass: '',
      domain,
      tags: [],
      reference: `${standard} ${directiveCode} ${sectionCode} 1`.trim()
    });
  }
  
  return results;
}

// Normalize HCIS structure: { directives: [{ directive_code, structured_sections: [{ clauses: [...] }] }] }
function fromHcis(raw: any, standard: string, domain: string): NormalizedRecord[] {
  const results: NormalizedRecord[] = [];
  
  if (!raw.directives || !Array.isArray(raw.directives)) {
    return results;
  }
  
  raw.directives.forEach((directive: any) => {
    const directiveCode = directive.directive_code || directive.directiveCode || '';
    
    if (directive.structured_sections && Array.isArray(directive.structured_sections)) {
      directive.structured_sections.forEach((section: any) => {
        const sectionCode = section.section_code || section.sectionCode || '';
        
        // First, try to extract from clauses if they exist
        if (section.clauses && Array.isArray(section.clauses) && section.clauses.length > 0) {
          section.clauses.forEach((clause: any, index: number) => {
            results.push({
              standard,
              directiveCode,
              sectionCode,
              clauseId: clause.clause_id || clause.id || String(index + 1),
              title: clause.title || clause.heading || section.section_title || '',
              text: clause.text || clause.content || clause.requirement || clause.description || '',
              facilityClass: clause.facility_class || clause.facilityClass || clause.class || '',
              domain,
              tags: Array.isArray(clause.tags) ? clause.tags : (clause.tag ? [clause.tag] : []),
              reference: clause.reference || 
                        `${standard} ${directiveCode} ${sectionCode} ${clause.clause_id || index + 1}`.trim()
            });
          });
        }
        
        // Parse content string into individual clauses
        if (section.content && section.content.trim().length > 0) {
          const parsed = parseContentIntoClauses(section.content, standard, directiveCode, sectionCode, domain);
          results.push(...parsed);
        }
      });
    }
  });
  
  return results.filter(r => r.title || r.text);
}

// Normalize SBC/SASO/Civil Defense structure: { document: { structured_sections: [{ clauses: [...] }] } }
function fromDocumentStructure(raw: any, standard: string, domain: string): NormalizedRecord[] {
  const results: NormalizedRecord[] = [];
  
  if (!raw.document || !raw.document.structured_sections || !Array.isArray(raw.document.structured_sections)) {
    return results;
  }
  
  raw.document.structured_sections.forEach((section: any) => {
    const sectionCode = section.section_code || section.sectionCode || '';
    
    // First, try to extract from clauses if they exist
    if (section.clauses && Array.isArray(section.clauses) && section.clauses.length > 0) {
      section.clauses.forEach((clause: any, index: number) => {
        results.push({
          standard,
          directiveCode: '',
          sectionCode,
          clauseId: clause.clause_id || clause.id || String(index + 1),
          title: clause.title || clause.heading || section.section_title || '',
          text: clause.text || clause.content || clause.requirement || clause.description || '',
          facilityClass: clause.facility_class || clause.facilityClass || clause.class || '',
          domain,
          tags: Array.isArray(clause.tags) ? clause.tags : (clause.tag ? [clause.tag] : []),
          reference: clause.reference || 
                    `${standard} ${sectionCode} ${clause.clause_id || index + 1}`.trim()
        });
      });
    }
    
    // Parse content string into individual clauses
    if (section.content && section.content.trim().length > 0) {
      const parsed = parseContentIntoClauses(section.content, standard, '', sectionCode, domain);
      results.push(...parsed);
    }
  });
  
  return results.filter(r => r.title || r.text);
}

// Normalize a record from various JSON structures
function normalizeRecord(
  record: any,
  standard: string,
  domain: string,
  filename: string
): NormalizedRecord[] {
  // Handle HCIS structure
  if (record.directives && Array.isArray(record.directives)) {
    return fromHcis(record, standard, domain);
  }
  
  // Handle SBC/SASO/Civil Defense structure
  if (record.document && record.document.structured_sections) {
    return fromDocumentStructure(record, standard, domain);
  }
  
  // Handle array of records
  if (Array.isArray(record)) {
    const results: NormalizedRecord[] = [];
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
    return [normalized];
  }
  
  return [];
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
    
    // Log breakdown by standard
    const byStandard: Record<string, number> = {};
    normalizedData.forEach(r => {
      byStandard[r.standard] = (byStandard[r.standard] || 0) + 1;
    });
    console.log('Records by standard:', JSON.stringify(byStandard, null, 2));
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
}

// Normalize reference string for flexible matching
// Handles variations like "HCIS SEC-01 4.4.1" vs "HCIS_SEC SEC-01 4.4.1"
function normalizeRefString(ref: string): string {
  if (!ref) return '';
  return ref
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    const { reference } = req.body ?? {};
    
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ error: 'reference (string) is required' });
    }
    
    const refNorm = normalizeRefString(reference);
    
    // Try exact match first (normalized)
    let result = normalizedData.find(r => 
      normalizeRefString(r.reference) === refNorm
    );
    
    // If not found, try endsWith match (for cases like "SEC-01 4.4.1" matching "HCIS_SEC SEC-01 4.4.1")
    if (!result) {
      result = normalizedData.find(r => 
        normalizeRefString(r.reference).endsWith(refNorm)
      );
    }
    
    if (!result) {
      return res.status(404).json({ 
        error: 'Reference not found',
        reference: reference
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
    
    // Always start with standards filter
    let results = normalizedData.filter(r => 
      standards.some(s => r.standard.toLowerCase().includes(s.toLowerCase()))
    );
    
    // Soft filter by facilityClass: only apply if some records have it, and fallback if empty
    if (facilityClass) {
      const fc = String(facilityClass).toLowerCase();
      const withFc = results.filter(r => (r.facilityClass || "").length > 0);
      
      if (withFc.length > 0) {
        const filtered = withFc.filter(r =>
          (r.facilityClass || "").toLowerCase().includes(fc)
        );
        
        // Only use filtered results if we have matches, otherwise keep original
        if (filtered.length > 0) {
          results = filtered;
        }
      }
    }
    
    // Soft filter by domains: only apply if some records have it, and fallback if empty
    if (Array.isArray(domains) && domains.length > 0) {
      const ds = domains.map(d => String(d).toLowerCase());
      const withDomain = results.filter(r => (r.domain || "").length > 0);
      
      if (withDomain.length > 0) {
        const filtered = withDomain.filter(r => {
          const dom = (r.domain || "").toLowerCase();
          return ds.some(d => dom.includes(d));
        });
        
        // Only use filtered results if we have matches, otherwise keep original
        if (filtered.length > 0) {
          results = filtered;
        }
      }
    }
    
    // Map to checklist format
    const checklist = results.map(r => ({
      standard: r.standard,
      directiveCode: r.directiveCode,
      sectionCode: r.sectionCode,
      clauseId: r.clauseId,
      domain: r.domain,
      requirement: r.text,
      facilityClass: r.facilityClass,
      mandatory: true,
      reference: r.reference
    }));
    
    res.json({ checklist });
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
