"""
LLM Provider Interface.

This module defines the abstract interface for LLM providers,
allowing the system to optionally use LLM-generated content
while maintaining deterministic behavior by default.

LLM_MODE settings:
- "off": No LLM calls, purely deterministic behavior (default)
- "optional": LLM available but not required, fallback to deterministic
- "required": LLM required for certain features (future)
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List
import hashlib

from app.config import settings


@dataclass
class LLMResponse:
    """Response from an LLM provider."""

    content: str
    model: str
    provider: str
    prompt_hash: str  # SHA256 of the prompt for reproducibility tracking
    tokens_used: int = 0
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "content": self.content,
            "model": self.model,
            "provider": self.provider,
            "prompt_hash": self.prompt_hash,
            "tokens_used": self.tokens_used,
            "metadata": self.metadata,
        }


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.

    Implementations should handle:
    - API authentication
    - Request/response formatting
    - Error handling and retries
    - Rate limiting
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name identifier."""
        pass

    @property
    @abstractmethod
    def model(self) -> str:
        """Model identifier being used."""
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """
        Generate text from the LLM.

        Args:
            prompt: The user prompt
            system_prompt: Optional system/context prompt
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0.0-1.0)

        Returns:
            LLMResponse with generated content
        """
        pass

    @abstractmethod
    async def summarize(
        self,
        text: str,
        max_length: int = 200,
    ) -> LLMResponse:
        """
        Summarize the given text.

        Args:
            text: Text to summarize
            max_length: Target maximum length in characters

        Returns:
            LLMResponse with summary
        """
        pass

    def compute_prompt_hash(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Compute deterministic hash of prompt for tracking."""
        content = f"{system_prompt or ''}|{prompt}"
        return hashlib.sha256(content.encode()).hexdigest()

    async def health_check(self) -> bool:
        """Check if provider is available."""
        return True


def is_llm_enabled() -> bool:
    """Check if LLM features are enabled."""
    return settings.llm_mode.lower() != "off"


def get_llm_provider() -> Optional[LLMProvider]:
    """
    Get the configured LLM provider.

    Returns None if LLM_MODE is "off".
    Returns MockLLMProvider for development/testing.
    In production, would return the actual provider based on config.
    """
    if not is_llm_enabled():
        return None

    # Import here to avoid circular imports
    from app.llm.mock import MockLLMProvider

    # For now, always return mock provider
    # In future, this would check LLM_PROVIDER setting
    return MockLLMProvider()
