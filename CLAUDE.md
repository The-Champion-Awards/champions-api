# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**champions-api** is a Node.js/TypeScript backend that will replace Supabase for the Champions app. It is also a portfolio project, so favor clear, idiomatic, well-tested code that demonstrates the target stack over shortcuts.

Read these first:

- `docs/architecture.md`: target stack and the decisions log. Update it as decisions are made.
- `docs/supabase-migration.md`: the Supabase tables, RPCs, auth, and storage to replace, plus the cutover plan.
- `_plan/roadmap.md` (gitignored): week-by-week schedule and where the last session left off. Read it at the start of a session and update it at the end.

## The Flutter client

The Flutter app lives at `/Users/joeschneider/Development/champions` and is added as an additional working directory (`.claude/settings.local.json`). Its own `CLAUDE.md` is not loaded automatically; read it when you need client context.

Files that define what this API must provide:

- `lib/constants/supabase.constants.dart` — every table and RPC name the client uses
- `lib/api/*.api.dart` — one service per domain (account, app_config, bracket, category, comment, feature_request, leaderboard, user_list, user_list_count, year); each Supabase call here becomes an endpoint
- `lib/services/auth_service.dart` — sign-in/out, password change, auth-state stream
- `lib/class/` — domain models; their `fromJson` factories define the response shapes the client expects
- `lib/api/tmdb.api.dart` — TMDB integration (currently client-side)
