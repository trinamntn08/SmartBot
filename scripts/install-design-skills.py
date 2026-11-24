"""Install SmartBot's pinned design skills into the current checkout."""

from pathlib import Path
from tempfile import TemporaryDirectory
import argparse
import os
import subprocess
import sys
import urllib.request


PROJECT_SKILLS = Path(__file__).resolve().parents[1] / ".agents" / "skills"
PACKAGES = (
    (
        "Leonxlnx/taste-skill",
        "6c0b5c78f5d31776e2210305abaa210cdc0030bf",
        (("design-taste-frontend", "skills/taste-skill"),),
        ("LICENSE",),
    ),
    (
        "emilkowalski/skills",
        "64eb3deb9a5fbfa041faf783e0bc3fd635872e9c",
        (
            ("animate", "skills/animate"),
            ("animate-expo", "skills/animate-expo"),
            ("review-animations", "skills/review-animations"),
            ("pick-ui-library", "skills/pick-ui-library"),
        ),
        ("LICENSE",),
    ),
    (
        "pbakaus/impeccable",
        "b49177d32788f2dc585c42831d845dacf1ebed2c",
        (("impeccable", ".agents/skills/impeccable"),),
        ("LICENSE", "NOTICE.md"),
    ),
)


def install_package(installer, repo, revision, folders, notices):
    missing = []
    for name, source in folders:
        target = PROJECT_SKILLS / name
        if (target / "SKILL.md").is_file():
            print(f"Keeping existing {name}", flush=True)
        elif target.exists() or target.is_symlink():
            raise ValueError(f"Existing skill directory has no SKILL.md: {target}")
        else:
            missing.append((name, source))

    if not missing:
        return
    if not installer.is_file():
        raise ValueError(f"Codex skill-installer not found: {installer}. Pass --installer with its path.")

    with TemporaryDirectory(prefix=".install-design-skills-", dir=PROJECT_SKILLS.parent) as directory:
        staging = Path(directory)
        command = [
            sys.executable, str(installer), "--repo", repo, "--ref", revision,
            "--dest", str(staging), "--method", "download", "--path",
            *(source for _, source in missing),
        ]
        if len(missing) == 1:
            command.extend(("--name", missing[0][0]))
        subprocess.run(command, check=True, timeout=300)
        for notice in notices:
            url = f"https://raw.githubusercontent.com/{repo}/{revision}/{notice}"
            with urllib.request.urlopen(url, timeout=30) as response:
                content = response.read()
            for name, _ in missing:
                (staging / name / notice).write_bytes(content)

        # The archive installer does not retain executable permissions.
        launcher = staging / "impeccable/scripts/impeccable"
        if os.name != "nt" and launcher.is_file():
            launcher.chmod(launcher.stat().st_mode | 0o100)
        for name, _ in missing:
            (staging / name).rename(PROJECT_SKILLS / name)


def main():
    codex_home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex")
    default = codex_home / "skills/.system/skill-installer/scripts/install-skill-from-github.py"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--installer", type=Path, default=default)
    args = parser.parse_args()

    try:
        for repo, revision, folders, notices in PACKAGES:
            install_package(args.installer, repo, revision, folders, notices)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f"Design skill setup failed: {error}\n")


if __name__ == "__main__":
    main()
