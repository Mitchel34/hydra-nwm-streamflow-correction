import { makeHandler } from "../agu-hrrr/server/chat.mjs";

const handle = makeHandler();

export default { fetch: handle };
