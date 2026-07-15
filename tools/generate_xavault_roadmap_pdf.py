from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "xacvault_v1_hardening_v2_roadmap.pdf"


class SectionBand(Flowable):
    def __init__(self, title: str, subtitle: str = ""):
        super().__init__()
        self.title = title
        self.subtitle = subtitle
        self.height = 35 * mm

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        return avail_width, self.height

    def draw(self):
        c = self.canv
        w = self.width
        h = self.height
        c.saveState()
        c.setFillColor(colors.HexColor("#063B2E"))
        c.roundRect(0, 0, w, h, 10, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#D6A84F"))
        c.circle(w - 18 * mm, h - 11 * mm, 18 * mm, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(12 * mm, h - 14 * mm, self.title)
        if self.subtitle:
            c.setFillColor(colors.HexColor("#DDE6E1"))
            c.setFont("Helvetica", 9)
            c.drawString(12 * mm, h - 23 * mm, self.subtitle)
        c.restoreState()


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#DDE6E1"))
    canvas.line(doc.leftMargin, 13 * mm, A4[0] - doc.rightMargin, 13 * mm)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(doc.leftMargin, 8 * mm, "XAVAULT Product Roadmap")
    canvas.drawRightString(A4[0] - doc.rightMargin, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=33,
        textColor=colors.HexColor("#063B2E"),
        alignment=TA_CENTER,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSub",
        fontName="Helvetica",
        fontSize=12,
        leading=18,
        textColor=colors.HexColor("#404945"),
        alignment=TA_CENTER,
        spaceAfter=18,
    )
)
styles.add(
    ParagraphStyle(
        name="H1",
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=22,
        textColor=colors.HexColor("#063B2E"),
        spaceBefore=8,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="H2",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0F6B4F"),
        spaceBefore=7,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyX",
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#404945"),
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#6B7280"),
    )
)
styles.add(
    ParagraphStyle(
        name="Callout",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#063B2E"),
        backColor=colors.HexColor("#EAF7F1"),
        borderPadding=8,
        borderColor=colors.HexColor("#CDEDE0"),
        borderWidth=1,
        spaceBefore=6,
        spaceAfter=8,
    )
)


def p(text: str, style: str = "BodyX"):
    return Paragraph(text, styles[style])


def bullets(items: list[str]):
    return ListFlowable(
        [
            ListItem(p(item), leftIndent=10, bulletColor=colors.HexColor("#0F6B4F"))
            for item in items
        ],
        bulletType="bullet",
        leftIndent=14,
        bulletFontName="Helvetica",
        bulletFontSize=6,
        spaceAfter=5,
    )


def table(data, widths=None):
    body = [[p(str(cell), "Small") for cell in row] for row in data]
    t = Table(body, colWidths=widths, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#063B2E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDE6E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAF9")]),
            ]
        )
    )
    return t


def section(title: str, subtitle: str, content: list):
    return [SectionBand(title, subtitle), Spacer(1, 6), *content]


story = []

story += [
    Spacer(1, 28 * mm),
    p("XAVAULT", "CoverTitle"),
    p("V1 Product Hardening Plan and V2 Roadmap", "CoverTitle"),
    p(
        "A practical execution document for tightening deposits, withdrawals, subscriptions, notifications, security, analytics, habit loops, and user experience before scaling.",
        "CoverSub",
    ),
    Spacer(1, 8),
    p(
        "Core V1 principle: every money movement must be clear, recoverable, secure, and easy to understand.",
        "Callout",
    ),
    Spacer(1, 18),
    table(
        [
            ["Document Area", "Purpose"],
            ["V1 Hardening", "Make current flows safe, reliable, observable, and polished."],
            ["V1 Engagement", "Help users build habits without making finance feel childish."],
            ["V2 Roadmap", "Defer bigger bets until real usage data shows where demand exists."],
        ],
        [45 * mm, 110 * mm],
    ),
    PageBreak(),
]

story += section(
    "Executive Summary",
    "What V1 must prove before growth",
    [
        p("V1 should focus on trust and clarity, not feature sprawl. Users must always understand where money is, what state a payment is in, and what action they should take next."),
        bullets(
            [
                "Deposits must survive Paystack redirects, app backgrounding, and app restarts.",
                "Withdrawals must have review, confirmation, status, and safe cancellation behavior.",
                "Subscription prompts must be useful and respectful, never noisy.",
                "Push tokens, notification preferences, and in-app notifications must be production-ready.",
                "Analytics must capture drop-offs before V2 decisions are made.",
                "Gamification should reinforce useful money habits, not pressure users.",
            ]
        ),
        p("V2 should begin only after enough active users reveal which flows produce retention, confusion, or revenue."),
    ],
)

story += section(
    "V1 Priority Stack",
    "Recommended execution order",
    [
        table(
            [
                ["Priority", "Workstream", "Why it comes first"],
                ["1", "Compile, route, and auth stability", "Broken navigation and auth recovery block everything else."],
                ["2", "Deposit verification and receipts", "Deposits are the first trust moment in the product."],
                ["3", "Withdrawal safety and status", "Withdrawals carry the highest user anxiety and support risk."],
                ["4", "Push token and notification center", "Users need reliable status updates after money events."],
                ["5", "Plan and envelope clarity", "Users need to understand locked, flexible, allocated, and unboxed money."],
                ["6", "Analytics and event tracking", "V2 should be based on observed behavior, not guesses."],
                ["7", "Light gamification", "Habit loops matter after the core money flows are trustworthy."],
                ["8", "UI polish and motion", "Motion should make state changes clearer, not decorate confusion."],
            ],
            [20 * mm, 48 * mm, 88 * mm],
        )
    ],
)

story += section(
    "Deposit Flow Hardening",
    "Make every deposit recoverable and explainable",
    [
        p("Deposits should be treated as a multi-state transaction, not a single button press. The app must persist pending deposits before leaving for Paystack and verify them when the user returns."),
        bullets(
            [
                "Persist pending deposit reference, amount, and initiated time before opening Paystack.",
                "Verify pending deposit on app foreground and cold start.",
                "Show Processing, Confirmed, Still Processing, Failed, and Abandoned states.",
                "Refresh wallet, ledger, and deposit history after successful verification.",
                "Add Retry Verification button for deposits that stay pending.",
                "Keep deposit modal open when initiation fails.",
                "Show deposit reference and transaction receipt after success.",
                "Add minimum and maximum amount validation.",
                "Restore dedicated bank transfer account UI with copy account number action.",
                "Add I Have Made Transfer action to refresh wallet and ledger.",
                "Prevent duplicate submits with an idempotency key.",
                "Track deposit_started, checkout_opened, verified, failed, abandoned.",
            ]
        ),
        table(
            [
                ["State", "User Message", "Primary Action"],
                ["initiated", "Deposit started. Complete payment in checkout.", "Open checkout"],
                ["verifying", "Checking your payment status.", "Wait"],
                ["confirmed", "Deposit confirmed. Wallet refreshed.", "View receipt"],
                ["still_processing", "Payment is still processing.", "Retry verification"],
                ["failed", "Deposit could not be confirmed.", "Try again"],
                ["abandoned", "Checkout was not completed.", "Start a new deposit"],
            ],
            [35 * mm, 80 * mm, 40 * mm],
        ),
    ],
)

story += section(
    "Withdrawal Flow Hardening",
    "Reduce mistakes and support burden",
    [
        p("Withdrawal is the highest-risk flow. The user should always know source, destination, amount, fees if any, reference, and finality before the request is submitted."),
        bullets(
            [
                "Add a final review screen before submitting a withdrawal.",
                "Show source clearly: plan unboxed, envelope unboxed, matured locked balance, or flexible balance.",
                "Explain why locked funds are unavailable.",
                "Require confirmation before discarding a started withdrawal.",
                "Prevent closing while withdrawal is processing.",
                "Show withdrawal reference and receipt after success.",
                "Track requested, processing, paid, failed, reversed states.",
                "Refresh wallet, plans, envelopes, and ledger after request.",
                "Disable CTA until account resolution, amount, and PIN are valid.",
                "Add daily/monthly limits if backend supports them.",
                "Use idempotency key for retry safety.",
                "Add support copy: withdrawals are irreversible once submitted.",
            ]
        ),
        table(
            [
                ["Review Field", "Required Content"],
                ["From", "Plan or envelope name plus source type"],
                ["To", "Bank name, masked account number, resolved account name"],
                ["Amount", "Exact amount in NGN"],
                ["Timing", "Expected processing message"],
                ["Reference", "Available after request is accepted"],
                ["Risk Copy", "Withdrawal cannot be reversed once submitted"],
            ],
            [40 * mm, 115 * mm],
        ),
    ],
)

story += section(
    "Security and Payment PIN",
    "Make sensitive actions feel protected",
    [
        bullets(
            [
                "Prompt users to create payment PIN at first withdrawal attempt.",
                "Block weak PINs such as 0000, 1111, 1234, and birth-year patterns where possible.",
                "Add cooldown after repeated wrong PIN attempts.",
                "Allow biometric confirmation as an optional layer before withdrawal.",
                "Keep PIN reset as a clear OTP plus new PIN flow.",
                "Use haptic feedback for PIN entry, success, and error states.",
                "Separate login security and payment authorization in UI copy.",
            ]
        )
    ],
)

story += section(
    "Subscription and Upgrade Flow",
    "Respectful monetization",
    [
        bullets(
            [
                "Never show upgrade prompts to active paid users.",
                "Use reminder suppression and randomized backoff after skip.",
                "Do not show upgrade prompts during deposit, withdrawal, or form submission.",
                "Manual upgrade buttons should bypass suppression.",
                "Show the blocked feature or reached limit inside the prompt.",
                "Persist pending subscription verification before Paystack checkout.",
                "Clear reminder state after successful subscription verification.",
                "Show active plan, next renewal or expiry, and plan benefits in profile.",
            ]
        )
    ],
)

story.append(PageBreak())

story += section(
    "Push Notifications",
    "Device token, preferences, deep links, and notification center",
    [
        p("Notifications should be requested after a value moment, not immediately on install. The app should ask when the user understands why notifications matter."),
        bullets(
            [
                "Ask permission after first plan, first deposit, first envelope, or first withdrawal setup.",
                "Register push token with backend including platform, app version, device ID, and permission status.",
                "Update token on app start if it changes.",
                "Delete or invalidate token on logout.",
                "Handle notification tap deep links for deposit, withdrawal, plan maturity, subscription, and reminders.",
                "Add notification preferences for deposits, withdrawals, plans, subscription, reminders, and product updates.",
                "Add in-app notification center because the bell already exists.",
                "Show unread count and mark-as-read behavior.",
                "Use in-app banners for important status events when app is foregrounded.",
            ]
        ),
        table(
            [
                ["Notification", "Deep Link", "Priority"],
                ["Deposit confirmed", "Wallet transaction detail", "High"],
                ["Withdrawal status changed", "Withdrawal receipt or transaction detail", "High"],
                ["Plan maturity reached", "Plan detail", "Medium"],
                ["Envelope reminder", "Envelope detail", "Medium"],
                ["Subscription verified", "Subscription/profile", "Medium"],
                ["Weekly recap", "Home recap card", "Low"],
            ],
            [42 * mm, 80 * mm, 32 * mm],
        ),
    ],
)

story += section(
    "Home Screen UX",
    "Make the next action obvious",
    [
        bullets(
            [
                "Add a Next Action card at the top of home.",
                "Show wallet as Available, Locked, and Total/Ledger balance.",
                "Make recent movements tappable with transaction detail screens.",
                "Add pull-to-refresh.",
                "Show pending deposit or subscription verification card when relevant.",
                "Replace plain empty states with action-oriented cards.",
                "Use skeleton loading for wallet, plans, and ledger.",
                "Make notification bell open the in-app notification center.",
            ]
        ),
        table(
            [
                ["Next Action Condition", "Suggested CTA"],
                ["No payment PIN", "Set payment PIN"],
                ["No plan", "Create first plan"],
                ["Draft plan exists", "Finish and confirm plan"],
                ["No envelopes in draft", "Add first envelope"],
                ["Pending deposit", "Check deposit status"],
                ["Available unboxed balance", "Allocate to envelope"],
            ],
            [55 * mm, 100 * mm],
        ),
    ],
)

story += section(
    "Plans and Envelopes UX",
    "Make locked money understandable",
    [
        bullets(
            [
                "Add plan creation review before submit.",
                "Show a draft guide: create plan, add envelopes, confirm plan.",
                "Explain target amount, allocated amount, unboxed balance, locked balance, and flexible balance.",
                "Add plan timeline and maturity countdown.",
                "Animate progress bars when funding changes.",
                "Add Fund This Plan CTA where relevant.",
                "Add Move Unboxed Money To Envelope CTA.",
                "Add Why Can I Not Confirm checklist.",
                "Add edit and cancel actions with confirmation.",
                "Show available-to-withdraw summary on plan and envelope screens.",
            ]
        )
    ],
)

story += section(
    "Error Handling and Recovery",
    "No dead ends",
    [
        bullets(
            [
                "Create one central getApiErrorMessage helper.",
                "Use toast for lightweight errors and modals for destructive or payment errors.",
                "Handle offline network errors differently from backend validation errors.",
                "Show Still Processing for ambiguous payment states instead of hard failure.",
                "Keep forms open after failed submissions.",
                "Clear pending records only after success, expiry, or explicit user dismissal.",
                "Attach backend trace ID or reference to support-facing receipts if available.",
            ]
        )
    ],
)

story.append(PageBreak())

story += section(
    "Analytics and Observability",
    "Measure before V2",
    [
        p("V2 should be based on measured behavior. Add event tracking before heavy growth so product decisions are grounded in real funnels."),
        table(
            [
                ["Funnel", "Events to Track"],
                ["Authentication", "signup_started, email_verified, signup_completed, login_success, logout"],
                ["Deposit", "deposit_opened, amount_entered, checkout_opened, verified, failed, abandoned"],
                ["Withdrawal", "withdrawal_opened, source_selected, destination_selected, pin_entered, completed, failed, abandoned"],
                ["Plans", "plan_created, envelope_created, plan_previewed, plan_confirmed, plan_cancelled"],
                ["Subscription", "prompt_shown, prompt_skipped, payment_started, verified, expired"],
                ["Notifications", "permission_requested, granted, denied, token_registered, notification_opened"],
            ],
            [40 * mm, 115 * mm],
        ),
        bullets(
            [
                "Track app version and platform on all events.",
                "Track route/screen name for key events.",
                "Avoid storing sensitive financial values in analytics unless explicitly needed and protected.",
                "Review weekly funnel drop-offs before prioritizing V2.",
            ]
        ),
    ],
)

story += section(
    "V1 Gamification",
    "Useful habit loops without making finance feel childish",
    [
        bullets(
            [
                "Vault Health score based on active plans, emergency readiness, completed plans, and withdrawal discipline.",
                "Plan milestones at 25, 50, 75, and 100 percent funded.",
                "Small celebration animation and haptics on milestone completion.",
                "Badges for First Plan, First Envelope, First Deposit, Fully Funded, Plan Completed, Salary Splitter.",
                "Weekly recap: You protected NGN X this week.",
                "Gentle streaks for weekly saving, not daily pressure.",
                "No shame states when a streak breaks.",
                "Challenges should be opt-in or context-aware.",
            ]
        ),
        p("Design rule: gamification should make progress visible, not make the user feel punished.", "Callout"),
    ],
)

story += section(
    "UI and Motion Guidelines",
    "Modern but calm",
    [
        bullets(
            [
                "Standardize buttons, modals, bottom sheets, cards, empty states, and loading states.",
                "Use icon buttons for common actions and clear text buttons for major commands.",
                "Add bottom sheet entrance animations.",
                "Animate progress bars and success states.",
                "Use haptics for success, error, PIN input, and milestone moments.",
                "Fix broken glyphs and encoding issues in copy.",
                "Add accessibility labels for icon-only controls.",
                "Avoid interrupting sensitive money flows with marketing prompts.",
            ]
        )
    ],
)

story += section(
    "V1 Definition of Done",
    "Release checklist before pushing growth",
    [
        table(
            [
                ["Area", "Done When"],
                ["Deposit", "Pending deposit survives return, restart, retry, and refresh."],
                ["Withdrawal", "Review, discard guard, receipt, and status refresh are complete."],
                ["Subscription", "Global verification and respectful reminder logic are complete."],
                ["Notifications", "Push token, preferences, deep links, and notification center exist."],
                ["Plans", "Users understand draft, confirmation, allocation, and locked states."],
                ["Analytics", "Core funnels are tracked and reviewed weekly."],
                ["UI", "No broken glyphs, no dead empty states, no unclear loading states."],
                ["Quality", "Typecheck and lint pass before every release."],
            ],
            [38 * mm, 117 * mm],
        )
    ],
)

story.append(PageBreak())

story += section(
    "V2 Roadmap",
    "Build after real user data",
    [
        p("V2 should start only after V1 has enough users and funnel data. The purpose of V2 is to expand what works, not guess at what might work."),
        table(
            [
                ["Theme", "Possible V2 Features"],
                ["Automation", "Recurring deposits, salary split automation, auto-envelope funding, rules engine."],
                ["Intelligence", "Smart saving recommendations, budget coach, personalized next actions, risk alerts."],
                ["Social", "Shared envelopes, family vaults, group savings, accountability circles."],
                ["Growth", "Referral program, rewards, premium trials, lifecycle campaigns."],
                ["Financial Depth", "Advanced analytics, credit readiness, bill reminders, multi-currency support."],
                ["Platforms", "Web dashboard, admin/support console, exports, richer receipts."],
            ],
            [38 * mm, 117 * mm],
        ),
        bullets(
            [
                "Promote features from V2 only when analytics show demand or friction.",
                "Prioritize the V2 feature that improves retention or revenue with the least operational risk.",
                "Avoid social or credit features until trust, support, and compliance are mature.",
            ]
        ),
    ],
)

story += section(
    "Post-V1 Decision Gates",
    "When to move into V2",
    [
        table(
            [
                ["Question", "Signal Needed"],
                ["Are users depositing successfully?", "High deposit completion and low support tickets."],
                ["Are users creating plans?", "Strong first-plan and first-envelope conversion."],
                ["Do users return?", "Healthy week-1 and month-1 retention."],
                ["Does subscription convert?", "Prompt-to-payment and payment-to-active rates are healthy."],
                ["Where do users struggle?", "Clear funnel drop-off data and support themes."],
                ["What do users ask for?", "Repeated requests from active users, not one-off ideas."],
            ],
            [55 * mm, 100 * mm],
        )
    ],
)


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="XAVAULT V1 Hardening and V2 Roadmap",
        author="XAVAULT",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build()
