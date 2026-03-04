#!/usr/bin/env python3
"""Market Data Customer Support Agent

Usage:
    support "customer question here"     Quoted argument
    echo "question" | support            Piped input
    support                              Reads from clipboard (pbpaste)

Investigates customer issues using the docs, live API, and SDKs.
Outputs either a customer-facing response or an internal bug report.
"""

import json
import os
import subprocess
import sys


def get_question():
    """Get the customer question from args, stdin, or clipboard."""
    if len(sys.argv) > 1:
        return " ".join(sys.argv[1:])

    if not sys.stdin.isatty():
        return sys.stdin.read().strip()

    # Read from clipboard
    try:
        question = subprocess.check_output(["pbpaste"], text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        question = ""

    if not question:
        print("No arguments and clipboard is empty.\n")
        print("Usage:")
        print('  support "customer question here"')
        print('  echo "question" | support')
        print("  support                              (reads from clipboard)")
        sys.exit(1)

    preview = "\n".join(question.splitlines()[:3])
    print(f"Reading from clipboard:\n---\n{preview}\n---\n")
    return question


def run_agent(question, script_dir, repo_dir):
    """Run claude -p with streaming JSON and display progress."""
    prompt_file = os.path.join(script_dir, "support-prompt.md")
    sdk_py = os.path.join(repo_dir, "..", "sdk-py")
    sdk_php = os.path.join(repo_dir, "..", "sdk-php")

    cmd = [
        "claude", "-p",
        "--append-system-prompt-file", prompt_file,
        "--add-dir", sdk_py, sdk_php,
        "--output-format", "stream-json",
        "--verbose",
        question,
    ]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=repo_dir,
        text=True,
    )

    turns = 0
    tool_calls = 0
    result_text = ""
    stderr_output = []

    # Read stderr in a thread so it doesn't block
    import threading

    def read_stderr():
        for err_line in proc.stderr:
            stderr_output.append(err_line)

    stderr_thread = threading.Thread(target=read_stderr, daemon=True)
    stderr_thread.start()

    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except (json.JSONDecodeError, ValueError):
            continue

        event_type = event.get("type", "")

        if event_type == "assistant":
            turns += 1
            for block in event.get("message", {}).get("content", []):
                if block.get("type") == "tool_use":
                    tool_calls += 1
                    name = block.get("name", "")
                    print(
                        f"\r\033[KSearching... turn {turns} | {tool_calls} tool calls | {name}",
                        end="", file=sys.stderr, flush=True,
                    )

        elif event_type == "result":
            result_text = event.get("result", "")
            cost = event.get("total_cost_usd", 0)
            duration_s = event.get("duration_ms", 0) / 1000
            num_turns = event.get("num_turns", turns)
            print(
                f"\r\033[KDone — {num_turns} turns, {tool_calls} tool calls, {duration_s:.1f}s, ${cost:.4f}",
                file=sys.stderr, flush=True,
            )
            print("", file=sys.stderr)

    proc.wait()
    stderr_thread.join(timeout=2)

    if result_text:
        print(result_text)
    else:
        # Show any error output from claude
        err = "".join(stderr_output).strip()
        if err:
            print(f"Claude error:\n{err}", file=sys.stderr)
        else:
            print("Error: No response received from Claude.", file=sys.stderr)
        sys.exit(1)


def main():
    script_dir = os.path.dirname(os.path.realpath(__file__))
    repo_dir = os.path.dirname(script_dir)

    question = get_question()
    run_agent(question, script_dir, repo_dir)


if __name__ == "__main__":
    main()
