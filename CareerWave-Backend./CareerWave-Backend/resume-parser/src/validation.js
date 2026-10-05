import { parsePhoneNumber } from "libphonenumber-js";

/**
 * Validate email format
 */
export function validateEmail(email) {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email : null;
}

/**
 * Validate and normalize phone number
 */
export function validatePhone(phone) {
  if (!phone) return null;
  // Default region is configurable (Career Wave mostly serves India). If the
  // number cannot be normalised we keep what the resume says rather than
  // silently dropping real contact information.
  const region = process.env.DEFAULT_PHONE_COUNTRY || "IN";
  try {
    const parsed = parsePhoneNumber(String(phone), region);
    if (parsed && parsed.isPossible()) return parsed.formatInternational();
  } catch {
    /* keep original below */
  }
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 7 ? String(phone).trim() : null;
}

/**
 * Validate date format (YYYY-MM or YYYY)
 */
export function isValidDateFormat(date) {
  if (!date) return false;
  const dateRegex = /^\d{4}(-\d{2})?$/;
  return dateRegex.test(date);
}

/**
 * Sanity check: start_date should not be after end_date
 */
export function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate || endDate === "Present") return true;

  const start = new Date(startDate);
  const end = new Date(endDate);

  return start <= end;
}

/**
 * Compute total experience years from work experiences
 */
export function computeTotalExperienceYears(workExperiences) {
  if (!workExperiences || workExperiences.length === 0) return null;

  let totalMonths = 0;

  for (const exp of workExperiences) {
    if (!exp.start_date) continue;

    const startDate = new Date(exp.start_date);
    let endDate;

    if (!exp.end_date || exp.end_date === "Present") {
      endDate = new Date();
    } else {
      endDate = new Date(exp.end_date);
    }

    const months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    totalMonths += Math.max(0, months);
  }

  const years = Math.round((totalMonths / 12) * 10) / 10; // Round to 1 decimal place
  return years > 0 ? years : null;
}

/**
 * Validate URL format
 */
export function validateUrl(url) {
  if (!url) return null;
  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
    return url;
  } catch {
    return null;
  }
}

/**
 * Post-processing validation
 */
export function postProcessParsedResume(parsed, originalText = null) {
  const envelope = JSON.parse(JSON.stringify(parsed || {})); // Deep clone

  // The model returns an envelope { input_mode, target, resume_data, ... }.
  // Earlier versions validated top-level fields only, so nothing inside
  // resume_data was ever checked. Validate the resume object wherever it is.
  const hasEnvelope = envelope && typeof envelope.resume_data === "object" && envelope.resume_data !== null;
  if (!hasEnvelope && envelope.input_mode && envelope.input_mode !== "resume_analysis") {
    return envelope; // goal_roadmap / insufficient_input: nothing to validate
  }
  const processed = hasEnvelope ? envelope.resume_data : envelope;

  processed.parsing_meta = processed.parsing_meta && typeof processed.parsing_meta === "object" ? processed.parsing_meta : {};
  if (!Array.isArray(processed.parsing_meta.warnings)) processed.parsing_meta.warnings = [];

  // Validate personal info
  if (processed.personal_info) {
    processed.personal_info.email = validateEmail(processed.personal_info.email);
    processed.personal_info.phone = validatePhone(processed.personal_info.phone);

    if (processed.personal_info.linkedin_url) {
      processed.personal_info.linkedin_url = validateUrl(
        processed.personal_info.linkedin_url
      );
    }
    if (processed.personal_info.github_url) {
      processed.personal_info.github_url = validateUrl(
        processed.personal_info.github_url
      );
    }
    if (processed.personal_info.portfolio_url) {
      processed.personal_info.portfolio_url = validateUrl(
        processed.personal_info.portfolio_url
      );
    }
  }

  // Validate work experience dates
  if (processed.work_experience) {
    processed.work_experience.forEach((exp) => {
      if (exp.start_date && exp.end_date) {
        if (!validateDateRange(exp.start_date, exp.end_date)) {
          if (processed.parsing_meta) {
            processed.parsing_meta.warnings.push(
              `Work experience at ${exp.company} has invalid date range: ${exp.start_date} to ${exp.end_date}`
            );
          }
        }
      }
    });
  }

  // Validate education dates
  if (processed.education) {
    processed.education.forEach((edu) => {
      if (edu.start_date && edu.end_date) {
        if (!validateDateRange(edu.start_date, edu.end_date)) {
          if (processed.parsing_meta) {
            processed.parsing_meta.warnings.push(
              `Education at ${edu.institution} has invalid date range: ${edu.start_date} to ${edu.end_date}`
            );
          }
        }
      }
    });
  }

  // Recompute total_experience_years as a cross-check
  if (!processed.total_experience_years && processed.work_experience) {
    processed.total_experience_years = computeTotalExperienceYears(
      processed.work_experience
    );
  }

  // Fallback: if awards or volunteer_experience missing, try to extract from raw text
  if (originalText && typeof originalText === "string") {
    const txt = originalText;

    // Extract ACHIEVEMENTS section into awards if empty
    if ((!processed.awards || processed.awards.length === 0) && /achievements/i.test(txt)) {
      const match = txt.match(/achievements\s*\n([\s\S]*?)(?:\n\s*\n|\n[A-Z]{2,}|$)/i);
      if (match && match[1]) {
        const body = match[1].trim();
        const items = body.split(/\n+/).map((s) => s.replace(/^\s*[-•\*]\s*/,'').trim()).filter(Boolean);
        processed.awards = items.map((it) => ({ title: it }));
      }
    }

    // Extract LEADERSHIP section into volunteer_experience if empty
    if ((!processed.volunteer_experience || processed.volunteer_experience.length === 0) && /leadership/i.test(txt)) {
      const match = txt.match(/leadership\s*\n([\s\S]*?)(?:\n\s*\n|\n[A-Z]{2,}|$)/i);
      if (match && match[1]) {
        const body = match[1].trim();
        const items = body.split(/\n+/).map((s) => s.replace(/^\s*[-•\*]\s*/,'').trim()).filter(Boolean);
        processed.volunteer_experience = items.map((it) => ({ organization: null, role: it, description: null }));
      }
    }
  }

  return hasEnvelope ? envelope : processed;
}
