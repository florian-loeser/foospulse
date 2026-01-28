"""Password validation and policy enforcement."""
import re
from typing import Optional, List


class PasswordPolicy:
    """
    Password policy validator.

    Policy requirements:
    - Minimum 8 characters
    - Maximum 128 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - No more than 3 consecutive identical characters
    """

    MIN_LENGTH = 8
    MAX_LENGTH = 128

    @classmethod
    def validate(cls, password: str) -> tuple[bool, Optional[str]]:
        """
        Validate password against policy.

        Args:
            password: Password to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        errors = cls.get_validation_errors(password)
        if errors:
            return False, errors[0]
        return True, None

    @classmethod
    def get_validation_errors(cls, password: str) -> List[str]:
        """
        Get all validation errors for a password.

        Args:
            password: Password to validate

        Returns:
            List of error messages (empty if valid)
        """
        errors = []

        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters")

        if len(password) > cls.MAX_LENGTH:
            errors.append(f"Password must be at most {cls.MAX_LENGTH} characters")

        if not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter")

        if not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter")

        if not re.search(r"\d", password):
            errors.append("Password must contain at least one digit")

        # Check for more than 3 consecutive identical characters
        if re.search(r"(.)\1{3,}", password):
            errors.append("Password cannot contain more than 3 consecutive identical characters")

        return errors

    @classmethod
    def get_policy_description(cls) -> dict:
        """
        Get human-readable policy description.

        Returns:
            Dict with policy requirements
        """
        return {
            "min_length": cls.MIN_LENGTH,
            "max_length": cls.MAX_LENGTH,
            "requirements": [
                f"Minimum {cls.MIN_LENGTH} characters",
                f"Maximum {cls.MAX_LENGTH} characters",
                "At least one uppercase letter (A-Z)",
                "At least one lowercase letter (a-z)",
                "At least one digit (0-9)",
                "No more than 3 consecutive identical characters"
            ]
        }
