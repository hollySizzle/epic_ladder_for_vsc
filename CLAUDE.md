# CLAUDE.md

## リリース手順

```bash
# 1. package.jsonのversion更新
# 2. コミット後タグpush
git tag v0.x.x && git push origin main v0.x.x
```

GitHub Actionsが自動でMarketplace公開。
