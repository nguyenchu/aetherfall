// Data-driven dialogue and story. Scripts live here so the story can grow
// without touching scene code. DialogueScene plays each script with typewriter text.
// Controlled by keyboard or tap for mobile.

/** Small vignettes DialogueScene can draw above the textbox, built from the
 *  same pixel-sprite textures used in the field. Add a case in DialogueScene's
 *  renderVisual() for any new id. */
export type DialogueVisual = 'heroes_meet';

export interface DialogueLine {
  speaker?: string; // name shown in the name box; omitted for narration
  text: string;
  color?: number; // accent or portrait color when no sprite is provided
  portrait?: string; // optional texture key, e.g. 'c_kael'
  visual?: DialogueVisual; // optional vignette shown above the textbox for this line
}

export type Script = DialogueLine[];

const NARRATOR = 0x8a93b8;

export const SCRIPTS: Record<string, Script> = {
  // Chapter 1 opening — first arrival in Sanctuary.
  intro: [
    { text: 'Aether, the light that bears the world, has fallen.', color: NARRATOR },
    { text: 'The forests around Sanctuary have gone dark. Something is consuming what little Aether remains.', color: NARRATOR },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Ashenveil Forest is close. If the corruption started anywhere, it started there.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'My old watch-line ran through that gate. Eight of us. I never heard word of the other seven.', visual: 'heroes_meet' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'I\'ve stood where an anchor already failed. I came here to make sure I never watch that happen twice.', visual: 'heroes_meet' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'I can feel Aether traces inside the forest. Something is drawing it out — deliberately.', visual: 'heroes_meet' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'The Wardens have kept this anchor since before Sanctuary had walls. I don\'t intend to be the one who loses it.', visual: 'heroes_meet' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'The old grove at the heart of the forest holds the crystal. If it still stands...', visual: 'heroes_meet' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'It\'s stood through worse. So will we.', visual: 'heroes_meet' },
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
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'This is the anchor. It\'s dying just like—' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Never mind. It\'s not gone yet. That\'s what matters.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Something is here. Something that doesn\'t want us to restore it.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'There\'s a mark cut into the stone by the roots. A watch-sigil. Ours.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Kael—' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Later. Right now we deal with it first.' },
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
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Same sigil as the one on the crystal. My unit\'s mark. Someone else came through here.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Recently?' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Long enough the moss covered it. I don\'t know what that means yet.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Whatever it means, the anchor is holding. That\'s what tonight needed to be.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'The first one\'s the hardest to believe in. After this it\'s just... work.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Good. Let\'s get to work, then.' },
    { text: 'The first anchor holds. Whatever comes next, it comes for people who are still standing.', color: NARRATOR },
  ],

  // Chapter 2 — Sunken City story trigger before boss.
  ch2_warden: [
    { text: 'The chamber is vast, half-flooded. Pillars of ancient stone rise from black water.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'The Tidal Anchor\'s down there. Buried. Just like—' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Like the one you couldn\'t save?' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Yeah.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'This one isn\'t staying buried.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'There\'s something standing in the way. Something that used to be a Warden.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'One of ours. I don\'t care what it\'s become — it doesn\'t get to still wear that title.' },
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
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'It\'s surfacing. Whole. It waited down there — but it didn\'t drown.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'There\'s a blade in the wreckage. I know the maker\'s mark. Toren carried one like it.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'One of your seven?' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Was. I don\'t know how it got all the way down here.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Then he\'s still part of this. Whatever\'s collecting these anchors — it\'s touched more than we knew.' },
    { text: 'The pattern is older than four days. Older, maybe, than any of them had guessed.', color: NARRATOR },
  ],
  // Chapter 3 story trigger before Ashbrand.
  ch3_ashbrand: [
    { text: 'The summit is scorched stone and ash. At the center, a pillar of black rock pulses with fire.', color: NARRATOR },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'I know this text. Ashbrand wasn\'t captured — it swore an oath. Same as every Warden since.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Then it should still be in there. Buried under whatever\'s driving it now.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Can we get it back?' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'I don\'t know. But I intend to try before we put it down for good.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Not while it\'s like this. We break through first.' },
  ],

  ch3_win: [
    { text: 'The fire recedes. Ashbrand — the spirit within the anchor — stirs, as if waking from a long dream.', color: NARRATOR },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Still an oath-keeper under there. The corruption didn\'t erase that — it just buried it deeper than the anchor.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Ashbrand\'s been burning since before Eda was born. If someone\'s been doing this that long...' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: '...then Ashenveil wasn\'t the start. It might not even be close.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Then we keep going. That\'s always been the job.' },
    { text: 'The Ashen Peaks grow quiet for the first time in living memory. Somewhere, that quiet is noticed.', color: NARRATOR },
  ],

  // Chapter 4 — Crystal Depths story trigger before the Prism Sovereign.
  ch4_story: [
    { text: 'The cavern opens into a hollow so vast the crystal walls seem to breathe light.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'The Radiant Anchor. Whole — but wrapped, layer over layer. Someone\'s kept it alive on purpose.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'A guardian, once. Now it\'s wearing its own prison like armor.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'This casing is watch-work. Someone built this on purpose. Someone who knew exactly what they were doing.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Kael—' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Not now. Let\'s finish this first.' },
  ],

  ch4_win: [
    { text: 'The crystal shell fractures and falls away. The Prism Sovereign beneath it dims, then steadies.', color: NARRATOR },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Four now. Whatever\'s underneath, it just lost real ground.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Kael. Finish what you didn\'t say back there.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'The casing was watch-work. Real craftsmanship, not scavenged. Someone from the old line is still building — for whoever\'s doing this.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Willingly or not, I don\'t know yet. I need to find out which.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Then we will.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Eight anchors left. Wherever the trail goes, it goes through them.' },
    { text: 'Deep beneath Sanctuary, something that has been patient for a very long time stops being patient.', color: NARRATOR },
  ],

  ending: [
    { text: 'Four anchors restored. Four corrupted guardians returned to the light.', color: NARRATOR },
    { text: 'The world still sinks — but slower now. Sanctuary stands.', color: NARRATOR },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Toren\'s blade is with me now. However this ends, that\'s one name I get to remember properly.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'I used to think restoring anchors was about not failing again. Now I think it\'s about everyone still ahead of us who hasn\'t failed yet.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'The Wardens kept faith for a thousand years without knowing why. Now we know. That\'s not nothing.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'Whatever left that sigil by our well didn\'t need to reach us. It could have. That\'s the part that doesn\'t let me sleep.' },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Eight anchors remain. And whoever\'s behind this now knows exactly who\'s coming.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Let them.' },
    { text: '— The story continues in a future update —', color: NARRATOR },
    { text: 'Thank you for playing Aetherfall.', color: NARRATOR },
  ],
  // Post-Ch3 NPC follow-ups
  npc_keeper_after3: [
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'Three anchors. The scouts are reporting light returning to places that\'ve been dark for a decade.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'But something else is moving. Deeper than the anchors. Older. I don\'t know what it is yet.' },
  ],
  npc_scholar_after3: [
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'The old texts mention twelve anchors — but they also mention something that predates them all.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'The Hollow. The empty space beneath the world where the Aether originally fell from. I think it\'s waking up.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'That grove where the first anchor stood — old maps call it "Twisting Hollow." No one ever explained why.' },
  ],
  // The Stranger — appears after Ch1, hints at a deeper threat
  npc_stranger: [
    { speaker: '???', color: 0x8a93b8, text: 'One anchor restored. The drain isn\'t stopping — it\'s slowing.' },
    { speaker: '???', color: 0x8a93b8, text: 'Someone is collecting the fallen Aether. The anchors aren\'t failing on their own.' },
  ],
  npc_stranger_after2: [
    { speaker: '???', color: 0x8a93b8, text: 'Ten anchors remain. But the one who\'s draining them will feel each restoration like a thorn.' },
    { speaker: '???', color: 0x8a93b8, text: 'I stood where the Tide Warden used to kneel, long before it was a Warden at all. They\'ll send something worse soon. Be ready.' },
  ],
  npc_stranger_after3: [
    { speaker: '???', color: 0x8a93b8, text: 'The Hollow stirs. When the time comes, you\'ll need to go deeper than any map shows.' },
    { speaker: '???', color: 0x8a93b8, text: 'Nine more anchors. And then... something else entirely.' },
    { speaker: '???', color: 0x8a93b8, text: 'Your swordsman carries a new blade. Ask him whose. I already know the answer, and I don\'t think you\'ll like it.' },
  ],
  npc_child_after1: [
    { speaker: 'Child', color: 0x6cf0c2, text: 'The wolves are gone from Ashenveil. Pip came back last night.' },
    { speaker: 'Child', color: 0x6cf0c2, text: 'He smells like pine and wet stone. I think he was waiting in the grove.' },
  ],
  npc_child_after2: [
    { speaker: 'Child', color: 0x6cf0c2, text: 'Pip won\'t go near the well anymore. He used to love it.' },
    { speaker: 'Child', color: 0x6cf0c2, text: 'Mum says the water\'s calmer since you fixed the city under the waves. Maybe he can tell.' },
  ],
  npc_child_after3: [
    { speaker: 'Child', color: 0x6cf0c2, text: 'I can see three stars now that were missing before. Mum says those are the anchors you fixed.' },
    { speaker: 'Child', color: 0x6cf0c2, text: 'The Stranger told me there are nine more. Are you going to fix all of them?' },
  ],
  // Post-Ch4 NPC follow-ups
  npc_keeper_after4: [
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'Four anchors. The scouts who go near the deep caverns don\'t come back the same — quieter, like they heard something.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'I served with Kael\'s watch-line, years back. If pieces of it are still turning up this far from where they fell, whatever\'s out there isn\'t finished with them. Watch yourselves.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'I put my name to that assignment. Eight names on a roster, and I signed off on all of them.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'Kael came back. I told myself that meant it was worth it. I don\'t know if I believe that anymore — but I\'m glad it was him.' },
  ],
  npc_scholar_after4: [
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'Four anchors restored, and the old texts agree on one thing now: the anchors aren\'t just lamps. They\'re a seal.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'Every one we fix pushes the Hollow back down. And every one we fix, it pushes harder.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'I finally translated that old name properly. "Twisting Hollow" isn\'t a place-name. It\'s a warning, carved by whoever built the original seal.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'Ashenveil was the weakest anchor of the twelve. Whoever is doing this didn\'t stumble onto it first. They chose it.' },
  ],
  npc_stranger_after4: [
    { speaker: '???', color: 0x8a93b8, text: 'Four now. It felt that one — I saw it flinch, if a thing like that can flinch.' },
    { speaker: '???', color: 0x8a93b8, text: 'Eight anchors left. It will not let you reach all of them quietly. Or all of you.' },
  ],
  npc_child_after4: [
    { speaker: 'Child', color: 0x6cf0c2, text: 'Four stars now. I drew them on my wall so I don\'t forget which ones are yours.' },
    { speaker: 'Child', color: 0x6cf0c2, text: 'Mum said something\'s digging under the city at night. Is that the thing you\'re fighting?' },
    { speaker: 'Child', color: 0x6cf0c2, text: 'Pip dug something up by the old well last night. I didn\'t touch it — it felt cold, like the stuff you bring back from the anchors.' },
    { text: 'Under a flat stone, wrapped in cloth: a small, tarnished watch-sigil — the same mark from the grove, and from the casing in the depths.', color: NARRATOR },
    { speaker: 'Child', color: 0x6cf0c2, text: 'Is that bad? You look like it\'s bad.' },
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
