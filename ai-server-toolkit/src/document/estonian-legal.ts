// Estonian legal document detection and extraction
import type {
  DocumentChunk,
  DocumentPage,
  HierarchicalSection,
  StandardReference,
} from "./types.ts";

export interface SectionPattern {
  pattern: string;
  title?: string;
  type: "numbered" | "paragraph" | "article";
  page: number;
}

/**
 * Detects standard references in Estonian legal documents.
 *
 * Identifies references to standards like EVS, RT, EN ISO, and ISO within the text.
 * Extracts the standard identifier, year, and page number for citation purposes.
 *
 * Supported formats:
 * - EVS 812:2018
 * - RT I 2004, 22
 * - EN ISO 12354-1:2017
 * - ISO 13793
 *
 * @param text Text content to scan for standard references
 * @param pageNumber Page number where the text appears
 * @returns Array of StandardReference objects with details about each reference
 *
 * @example
 * ```ts
 * const refs = detectStandardReferences("According to EVS 812:2018...", 5);
 * console.log(refs[0].standard); // "EVS 812:2018"
 * ```
 */
export function detectStandardReferences(text: string, pageNumber: number): StandardReference[] {
  const references: StandardReference[] = [];

  const patterns = [
    /EVS[\s-]?(\d+)(?::(\d{4}))?/gi,
    /RT\s+I\s+(\d{4}),\s+(\d+)/gi,
    /EN[\s-]?ISO[\s-]?(\d+)(?:-(\d+))?(?::(\d{4}))?/gi,
    /ISO[\s-]?(\d+)(?:-(\d+))?(?::(\d{4}))?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      references.push({
        standard: match[0].replace(/\s+/g, " ").trim(),
        year: extractYear(match[0]),
        page: pageNumber,
        fullReference: match[0],
      });
    }
  }

  return references;
}

/**
 * Detects section numbering patterns in legal documents.
 *
 * Identifies hierarchical section numbers (1, 1.1, 1.1.1), paragraphs (§),
 * and article markers in the text. Useful for building document structure.
 *
 * @param text Text content to scan for section numbers
 * @returns Array of SectionPattern objects with section identifiers and titles
 *
 * @example
 * ```ts
 * const sections = detectSectionNumbers("1.2.3 Thermal insulation\n...");
 * console.log(sections[0].pattern); // "1.2.3"
 * console.log(sections[0].title); // "Thermal insulation"
 * ```
 */
export function detectSectionNumbers(text: string): SectionPattern[] {
  const sections: SectionPattern[] = [];

  const numberedSectionRegex = /^(\d+(?:\.\d+)*)\s+([^\n]+)/gm;
  let match;

  while ((match = numberedSectionRegex.exec(text)) !== null) {
    sections.push({
      pattern: match[1],
      title: match[2].trim(),
      type: "numbered",
      page: 0,
    });
  }

  const paragraphRegex = /§\s*(\d+)\s*\.?\s*([^\n]+)?/g;
  while ((match = paragraphRegex.exec(text)) !== null) {
    sections.push({
      pattern: `§${match[1]}`,
      title: match[2]?.trim(),
      type: "paragraph",
      page: 0,
    });
  }

  return sections;
}

/**
 * Detects legal and regulatory keywords in text.
 *
 * Identifies domain-specific terminology related to building codes, regulations,
 * and standards in Estonian or English text.
 *
 * @param text Text content to scan for legal keywords
 * @param language Language of the text ("et" for Estonian, "en" for English)
 * @returns Array of detected keywords
 *
 * @example
 * ```ts
 * const keywords = detectLegalKeywords("tulekindlus ja soojustus", "et");
 * console.log(keywords); // ["tulekindlus", "soojustus"]
 * ```
 */
export function detectLegalKeywords(text: string, language: "et" | "en"): string[] {
  const keywords = new Set<string>();

  const estonianKeywords = [
    "ehitusseadustik",
    "ehitusseadus",
    "ehitusmäärus",
    "tulepüsivus",
    "ehitise",
    "konstruktsioon",
    "ehitusprojekt",
    "nõuded",
    "tulekindlus",
    "heliisolatsioon",
    "energiatõhusus",
    "ehituskonstruktsioon",
    "projekteerimistingimused",
    "ehitusluba",
    "kasutusluba",
  ];

  const englishKeywords = [
    "building code",
    "construction",
    "fire resistance",
    "structural",
    "design requirements",
    "building permit",
    "energy efficiency",
    "sound insulation",
  ];

  const keywordList = language === "et" ? estonianKeywords : englishKeywords;
  const lowerText = text.toLowerCase();

  for (const keyword of keywordList) {
    if (lowerText.includes(keyword.toLowerCase())) {
      keywords.add(keyword);
    }
  }

  return Array.from(keywords);
}

/**
 * Builds a hierarchical tree structure from flat section patterns.
 *
 * Converts a flat list of section numbers (1, 1.1, 1.1.1, 1.2, 2) into a
 * nested tree structure representing the document's organization.
 *
 * @param sections Array of detected section patterns
 * @returns Array of HierarchicalSection objects with parent-child relationships
 *
 * @example
 * ```ts
 * const hierarchy = buildSectionHierarchy(sections);
 * console.log(hierarchy[0].children); // Subsections under section 1
 * ```
 */
export function buildSectionHierarchy(sections: SectionPattern[]): HierarchicalSection[] {
  const hierarchy: HierarchicalSection[] = [];
  const stack: HierarchicalSection[] = [];

  for (const section of sections) {
    const level = calculateSectionLevel(section.pattern);
    const hierarchicalSection: HierarchicalSection = {
      id: `section_${section.pattern}`,
      level,
      number: section.pattern,
      title: section.title || "",
      pageNumber: section.page,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      hierarchy.push(hierarchicalSection);
    } else {
      stack[stack.length - 1].children.push(hierarchicalSection);
    }

    stack.push(hierarchicalSection);
  }

  return hierarchy;
}

/**
 * Enriches document chunks with legal metadata and context.
 *
 * Enhances chunks by adding detected standard references, legal keywords,
 * and section numbers to the metadata. This improves search relevance and
 * citation accuracy in legal document processing.
 *
 * @param chunks Array of document chunks to enrich
 * @param _pages Array of document pages (for future use)
 * @param language Language of the document ("et" for Estonian, "en" for English)
 * @returns Array of enriched chunks with legal metadata
 *
 * @example
 * ```ts
 * const enriched = enrichChunksWithLegalContext(chunks, pages, "et");
 * console.log(enriched[0].metadata.standards); // ["EVS 812:2018"]
 * ```
 */
export function enrichChunksWithLegalContext(
  chunks: DocumentChunk[],
  _pages: DocumentPage[],
  language: "et" | "en",
): DocumentChunk[] {
  return chunks.map((chunk) => {
    const references = detectStandardReferences(chunk.content, chunk.pageNumber);
    const keywords = detectLegalKeywords(chunk.content, language);
    const sections = detectSectionNumbers(chunk.content);

    return {
      ...chunk,
      standardReferences: references.map((r) => r.standard),
      legalKeywords: keywords,
      section: sections[0]?.pattern || chunk.section,
      heading: sections[0]?.title || chunk.heading,
    };
  });
}

function extractYear(reference: string): string | undefined {
  const yearMatch = reference.match(/:(\d{4})/);
  return yearMatch ? yearMatch[1] : undefined;
}

function calculateSectionLevel(pattern: string): number {
  if (pattern.startsWith("§")) {
    return 1;
  }

  const parts = pattern.split(".");
  return parts.length;
}
