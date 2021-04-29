# Deck OSS Builder

This repo contains a GitHub action for building Spinnaker OSS Deck. It steals
from [oss-spinnaker-deck-bom](https://github.com/armory-io/oss-spinnaker-deck-bom) but

1. Is a GitHub action
1. Is meant to be used with Astrolabe to build per-commit NPM packages from
   Deck

## Running locally

You can run the build locally using the CLI:

```
npx ts-node src/cli.ts <options>
```

The CLI depends on the [JFrog CLI](https://jfrog.com/getcli/).
