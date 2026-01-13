/**
 * Generate Master Documentation Files for LLM Knowledge Base
 * 
 * PURPOSE:
 * This script consolidates all documentation files (.md and .mdx) from specific
 * directories into single master markdown files optimized for LLM consumption.
 * These files are used to populate customer service agent LLM knowledge bases.
 * 
 * WHY:
 * - LLMs work better with consolidated, well-structured documentation
 * - Easier to manage and upload to LLM systems (single file per category)
 * - Allows for token counting to ensure files stay within limits (2M tokens)
 * - Separates LLM-specific docs from Docusaurus build (outputs to llm-docs/)
 * 
 * WHAT IT DOES:
 * 1. Recursively collects all .md/.mdx files from target directories:
 *    - api/ → llm-docs/api.md
 *    - sheets/ → llm-docs/sheets.md
 *    - sdk/py/ → llm-docs/sdk-py.md
 *    - sdk/postman.mdx → llm-docs/sdk-postman.md
 * 
 * 2. Processes each file:
 *    - Extracts title from frontmatter (strips "tg [letter]" tags)
 *    - Removes frontmatter and MDX imports
 *    - Converts <Tabs>/<TabItem> components to markdown headers
 *    - Removes empty components like <DocCardList>
 *    - Preserves admonitions (:::tip, :::warning, etc.) and code blocks
 * 
 * 3. Combines files with:
 *    - Table of contents at the top
 *    - Clear section separators
 *    - Hierarchical headers based on file structure
 * 
 * 4. Estimates token counts for each file (using ~4 chars/token approximation)
 * 
 * USAGE:
 *   npm run generate-docs
 * 
 * OUTPUT:
 *   Files are written to llm-docs/ directory (gitignored, not part of Docusaurus build)
 * 
 * NOTE:
 *   This script does NOT affect the Docusaurus build process. It only reads from
 *   source directories and writes to a separate output directory.
 */

const fs = require('fs');
const path = require('path');

// Configuration
// Output directory for generated master documentation files
// This directory is gitignored and separate from Docusaurus build
const OUTPUT_DIR = 'llm-docs';

// Source directories and their corresponding output files
// - source: directory or file path to process
// - output: filename for the consolidated markdown file
// - isSingleFile: if true, treats source as a single file rather than a directory
const TARGETS = [
  { source: 'api', output: 'api.md' },
  { source: 'sheets', output: 'sheets.md' },
  { source: 'sdk/py', output: 'sdk-py.md' },
  { source: 'sdk/postman.mdx', output: 'sdk-postman.md', isSingleFile: true }
];

/**
 * Recursively collect all .md and .mdx files from a directory
 */
function collectFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      collectFiles(filePath, fileList);
    } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
      fileList.push(filePath);
    } else if (!file.includes('.')) {
      // Files without extensions - check if they're markdown by reading first few bytes
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.trim().startsWith('---') || content.trim().startsWith('#')) {
          fileList.push(filePath);
        }
      } catch (e) {
        // Skip if can't read
      }
    }
  });
  
  return fileList;
}

/**
 * Strip "tg [letter]" tags from title
 */
function stripTitleTags(title) {
  if (!title) return title;
  return title.replace(/\s+tg\s+[a-z]\s*$/i, '').trim();
}

/**
 * Extract title from frontmatter
 */
function extractTitle(content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
    if (titleMatch) {
      let title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
      title = stripTitleTags(title);
      return title;
    }
  }
  return null;
}

/**
 * Strip frontmatter from content
 */
function stripFrontmatter(content) {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

/**
 * Remove all import statements
 */
function removeImports(content) {
  return content.replace(/^import\s+.*?from\s+["'].*?["'];?\s*$/gm, '');
}

/**
 * Convert Tabs/TabItem components to markdown headers
 */
function convertTabsToHeaders(content) {
  let result = content;
  
  // Remove opening <Tabs> tag
  result = result.replace(/<Tabs[^>]*>\s*/g, '');
  
  // Convert <TabItem> to header and remove closing tag
  result = result.replace(/<TabItem\s+value="[^"]*"\s+label="([^"]*)"[^>]*>\s*/g, '### $1\n\n');
  result = result.replace(/<\/TabItem>\s*/g, '\n\n');
  
  // Remove closing </Tabs> tag
  result = result.replace(/<\/Tabs>\s*/g, '');
  
  return result;
}

/**
 * Remove empty components like DocCardList
 */
function removeEmptyComponents(content) {
  // Remove DocCardList and similar self-closing or empty components
  result = content.replace(/<DocCardList[^>]*\/>\s*/g, '');
  result = result.replace(/<DocCardList[^>]*>[\s\S]*?<\/DocCardList>\s*/g, '');
  result = result.replace(/<useCurrentSidebarCategory[^>]*\/>\s*/g, '');
  
  // Remove import statements that reference these components (already handled, but double-check)
  result = result.replace(/import\s+.*?from\s+["']@theme\/DocCardList["'];?\s*$/gm, '');
  result = result.replace(/import\s+.*?from\s+["']@docusaurus\/theme-common["'];?\s*$/gm, '');
  
  return result;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let title = extractTitle(content);
    if (!title) {
      title = stripTitleTags(path.basename(filePath, path.extname(filePath)));
    }
    
    // Process content
    content = stripFrontmatter(content);
    content = removeImports(content);
    content = removeEmptyComponents(content);
    content = convertTabsToHeaders(content);
    
    // Clean up extra blank lines
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    
    return {
      title,
      content,
      path: filePath
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Sort files logically (index files first, then alphabetically)
 */
function sortFiles(files) {
  return files.sort((a, b) => {
    const aBasename = path.basename(a, path.extname(a));
    const bBasename = path.basename(b, path.extname(b));
    
    // Index files come first
    if (aBasename === 'index' && bBasename !== 'index') return -1;
    if (aBasename !== 'index' && bBasename === 'index') return 1;
    if (aBasename === 'index' && bBasename === 'index') {
      // If both are index, sort by directory depth (shallower first)
      return a.split(path.sep).length - b.split(path.sep).length;
    }
    
    // Otherwise alphabetical
    return a.localeCompare(b);
  });
}

/**
 * Generate table of contents from processed files
 */
function generateTOC(processedFiles) {
  if (processedFiles.length === 0) return '';
  
  let toc = '## Table of Contents\n\n';
  processedFiles.forEach((file, index) => {
    const anchor = file.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    toc += `${index + 1}. [${file.title}](#${anchor})\n`;
  });
  toc += '\n---\n\n';
  
  return toc;
}

/**
 * Estimate token count for text
 * Common approximation: ~4 characters per token for English text
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 4 characters
  // This is a conservative estimate for English text
  return Math.ceil(text.length / 4);
}

/**
 * Combine files into a single markdown document
 */
function combineFiles(processedFiles, outputTitle) {
  if (processedFiles.length === 0) {
    return { content: `# ${outputTitle}\n\nNo files found.\n`, tokens: 0 };
  }
  
  let output = `# ${outputTitle}\n\n`;
  output += generateTOC(processedFiles);
  
  processedFiles.forEach((file, index) => {
    if (index > 0) {
      output += '\n---\n\n';
    }
    output += `# ${file.title}\n\n`;
    output += file.content;
    output += '\n\n';
  });
  
  const tokens = estimateTokens(output);
  return { content: output, tokens };
}

/**
 * Main function to generate master docs
 */
function generateMasterDocs() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const tokenSummary = [];
  let totalTokens = 0;
  
  TARGETS.forEach(target => {
    console.log(`Processing ${target.source}...`);
    
    let files = [];
    
    if (target.isSingleFile) {
      // Single file target
      const filePath = target.source;
      if (fs.existsSync(filePath)) {
        files = [filePath];
      } else {
        console.warn(`Warning: File ${filePath} not found`);
      }
    } else {
      // Directory target
      if (fs.existsSync(target.source)) {
        files = collectFiles(target.source);
        files = sortFiles(files);
      } else {
        console.warn(`Warning: Directory ${target.source} not found`);
      }
    }
    
    if (files.length === 0) {
      console.warn(`No files found for ${target.source}`);
      return;
    }
    
    // Process all files
    const processedFiles = files
      .map(processFile)
      .filter(file => file !== null);
    
    if (processedFiles.length === 0) {
      console.warn(`No valid files processed for ${target.source}`);
      return;
    }
    
    // Combine files with better title formatting
    let outputTitle = target.output.replace('.md', '');
    // Handle special cases
    const titleMap = {
      'api': 'API',
      'sdk-py': 'Python SDK',
      'sdk-postman': 'Postman SDK',
      'sheets': 'Google Sheets'
    };
    if (titleMap[outputTitle]) {
      outputTitle = titleMap[outputTitle];
    } else {
      // Default: capitalize words
      outputTitle = outputTitle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    const { content: combined, tokens } = combineFiles(processedFiles, outputTitle);
    
    // Write output
    const outputPath = path.join(OUTPUT_DIR, target.output);
    fs.writeFileSync(outputPath, combined, 'utf8');
    
    // Format token count with commas
    const tokenCount = tokens.toLocaleString();
    console.log(`✓ Generated ${outputPath} (${processedFiles.length} files, ~${tokenCount} tokens)`);
    
    // Store for summary
    tokenSummary.push({ file: target.output, tokens });
    totalTokens += tokens;
  });
  
  // Display summary
  console.log('\n📊 Token Summary:');
  console.log('─'.repeat(50));
  tokenSummary.forEach(({ file, tokens }) => {
    const tokenCount = tokens.toLocaleString();
    console.log(`  ${file.padEnd(20)} ~${tokenCount.padStart(12)} tokens`);
  });
  console.log('─'.repeat(50));
  console.log(`  ${'TOTAL'.padEnd(20)} ~${totalTokens.toLocaleString().padStart(12)} tokens`);
  console.log('\n✓ All master documentation files generated successfully!');
}

// Run the script
generateMasterDocs();
