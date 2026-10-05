#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

try:
    from fastapi import FastAPI
except Exception:  # pragma: no cover - optional for Render
    FastAPI = None  # type: ignore[assignment]

try:
    from jobspy import scrape_jobs
except Exception:  # pragma: no cover - optional for tests or minimal installs
    scrape_jobs = None  # type: ignore[assignment]

SOURCE_PRIORITY = ["indeed", "linkedin", "google", "naukri"]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape recent Indian jobs with JobSpy.")
    parser.add_argument("--search-term", default="software engineer", help="Primary search term")
    parser.add_argument("--location", default="India", help="Location search value")
    parser.add_argument("--days", type=int, default=30, help="Look back in days")
    parser.add_argument("--results-wanted", type=int, default=100, help="Total jobs requested")
    parser.add_argument("--sites", default="indeed,linkedin,google", help="Comma-separated sources to query")
    parser.add_argument("--country-indeed", default="INDIA", help="Country value used for Indeed")
    parser.add_argument("--output-dir", default="output", help="Directory to save CSV and JSON output")
    parser.add_argument(
        "--output-name",
        default="india_jobs",
        help="Base file name (without extension). Career Wave writes role-specific catalogs as roles/<slug>.",
    )
    parser.add_argument(
        "--job-type",
        default=None,
        choices=["fulltime", "parttime", "internship", "contract"],
        help="Optional JobSpy job_type filter",
    )
    parser.add_argument("--is-remote", action="store_true", help="Only remote jobs")
    return parser.parse_args(argv)


def normalize_scalar(value: Any) -> Any:
    if pd.isna(value):
        return None
    return value


def format_salary(row: dict[str, Any]) -> str:
    min_amount = normalize_scalar(row.get("min_amount"))
    max_amount = normalize_scalar(row.get("max_amount"))
    currency = normalize_scalar(row.get("currency"))
    interval = normalize_scalar(row.get("interval"))

    if min_amount is None and max_amount is None:
        return "Not specified"

    pieces: list[str] = []
    if currency:
        pieces.append(str(currency))
    if min_amount is not None:
        pieces.append(str(min_amount))
    if max_amount is not None and max_amount != min_amount:
        pieces.append(f"- {max_amount}")
    if interval:
        pieces.append(f"/{interval}")
    return " ".join(pieces).strip() if pieces else "Not specified"


def format_tags(row: dict[str, Any]) -> str:
    tag_values: list[str] = []
    for key in ["job_type", "job_level", "job_function", "skills", "company_industry"]:
        value = row.get(key)
        if value is None or pd.isna(value):
            continue
        if isinstance(value, str):
            parts = [part.strip() for part in value.split(",") if part.strip()]
            tag_values.extend(parts)
        elif isinstance(value, list):
            tag_values.extend(str(item).strip() for item in value if str(item).strip())
        else:
            text = str(value).strip()
            if text:
                tag_values.append(text)

    seen: set[str] = set()
    ordered_tags: list[str] = []
    for tag in tag_values:
        token = tag.strip()
        if not token:
            continue
        key = token.lower()
        if key not in seen:
            seen.add(key)
            ordered_tags.append(token)

    return ", ".join(ordered_tags) if ordered_tags else "Not specified"


def normalize_posted_date(value: Any) -> str:
    if value is None or pd.isna(value):
        return "Not specified"
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


TRUSTED_SOURCES = {"linkedin": 18, "indeed": 16, "naukri": 16, "glassdoor": 14, "google": 10}


def compute_credibility(record: dict[str, Any]) -> int:
    """Deterministic credibility estimate from listing completeness.

    Previously this was ``random.randint(55, 90)`` and was re-rolled on every
    read, so the "Credibility" shown in Telegram/WhatsApp alerts was noise.
    The score now reflects things a user can verify on the listing itself.
    """
    score = 40
    score += TRUSTED_SOURCES.get(str(record.get("source") or "").lower(), 6)
    if str(record.get("company") or "").strip() not in {"", "Unknown"}:
        score += 12
    if str(record.get("location") or "").strip() not in {"", "Not specified"}:
        score += 6
    if str(record.get("posted_date") or "").strip() not in {"", "Not specified"}:
        score += 8
    if str(record.get("salary") or "").strip() not in {"", "Not specified"}:
        score += 6
    link = str(record.get("link") or "")
    if link.startswith("https://"):
        score += 6
    if len(str(record.get("description") or "")) > 200:
        score += 4
    return max(0, min(100, score))


def add_confidence_score(record: dict[str, Any]) -> dict[str, Any]:
    score = compute_credibility(record)
    record["confidence_score"] = score
    record["credibility_score"] = score
    return record


def clean_text(value: Any, limit: int = 1500) -> str:
    value = normalize_scalar(value) if not isinstance(value, (list, dict)) else value
    if value is None:
        return ""
    text = " ".join(str(value).split())
    return text[:limit]


def normalize_record(row: dict[str, Any]) -> dict[str, Any]:
    source = str(normalize_scalar(row.get("site")) or "unknown").lower()
    link = normalize_scalar(row.get("job_url")) or normalize_scalar(row.get("job_url_direct")) or ""
    title = normalize_scalar(row.get("title")) or "Not specified"
    company = normalize_scalar(row.get("company")) or "Unknown"
    location = normalize_scalar(row.get("location")) or "Not specified"
    salary = format_salary(row)
    tags = format_tags(row)
    posted_date = normalize_posted_date(row.get("date_posted"))
    scraped_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    record = {
        "title": title,
        "company": company,
        "location": location,
        "salary": salary,
        "tags": tags,
        "posted_date": posted_date,
        "source": source,
        "link": str(link),
        "scraped_at": scraped_at,
        # Extra fields used by Career Wave to rank jobs against a user's profile.
        "description": clean_text(row.get("description")),
        "job_type": clean_text(row.get("job_type"), 80) or None,
        "job_level": clean_text(row.get("job_level"), 80) or None,
        "is_remote": bool(normalize_scalar(row.get("is_remote")) or False),
    }
    return add_confidence_score(record)


def build_ordered_records(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_links: set[str] = set()

    for record in records:
        source = str(record.get("source", "unknown")).lower()
        link = str(record.get("link") or "").strip()
        if not link or link in seen_links:
            continue
        seen_links.add(link)
        by_source[source].append(record)

    for source in by_source:
        by_source[source].sort(key=lambda item: str(item.get("posted_date", "")).lower(), reverse=True)

    ordered: list[dict[str, Any]] = []
    active_sources = [source for source in SOURCE_PRIORITY if by_source.get(source)]
    while True:
        progressed = False
        for source in active_sources:
            bucket = by_source.get(source, [])
            if bucket:
                ordered.append(bucket.pop(0))
                progressed = True
        if not progressed:
            break
    return ordered


def export_csv(path: Path, records: list[dict[str, Any]]) -> None:
    fieldnames = ["title", "company", "location", "salary", "tags", "posted_date", "source", "link", "scraped_at", "confidence_score", "credibility_score", "job_type", "job_level", "is_remote"]
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for row in records:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def export_json(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump([add_confidence_score(record) for record in records], handle, ensure_ascii=False, indent=2)


def is_placeholder_job(record: dict[str, Any]) -> bool:
    company = str(record.get("company") or "").strip()
    link = str(record.get("link") or "").strip()
    title = str(record.get("title") or "").strip()
    return company == "Example" or link.startswith("https://example.com/") or title.startswith("Job ") and company == "Example"


def read_jobs_file(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (json.JSONDecodeError, OSError):
        return []

    if not isinstance(payload, list):
        return []

    clean_records: list[dict[str, Any]] = []
    for record in payload:
        if not isinstance(record, dict):
            continue
        if is_placeholder_job(record):
            continue
        clean_records.append(add_confidence_score(record))
    return clean_records


def extract_next_jobs(path: Path, batch_size: int = 5) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    records = read_jobs_file(path)
    if not records:
        return []

    batch = records[: max(1, batch_size)]
    remaining = records[max(1, batch_size):]
    with path.open("w", encoding="utf-8") as handle:
        json.dump([add_confidence_score(record) for record in remaining], handle, ensure_ascii=False, indent=2)
    return batch


def summarize(records: list[dict[str, Any]], search_term: str, location: str, days: int) -> dict[str, Any]:
    counts = defaultdict(int)
    for row in records:
        counts[row.get("source", "unknown")] += 1

    return {
        "search_term": search_term,
        "location": location,
        "days": days,
        "total_jobs": len(records),
        "sources": dict(sorted(counts.items())),
        "sample_jobs": records[:5],
    }


def run_scrape(args: argparse.Namespace):
    site_names = [site.strip().lower() for site in args.sites.split(",") if site.strip()]
    if scrape_jobs is None:
        raise RuntimeError("The 'jobspy' package is not available in this environment.")

    kwargs: dict[str, Any] = dict(
        site_name=site_names,
        search_term=args.search_term,
        google_search_term=f"{args.search_term} jobs in {args.location} within {args.days} days",
        location=args.location,
        results_wanted=args.results_wanted,
        hours_old=max(24, args.days * 24),
        country_indeed=args.country_indeed,
        linkedin_fetch_description=True,
        verbose=0,
    )
    if getattr(args, "job_type", None):
        kwargs["job_type"] = args.job_type
    if getattr(args, "is_remote", False):
        kwargs["is_remote"] = True
    return scrape_jobs(**kwargs)


def main() -> None:
    args = parse_args()
    root_dir = Path(__file__).resolve().parent
    output_dir = root_dir / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    jobs_df = run_scrape(args)

    if jobs_df is None or jobs_df.empty:
        raise RuntimeError("No jobs returned by JobSpy for the selected query.")

    raw_records = jobs_df.to_dict(orient="records")
    normalized_records = [normalize_record(row) for row in raw_records]
    for record in normalized_records:
        record["search_term"] = args.search_term
    ordered_records = build_ordered_records(normalized_records)

    base = output_dir / args.output_name
    base.parent.mkdir(parents=True, exist_ok=True)
    csv_path = base.with_name(base.name + ".csv")
    json_path = base.with_name(base.name + ".json")
    summary_path = base.with_name(base.name + "_summary.json")

    export_csv(csv_path, ordered_records)
    export_json(json_path, ordered_records)
    export_json(summary_path, [summarize(ordered_records, args.search_term, args.location, args.days)])

    print(f"Saved {len(ordered_records)} jobs to {csv_path}")
    print(f"Saved JSON to {json_path}")
    print(f"Saved summary to {summary_path}")


if FastAPI is not None:
    app = FastAPI(title="India Jobs API")

    @app.get("/")
    async def root() -> dict[str, Any]:
        return {"status": "ok", "message": "Use /jobs to fetch the next 5 jobs."}

    @app.get("/jobs")
    async def get_jobs(batch_size: int = 5) -> dict[str, Any]:
        output_dir = Path(__file__).resolve().parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        json_path = output_dir / "india_jobs.json"

        if json_path.exists() and read_jobs_file(json_path):
            jobs = extract_next_jobs(json_path, batch_size=max(1, min(10, batch_size)))
            if not jobs:
                return {"jobs": [], "remaining": 0, "batch_size": 0}
            return {"jobs": jobs, "remaining": len(read_jobs_file(json_path)), "batch_size": len(jobs)}

        if scrape_jobs is None:
            return {"jobs": [], "remaining": 0, "batch_size": 0, "error": "jobspy not installed"}

        # parse_args() would read uvicorn's own CLI flags here; use defaults instead.
        args = parse_args([])
        jobs_df = run_scrape(args)

        if jobs_df is None or jobs_df.empty:
            return {"jobs": [], "remaining": 0, "batch_size": 0, "error": "No jobs returned"}

        ordered_records = build_ordered_records([normalize_record(row) for row in jobs_df.to_dict(orient="records")])
        export_json(json_path, ordered_records)
        jobs = extract_next_jobs(json_path, batch_size=max(1, min(10, batch_size)))
        return {"jobs": jobs, "remaining": len(read_jobs_file(json_path)), "batch_size": len(jobs)}


if __name__ == "__main__":
    main()
