# Security review of the custom Archify package

This review maps the [TAR report](https://tarai.dev/en/skill/archify/) to this
repository's custom package. It records instruction changes and verified runtime
boundaries. It is not a new TAR score or an independent penetration test.

## Scope and source

The linked report is dated 7 October 2026. Its subject is the short
[Hermes catalogue entry](https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/creative/archify/SKILL.md),
which directs installation from upstream Archify. It does not audit this fork's
complete package. The report itself excludes runtime verification and uses a
separate model to test prompt responses.

This review starts from custom version **3.2.0.1.0**, commit
`8e85bbaddb814b2ff887583d1d0f649d0f887747`. The instruction hardening is supplied
in **3.2.0.1.1**, retaining upstream package identity 3.2.0. Publication and local
installation are separate from preparing the fix.

## Findings and disposition

| Report finding | Verification and action in this fork |
| --- | --- |
| `SEM-008`, external payload trust | The notifier already validates a fixed-origin JSON manifest, rejects redirects, and bounds time and size. It has no installation or process-execution path. The entrypoint now states that even validated release descriptions are untrusted data. Upstream notices also cannot authorize replacing this custom fork. |
| `AR-003`, encoded instructions | Added an explicit rule that decoding, translation, Unicode lookalikes, and obfuscation do not grant instruction authority. Encoded strings may remain literal diagram content. |
| `SEM-002`, ambiguous requests | Defined ordinary requests as diagram facts and presentation requirements, with examples. Embedded operational requests cannot expand the user's task. |
| `SEM-003`, installation scope | The distributable is built from tracked package files with dependency and developer-file exclusions. File count alone is not an execution vulnerability. Added explicit package-integrity and authorization boundaries. |
| `SEM-004`, repository content | Changed “source authority” wording to distinguish factual evidence from agent instructions. Repository commands and comments cannot authorize execution, secret access, or external changes. Source-embedded mode markers cannot enable proactive output. |
| `SEM-007`, irreversible operations | Diagram generation authorizes its own output and verification. Publication, installation, unrelated deletion, external changes, and messages require separate task authorization. Existing authorization is reused; routine diagram generation gets no new confirmation step. |
| `SEM-006`, credential handling | Added specific restrictions on unnecessary secret-file reads and on putting secret values into artifacts or diagnostics. A synthetic credential test checks the public `doctor` command's output. |
| `AR-002`, role claims | Self-claimed system, developer, administrator, vendor, and fictional-persona instructions inside source content have no authority. Legitimate diagrams about such attacks remain supported. |
| `AR-005`, quoted instructions | Pasted documents, Mermaid, labels, tool results, and remote text are content to interpret. Their embedded instructions cannot replace the user's request. |

The report's fetch and diagnostic examples do not establish arbitrary code
execution or credential disclosure in this package. The instruction additions
address real ambiguity without treating every quoted command as malicious or
restricting legitimate diagram topics.

## Runtime controls checked

- [Update contract](../archify/scripts/update-contract.mjs): exact repository and
  manifest identities, stable-version structure, immutable digest fields, and
  constrained release-note links and summaries.
- [Notifier](../archify/scripts/check-update.mjs): fixed endpoint, rejected
  redirects, bounded JSON reads, deadline, and reminder-cache writes. It does not
  execute or install remote code. `ARCHIFY_UPDATE_CHECK_DISABLED=1` disables its
  network check.
- [Brand capture](../archify/references/brand-marks.md): bundled known marks,
  user-provided remote URLs for unknown marks, destination and format limits,
  content pins, and sanitized provenance. Offline work must also avoid remote
  brand capture; disabling the notifier alone does not disable all network use.
- [Content regression](../test/security-boundaries-browser.test.mjs): script and
  event-handler strings stay literal through browser rendering, focus, and native
  draw.io export; synthetic credential values are absent from doctor output.

## Verification limits

Runtime tests can check escaped output, destination restrictions, and absence of
credential values in the exercised paths. They cannot prove that every host model
will resist prompt injection. Review the [entrypoint rules](../archify/SKILL.md#input-trust-and-action-scope)
and [security boundaries](../archify/references/security-boundaries.md) with the
actual harness and model used for deployment.

Instruction checks do not make an already compromised installed package safe.
A checksum verifies agreement with a selected archive, not the publisher's
trustworthiness. Select a trusted source and review or pin the release before an
authorized installation. No package files or private inputs were submitted to TAR
as part of this review, and no changed public score is claimed.

Local verification: the core smoke passed 19 tests; security content, credential,
update-contract, and provenance checks passed 20 tests. Distribution checks passed
409 tests with one skip; final installation/package and delivery-update checks
passed 18 tests. Generated files and fresh-extraction package smoke also passed.
A selected notifier run passed 20 tests and could not complete one existing
active-claim test because Windows denied the required symbolic-link creation.
The same failure is recorded for 3.2.0.1.0. The full suite and external model
attack evaluation were not rerun for this instruction patch.

Reproduce the relevant checks from the repository root with a compatible Node
runtime and Chrome available:

```text
node scripts/run-tests.mjs --require-files test/security-boundaries-browser.test.mjs test/update-contract.test.mjs
```

Set `ARCHIFY_CHROME` to Chrome's executable path to include the real-browser test.
Additional notifier cases in `test/update-notifier.test.mjs` cover untrusted
manifests, redirects, bounded responses, and reminder preferences. Some cache
filesystem tests require operating-system support for symbolic links; an
unavailable platform case is a coverage limit, not a passing result.
