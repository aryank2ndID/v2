"""Tiny offline i18n. No network, no ICU dependency - the Expo app bundles the same JSON.

Locale JSON lives in oa_core/locales/ and is the single source of truth for both
the Python report renderer and the React Native UI (metro imports the same files),
so a string can never be translated in one place and not the other.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

LOCALE_DIR = Path(__file__).parent / "locales"
DEFAULT_LOCALE = "en"


@lru_cache(maxsize=8)
def catalog(locale: str) -> dict[str, str]:
    p = LOCALE_DIR / f"{locale}.json"
    if not p.exists():
        p = LOCALE_DIR / f"{DEFAULT_LOCALE}.json"
    return json.loads(p.read_text(encoding="utf-8"))


def available_locales() -> list[str]:
    return sorted(p.stem for p in LOCALE_DIR.glob("*.json"))


def t(key: str, locale: str = DEFAULT_LOCALE) -> str:
    c = catalog(locale)
    if key in c:
        return c[key]
    return catalog(DEFAULT_LOCALE).get(key, key)


def missing_keys(locale: str) -> list[str]:
    """CI guard: every locale must cover every English key."""
    return sorted(set(catalog(DEFAULT_LOCALE)) - set(catalog(locale)))
