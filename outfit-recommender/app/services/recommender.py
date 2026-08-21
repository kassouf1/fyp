import re

# Catalog color values (see catalog.json) mapped from common words/synonyms
# a user might actually type. Keys are what we look for in the prompt,
# values are the exact catalog "color" string so matcher.py's `==` scoring
# against product colors actually hits.
COLOR_ALIASES = {
    "off white": "off white", "cream": "cream", "beige": "beige", "tan": "tan",
    "khaki": "khaki", "coffee brown": "coffee brown", "coffee": "coffee brown",
    "brown": "brown", "rust": "rust", "maroon": "maroon", "burgundy": "maroon",
    "wine": "maroon", "red": "red", "orange": "orange", "peach": "peach",
    "copper": "copper", "gold": "gold", "yellow": "yellow", "mustard": "mustard",
    "green": "green", "olive": "olive", "sea green": "sea green", "teal": "teal",
    "turquoise blue": "turquoise blue", "turquoise": "turquoise blue",
    "navy blue": "navy blue", "navy": "navy blue", "blue": "blue",
    "purple": "purple", "lavender": "lavender", "mauve": "mauve",
    "magenta": "magenta", "pink": "pink", "grey melange": "grey melange",
    "charcoal": "charcoal", "grey": "grey", "gray": "grey", "silver": "silver",
    "white": "white", "black": "black",
}

# Catalog only has these three style tags — "minimalist", "bohemian", "preppy"
# etc. would never match a real product, so they're deliberately left out.
POSSIBLE_STYLES = ["casual", "streetwear", "elegant"]
POSSIBLE_SEASONS = ["winter", "summer", "spring", "autumn"]

MEN_WORDS = ["men", "man", "male", "guy", "boyfriend", "husband", "boy", "gentleman", "his"]
WOMEN_WORDS = ["women", "woman", "female", "girl", "lady", "ladies", "wife", "girlfriend", "her"]

# Occasions/vibes aren't a catalog field, but they strongly imply a style
# and sometimes a season even when the prompt never says "casual" or
# "summer" outright — e.g. "outfit for a wedding" should lean elegant.
OCCASION_STYLE_HINTS = {
    # Bare "date" is deliberately excluded — "beach date" and "movie date"
    # are casual, so a standalone "date" isn't a reliable elegant signal on
    # its own; "dinner date"/"date night" are specific enough to keep.
    "elegant": ["wedding", "dinner date", "date night", "party", "gala", "dinner", "cocktail", "formal", "interview", "office", "business", "meeting"],
    "streetwear": ["gym", "workout", "sport", "hike", "hiking", "street", "skate", "training"],
    "casual": ["beach", "vacation", "weekend", "brunch", "hangout", "everyday", "travel", "chill", "relax"],
}
OCCASION_SEASON_HINTS = {
    "summer": ["beach", "vacation", "pool", "hot"],
    "winter": ["snow", "ski", "cold", "chilly"],
}


def _contains_word(prompt: str, phrase: str) -> bool:
    # Plain substring checks would let "red" match inside "tired", "tan"
    # inside "important", or "man" inside "woman" — word boundaries on both
    # ends of the (possibly multi-word) phrase avoid that.
    return re.search(rf"\b{re.escape(phrase)}\b", prompt) is not None


def extract_preferences(prompt: str) -> dict:
    prompt = prompt.lower()

    styles = [style for style in POSSIBLE_STYLES if _contains_word(prompt, style)]

    colors = []
    for alias, canonical in COLOR_ALIASES.items():
        if _contains_word(prompt, alias) and canonical not in colors:
            colors.append(canonical)

    season = next((s for s in POSSIBLE_SEASONS if _contains_word(prompt, s)), None)

    gender = None
    if any(_contains_word(prompt, w) for w in MEN_WORDS):
        gender = "men"
    elif any(_contains_word(prompt, w) for w in WOMEN_WORDS):
        gender = "women"

    # Only infer a style from occasion words when the prompt didn't already
    # state one directly, and only take the single best-matching occasion —
    # stacking every occasion hint that happens to appear (e.g. "date" also
    # matching in a prompt that already said "casual") produced outfits that
    # mixed contradictory styles, like a formal shoe in an otherwise casual
    # beach look.
    if not styles:
        for style, keywords in OCCASION_STYLE_HINTS.items():
            if any(_contains_word(prompt, k) for k in keywords):
                styles.append(style)
                break

    if not season:
        for s, keywords in OCCASION_SEASON_HINTS.items():
            if any(_contains_word(prompt, k) for k in keywords):
                season = s
                break

    if not styles:
        styles = ["casual"]

    if not season:
        season = "all"

    return {
        "styles": styles,
        "colors": colors,
        "season": season,
        "gender": gender,
    }
