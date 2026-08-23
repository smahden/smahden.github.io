"""Export the fitted catalog to JSON for the browser demo.

The demo recomputes cosine similarity in JavaScript, so what ships is the
vector space itself — not a precomputed answer key.

Usage:  python -m recolab.export [output_path]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .catalog import load_catalog
from .recommender import ContentRecommender

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "web" / "data.json"

# Vectors are dense enough to be readable but small enough to ship; keeping the
# top terms per item cuts the payload roughly in half with no visible effect on
# ranking, since the tail carries almost no weight.
TOP_TERMS_PER_ITEM = 40


def build_payload() -> dict:
    items = load_catalog()
    recommender = ContentRecommender().fit(items)

    exported = []
    for item in items:
        vector = recommender.vectors[item.id]
        top_terms = sorted(vector.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_TERMS_PER_ITEM]
        exported.append(
            {
                "id": item.id,
                "title": item.title,
                "category": item.category,
                "tags": list(item.tags),
                "description": item.description,
                "vector": {term: round(weight, 5) for term, weight in top_terms},
            }
        )

    return {
        "generated_by": "recolab.export",
        "vocabulary_size": len(recommender.vectorizer.vocabulary_),
        "items": exported,
    }


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    output = Path(argv[0]) if argv else DEFAULT_OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = build_payload()
    output.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    print(f"Wrote {len(payload['items'])} items to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
