#!/usr/bin/env node
import { Command } from "commander";
import { attachStubPlatformCommands } from "../src/lib/stubPlatformToolkit.js";

const program = new Command();
program.name("portal-tools").description("Portal tools (stub)").version("1.0.0");
attachStubPlatformCommands(program, "portal", "Portal");
program.parse();
