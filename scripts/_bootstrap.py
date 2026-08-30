"""Put the monorepo packages on sys.path without an install step."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for pkg in ("core", "cv", "api"):
    p = str(ROOT / "packages" / pkg)
    if p not in sys.path:
        sys.path.insert(0, p)
