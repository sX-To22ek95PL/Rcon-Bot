const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require('discord.js');
import { Helpers, DiscordLimits } from '../../helpers/helpers'
import Matching from '../../helpers/matching'
import Fetch from '../../helpers/fetch';

module.exports = class Vip {
    constructor() {
        this.name = 'vip';
        this.description = 'Add vip to selected player';
    }

    async init() {
        const servers = await Helpers.getServerChoices();

        this.slashCommand = new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('manual')
                    .setDescription('Add vip to the player, without matching')
                    .addStringOption(option =>
                        option.setName('server')
                            .setDescription("Select the server")
                            .setRequired(true)
                            .addChoices(...servers)
                    )
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Type player name')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('online')
                    .setDescription('Add vip to the player, with matching')
                    .addStringOption(option =>
                        option.setName('server')
                            .setDescription("Select the server")
                            .setRequired(true)
                            .addChoices(...servers)
                    )
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Type player name')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            );
    }

    async handleAutocomplete(interaction) {
        const server = interaction.options.getString("server");
        const focusedValue = interaction.options.getFocused();

        const response = await Helpers.getPlayers(server);
        if (!response) {
            await interaction.respond([]);
            return;
        }
        const playerNames = response.data.players.map(player => player.name);
        const matchedPlayer = Matching.getBestMatch(focusedValue, playerNames, DiscordLimits.maxChoices);
        if (!matchedPlayer) {
            await interaction.respond([]);
            return;
        }

        const type = matchedPlayer.type;
        if (type === "far") {
            await interaction.respond([]);
            return;
        }

        let players = [];
        if (type === "good") {
            players = [matchedPlayer.name];
        }
        else if (type === "multi") {
            players = matchedPlayer.names;
        }

        await interaction.respond(
            players.map(name => ({ name: name, value: name }))
        );
    }

    async runSlash(interaction) {
        if (!await Helpers.checkRoles(interaction, this))
            return;

        await interaction.deferReply();

        const server = interaction.options.getString("server");
        const playerName = interaction.options.getString('name');

        const isWhitespaceString = str => !/\S/.test(str)
        if (isWhitespaceString(playerName)) {
            await interaction.editReply("It makes no sense to send whitespaces only");
            return;
        }

        const parameters = {
            soldierName: playerName
        };

        return Fetch.post(`${server}/reservedSlots`, parameters)
            .then(response => {
                return interaction.editReply({ embeds: [this.buildEmbed(interaction, parameters, response)] });
            })
            .catch(error => {
                console.error(error)
                return;
            });
    }

    buildEmbed(messageOrInteraction, parameters, response) {
        const user = Helpers.isCommand(messageOrInteraction) ? messageOrInteraction.user : messageOrInteraction.author;
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setColor(response.status === "OK" ? 'Green' : 'Red')
            .setThumbnail('https://cdn.discordapp.com/attachments/608427147039866888/688012094972625024/fireworks.png')
            .setFooter({
                text: 'Author: Bartis',
                iconURL: 'https://cdn.discordapp.com/attachments/608427147039866888/688012094972625024/fireworks.png',
            })
            .setAuthor({
                name: 'Reserved Slot',
                iconURL: user.displayAvatarURL(),
            })
            .addFields(
                { name: 'Issuer', value: user.username, inline: true },
                { name: 'Target', value: `**${parameters.soldierName}**`, inline: true },
                { name: 'Status', value: response.status, inline: true }
            );

        if (response.status === "FAILED") {
            embed.addFields({ name: 'Reason for Failing', value: response.error, inline: true });
        }
        embed.addFields({ name: 'Server', value: response.server, inline: false });

        return embed;
    }
};