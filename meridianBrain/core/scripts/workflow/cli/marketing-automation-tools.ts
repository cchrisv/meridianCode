#!/usr/bin/env node
import { Command } from "commander";
import { attachStubPlatformCommands } from "../src/lib/stubPlatformToolkit.js";

const program = new Command();
program.name("marketing-automation-tools").description("SFMC tools (stub)").version("1.0.0");
attachStubPlatformCommands(program, "marketing-automation", "Marketing Automation");
program.parse();
