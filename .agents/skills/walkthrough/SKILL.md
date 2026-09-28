---
name: walkthrough
description: Generate a walkthrough artifact summarizing completed task implementation. Use when the user runs /walkthough, asks for a walkthrough, or asks for a summary/recap of changes made in the conversation so far.
disable-model-invocation: true
---

# Walkthrough

Agent creates walkthrough artifacts when it has completed task implementation; this type of artifact includes a concise summary of the changes that have been made to remind the user of what has happened in the active conversation. This is a great way to get up to speed with the state of your codebase after Agent has made its changes in case you were not strictly following it the whole time.

## Output Format Requirements

You must strictly follow the structure below based on the reference standard. Use precise file names in inline code blocks and Markdown tables for technical specs.

## Template

1. Overview
2. What Was Built
3. How to verify

## Section Guidance

**1. Overview**
1-2 sentences stating the goal of the change and the outcome. No implementation detail here.

**2. What Was Built**
Break down the changes by area/file. Use inline code for every file, function, type, and route name (e.g. `convex/features/module/module.service.ts`, `useModuleData`). For non-trivial technical specs (new fields, endpoints, props, config), use a Markdown table rather than prose.

**3. How to Verify**
Concrete, actionable steps the user can follow to confirm the change works — commands to run, routes to visit, or UI flows to click through. Prefer numbered steps.

## Rules

- Base the walkthrough only on changes actually made in this conversation; do not speculate about unrelated code.
- Keep it concise — this is a recap, not documentation.
- Do not repeat full diffs; reference file paths and summarize intent instead.
