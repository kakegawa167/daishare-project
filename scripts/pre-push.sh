#!/bin/sh
# push前にシークレット漏洩をスキャンする（gitleaks使用）
# インストール: brew install gitleaks
# セットアップ: cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"

if ! command -v gitleaks > /dev/null 2>&1; then
  echo "⚠️  gitleaks がインストールされていません。"
  echo "   brew install gitleaks を実行してください。"
  exit 1
fi

echo "🔍 シークレットスキャン中..."

if gitleaks detect --source "$REPO_ROOT" --no-git --config "$REPO_ROOT/.gitleaks.toml" 2>/dev/null; then
  echo "✅ シークレットは検出されませんでした。push を続行します。"
  exit 0
else
  echo ""
  echo "🚨 シークレットが検出されました！push をブロックします。"
  echo "   上記のファイルを確認し、.gitignore に追加するか内容を削除してください。"
  exit 1
fi
