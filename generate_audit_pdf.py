#!/usr/bin/env python3
"""
Royaltē Unified Audit PDF Renderer
==================================

ONE renderer, TWO themes. Reads the canonical AuditResponse JSON (from
/api/audit) and produces either the branded or print-optimized PDF.

Usage
-----
  python3 generate_audit_pdf.py --payload scan.json --theme brand --out report.pdf
  python3 generate_audit_pdf.py --payload scan.json --theme print --out report.pdf

Contract
--------
Input JSON MUST conform to AuditResponse schema v1.0.0
(mirror of api/schema/auditResponse.js). Any missing required fields,
type mismatches, or enum violations will raise AuditSchemaError and
NO PDF will be generated. This is by design — the goal is zero drift.

A field that is legitimately unavailable must be explicitly labeled:
- modules.*.availability = "AUTH_UNAVAILABLE"  (renders as "Unavailable")
- platforms.*.availability = "AUTH_UNAVAILABLE"
Silent zero/blank fallback is NOT permitted.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


SCHEMA_VERSION = "1.0.0"


# ═══════════════════════════════════════════════════════════════════════════
# CANONICAL SCHEMA (Pydantic) — mirrors api/schema/auditResponse.js exactly
# ═══════════════════════════════════════════════════════════════════════════

PlatformAvailability = Literal["VERIFIED", "NOT_FOUND", "AUTH_UNAVAILABLE", "ERROR"]
CoverageStatus = Literal["Verified", "Not Confirmed", "Not Connected"]
ModuleAvailability = Literal["AVAILABLE", "PARTIAL", "AUTH_UNAVAILABLE"]
Severity = Literal["CRITICAL", "HIGH", "WARNING", "INFO"]
RiskLevel = Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
OwnershipStatus = Literal["verified", "unverified", "at_risk"]
OwnershipConfidence = Literal["HIGH", "MEDIUM", "LOW", "AUTH_UNAVAILABLE"]
Grade = Literal["A", "B", "C", "D", "F"]


class Source(BaseModel):
    platform: Literal["spotify", "apple_music"]
    urlType: Literal["artist", "track", "album"]
    resolvedFrom: Literal["artist", "track", "album"]
    originalUrl: str
    storefront: Optional[str] = None


class Subject(BaseModel):
    artistName: str
    artistId: str
    trackTitle: Optional[str] = None
    trackIsrc: Optional[str] = None
    trackIsrcSource: Optional[str] = None
    albumName: Optional[str] = None


class Metrics(BaseModel):
    followers: int
    popularity: int
    genres: list[str]
    lastfmPlays: int
    lastfmListeners: int
    deezerFans: int
    tidalPopularity: int
    discogsReleases: int
    country: Optional[str] = None
    wikipediaUrl: Optional[str] = None


class Catalog(BaseModel):
    totalReleases: int
    earliestYear: Optional[int] = None
    latestYear: Optional[int] = None
    catalogAgeYears: int
    estimatedAnnualStreams: int
    recentActivity: bool


class PlatformEntry(BaseModel):
    availability: PlatformAvailability
    details: Optional[Any] = None


class Platforms(BaseModel):
    spotify: PlatformEntry
    appleMusic: PlatformEntry
    musicbrainz: PlatformEntry
    deezer: PlatformEntry
    audiodb: PlatformEntry
    discogs: PlatformEntry
    soundcloud: PlatformEntry
    lastfm: PlatformEntry
    wikipedia: PlatformEntry
    youtube: PlatformEntry
    tidal: PlatformEntry


class CoverageEntry(BaseModel):
    status: CoverageStatus
    tier: Optional[str] = None


class AuditCoverage(BaseModel):
    spotify: CoverageEntry
    appleMusic: CoverageEntry
    publishing: CoverageEntry
    soundExchange: CoverageEntry


class CoverageRawEntry(BaseModel):
    connected: bool


class AuditCoverageRaw(BaseModel):
    deprecated: bool = Field(alias="_deprecated")
    spotify: CoverageRawEntry
    apple_music: CoverageRawEntry

    model_config = {"populate_by_name": True}


class Module(BaseModel):
    key: str
    name: str
    score: Optional[int] = Field(ge=0, le=100, default=None)
    grade: Optional[Grade] = None
    availability: ModuleAvailability
    issueCount: int
    flags: list[str]


class Modules(BaseModel):
    metadata: Module
    coverage: Module
    publishing: Module
    duplicates: Module
    youtube: Module
    sync: Module


class Issue(BaseModel):
    id: str
    module: str
    moduleName: str
    severity: Severity
    title: str
    detail: str
    source: Literal["module", "catalog", "ownership", "platform"]


class Score(BaseModel):
    overall: int = Field(ge=0, le=100)
    riskLevel: RiskLevel
    riskSummary: str
    moduleAverage: int = Field(ge=0, le=100)
    ownershipImpact: int


class RoyaltyGap(BaseModel):
    estAnnualStreams: int
    estLifetimeStreams: int
    estSpotifyRoyalties: int
    estPROEarnings: int
    estTotalRoyalties: int
    potentialGapLow: int
    potentialGapHigh: int
    catalogYears: int
    ugcUnmonetisedViews: int
    ugcPotentialRevenue: int
    disclaimer: str


class ProGuide(BaseModel):
    pro: str
    url: str
    steps: list[str]
    note: str
    country: Optional[str] = None


class Ownership(BaseModel):
    status: OwnershipStatus
    confidence: OwnershipConfidence
    scoreImpact: int
    render: Any


class AuditResponse(BaseModel):
    schemaVersion: str
    scanId: str
    scannedAt: str
    source: Source
    subject: Subject
    metrics: Metrics
    catalog: Catalog
    platforms: Platforms
    auditCoverage: AuditCoverage
    auditCoverageRaw: AuditCoverageRaw
    modules: Modules
    issues: list[Issue]
    score: Score
    royaltyGap: RoyaltyGap
    proGuide: ProGuide
    ownership: Ownership
    territoryCoverage: Optional[Any] = None
    isrcValidation: Optional[Any] = None

    @field_validator("schemaVersion")
    @classmethod
    def _schema_version_must_match(cls, v: str) -> str:
        if v != SCHEMA_VERSION:
            raise ValueError(f"schemaVersion mismatch — expected {SCHEMA_VERSION}, got {v}")
        return v


class AuditSchemaError(Exception):
    """Raised when canonical payload fails validation."""


# ═══════════════════════════════════════════════════════════════════════════
# THEME SYSTEM — two palettes, one layout
# ═══════════════════════════════════════════════════════════════════════════

# Register DejaVu fonts (handles ē glyph correctly)
FONT_DIR = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV",    FONT_DIR + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DV-B",  FONT_DIR + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DV-I",  FONT_DIR + "DejaVuSans-Oblique.ttf"))
pdfmetrics.registerFont(TTFont("DV-M",  FONT_DIR + "DejaVuSansMono.ttf"))


class Theme:
    """Base theme — overridden by BrandTheme and PrintTheme."""
    # Colors (text)
    ink = colors.HexColor("#1A1A2E")
    muted = colors.HexColor("#5A5870")
    line = colors.HexColor("#D0D0D8")
    rule = colors.HexColor("#8A8A98")
    brand = colors.HexColor("#8A5CFF")
    critical = colors.HexColor("#D03040")
    warning = colors.HexColor("#C88020")
    ok = colors.HexColor("#1F9060")
    info = colors.HexColor("#2880B0")
    # Backgrounds — overridden per theme
    page_bg = colors.white
    card_bg = colors.white
    # Feature flags
    use_card_backgrounds = False
    use_severity_fills = False
    use_score_fills = False


class BrandTheme(Theme):
    """Cinematic light theme — white cards on light grey, tinted sections."""
    page_bg = colors.HexColor("#F5F5F7")
    card_bg = colors.white
    use_card_backgrounds = True
    use_severity_fills = True
    use_score_fills = True


class PrintTheme(Theme):
    """Ink-saving theme — pure white, colored text/accents only, no fills."""
    page_bg = colors.white
    card_bg = colors.white
    use_card_backgrounds = False
    use_severity_fills = False
    use_score_fills = False


def get_theme(name: str) -> Theme:
    if name == "brand":
        return BrandTheme()
    if name == "print":
        return PrintTheme()
    raise ValueError(f"unknown theme '{name}' — expected 'brand' or 'print'")


# ═══════════════════════════════════════════════════════════════════════════
# RENDERING HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def score_color(t: Theme, score: Optional[int]):
    # Aligned with risk level bands: 80+ LOW (green), 60-79 MODERATE (info blue),
    # 40-59 HIGH (warning amber), <40 CRITICAL (red). Note: MODERATE uses info blue
    # to read as "watch" rather than "alarm" — the risk label below the number
    # carries the cautionary weight.
    if score is None:
        return t.muted
    if score >= 80:
        return t.ok
    if score >= 60:
        return t.info
    if score >= 40:
        return t.warning
    return t.critical


def severity_color(t: Theme, sev: str):
    return {
        "CRITICAL": t.critical,
        "HIGH": t.critical,
        "WARNING": t.warning,
        "INFO": t.info,
    }.get(sev, t.muted)


def coverage_color(t: Theme, status: str):
    return {
        "Verified": t.ok,
        "Not Confirmed": t.warning,
        "Not Connected": t.critical,
    }.get(status, t.muted)


def availability_badge(avail: str) -> str:
    """Convert an availability enum into a readable chip label."""
    return {
        "VERIFIED": "Verified",
        "NOT_FOUND": "Not found",
        "AUTH_UNAVAILABLE": "Unavailable",
        "ERROR": "Error",
        "AVAILABLE": "Available",
        "PARTIAL": "Partial",
    }.get(avail, avail)


def style(name: str, font: str = "DV", size: int = 9, color=colors.black,
          lead: Optional[float] = None, align: int = 0) -> ParagraphStyle:
    return ParagraphStyle(
        name=name, fontName=font, fontSize=size, textColor=color,
        leading=lead or size * 1.3, alignment=align,
    )


# ═══════════════════════════════════════════════════════════════════════════
# MAIN RENDERER
# ═══════════════════════════════════════════════════════════════════════════

def render_pdf(payload: AuditResponse, theme: Theme, out_path: Path) -> None:
    doc = SimpleDocTemplate(
        str(out_path), pagesize=letter,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.55 * inch, bottomMargin=0.55 * inch,
    )
    W = letter[0] - 1.2 * inch
    story: list = []

    generated = _fmt_timestamp(payload.scannedAt)

    # ── HEADER ──────────────────────────────────────────────────────────────
    story.extend(_render_header(payload, theme, W))

    # ── SUBJECT + RISK SCORE ────────────────────────────────────────────────
    story.extend(_render_subject_and_score(payload, theme, W, generated))

    # ── MODULE SCORES ───────────────────────────────────────────────────────
    story.extend(_render_modules(payload, theme, W))

    # ── AUDIT COVERAGE ──────────────────────────────────────────────────────
    story.extend(_render_coverage(payload, theme, W))

    # ── FINDINGS ────────────────────────────────────────────────────────────
    story.extend(_render_issues(payload, theme, W))

    # ── ROYALTY GAP ─────────────────────────────────────────────────────────
    story.extend(_render_royalty_gap(payload, theme, W))

    # ── PRO GUIDE ───────────────────────────────────────────────────────────
    story.extend(_render_pro_guide(payload, theme, W))

    # ── FOOTER ──────────────────────────────────────────────────────────────
    story.extend(_render_footer(payload, theme, W, generated))

    def _bg(canv, _doc):
        canv.saveState()
        canv.setFillColor(theme.page_bg)
        canv.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
        canv.restoreState()

    doc.build(story, onFirstPage=_bg, onLaterPages=_bg)


def _fmt_timestamp(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%B %d, %Y · %I:%M %p UTC")
    except ValueError:
        return iso


# ── Section renderers ───────────────────────────────────────────────────────

def _render_header(p: AuditResponse, t: Theme, W: float) -> list:
    tbl = Table([[
        Paragraph("<b>Royaltē</b>", style("logo", "DV-B", 18, colors.black)),
        Paragraph("ROYALTY AUDIT REPORT", style("hd", "DV-B", 10, t.brand, align=2)),
    ]], colWidths=[W * 0.5, W * 0.5])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [
        tbl,
        HRFlowable(width=W, thickness=1, color=t.brand, spaceBefore=4, spaceAfter=10),
    ]


def _render_subject_and_score(p: AuditResponse, t: Theme, W: float, generated: str) -> list:
    out: list = []
    # Subject block
    rows = [
        [Paragraph("ARTIST", style("k", "DV-B", 7, t.muted)),
         Paragraph(p.subject.artistName, style("v", "DV-B", 13, colors.black))],
        [Paragraph("SCAN TYPE", style("k", "DV-B", 7, t.muted)),
         Paragraph(p.source.urlType.title(), style("v", "DV", 10, t.ink))],
        [Paragraph("SOURCE", style("k", "DV-B", 7, t.muted)),
         Paragraph(p.source.platform.replace("_", " ").title(), style("v", "DV", 10, t.ink))],
        [Paragraph("GENERATED", style("k", "DV-B", 7, t.muted)),
         Paragraph(generated, style("v", "DV", 10, t.ink))],
        [Paragraph("SCAN ID", style("k", "DV-B", 7, t.muted)),
         Paragraph(p.scanId, style("v", "DV-M", 7, t.muted))],
    ]
    if p.subject.trackTitle:
        rows.insert(1, [
            Paragraph("TRACK", style("k", "DV-B", 7, t.muted)),
            Paragraph(f"{p.subject.trackTitle}  ·  ISRC: {p.subject.trackIsrc or '—'}",
                      style("v", "DV", 10, t.ink)),
        ])
    subj = Table(rows, colWidths=[1.1 * inch, W - 1.1 * inch])
    subj.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    out.append(subj)
    out.append(Spacer(1, 14))

    # Risk score banner
    sc = p.score.overall
    sc_col = score_color(t, sc)
    banner_left = Paragraph(
        f'<font color="#{sc_col.hexval()[2:]}" size="42"><b>{sc}</b></font>'
        f'<font color="#{t.muted.hexval()[2:]}" size="12"> /100</font><br/>'
        f'<font color="#{sc_col.hexval()[2:]}" size="10"><b>{p.score.riskLevel} RISK</b></font>',
        style("score", "DV-B", 42, sc_col, lead=46),
    )
    banner_right = Paragraph(
        f"<b>Royalty Risk Score</b><br/><br/>{p.score.riskSummary}",
        style("risk", "DV", 9.5, t.ink, lead=13),
    )
    banner = Table([[banner_left, banner_right]], colWidths=[W * 0.32, W * 0.68])
    banner_styles: list = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBEFORE", (1, 0), (1, 0), 2, sc_col),
        ("LEFTPADDING", (1, 0), (1, 0), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]
    if t.use_score_fills:
        banner_styles.insert(0, ("BACKGROUND", (0, 0), (-1, -1), t.card_bg))
        banner_styles.append(("LINEBELOW", (0, 0), (-1, 0), 0.5, t.line))
    banner.setStyle(TableStyle(banner_styles))
    out.append(banner)
    out.append(Spacer(1, 16))
    return out


def _render_modules(p: AuditResponse, t: Theme, W: float) -> list:
    out: list = [
        Paragraph("// MODULE SCORES", style("h2", "DV-B", 9, t.brand)),
        HRFlowable(width=W, thickness=0.5, color=t.line, spaceBefore=2, spaceAfter=6),
    ]
    rows = [[
        Paragraph("MODULE", style("th", "DV-B", 7, t.muted)),
        Paragraph("SCORE", style("th", "DV-B", 7, t.muted, align=1)),
        Paragraph("GRADE", style("th", "DV-B", 7, t.muted, align=1)),
        Paragraph("ISSUES", style("th", "DV-B", 7, t.muted, align=1)),
        Paragraph("STATUS", style("th", "DV-B", 7, t.muted)),
    ]]
    for key in ["metadata", "coverage", "publishing", "duplicates", "youtube", "sync"]:
        m: Module = getattr(p.modules, key)
        sc_col = score_color(t, m.score)

        if m.availability == "AUTH_UNAVAILABLE":
            score_cell = Paragraph("—", style("sc", "DV-B", 12, t.muted, align=1))
            grade_cell = Paragraph("—", style("gr", "DV-B", 11, t.muted, align=1))
            status_cell = Paragraph(
                f'<font color="#{t.muted.hexval()[2:]}"><b>Unavailable</b></font> — auth or data missing',
                style("su", "DV", 8.5, t.ink, lead=11),
            )
            issues_cell = Paragraph("—", style("is", "DV-B", 10, t.muted, align=1))
        else:
            score_cell = Paragraph(
                f'<font color="#{sc_col.hexval()[2:]}"><b>{m.score}</b></font>',
                style("sc", "DV-B", 12, sc_col, align=1),
            )
            grade_cell = Paragraph(
                f'<font color="#{sc_col.hexval()[2:]}"><b>{m.grade}</b></font>',
                style("gr", "DV-B", 11, sc_col, align=1),
            )
            issue_col = t.critical if m.issueCount >= 5 else (t.warning if m.issueCount > 0 else t.ok)
            issues_cell = Paragraph(
                f"<b>{m.issueCount}</b>",
                style("is", "DV-B", 10, issue_col, align=1),
            )
            first_flag = m.flags[0] if m.flags else "No issues detected."
            status_cell = Paragraph(first_flag, style("su", "DV", 8.5, t.ink, lead=11))

        rows.append([
            Paragraph(f"<b>{m.name}</b>", style("m", "DV-B", 9, t.ink)),
            score_cell, grade_cell, issues_cell, status_cell,
        ])

    tbl = Table(rows, colWidths=[1.45 * inch, 0.55 * inch, 0.55 * inch, 0.70 * inch, W - 3.25 * inch])
    tbl_styles: list = [
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, t.rule),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, t.line),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if t.use_card_backgrounds:
        tbl_styles.insert(0, ("BACKGROUND", (0, 1), (-1, -1), t.card_bg))
    tbl.setStyle(TableStyle(tbl_styles))
    out.append(tbl)
    out.append(Spacer(1, 14))
    return out


def _render_coverage(p: AuditResponse, t: Theme, W: float) -> list:
    out: list = [
        Paragraph("// AUDIT COVERAGE", style("h2", "DV-B", 9, t.brand)),
        HRFlowable(width=W, thickness=0.5, color=t.line, spaceBefore=2, spaceAfter=6),
    ]
    rows = [[
        Paragraph("SOURCE", style("th", "DV-B", 7, t.muted)),
        Paragraph("STATUS", style("th", "DV-B", 7, t.muted, align=1)),
        Paragraph("DETAIL", style("th", "DV-B", 7, t.muted)),
    ]]
    entries = [
        ("Spotify", p.auditCoverage.spotify),
        ("Apple Music", p.auditCoverage.appleMusic),
        ("Publishing (PRO)", p.auditCoverage.publishing),
        ("SoundExchange", p.auditCoverage.soundExchange),
    ]
    for label, entry in entries:
        st_col = coverage_color(t, entry.status)
        tier = entry.tier or "—"
        rows.append([
            Paragraph(label, style("r", "DV-B", 9, t.ink)),
            Paragraph(
                f'<font color="#{st_col.hexval()[2:]}"><b>{entry.status}</b></font>',
                style("st", "DV-B", 8, st_col, align=1),
            ),
            Paragraph(tier, style("so", "DV-M", 8, t.muted)),
        ])
    tbl = Table(rows, colWidths=[2.0 * inch, 1.4 * inch, W - 3.4 * inch])
    tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, t.rule),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, t.line),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    out.append(tbl)
    out.append(Spacer(1, 14))
    return out


def _render_issues(p: AuditResponse, t: Theme, W: float) -> list:
    out: list = [
        Paragraph(f"// CONFIRMED FINDINGS ({len(p.issues)})",
                  style("h2", "DV-B", 9, t.brand)),
        HRFlowable(width=W, thickness=0.5, color=t.line, spaceBefore=2, spaceAfter=8),
    ]
    if not p.issues:
        out.append(Paragraph("No issues detected in this scan.",
                             style("none", "DV-I", 9, t.muted)))
        out.append(Spacer(1, 14))
        return out

    for issue in p.issues:
        sev_col = severity_color(t, issue.severity)
        # If title is a leading prefix of detail, show detail only (avoids visual repetition)
        title_is_prefix = issue.detail.startswith(issue.title) and issue.title != issue.detail
        if title_is_prefix:
            row_text = Paragraph(
                f'<font color="#{sev_col.hexval()[2:]}"><b>{issue.severity}</b></font> · '
                f'<font color="#{t.muted.hexval()[2:]}">{issue.moduleName}</font><br/>'
                f'<font color="#{t.ink.hexval()[2:]}" size="9">{issue.detail}</font>',
                style("iss", "DV", 9, t.ink, lead=12),
            )
        else:
            row_text = Paragraph(
                f'<font color="#{sev_col.hexval()[2:]}"><b>{issue.severity}</b></font> · '
                f'<font color="#{t.muted.hexval()[2:]}">{issue.moduleName}</font><br/>'
                f'<font color="#{t.ink.hexval()[2:]}"><b>{issue.title}</b></font><br/>'
                f'<font color="#{t.ink.hexval()[2:]}" size="8.5">{issue.detail}</font>',
                style("iss", "DV", 9, t.ink, lead=12),
            )
        tbl = Table([[row_text]], colWidths=[W])
        cell_styles: list = [
            ("LINEBEFORE", (0, 0), (0, 0), 2.5, sev_col),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
        if t.use_severity_fills:
            tint = colors.Color(sev_col.red, sev_col.green, sev_col.blue, alpha=0.06)
            cell_styles.insert(0, ("BACKGROUND", (0, 0), (-1, -1), tint))
        tbl.setStyle(TableStyle(cell_styles))
        out.append(KeepTogether(tbl))
        out.append(Spacer(1, 4))

    out.append(Spacer(1, 10))
    return out


def _render_royalty_gap(p: AuditResponse, t: Theme, W: float) -> list:
    g = p.royaltyGap
    out: list = [
        Paragraph("// ROYALTY GAP ESTIMATE", style("h2", "DV-B", 9, t.brand)),
        HRFlowable(width=W, thickness=0.5, color=t.line, spaceBefore=2, spaceAfter=6),
    ]

    def money(n: int) -> str:
        return f"${n:,}"

    def num(n: int) -> str:
        return f"{n:,}"

    rows = [
        [Paragraph("<b>Est. annual streams</b>", style("k", "DV", 9, t.ink)),
         Paragraph(num(g.estAnnualStreams), style("v", "DV-M", 9, t.ink, align=2))],
        [Paragraph("<b>Est. lifetime streams</b>", style("k", "DV", 9, t.ink)),
         Paragraph(num(g.estLifetimeStreams), style("v", "DV-M", 9, t.ink, align=2))],
        [Paragraph("<b>Est. Spotify royalties</b>", style("k", "DV", 9, t.ink)),
         Paragraph(money(g.estSpotifyRoyalties), style("v", "DV-M", 9, t.ok, align=2))],
        [Paragraph("<b>Est. PRO earnings</b>", style("k", "DV", 9, t.ink)),
         Paragraph(money(g.estPROEarnings), style("v", "DV-M", 9, t.ok, align=2))],
        [Paragraph("<b>Potential gap (range)</b>", style("k", "DV-B", 9, t.ink)),
         Paragraph(f"{money(g.potentialGapLow)} – {money(g.potentialGapHigh)}",
                   style("v", "DV-M", 9, t.critical, align=2))],
        [Paragraph("<b>Unmonetised UGC views</b>", style("k", "DV", 9, t.ink)),
         Paragraph(num(g.ugcUnmonetisedViews), style("v", "DV-M", 9, t.warning, align=2))],
    ]
    tbl = Table(rows, colWidths=[W * 0.55, W * 0.45])
    tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, t.line),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    out.append(tbl)
    out.append(Spacer(1, 6))
    out.append(Paragraph(f"<i>{g.disclaimer}</i>",
                         style("disc", "DV-I", 7, t.muted)))
    out.append(Spacer(1, 14))
    return out


def _render_pro_guide(p: AuditResponse, t: Theme, W: float) -> list:
    pg = p.proGuide
    out: list = [
        Paragraph(f"// PRO GUIDE — {pg.pro}", style("h2", "DV-B", 9, t.brand)),
        HRFlowable(width=W, thickness=0.5, color=t.line, spaceBefore=2, spaceAfter=6),
        Paragraph(pg.note, style("note", "DV", 9, t.ink, lead=12)),
        Spacer(1, 6),
    ]
    for i, step in enumerate(pg.steps, 1):
        out.append(Paragraph(
            f'<font color="#{t.brand.hexval()[2:]}"><b>{i:02d}</b></font>  {step}',
            style("step", "DV", 9, t.ink, lead=12),
        ))
        out.append(Spacer(1, 2))
    out.append(Spacer(1, 6))
    out.append(Paragraph(
        f'<font color="#{t.brand.hexval()[2:]}">{pg.url}</font>',
        style("url", "DV-M", 8, t.brand),
    ))
    out.append(Spacer(1, 14))
    return out


def _render_footer(p: AuditResponse, t: Theme, W: float, generated: str) -> list:
    return [
        HRFlowable(width=W, thickness=0.5, color=t.line),
        Spacer(1, 4),
        Paragraph(
            f"Royaltē Audit Report · {p.subject.artistName} · {generated} · "
            f'<font color="#{t.brand.hexval()[2:]}"><b>royalte.ai</b></font> · '
            f"Scan {p.scanId[:8]} · Schema v{p.schemaVersion}",
            style("ft", "DV", 6.5, t.muted, align=1),
        ),
    ]


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def load_and_validate(path: Path) -> AuditResponse:
    """Load canonical JSON from disk and validate. Raises AuditSchemaError on any drift."""
    try:
        raw = json.loads(path.read_text())
    except FileNotFoundError:
        raise AuditSchemaError(f"payload file not found: {path}")
    except json.JSONDecodeError as e:
        raise AuditSchemaError(f"payload is not valid JSON: {e}")

    try:
        return AuditResponse.model_validate(raw)
    except ValidationError as e:
        # Fail LOUD — list every field that's wrong.
        msgs = []
        for err in e.errors():
            loc = ".".join(str(p) for p in err["loc"])
            msgs.append(f"  • {loc}: {err['msg']}  (input: {err.get('input')!r})")
        raise AuditSchemaError(
            "Canonical payload failed schema validation — NO PDF generated.\n"
            + "\n".join(msgs)
        ) from e


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render Royaltē audit PDF from canonical AuditResponse JSON."
    )
    parser.add_argument("--payload", type=Path, required=True,
                        help="Path to canonical AuditResponse JSON (from /api/audit).")
    parser.add_argument("--theme", choices=["brand", "print"], default="brand",
                        help="Visual theme (default: brand).")
    parser.add_argument("--out", type=Path, required=True,
                        help="Output PDF path.")
    args = parser.parse_args()

    try:
        payload = load_and_validate(args.payload)
    except AuditSchemaError as e:
        print(f"\n[ERROR] {e}\n", file=sys.stderr)
        return 2

    theme = get_theme(args.theme)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    render_pdf(payload, theme, args.out)
    print(f"✓ Rendered {args.theme} PDF → {args.out}")
    print(f"  scan_id: {payload.scanId}  ·  schema: v{payload.schemaVersion}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
