import { supabaseAdmin } from "./_supabaseAdmin.js";
import { sendText } from "./_send.js";

// Shared by the bot's review screen and the website's approve/reject buttons
// (api/registrations/decide.js), so both paths check the same things and send
// the same Telegram messages.

// The tournament, if it belongs to this member's TO — otherwise null.
export async function fetchOwnedTournament(member, tournamentId) {
  const { data } = await supabaseAdmin
    .from("nexus_tournaments")
    .select("id, name, status, team_size, registrations_open, start_date, prize_pool, created_by_to_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!data || data.created_by_to_id !== member.to_id) return null;
  return data;
}

// Approves or rejects a pending entry. Returns { ok, message } — message is
// user-facing either way. Only the owning TO's members may decide.
export async function decideRegistration({ member, registrationId, approve }) {
  const { data: registration } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .select("id, tournament_id, team_name, status, applicant_telegram_user_id, nexus_tournaments (name, created_by_to_id)")
    .eq("id", registrationId)
    .maybeSingle();

  if (!registration || registration.nexus_tournaments.created_by_to_id !== member.to_id) {
    return { ok: false, message: "That application isn't one of your tournament's." };
  }
  if (registration.status !== "pending") {
    return { ok: false, message: `${registration.team_name} was already ${registration.status}.` };
  }

  // Conditional on still being pending, so two members deciding at once
  // can't both win.
  const status = approve ? "approved" : "rejected";
  const { data: updated } = await supabaseAdmin
    .from("nexus_tournament_registrations")
    .update({ status, decided_by_member_id: member.id, decided_at: new Date().toISOString() })
    .eq("id", registration.id)
    .eq("status", "pending")
    .select("id");
  if (!updated?.length) {
    return { ok: false, message: `${registration.team_name} was just decided by someone else.` };
  }

  if (!approve) {
    // Frees these players' UIDs so they can enter this tournament again.
    await supabaseAdmin
      .from("nexus_tournament_registration_members")
      .update({ removed_at: new Date().toISOString() })
      .eq("registration_id", registration.id)
      .is("removed_at", null);
  }

  if (registration.applicant_telegram_user_id) {
    const tournamentName = registration.nexus_tournaments.name;
    const text = approve
      ? `✅ ${registration.team_name} is approved for ${tournamentName}! The organiser will share match details.`
      : `❌ ${registration.team_name}'s application for ${tournamentName} wasn't accepted. You can contact the organiser, or apply again with changes.`;
    // The applicant may have blocked the bot — never fail the decision over it.
    await sendText(registration.applicant_telegram_user_id, text).catch(() => {});
  }

  return { ok: true, message: `${registration.team_name}: ${status}.` };
}

// Tells every member of the TO who has Telegram linked that a new entry
// arrived. Free on Telegram, so this is a push, not a menu to check.
export async function notifyToOfApplication({ tournament, teamName, playerCount }) {
  const { data: members } = await supabaseAdmin
    .from("nexus_to_members")
    .select("telegram_user_id")
    .eq("to_id", tournament.created_by_to_id)
    .is("removed_at", null)
    .not("telegram_user_id", "is", null);
  for (const m of members || []) {
    await sendText(m.telegram_user_id, `📥 New application for ${tournament.name}: ${teamName} (${playerCount} player${playerCount === 1 ? "" : "s"}).`, {
      buttons: [[{ text: "Review applications", data: `rv:${tournament.id}` }]],
    }).catch(() => {});
  }
}
