# Supabase Migration

What has to move off Supabase and how the one-time cutover works. See [architecture.md](architecture.md) for the target design and decision 1 (big-bang rewrite) for why there's no incremental migration.

## Current Supabase surface (what has to be replaced)

As of October 2026:

- **Tables (19):** `accounts`, `movie`, `user_list`, `user_list_item`, `contender`, `media`, `bracket`, `bracket_round`, `bracket_item`, `bracket_match`, `bracket_vote`, `app_config`, `feature_requests`, `comments`, `comment_reactions`, `comment_reports`, `category`, `year`, `media_type`
- **RPCs (13):** `get_leaderboard`, `get_user_list_items`, `save_user_list`, `get_user_list_counts`, `get_bracket`, `delete_account`, `get_comment_page`, `get_reply_page`, `get_subtree_page`, `get_comment_count`, `smart_delete_comment`, `restore_comment`, `add_comment`
- **Auth:** email/password sign-up, sign-in, sign-out, forgot-password email, password change, auth-state stream (sign-up and reset come from the `SupaEmailAuth` widget in `lib/pages/auth/auth.page.dart`)
- **Storage:** user avatars
- **Note:** `category`, `year`, `media_type`, and `get_leaderboard` are referenced as raw strings, not through `supabase.constants.dart`.
- **Note:** the schema and RPC SQL exist only in Supabase; they are not in version control and must be exported before porting.

## Cutover plan (outline)

1. Build and deploy the API against a fresh RDS database.
2. One-time migration script copies Supabase data into RDS, including `auth.users` bcrypt password hashes so users keep their passwords.
3. Release a Flutter build pointing at the new API.
4. Raise `min_app_version` in Supabase's `app_config` so clients still on Supabase are prompted to update.
