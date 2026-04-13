from __future__ import annotations

import json
import shutil
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
INPUT_DIR = SCRIPT_DIR / "input"
OUTPUT_DIR = SCRIPT_DIR / "output"


def reject_non_standard_constant(value: str) -> None:
    raise ValueError(f"Non-standard JSON constant: {value}")


def is_standard_json(text: str) -> bool:
    try:
        json.loads(text, parse_constant=reject_non_standard_constant)
        return True
    except (json.JSONDecodeError, RecursionError, ValueError):
        return False


def minify_json_text(text: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False

    for char in text:
        if in_string:
            result.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char in " \t\r\n":
            continue

        result.append(char)
        if char == '"':
            in_string = True

    return "".join(result)


def reset_output_dir() -> None:
    script_dir = SCRIPT_DIR.resolve()
    output_dir = OUTPUT_DIR.resolve()

    if output_dir.parent != script_dir or output_dir.name != "output":
        raise RuntimeError(f"Refusing to clear unexpected output path: {output_dir}")

    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def process_json_file(source: Path, destination: Path) -> str:
    try:
        text = source.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        copy_file(source, destination)
        return "copied_non_utf8"

    if not is_standard_json(text):
        copy_file(source, destination)
        return "copied_nonstandard"

    minified = minify_json_text(text)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(minified, encoding="utf-8", newline="")
    return "minified"


def main() -> int:
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    reset_output_dir()

    counters = {
        "minified": 0,
        "copied_nonstandard": 0,
        "copied_non_utf8": 0,
        "copied_other": 0,
    }

    for source in INPUT_DIR.rglob("*"):
        relative_path = source.relative_to(INPUT_DIR)
        destination = OUTPUT_DIR / relative_path

        if source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
            continue

        if source.suffix.lower() == ".json":
            status = process_json_file(source, destination)
            counters[status] += 1
            continue

        copy_file(source, destination)
        counters["copied_other"] += 1

    print("Compression complete.")
    print(f"Input:  {INPUT_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Standard JSON minified: {counters['minified']}")
    print(f"Non-standard JSON copied unchanged: {counters['copied_nonstandard']}")
    print(f"Non-UTF-8 JSON copied unchanged: {counters['copied_non_utf8']}")
    print(f"Other files copied unchanged: {counters['copied_other']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
