import * as Discord from "discord.js";
import * as fs from "fs";

const client = new Discord.Client();

client.on("ready", () => {});

function parseMessage(
  msg: string
): { type: "join" | "leave"; roleName: string } | { type: "list" } | null {
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
      return {
        type: "join",
        roleName: joinResult[1],
      };
    }
  }

  {
    const leaveResult = msg.match(leaveRegexp);
    if (leaveResult !== null) {
      return {
        type: "leave",
        roleName: leaveResult[1],
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

    const roles = (await guild.roles.fetch()).cache.array();
    const channels = guild.channels.cache
      .array()
      .filter((channel) => channel.type === "category");

    if (parseResult.type === "list") {
      const list = roles
        .filter(
          (role) =>
            channels
              .map((channel) => channel.name.toLowerCase())
              .indexOf(role.name.toLowerCase()) !== -1
        )
        .sort((a, b) => b.position - a.position)
        .map((role) => role.name)
        .join("\n");
      await msg.reply(`\n${list}`);
    } else {
      const role = roles.find(
        (role) => role.name.toLowerCase() === parseResult.roleName.toLowerCase()
      );

      if (role === undefined) {
        await msg.reply(
          `「${parseResult.roleName}」という名前のロールは存在しません。`
        );
        return;
      }

      const channel = channels.find(
        (channel) =>
          channel.name.toLowerCase() === parseResult.roleName.toLowerCase()
      );

      if (channel === undefined) {
        await msg.reply(
          `「${parseResult.roleName}」という名前のカテゴリは存在しません。`
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
        await msg.reply(`「${parseResult.roleName}」ロールを付与しました。`);
      } else {
        await msg.reply(`「${parseResult.roleName}」ロールを削除しました。`);
      }
    }
  } catch (e) {
    console.error(e);
  }
});

client.login(
  JSON.parse(fs.readFileSync("config.json", { encoding: "utf8" })).token
);
