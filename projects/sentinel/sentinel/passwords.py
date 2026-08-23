"""Password strength analysis for a sign-up form's strength meter.

Scores how hard a password would be to guess and explains why — the useful
half of a strength meter is the advice, not the coloured bar.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

# A strength meter must never ship the full breach corpus; in production this
# check belongs behind an API like Have I Been Pwned's k-anonymity endpoint,
# which never receives the password itself. This short list covers the
# passwords that dominate every leak.
COMMON_PASSWORDS = frozenset(
    """
    123456 123456789 12345678 password password1 qwerty qwerty123 abc123 111111
    123123 1234567890 letmein welcome monkey dragon sunshine princess football
    iloveyou admin admin123 login master hello freedom whatever trustno1
    baseball starwars superman batman shadow michael jennifer passw0rd p@ssw0rd
    """.split()
)

CHARSET_SIZES = (
    (re.compile(r"[a-z]"), 26),
    (re.compile(r"[A-Z]"), 26),
    (re.compile(r"[0-9]"), 10),
    (re.compile(r"[^a-zA-Z0-9]"), 33),
)

KEYBOARD_RUNS = ("qwerty", "asdf", "zxcv", "1234", "abcd", "qazwsx", "poiuy")

LABELS = ("very weak", "weak", "fair", "strong", "very strong")


@dataclass
class PasswordStrength:
    score: int  # 0-4
    entropy_bits: float
    label: str
    warnings: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)

    @property
    def acceptable(self) -> bool:
        return self.score >= 2


def charset_size(password: str) -> int:
    """Size of the alphabet an attacker would have to brute-force."""
    return sum(size for pattern, size in CHARSET_SIZES if pattern.search(password))


def entropy_bits(password: str) -> float:
    """log2(alphabet ** length) — the brute-force cost, ignoring smarter attacks."""
    pool = charset_size(password)
    if pool == 0 or not password:
        return 0.0
    return len(password) * math.log2(pool)


def _has_repeats(password: str) -> bool:
    return bool(re.search(r"(.)\1{2,}", password))


def _has_sequence(password: str) -> bool:
    lowered = password.lower()
    if any(run in lowered for run in KEYBOARD_RUNS):
        return True
    # Three or more consecutive characters, ascending or descending.
    run = 1
    for previous, current in zip(lowered, lowered[1:]):
        if ord(current) - ord(previous) in (1, -1):
            run += 1
            if run >= 4:
                return True
        else:
            run = 1
    return False


def _base_word(password: str) -> str:
    """Strip the decorations people add to a common word: Password123! -> password."""
    stripped = re.sub(r"[^a-zA-Z]", "", password).lower()
    return stripped


def analyze(password: str) -> PasswordStrength:
    """Score a password from 0 (very weak) to 4 (very strong)."""
    warnings: list[str] = []
    suggestions: list[str] = []

    if not password:
        return PasswordStrength(0, 0.0, LABELS[0], ["Password is empty."], ["Choose a password."])

    bits = entropy_bits(password)
    lowered = password.lower()

    # Entropy sets the starting point; the checks below can only take away.
    if bits >= 90:
        score = 4
    elif bits >= 70:
        score = 3
    elif bits >= 50:
        score = 2
    elif bits >= 32:
        score = 1
    else:
        score = 0

    if lowered in COMMON_PASSWORDS:
        score = 0
        warnings.append("This is one of the most commonly used passwords in public breaches.")
    elif _base_word(password) in COMMON_PASSWORDS:
        score = min(score, 1)
        warnings.append(
            "This is a common password with digits or symbols added — a pattern "
            "cracking tools try first."
        )

    if len(password) < 12:
        score = min(score, 2)
        suggestions.append("Use at least 12 characters; length matters more than symbols.")
    if _has_sequence(password):
        score = min(score, 2)
        warnings.append("Contains a keyboard or alphabet sequence.")
    if _has_repeats(password):
        score = min(score, 2)
        warnings.append("Contains a character repeated three or more times.")
    if charset_size(password) <= 26:
        score = min(score, 2)
        suggestions.append("Mix in uppercase letters, digits, or symbols.")
    if re.fullmatch(r"\d+", password):
        score = 0
        warnings.append("Digits only — trivially brute-forced.")

    if score >= 3 and not warnings:
        suggestions.append("Store it in a password manager and never reuse it.")
    elif not suggestions:
        suggestions.append("Consider a passphrase of four or more unrelated words.")

    return PasswordStrength(
        score=score,
        entropy_bits=round(bits, 1),
        label=LABELS[score],
        warnings=warnings,
        suggestions=suggestions,
    )
