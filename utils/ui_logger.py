from __future__ import annotations

import builtins
import os
import sys
from datetime import datetime
from typing import Any

import requests

DASHBOARD_UPDATE_URL = "http://127.0.0.1:3000/update"

CAT_INPUT = "INPUT"
CAT_PLAN = "PLAN"
CAT_FETCH = "FETCH"
CAT_REASON = "REASON"
CAT_RISK = "RISK"
CAT_TRUST = "TRUST"
CAT_EXEC = "EXEC"
CAT_PROOF = "PROOF"
CAT_ENS = "ENS"

STEP_READY = "ready"
STEP_ACTIVE = "active"
STEP_DONE = "done"

CURRENT_CATEGORY = CAT_INPUT
CURRENT_STEP = ""
CURRENT_STEP_STATE = STEP_READY
CURRENT_LINE = ""
PROCESS_STATE = "running"

_ORIGINAL_PRINT = builtins.print
_INSTALLED = False


def _is_silent() -> bool:
    return os.getenv("UI_LOGGER_SILENT", "").lower() in {"1", "true", "yes", "on"}


def install() -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    builtins.print = _patched_print  # type: ignore[assignment]
    _INSTALLED = True


def restore() -> None:
    global _INSTALLED
    if not _INSTALLED:
        return
    builtins.print = _ORIGINAL_PRINT  # type: ignore[assignment]
    _INSTALLED = False


def configure(*, update_url: str | None = None) -> None:
    global DASHBOARD_UPDATE_URL
    if update_url:
        DASHBOARD_UPDATE_URL = update_url


def set_context(
    *,
    category: str | None = None,
    step: str | None = None,
    state: str | None = None,
    line: str | None = None,
    process_state: str | None = None,
) -> None:
    global CURRENT_CATEGORY, CURRENT_STEP, CURRENT_STEP_STATE, CURRENT_LINE, PROCESS_STATE
    if category is not None:
        CURRENT_CATEGORY = category
    if step is not None:
        CURRENT_STEP = step
    if state is not None:
        CURRENT_STEP_STATE = state
    if line is not None:
        CURRENT_LINE = line
    if process_state is not None:
        PROCESS_STATE = process_state


def push_dashboard_update(payload: dict[str, Any]) -> None:
    try:
        requests.post(DASHBOARD_UPDATE_URL, json=payload, timeout=3)
    except Exception:
        pass


def push_state(*, patch: dict[str, Any] | None = None) -> None:
    payload: dict[str, Any] = {
        "patch": {
            "current_category": CURRENT_CATEGORY,
            "current_step": CURRENT_STEP,
            "current_step_state": CURRENT_STEP_STATE,
            "current_line": CURRENT_LINE,
            "process_state": PROCESS_STATE,
        }
    }
    if patch:
        payload["patch"].update(patch)
    push_dashboard_update(payload)


def emit(
    line: str,
    *,
    category: str | None = None,
    step: str | None = None,
    state: str | None = None,
    patch: dict[str, Any] | None = None,
) -> None:
    if not line.strip():
        _ORIGINAL_PRINT()
        return

    set_context(
        category=category,
        step=step,
        state=state,
        line=line,
    )
    if _is_silent():
        return
    _ORIGINAL_PRINT(line)
    _push_event(line, patch=patch)


def section(title: str, *, category: str | None = None, step: str | None = None, state: str | None = None) -> None:
    emit(title, category=category, step=step, state=state)


def _push_event(line: str, *, patch: dict[str, Any] | None = None) -> None:
    event = {
        "time": datetime.now().strftime("%H:%M:%S"),
        "category": CURRENT_CATEGORY,
        "line": line,
        "step": CURRENT_STEP,
        "state": CURRENT_STEP_STATE,
    }
    payload: dict[str, Any] = {
        "event": event,
        "patch": {
            "current_category": CURRENT_CATEGORY,
            "current_step": CURRENT_STEP,
            "current_step_state": CURRENT_STEP_STATE,
            "current_line": line,
            "process_state": PROCESS_STATE,
        },
    }
    if patch:
        payload["patch"].update(patch)
    push_dashboard_update(payload)


def _patched_print(*args: Any, **kwargs: Any) -> None:
    file = kwargs.get("file", sys.stdout)
    sep = kwargs.get("sep", " ")
    end = kwargs.get("end", "\n")
    flush = kwargs.get("flush", False)

    text = sep.join(str(arg) for arg in args)
    _ORIGINAL_PRINT(*args, **kwargs)

    if file not in (None, sys.stdout, sys.__stdout__):
        return
    if not text.strip():
        return

    if _is_silent():
        return

    _push_event(text)
    if flush:
        try:
            sys.stdout.flush()
        except Exception:
            pass
