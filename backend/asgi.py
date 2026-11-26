"""FastAPI entrypoint for deployments rooted at the backend directory."""

import sys
from importlib import import_module
from pathlib import Path

# The deployed directory can be renamed. Import it as a package so api.py's
# relative imports resolve both in a checkout and in the function bundle.
package_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(package_dir.parent))
app = import_module(f"{package_dir.name}.api").app
