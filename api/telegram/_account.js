import { supabaseAdmin, createAuthClient } from "./_supabaseAdmin.js";
import { setSession, clearSession } from "./_session.js";
import {
  findMemberByAuthUser,
  findMemberByTelegram,
  linkTelegram,
  createSetPasswordLink,
  fetchValidInvite,
} from "./_members.js";

// The account flow: prove an email with a Supabase email code, then either
// create a new TO (intent "signup"), reconnect an existing TO login
// (intent "login"), or join a TO from an invite link (intent "invite").
// Every path ends with the Telegram account linked to a nexus_to_members row
// and a one-time "set your password" link for the website.
//
// Session state: { flow: "account", intent, step, email?, userId?, inviteCode?, answers? }
// userId is only ever set after verifyOtp succeeds — every later step trusts it.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\s*(\d{6,10})\s*$/;
const MAX_FIELD_LENGTH = 80;
const CANCEL_BUTTON = { text: "Cancel", data: "cancel" };

const PROFILE_STEPS = [
  { key: "organisation_name", prompt: "What's your organisation's name? (This is what players see.)" },
  { key: "to_ign", prompt: "What's your BGMI in-game name (IGN)?" },
  { key: "to_uid", prompt: "What's your BGMI UID?" },
  { key: "to_real_name", prompt: "What's your real name? (Optional — only shown on your TO profile.)", optional: true },
];

export async function startAccountFlow({ telegramUserId, intent, inviteCode, reply }) {
  if (intent === "invite") {
    const invite = await fetchValidInvite(inviteCode);
    if (!invite) {
      await reply("This invite link isn't valid or has expired. Ask the TO owner for a new one.");
      return;
    }
    await setSession(telegramUserId, { flow: "account", intent, step: "email", inviteCode: inviteCode.toUpperCase() });
    await reply(
      `You've been invited to help run ${invite.nexus_tos.organisation_name} (${invite.nexus_tos.to_id}) on NexusID.\n\nFirst, what's your email? It becomes your website login.`,
      { buttons: [[CANCEL_BUTTON]] }
    );
    return;
  }

  await setSession(telegramUserId, { flow: "account", intent, step: "email" });
  await reply(
    intent === "login"
      ? "What email did you use for your NexusID TO account?"
      : "Let's create your TO account. First, what's your email? It becomes your website login, and it's how you reset a forgotten password.",
    { buttons: [[CANCEL_BUTTON]] }
  );
}

async function sendEmailCode(state, reply) {
  const { error } = await createAuthClient().auth.signInWithOtp({
    email: state.email,
    options: { shouldCreateUser: state.intent !== "login" },
  });
  if (error) {
    if (error.status === 429) {
      await reply("Too many codes were sent just now. Wait a minute, then tap Resend.", {
        buttons: [[{ text: "Resend code", data: "resend" }, CANCEL_BUTTON]],
      });
    } else if (state.intent === "login") {
      await reply("No NexusID TO account uses that email. Check it, or tap Cancel and choose \"Become a TO\".", {
        buttons: [[{ text: "Change email", data: "change_email" }, CANCEL_BUTTON]],
      });
    } else {
      console.error("signInWithOtp failed:", error);
      await reply("Couldn't send the code right now. Try again in a few minutes.", {
        buttons: [[{ text: "Resend code", data: "resend" }, CANCEL_BUTTON]],
      });
    }
    return false;
  }
  await reply(`We emailed a code to ${state.email}. Send it here.\n\n(Not there? Check spam, or tap Resend.)`, {
    buttons: [[{ text: "Resend code", data: "resend" }, { text: "Change email", data: "change_email" }], [CANCEL_BUTTON]],
  });
  return true;
}

async function sendPasswordLink(authUserId, reply, intro) {
  const link = await createSetPasswordLink(authUserId);
  if (!link) {
    await reply(`${intro}\n\nTo use the website, tap "Website login" in the menu any time.`);
    return;
  }
  await reply(
    `${intro}\n\nTo also use the website, set your password here. The link works once, for 1 hour — don't share it.`,
    { buttons: [[{ text: "Set website password", url: link }]] }
  );
}

// Returns true when the flow has finished and the caller should show the menu.
export async function continueAccountFlow({ telegramUserId, state, text, data, reply }) {
  if (state.step === "email") {
    const email = (text || "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      await reply("That doesn't look like an email address. Try again.", { buttons: [[CANCEL_BUTTON]] });
      return false;
    }
    const next = { ...state, email, step: "code" };
    await setSession(telegramUserId, next);
    await sendEmailCode(next, reply);
    return false;
  }

  if (state.step === "code") {
    if (data === "resend") {
      await sendEmailCode(state, reply);
      return false;
    }
    if (data === "change_email") {
      await setSession(telegramUserId, { ...state, step: "email", email: undefined });
      await reply("OK — what's the right email?", { buttons: [[CANCEL_BUTTON]] });
      return false;
    }
    const match = (text || "").match(OTP_PATTERN);
    if (!match) {
      await reply("Send the code from the email (numbers only).");
      return false;
    }
    const { data: verified, error } = await createAuthClient().auth.verifyOtp({
      email: state.email,
      token: match[1],
      type: "email",
    });
    if (error || !verified?.user) {
      await reply("That code is wrong or has expired. Try again, or tap Resend.", {
        buttons: [[{ text: "Resend code", data: "resend" }, CANCEL_BUTTON]],
      });
      return false;
    }
    return afterEmailVerified({ telegramUserId, state: { ...state, userId: verified.user.id }, reply });
  }

  if (state.step === "invite_name") {
    const name = (text || "").trim();
    if (!name || name.length > MAX_FIELD_LENGTH) {
      await reply("Send your name (up to 80 characters).");
      return false;
    }
    return acceptInvite({ telegramUserId, state, name, reply });
  }

  if (state.step === "profile") {
    return collectProfile({ telegramUserId, state, text, data, reply });
  }

  await clearSession(telegramUserId);
  return true;
}

async function afterEmailVerified({ telegramUserId, state, reply }) {
  const existingForTelegram = await findMemberByTelegram(telegramUserId);
  const member = await findMemberByAuthUser(state.userId);

  if (member) {
    await clearSession(telegramUserId);
    if (state.intent === "invite") {
      await reply(`That login already belongs to ${member.nexus_tos.organisation_name}. One login can be part of one TO account.`);
      return true;
    }
    if (existingForTelegram && existingForTelegram.id !== member.id) {
      await reply("This Telegram account is already connected to a different NexusID TO account.");
      return true;
    }
    await linkTelegram(member.id, telegramUserId);
    await reply(`Welcome back! You're connected to ${member.nexus_tos.organisation_name} (${member.nexus_tos.to_id}).`);
    return true;
  }

  if (existingForTelegram) {
    await clearSession(telegramUserId);
    await reply("This Telegram account is already connected to a different NexusID TO account.");
    return true;
  }

  if (state.intent === "invite") {
    await setSession(telegramUserId, { ...state, step: "invite_name" });
    await reply("Email confirmed. What name should the rest of the team see for you?");
    return false;
  }

  // Signup, or a login that has an account but never finished TO
  // registration on the website — either way, collect the TO profile.
  await setSession(telegramUserId, { ...state, step: "profile", answers: {} });
  await reply(`Email confirmed. ${PROFILE_STEPS[0].prompt}`, { buttons: [[CANCEL_BUTTON]] });
  return false;
}

async function collectProfile({ telegramUserId, state, text, data, reply }) {
  const answers = { ...state.answers };
  const index = PROFILE_STEPS.findIndex((s) => !(s.key in answers));
  const current = PROFILE_STEPS[index];

  if (data === "skip" && current.optional) {
    answers[current.key] = null;
  } else {
    const value = (text || "").trim();
    if (!value || value.length > MAX_FIELD_LENGTH) {
      await reply(`${current.prompt}\n(Up to 80 characters.)`, {
        buttons: current.optional ? [[{ text: "Skip", data: "skip" }, CANCEL_BUTTON]] : [[CANCEL_BUTTON]],
      });
      return false;
    }
    answers[current.key] = value;
  }

  const next = PROFILE_STEPS[index + 1];
  if (next) {
    await setSession(telegramUserId, { ...state, answers });
    await reply(next.prompt, {
      buttons: next.optional ? [[{ text: "Skip", data: "skip" }, CANCEL_BUTTON]] : [[CANCEL_BUTTON]],
    });
    return false;
  }

  // Inserting nexus_tos fires the 0007 trigger that makes this login the
  // owner member, so only the Telegram link is left to set afterwards.
  const { data: created, error } = await supabaseAdmin
    .from("nexus_tos")
    .insert({ auth_user_id: state.userId, ...answers })
    .select("to_id, organisation_name")
    .single();
  await clearSession(telegramUserId);
  if (error) {
    console.error("TO creation failed:", error);
    await reply("Couldn't create your TO account. Tap \"Become a TO\" to try again.");
    return true;
  }

  const member = await findMemberByAuthUser(state.userId);
  if (member) await linkTelegram(member.id, telegramUserId);

  await sendPasswordLink(
    state.userId,
    reply,
    `Your TO account is ready!\n\n${created.organisation_name}\nTO ID: ${created.to_id}\n\nYou can run everything from this chat.`
  );
  return true;
}

async function acceptInvite({ telegramUserId, state, name, reply }) {
  await clearSession(telegramUserId);
  const invite = await fetchValidInvite(state.inviteCode);
  if (!invite) {
    await reply("This invite expired or was already used. Ask the TO owner for a new one.");
    return true;
  }

  // Claim the invite first, conditionally, so two people can't both use it.
  const { data: claimed } = await supabaseAdmin
    .from("nexus_to_invites")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("consumed_at", null)
    .select("id");
  if (!claimed?.length) {
    await reply("This invite was just used by someone else. Ask the TO owner for a new one.");
    return true;
  }

  const { data: member, error } = await supabaseAdmin
    .from("nexus_to_members")
    .insert({
      to_id: invite.to_id,
      auth_user_id: state.userId,
      role: invite.role,
      display_name: name,
      telegram_user_id: telegramUserId,
      telegram_linked_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // Give the invite back — most likely this login or Telegram account
    // joined a TO in the meantime (active-member unique indexes).
    await supabaseAdmin.from("nexus_to_invites").update({ consumed_at: null }).eq("id", invite.id);
    await reply("Couldn't add you — this login or Telegram account is already part of a TO account.");
    return true;
  }

  await supabaseAdmin.from("nexus_to_invites").update({ consumed_by_member_id: member.id }).eq("id", invite.id);

  await sendPasswordLink(
    state.userId,
    reply,
    `You've joined ${invite.nexus_tos.organisation_name} (${invite.nexus_tos.to_id}) as an admin.`
  );
  return true;
}

export { sendPasswordLink };
