"""Vector similarity for sparse dict vectors."""

from __future__ import annotations

import math

from .text import Vector


def dot(a: Vector, b: Vector) -> float:
    """Sparse dot product — iterate the smaller vector, look up in the larger."""
    if len(a) > len(b):
        a, b = b, a
    return sum(weight * b.get(term, 0.0) for term, weight in a.items())


def cosine(a: Vector, b: Vector) -> float:
    """Cosine similarity in [0, 1] for non-negative TF-IDF vectors.

    Vectors from :class:`~recolab.text.TfidfVectorizer` are already
    L2-normalized, so this is a dot product — but the norms are recomputed
    here so the function is correct for any input.
    """
    if not a or not b:
        return 0.0
    norm_a = math.sqrt(sum(w * w for w in a.values()))
    norm_b = math.sqrt(sum(w * w for w in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot(a, b) / (norm_a * norm_b)
