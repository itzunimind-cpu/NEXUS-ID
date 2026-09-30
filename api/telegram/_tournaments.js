import { supabaseAdmin } from "./_supabaseAdmin.js";
import { setSession, clearSession } from "./_session.js";
import { fetchOwnedTournament, decideRegistration } from "./_registrations.js";

// The TO side of tournaments on the bot: list, create, open/close
// registrations, review applications. Every action re-checks that the
// tournament belongs to the member's TO (fetchOwnedTournament) — the
// service-role client bypasses RLS.
//
// Session state for creating: { flow: "new_tournament", step, draft }

const CANCEL_BUTTON = { text: "Cancel", data: "cancel" };
const TEAM_SIZE_LABEL = { 1: "Solo", 2: "Duo", 4: "Squad" };

export async function listMyTournaments({ member, reply }) {
  const { data: tournaments } = await supabaseAdmin
    .from("nexus_tournaments")
    .select("id, name, status, registrations_open")
    .eq("created_by_to_id", member.to_id)
    .neq("status", "concluded")
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (tournaments || []).map((t) => [
    { text: `${t.name}${t.registrations_open ? " · 🟢 open" : ""}`, data: `mt:${t.id}` },
  ]);
  rows.push([{ text: "➕ Create tournament", data: "nt" }], [{ text: "Back", data: "menu" }]);
  await reply(tournaments?.length ? "Your tournaments (concluded ones are on the website):" : "You have no running tournaments yet.", {
    buttons: rows,
  });
}

export async function showMyTournament({ member, tournamentId, reply }) {
  const t = await fetchOwnedTournament(member, tournamentId);
  if (!t) {
    await reply("That tournament isn't yours.", { buttons: [[{ text: "Back", data: "mt" }]] });
    return;
  }
  const { data: regs } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .select("status")
    .eq("tournament_id", t.id);
  const count = (s) => (regs || []).filter((r) => r.status === s).length;
  const pending = count("pending");

  await reply(
    `🏆 ${t.name}\n${TEAM_SIZE_LABEL[t.team_size] || "Squad"} · ${t.status}\nRegistrations: ${t.registrations_open ? "🟢 open" : "🔴 closed"}\n\nApproved: ${count("approved")} · Pending: ${pending} · Rejected: ${count("rejected")}`,
    {
      buttons: [
        [t.registrations_open
          ? { text: "🔴 Close registrations", data: `rg:${t.id}:0` }
          : { text: "🟢 Open registrations", data: `rg:${t.id}:1` }],
        ...(pending ? [[{ text: `📥 Review ${pending} pending`, data: `rv:${t.id}` }]] : []),
        [{ text: "Back", data: "mt" }],
      ],
    }
  );
}

export async function setRegistrationsOpen({ member, tournamentId, open, reply }) {
  const t = await fetchOwnedTournament(member, tournamentId);
  if (!t) {
    await reply("That tournament isn't yours.");
    return;
  }
  if (t.status === "concluded" && open) {
    await reply("This tournament is concluded — registrations can't be opened.");
    return;
  }
  await supabaseAdmin.from("nexus_tournaments").update({ registrations_open: open }).eq("id", t.id);
  // Best-effort, same as createTournament() on the web — gives the dormant
  // registrations_opened/closed activity types (0003) real data.
  await supabaseAdmin.from("nexus_activity_log").insert({
    to_id: member.to_id,
    tournament_id: t.id,
    event_type: open ? "registrations_opened" : "registrations_closed",
    detail: t.name,
  });
  await reply(open ? `🟢 Registrations for ${t.name} are open. Players can find it under "Find a TO".` : `🔴 Registrations for ${t.name} are closed.`);
  return showMyTournament({ member, tournamentId, reply });
}

// Shows the oldest pending application with Approve / Reject buttons.
export async function reviewNext({ member, tournamentId, reply }) {
  const t = await fetchOwnedTournament(member, tournamentId);
  if (!t) {
    await reply("That tournament isn't yours.");
    return;
  }
  const { data: regs } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .select("id, team_name, created_at")
    .eq("tournament_id", t.id)
    .eq("status", "pending")
    .order("created_at")
    .limit(1);
  const reg = regs?.[0];
  if (!reg) {
    await reply(`No pending applications for ${t.name}.`, { buttons: [[{ text: "Back", data: `mt:${t.id}` }]] });
    return;
  }
  const { data: players } = await supabaseAdmin
    .from("nexus_tournament_registration_members")
    .select("player_ign, player_uid, player_id")
    .eq("registration_id", reg.id)
    .order("id");
  const roster = (players || [])
    .map((p, i) => `${i + 1}. ${p.player_ign} — ${p.player_uid}${p.player_id ? " · Nexus ID ✓" : ""}`)
    .join("\n");
  await reply(`📥 ${t.name}\nTeam: ${reg.team_name}\n\n${roster}`, {
    buttons: [
      [{ text: "✅ Approve", data: `dc:${reg.id}:a` }, { text: "❌ Reject", data: `dc:${reg.id}:r` }],
      [{ text: "Back", data: `mt:${t.id}` }],
    ],
  });
}

export async function decideFromBot({ member, registrationId, approve, reply }) {
  const { data: reg } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .select("tournament_id")
    .eq("id", registrationId)
    .maybeSingle();
  const result = await decideRegistration({ member, registrationId, approve });
  await reply(result.ok ? (approve ? `✅ ${result.message}` : `❌ ${result.message}`) : result.message);
  if (reg) return reviewNext({ member, tournamentId: reg.tournament_id, reply });
}

// ---- Create a tournament ------------------------------------------------

export async function startNewTournament({ telegramUserId, reply }) {
  await setSession(telegramUserId, { flow: "new_tournament", step: "name", draft: {} });
  await reply("New BGMI tournament. What's it called?", { buttons: [[CANCEL_BUTTON]] });
}

// Accepts 25-12-2026, 25/12/2026 or 2026-12-25. Returns YYYY-MM-DD or null.
function parseDate(text) {
  const s = (text || "").trim();
  let y, m, d;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, y, m, d] = match;
  else if ((match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [, d, m, y] = match;
  else return null;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d) return null;
  return date.toISOString().slice(0, 10);
}

export async function continueNewTournament({ telegramUserId, member, state, text, data, reply }) {
  const draft = { ...state.draft };

  if (state.step === "name") {
    const name = (text || "").trim();
    if (!name || name.length > 80) {
      await reply("Send the tournament name (up to 80 characters).", { buttons: [[CANCEL_BUTTON]] });
      return false;
    }
    draft.name = name;
    await setSession(telegramUserId, { ...state, step: "size", draft });
    await reply("Solo, duo or squad?", {
      buttons: [[{ text: "Solo", data: "ns:1" }, { text: "Duo", data: "ns:2" }, { text: "Squad", data: "ns:4" }], [CANCEL_BUTTON]],
    });
    return false;
  }

  if (state.step === "size") {
    const size = Number((data || "").replace("ns:", ""));
    if (![1, 2, 4].includes(size)) {
      await reply("Tap Solo, Duo or Squad.");
      return false;
    }
    draft.team_size = size;
    await setSession(telegramUserId, { ...state, step: "date", draft });
    await reply("Start date? Send it like 25-12-2026, or tap Skip.", {
      buttons: [[{ text: "Skip", data: "skip" }, CANCEL_BUTTON]],
    });
    return false;
  }

  if (state.step === "date") {
    if (data !== "skip") {
      const date = parseDate(text);
      if (!date) {
        await reply("Send the date like 25-12-2026, or tap Skip.", { buttons: [[{ text: "Skip", data: "skip" }, CANCEL_BUTTON]] });
        return false;
      }
      draft.start_date = date;
    }
    await setSession(telegramUserId, { ...state, step: "prize", draft });
    await reply("Prize pool in ₹? Send a number (like 5000), or tap Skip.", {
      buttons: [[{ text: "Skip", data: "skip" }, CANCEL_BUTTON]],
    });
    return false;
  }

  if (state.step === "prize") {
    if (data !== "skip") {
      const amount = Number((text || "").replace(/[₹,\s]/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        await reply("Send a number like 5000, or tap Skip.", { buttons: [[{ text: "Skip", data: "skip" }, CANCEL_BUTTON]] });
        return false;
      }
      draft.prize_pool = amount;
    }
    await clearSession(telegramUserId);
    const { data: created, error } = await supabaseAdmin
      .from("nexus_tournaments")
      .insert({
        name: draft.name,
        game: "BGMI",
        format: TEAM_SIZE_LABEL[draft.team_size],
        team_size: draft.team_size,
        start_date: draft.start_date ?? null,
        prize_pool: draft.prize_pool ?? null,
        created_by_to_id: member.to_id,
      })
      .select("id, name")
      .single();
    if (error) {
      console.error("Tournament creation failed:", error);
      await reply("Couldn't create the tournament. Try again.");
      return true;
    }
    await supabaseAdmin.from("nexus_activity_log").insert({
      to_id: member.to_id,
      tournament_id: created.id,
      event_type: "tournament_created",
      detail: created.name,
    });
    await reply(`Created ${created.name}. Open registrations when you're ready for teams to apply.`);
    await showMyTournament({ member, tournamentId: created.id, reply });
    return false;
  }

  await clearSession(telegramUserId);
  return true;
}
