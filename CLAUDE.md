## Git workflow

* Use `main` as the repository's only long-lived branch.
* Commit and push to `main` only after the relevant tests/build pass and the change is ready.
* Do not create persistent feature or development branches unless the user explicitly requests one.
* Keep commits cohesive so production deployment history remains understandable.
* Do not discard uncommitted local work.
* Before pull, merge, rebase, push, tag, or release operations, inspect:

  * current branch
  * `git status`
  * configured upstream
  * local/remote divergence
* Do not use destructive Git operations such as `git reset --hard`, `git clean`, force push, or destructive restore unless explicitly requested.
* Commit only files relevant to the requested change.
* Do not include `.mcp.json`, local assistant configuration, secrets, `.env` files, local databases, or local tooling files in commits.

## Git / GitHub attribution policy

AI assistance in this project is acceptable and does not need to be hidden.

* Attribution trailers such as `Co-authored-by` and AI-generated PR footers are allowed.
* Commit messages should still describe the technical change first.
* Do not put local machine paths, secrets, or local assistant configuration contents into commits or public artifacts.

## Local-only assistant files

`.ai/` is not local-only: it is tracked project documentation and is committed together with the
change it describes (see Documentation synchronization).

The following are local development infrastructure and must remain excluded from Git:

* `.mcp.json`
* `AGENTS.md` if present and already intended to be local-only
* local AI-agent configuration
* Codebase Memory cache/database files
* local MCP wrappers
* local assistant state
* local prompts or scratch files
* user-specific absolute paths

Do not:

* remove ignore rules protecting these files
* use `git add -f` to include them
* copy their contents into public project documentation
* expose local paths in commits or release notes

## Codebase Memory MCP usage

Use Codebase Memory MCP as the primary repository discovery mechanism for non-trivial repository exploration.

Use it first for:

* architecture understanding
* locating implementations
* dependency analysis
* impact analysis
* tracing workflows
* finding service/module relationships
* identifying likely entry points
* understanding unfamiliar code

Preferred workflow:

`Codebase Memory → narrow scope → targeted source verification → implementation`

Avoid:

`Codebase Memory → broad grep → full repository scan → many file reads → multiple exploratory subagents`

Rules:

* Query Codebase Memory first when repository-wide discovery is needed.
* Use the graph to narrow relevant files and symbols.
* Read source files directly only when exact implementation verification is needed.
* Do not repeat repository-wide searches after the graph has already narrowed the scope.
* Do not read large sets of files "just in case."
* Prefer a few targeted graph queries over repeated exploratory searches.
* Avoid unnecessary subagents for repository discovery.
* If graph results appear ambiguous, verify them against real imports and source code.
* If Codebase Memory reports `parse_partial`, verify only the relevant flagged source ranges directly.
* Treat Codebase Memory as a discovery aid, not a substitute for source verification where correctness depends on exact behavior.

## Codebase Memory indexing

Do not run `index_repository` as part of normal tasks.

Before re-indexing:

* use `index_status`
* use change detection where available
* verify that the graph is actually stale or unhealthy

Re-index only when:

* no index exists
* the index is unhealthy
* major repository changes are missing from the graph
* the repository root changed
* the user explicitly requests a rebuild

Prefer watcher/incremental updates during normal development.

## Token efficiency

Minimize repository context usage without sacrificing correctness.

When multiple approaches can answer the same question, prefer the one that loads the least code into context while preserving enough evidence for a reliable answer.

Do not:

* duplicate discovery through graph search, grep, glob, and full file scans
* repeatedly reopen files whose relevant content is already known
* spawn subagents for tasks that can be answered by one targeted query
* scan unrelated packages for a local change

Do:

* narrow first
* verify second
* modify third
* validate last

## Documentation synchronization

After completing a significant task, synchronize project documentation only when needed.

* Update `.ai/PROJECT_STATE.md` if the current project state materially changed.
* Update `.ai/TASKS.md` if a tracked task was completed, added, removed, or materially changed.
* Update `.ai/DECISIONS.md` only when a durable architectural, technical, infrastructure, deployment, security, or product decision was made.
* Update `.ai/docs/*` only when an existing document became factually outdated because of the change.
* Update `.ai/BUGS.md` only if that file exists and a tracked bug was added, resolved, reclassified, or materially changed.

Rules:

* Keep documentation updates concise.
* Record current state, not session history.
* Do not write implementation diaries.
* Do not duplicate information across multiple documentation files.
* Do not create a new document when an existing canonical document already covers the topic.
* Do not update documentation after trivial fixes, formatting changes, or minor UI adjustments.
* Do not read all `.ai/docs/*` files just to perform synchronization.
* Inspect only documents directly affected by the task.
* Do not perform a broad repository scan solely to update `.ai/*`.
* Reuse Codebase Memory context and the files already changed during the task whenever sufficient.

Preferred documentation workflow:

`Codebase Memory → changed files → directly affected documentation`

## Trivial task fast path

For small, explicitly scoped changes such as:

* removing a marked UI element
* changing text
* spacing or styling adjustments
* changing an icon
* moving or resizing buttons
* adjusting colors to match the theme
* fixing a clearly identified local UI issue

use a fast path.

For these tasks:

* Do not load `.ai` documentation.
* Do not inspect project-wide architecture.
* Do not call `get_architecture` unless genuinely necessary.
* Do not scan unrelated files.
* Do not create an implementation plan.
* Do not spawn exploratory subagents.
* Locate only the directly responsible source file(s).
* Use Codebase Memory only if the responsible file/location is not already obvious.
* Make the smallest necessary change.
* Run only lightweight relevant verification.
* Do not update project documentation unless the change materially affects project state.
* Do not run a full re-index.
* Do not perform broad Git history analysis.

## Validation

After implementing a change:

* run targeted validation first
* run broader builds/tests only when the change is cross-cutting or release-bound
* do not silently ignore build, test, lint, or type-check failures
* distinguish new failures from pre-existing failures
* do not modify unrelated code merely to make unrelated validation pass

Before reporting completion:

* inspect the final diff
* verify only intended files changed
* verify local-only assistant/MCP files are not staged
* verify no secrets or `.env` files were added
* update `.ai/*` documentation only if materially needed

## Release workflow

For release work:

* use the repository's existing versioning convention
* validate the relevant build/tests before promotion to `main`
* merge/squash intentionally to minimize unnecessary Netlify production deploys
* publish only actual technical/product changes
* do not mention local development tooling such as MCP or Codebase Memory in release notes
* do not expose local machine paths
* do not include `.ai/*` content in public release artifacts

## Final reporting

For substantial tasks, report concisely:

* what changed
* important files changed
* validation performed
* unresolved issues or risks
* Git/release actions performed, if any
* whether project documentation was updated and why

Do not provide command-by-command diaries unless requested.
