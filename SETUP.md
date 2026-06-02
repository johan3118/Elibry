# Elibry Agent Team — Setup

## 1. Install

Copy the `.claude/` folder and `CLAUDE.md` into your Elibry project root.
Your tree should look like:

    Elibry/
      CLAUDE.md
      .claude/
        agents/
          product.md
          architect.md
          lead.md
          senior-dev.md
          junior-dev.md
          qa.md
        commands/
          sprint.md
      (your existing src/, etc.)

## 2. Fix the placeholders

Open CLAUDE.md and confirm the stack section + the test/lint/typecheck
commands match your actual project (e.g. `npm run typecheck`, `npm run lint`,
`npm test`). The agents will run whatever you put there.

## 3. Restart Claude Code

Agents added as files load at session start. Restart, then run `/agents` to
confirm all six appear in the Library tab.

## 4. Run a sprint

    /sprint Persist Automations, WhatsApp Automation, and Alerts to Supabase

The pipeline stops at the spec for your approval, then runs the build/QA loop
on its own and only comes back at a real fork or at the end.

## Pro-plan notes

- Run sprints sequentially. Don't fire multiple agents in parallel — on Pro
  you'll hit rate limits in ~20 minutes.
- Subagents on Pro can't message each other; the main session (the /sprint
  orchestrator) is the coordinator. True peer-to-peer agent chatter and
  parallel sprints are a Max / Agent Teams feature.
- Default model is Sonnet everywhere except junior-dev (Haiku). For a genuinely
  hard architecture task, manually rerun the architect on Opus for that plan
  only — Opus burns Pro quota fast, so don't make it the default.
