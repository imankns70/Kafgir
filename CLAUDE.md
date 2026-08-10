## Documentation synchronization

After completing a significant task, synchronize project documentation only when needed.

- Update `.ai/PROJECT_STATE.md` if the current project state materially changed.
- Update `.ai/TASKS.md` if a tracked task was completed, added, removed, or changed.
- Update `.ai/DECISIONS.md` only when a durable architectural, technical, or product decision was made.
- Update `.ai/docs/*` only when an existing document became factually outdated because of the change.

Rules:
- Keep documentation updates concise.
- Record the current state, not session history.
- Do not write implementation diaries.
- Do not duplicate information across multiple documentation files.
- Do not update documentation after trivial fixes, formatting changes, or minor UI adjustments.
- Do not read all `.ai/docs/*` files just to perform synchronization; inspect only documents directly affected by the task.


## Trivial task fast path

For small, explicitly scoped changes such as:
- removing a marked UI element
- changing text
- spacing or styling adjustments
- changing an icon
- fixing a clearly identified local UI issue

use a fast path:

- Do not load `.ai` documentation.
- Do not inspect project-wide architecture.
- Do not scan unrelated files.
- Do not create an implementation plan.
- Locate only the directly responsible source file(s).
- Make the smallest necessary change.
- Run only lightweight relevant verification.
- Do not update project documentation unless the change materially affects project state.