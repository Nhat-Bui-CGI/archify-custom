# Local Archify

This private repository is [tt-a1i/archify](https://github.com/tt-a1i/archify) plus local
brand marks and the `azure-diagram` skill on the `local/brand-marks` branch. Keep it private:
it contains the Boomi logo, which has no published licence.

## Set up a computer

You need Git, Node.js 18 or later, and the GitHub CLI signed in to `peterbuitho`.

```bash
gh repo clone peterbuitho/archify-custom C:\GitRepos\archify
```

```bash
node C:\GitRepos\archify\local\sync-archify.mjs
```

The script adds the `upstream` remote and installs both skills, `archify` and `azure-diagram`,
to `~/.claude/skills/` and `~/.agents/skills/`. It moves any copies already there to
`~/.archify-backups/<timestamp>/<skill>/`, in a `claude` or `codex` subfolder.

## Update

Run the same `sync-archify.mjs` command on any computer. It picks up what the other computer
pushed, replays the local commits on upstream `main`, verifies, installs and pushes. If a
check fails for either skill, it installs nothing. Do not use the normal Archify update.

On Windows, a running Codex or Claude can lock a skill folder for a moment. The script retries
for up to 20 seconds. If the folder stays locked, it stops without pushing and some copies can
be new and others old. Close Codex and Claude, then run the same command again.

Run it on a second computer to get the update there. Commit local changes first, because
the script stops on uncommitted changes.

## Add a mark

Put the SVG in `archify/brand-marks/`, add the entry to `archify/brand-marks/catalog.local.json`
and record its source in both `THIRD_PARTY_NOTICES.md` files. Then run
`npm run generate:brand-marks` in `archify/` and commit.

The new mark also reaches `azure-diagram`: the sync builds that skill's icons from the same
catalog.

## Update the Azure icon set

`azure-diagram/azure-icons/` holds Microsoft's Azure icon download, unaltered. Keep this
repository private, because Microsoft allows redistribution only for diagrams, training
materials and documentation.

Download the new set from <https://learn.microsoft.com/azure/architecture/icons>. Replace the
category folders and `Microsoft_Terms_of_Use.pdf`, change `AZURE_SET` in
`azure-diagram/scripts/build-icons.mjs`, commit and run the sync.

## Azure diagram skill

`azure-diagram/` creates static Azure Architecture Center style diagrams. Its built `icons/`
folder is not in Git. The sync copies the skill to a stage, builds `icons/` from
`archify/brand-marks` and `azure-icons/`, runs its tests and renders its example. To work on it
in the repo:

```bash
node azure-diagram/scripts/build-icons.mjs
```

```bash
node --test azure-diagram/test/azure-diagram.test.mjs
```

The usage is in `azure-diagram/SKILL.md`.
