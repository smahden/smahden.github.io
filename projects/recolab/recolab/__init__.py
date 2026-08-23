"""RecoLab — a content-based recommendation engine written from scratch."""

from .catalog import load_catalog
from .recommender import ContentRecommender, Item, Scored
from .similarity import cosine, dot
from .text import TfidfVectorizer, tokenize

__all__ = [
    "ContentRecommender",
    "Item",
    "Scored",
    "TfidfVectorizer",
    "cosine",
    "dot",
    "load_catalog",
    "tokenize",
]
__version__ = "1.0.0"
