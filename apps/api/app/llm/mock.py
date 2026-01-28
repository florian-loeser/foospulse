"""
Mock LLM Provider for development and testing.

This provider returns deterministic, template-based responses
without making any external API calls.
"""
from typing import Optional

from app.llm.provider import LLMProvider, LLMResponse


class MockLLMProvider(LLMProvider):
    """
    Mock LLM provider that returns deterministic responses.

    Useful for:
    - Development without API keys
    - Testing LLM integration
    - Fallback when real provider is unavailable
    """

    @property
    def name(self) -> str:
        return "mock"

    @property
    def model(self) -> str:
        return "mock-v1"

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """Generate a mock response."""
        prompt_hash = self.compute_prompt_hash(prompt, system_prompt)

        # Generate deterministic mock response based on prompt content
        if "summary" in prompt.lower() or "summarize" in prompt.lower():
            content = self._generate_summary_response(prompt)
        elif "highlight" in prompt.lower() or "notable" in prompt.lower():
            content = self._generate_highlights_response(prompt)
        elif "narrative" in prompt.lower() or "story" in prompt.lower():
            content = self._generate_narrative_response(prompt)
        else:
            content = f"[Mock LLM Response]\n\nThis is a deterministic placeholder response for the given prompt.\n\nPrompt hash: {prompt_hash[:16]}"

        return LLMResponse(
            content=content,
            model=self.model,
            provider=self.name,
            prompt_hash=prompt_hash,
            tokens_used=len(content.split()),  # Approximate
            metadata={"mock": True, "temperature": temperature},
        )

    async def summarize(
        self,
        text: str,
        max_length: int = 200,
    ) -> LLMResponse:
        """Generate a mock summary."""
        prompt = f"Summarize the following text in {max_length} characters or less:\n\n{text}"
        prompt_hash = self.compute_prompt_hash(prompt)

        # Create deterministic summary
        words = text.split()[:50]  # Take first 50 words
        summary = " ".join(words)
        if len(summary) > max_length:
            summary = summary[: max_length - 3] + "..."

        return LLMResponse(
            content=summary,
            model=self.model,
            provider=self.name,
            prompt_hash=prompt_hash,
            tokens_used=len(summary.split()),
            metadata={"mock": True, "max_length": max_length},
        )

    def _generate_summary_response(self, prompt: str) -> str:
        """Generate mock summary-style response."""
        return (
            "[Mock Summary]\n\n"
            "This week saw exciting matches with close competitions. "
            "The top performers maintained their positions while "
            "newcomers showed promising improvement. "
            "Overall activity remained strong with consistent participation."
        )

    def _generate_highlights_response(self, prompt: str) -> str:
        """Generate mock highlights-style response."""
        return (
            "[Mock Highlights]\n\n"
            "- Top performer maintained winning streak\n"
            "- New rivalry emerged between rising players\n"
            "- Record-breaking match went to overtime\n"
            "- Team synergy improved across the board"
        )

    def _generate_narrative_response(self, prompt: str) -> str:
        """Generate mock narrative-style response."""
        return (
            "[Mock Narrative]\n\n"
            "The league continues to evolve with each passing week. "
            "Players are honing their skills and forming strategic partnerships. "
            "Competition remains fierce at the top of the leaderboard, "
            "while the middle tier sees constant movement as players "
            "battle for position. The spirit of friendly competition "
            "keeps everyone engaged and coming back for more."
        )

    async def health_check(self) -> bool:
        """Mock provider is always available."""
        return True
