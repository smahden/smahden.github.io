"""Tokenization and TF-IDF vectorization, implemented from scratch.

No numpy, no scikit-learn — the point of this module is that the math is
visible. Vectors are sparse dicts of ``{term: weight}``, L2-normalized so
cosine similarity reduces to a dot product.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Iterable, Sequence

Vector = dict[str, float]

TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#.\-]*")

# Single letters are dropped except for these, which are real language names.
ALLOW_SHORT = frozenset({"r", "c"})

STOPWORDS = frozenset(
    """
    a an and are as at be been build building by can do does for from has have how
    in into is it its of on or that the their them then there these this those to
    up use used uses using was were what when which who why will with you your we our
    about after all also any because before between both but each even every far few
    get give go had here if instead just keep keeps less like made make makes many
    more most much must never no not now off once one only other out over own same
    should so some still such take than they thing things through too under until
    versus very via want way whether while without work works would
    """.split()
)


def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-word characters, drop stopwords and stray punctuation.

    Language names that contain punctuation survive intact: ``c++``, ``c#``,
    ``node.js``, ``scikit-learn``.
    """
    tokens = []
    for raw in TOKEN_RE.findall(text.lower()):
        token = raw.strip(".-")
        if not token or token in STOPWORDS:
            continue
        if len(token) < 2 and token not in ALLOW_SHORT:
            continue
        tokens.append(token)
    return tokens


class TfidfVectorizer:
    """Classic smoothed TF-IDF with sublinear term frequency.

    ``idf(t) = ln((1 + N) / (1 + df(t))) + 1`` — the smoothing keeps a term
    that appears in every document from collapsing to exactly zero weight,
    and guarantees idf is always positive.
    """

    def __init__(self, min_df: int = 1) -> None:
        if min_df < 1:
            raise ValueError("min_df must be at least 1")
        self.min_df = min_df
        self.idf_: dict[str, float] = {}
        self.vocabulary_: tuple[str, ...] = ()

    @property
    def fitted(self) -> bool:
        return bool(self.idf_)

    def fit(self, documents: Sequence[str]) -> "TfidfVectorizer":
        if not documents:
            raise ValueError("cannot fit on an empty corpus")

        document_frequency: Counter[str] = Counter()
        for document in documents:
            document_frequency.update(set(tokenize(document)))

        total = len(documents)
        self.idf_ = {
            term: math.log((1 + total) / (1 + df)) + 1
            for term, df in document_frequency.items()
            if df >= self.min_df
        }
        self.vocabulary_ = tuple(sorted(self.idf_))
        return self

    def transform(self, document: str) -> Vector:
        """Vectorize one document. Unknown terms are ignored."""
        if not self.fitted:
            raise RuntimeError("vectorizer must be fitted before transform()")

        counts = Counter(tokenize(document))
        vector: Vector = {}
        for term, count in counts.items():
            idf = self.idf_.get(term)
            if idf is None:
                continue
            # Sublinear tf: a term appearing 10x is not worth 10x one mention.
            vector[term] = (1 + math.log(count)) * idf
        return l2_normalize(vector)

    def fit_transform(self, documents: Sequence[str]) -> list[Vector]:
        self.fit(documents)
        return [self.transform(document) for document in documents]


def l2_normalize(vector: Vector) -> Vector:
    norm = math.sqrt(sum(weight * weight for weight in vector.values()))
    if norm == 0:
        return {}
    return {term: weight / norm for term, weight in vector.items()}


def mean_vector(vectors: Iterable[Vector]) -> Vector:
    """Centroid of several vectors, re-normalized — used to build user profiles."""
    total: Vector = {}
    count = 0
    for vector in vectors:
        count += 1
        for term, weight in vector.items():
            total[term] = total.get(term, 0.0) + weight
    if count == 0:
        return {}
    return l2_normalize({term: weight / count for term, weight in total.items()})
