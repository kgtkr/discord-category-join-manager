import * as Discord from "discord.js";
import * as fs from "fs";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";

const config: { token: string; appId: string; guildId: string } = JSON.parse(
  fs.readFileSync("config.json", { encoding: "utf8" })
);

const rest = new REST({ version: "9" }).setToken(config.token);
const client = new Discord.Client({
  intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MEMBERS],
});

const commands = [
  new SlashCommandBuilder()
    .setName("here")
    .setDescription("カテゴリのゴーレムを召喚"),
].map((command) => command.toJSON());

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(config.appId, config.guildId),
      {
        body: commands,
      }
    );
  } catch (error) {
    console.error(error);
  }
})();

client.on("ready", () => {});

async function fetchRoles(
  interaction:
    | Discord.BaseCommandInteraction
    | Discord.MessageComponentInteraction
): Promise<Discord.Role[] | null> {
  const channels = (await interaction.guild?.channels.fetch())
    ?.toJSON()
    .filter((channel) => channel.type === "GUILD_CATEGORY");

  if (channels === undefined) {
    await interaction.reply({
      content: "[Internal Error] カテゴリ一覧取得に失敗しました",
      ephemeral: true,
    });
    return null;
  }

  await interaction.guild?.members.fetch();

  const roles = (await interaction.guild?.roles?.fetch())
    ?.toJSON()
    .filter(
      (role) =>
        channels
          .map((channel) => channel.name.toLowerCase())
          .indexOf(role.name.toLowerCase()) !== -1
    )
    .sort((a, b) => b.position - a.position);

  if (roles === undefined) {
    await interaction.reply({
      content: "[Internal Error] ロール一覧取得に失敗しました",
      ephemeral: true,
    });
    return null;
  }

  return roles;
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "here") {
      const roles = await fetchRoles(interaction);
      if (roles === null) {
        return;
      }

      const row = new Discord.MessageActionRow().addComponents(
        new Discord.MessageSelectMenu()
          .setCustomId("role_ids_selector")
          .setPlaceholder("カテゴリを選択")
          .setMaxValues(roles.length)
          .addOptions(
            roles.map((role) => ({
              label: `${role.name} (${role.members.size}人)`,
              value: role.id,
              default:
                role.members
                  .toJSON()
                  .findIndex(
                    (member) => member.id === interaction.member?.user.id
                  ) !== -1,
            }))
          )
      );

      await interaction.reply({
        content: "Hi!",
        components: [row],
        ephemeral: true,
      });
    }
  }

  if (interaction.isSelectMenu()) {
    if (interaction.customId === "role_ids_selector") {
      const roles = await fetchRoles(interaction);
      if (roles === null) {
        return;
      }

      const member = interaction.member;
      if (member === null) {
        await interaction.reply({
          content: "[Internal Error] メンバー取得に失敗しました",
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guildId;
      if (guildId === null) {
        await interaction.reply({
          content: "[Internal Error] guildId取得に失敗しました",
          ephemeral: true,
        });
        return;
      }

      const currentRoleIds_ = (() => {
        const val = member.roles;
        if (Array.isArray(val)) {
          return val;
        } else if (val === undefined) {
          return undefined;
        } else {
          return (val as any).member._roles as string[];
        }
      })();

      if (currentRoleIds_ === undefined) {
        await interaction.reply({
          content: "[Internal Error] 現在のロール一覧取得に失敗しました",
          ephemeral: true,
        });
        return;
      }

      const currentRoleIds = currentRoleIds_.filter(
        (id) => roles.findIndex((role) => role.id === id) !== -1
      );

      const currentRoleIdSet = new Set(currentRoleIds);
      const targetRoleIds = interaction.values;
      const targetRoleIdSet = new Set(targetRoleIds);
      const leaveRoleIds = currentRoleIds.filter(
        (id) => !targetRoleIdSet.has(id)
      );
      const joinRoleIds = targetRoleIds.filter(
        (id) => !currentRoleIdSet.has(id)
      );

      try {
        for (const id of leaveRoleIds) {
          await rest.delete(
            Routes.guildMemberRole(guildId, member.user.id, id),
            {}
          );
        }

        for (const id of joinRoleIds) {
          await rest.put(
            Routes.guildMemberRole(guildId, member.user.id, id),
            {}
          );
        }
      } catch (e) {
        console.error(e);
        await interaction.reply({
          content: "[Internal Error] いくつかのロール付与/削除に失敗しました。",
          ephemeral: true,
        });
        return;
      }

      const joinMessage =
        joinRoleIds.length !== 0
          ? `${joinRoleIds
              .map(
                (id) => roles.find((role) => role.id === id)?.name ?? String(id)
              )
              .join(",")}に入りました。`
          : ``;

      const leaveMessage =
        leaveRoleIds.length !== 0
          ? `${leaveRoleIds
              .map(
                (id) => roles.find((role) => role.id === id)?.name ?? String(id)
              )
              .join(",")}から抜けました。`
          : ``;

      await interaction.reply({
        content: `<@${member.user.id}> が ${joinMessage}${leaveMessage}`,
      });
    }
  }
});

client.login(config.token);
