import random

from app.adapters.mock_adapter import get_products
from app.services.recommender import OCCASION_ITEM_RULES, ROMANTIC_COLORS, BOLD_COLORS, CLASSY_COLOR_PAIRS


def _passes_occasion_rules(title_lower, category, occasion):
    rules = OCCASION_ITEM_RULES.get(occasion, {}).get(category)
    if not rules:
        return True

    if any(keyword in title_lower for keyword in rules.get("exclude", [])):
        return False

    include = rules.get("include", [])
    if include and not any(keyword in title_lower for keyword in include):
        return False

    return True


def score_product(product, preferences, target_category):
    score = 0

    if product["category"] == target_category:
        score += 50
    else:
        return -1

    # The catalog's season tag alone isn't reliable — jackets and waistcoats
    # show up tagged "summer" in the source data. Hard-exclude heavy,
    # insulating garments from a summer request rather than just scoring
    # them lower, since a soft penalty can still lose to a tie elsewhere
    # (color/style match) and put a jacket in a beach-day recommendation.
    if preferences["season"] == "summer" and product.get("warmth") == "heavy":
        return -1

    # Jeans aren't beach/warm-weather wear, but relying on the "beach"
    # occasion filter alone only catches it when the prompt literally says
    # "beach" or "pool" — a request like "casual summer outfit" has no
    # detected occasion at all, so jeans would otherwise still slip through
    # as an ordinary summer-tagged bottom. Hard-exclude for any summer
    # request instead. ("short" is checked too so items whose title merely
    # inherits "Jeans" from the brand name, e.g. "Kraus Jeans ... Shorts",
    # aren't wrongly excluded.)
    title_lower = product["title"].lower()
    if preferences["season"] == "summer" and "jean" in title_lower and "short" not in title_lower:
        return -1

    # "Romantic dinner" wants ONLY classic colors (black/white/grey/burgundy)
    # on both pieces — a soft scoring bonus isn't enough since a bright-color
    # item with no competing candidates could still win on style/season
    # alone. Hard-exclude anything outside the classic palette instead.
    if preferences.get("occasion") == "romantic" and product["color"] not in ROMANTIC_COLORS:
        return -1

    if product["season"] == preferences["season"] or product["season"] == "all":
        score += 20

    for style in preferences["styles"]:
        if style in product["style"]:
            score += 15

    # Weighted above style for the same reason as score_combination below —
    # an explicit color request should reliably beat style/season ties.
    for color in preferences["colors"]:
        if color == product["color"]:
            score += 30

    return score


def find_top_products(products, preferences, target_category, limit=8):
    # A wider pool than the final combination count matters once the catalog
    # has many same-scoring items (a very common case — most items share the
    # same style/season and no color was requested): a small limit combined
    # with a stable sort means whichever item happens to sit earliest in
    # catalog.json always wins every tie, so anything appended later (e.g. a
    # newly added garment) can never surface even when it scores identically.
    gender = preferences.get("gender")
    occasion = preferences.get("occasion")
    candidates = [
        p for p in products
        if p["category"] == target_category
        and (not gender or p["gender"] == gender)
        and _passes_occasion_rules(p["title"].lower(), target_category, occasion)
    ]

    scored = []

    for product in candidates:
        score = score_product(product, preferences, target_category)
        # A negative score is a hard exclusion (wrong category, or a heavy
        # garment in a summer request) — never let it fill a candidate slot
        # just because too few valid items scored higher.
        if score >= 0:
            scored.append((score, product))

    # Shuffle before the (stable) sort so items tied on score — the common
    # case, since most requests don't specify a color — get a fair chance
    # to surface instead of the earliest catalog entry always winning.
    random.shuffle(scored)
    scored.sort(reverse=True, key=lambda x: x[0])

    return [item[1] for item in scored[:limit]]


def build_outfit(preferences):
    products = get_products()

    gender = preferences.get("gender")
    # When the prompt doesn't say who the outfit is for, still keep each
    # individual combination internally consistent — build separate men's
    # and women's pools and merge by score, rather than picking top/bottom
    # independently and risking a women's top paired with men's bottoms in
    # the same "outfit".
    genders = [gender] if gender else sorted({p["gender"] for p in products if p.get("gender")})

    top_options, bottom_options = [], []
    scored_combinations = []

    for g in genders:
        gender_preferences = {**preferences, "gender": g}
        tops    = find_top_products(products, gender_preferences, "top")
        bottoms = find_top_products(products, gender_preferences, "bottom")

        top_options    += tops
        bottom_options += bottoms

        if tops and bottoms:
            scored_combinations += score_all_combinations(tops, bottoms, preferences)
        else:
            # Catalog doesn't have both categories populated for this
            # gender yet — fall back to top-only combinations rather than
            # producing zero results.
            scored_combinations += [(0, {"top": top}) for top in tops]

    random.shuffle(scored_combinations)
    scored_combinations.sort(reverse=True, key=lambda x: x[0])
    combinations = _pick_diverse_combinations(scored_combinations, limit=3)

    return {
        "top": top_options,
        "bottom": bottom_options,
        "combinations": combinations,
    }


def _pick_diverse_combinations(scored_combinations, limit=3):
    # The app only shows each recommendation's top (image + title), so
    # taking the raw top-N highest-scoring combos could return "3 outfits"
    # that all reuse the same best-scoring top and only differ in bottom/
    # shoes — which reads as the same recommendation repeated. Prefer a
    # distinct top per slot; only repeat one if there genuinely aren't
    # enough distinct tops to fill the list.
    picked = []
    seen_top_ids = set()

    for _, combo in scored_combinations:
        top_id = combo["top"]["id"]
        if top_id in seen_top_ids:
            continue
        picked.append(combo)
        seen_top_ids.add(top_id)
        if len(picked) == limit:
            return picked

    for _, combo in scored_combinations:
        if len(picked) == limit:
            break
        if combo not in picked:
            picked.append(combo)

    return picked


def score_all_combinations(tops, bottoms, preferences):
    scored = []

    for top in tops:
        for bottom in bottoms:
            # Two different bold/statement colors fighting each other (a
            # green short with an orange shirt) is never a valid outfit —
            # drop the pairing entirely rather than merely scoring it lower,
            # since a soft penalty can still win a tie when nothing better
            # is available for this gender/category.
            if top["color"] != bottom["color"] and top["color"] in BOLD_COLORS and bottom["color"] in BOLD_COLORS:
                continue

            combo = {
                "top": top,
                "bottom": bottom,
            }

            scored.append((score_combination(combo, preferences), combo))

    return scored

def score_combination(combo, preferences):
    score = 0

    # Style match
    for style in preferences["styles"]:
        if style in combo["top"]["style"]:
            score += 10
        if style in combo["bottom"]["style"]:
            score += 10

    # Color match — weighted well above style so an explicit color request
    # (e.g. "black outfit") reliably outranks a combo that only matches on
    # style/season. A color name is an unambiguous, literal ask; without
    # this a combo with zero color matches but 3 style matches could tie or
    # beat a combo that's actually the right color on every piece.
    for color in preferences["colors"]:
        if color == combo["top"]["color"]:
            score += 25
        if color == combo["bottom"]["color"]:
            score += 25

    # Season match
    if combo["top"]["season"] == preferences["season"]:
        score += 5
    if combo["bottom"]["season"] == preferences["season"]:
        score += 5

    # Extra nudge for the specific pairings named as reliably classy (black+
    # white, brown+beige, etc.) — on top of the hard bold-clash rule above.
    if frozenset({combo["top"]["color"], combo["bottom"]["color"]}) in CLASSY_COLOR_PAIRS:
        score += 15

    return score