#!/usr/bin/env node
import { Command } from "commander";
import { attachStubPlatformCommands } from "../src/lib/stubPlatformToolkit.js";

const program = new Command();
program.name("contact-center-tools").description("Contact center tools (stub)").version("1.0.0");
attachStubPlatformCommands(program, "contact-center", "Contact Center");
program.parse();
