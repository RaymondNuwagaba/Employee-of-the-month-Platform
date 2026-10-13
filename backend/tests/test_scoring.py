from decimal import Decimal

from app.scoring import rank_candidates

CRITERIA = [
    {"id": 1, "key": "timeliness", "name": "Timeliness", "weight": "30", "sort_order": 1},
    {"id": 2, "key": "supporting", "name": "Supporting Others", "weight": "40", "sort_order": 2},
    {"id": 3, "key": "interpersonal", "name": "Interpersonal Skills", "weight": "15", "sort_order": 3},
    {"id": 4, "key": "innovation", "name": "Innovation", "weight": "15", "sort_order": 4},
]


def avgs(t, s, i, n):
    return {1: Decimal(str(t)), 2: Decimal(str(s)), 3: Decimal(str(i)), 4: Decimal(str(n))}


def test_documented_example_scores_90():
    # Section 27 of the spec: 4.5 / 4.8 / 4.2 / 4.0 -> 27 + 38.4 + 12.6 + 12 = 90
    [r] = rank_candidates(CRITERIA, {7: avgs(4.5, 4.8, 4.2, 4.0)}, {7: 5})
    assert r.final_score == Decimal("90.00")
    assert [b.contribution for b in r.breakdown] == [Decimal("27.00"), Decimal("38.40"), Decimal("12.60"), Decimal("12.00")]
    assert r.rank == 1


def test_perfect_ratings_score_100():
    [r] = rank_candidates(CRITERIA, {1: avgs(5, 5, 5, 5)}, {1: 3})
    assert r.final_score == Decimal("100.00")


def test_tie_broken_by_supporting_others_first():
    # Same total: A is stronger on Supporting Others, B on Timeliness.
    a = avgs(4, 4.5, 3, 3)    # 24 + 36 + 9 + 9 = 78
    b = avgs(5, 3.75, 3, 3)   # 30 + 30 + 9 + 9 = 78
    results = rank_candidates(CRITERIA, {1: a, 2: b}, {1: 4, 2: 4})
    assert results[0].final_score == results[1].final_score
    assert [r.user_id for r in results] == [1, 2]
    assert not results[0].tied_with_next


def test_exact_tie_is_flagged_for_review():
    results = rank_candidates(CRITERIA, {1: avgs(4, 4, 4, 4), 2: avgs(4, 4, 4, 4)}, {1: 3, 2: 3})
    assert results[0].tied_with_next


def test_candidates_below_minimum_evaluations_are_not_ranked():
    results = rank_candidates(CRITERIA, {1: avgs(5, 5, 5, 5), 2: avgs(3, 3, 3, 3)}, {1: 1, 2: 4}, min_evaluations=3)
    by_id = {r.user_id: r for r in results}
    assert by_id[2].rank == 1
    assert by_id[1].rank is None and not by_id[1].qualified
