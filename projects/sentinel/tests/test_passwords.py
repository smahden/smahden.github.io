import pytest

from sentinel.passwords import analyze, charset_size, entropy_bits


class TestCharsetAndEntropy:
    @pytest.mark.parametrize(
        "password,expected",
        [("abcdef", 26), ("ABCDEF", 26), ("abcDEF", 52), ("abc123", 36), ("abc!@#", 59)],
    )
    def test_charset_size(self, password, expected):
        assert charset_size(password) == expected

    def test_entropy_grows_with_length(self):
        assert entropy_bits("abcdefgh") > entropy_bits("abcd")

    def test_entropy_grows_with_variety(self):
        assert entropy_bits("abcdefgh") < entropy_bits("aBc1!fgh")

    def test_empty_password_has_no_entropy(self):
        assert entropy_bits("") == 0.0


class TestWeakPasswords:
    def test_empty_password(self):
        result = analyze("")
        assert result.score == 0
        assert not result.acceptable

    @pytest.mark.parametrize("password", ["password", "qwerty", "123456", "letmein", "iloveyou"])
    def test_breach_list_scores_zero(self, password):
        result = analyze(password)
        assert result.score == 0
        assert any("breach" in warning for warning in result.warnings)

    def test_common_word_with_decorations_is_still_weak(self):
        result = analyze("Password123!")
        assert result.score <= 1
        assert any("common password" in warning for warning in result.warnings)

    def test_digits_only_scores_zero(self):
        result = analyze("8391027465028")
        assert result.score == 0
        assert any("brute-forced" in warning for warning in result.warnings)

    def test_keyboard_sequence_is_capped(self):
        assert analyze("qwertyuiopASDF123!@#").score <= 2

    def test_alphabet_sequence_is_flagged(self):
        result = analyze("abcdefgHIJK123!@#")
        assert any("sequence" in warning for warning in result.warnings)

    def test_repeated_characters_are_flagged(self):
        result = analyze("Grrreat!!!aaa2024")
        assert any("repeated" in warning for warning in result.warnings)

    def test_short_password_is_capped(self):
        assert analyze("aB3$xY").score <= 2

    def test_single_case_letters_are_capped(self):
        assert analyze("correcthorsebatterystaple").score <= 2


class TestStrongPasswords:
    def test_long_mixed_password_scores_well(self):
        result = analyze("7hunder!Vault-Quokka_92")
        assert result.score >= 3
        assert result.acceptable
        assert result.warnings == []

    def test_label_matches_score(self):
        result = analyze("7hunder!Vault-Quokka_92")
        assert result.label in {"strong", "very strong"}

    def test_result_always_offers_advice(self):
        for password in ["", "password", "aB3$xY", "7hunder!Vault-Quokka_92"]:
            result = analyze(password)
            assert result.warnings or result.suggestions

    def test_entropy_is_reported(self):
        assert analyze("7hunder!Vault-Quokka_92").entropy_bits > 100
