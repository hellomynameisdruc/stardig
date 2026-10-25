// The closed beta: one star (House) is open to everyone; the rest of the map can be flown and looked at, but
// its music, COMMS and broadcasting need access — given by the founder or an invite code (see the
// pilot card). The UI fills in `open` from the signed-in pilot.
import { galaxy } from "./state";

export const beta = {
  /** the closed beta is on (off: everything open to everyone) */
  on: true,
  /** the star (style) anyone may listen to */
  star: "House",
  /** this visitor has access */
  open: false,
};
const openStar = galaxy.starIndex(beta.star);
/** the open star's name */
export const openName = () => galaxy.stars[openStar]?.name ?? "";
/** may this visitor play star s's tracks */
export const starOpen = (s: number) => !beta.on || beta.open || galaxy.meta.sample || openStar < 0 || s === openStar;
