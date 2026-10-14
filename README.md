# emnul.dev

## Working with Claude Code

Launch Claude with `omni claude`, not `claude`. Omnigent's policies let Claude commit locally but deny direct `git push` and other commands that would publish to or rewrite the remote (ADR 0006). Until the GitHub remote exists, a push wrapped in `bash -c` or `eval` may only prompt for approval, so decline it. The author pushes and opens PRs.

The policies can't live in this repo: `omni claude` starts its local server with `--config ~/.omnigent/config.yaml`, and only that file's `policies:` block is read. Add this to `~/.omnigent/config.yaml` (it applies to every project you run with `omni claude`):

```yaml
policies:
  blast_radius:
    type: function
    handler: omnigent.policies.builtins.orchestration.blast_radius
    factory_params:
      risky_action: DENY
  github:
    type: function
    handler: omnigent.policies.builtins.github.github_policy
```

The running server doesn't reload policies, so run `omni server stop` after editing, then `omni claude`.
