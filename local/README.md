# Local Archify

This private repository is [tt-a1i/archify](https://github.com/tt-a1i/archify) plus local
brand marks on the `local/brand-marks` branch. Keep it private: it contains the Boomi logo,
which has no published licence.

## Set up a computer

You need Git, Node.js 18 or later, and the GitHub CLI signed in to `peterbuitho`.

```bash
gh repo clone peterbuitho/archify-custom C:\GitRepos\archify
```

```bash
node C:\GitRepos\archify\local\sync-archify.mjs
```

The script adds the `upstream` remote and installs the skill to `~/.claude/skills/archify`
and `~/.agents/skills/archify`. It moves any copies already there to
`~/.archify-backups/<timestamp>/`.

## Update

Run the same `sync-archify.mjs` command on any computer. It picks up what the other computer
pushed, replays the local commits on upstream `main`, verifies, installs and pushes. If a
step fails, it installs nothing. Do not use the normal Archify update.

Run it on a second computer to get the update there. Commit local changes first, because
the script stops on uncommitted changes.

## Add a mark

Put the SVG in `archify/brand-marks/`, add the entry to `archify/brand-marks/catalog.local.json`
and record its source in both `THIRD_PARTY_NOTICES.md` files. Then run
`npm run generate:brand-marks` in `archify/` and commit.
