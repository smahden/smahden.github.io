"""Ranking evaluation metrics.

Every function takes ``ranked`` (the ids a recommender returned, best first)
and ``relevant`` (the ids that actually were relevant).
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence


def _check_k(k: int) -> None:
    if k < 1:
        raise ValueError("k must be at least 1")


def precision_at_k(ranked: Sequence[str], relevant: Iterable[str], k: int) -> float:
    """Of the top k recommendations, what fraction were relevant?"""
    _check_k(k)
    relevant = set(relevant)
    top = ranked[:k]
    if not top:
        return 0.0
    return sum(1 for item in top if item in relevant) / len(top)


def recall_at_k(ranked: Sequence[str], relevant: Iterable[str], k: int) -> float:
    """Of everything relevant, what fraction made it into the top k?"""
    _check_k(k)
    relevant = set(relevant)
    if not relevant:
        return 0.0
    return sum(1 for item in ranked[:k] if item in relevant) / len(relevant)


def reciprocal_rank(ranked: Sequence[str], relevant: Iterable[str]) -> float:
    """1 / position of the first relevant hit; 0 if there is none."""
    relevant = set(relevant)
    for position, item in enumerate(ranked, start=1):
        if item in relevant:
            return 1 / position
    return 0.0


def average_precision(ranked: Sequence[str], relevant: Iterable[str]) -> float:
    relevant = set(relevant)
    if not relevant:
        return 0.0
    hits = 0
    total = 0.0
    for position, item in enumerate(ranked, start=1):
        if item in relevant:
            hits += 1
            total += hits / position
    return total / min(len(relevant), len(ranked)) if ranked else 0.0


def ndcg_at_k(ranked: Sequence[str], relevant: Iterable[str], k: int) -> float:
    """Normalized discounted cumulative gain with binary relevance."""
    _check_k(k)
    relevant = set(relevant)
    if not relevant:
        return 0.0
    gain = sum(
        1 / math.log2(position + 1)
        for position, item in enumerate(ranked[:k], start=1)
        if item in relevant
    )
    ideal = sum(
        1 / math.log2(position + 1)
        for position in range(1, min(len(relevant), k) + 1)
    )
    return gain / ideal if ideal else 0.0
