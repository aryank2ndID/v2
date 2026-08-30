"""Path bootstrap + shared fixtures. No install step, so a clone runs `pytest` directly."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
for pkg in ("core", "cv", "api"):
    p = str(ROOT / "packages" / pkg)
    if p not in sys.path:
        sys.path.insert(0, p)
sys.path.insert(0, str(ROOT / "scripts"))


@pytest.fixture(scope="session")
def root() -> Path:
    return ROOT


@pytest.fixture(scope="session")
def model():
    from oa_core import OARiskModel
    return OARiskModel()


@pytest.fixture(scope="session")
def demo():
    """The end-to-end demo module, reused so the builder lives in one place."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("demo_e2e", ROOT / "scripts" / "demo_end_to_end.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
