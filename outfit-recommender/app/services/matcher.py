import random  # used to shuffle candidates so tied scores don't always favor the same catalog order

from app.adapters.mock_adapter import get_products  # loads/normalizes the garment catalog (catalog.json)
from app.services.recommender import OCCASION_ITEM_RULES, ROMANTIC_COLORS, BOLD_COLORS, CLASSY_COLOR_PAIRS  # the rule tables built in recommender.py


def _passes_occasion_rules(title_lower, category, occasion):  # hard pass/fail check: does this garment's title satisfy the occasion's rules?
    rules = OCCASION_ITEM_RULES.get(occasion, {}).get(category)  # look up the include/exclude rules for this occasion + category (e.g. "beach"/"top")
    if not rules:  # no rules defined for this occasion/category combo
        return True  # nothing to filter on, so it automatically passes

    if any(keyword in title_lower for keyword in rules.get("exclude", [])):  # if the title contains ANY forbidden keyword
        return False  # reject it outright

    include = rules.get("include", [])  # the list of keywords at least one of which must be present
    if include and not any(keyword in title_lower for keyword in include):  # if there IS an include list but none of its keywords are present
        return False  # reject it

    return True  # passed both checks


def score_product(product, preferences, target_category):  # computes a numeric score for one product against the user's preferences; -1 means "hard rejected"
    score = 0  # start at zero and add points for each match

    if product["category"] == target_category:  # only score products of the category we're looking for (top vs bottom)
        score += 50  # big base score just for being the right category
    else:
        return -1  # wrong category entirely -> hard reject

    # The catalog's season tag alone isn't reliable — jackets and waistcoats
    # show up tagged "summer" in the source data. Hard-exclude heavy,
    # insulating garments from a summer request rather than just scoring
    # them lower, since a soft penalty can still lose to a tie elsewhere
    # (color/style match) and put a jacket in a beach-day recommendation.
    if preferences["season"] == "summer" and product.get("warmth") == "heavy":  # summer request + a heavy/insulating garment
        return -1  # hard reject regardless of any other matching score

    # Jeans aren't beach/warm-weather wear, but relying on the "beach"
    # occasion filter alone only catches it when the prompt literally says
    # "beach" or "pool" — a request like "casual summer outfit" has no
    # detected occasion at all, so jeans would otherwise still slip through
    # as an ordinary summer-tagged bottom. Hard-exclude for any summer
    # request instead. ("short" is checked too so items whose title merely
    # inherits "Jeans" from the brand name, e.g. "Kraus Jeans ... Shorts",
    # aren't wrongly excluded.)
    title_lower = product["title"].lower()  # lowercase the garment's title once, reused below
    if preferences["season"] == "summer" and "jean" in title_lower and "short" not in title_lower:  # summer request + it's jeans + it's NOT actually a pair of denim shorts
        return -1  # hard reject

    # "Romantic dinner" wants ONLY classic colors (black/white/grey/burgundy)
    # on both pieces — a soft scoring bonus isn't enough since a bright-color
    # item with no competing candidates could still win on style/season
    # alone. Hard-exclude anything outside the classic palette instead.
    if preferences.get("occasion") == "romantic" and product["color"] not in ROMANTIC_COLORS:  # romantic occasion + color isn't one of the allowed classic colors
        return -1  # hard reject

    if product["season"] == preferences["season"] or product["season"] == "all":  # exact season match, or the garment works in any season
        score += 20  # reward season match

    for style in preferences["styles"]:  # for every style the user asked for (usually just one)
        if style in product["style"]:  # if the garment is tagged with that style
            score += 15  # reward style match

    # Weighted above style for the same reason as score_combination below —
    # an explicit color request should reliably beat style/season ties.
    for color in preferences["colors"]:  # for every color the user explicitly typed
        if color == product["color"]:  # exact color match
            score += 30  # reward color match more heavily than style/season

    return score  # final non-negative score used for ranking


def find_top_products(products, preferences, target_category, limit=8):  # returns the best `limit` candidates for one category (top or bottom)
    # A wider pool than the final combination count matters once the catalog
    # has many same-scoring items (a very common case — most items share the
    # same style/season and no color was requested): a small limit combined
    # with a stable sort means whichever item happens to sit earliest in
    # catalog.json always wins every tie, so anything appended later (e.g. a
    # newly added garment) can never surface even when it scores identically.
    gender = preferences.get("gender")  # may be None if the prompt didn't specify
    occasion = preferences.get("occasion")  # may be None if no occasion was detected
    candidates = [  # build the list of products that are even eligible to be scored
        p for p in products
        if p["category"] == target_category  # must be the right category (top/bottom)
        and (not gender or p["gender"] == gender)  # must match the requested gender, if any was given
        and _passes_occasion_rules(p["title"].lower(), target_category, occasion)  # must pass the hard occasion filter
    ]

    scored = []  # will hold (score, product) tuples

    for product in candidates:  # score every eligible candidate
        score = score_product(product, preferences, target_category)
        # A negative score is a hard exclusion (wrong category, or a heavy
        # garment in a summer request) — never let it fill a candidate slot
        # just because too few valid items scored higher.
        if score >= 0:  # only keep non-rejected products
            scored.append((score, product))

    # Shuffle before the (stable) sort so items tied on score — the common
    # case, since most requests don't specify a color — get a fair chance
    # to surface instead of the earliest catalog entry always winning.
    random.shuffle(scored)  # randomize order first so ties aren't resolved by catalog position
    scored.sort(reverse=True, key=lambda x: x[0])  # then stable-sort by score, highest first (Python's sort preserves the shuffled order among ties)

    return [item[1] for item in scored[:limit]]  # return just the products (drop the score) for the top `limit` entries


def build_outfit(preferences):  # top-level function: builds the full recommendation response for one request
    products = get_products()  # load the whole catalog

    gender = preferences.get("gender")  # may be None
    # When the prompt doesn't say who the outfit is for, still keep each
    # individual combination internally consistent — build separate men's
    # and women's pools and merge by score, rather than picking top/bottom
    # independently and risking a women's top paired with men's bottoms in
    # the same "outfit".
    genders = [gender] if gender else sorted({p["gender"] for p in products if p.get("gender")})  # either just the requested gender, or every gender present in the catalog

    top_options, bottom_options = [], []  # will collect every candidate top/bottom shown across all genders processed
    scored_combinations = []  # will collect every (score, combo) pair across all genders processed

    for g in genders:  # process one gender at a time so tops/bottoms never get mixed across genders
        gender_preferences = {**preferences, "gender": g}  # copy of preferences but pinned to this specific gender
        tops    = find_top_products(products, gender_preferences, "top")  # best candidate tops for this gender
        bottoms = find_top_products(products, gender_preferences, "bottom")  # best candidate bottoms for this gender

        top_options    += tops  # accumulate for the final response
        bottom_options += bottoms

        if tops and bottoms:  # if we have candidates in both categories
            scored_combinations += score_all_combinations(tops, bottoms, preferences)  # score every top+bottom pairing
        else:
            # Catalog doesn't have both categories populated for this
            # gender yet — fall back to top-only combinations rather than
            # producing zero results.
            scored_combinations += [(0, {"top": top}) for top in tops]  # degrade gracefully to top-only "combinations"

    random.shuffle(scored_combinations)  # randomize before sorting, same tie-breaking reasoning as above
    scored_combinations.sort(reverse=True, key=lambda x: x[0])  # highest-scoring combinations first
    combinations = _pick_diverse_combinations(scored_combinations, limit=3)  # pick the final 3 to actually show the user

    return {  # the full payload returned to the API layer
        "top": top_options,
        "bottom": bottom_options,
        "combinations": combinations,
    }


def _pick_diverse_combinations(scored_combinations, limit=3):  # avoids returning 3 "outfits" that all reuse the same top
    # The app only shows each recommendation's top (image + title), so
    # taking the raw top-N highest-scoring combos could return "3 outfits"
    # that all reuse the same best-scoring top and only differ in bottom/
    # shoes — which reads as the same recommendation repeated. Prefer a
    # distinct top per slot; only repeat one if there genuinely aren't
    # enough distinct tops to fill the list.
    picked = []  # the final list of combinations we'll return
    seen_top_ids = set()  # tracks which top ids we've already used

    for _, combo in scored_combinations:  # first pass: walk combos best-score-first
        top_id = combo["top"]["id"]
        if top_id in seen_top_ids:  # skip if we already picked a combo with this exact top
            continue
        picked.append(combo)  # otherwise take it
        seen_top_ids.add(top_id)  # remember this top is now used
        if len(picked) == limit:  # stop as soon as we have enough
            return picked

    for _, combo in scored_combinations:  # second pass: only runs if the first pass couldn't fill `limit` with distinct tops
        if len(picked) == limit:  # stop once full
            break
        if combo not in picked:  # avoid adding an exact duplicate combo
            picked.append(combo)  # allow repeating a top here since there weren't enough distinct ones

    return picked  # whatever we managed to collect (may be fewer than `limit` if the catalog is very small)


def score_all_combinations(tops, bottoms, preferences):  # builds every top+bottom pairing and scores it
    scored = []  # list of (score, combo) tuples

    for top in tops:  # every candidate top
        for bottom in bottoms:  # paired with every candidate bottom
            # Two different bold/statement colors fighting each other (a
            # green short with an orange shirt) is never a valid outfit —
            # drop the pairing entirely rather than merely scoring it lower,
            # since a soft penalty can still win a tie when nothing better
            # is available for this gender/category.
            if top["color"] != bottom["color"] and top["color"] in BOLD_COLORS and bottom["color"] in BOLD_COLORS:  # two DIFFERENT bold colors together
                continue  # skip this pairing entirely, never even score it

            combo = {  # package the pair together
                "top": top,
                "bottom": bottom,
            }

            scored.append((score_combination(combo, preferences), combo))  # score the pairing and store it

    return scored  # every valid (non-clashing) combo with its score

def score_combination(combo, preferences):  # scores one specific top+bottom pairing as a whole outfit
    score = 0  # running total

    # Style match
    for style in preferences["styles"]:  # for each style the user asked for
        if style in combo["top"]["style"]:  # top has this style tag
            score += 10
        if style in combo["bottom"]["style"]:  # bottom has this style tag
            score += 10

    # Color match — weighted well above style so an explicit color request
    # (e.g. "black outfit") reliably outranks a combo that only matches on
    # style/season. A color name is an unambiguous, literal ask; without
    # this a combo with zero color matches but 3 style matches could tie or
    # beat a combo that's actually the right color on every piece.
    for color in preferences["colors"]:  # for each color the user explicitly typed
        if color == combo["top"]["color"]:  # top matches
            score += 25
        if color == combo["bottom"]["color"]:  # bottom matches
            score += 25

    # Season match
    if combo["top"]["season"] == preferences["season"]:  # top matches requested season
        score += 5
    if combo["bottom"]["season"] == preferences["season"]:  # bottom matches requested season
        score += 5

    # Extra nudge for the specific pairings named as reliably classy (black+
    # white, brown+beige, etc.) — on top of the hard bold-clash rule above.
    if frozenset({combo["top"]["color"], combo["bottom"]["color"]}) in CLASSY_COLOR_PAIRS:  # this exact color pair is one of the known-classy combos
        score += 15  # bonus points on top of everything else

    return score  # final score used to rank this combination against all others
