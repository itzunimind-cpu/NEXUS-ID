import { supabaseAdmin } from "./_supabaseAdmin.js";
import { setSession, clearSession } from "./_session.js";
import { notifyToOfApplication } from "./_registrations.js";
import { findMyPlayer, registerMyPlayer, profileUrl } from "./_players.js";

// The public side of the bot — no TO account needed:
// Find a TO → their open tournaments → Apply → My registrations.
// Whoever applies must have their own Nexus ID (created here from their IGN
// + UID if they don't) and is always player #1; teammates' UIDs are optional.
//
// Session state:
//   { flow: "find" }                                   waiting for a search query
//   { flow: "apply", tournamentId, step: "me" }        waiting for the applicant's IGN + UID
//   { flow: "apply", tournamentId, step: "team", me }  waiting for a team name
//   { flow: "apply", tournamentId, step: "players", me, teamName }
//   { flow: "apply", tournamentId, step: "confirm", me, teamName, players }
// `me` = { playerId, nxId, ign, uid }.

const CANCEL_BUTTON = { text: "Cancel", data: "cancel" };
const TEAM_SIZE_LABEL = { 1: "Solo", 2: "Duo", 4: "Squad" };
// One player line: "IGN - UID", "IGN UID", "IGN, UID", "IGN: UID"...
const PLAYER_LINE = /^\s*(.+?)[\s,:;|\-–—]+(\d{6,15})\s*$/;

// Substitutes allowed on top of the team size.
function playerLimits(teamSize) {
  if (teamSize === 1) return { min: 1, max: 1 };
  return { min: teamSize, max: teamSize + (teamSize === 4 ? 2 : 1) };
}

function describeTournament(t) {
  const lines = [`🏆 ${t.name}`, `${TEAM_SIZE_LABEL[t.team_size] || "Squad"} · ${t.game}`];
  if (t.start_date) lines.push(`Starts: ${t.start_date}`);
  if (t.prize_pool) lines.push(`Prize pool: ₹${Number(t.prize_pool).toLocaleString("en-IN")}`);
  return lines.join("\n");
}

export async function startFind({ telegramUserId, reply }) {
  await setSession(telegramUserId, { flow: "find" });
  await reply("Type the organiser's name, or their TO ID (like TO-AB12CD3).", { buttons: [[CANCEL_BUTTON]] });
}

export async function handleFindQuery({ telegramUserId, text, reply }) {
  // Only letters, digits, spaces, _ and - reach the query — this text is
  // interpolated into a PostgREST filter string below.
  const query = (text || "").replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 40);
  if (query.length < 2) {
    await reply("Type at least 2 letters of the organiser's name, or their TO ID.", { buttons: [[CANCEL_BUTTON]] });
    return;
  }
  const { data: tos } = await supabaseAdmin
    .from("nexus_tos")
    .select("id, to_id, organisation_name")
    .or(`organisation_name.ilike.%${query}%,to_id.eq.${query.toUpperCase()}`)
    .order("organisation_name")
    .limit(8);

  if (!tos?.length) {
    await reply(`No organiser found for "${query}". Try another spelling, or ask them for their TO ID.`, { buttons: [[CANCEL_BUTTON]] });
    return;
  }
  await clearSession(telegramUserId);
  await reply("Pick the organiser:", {
    buttons: [...tos.map((t) => [{ text: `${t.organisation_name} (${t.to_id})`, data: `to:${t.id}` }]), [{ text: "Back", data: "menu" }]],
  });
}

export async function showOrganiser({ toDbId, reply }) {
  const { data: to } = await supabaseAdmin
    .from("nexus_tos")
    .select("id, to_id, organisation_name")
    .eq("id", toDbId)
    .maybeSingle();
  if (!to) {
    await reply("That organiser wasn't found.", { buttons: [[{ text: "Back", data: "menu" }]] });
    return;
  }
  const { data: tournaments } = await supabaseAdmin
    .from("nexus_tournaments")
    .select("id, name, team_size")
    .eq("created_by_to_id", to.id)
    .eq("registrations_open", true)
    .neq("status", "concluded")
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(10);

  if (!tournaments?.length) {
    await reply(`${to.organisation_name} (${to.to_id}) has no tournaments open for registration right now.`, {
      buttons: [[{ text: "Search again", data: "find" }], [{ text: "Back", data: "menu" }]],
    });
    return;
  }
  await reply(`${to.organisation_name} (${to.to_id}) — open for registration:`, {
    buttons: [
      ...tournaments.map((t) => [{ text: `${t.name} · ${TEAM_SIZE_LABEL[t.team_size] || "Squad"}`, data: `t:${t.id}` }]),
      [{ text: "Back", data: "menu" }],
    ],
  });
}

async function fetchOpenTournament(tournamentId) {
  const { data } = await supabaseAdmin
    .from("nexus_tournaments")
    .select("id, name, game, team_size, start_date, prize_pool, status, registrations_open, created_by_to_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!data || !data.registrations_open || data.status === "concluded") return null;
  return data;
}

export async function showTournament({ tournamentId, reply }) {
  const t = await fetchOpenTournament(tournamentId);
  if (!t) {
    await reply("Registrations for this tournament are closed.", { buttons: [[{ text: "Back", data: "menu" }]] });
    return;
  }
  const { min, max } = playerLimits(t.team_size);
  const size = min === max ? `${min} player${min === 1 ? "" : "s"}` : `${min}–${max} players (incl. subs)`;
  await reply(`${describeTournament(t)}\nEntry: ${size}`, {
    buttons: [[{ text: "✍️ Apply", data: `ap:${t.id}` }], [{ text: "Back", data: `to:${t.created_by_to_id}` }]],
  });
}

export async function startApply({ telegramUserId, tournamentId, reply }) {
  const t = await fetchOpenTournament(tournamentId);
  if (!t) {
    await reply("Registrations for this tournament are closed.", { buttons: [[{ text: "Back", data: "menu" }]] });
    return;
  }
  const { data: existing } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .select("team_name, status")
    .eq("tournament_id", t.id)
    .eq("applicant_telegram_user_id", telegramUserId)
    .neq("status", "rejected")
    .maybeSingle();
  if (existing) {
    await reply(`You already applied to ${t.name} as ${existing.team_name} (${existing.status}).`, {
      buttons: [[{ text: "📋 My registrations", data: "myreg" }]],
    });
    return;
  }

  const me = await findMyPlayer(telegramUserId, t.game);
  if (!me) {
    await setSession(telegramUserId, { flow: "apply", tournamentId: t.id, step: "me" });
    await reply(
      `Applying to ${t.name}.\n\nFirst, your own player ID. Send your in-game name and ${t.game} UID, like:\nMortal - 5123456789\n\nThis creates your Nexus ID, so your results are saved to your profile. You'll be player 1 on your team.`,
      { buttons: [[CANCEL_BUTTON]] }
    );
    return;
  }
  await reply(`Applying to ${t.name} as ${me.ign} (${me.nxId}).`);
  return askForTeam({ telegramUserId, t, me, reply });
}

// After the applicant's own Nexus ID is known: solo goes straight to the
// confirm screen, teams are asked for a name.
async function askForTeam({ telegramUserId, t, me, reply }) {
  if (t.team_size === 1) {
    return showConfirm({ telegramUserId, t, state: { flow: "apply", tournamentId: t.id, me }, teamName: me.ign, players: [meAsPlayer(me)], reply });
  }
  await setSession(telegramUserId, { flow: "apply", tournamentId: t.id, step: "team", me });
  await reply("What's your team name?", { buttons: [[CANCEL_BUTTON]] });
  return false;
}

function meAsPlayer(me) {
  return { ign: me.ign, uid: me.uid, isMe: true };
}

function playersPrompt(teamSize) {
  const { min, max } = playerLimits(teamSize);
  const lo = min - 1;
  const hi = max - 1;
  const count = lo === hi ? `${lo} teammate${lo === 1 ? "" : "s"}` : `${lo} to ${hi} teammates (subs included)`;
  return `You're player 1. Send your ${count}, one per line — in-game name, then UID:\n\nScout - 5234567890\nViper\n\nThe UID is optional (like Viper above), but without it that player's results aren't saved to their history.`;
}

// One line → { ign, uid } (uid null for a name-only player), or null if
// unreadable. A bare number is rejected: it's a UID with no name.
function parsePlayerLine(line) {
  const m = line.match(PLAYER_LINE);
  if (m) {
    const ign = m[1].trim();
    return ign.length <= 40 ? { ign, uid: m[2] } : null;
  }
  if (/^\d+$/.test(line) || line.length > 40) return null;
  return { ign: line, uid: null };
}

function rosterText(players) {
  return players
    .map((p, i) => `${i + 1}. ${p.ign} — ${p.uid ?? "no UID (no history)"}${p.isMe ? " (you)" : ""}`)
    .join("\n");
}

async function showConfirm({ telegramUserId, t, state, teamName, players, reply }) {
  await setSession(telegramUserId, { ...state, step: "confirm", teamName, players });
  await reply(`Check your application for ${t.name}:\n\n${t.team_size === 1 ? "" : `Team: ${teamName}\n`}${rosterText(players)}`, {
    buttons: [[{ text: "✅ Submit", data: "ap_ok" }, { text: "✏️ Start over", data: `ap:${t.id}` }], [CANCEL_BUTTON]],
  });
  return false;
}

export async function continueApply({ telegramUserId, state, text, data, reply }) {
  const t = await fetchOpenTournament(state.tournamentId);
  if (!t) {
    await clearSession(telegramUserId);
    await reply("Registrations for this tournament just closed.");
    return true;
  }

  if (state.step === "me") {
    const parsed = parsePlayerLine((text || "").trim());
    if (!parsed?.uid) {
      await reply(`Send your in-game name and ${t.game} UID on one line, like:\nMortal - 5123456789\n\nYour own UID is required — it's what your Nexus ID is built on.`, {
        buttons: [[CANCEL_BUTTON]],
      });
      return false;
    }
    const result = await registerMyPlayer({ telegramUserId, game: t.game, ign: parsed.ign, uid: parsed.uid });
    if (!result.ok) {
      await reply(result.message, { buttons: [[CANCEL_BUTTON]] });
      return false;
    }
    const { me } = result;
    await reply(
      result.created
        ? `🪪 Your Nexus ID is ${me.nxId}. Your tournament results will build up here:\n${profileUrl(me.nxId)}`
        : `🪪 Found your Nexus ID: ${me.nxId} (${me.ign}).`
    );
    return askForTeam({ telegramUserId, t, me, reply });
  }

  if (state.step === "team") {
    const teamName = (text || "").trim();
    if (!teamName || teamName.length > 60) {
      await reply("Send your team name (up to 60 characters).", { buttons: [[CANCEL_BUTTON]] });
      return false;
    }
    await setSession(telegramUserId, { ...state, step: "players", teamName });
    await reply(playersPrompt(t.team_size), { buttons: [[CANCEL_BUTTON]] });
    return false;
  }

  if (state.step === "players") {
    const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const teammates = [];
    const bad = [];
    for (const line of lines) {
      const player = parsePlayerLine(line);
      if (player) teammates.push(player);
      else bad.push(line);
    }
    const players = [meAsPlayer(state.me), ...teammates];
    const { min, max } = playerLimits(t.team_size);
    const withUid = players.filter((p) => p.uid);
    const names = new Set(players.map((p) => p.ign.toLowerCase()));
    let problem = null;
    if (bad.length) problem = `I couldn't read: "${bad[0]}". Each line needs a name (up to 40 characters), optionally followed by a UID.`;
    else if (players.length < min || players.length > max) {
      problem = `You need ${min - 1 === max - 1 ? min - 1 : `${min - 1} to ${max - 1}`} teammates — you sent ${teammates.length}.`;
    } else if (new Set(withUid.map((p) => p.uid)).size !== withUid.length) problem = "The same UID appears twice (yours is already player 1).";
    else if (names.size !== players.length) problem = "The same player name appears twice (you're already player 1).";
    if (problem) {
      await reply(`${problem}\n\n${playersPrompt(t.team_size)}`, { buttons: [[CANCEL_BUTTON]] });
      return false;
    }
    return showConfirm({ telegramUserId, t, state, teamName: state.teamName, players, reply });
  }

  if (state.step === "confirm" && data === "ap_ok") {
    await clearSession(telegramUserId);
    return submitApplication({ telegramUserId, tournament: t, teamName: state.teamName, players: state.players, reply });
  }

  await reply("Tap Submit to send your application, or Start over.");
  return false;
}

async function submitApplication({ telegramUserId, tournament, teamName, players, reply }) {
  // Only players with a UID can be checked or linked — name-only players
  // can't be told apart from anyone else with the same name.
  const uids = players.map((p) => p.uid).filter(Boolean);
  let playerIdByUid = new Map();
  if (uids.length) {
    const { data: taken } = await supabaseAdmin
      .from("nexus_tournament_registration_members")
      .select("player_ign, player_uid")
      .eq("tournament_id", tournament.id)
      .in("player_uid", uids)
      .is("removed_at", null);
    if (taken?.length) {
      await reply(`${taken[0].player_ign} (UID ${taken[0].player_uid}) is already on another team in this tournament. Apply again without them.`, {
        buttons: [[{ text: "Try again", data: `ap:${tournament.id}` }]],
      });
      return true;
    }

    // Existing Nexus IDs for these UIDs, so their history links up straight away.
    const { data: accounts } = await supabaseAdmin
      .from("nexus_player_game_accounts")
      .select("player_id, in_game_uid")
      .eq("game", tournament.game)
      .in("in_game_uid", uids);
    playerIdByUid = new Map((accounts || []).map((a) => [a.in_game_uid, a.player_id]));
  }

  const { data: registration, error } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .insert({
      tournament_id: tournament.id,
      team_name: teamName,
      registered_via: "telegram",
      applicant_telegram_user_id: telegramUserId,
    })
    .select("id")
    .single();
  if (error) {
    await reply(`Couldn't submit — the team name "${teamName}" may already be taken in this tournament, or you've already applied.`, {
      buttons: [[{ text: "Try again", data: `ap:${tournament.id}` }]],
    });
    return true;
  }

  const { error: membersError } = await supabaseAdmin.from("nexus_tournament_registration_members").insert(
    players.map((p) => ({
      registration_id: registration.id,
      tournament_id: tournament.id,
      player_ign: p.ign,
      player_uid: p.uid,
      player_id: playerIdByUid.get(p.uid) ?? null,
    }))
  );
  if (membersError) {
    // Most likely a player joined another team in the same moment — undo.
    await supabaseAdmin.from("nexus_tournament_registrations").delete().eq("id", registration.id);
    await reply("One of these players was just registered on another team. Check with your players and try again.", {
      buttons: [[{ text: "Try again", data: `ap:${tournament.id}` }]],
    });
    return true;
  }

  await notifyToOfApplication({ tournament, teamName, playerCount: players.length });
  const linked = players.filter((p) => p.uid && playerIdByUid.has(p.uid)).length;
  const nameOnly = players.filter((p) => !p.uid).length;
  await reply(
    `📨 Application sent to the organiser of ${tournament.name}. You'll get a message here when they approve it.` +
      (linked ? `\n\n${linked} player${linked === 1 ? " has" : "s have"} a Nexus ID — this tournament will show on their profile.` : "") +
      (nameOnly ? `\n\n${nameOnly} player${nameOnly === 1 ? " has" : "s have"} no UID, so their results won't be saved to any history.` : "")
  );
  return true;
}

export async function showMyRegistrations({ telegramUserId, reply }) {
  const { data: rows } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .select("team_name, status, created_at, nexus_tournaments (name, nexus_tos (organisation_name))")
    .eq("applicant_telegram_user_id", telegramUserId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (!rows?.length) {
    await reply("You haven't applied to any tournaments yet.", {
      buttons: [[{ text: "🔍 Find a TO", data: "find" }], [{ text: "Back", data: "menu" }]],
    });
    return;
  }
  const icon = { pending: "⏳", approved: "✅", rejected: "❌" };
  const lines = rows.map(
    (r) => `${icon[r.status]} ${r.nexus_tournaments.name} — ${r.team_name}\n    ${r.nexus_tournaments.nexus_tos.organisation_name} · ${r.status}`
  );
  await reply(`Your registrations:\n\n${lines.join("\n\n")}\n\nStandings and scores are coming next.`, {
    buttons: [[{ text: "Back", data: "menu" }]],
  });
}
