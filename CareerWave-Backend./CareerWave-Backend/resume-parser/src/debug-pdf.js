#!/usr/bin/env node
import fs from "fs";
import pdfParse from "pdf-parse";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node src/debug-pdf.js <pdf-path>");
    process.exit(1);
  }

  try {
    const buffer = fs.readFileSync(file);
    const data = await pdfParse(buffer);
    const text = data.text || "";

    console.log("numpages:", data.numpages || "unknown");
    console.log("text length:", text.length);
    const lower = text.toLowerCase();
    console.log("contains 'linkedin':", lower.includes("linkedin"));
    console.log("contains 'github':", lower.includes("github"));

    fs.writeFileSync("extracted_debug.txt", text, "utf-8");
    console.log("Wrote extracted_debug.txt with full extracted text.");
  } catch (err) {
    console.error("Error extracting PDF:", err.message);
    process.exit(1);
  }
}

main();
