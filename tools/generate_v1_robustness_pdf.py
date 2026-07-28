from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "xavault_v1_robustness_priorities.pdf"

FOREST = colors.HexColor("#063B2E")
FOREST_DARK = colors.HexColor("#03271E")
GREEN = colors.HexColor("#0F6B4F")
GOLD = colors.HexColor("#D6A84F")
INK = colors.HexColor("#14211C")
MUTED = colors.HexColor("#65716C")
PAPER = colors.HexColor("#F5F8F6")
WHITE = colors.white

PRIORITIES = [
    (
        "CRITICAL",
        colors.HexColor("#B42318"),
        "Must be completed before a public financial launch.",
        [
            ("Production HTTPS configuration", "Replace the hardcoded private HTTP API address with environment-based development, staging, and production HTTPS URLs. Validate required configuration during application startup."),
            ("Financial reconciliation", "Run scheduled checks comparing wallet balances, locked balances, ledger totals, deposits, and withdrawals. Alert and stop unsafe processing when invariants fail."),
            ("Webhook idempotency and recovery", "Persist Paystack event identifiers, reject duplicate processing, retry transient failures safely, and reconcile transfers or deposits stuck in pending/processing states."),
            ("Database recovery", "Use automated encrypted backups and perform a tested restore exercise before launch. Define recovery time and recovery point targets."),
        ],
    ),
    (
        "HIGH",
        colors.HexColor("#D35400"),
        "Security and reliability controls required for a dependable V1.",
        [
            ("Authentication rate limiting", "Rate-limit login, registration verification, password reset, biometric challenges, withdrawal PIN verification, and OTP resend endpoints by account, IP, and device."),
            ("Versioned database migrations", "Replace production reliance on AutoMigrate with reviewed, reversible, versioned migrations and deployment checks."),
            ("End-to-end money-flow tests", "Cover deposit, duplicate webhook, plan allocation, withdrawal, incorrect PIN lockout, provider timeout, transfer reversal, logout, and session refresh."),
            ("Secret and token hardening", "Fail startup when JWT or provider secrets are missing or weak. Add key rotation procedures, session/device management, and logout-all-devices support."),
            ("Operational alerting", "Alert on failed webhooks, amount mismatches, duplicate references, negative balances, long-running transfers, repeated authentication failures, and reconciliation differences."),
        ],
    ),
    (
        "MEDIUM",
        colors.HexColor("#B7791F"),
        "Improves supportability, clarity, and day-to-day resilience.",
        [
            ("Structured observability", "Use structured logs with request IDs, user-safe correlation IDs, latency metrics, and centralized error monitoring. Never log complete payment payloads or secrets."),
            ("Consistent error experience", "Extend the existing ErrorModal pattern to deposits, subscriptions, authentication, and profile changes. Give financial failures a support reference ID."),
            ("Network and offline handling", "Add explicit offline, timeout, retry, and uncertain-payment states. Never represent a timed-out financial request as definitively failed without verification."),
            ("Administrative reconciliation tools", "Provide protected tools to inspect a reference, compare provider and local state, replay safe processing, and record operator actions."),
            ("CORS and platform validation", "Permit the methods actually used by browser clients, including PUT, and test Android, iOS, and Expo Web behavior independently."),
        ],
    ),
    (
        "LOW",
        colors.HexColor("#397367"),
        "Quality improvements that can follow the launch-critical work.",
        [
            ("Performance polish", "Profile large transaction histories, introduce cursor pagination where appropriate, and optimize images, startup requests, and query cache behavior."),
            ("Accessibility review", "Verify screen-reader labels, focus order, dynamic text sizing, contrast, touch targets, and reduced-motion behavior."),
            ("Product analytics", "Measure onboarding completion, failed deposit/withdrawal steps, subscription conversion, and recovery flow completion without collecting sensitive financial data."),
            ("Support content", "Add concise explanations for pending transactions, PIN lockout, reversals, subscription activation, and expected processing times."),
        ],
    ),
]

COMPLETED = [
    "Logout revokes the stored refresh token and expires authentication cookies.",
    "Deposit lookup and verification enforce authenticated ownership.",
    "Subscription activation validates user, plan, reference, amount, currency, and pending status.",
    "Bearer tokens take precedence over stale authentication cookies.",
    "Paystack subscription response parsing no longer uses unsafe type assertions.",
    "Two incorrect withdrawal PIN attempts lock withdrawals until PIN reset.",
    "Withdrawal failures and rejected previews use the app ErrorModal.",
    "The Me/Profile tab links to the combined Transactions screen.",
    "Go tests, TypeScript checking, and mobile lint pass.",
]


styles = getSampleStyleSheet()
title_style = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=WHITE, alignment=TA_CENTER, spaceAfter=8)
subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=11, leading=16, textColor=colors.HexColor("#D8E6E0"), alignment=TA_CENTER)
h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=FOREST_DARK, spaceBefore=6, spaceAfter=10)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=INK, spaceAfter=4)
body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK)
small = ParagraphStyle("Small", parent=body, fontSize=8.5, leading=12, textColor=MUTED)
white_small = ParagraphStyle("WhiteSmall", parent=small, textColor=WHITE)


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(FOREST_DARK)
    canvas.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(WHITE)
    canvas.drawString(18 * mm, height - 7.5 * mm, "XAVAULT V1 READINESS")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#DDE7E2"))
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.restoreState()


def priority_card(level, color, title, description):
    badge = Table([[Paragraph(f"<b>{level}</b>", white_small)]], colWidths=[28 * mm])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    content = Table([[badge, Paragraph(f"<b>{title}</b><br/><font color='#65716C'>{description}</font>", body)]], colWidths=[34 * mm, 132 * mm])
    content.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE6E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([content, Spacer(1, 5 * mm)])


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=19 * mm, bottomMargin=18 * mm, title="XAVAULT V1 Robustness Priorities")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=frame, onPage=header_footer)])

    story = []
    hero = Table([[Paragraph("XAVAULT V1", title_style)], [Paragraph("Robustness, security and launch-readiness priorities", subtitle_style)]], colWidths=[174 * mm])
    hero.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FOREST),
        ("BOX", (0, 0), (-1, -1), 0, FOREST),
        ("TOPPADDING", (0, 0), (-1, 0), 18 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 17 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 12 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12 * mm),
    ]))
    story += [Spacer(1, 8 * mm), hero, Spacer(1, 9 * mm)]
    story.append(Paragraph("Purpose", h1))
    story.append(Paragraph("This document turns the current XAVAULT review into an execution order for V1. Critical and High items are launch gates. Medium items should be scheduled into the first stability cycle. Low items improve polish after the financial and security foundations are proven.", body))
    story.append(Spacer(1, 7 * mm))

    matrix = Table([
        [Paragraph("PRIORITY", small), Paragraph("RELEASE MEANING", small)],
        [Paragraph("<b>Critical</b>", body), Paragraph("Do not launch publicly until resolved and tested.", body)],
        [Paragraph("<b>High</b>", body), Paragraph("Required for a dependable, supportable V1.", body)],
        [Paragraph("<b>Medium</b>", body), Paragraph("Complete before scale or shortly after controlled launch.", body)],
        [Paragraph("<b>Low</b>", body), Paragraph("Post-launch quality and optimization work.", body)],
    ], colWidths=[42 * mm, 124 * mm])
    matrix.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PAPER),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DCE6E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [matrix, Spacer(1, 10 * mm)]

    for level, color, intro, items in PRIORITIES:
        heading = Table([[Paragraph(level, ParagraphStyle(f"{level}Head", parent=h1, textColor=WHITE, fontSize=17)), Paragraph(intro, white_small)]], colWidths=[38 * mm, 128 * mm])
        heading.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), color),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        story += [heading, Spacer(1, 6 * mm)]
        for title, description in items:
            story.append(priority_card(level, color, title, description))
        story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("Completed hardening work", h1))
    completed_rows = []
    for item in COMPLETED:
        completed_rows.append([Paragraph("<font color='#0F6B4F'><b>DONE</b></font>", small), Paragraph(item, body)])
    completed = Table(completed_rows, colWidths=[22 * mm, 144 * mm])
    completed.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DCE6E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [completed, Spacer(1, 8 * mm)]
    story.append(Paragraph("Recommended next sprint", h1))
    story.append(Paragraph("1. Production HTTPS and environment validation.<br/>2. Webhook idempotency plus pending-payment reconciliation.<br/>3. Authentication and OTP rate limiting.<br/>4. Versioned migrations and backup restoration test.<br/>5. End-to-end tests for deposits, withdrawals, lockout, reversal, and logout.", body))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Exit condition: public launch should require all Critical work complete, all High risks either complete or explicitly accepted, a successful restore exercise, and a clean end-to-end financial-flow test run.", ParagraphStyle("Exit", parent=body, backColor=colors.HexColor("#EAF5F0"), borderColor=GREEN, borderWidth=0.8, borderPadding=10, textColor=FOREST_DARK)))

    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build()
