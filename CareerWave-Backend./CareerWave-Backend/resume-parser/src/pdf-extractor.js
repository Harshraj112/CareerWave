import { createRequire } from "module";

const require = createRequire(import.meta.url);

/**
 * pdf-parse@1's package entry point (index.js) runs a self-test that reads
 * ./test/data/05-versions-space.pdf whenever `module.parent` is undefined —
 * which is always the case when it is imported from an ES module, so the
 * server crashed on the first PDF. Loading the library file directly skips it.
 */
let pdfParse;
function loadPdfParse() {
  if (!pdfParse) pdfParse = require("pdf-parse/lib/pdf-parse.js");
  return pdfParse;
}

/**
 * Extract text from PDF buffer
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await loadPdfParse()(pdfBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract raw text from a .docx file (the upload UI has always advertised DOCX,
 * but the parser rejected it as an unsupported type).
 * @param {Buffer} docxBuffer
 * @returns {Promise<string>}
 */
export async function extractTextFromDocx(docxBuffer) {
  let mammoth;
  try {
    mammoth = require("mammoth");
  } catch {
    throw new Error("DOCX support requires the 'mammoth' package (npm install mammoth)");
  }
  const result = await mammoth.extractRawText({ buffer: docxBuffer });
  return result.value;
}
