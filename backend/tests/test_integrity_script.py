"""Exercise local shell entry points without calling Docker or nested tests."""

import os
from pathlib import Path
import shutil
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[2]
BASH = shutil.which("bash")
pytestmark = pytest.mark.skipif(BASH is None, reason="integrity script requires Bash")


def run_script(tmp_path, script, *args, backend_exit=0):
    commands = {
        "docker": '[ "$*" = "compose version" ] && exit 0\nprintf "docker:%s\\n" "$*"',
        "python3": (
            'printf "backend:%s:%s\\n" "$PWD" "$DATABASE_URL"\n'
            'exit "$MOCK_BACKEND_EXIT"'
        ),
        "npm": 'printf "frontend:%s:%s\\n" "$PWD" "$*"',
    }
    for name, body in commands.items():
        executable = tmp_path / name
        executable.write_text(f"#!{BASH}\n{body}\n", encoding="utf-8")
        executable.chmod(0o700)

    return subprocess.run(
        [BASH, str(ROOT / script), *args],
        cwd=tmp_path,
        input="",
        env={
            **os.environ,
            "PATH": f"{tmp_path}{os.pathsep}{os.defpath}",
            "DATABASE_URL": "postgresql://placeholder.invalid/not-a-test-db",
            "MOCK_BACKEND_EXIT": str(backend_exit),
        },
        capture_output=True,
        text=True,
        timeout=10,
    )


def test_integrity_script_overrides_inherited_database_and_runs_from_any_directory(tmp_path):
    result = run_script(tmp_path, "full-integrity-test.sh")
    assert result.returncode == 0, result.stderr
    assert "docker:compose -f docker-compose.yml config -q" in result.stdout
    assert "docker:compose -f docker-compose.prod.yml config -q" in result.stdout
    assert f"backend:{ROOT / 'backend'}:sqlite:///:memory:" in result.stdout
    assert "placeholder.invalid" not in result.stdout + result.stderr
    for command in ("lint", "test:run", "build"):
        assert f"frontend:{ROOT / 'frontend'}:run {command}" in result.stdout


def test_integrity_script_stops_after_backend_failure(tmp_path):
    result = run_script(tmp_path, "full-integrity-test.sh", backend_exit=42)
    assert result.returncode == 42
    assert "frontend:" not in result.stdout


def test_start_without_stdin_defaults_to_development(tmp_path):
    result = run_script(tmp_path, "start.sh")
    assert result.returncode == 0, result.stderr
    assert "docker:compose -f docker-compose.yml up -d" in result.stdout


def test_stop_without_stdin_keeps_volumes_in_production(tmp_path):
    result = run_script(tmp_path, "stop.sh", "prod")
    assert result.returncode == 0, result.stderr
    assert "docker:compose -f docker-compose.prod.yml down" in result.stdout.splitlines()
    assert "down -v" not in result.stdout
