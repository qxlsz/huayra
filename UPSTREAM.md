# Upstream Huayra

Source of the desktop app and the feature list:

- https://code.zanneth.com/zanneth/huayra
- git clone https://code.zanneth.com/zanneth/huayra.git

Created by Charles Magahern ([@zanneth](https://x.com/zanneth)). MIT.

## Pins (fetched 2026-09-16)

| Ref | SHA |
| --- | --- |
| master | `436fdf2bf1b33cba9c649c7e035484015ec9a0c1` |
| latest message | fix(desktop-huayra): keep launch wave amplitude consistent |
| opencode-v2 | `cc60c6b978f787b06dcdc342fcfc6e2eb03d7600` |
| commit count on master | 108 |

This GitHub repo (`qxlsz/huayra`) is a separate web host of that console.
It does not share git objects with the Gitea history. Do not rewrite `main`
to look like the CEF tree. That would drop the hosted ADE and break npm CI.

## Import every source commit without deleting ours

Run this on a machine that can push to GitHub:

```sh
git clone https://github.com/qxlsz/huayra.git
cd huayra
git remote add zanneth https://code.zanneth.com/zanneth/huayra.git
git fetch zanneth --tags
git push origin zanneth/master:refs/heads/upstream
git push origin zanneth/opencode-v2:refs/heads/upstream-opencode-v2
```

That copies all 108 original commits onto GitHub as branch `upstream`.
`main` stays intact. Merge only if you want both histories in one branch.
The trees conflict (CEF + CMake vs Node playground).

## What source looks like

CEF + vanilla TypeScript + C++ on Linux. Bun, CMake, Ninja, GTK 3, HIDAPI.
No GitHub Actions on the forge.
