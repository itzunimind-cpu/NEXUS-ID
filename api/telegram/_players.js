import { supabaseAdmin, SITE_URL } from "./_supabaseAdmin.js";

// A Telegram user's own Nexus ID (0010_self_registered_players.sql). Anyone
// applying to a tournament from the bot must have one — they're always
// player #1 on their roster.

export function profileUrl(nxId) {
  return `${SITE_URL}/player.html?id=${encodeURIComponent(nxId)}`;
}

async function linkedPlayerId(telegramUserId) {
  const { data } = await supabaseAdmin
    .from("nexus_player_telegram_links")
    .select("player_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  return data?.player_id ?? null;
}

async function fetchPlayer(playerId, game) {
  const { data: player } = await supabaseAdmin
    .from("nexus_players")
    .select("id, nx_id")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) return null;
  const { data: account } = await supabaseAdmin
    .from("nexus_player_game_accounts")
    .select("in_game_uid, in_game_name")
    .eq("player_id", playerId)
    .eq("game", game)
    .maybeSingle();
  return { player, account };
}

// { playerId, nxId, ign, uid } if this Telegram account has a Nexus ID with
// an account for `game`; otherwise null (the caller asks for IGN + UID).
export async function findMyPlayer(telegramUserId, game) {
  const playerId = await linkedPlayerId(telegramUserId);
  if (!playerId) return null;
  const found = await fetchPlayer(playerId, game);
  if (!found?.account) return null;
  return { playerId, nxId: found.player.nx_id, ign: found.account.in_game_name, uid: found.account.in_game_uid };
}

// Every Nexus ID game account this Telegram user has, for "My Nexus ID".
export async function describeMyPlayer(telegramUserId) {
  const playerId = await linkedPlayerId(telegramUserId);
  if (!playerId) return null;
  const { data: player } = await supabaseAdmin.from("nexus_players").select("nx_id").eq("id", playerId).maybeSingle();
  const { data: accounts } = await supabaseAdmin
    .from("nexus_player_game_accounts")
    .select("game, in_game_name, in_game_uid")
    .eq("player_id", playerId);
  return player ? { nxId: player.nx_id, accounts: accounts || [] } : null;
}

// Gives this Telegram user a Nexus ID for `game` with this IGN + UID:
//  - UID already on a Nexus ID nobody has linked → link to it (low trust,
//    same as the rest of NexusID's public identities — not a claim)
//  - UID already on a Nexus ID linked to someone else → refuse
//  - user already has a Nexus ID but no account for this game → add one
//  - otherwise → create a new Nexus ID (created_via 'telegram')
// Returns { ok: true, me, created } or { ok: false, message }.
export async function registerMyPlayer({ telegramUserId, game, ign, uid }) {
  const myPlayerId = await linkedPlayerId(telegramUserId);

  const { data: existing } = await supabaseAdmin
    .from("nexus_player_game_accounts")
    .select("player_id")
    .eq("game", game)
    .eq("in_game_uid", uid)
    .maybeSingle();

  if (existing) {
    if (myPlayerId && existing.player_id !== myPlayerId) {
      return { ok: false, message: `UID ${uid} already belongs to a different Nexus ID than yours. Check the UID and send it again.` };
    }
    if (!myPlayerId) {
      const { data: owner } = await supabaseAdmin
        .from("nexus_player_telegram_links")
        .select("telegram_user_id")
        .eq("player_id", existing.player_id)
        .maybeSingle();
      if (owner) {
        return { ok: false, message: `UID ${uid} belongs to a Nexus ID that's already connected to another Telegram account. Check the UID and send it again.` };
      }
      const { error } = await supabaseAdmin
        .from("nexus_player_telegram_links")
        .insert({ player_id: existing.player_id, telegram_user_id: telegramUserId });
      if (error) return { ok: false, message: "Couldn't connect that Nexus ID. Try again." };
    }
    return { ok: true, me: await findMyPlayer(telegramUserId, game), created: false };
  }

  let playerId = myPlayerId;
  let created = false;
  if (!playerId) {
    const { data: player, error } = await supabaseAdmin
      .from("nexus_players")
      .insert({ created_via: "telegram" })
      .select("id")
      .single();
    if (error) {
      console.error("Self-registration failed:", error);
      return { ok: false, message: "Couldn't create your Nexus ID. Try again." };
    }
    playerId = player.id;
    created = true;
  }

  const { error: accountError } = await supabaseAdmin
    .from("nexus_player_game_accounts")
    .insert({ player_id: playerId, game, in_game_uid: uid, in_game_name: ign });
  if (accountError) {
    // Someone registered this UID in the same moment — undo our new player.
    if (created) await supabaseAdmin.from("nexus_players").delete().eq("id", playerId);
    return { ok: false, message: `UID ${uid} was just registered by someone else. Check it and send it again.` };
  }

  if (created) {
    const { error: linkError } = await supabaseAdmin
      .from("nexus_player_telegram_links")
      .insert({ player_id: playerId, telegram_user_id: telegramUserId });
    if (linkError) {
      await supabaseAdmin.from("nexus_players").delete().eq("id", playerId);
      return { ok: false, message: "Couldn't create your Nexus ID. Try again." };
    }
  }

  return { ok: true, me: await findMyPlayer(telegramUserId, game), created };
}
