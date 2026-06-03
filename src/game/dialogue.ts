// Data-driven dialogue and story. Scripts live here so the story can grow
// without touching scene code. DialogueScene plays each script with typewriter text.
// Controlled by keyboard or tap for mobile.

export interface DialogueLine {
  speaker?: string; // name shown in the name box; omitted for narration
  text: string;
  color?: number; // accent or portrait color when no sprite is provided
  portrait?: string; // optional texture key, e.g. 'c_kael'
}

export type Script = DialogueLine[];

const NARRATOR = 0x8a93b8;

export const SCRIPTS: Record<string, Script> = {
  // Chapter 1 opening — first arrival in Sanctuary.
  intro: [
    { text: 'Aether, the light that bears the world, has fallen.', color: NARRATOR },
    { text: 'The forests around Sanctuary have gone dark. Something is consuming what little Aether remains.', color: NARRATOR },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Ashenveil Forest is close. If the corruption started anywhere, it started there.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'I can feel Aether traces inside. Something is drawing it out — deliberately.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'The old grove at the heart of the forest had a crystal anchor. If it still stands...' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Then we find it. And whoever is doing this.' },
    { text: 'Speak with the people of Sanctuary. Then enter the forest through the eastern gate.', color: NARRATOR },
  ],

  npc_keeper: [
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'Ashenveil has been sealed since the wolves turned. Shadow-touched, all of them.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'The eastern gate is open for you. Whatever is in there — be careful.' },
  ],

  npc_scholar: [
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'The grove at the heart of Ashenveil was once an Aether anchor — one of twelve in the region.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'If someone is draining it, the creatures around it will warp. Find the anchor.' },
  ],

  npc_child: [
    { speaker: 'Child', color: 0x6cf0c2, text: 'My dog ran into the forest two nights ago. His name is Pip. He\'s small and brown.' },
    { speaker: 'Child', color: 0x6cf0c2, text: 'Please... if you see him...' },
  ],

  // Story trigger at the dying Aether crystal in the Ancient Grove.
  ch1_crystal: [
    { text: 'At the center of the grove stands a crystalline pillar — cracked, its light sputtering.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'This is the anchor. It\'s almost gone.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Something is here. Something that doesn\'t want us to restore it.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Then we deal with it first.' },
    { text: 'A shape tears itself from the shadows — the Forest Shade, an Aether spirit consumed by the drain.', color: NARRATOR },
  ],

  // Post-ch1 NPC dialogue.
  npc_keeper_after: [
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'Ashenveil is quiet again. I never thought I\'d say that.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'The northern road leads to the old Sunken City. We lost contact months ago. Whatever is down there is worse.' },
  ],

  npc_scholar_after: [
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'The forest anchor is stable — for now. But there are eleven others.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'The Sunken City had one too, the Tidal Anchor. It\'s been submerged for years. Whatever guards it now isn\'t human.' },
  ],

  // After defeating the Forest Shade — triggered by BattleScene on boss win.
  ch1_win: [
    { text: 'The Forest Shade dissolves. The grove falls silent.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'The crystal is stabilising. Slowly, but it\'s holding.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Whoever started the drain will know someone pushed back.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Good. Let them.' },
    { text: 'The first anchor holds. The search for the others begins.', color: NARRATOR },
  ],

  // Chapter 2 — Sunken City story trigger before boss.
  ch2_warden: [
    { text: 'The chamber is vast, half-flooded. Pillars of ancient stone rise from black water.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'The Tidal Anchor is here. I can feel it — somewhere beneath the water.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'There\'s something standing in the way. Something that used to be a Warden.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Then it ends here.' },
  ],

  npc_keeper_after2: [
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'Two anchors. The Sunken City is draining less now — I can feel it.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'The Ashen Peaks to the west have been burning since before I was born. Whatever lives up there is old.' },
  ],

  npc_scholar_after2: [
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'The Peaks Anchor is called the Ashbrand in the old texts. A fire spirit that predates the Aether itself.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'It was bound to the anchor willingly, long ago. Something must have turned it.' },
  ],

  // After defeating the Tide Warden.
  ch2_win: [
    { text: 'The Tide Warden shatters. The water in the chamber begins to recede.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'The Tidal Anchor — it\'s surfacing. It\'s been whole this whole time, just buried.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Two anchors restored. Ten more.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'We keep moving.' },
    { text: 'Somewhere above, the light over Sanctuary grows a little brighter.', color: NARRATOR },
  ],
  // Chapter 3 story trigger before Ashbrand.
  ch3_ashbrand: [
    { text: 'The summit is scorched stone and ash. At the center, a pillar of black rock pulses with fire.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'The Peaks Anchor. It\'s still intact — but something is burning from inside it.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'That presence... it was bound here willingly once. It doesn\'t feel willing anymore.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Can you reach it? Remind it what it is?' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Not while it\'s like this. We need to break through first.' },
  ],

  ch3_win: [
    { text: 'The fire recedes. Ashbrand — the spirit within the anchor — stirs, as if waking from a long dream.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'It\'s still in there. The real spirit. The corruption broke when we fought through.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Three anchors. The world feels a little lighter.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Nine more. But tonight we rest.' },
    { text: 'The Ashen Peaks grow quiet for the first time in living memory.', color: NARRATOR },
  ],
};

// Tracks scripts seen in this session, such as avoiding a repeated intro after death.
const seen = new Set<string>();

export function hasSeen(id: string): boolean {
  return seen.has(id);
}

export function markSeen(id: string): void {
  seen.add(id);
}
