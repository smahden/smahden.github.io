import pytest

from recolab import ContentRecommender, Item, load_catalog


@pytest.fixture
def recommender():
    return ContentRecommender().fit(load_catalog())


class TestFit:
    def test_empty_catalog_raises(self):
        with pytest.raises(ValueError):
            ContentRecommender().fit([])

    def test_duplicate_ids_raise(self):
        items = [Item("dup", "One", "a"), Item("dup", "Two", "b")]
        with pytest.raises(ValueError, match="duplicate"):
            ContentRecommender().fit(items)

    def test_every_item_gets_a_vector(self, recommender):
        assert len(recommender.vectors) == len(recommender.items)
        assert all(vector for vector in recommender.vectors.values())


class TestSimilarTo:
    def test_unknown_id_raises(self, recommender):
        with pytest.raises(KeyError):
            recommender.similar_to("does-not-exist")

    def test_never_recommends_the_item_itself(self, recommender):
        results = recommender.similar_to("ml-recsys", k=10)
        assert all(scored.item.id != "ml-recsys" for scored in results)

    def test_respects_k(self, recommender):
        assert len(recommender.similar_to("ml-recsys", k=3)) == 3

    def test_scores_are_sorted_descending(self, recommender):
        scores = [scored.score for scored in recommender.similar_to("web-a11y", k=8)]
        assert scores == sorted(scores, reverse=True)

    def test_recommendations_stay_in_the_same_topic(self, recommender):
        # The nearest neighbours of a recsys module should be other ML modules.
        top = recommender.similar_to("ml-recsys", k=3)
        assert all(scored.item.category == "machine-learning" for scored in top)

    def test_related_security_modules_surface_together(self, recommender):
        neighbours = {scored.item.id for scored in recommender.similar_to("sec-headers", k=5)}
        assert "sec-owasp" in neighbours

    def test_results_are_deterministic(self, recommender):
        first = [s.item.id for s in recommender.similar_to("eng-ci", k=5)]
        second = [s.item.id for s in recommender.similar_to("eng-ci", k=5)]
        assert first == second

    def test_zero_similarity_items_are_dropped(self):
        items = [
            Item("a", "Alpha", "one", ("alpha",), "alpha"),
            Item("b", "Zulu", "two", ("zulu",), "zulu"),
        ]
        recommender = ContentRecommender().fit(items)
        assert recommender.similar_to("a", k=5) == []


class TestUserProfile:
    def test_no_likes_returns_nothing(self, recommender):
        assert recommender.recommend_for_user([]) == []

    def test_excludes_liked_items_by_default(self, recommender):
        liked = ["web-css", "web-a11y"]
        results = recommender.recommend_for_user(liked, k=6)
        assert all(scored.item.id not in liked for scored in results)

    def test_can_include_liked_items(self, recommender):
        results = recommender.recommend_for_user(["web-css"], k=6, exclude_liked=False)
        assert any(scored.item.id == "web-css" for scored in results)

    def test_profile_reflects_combined_taste(self, recommender):
        results = recommender.recommend_for_user(["sec-crypto", "sec-secrets"], k=4)
        assert any(scored.item.category == "security" for scored in results)

    def test_unknown_liked_id_raises(self, recommender):
        with pytest.raises(KeyError):
            recommender.recommend_for_user(["nope"])


class TestSearch:
    def test_finds_items_by_keyword(self, recommender):
        top = recommender.search("keyboard focus management", k=3)
        assert top[0].item.id == "web-a11y"

    def test_query_with_no_known_terms_returns_nothing(self, recommender):
        assert recommender.search("zzzz qqqq") == []

    def test_search_can_cross_categories(self, recommender):
        results = recommender.search("testing", k=5)
        assert len({scored.item.category for scored in results}) > 1
