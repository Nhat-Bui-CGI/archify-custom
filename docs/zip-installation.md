# Install or update Archify Custom from ZIP

Archify Custom is based on the original [Archify by tt-a1i](https://github.com/tt-a1i/archify), with additional official Microsoft Azure icons. This guide covers manual ZIP installations of the Skill.

For the ChatGPT app's uploaded-Skill workflow, use [ChatGPT setup and compatibility](chatgpt.md). Its account permissions and execution environment differ from a local filesystem installation.

## Let your harness do it

Copy one of these prompts into the harness where you want to use Archify:

- [Install Archify Custom](prompts/install-archify.md)
- [Update an existing installation](prompts/update-archify.md)

Both prompts discover the newest published release with an `archify.zip` asset,
including custom prereleases. They contain no fixed version, tag, or checksum.
The harness selects one release, checks its requirements, and verifies the
installed icons. An update also preserves a backup and restores it on failure.
You do not need to follow the manual steps below when using a prompt.

## Download the package

Open [this fork's releases](https://github.com/Nhat-Bui-CGI/archify-custom/releases), select the custom build you want, and download **archify.zip** under **Assets**. Custom builds can be marked as prereleases, so use the releases list rather than relying on GitHub's latest-release shortcut.

The first Azure icon build is [custom-3.2.0-azure-icons.1](https://github.com/Nhat-Bui-CGI/archify-custom/releases/tag/custom-3.2.0-azure-icons.1). Its [archify.zip asset](https://github.com/Nhat-Bui-CGI/archify-custom/releases/download/custom-3.2.0-azure-icons.1/archify.zip) has SHA-256:

```text
565c14d7caec4fa222cea98b9206a160f36339a354ab453b54123444fc49dec1
```

This checksum applies only to that release. GitHub also provides **Source code (zip)** and **Source code (tar.gz)**; those are full repository snapshots, not the packaged Skill.

## Install for the first time

1. Install Node.js 18 or later if it is not available. Run `node --version` to check. The packaged Skill includes its runtime dependencies; you do not need to run `npm install`.
2. Extract `archify.zip` into a temporary folder. It contains an `archify` folder with `SKILL.md`, `bin`, `assets`, `renderers`, and other supporting files.
3. Choose the Skill location your agent uses. For a user installation, use the first path below. For a project installation, use the second path relative to the project root.

   | Agent | User installation | Project installation |
   | --- | --- | --- |
   | Codex | `~/.agents/skills/archify/` | `.agents/skills/archify/` |
   | Claude Code | `~/.claude/skills/archify/` | `.claude/skills/archify/` |
   | OpenCode | `~/.config/opencode/skills/archify/` | `.opencode/skills/archify/` |

   On Windows, `~` means your user folder, for example `C:\Users\YourName`. On macOS and Linux it means your home directory.

4. Copy the complete extracted `archify` folder into the selected `skills` directory. The result must be `skills/archify/SKILL.md`, not `skills/archify/archify/SKILL.md`. If an `archify` installation already exists there, follow the update procedure instead.
5. Start a new agent session. Follow the verification steps below.

For a tool that accepts uploaded Skill ZIPs, upload the **archify.zip** asset through that tool's Skill management interface instead of extracting it into a local directory. For an update, use its replacement flow and check that the previous copy is no longer active. Node.js availability in that tool determines whether it can run the renderers.

## Update an existing ZIP installation

1. Find the `archify` folder your agent currently loads. Ask the agent to report the absolute path to its active `archify/SKILL.md`, or inspect its Skill configuration. Reuse that location even if it differs from the example paths above. Check both user and project locations if more than one copy exists.
2. Finish active Archify work and stop any running preview for that installation.
3. Copy the entire existing `archify` folder to a backup location outside all Skill discovery directories, such as a dated folder under Documents. Record the original installation path. Keep custom icons, edited instructions, and any diagrams saved inside the installation in this backup.
4. Download the new **archify.zip** from this fork's releases and extract it into a temporary folder. Check that `archify/SKILL.md` and `archify/bin/archify.mjs` are present.
5. After checking the backup, move the old installed `archify` folder out of the Skill directory. Copy the new extracted `archify` folder into the exact original location. Replace the complete package so obsolete files do not remain mixed with the new release.
6. Compare your custom additions with the backup before restoring them. Restore your own separate files or merge intentional edits individually; copying old renderers, generated bundles, or the complete old package over the new one would undo the update. Keep your diagram files outside the Skill installation for future work.
7. Start a new agent session. Follow the verification steps below and confirm that the agent loads the intended path.

If verification fails, stop using that copy, move it outside the Skill directories, and restore the complete backup to its original path. Start a new session and verify the restored installation.

## Verify the installation

Open a terminal **inside the installed `archify` folder**, then run:

```text
node bin/archify.mjs brands azure-openai --json
node bin/archify.mjs brands container-apps --json
node bin/archify.mjs brands microsoft --json
```

Each command should finish successfully with `ok: true`. The first two results should include the IDs `azure-openai` and `container-apps`; the last command lists the Microsoft catalogue. This confirms that the installed files contain the custom additions. It does not by itself prove which copy an agent loads, so also confirm its active Skill path in the new session.

The package version remains `3.2.0`, so version output alone does not identify this custom build. Keep the downloaded ZIP and its release tag if you need to identify the exact package later.

## Get future updates from this fork

Use [Nhat-Bui-CGI/archify-custom releases](https://github.com/Nhat-Bui-CGI/archify-custom/releases) for subsequent custom packages and repeat the update procedure. You can subscribe to the repository's release notifications.

This build retains the original Archify update metadata. Its built-in reminders refer to upstream releases; they do not track this fork's custom releases and never install updates automatically. Installing an upstream ZIP or using an upstream install command can replace the custom additions. The upstream installation examples elsewhere in the README describe the original project; follow this guide to retain this fork's icons.

Microsoft owns its icon artwork, which remains subject to the terms in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). The AX 2012 entry still uses the documented Dynamics 365 icon fallback in this release.
