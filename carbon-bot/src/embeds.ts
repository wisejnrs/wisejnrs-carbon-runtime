import { EmbedBuilder } from 'discord.js';

// Branded rich embeds so MrRoboto's structured output (project cards, briefings,
// health, summaries) reads as designed rather than a wall of plain text.

export const BRAND_GREEN = 0x1f8a5b; // MrRoboto / Organism green

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface BrandEmbedOptions {
  title?: string;
  description?: string;
  url?: string;
  fields?: EmbedField[];
  footer?: string;
  color?: number;
}

/** Build a brand-styled embed, clamped to Discord's length limits. */
export function brandEmbed(o: BrandEmbedOptions): EmbedBuilder {
  const e = new EmbedBuilder().setColor(o.color ?? BRAND_GREEN);
  if (o.title) e.setTitle(o.title.slice(0, 256));
  if (o.description) e.setDescription(o.description.slice(0, 4096));
  if (o.url) e.setURL(o.url);
  if (o.fields?.length) {
    e.addFields(
      o.fields.slice(0, 25).map((f) => ({
        name: (f.name || '​').slice(0, 256),
        value: (String(f.value) || '​').slice(0, 1024),
        inline: f.inline ?? false,
      })),
    );
  }
  if (o.footer) e.setFooter({ text: o.footer.slice(0, 2048) });
  return e;
}

/** discord.com deep-link to a channel (used for Link buttons on embeds). */
export function channelUrl(guildId: string, channelId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}
