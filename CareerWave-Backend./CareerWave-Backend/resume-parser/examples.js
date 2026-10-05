// Example: Using the Resume Parser Programmatically

import { parseResumeFile, parseResumeText } from "./src/parser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Example 1: Parse a PDF resume file
 */
async function exampleParsePDF() {
  console.log("📄 Example 1: Parse PDF Resume\n");

  try {
    const resumePath = path.join(__dirname, "sample-resume.pdf");

    // Check if sample file exists
    if (!fs.existsSync(resumePath)) {
      console.log(
        "Note: sample-resume.pdf not found. Create one to test this example."
      );
      return;
    }

    const fileBuffer = fs.readFileSync(resumePath);
    const apiKey = process.env.GEMINI_API_KEY;

    const result = await parseResumeFile(fileBuffer, "application/pdf", apiKey);

    console.log("✅ Parsed successfully!");
    console.log("Name:", result.personal_info.full_name);
    console.log("Email:", result.personal_info.email);
    console.log("Experience (years):", result.total_experience_years);
    console.log("Technical Skills:", result.skills.technical.slice(0, 3));
    console.log();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 2: Parse extracted resume text
 */
async function exampleParseText() {
  console.log("📝 Example 2: Parse Resume Text\n");

  const resumeText = `
    JOHN DOE
    john.doe@example.com | (555) 123-4567 | San Francisco, CA
    LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

    PROFESSIONAL SUMMARY
    Senior Software Engineer with 7+ years of experience in full-stack development.
    Passionate about building scalable systems and mentoring junior developers.

    WORK EXPERIENCE
    Senior Engineer | Tech Corp | San Francisco, CA
    March 2021 - Present
    • Led migration of monolith to microservices architecture
    • Reduced API response time by 60% through optimization
    • Mentored 3 junior engineers

    Software Engineer | StartupXYZ | San Francisco, CA
    June 2018 - February 2021
    • Built customer-facing web application with React and Node.js
    • Implemented CI/CD pipeline using GitHub Actions
    • Improved test coverage from 45% to 85%

    EDUCATION
    Bachelor of Science in Computer Science
    UC Berkeley | Berkeley, CA | 2014 - 2018

    SKILLS
    Languages: JavaScript, Python, Go, Java
    Frontend: React, Vue.js, TypeScript
    Backend: Node.js, Django, FastAPI, Go
    DevOps: Docker, Kubernetes, AWS, GitHub Actions
    Databases: PostgreSQL, MongoDB, Redis

    CERTIFICATIONS
    AWS Certified Solutions Architect - Associate (2021)
    Kubernetes Application Developer (2022)
  `;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const result = await parseResumeText(resumeText, apiKey);

    console.log("✅ Parsed successfully!");
    console.log("Name:", result.personal_info.full_name);
    console.log("Email:", result.personal_info.email);
    console.log("Experience (years):", result.total_experience_years);
    console.log(
      "Work Experiences:",
      result.work_experience.map((w) => w.title).join(", ")
    );
    console.log("Technical Skills:", result.skills.technical);
    console.log();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 3: Extract specific information from parsed resume
 */
async function exampleExtractInfo() {
  console.log("🔍 Example 3: Extract Specific Information\n");

  const resumeText = `
    JANE SMITH
    jane.smith@company.com | +1-555-987-6543

    EXPERIENCE
    Project Manager | Company ABC | 2020 - Present
    Scrum Master | Company XYZ | 2018 - 2020

    SKILLS
    Agile, Leadership, Communication, Project Management
  `;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const parsed = await parseResumeText(resumeText, apiKey);

    // Extract and display specific fields
    const email = parsed.personal_info.email;
    const phone = parsed.personal_info.phone;
    const jobTitles = parsed.work_experience.map((exp) => exp.title);
    const hasLeadership = parsed.skills.soft.includes("Leadership");

    console.log("Email:", email);
    console.log("Phone:", phone);
    console.log("Job Titles:", jobTitles);
    console.log("Has Leadership Skills:", hasLeadership);
    console.log("Parse Quality:", parsed.parsing_meta.is_resume ? "✅ Resume" : "❌ Not a resume");
    console.log();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 4: Batch processing multiple files
 */
async function exampleBatchProcess() {
  console.log("📦 Example 4: Batch Process Multiple Resumes\n");

  const resumes = [
    {
      name: "Jane Doe - Senior Engineer",
      text: "Jane Doe | Senior Software Engineer | jane@example.com",
    },
    {
      name: "Bob Smith - Product Manager",
      text: "Bob Smith | Product Manager | bob@example.com",
    },
  ];

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const results = [];

    for (const resume of resumes) {
      console.log(`Processing: ${resume.name}`);
      const parsed = await parseResumeText(resume.text, apiKey);
      results.push({
        name: resume.name,
        fullName: parsed.personal_info.full_name,
        email: parsed.personal_info.email,
      });
    }

    console.log("\n✅ Batch Processing Complete:");
    results.forEach((r) => {
      console.log(`- ${r.name}: ${r.fullName} (${r.email})`);
    });
    console.log();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

/**
 * Example 5: Error handling and validation
 */
async function exampleErrorHandling() {
  console.log("⚠️  Example 5: Error Handling\n");

  const invalidResume = "This is just random text, not a resume at all.";

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const parsed = await parseResumeText(invalidResume, apiKey);

    if (!parsed.parsing_meta.is_resume) {
      console.log("❌ This is not recognized as a resume");
      console.log("Warnings:", parsed.parsing_meta.warnings);
    } else {
      console.log("✅ Valid resume");
    }

    // Check for parsing warnings
    if (parsed.parsing_meta.warnings.length > 0) {
      console.log("⚠️  Warnings during parsing:");
      parsed.parsing_meta.warnings.forEach((w) => {
        console.log(`  - ${w}`);
      });
    }

    console.log();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

/**
 * Main function - run all examples
 */
async function main() {
  console.log("================================================");
  console.log("Hecknex Resume Parser - Usage Examples");
  console.log("================================================\n");

  if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY not found in .env");
    console.error("Please set GEMINI_API_KEY in your .env file");
    process.exit(1);
  }

  // Run examples
  await exampleParsePDF();
  await exampleParseText();
  await exampleExtractInfo();
  await exampleBatchProcess();
  await exampleErrorHandling();

  console.log("================================================");
  console.log("Examples completed!");
  console.log("================================================");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  exampleParsePDF,
  exampleParseText,
  exampleExtractInfo,
  exampleBatchProcess,
  exampleErrorHandling,
};
