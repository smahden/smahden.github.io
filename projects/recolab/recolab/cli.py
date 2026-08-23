"""Command-line interface.

    python -m recolab.cli similar ml-recsys
    python -m recolab.cli profile web-a11y web-css -k 5
    python -m recolab.cli search "keyboard focus management"
"""

from __future__ import annotations

import argparse
import sys

from .catalog import load_catalog
from .recommender import ContentRecommender, Scored


def _print(results: list[Scored]) -> None:
    if not results:
        print("No matches.")
        return
    width = max(len(scored.item.title) for scored in results)
    for scored in results:
        bar = "█" * round(scored.score * 20)
        print(f"  {scored.item.title:<{width}}  {scored.score:.3f}  {bar}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="recolab", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    # Shared so `-k` works after the subcommand, where users expect it.
    count = argparse.ArgumentParser(add_help=False)
    count.add_argument("-k", type=int, default=5, help="number of results (default: 5)")

    similar = sub.add_parser("similar", parents=[count], help="items similar to one item")
    similar.add_argument("item_id")

    profile = sub.add_parser(
        "profile", parents=[count], help="recommendations from a set of liked items"
    )
    profile.add_argument("item_ids", nargs="+")

    search = sub.add_parser("search", parents=[count], help="free-text search over the catalog")
    search.add_argument("query", nargs="+")

    sub.add_parser("list", help="list every item id in the catalog")

    args = parser.parse_args(argv)
    recommender = ContentRecommender().fit(load_catalog())

    if args.command == "list":
        for item in recommender.items:
            print(f"  {item.id:<14} {item.title}  [{item.category}]")
        return 0

    try:
        if args.command == "similar":
            _print(recommender.similar_to(args.item_id, k=args.k))
        elif args.command == "profile":
            _print(recommender.recommend_for_user(args.item_ids, k=args.k))
        else:
            _print(recommender.search(" ".join(args.query), k=args.k))
    except KeyError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
