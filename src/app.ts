import * as Discord from "discord.js";
import * as fs from "fs";

const client = new Discord.Client();

client.on("ready", () => {});

function parseMessage(
  msg: string
):
  | { type: "join" | "leave"; roleSelector: string | number }
  | { type: "list" }
  | null {
  const joinRegexp = /(.+)(カテゴリ|カテゴリー|カテ)に入りたい/;
  const leaveRegexp = /(.+)(カテゴリ|カテゴリー|カテ)(から|を)抜けたい/;
  const listRegexp = /(カテ|カテゴリ|カテゴリー)一覧/;

  {
    const listResult = msg.match(listRegexp);
    if (listResult !== null) {
      return {
        type: "list",
      };
    }
  }

  {
    const joinResult = msg.match(joinRegexp);
    if (joinResult !== null) {
      const index = Number(joinResult[1]);
      return {
        type: "join",
        roleSelector: isNaN(index) ? joinResult[1] : index - 1,
      };
    }
  }

  {
    const leaveResult = msg.match(leaveRegexp);
    if (leaveResult !== null) {
      const index = Number(leaveResult[1]);
      return {
        type: "leave",
        roleSelector: isNaN(index) ? leaveResult[1] : index - 1,
      };
    }
  }

  return null;
}

client.on("message", async (msg) => {
  try {
    const guild = msg.guild;
    if (guild === null) {
      return;
    }

    const member = msg.member;
    if (member === null) {
      return;
    }

    const parseResult = parseMessage(msg.content);
    if (parseResult === null) {
      return;
    }

    const channels = guild.channels.cache
      .array()
      .filter((channel) => channel.type === "category");

    const roles = (await guild.roles.fetch()).cache
      .array()
      .filter(
        (role) =>
          channels
            .map((channel) => channel.name.toLowerCase())
            .indexOf(role.name.toLowerCase()) !== -1
      )
      .sort((a, b) => b.position - a.position);

    if (parseResult.type === "list") {
      await guild.members.fetch();

      const list = roles
        .map((role, i) => `${i + 1}: ${role.name} (${role.members.size}人)`)
        .join("\n");
      await msg.reply(`\n${list}`);
    } else {
      const role = roles.find((role, i) =>
        typeof parseResult.roleSelector === "string"
          ? role.name.toLowerCase() === parseResult.roleSelector.toLowerCase()
          : i === parseResult.roleSelector
      );

      if (role === undefined) {
        await msg.reply(
          typeof parseResult.roleSelector === "string"
            ? `「${parseResult.roleSelector}」というカテゴリは存在しません。`
            : `${parseResult.roleSelector + 1}番目のカテゴリは存在しません。`
        );
        return;
      }

      try {
        if (parseResult.type === "join") {
          await member.roles.add(role);
        } else {
          await member.roles.remove(role);
        }
      } catch {
        await msg.reply(
          `ロール設定に失敗しました。権限設定に誤りがある可能性があります。`
        );
        return;
      }

      if (parseResult.type === "join") {
        await msg.reply(`「${role.name}」ロールを付与しました。`);
      } else {
        await msg.reply(`「${role.name}」ロールを削除しました。`);
      }
    }
  } catch (e) {
    console.error(e);
  }
});

client.login(
  JSON.parse(fs.readFileSync("config.json", { encoding: "utf8" })).token
);
