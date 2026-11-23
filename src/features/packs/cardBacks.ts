// standard card backs that can be picked in one click (they are links, so they also work in Tabletop Simulator)
export type CardBackPreset = { id: string; label: string; url: string };

export const CARD_BACK_PRESETS: CardBackPreset[] = [
  {
    id: "master",
    label: "Мастер",
    url: "https://steamusercontent-a.akamaihd.net/ugc/1755834085905350819/E4B38A485163AE9081CC2A06686E1067F3FB87B7/",
  },
  {
    id: "skill",
    label: "Навык",
    url: "https://steamusercontent-a.akamaihd.net/ugc/1859424227563755756/4ED7D06BD9460E79BF38A41EBD94003B9E3014B1/",
  },
  {
    id: "attack",
    label: "Атака",
    url: "https://steamusercontent-a.akamaihd.net/ugc/1859424227559646901/D087FA6E0AE424A5E73223C1C9C7B71D5E04D438/",
  },
  {
    id: "ascension",
    label: "Вознесение",
    url: "https://steamusercontent-a.akamaihd.net/ugc/1859423720309789439/09DC0CCDC4F65A360173710E6BA21877A076ADD0/",
  },
  {
    id: "command-spell",
    label: "Командное заклинание",
    url: "https://steamusercontent-a.akamaihd.net/ugc/1028450973628019412/0B2C5A09E0FD1BE226E3636B2A0A2E1596B64366/",
  },
];

export const presetForUrl = (value: string | null | undefined): CardBackPreset | undefined =>
  value ? CARD_BACK_PRESETS.find((p) => p.url === value) : undefined;
