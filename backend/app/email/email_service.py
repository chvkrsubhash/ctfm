"""
CTF Platform — Email Service (Resend)
Abstraction layer for all transactional emails.
"""
import logging
from pathlib import Path
from string import Template
from typing import Optional

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Resend client
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _load_template(name: str) -> str:
    """Load an HTML email template from the templates directory."""
    path = TEMPLATES_DIR / f"{name}.html"
    if not path.exists():
        raise FileNotFoundError(f"Email template not found: {name}")
    return path.read_text(encoding="utf-8")


def _render(template_name: str, **kwargs: str) -> str:
    """Render an HTML template with the given context variables."""
    html = _load_template(template_name)
    # Use safe_substitute to ignore missing placeholders
    return Template(html).safe_substitute(**kwargs)


async def _send(*, to: str, subject: str, html: str) -> bool:
    """Send an email via Resend. Returns True on success."""
    if not settings.RESEND_API_KEY:
        logger.warning(f"[Email SKIP — no API key] To: {to} | Subject: {subject}")
        return False
    try:
        resend.Emails.send({
            "from": f"{settings.RESEND_FROM_NAME} <{settings.RESEND_FROM_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent: {subject} → {to}")
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


class EmailService:
    """
    High-level email service. All email types are defined as methods here.
    """

    @staticmethod
    async def send_verification_email(*, to: str, username: str, verification_url: str) -> bool:
        html = _render(
            "verify_email",
            username=username,
            verification_url=verification_url,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"Verify your {settings.APP_NAME} account", html=html)

    @staticmethod
    async def send_welcome_email(*, to: str, username: str) -> bool:
        html = _render(
            "welcome",
            username=username,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"Welcome to {settings.APP_NAME}!", html=html)

    @staticmethod
    async def send_password_reset_email(*, to: str, username: str, reset_url: str) -> bool:
        html = _render(
            "password_reset",
            username=username,
            reset_url=reset_url,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"Reset your {settings.APP_NAME} password", html=html)

    @staticmethod
    async def send_event_registration_email(
        *, to: str, username: str, event_name: str, event_url: str
    ) -> bool:
        html = _render(
            "event_registration",
            username=username,
            event_name=event_name,
            event_url=event_url,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"Registered for {event_name}!", html=html)

    @staticmethod
    async def send_team_invitation_email(
        *, to: str, invitee_name: str, inviter_name: str, team_name: str,
        event_name: str, invitation_url: str
    ) -> bool:
        html = _render(
            "team_invitation",
            invitee_name=invitee_name,
            inviter_name=inviter_name,
            team_name=team_name,
            event_name=event_name,
            invitation_url=invitation_url,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"You've been invited to join {team_name}", html=html)

    @staticmethod
    async def send_event_starting_email(
        *, to: str, username: str, event_name: str, event_url: str, start_time: str
    ) -> bool:
        html = _render(
            "event_starting",
            username=username,
            event_name=event_name,
            event_url=event_url,
            start_time=start_time,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"🚀 {event_name} starts soon!", html=html)

    @staticmethod
    async def send_event_ending_email(
        *, to: str, username: str, event_name: str, event_url: str, end_time: str
    ) -> bool:
        html = _render(
            "event_ending",
            username=username,
            event_name=event_name,
            event_url=event_url,
            end_time=end_time,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"⏰ {event_name} is ending soon!", html=html)

    @staticmethod
    async def send_announcement_email(
        *, to: str, username: str, event_name: str, announcement_title: str,
        announcement_content: str, event_url: str
    ) -> bool:
        html = _render(
            "announcement",
            username=username,
            event_name=event_name,
            announcement_title=announcement_title,
            announcement_content=announcement_content,
            event_url=event_url,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"📢 [{event_name}] {announcement_title}", html=html)

    @staticmethod
    async def send_certificate_email(
        *, to: str, username: str, event_name: str, rank: Optional[int],
        score: int, certificate_url: str
    ) -> bool:
        rank_str = f"#{rank}" if rank else "Participant"
        html = _render(
            "certificate",
            username=username,
            event_name=event_name,
            rank=rank_str,
            score=str(score),
            certificate_url=certificate_url,
            app_name=settings.APP_NAME,
            frontend_url=settings.FRONTEND_URL,
        )
        return await _send(to=to, subject=f"🏆 Your {event_name} certificate is ready!", html=html)
