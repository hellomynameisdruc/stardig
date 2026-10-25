// The closed beta: one galaxy is open to everyone; the rest of the map can be flown and looked at, but
// its music, COMMS and broadcasting need access — given by the founder or an invite code (see the
// pilot card). The UI fills in `open` from the signed-in pilot.
import { galaxy } from "./state";

export const beta = {
  /** the closed beta is on (off: everything open to everyone) */
  on: true,
  /** the galaxy (sector id) anyone may listen to */
  galaxy: "house",
  /** this visitor has access */
  open: false,
};
const openGalaxy = galaxy.nebulae.findIndex((n) => n.id === beta.galaxy);
/** the open galaxy's name */
export const openName = () => galaxy.nebulae[openGalaxy]?.name ?? "";
/** may this visitor play star s's tracks */
export const starOpen = (s: number) => !beta.on || beta.open || galaxy.meta.sample || openGalaxy < 0 || galaxy.stars[s]?.g === openGalaxy;
