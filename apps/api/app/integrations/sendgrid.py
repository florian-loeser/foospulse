"""
SendGrid Integration Module.

Provides email sending integration with SendGrid for password reset
and other transactional emails.

When no API key is configured, all operations are no-ops.
"""
from typing import Optional
import httpx

from app.config import settings
from app.logging import get_logger

logger = get_logger("integrations.sendgrid")


class SendGridIntegration:
    """
    SendGrid integration for sending transactional emails.

    When api_key is not configured, all operations are no-ops.
    """

    SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"

    def __init__(self, api_key: Optional[str] = None, from_email: Optional[str] = None):
        """
        Initialize SendGrid integration.

        Args:
            api_key: SendGrid API key. If None, uses settings.
            from_email: Sender email address. If None, uses settings.
        """
        self.api_key = api_key or getattr(settings, "sendgrid_api_key", None)
        self.from_email = from_email or getattr(settings, "sendgrid_from_email", "noreply@foospulse.app")
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Check if SendGrid integration is configured."""
        return bool(self.api_key)

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """
        Send an email via SendGrid.

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body of the email
            text_content: Plain text body (optional)

        Returns:
            True if sent successfully, False otherwise.
            Returns True (no-op) if not configured.
        """
        if not self.is_configured:
            logger.debug("sendgrid_not_configured", action="send_skipped")
            return True  # No-op success

        try:
            client = await self._get_client()

            content = [{"type": "text/html", "value": html_content}]
            if text_content:
                content.insert(0, {"type": "text/plain", "value": text_content})

            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": self.from_email},
                "subject": subject,
                "content": content,
            }

            logger.info(
                "sendgrid_sending",
                to_email=to_email,
                subject=subject,
            )

            response = await client.post(
                self.SENDGRID_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
            )

            # SendGrid returns 202 for accepted
            if response.status_code in (200, 202):
                logger.info("sendgrid_sent", status="success", to_email=to_email)
                return True
            else:
                logger.warning(
                    "sendgrid_send_failed",
                    status_code=response.status_code,
                    response=response.text[:200],
                )
                return False

        except Exception as e:
            logger.error("sendgrid_send_error", error=str(e))
            return False

    async def send_password_reset_email(self, to_email: str, reset_link: str) -> bool:
        """
        Send a password reset email.

        Args:
            to_email: Recipient email address
            reset_link: Full URL to the password reset page

        Returns:
            True if sent successfully, False otherwise.
        """
        subject = "Reset Your FoosPulse Password"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">FoosPulse</h1>
        </div>
        <div style="padding: 32px;">
            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">Reset Your Password</h2>
            <p style="color: #4b5563; margin: 0 0 24px 0; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Reset Password
                </a>
            </div>
            <p style="color: #6b7280; margin: 24px 0 0 0; font-size: 14px; line-height: 1.6;">
                This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{reset_link}" style="color: #22c55e; word-break: break-all;">{reset_link}</a>
            </p>
        </div>
    </div>
</body>
</html>
"""

        text_content = f"""
Reset Your FoosPulse Password

We received a request to reset your password. Click the link below to create a new password:

{reset_link}

This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
"""

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )


# Global instance for convenience
sendgrid = SendGridIntegration()
