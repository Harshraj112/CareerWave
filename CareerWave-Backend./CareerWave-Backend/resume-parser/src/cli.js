#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { parseResumeFile, parseResumeText, parseProfile } from "./parser.js";
import { getProviderConfig, isProviderConfigured, describeProvider } from "./ai-provider.js";
import { extractTextFromPDF } from "./pdf-extractor.js";
import dotenv from "dotenv";

dotenv.config();

// const API_KEY = process.env.OPENROUTER_API_KEY;   // original OpenRouter-only key
const API_KEY = getProviderConfig().apiKey; // provider chosen by AI_PROVIDER

if (!isProviderConfigured()) {
  console.error(`ERROR: AI provider "${describeProvider().provider}" is not configured in .env (AGENTROUTER_API_KEY or OPENROUTER_API_KEY)`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Hecknex Resume Parser CLI

Usage:
  npm run parse <filepath> [--output <filepath>]
  npm run parse <filepath> [--json]

Options:
  --output <filepath>   Save output to a JSON file
  --json               Print output as JSON only (no formatting)
  --help, -h           Show this help message

Examples:
  npm run parse resume.pdf
  npm run parse resume.pdf --output parsed.json
  npm run parse resume.pdf --json > output.json
`);
    process.exit(0);
  }

  const resumePath = args[0];
  const roleArg = args.includes("--role") ? args[args.indexOf("--role") + 1] : null;
  const profilePath = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : null;
  const outputPath = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : null;
  const jsonOnly = args.includes("--json");

  if (!resumePath && !profilePath) {
    console.error("ERROR: Please provide a resume file path or use --profile <path>");
    process.exit(1);
  }

  if (profilePath) {
    if (!fs.existsSync(profilePath)) {
      console.error(`ERROR: Profile file not found: ${profilePath}`);
      process.exit(1);
    }
    // Handle profile-only input and exit
    try {
      const profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
      const result = await parseProfile(profile, API_KEY);
      if (jsonOnly) console.log(JSON.stringify(result, null, 2));
      else console.log(JSON.stringify(result, null, 2));
      return;
    } catch (err) {
      console.error("ERROR:", err.message);
      process.exit(1);
    }
  } else {
    if (!fs.existsSync(resumePath)) {
      console.error(`ERROR: File not found: ${resumePath}`);
      process.exit(1);
    }
  }

    try {
    if (!jsonOnly) {
      console.log(`📄 Parsing resume: ${resumePath}`);
    }
    const fileBuffer = fs.readFileSync(resumePath);
    const ext = path.extname(resumePath).toLowerCase();

    let mimeType;
    switch (ext) {
      case ".pdf":
        // For PDFs: extract text first, then parse as text
        if (!jsonOnly) {
          console.log("📑 Extracting text from PDF...");
        }
        const pdfText = await extractTextFromPDF(fileBuffer);
        if (!jsonOnly) {
          console.log("✅ PDF text extracted");
        }
        const pdfParsed = await parseResumeText(pdfText, API_KEY, roleArg);

        if (jsonOnly) {
          console.log(JSON.stringify(pdfParsed, null, 2));
        } else {
          displayResult(pdfParsed);
        }

        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify(pdfParsed, null, 2));
          if (!jsonOnly) {
            console.log(`\n✅ Output saved to: ${outputPath}`);
          }
        }
        return;

      case ".png":
        mimeType = "image/png";
        break;
      case ".jpg":
      case ".jpeg":
        mimeType = "image/jpeg";
        break;
      case ".webp":
        mimeType = "image/webp";
        break;
      case ".gif":
        mimeType = "image/gif";
        break;
      case ".txt":
        // For text files, parse as text
        const text = fileBuffer.toString("utf-8");
        const parsed = await parseResumeText(text, API_KEY);

        if (jsonOnly) {
          console.log(JSON.stringify(parsed, null, 2));
        } else {
          displayResult(parsed);
        }

        if (outputPath) {
          fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
          if (!jsonOnly) {
            console.log(`\n✅ Output saved to: ${outputPath}`);
          }
        }
        return;

      default:
        console.error(`ERROR: Unsupported file type: ${ext}`);
        console.error("Supported: .pdf, .png, .jpg, .jpeg, .webp, .gif, .txt");
        process.exit(1);
    }

    const parsed = await parseResumeFile(fileBuffer, mimeType, API_KEY, roleArg);

    if (jsonOnly) {
      console.log(JSON.stringify(parsed, null, 2));
    } else {
      displayResult(parsed);
    }

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
      if (!jsonOnly) {
        console.log(`\n✅ Output saved to: ${outputPath}`);
      }
    }
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

// (profile handling moved into main())

function displayResult(parsed) {
  console.log("\n" + "=".repeat(60));
  console.log("PARSED RESUME");
  console.log("=".repeat(60) + "\n");

  // Personal Info
  if (parsed.personal_info) {
    console.log("📋 PERSONAL INFO:");
    const { personal_info } = parsed;
    if (personal_info.full_name)
      console.log(`  Name: ${personal_info.full_name}`);
    if (personal_info.email) console.log(`  Email: ${personal_info.email}`);
    if (personal_info.phone) console.log(`  Phone: ${personal_info.phone}`);
    if (personal_info.location)
      console.log(`  Location: ${personal_info.location}`);
    if (personal_info.linkedin_url)
      console.log(`  LinkedIn: ${personal_info.linkedin_url}`);
    if (personal_info.github_url)
      console.log(`  GitHub: ${personal_info.github_url}`);
    if (personal_info.portfolio_url)
      console.log(`  Portfolio: ${personal_info.portfolio_url}`);
    console.log();
  }

  // Summary
  if (parsed.summary) {
    console.log("📝 SUMMARY:");
    console.log(`  ${parsed.summary}\n`);
  }

  // Experience
  if (parsed.work_experience && parsed.work_experience.length > 0) {
    console.log("💼 WORK EXPERIENCE:");
    parsed.work_experience.forEach((exp, i) => {
      console.log(`  ${i + 1}. ${exp.title} at ${exp.company}`);
      if (exp.location) console.log(`     📍 ${exp.location}`);
      console.log(`     📅 ${exp.start_date} to ${exp.end_date || "Present"}`);
      if (exp.description && exp.description.length > 0) {
        exp.description.forEach((desc) => console.log(`     • ${desc}`));
      }
      if (exp.skills_used && exp.skills_used.length > 0) {
        console.log(
          `     Skills: ${exp.skills_used.join(", ")}`
        );
      }
    });
    console.log();
  }

  // Education
  if (parsed.education && parsed.education.length > 0) {
    console.log("🎓 EDUCATION:");
    parsed.education.forEach((edu, i) => {
      console.log(`  ${i + 1}. ${edu.degree} in ${edu.field_of_study}`);
      console.log(`     ${edu.institution}`);
      if (edu.location) console.log(`     📍 ${edu.location}`);
      console.log(`     📅 ${edu.start_date} to ${edu.end_date || "Present"}`);
      if (edu.gpa) console.log(`     GPA: ${edu.gpa}`);
    });
    console.log();
  }

  // Skills
  if (parsed.skills) {
    console.log("🛠️  SKILLS:");
    if (parsed.skills.technical && parsed.skills.technical.length > 0) {
      console.log(`  Technical: ${parsed.skills.technical.join(", ")}`);
    }
    if (parsed.skills.tools && parsed.skills.tools.length > 0) {
      console.log(`  Tools: ${parsed.skills.tools.join(", ")}`);
    }
    if (parsed.skills.soft && parsed.skills.soft.length > 0) {
      console.log(`  Soft Skills: ${parsed.skills.soft.join(", ")}`);
    }
    if (
      parsed.skills.languages_spoken &&
      parsed.skills.languages_spoken.length > 0
    ) {
      console.log(
        `  Languages: ${parsed.skills.languages_spoken.join(", ")}`
      );
    }
    console.log();
  }

  // Certifications
  if (parsed.certifications && parsed.certifications.length > 0) {
    console.log("🏆 CERTIFICATIONS:");
    parsed.certifications.forEach((cert, i) => {
      console.log(`  ${i + 1}. ${cert.name}`);
      if (cert.issuer) console.log(`     Issuer: ${cert.issuer}`);
      if (cert.date_obtained) console.log(`     Date: ${cert.date_obtained}`);
    });
    console.log();
  }

  // Warnings
  if (
    parsed.parsing_meta &&
    parsed.parsing_meta.warnings &&
    parsed.parsing_meta.warnings.length > 0
  ) {
    console.log("⚠️  WARNINGS:");
    parsed.parsing_meta.warnings.forEach((warning) => {
      console.log(`  • ${warning}`);
    });
    console.log();
  }

  console.log("=".repeat(60));
}

main();
