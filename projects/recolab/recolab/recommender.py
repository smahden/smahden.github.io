"""Content-based recommender built on TF-IDF vectors."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Sequence

from .similarity import cosine
from .text import TfidfVectorizer, Vector, mean_vector

# Field weights: a term in the title says more about an item than the same
# term buried in the description, so the title text is simply repeated.
TITLE_WEIGHT = 3
TAG_WEIGHT = 2
CATEGORY_WEIGHT = 2


@dataclass(frozen=True)
class Item:
    id: str
    title: str
    category: str
    tags: tuple[str, ...] = ()
    description: str = ""

    def document(self) -> str:
        """Flatten the item into one weighted text document."""
        parts = [self.title] * TITLE_WEIGHT
        parts += [self.category.replace("-", " ")] * CATEGORY_WEIGHT
        parts += [" ".join(self.tags)] * TAG_WEIGHT
        parts.append(self.description)
        return " ".join(parts)


@dataclass(frozen=True)
class Scored:
    item: Item
    score: float


class ContentRecommender:
    """Recommends items by cosine similarity of their TF-IDF vectors.

    Ties are broken by item id so results are deterministic — important for
    tests and for a demo that must not reshuffle between page loads.
    """

    def __init__(self, min_df: int = 1) -> None:
        self.vectorizer = TfidfVectorizer(min_df=min_df)
        self.items: tuple[Item, ...] = ()
        self.vectors: dict[str, Vector] = {}

    def fit(self, items: Sequence[Item]) -> "ContentRecommender":
        if not items:
            raise ValueError("cannot fit on an empty catalog")
        ids = [item.id for item in items]
        if len(set(ids)) != len(ids):
            raise ValueError("catalog contains duplicate item ids")

        self.items = tuple(items)
        vectors = self.vectorizer.fit_transform([item.document() for item in items])
        self.vectors = {item.id: vector for item, vector in zip(items, vectors)}
        return self

    def _require(self, item_id: str) -> Vector:
        try:
            return self.vectors[item_id]
        except KeyError:
            raise KeyError(f"unknown item id: {item_id!r}") from None

    def _rank(self, query: Vector, exclude: Iterable[str], k: int) -> list[Scored]:
        excluded = set(exclude)
        scored = [
            Scored(item, cosine(query, self.vectors[item.id]))
            for item in self.items
            if item.id not in excluded
        ]
        scored.sort(key=lambda s: (-s.score, s.item.id))
        return [s for s in scored[:k] if s.score > 0]

    def similar_to(self, item_id: str, k: int = 5) -> list[Scored]:
        """Items most similar to one item, excluding the item itself."""
        return self._rank(self._require(item_id), exclude={item_id}, k=k)

    def recommend_for_user(
        self, liked_ids: Sequence[str], k: int = 5, exclude_liked: bool = True
    ) -> list[Scored]:
        """Recommend from a taste profile: the centroid of everything liked."""
        if not liked_ids:
            return []
        profile = mean_vector(self._require(item_id) for item_id in liked_ids)
        exclude = set(liked_ids) if exclude_liked else set()
        return self._rank(profile, exclude=exclude, k=k)

    def search(self, query: str, k: int = 5) -> list[Scored]:
        """Free-text search scored with the same vector space as the catalog."""
        return self._rank(self.vectorizer.transform(query), exclude=(), k=k)
