import { supabaseAdmin } from "./_supabaseAdmin.js";
import { setSession, clearSession } from "./_session.js";
import { notifyToOfApplication } from "./_registrations.js";

// The public side of the bot — no Nexus ID or TO account needed:
// Find a TO → their open tournaments → Apply → My registrations.
//
// Session state:
//   { flow: "find" }                                   waiting for a search query
//   { flow: "apply", tournamentId, step: "team" }      waiting for a team name
//   { flow: "apply", tournamentId, step: "players", teamName }
//   { flow: "apply", tournamentId, step: "confirm", teamName, players }

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

  if (t.team_size === 1) {
    await setSession(telegramUserId, { flow: "apply", tournamentId: t.id, step: "players" });
    await reply(`Applying to ${t.name} (solo).\n\nSend your in-game name and BGMI UID, like:\nMortal - 5123456789`, {
      buttons: [[CANCEL_BUTTON]],
    });
    return;
  }
  await setSession(telegramUserId, { flow: "apply", tournamentId: t.id, step: "team" });
  await reply(`Applying to ${t.name}.\n\nWhat's your team name?`, { buttons: [[CANCEL_BUTTON]] });
}

function playersPrompt(teamSize) {
  const { min, max } = playerLimits(teamSize);
  const count = min === max ? `${min}` : `${min} to ${max} (subs included)`;
  return `Send your ${count} players, one per line — in-game name, then BGMI UID:\n\nMortal - 5123456789\nScout - 5234567890\n\nPlayers don't need a Nexus ID.`;
}

export async function continueApply({ telegramUserId, state, text, data, reply }) {
  const t = await fetchOpenTournament(state.tournamentId);
  if (!t) {
    await clearSession(telegramUserId);
    await reply("Registrations for this tournament just closed.");
    return true;
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
    const players = [];
    const bad = [];
    for (const line of lines) {
      const m = line.match(PLAYER_LINE);
      if (m && m[1].trim().length <= 40) players.push({ ign: m[1].trim(), uid: m[2] });
      else bad.push(line);
    }
    const { min, max } = playerLimits(t.team_size);
    const uids = new Set(players.map((p) => p.uid));
    let problem = null;
    if (bad.length) problem = `I couldn't read: "${bad[0]}". Each line needs a name, then a UID (numbers only).`;
    else if (players.length < min || players.length > max) problem = `This tournament needs ${min === max ? min : `${min} to ${max}`} player${max === 1 ? "" : "s"} — you sent ${players.length}.`;
    else if (uids.size !== players.length) problem = "The same UID appears twice.";
    if (problem) {
      await reply(`${problem}\n\n${playersPrompt(t.team_size)}`, { buttons: [[CANCEL_BUTTON]] });
      return false;
    }

    const teamName = t.team_size === 1 ? players[0].ign : state.teamName;
    await setSession(telegramUserId, { ...state, step: "confirm", teamName, players });
    const roster = players.map((p, i) => `${i + 1}. ${p.ign} — ${p.uid}`).join("\n");
    await reply(`Check your application for ${t.name}:\n\n${t.team_size === 1 ? "" : `Team: ${teamName}\n`}${roster}`, {
      buttons: [[{ text: "✅ Submit", data: "ap_ok" }, { text: "✏️ Start over", data: `ap:${t.id}` }], [CANCEL_BUTTON]],
    });
    return false;
  }

  if (state.step === "confirm" && data === "ap_ok") {
    await clearSession(telegramUserId);
    return submitApplication({ telegramUserId, tournament: t, teamName: state.teamName, players: state.players, reply });
  }

  await reply("Tap Submit to send your application, or Start over.");
  return false;
}

async function submitApplication({ telegramUserId, tournament, teamName, players, reply }) {
  const uids = players.map((p) => p.uid);
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
  const playerIdByUid = new Map((accounts || []).map((a) => [a.in_game_uid, a.player_id]));

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
  const linked = players.filter((p) => playerIdByUid.has(p.uid)).length;
  await reply(
    `📨 Application sent to the organiser of ${tournament.name}. You'll get a message here when they approve it.` +
      (linked ? `\n\n${linked} player${linked === 1 ? " has" : "s have"} a Nexus ID — this tournament will show on their profile.` : "")
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
