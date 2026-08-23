import pytest

from recolab.metrics import (
    average_precision,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)

RANKED = ["a", "b", "c", "d", "e"]
RELEVANT = {"b", "e", "z"}


class TestPrecisionRecall:
    def test_precision_counts_hits_in_top_k(self):
        assert precision_at_k(RANKED, RELEVANT, 2) == pytest.approx(0.5)
        assert precision_at_k(RANKED, RELEVANT, 5) == pytest.approx(0.4)

    def test_recall_is_against_all_relevant_items(self):
        # Two of three relevant items appear in the top five.
        assert recall_at_k(RANKED, RELEVANT, 5) == pytest.approx(2 / 3)

    def test_perfect_ranking(self):
        assert precision_at_k(["b", "e"], {"b", "e"}, 2) == pytest.approx(1.0)
        assert recall_at_k(["b", "e"], {"b", "e"}, 2) == pytest.approx(1.0)

    def test_no_relevant_items(self):
        assert precision_at_k(RANKED, set(), 3) == 0.0
        assert recall_at_k(RANKED, set(), 3) == 0.0

    def test_empty_ranking(self):
        assert precision_at_k([], RELEVANT, 3) == 0.0
        assert recall_at_k([], RELEVANT, 3) == 0.0

    @pytest.mark.parametrize("metric", [precision_at_k, recall_at_k])
    def test_k_must_be_positive(self, metric):
        with pytest.raises(ValueError):
            metric(RANKED, RELEVANT, 0)


class TestReciprocalRank:
    def test_first_hit_position(self):
        assert reciprocal_rank(RANKED, RELEVANT) == pytest.approx(0.5)

    def test_hit_at_top_scores_one(self):
        assert reciprocal_rank(["b", "x"], RELEVANT) == pytest.approx(1.0)

    def test_no_hit_scores_zero(self):
        assert reciprocal_rank(["x", "y"], RELEVANT) == 0.0


class TestAveragePrecision:
    def test_rewards_hits_near_the_top(self):
        top_heavy = average_precision(["b", "e", "x"], RELEVANT)
        bottom_heavy = average_precision(["x", "b", "e"], RELEVANT)
        assert top_heavy > bottom_heavy

    def test_no_relevant_items(self):
        assert average_precision(RANKED, set()) == 0.0


class TestNdcg:
    def test_perfect_ranking_is_one(self):
        assert ndcg_at_k(["b", "e"], {"b", "e"}, 2) == pytest.approx(1.0)

    def test_discounts_lower_positions(self):
        assert ndcg_at_k(["x", "b"], {"b"}, 2) < ndcg_at_k(["b", "x"], {"b"}, 2)

    def test_bounded_between_zero_and_one(self):
        value = ndcg_at_k(RANKED, RELEVANT, 5)
        assert 0.0 <= value <= 1.0

    def test_no_relevant_items(self):
        assert ndcg_at_k(RANKED, set(), 3) == 0.0
