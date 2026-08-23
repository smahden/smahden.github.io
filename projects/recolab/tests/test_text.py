import math

import pytest

from recolab.similarity import cosine, dot
from recolab.text import TfidfVectorizer, mean_vector, tokenize


class TestTokenize:
    def test_lowercases_and_splits(self):
        assert tokenize("Machine Learning Basics") == ["machine", "learning", "basics"]

    def test_drops_stopwords_and_single_letters(self):
        assert tokenize("the art of a model x") == ["art", "model"]

    def test_keeps_language_names_with_punctuation(self):
        assert tokenize("C++ and C# and Node.js") == ["c++", "c#", "node.js"]

    def test_keeps_r_and_c_as_languages(self):
        assert tokenize("R and C") == ["r", "c"]

    def test_strips_trailing_punctuation(self):
        assert tokenize("features, labels.") == ["features", "labels"]

    def test_empty_input(self):
        assert tokenize("") == []


class TestTfidfVectorizer:
    corpus = [
        "cats chase mice",
        "dogs chase cats",
        "mice fear cats",
    ]

    def test_fit_requires_documents(self):
        with pytest.raises(ValueError):
            TfidfVectorizer().fit([])

    def test_transform_before_fit_raises(self):
        with pytest.raises(RuntimeError):
            TfidfVectorizer().transform("anything")

    def test_rare_terms_get_higher_idf_than_common_ones(self):
        vectorizer = TfidfVectorizer().fit(self.corpus)
        # "cats" appears in all three documents, "dogs" in one.
        assert vectorizer.idf_["dogs"] > vectorizer.idf_["cats"]

    def test_vectors_are_l2_normalized(self):
        vectorizer = TfidfVectorizer()
        for vector in vectorizer.fit_transform(self.corpus):
            norm = math.sqrt(sum(w * w for w in vector.values()))
            assert norm == pytest.approx(1.0)

    def test_unknown_terms_are_ignored(self):
        vectorizer = TfidfVectorizer().fit(self.corpus)
        assert vectorizer.transform("quantum entanglement") == {}

    def test_min_df_filters_vocabulary(self):
        vectorizer = TfidfVectorizer(min_df=2).fit(self.corpus)
        assert "dogs" not in vectorizer.idf_
        assert "cats" in vectorizer.idf_

    def test_min_df_must_be_positive(self):
        with pytest.raises(ValueError):
            TfidfVectorizer(min_df=0)

    def test_repeated_terms_scale_sublinearly(self):
        vectorizer = TfidfVectorizer().fit(["alpha beta", "beta gamma"])
        once = vectorizer.transform("alpha beta")
        many = vectorizer.transform("alpha alpha alpha alpha beta")
        # More mentions raise alpha's share, but far less than 4x.
        assert many["alpha"] > once["alpha"]
        assert many["alpha"] < 4 * once["alpha"]


class TestSimilarity:
    def test_identical_vectors_are_one(self):
        vectorizer = TfidfVectorizer().fit(["alpha beta", "beta gamma"])
        vector = vectorizer.transform("alpha beta")
        assert cosine(vector, vector) == pytest.approx(1.0)

    def test_disjoint_vectors_are_zero(self):
        vectorizer = TfidfVectorizer().fit(["alpha", "gamma"])
        assert cosine(vectorizer.transform("alpha"), vectorizer.transform("gamma")) == 0.0

    def test_empty_vector_is_zero(self):
        assert cosine({}, {"a": 1.0}) == 0.0

    def test_cosine_normalizes_unnormalized_input(self):
        assert cosine({"a": 3.0}, {"a": 7.0}) == pytest.approx(1.0)

    def test_dot_is_order_independent(self):
        a, b = {"x": 0.5, "y": 0.5}, {"y": 2.0, "z": 1.0}
        assert dot(a, b) == pytest.approx(dot(b, a))


class TestMeanVector:
    def test_centroid_is_normalized(self):
        result = mean_vector([{"a": 1.0}, {"b": 1.0}])
        norm = math.sqrt(sum(w * w for w in result.values()))
        assert norm == pytest.approx(1.0)
        assert result["a"] == pytest.approx(result["b"])

    def test_empty_input_returns_empty(self):
        assert mean_vector([]) == {}
