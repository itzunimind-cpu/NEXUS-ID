import { supabaseAdmin, SITE_URL } from "./_supabaseAdmin.js";
import { getSession, clearSession } from "./_session.js";
import { findMemberByTelegram } from "./_members.js";
import { LINK_CODE_PATTERN, redeemLinkCode } from "./_link.js";
import { startAccountFlow, continueAccountFlow, sendPasswordLink } from "./_account.js";

const INVITE_START_PATTERN = /^\s*\/start\s+inv_([0-9a-f]{12})\s*$/i;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "NexusIDBot";

// Entry point for every private-chat message or button tap. `text` is set
// for typed messages, `data` for button taps (callback_data).
export async function handleUpdate({ telegramUserId, text, data, reply }) {
  const trimmed = (text || "").trim();

  if (data === "cancel" || data === "menu" || /^\/(start|cancel|menu)$/i.test(trimmed)) {
    await clearSession(telegramUserId);
    return showMenu({ telegramUserId, reply });
  }

  // Deep links always win over an in-progress flow — tapping a fresh link
  // is a clear signal of what the user wants now.
  const inviteMatch = trimmed.match(INVITE_START_PATTERN);
  if (inviteMatch) {
    if (await findMemberByTelegram(telegramUserId)) {
      await reply("This Telegram account is already part of a TO account, so it can't join another one.");
      return showMenu({ telegramUserId, reply });
    }
    return startAccountFlow({ telegramUserId, intent: "invite", inviteCode: inviteMatch[1], reply });
  }
  // A tapped "/start <code>" link always counts; a bare typed code only when
  // no flow is in progress — a 10-digit BGMI UID typed mid-signup would
  // otherwise look like a link code.
  const state = await getSession(telegramUserId);
  const linkMatch = trimmed.match(LINK_CODE_PATTERN);
  if (linkMatch && (trimmed.startsWith("/start") || !state.flow)) {
    await clearSession(telegramUserId);
    if (await redeemLinkCode({ telegramUserId, code: linkMatch[1], reply })) {
      return showMenu({ telegramUserId, reply });
    }
    return;
  }

  if (state.flow === "account") {
    const done = await continueAccountFlow({ telegramUserId, state, text, data, reply });
    if (done) return showMenu({ telegramUserId, reply });
    return;
  }

  const member = await findMemberByTelegram(telegramUserId);

  if (!member) {
    if (data === "become_to") return startAccountFlow({ telegramUserId, intent: "signup", reply });
    if (data === "have_to") return startAccountFlow({ telegramUserId, intent: "login", reply });
    return showMenu({ telegramUserId, reply, member });
  }

  if (data === "members") return listMembers({ member, reply });
  if (data === "invite" && member.role === "owner") return createInvite({ member, reply });
  if (data === "web_login") {
    return sendPasswordLink(member.auth_user_id, reply, "Your website login is your email address.");
  }
  return showMenu({ telegramUserId, reply, member });
}

async function showMenu({ telegramUserId, reply, member }) {
  const current = member === undefined ? await findMemberByTelegram(telegramUserId) : member;
  if (!current) {
    await reply(
      "Welcome to NexusID — run BGMI tournaments from Telegram.\n\nAre you a tournament organiser (TO)?",
      {
        buttons: [
          [{ text: "🏆 Become a TO", data: "become_to" }],
          [{ text: "🔑 I already have a TO account", data: "have_to" }],
        ],
      }
    );
    return;
  }

  const rows = [[{ text: "👥 Members", data: "members" }]];
  if (current.role === "owner") rows.push([{ text: "➕ Invite a member", data: "invite" }]);
  rows.push([{ text: "🌐 Website login", data: "web_login" }]);
  await reply(
    `${current.nexus_tos.organisation_name} (${current.nexus_tos.to_id})\nYou: ${current.display_name} · ${current.role}\n\nTournament features are coming next.`,
    { buttons: rows }
  );
}

async function listMembers({ member, reply }) {
  const { data: members } = await supabaseAdmin
    .from("nexus_to_members")
    .select("display_name, role, telegram_user_id")
    .eq("to_id", member.to_id)
    .is("removed_at", null)
    .order("joined_at");
  const lines = (members || []).map(
    (m) => `• ${m.display_name} — ${m.role}${m.telegram_user_id ? " · on Telegram" : ""}`
  );
  await reply(`Members of ${member.nexus_tos.organisation_name}:\n\n${lines.join("\n")}\n\nThe owner can remove members from the website dashboard.`, {
    buttons: [[{ text: "Back", data: "menu" }]],
  });
}

async function createInvite({ member, reply }) {
  const { data: invite, error } = await supabaseAdmin
    .from("nexus_to_invites")
    .insert({ to_id: member.to_id, created_by_auth_user_id: member.auth_user_id })
    .select("code")
    .single();
  if (error) {
    console.error("Invite creation failed:", error);
    await reply("Couldn't create an invite right now. Try again.");
    return;
  }
  await reply(
    `Send one of these links to the person you want to add. It works once, for 7 days, and makes them an admin (they can run tournaments, but can't invite or remove people).\n\nTelegram: https://t.me/${BOT_USERNAME}?start=inv_${invite.code}\n\nWebsite: ${SITE_URL}/join.html?code=${invite.code}`,
    { buttons: [[{ text: "Back", data: "menu" }]] }
  );
}
