import re  # regex module, used for whole-word keyword matching in the prompt

# Catalog color values (see catalog.json) mapped from common words/synonyms
# a user might actually type. Keys are what we look for in the prompt,
# values are the exact catalog "color" string so matcher.py's `==` scoring
# against product colors actually hits.
COLOR_ALIASES = {  # dict: every color word a user might type -> the exact color string used in catalog.json
    "off white": "off white", "cream": "cream", "beige": "beige", "tan": "tan",
    "khaki": "khaki", "coffee brown": "coffee brown", "coffee": "coffee brown",
    "brown": "brown", "rust": "rust", "maroon": "maroon", "burgundy": "maroon",  # "burgundy" is not a catalog color, so it's mapped onto "maroon"
    "wine": "maroon", "red": "red", "orange": "orange", "peach": "peach",  # "wine" is another synonym that maps onto "maroon"
    "copper": "copper", "gold": "gold", "yellow": "yellow", "mustard": "mustard",
    "green": "green", "olive": "olive", "sea green": "sea green", "teal": "teal",
    "turquoise blue": "turquoise blue", "turquoise": "turquoise blue",  # short form "turquoise" also maps to the full catalog name
    "navy blue": "navy blue", "navy": "navy blue", "blue": "blue",  # "navy" short form maps to "navy blue"
    "purple": "purple", "lavender": "lavender", "mauve": "mauve",
    "magenta": "magenta", "pink": "pink", "grey melange": "grey melange",
    "charcoal": "charcoal", "grey": "grey", "gray": "grey", "silver": "silver",  # both British "grey" and American "gray" spellings map to the same catalog value
    "white": "white", "black": "black",
}  # end of COLOR_ALIASES

# Catalog only has these three style tags — "minimalist", "bohemian", "preppy"
# etc. would never match a real product, so they're deliberately left out.
POSSIBLE_STYLES = ["casual", "streetwear", "elegant"]  # list of style words we actually look for in a prompt
POSSIBLE_SEASONS = ["winter", "summer", "spring", "autumn"]  # list of season words we actually look for in a prompt

# Neutral/classic colors are safe to pair with literally anything (including
# another neutral, or a single bold color as an accent). Everything else is
# a "statement" color that clashes when paired with ANOTHER different bold
# color — a green short next to an orange shirt is two statements fighting
# each other, not an outfit. See matcher.score_all_combinations, which hard-
# excludes bold-on-different-bold pairings rather than just scoring them
# lower (a soft penalty can still lose a tie and let the clash through).
NEUTRAL_COLORS = {  # set of colors considered "safe"/classic, can be paired with anything
    "black", "white", "off white", "grey", "charcoal", "grey melange", "silver",
    "beige", "tan", "khaki", "brown", "coffee brown", "cream", "maroon",
    "navy blue", "blue",
}  # end of NEUTRAL_COLORS
BOLD_COLORS = {  # set of "statement" colors that clash if two DIFFERENT ones are paired together
    "red", "orange", "peach", "copper", "gold", "yellow", "mustard", "green",
    "olive", "sea green", "teal", "turquoise blue", "purple", "lavender",
    "mauve", "magenta", "pink", "rust",
}  # end of BOLD_COLORS

# Pairings called out by name as reliably classy — scored as a bonus on top
# of the neutral/bold hard rule above, not a replacement for it.
CLASSY_COLOR_PAIRS = {  # set of specific color-pairs that get an extra score bonus because they're known-classy combos
    frozenset({"black", "white"}), frozenset({"black", "grey"}),  # frozenset so {"black","white"} and {"white","black"} count as the same pair
    frozenset({"black", "brown"}), frozenset({"brown", "beige"}),
    frozenset({"white", "blue"}), frozenset({"white", "brown"}),
    frozenset({"beige", "navy blue"}),
}  # end of CLASSY_COLOR_PAIRS

MEN_WORDS = ["men", "man", "male", "guy", "boyfriend", "husband", "boy", "gentleman", "his"]  # words in a prompt that imply gender = men
WOMEN_WORDS = ["women", "woman", "female", "girl", "lady", "ladies", "wife", "girlfriend", "her"]  # words in a prompt that imply gender = women

# Occasions/vibes aren't a catalog field, but they strongly imply a style
# and sometimes a season even when the prompt never says "casual" or
# "summer" outright — e.g. "outfit for a wedding" should lean elegant.
OCCASION_STYLE_HINTS = {  # maps a style -> list of occasion/vibe words that imply that style
    # Bare "date" is deliberately excluded — "beach date" and "movie date"
    # are casual, so a standalone "date" isn't a reliable elegant signal on
    # its own; "dinner date"/"date night" are specific enough to keep.
    "elegant": ["wedding", "dinner date", "date night", "romantic", "party", "gala", "dinner", "cocktail", "formal", "interview", "office", "business", "meeting"],
    "streetwear": ["gym", "workout", "sport", "hike", "hiking", "street", "skate", "training"],
    "casual": ["beach", "vacation", "weekend", "brunch", "hangout", "everyday", "travel", "chill", "relax"],
}  # end of OCCASION_STYLE_HINTS
OCCASION_SEASON_HINTS = {  # maps a season -> list of occasion/vibe words that imply that season
    "summer": ["beach", "vacation", "pool", "hot"],
    "winter": ["snow", "ski", "cold", "chilly"],
}  # end of OCCASION_SEASON_HINTS

# Style/season/color scoring alone isn't enough to keep a beach outfit out of
# track pants or put a wedding outfit in actual trousers — the catalog's own
# style/season tags are too noisy for that (e.g. every women's shoe in the
# catalog is tagged "casual", including heels). These are hard include/
# exclude filters on the garment title, applied per category, on top of the
# existing scoring — not just another scored signal — so a beach request
# literally cannot surface trousers, and a wedding request cannot surface a
# t-shirt or trainers.
BEACH_WORDS = ["beach", "pool"]  # words that always force occasion = "beach", no matter what style was detected

# A dinner-type occasion is a stricter subset of "elegant" — it still wants
# OCCASION_STYLE_HINTS["elegant"] to fire (so style scoring leans elegant),
# but on top of the formal item rules it also locks the palette down to
# classic colors (see ROMANTIC_COLORS + matcher.score_product), which plain
# weddings/interviews/business meetings shouldn't be forced into.
ROMANTIC_WORDS = ["romantic", "date night", "dinner date", "candlelight", "valentine", "anniversary", "dinner"]  # words that force occasion = "romantic"
ROMANTIC_COLORS = {"black", "white", "off white", "grey", "charcoal", "maroon"}  # the ONLY colors allowed for a "romantic" outfit (enforced in matcher.py)

OCCASION_ITEM_RULES = {  # the core hard-filter table: occasion -> category ("top"/"bottom") -> include/exclude keyword lists
    "beach": {  # rules that apply when occasion == "beach"
        "top": {
            # Plain "shirt" used to be enough on its own, which let formal
            # button-downs through. Beach now only wants the sporty/relaxed
            # end of tops — t-shirts, polos, and linen/camp-collar shirts —
            # so a buttoned dress shirt no longer qualifies just because the
            # word "shirt" is somewhere in its title.
            "exclude": ["jacket", "sweater", "sweatshirt", "waistcoat", "windcheater", "wind cheater", "kurta", "kurti"],  # titles containing any of these are rejected outright for a beach top
            "include": ["tshirt", "t-shirt", "tee", "polo", "linen", "camp collar"],  # title must contain at least ONE of these to qualify as a beach top
        },
        "bottom": {"include": ["short"]},  # a beach bottom must have "short" in its title
    },
    # Covers every OCCASION_STYLE_HINTS["elegant"] entry (wedding, gala,
    # dinner, cocktail, formal, interview, office, business, meeting) —
    # dress shirt/kurta + real trousers, nothing athletic or beach-adjacent.
    "formal": {  # rules that apply when occasion == "formal"
        "top": {"exclude": ["tshirt", "t-shirt", "tee", "sweatshirt", "jacket", "windcheater", "wind cheater", "sweater"]},  # no casual/athletic tops allowed
        "bottom": {"exclude": ["track pant", "tracksuit", "jean", "short", "cargo", "capri", "legging", "rain trousers"]},  # no casual/athletic bottoms allowed
    },
    # Same garment-type rules as "formal" — a romantic dinner still means
    # real trousers + a proper top — the extra classic-colors-only
    # restriction is applied separately in matcher.score_product.
    "romantic": {  # rules that apply when occasion == "romantic" (same garment rules as "formal", color rule enforced separately)
        "top": {"exclude": ["tshirt", "t-shirt", "tee", "sweatshirt", "jacket", "windcheater", "wind cheater", "sweater"]},
        "bottom": {"exclude": ["track pant", "tracksuit", "jean", "short", "cargo", "capri", "legging", "rain trousers"]},
    },
    # Covers OCCASION_STYLE_HINTS["streetwear"] (gym, workout, sport, hike,
    # street, skate, training). Narrowed to just shorts/sweatpants + a
    # t-shirt — jackets, sweatshirts and polos read as streetwear/athleisure
    # rather than actual gym wear, and leggings/capris/tracksuits aren't the
    # "shorts or sweatpants" the gym case specifically asks for.
    "active": {  # rules that apply when occasion == "active" (gym/workout)
        # "sweatshirt" literally contains the substring "tshirt" (swea-TSHIRT)
        # so it would otherwise slip past the include check below — gym tops
        # are only plain t-shirts, so exclude it (and jacket/sweater,
        # streetwear/athleisure rather than actual gym wear) explicitly.
        "top": {"exclude": ["sweatshirt", "sweater", "jacket"], "include": ["tshirt", "t-shirt", "tee"]},  # gym top must be a plain t-shirt, not a sweatshirt/jacket
        # "track pant" (not bare "track") deliberately excludes "tracksuit"
        # sets — a 2-piece tracksuit's bottom half isn't the plain
        # shorts-or-sweatpants the gym case asks for. "swim" is excluded so
        # beach swim trunks (also titled "...Shorts") don't double as gym
        # wear.
        "bottom": {"exclude": ["swim"], "include": ["short", "track pant", "jogger", "sweat pant"]},  # gym bottom must be shorts/track pants/joggers/sweatpants, not swimwear
    },
}  # end of OCCASION_ITEM_RULES


# Words that flip a keyword from a positive signal into a negative one —
# "I don't want anything formal" should NOT behave like "formal". Checked
# against tokens *before* a matched keyword (see NEGATION_LOOKBACK below).
# Apostrophes are stripped during tokenization (see _tokenize), so "don't"
# arrives here as "dont", "won't" as "wont", etc.
NEGATION_WORDS = {
    "not", "no", "never", "nothing", "avoid", "without", "except", "excluding",
    "dont", "wont", "cant", "isnt", "arent", "aint",
}
NEGATION_LOOKBACK = 4  # how many words before a match to scan for a negating word


def _tokenize(prompt: str) -> list:  # splits a prompt into plain lowercase word tokens
    # Stripping apostrophes first turns "don't" into "dont" so it matches
    # NEGATION_WORDS above; re.findall on letter-runs automatically treats any
    # amount of whitespace OR punctuation (including hyphens) as a separator,
    # which also means "date   night" (extra spaces) and "post-wedding"
    # (hyphenated) tokenize exactly the same as "date night" / "post wedding".
    return re.findall(r"[a-z]+", prompt.replace("'", ""))


def _is_one_substitution_away(a: str, b: str) -> bool:  # True if `a` and `b` are the same length and differ in exactly one letter
    if len(a) != len(b):
        return False
    diffs = sum(1 for x, y in zip(a, b) if x != y)  # count how many positions differ
    return diffs == 1  # exactly one "wrong letter"


def _is_one_transposition_away(a: str, b: str) -> bool:  # True if swapping two ADJACENT letters in `a` turns it into `b`
    if len(a) != len(b):
        return False
    diff_positions = [i for i in range(len(a)) if a[i] != b[i]]  # every index where the two strings disagree
    if len(diff_positions) != 2:  # a simple transposition only ever disagrees at exactly 2 positions
        return False
    i, j = diff_positions
    return j == i + 1 and a[i] == b[j] and a[j] == b[i]  # the two mismatched letters are each other, swapped


def _is_one_deletion_away(shorter: str, longer: str) -> bool:  # True if deleting exactly one letter from `longer` produces `shorter`
    if len(longer) != len(shorter) + 1:  # only makes sense when `longer` has exactly one extra character
        return False
    i = j = 0
    skipped_one = False  # whether we've already used our one allowed "skip" in `longer`
    while i < len(shorter) and j < len(longer):
        if shorter[i] == longer[j]:  # letters line up, advance both
            i += 1
            j += 1
        else:
            if skipped_one:  # a second mismatch means more than one letter is missing
                return False
            skipped_one = True  # this is the one letter we're allowed to skip over in `longer`
            j += 1
    return True  # every letter of `shorter` was found in order inside `longer`, skipping at most one


# Every individual word this file already recognizes somewhere, across every
# category (colors, styles, seasons, genders, occasions...). Used as a guard
# in _is_close_typo: a word that's already a real, different, recognized
# word is never treated as a typo of some other word. Without this, "beach"
# (an occasion word) is exactly one substituted letter away from "peach" (a
# color), so "outfit for the beach" was incorrectly picking up "peach" as a
# requested color — same story for "cold"/"gold" and "wife"/"wine". Typo
# tolerance should only kick in for words we don't recognize at all.
_ALL_KEYWORD_PHRASES = (
    list(COLOR_ALIASES.keys()) + POSSIBLE_STYLES + POSSIBLE_SEASONS + MEN_WORDS + WOMEN_WORDS
    + BEACH_WORDS + ROMANTIC_WORDS
    + [kw for kws in OCCASION_STYLE_HINTS.values() for kw in kws]
    + [kw for kws in OCCASION_SEASON_HINTS.values() for kw in kws]
)
KNOWN_WORDS = {word for phrase in _ALL_KEYWORD_PHRASES for word in phrase.split()}


def _is_close_typo(word: str, keyword: str) -> bool:  # True if `word` is exactly `keyword`, or a believable 1-letter typo of it
    if word == keyword:  # exact match always wins first, regardless of length
        return True
    if word in KNOWN_WORDS:
        # `word` is already a different real, recognized word elsewhere in
        # our vocabulary (e.g. the user genuinely typed "beach" or "cold") —
        # never treat an already-valid word as a typo of some other word.
        return False
    if len(keyword) < 4:
        # Short keywords ("red", "tan", "men") are deliberately exact-match
        # only — fuzzy-matching a 3-letter word is how "tan" ends up matching
        # "ten" or "man" ends up matching "men" by accident.
        return False
    if len(word) == len(keyword):  # same length: either one wrong letter, or two adjacent letters swapped
        return _is_one_substitution_away(word, keyword) or _is_one_transposition_away(word, keyword)
    if len(word) == len(keyword) - 1:  # the typed word is missing exactly one letter from the real keyword
        return _is_one_deletion_away(word, keyword)
    if len(word) == len(keyword) + 1:  # the typed word has exactly one extra letter compared to the real keyword
        return _is_one_deletion_away(keyword, word)
    return False  # anything more different than that is treated as a genuinely different word, not a typo


def _find_phrase(tokens: list, phrase: str):  # searches `tokens` for a (possibly fuzzy, possibly multi-word) match of `phrase`
    phrase_words = phrase.split()  # e.g. "dinner date" -> ["dinner", "date"]
    n = len(phrase_words)
    for i in range(len(tokens) - n + 1):  # slide a window of size `n` across the token list
        if all(_is_close_typo(tokens[i + k], phrase_words[k]) for k in range(n)):  # every word in the window matches (exactly or as a typo)
            return i  # return the window's starting position, needed for the negation check below
    return None  # phrase not found anywhere in the prompt, even allowing for typos


def _contains_word(prompt: str, phrase: str) -> bool:  # returns True if `phrase` appears (typo-tolerant) in `prompt`, and isn't negated
    tokens = _tokenize(prompt)
    match_at = _find_phrase(tokens, phrase)
    if match_at is None:
        return False  # not present at all, even loosely

    # Look at the few words immediately before the match for a negating word.
    # This is a simple proximity heuristic, not real grammar — "no sleeves,
    # beach vibes" would (incorrectly) suppress "beach" too, since "no" sits
    # within the lookback window. Catching genuine negation ("I don't want
    # anything formal") is worth that rare false-negative trade-off here.
    lookback_start = max(0, match_at - NEGATION_LOOKBACK)
    preceding_words = tokens[lookback_start:match_at]
    if any(word in NEGATION_WORDS for word in preceding_words):
        return False  # the keyword was explicitly negated, so it doesn't count as a positive signal

    return True


def extract_preferences(prompt: str) -> dict:  # main entry point: turns a free-text prompt into a structured preferences dict
    prompt = prompt.lower()  # normalize to lowercase so matching is case-insensitive

    styles = [style for style in POSSIBLE_STYLES if _contains_word(prompt, style)]  # collect every style word the user typed explicitly (e.g. "elegant")

    colors = []  # will hold every canonical color name found in the prompt
    for alias, canonical in COLOR_ALIASES.items():  # loop through every known color word/synonym
        if _contains_word(prompt, alias) and canonical not in colors:  # if that word is in the prompt and we haven't already added its canonical color
            colors.append(canonical)  # record the canonical (catalog-matching) color name

    season = next((s for s in POSSIBLE_SEASONS if _contains_word(prompt, s)), None)  # find the first season word in the prompt, or None if none found

    gender = None  # default: no gender detected
    if any(_contains_word(prompt, w) for w in MEN_WORDS):  # if any men-associated word is present
        gender = "men"
    elif any(_contains_word(prompt, w) for w in WOMEN_WORDS):  # else if any women-associated word is present
        gender = "women"

    # Only infer a style from occasion words when the prompt didn't already
    # state one directly, and only take the single best-matching occasion —
    # stacking every occasion hint that happens to appear (e.g. "date" also
    # matching in a prompt that already said "casual") produced outfits that
    # mixed contradictory styles, like a formal shoe in an otherwise casual
    # beach look.
    if not styles:  # only guess a style from occasion words if the user didn't type a style word directly
        for style, keywords in OCCASION_STYLE_HINTS.items():  # check each style's list of occasion/vibe keywords
            if any(_contains_word(prompt, k) for k in keywords):  # if the prompt contains any of this style's keywords
                styles.append(style)  # adopt this style
                break  # stop after the FIRST matching style so we don't mix contradictory styles

    if not season:  # only guess a season from occasion words if the user didn't type a season word directly
        for s, keywords in OCCASION_SEASON_HINTS.items():  # check each season's list of occasion/vibe keywords
            if any(_contains_word(prompt, k) for k in keywords):  # if the prompt contains any of this season's keywords
                season = s  # adopt this season
                break  # stop after the first match

    if not styles:  # if still no style was found or inferred at all
        styles = ["casual"]  # default to casual

    if not season:  # if still no season was found or inferred at all
        season = "all"  # default to "all" (no season restriction)

    # Independent of which style word ended up chosen above — "beach"/"pool"
    # always means shorts-and-a-shirt regardless of season phrasing, while
    # an "elegant" or "streetwear" style (whether typed directly or inferred
    # from an occasion word like "wedding" or "gym") always means real
    # trousers+formal shoes or joggers+trainers respectively. See
    # OCCASION_ITEM_RULES for what each profile actually restricts.
    if any(_contains_word(prompt, w) for w in BEACH_WORDS):  # "beach"/"pool" in the prompt always wins first
        occasion = "beach"
    elif any(_contains_word(prompt, w) for w in ROMANTIC_WORDS):  # next check: a romantic/dinner-type word
        occasion = "romantic"
    elif "elegant" in styles:  # next: style resolved to "elegant" (directly or via OCCASION_STYLE_HINTS)
        occasion = "formal"
    elif "streetwear" in styles:  # next: style resolved to "streetwear"
        occasion = "active"
    else:  # nothing occasion-specific detected
        occasion = None  # no hard filter will be applied; only soft style/season/color scoring happens

    return {  # the final structured result returned to the caller (matcher.py / the API)
        "styles": styles,
        "colors": colors,
        "season": season,
        "gender": gender,
        "occasion": occasion,
    }
