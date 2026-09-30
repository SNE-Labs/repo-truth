#!/usr/bin/env node
import { run } from "../src/cli.mjs";
process.exitCode = await run();
