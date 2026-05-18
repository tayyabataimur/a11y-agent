# Loop11y GitHub Action

Run accessibility audits on URLs or repos in CI. Posts results as PR comments. Optional score threshold gates the job.

## Usage

### Audit a URL

```yaml
name: a11y
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: tayyabataimur/loop11y/action@v1
        with:
          url: https://example.com
          fail-under: 80
```

### Audit a repo

```yaml
name: a11y
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tayyabataimur/loop11y/action@v1
        with:
          repo-path: ./src
          max-files: 50
          fail-under: 70
```

## Inputs

| Name | Default | Description |
|------|---------|-------------|
| `url` | — | URL to audit. Omit for repo mode. |
| `repo-path` | `.` | Path to scan in repo mode. |
| `max-files` | `50` | Max files to scan. |
| `fail-under` | `0` | Fail job if score below threshold (0 disables). |
| `comment-on-pr` | `true` | Post markdown report on PR. |
| `github-token` | `${{ github.token }}` | Token for PR comment. |

## Outputs

| Name | Description |
|------|-------------|
| `score` | Numeric score 0–100 |
| `grade` | Letter grade A–F |
| `report-path` | JSON report on runner |

## Pinning

The action builds loop11y from the ref the consumer specifies in `uses:`. There is no `loop11y@latest` install — the version that runs is exactly the git ref pinned in the workflow.

**Recommended** (immutable SHA):
```yaml
- uses: tayyabataimur/loop11y/action@<full-commit-sha>
```

**Acceptable** (mutable tag, scoped to a major version):
```yaml
- uses: tayyabataimur/loop11y/action@v1
```

**Not recommended**:
```yaml
- uses: tayyabataimur/loop11y/action@main   # floats, breaks reproducibility
```

## Publishing

Tag this repo `v1` (and `v1.x.y`) so consumers can pin `tayyabataimur/loop11y@v1`.

```sh
git tag -a v1 -m "Release v1"
git push origin v1
```
