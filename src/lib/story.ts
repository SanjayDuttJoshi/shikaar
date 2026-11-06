import { Theme } from "@/types/world";

export interface BuildingStory {
  /** One line under the building name on the intro card. */
  hook: string;
  /** Shown on the results screen. */
  escaped: string;
  caught: string;
}

/**
 * The story behind both buildings. Kamla, the haveli's young bahu, was locked in the cellar by
 * Thakur Raghunath and never came out (now the Chudail). The watchman Bhairav knew, so he was framed
 * and sent to the asylum, where they broke him into the Shikari. Raghu, patient 47, saw what Bhairav
 * became and blinded himself (now the Andha Mareez). The films in src/content/films.ts tell it.
 */
export const STORY: Record<Theme, BuildingStory> = {
  [Theme.Asylum]: {
    hook: "Lakhanpur Sarkari Mansik Aspatal. 1987 se band.",
    escaped: "Gate ke bahar subah ho rahi thi. Tabhi peeche se awaaz aayi: \"ek... do... teen...\" Ginti ab bhi chal rahi hai.",
    caught: "Laal lalten ki roshni dheere dheere paas aayi. Phir ginti mein ek naam aur jud gaya.",
  },
  [Theme.Haveli]: {
    hook: "Thakur Raghunath Singh ki haveli. 1979 se veeran.",
    escaped: "Bahar aakar tumne mud ke dekha. Upar jharokhe mein ek safed saree hil rahi thi, aur halki si lori sunai de rahi thi...",
    caught: "Payal ki chhan chhan bilkul paas aa ke ruk gayi. Haveli ne ek aur mehmaan rakh liya.",
  },
};
